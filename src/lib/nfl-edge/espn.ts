// ============================================================================
// NFL Edge Board — ESPN "hidden" API client
//
// Free, keyless, no documented rate limit. Two host families:
//   site.api.espn.com    — the friendlier site API (scoreboard, teams, roster)
//   sports.core.api.espn.com — the deeper "core" API, mostly returning
//                              paginated { $ref } links you have to follow.
// Used for: season schedule (already seeded once via migration — this is
// the reusable/re-runnable version) and weekly injury reports (the
// league-wide site-API endpoint below — see getAllCurrentInjuries for the
// 2026-09-10 note on why this replaced an earlier core-API approach).
// ============================================================================

const SITE_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'
// The old sports.core.api.espn.com "core" API is no longer used here — its
// per-team injuries endpoint broke (see getAllCurrentInjuries below).

async function getJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ESPN fetch failed (${res.status}): ${url}`)
  return res.json() as Promise<T>
}

export interface EspnScoreboardEvent {
  id: string
  date: string
  week: { number: number }
  competitions: Array<{
    competitors: Array<{
      homeAway: 'home' | 'away'
      team: { id: string; abbreviation: string }
      score?: string
    }>
  }>
  status: { type: { state: string; completed: boolean } }
}

export async function getScoreboardWeek(
  seasonYear: number,
  week: number,
  seasonType: 1 | 2 | 3 = 2
): Promise<EspnScoreboardEvent[]> {
  const url = `${SITE_BASE}/scoreboard?week=${week}&seasontype=${seasonType}&dates=${seasonYear}`
  const data = await getJson<{ events: EspnScoreboardEvent[] }>(url)
  return data.events ?? []
}

export interface EspnRosterAthlete {
  id: string
  fullName: string
  position?: { abbreviation?: string }
}

/** Flat id -> {fullName, position} map for one team, pulled from all position groups. */
export async function getTeamRosterMap(espnTeamId: string): Promise<Map<string, { name: string; position: string }>> {
  const url = `${SITE_BASE}/teams/${espnTeamId}/roster`
  const data = await getJson<{ athletes: Array<{ items: EspnRosterAthlete[] }> }>(url)
  const map = new Map<string, { name: string; position: string }>()
  for (const group of data.athletes ?? []) {
    for (const a of group.items ?? []) {
      map.set(a.id, { name: a.fullName, position: a.position?.abbreviation ?? '' })
    }
  }
  return map
}

export interface RawInjuryEntry {
  playerName: string
  position: string | null
  status: string // raw ESPN status string — 'Questionable' | 'Doubtful' | 'Out' | 'Probable' | 'Injured Reserve' | 'Suspension' | 'Active' | ...
  note: string | null
}

/**
 * Pulls the ENTIRE league's current injury report in one call.
 *
 * NOTE (2026-09-10): this replaced a per-team CORE_BASE endpoint
 * (`${CORE_BASE}/seasons/{year}/teams/{id}/injuries`) that this file's own
 * comment had verified live and working just one day earlier, and which
 * then started returning a genuine HTTP 404 for every team, including
 * fully-populated past seasons — an unannounced breaking change on ESPN's
 * undocumented API (the exact kind of risk this file has always called
 * out — see the file header). Verified this replacement live: real,
 * dated current entries, 32 teams, ~800 league-wide injury rows.
 *
 * This endpoint is simpler than the old approach, not just a workaround:
 * player name and position come directly off each entry's `athlete`
 * object, so the separate per-team roster-map lookup the old code needed
 * (to turn an athlete id into a name/position) is no longer necessary.
 */
export async function getAllCurrentInjuries(): Promise<Map<string, RawInjuryEntry[]>> {
  const url = `${SITE_BASE}/injuries`
  const data = await getJson<{
    injuries: Array<{
      id: string
      injuries: Array<{
        status: string
        shortComment?: string
        athlete?: { displayName?: string; position?: { abbreviation?: string } }
      }>
    }>
  }>(url)

  const map = new Map<string, RawInjuryEntry[]>()
  for (const team of data.injuries ?? []) {
    const entries: RawInjuryEntry[] = (team.injuries ?? []).map((inj) => ({
      playerName: inj.athlete?.displayName ?? 'Unknown',
      position: inj.athlete?.position?.abbreviation ?? null,
      status: inj.status,
      note: inj.shortComment ?? null,
    }))
    map.set(team.id, entries)
  }
  return map
}

// ---------------------------------------------------------------------------
// Market lines (odds) — DraftKings, real, free
//
// ESPN's scoreboard payload carries a real betting line per game, attributed
// to a named provider. Empirically (checked live against the actual 2026
// Week 1 slate) that provider is DraftKings for every NFL game — no FanDuel
// feed exists here, only DK. Confirmed the `spread` field is already signed
// from the HOME team's perspective (negative = home favored), matching this
// project's `market_lines.home_spread` column directly — no sign flip needed.
// ---------------------------------------------------------------------------

export interface EspnMarketLine {
  espnEventId: string
  providerName: string
  homeSpread: number | null
  total: number | null
  homeMoneyline: number | null
  awayMoneyline: number | null
}

export async function getWeekMarketLines(
  seasonYear: number,
  week: number,
  seasonType: 1 | 2 | 3 = 2
): Promise<EspnMarketLine[]> {
  const url = `${SITE_BASE}/scoreboard?week=${week}&seasontype=${seasonType}&dates=${seasonYear}`
  const data = await getJson<{ events: any[] }>(url)
  const lines: EspnMarketLine[] = []

  for (const ev of data.events ?? []) {
    const comp = ev.competitions?.[0]
    const oddsList = comp?.odds as any[] | undefined
    if (!oddsList || oddsList.length === 0) continue
    // Prefer DraftKings by name if multiple providers ever show up; fall back to whatever's first.
    const odds = oddsList.find((o) => o.provider?.name === 'DraftKings') ?? oddsList[0]

    const homeMl = odds.moneyline?.home?.close?.odds
    const awayMl = odds.moneyline?.away?.close?.odds

    lines.push({
      espnEventId: ev.id,
      providerName: odds.provider?.name ?? 'unknown',
      homeSpread: typeof odds.spread === 'number' ? odds.spread : null,
      total: typeof odds.overUnder === 'number' ? odds.overUnder : null,
      homeMoneyline: homeMl !== undefined ? Number(homeMl) : null,
      awayMoneyline: awayMl !== undefined ? Number(awayMl) : null,
    })
  }

  return lines
}
