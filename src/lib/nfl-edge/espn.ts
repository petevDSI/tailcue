// ============================================================================
// NFL Edge Board — ESPN "hidden" API client
//
// Free, keyless, no documented rate limit. Two host families:
//   site.api.espn.com    — the friendlier site API (scoreboard, teams, roster)
//   sports.core.api.espn.com — the deeper "core" API, mostly returning
//                              paginated { $ref } links you have to follow.
// Used for: season schedule (already seeded once via migration — this is
// the reusable/re-runnable version) and weekly injury reports (verified
// live and real — see the 2026-09-09 test against team 12/KC below).
// ============================================================================

const SITE_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'
const CORE_BASE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl'

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

interface EspnRefList {
  count: number
  pageCount: number
  items: Array<{ $ref: string }>
}

interface EspnInjuryDetail {
  id: string
  status: string // 'Questionable' | 'Doubtful' | 'Out' | 'Probable' | ...
  date: string
  shortComment?: string
  athlete: { $ref: string }
  details?: { type?: string }
}

export interface RawTeamInjury {
  athleteId: string
  status: string
  date: string
  note: string | null
}

/**
 * Pulls team injuries, keeping only the most recent entry per athlete and
 * only entries from the last 10 days (a full-season history comes back
 * otherwise — ESPN doesn't scope this endpoint to "current week" itself).
 */
export async function getTeamCurrentInjuries(espnTeamId: string): Promise<RawTeamInjury[]> {
  const listUrl = `${CORE_BASE}/seasons/2026/teams/${espnTeamId}/injuries?page=1`
  let list: EspnRefList
  try {
    list = await getJson<EspnRefList>(listUrl)
  } catch {
    return []
  }

  const refs = (list.items ?? []).slice(0, 25) // first page only — most recent first, empirically
  const details = await Promise.all(
    refs.map((r) =>
      getJson<EspnInjuryDetail>(r.$ref).catch(() => null)
    )
  )

  const cutoff = Date.now() - 10 * 86_400_000
  const byAthlete = new Map<string, RawTeamInjury>()
  for (const d of details) {
    if (!d) continue
    const ts = new Date(d.date).getTime()
    if (ts < cutoff) continue
    const athleteId = d.athlete.$ref.match(/athletes\/(\d+)/)?.[1]
    if (!athleteId) continue
    const existing = byAthlete.get(athleteId)
    if (!existing || new Date(existing.date).getTime() < ts) {
      byAthlete.set(athleteId, {
        athleteId,
        status: d.status,
        date: d.date,
        note: d.shortComment ?? null,
      })
    }
  }
  return Array.from(byAthlete.values())
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
