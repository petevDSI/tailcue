// ============================================================================
// NFL Edge Board — TheRundown client (fallback odds source)
//
// SportsGameOdds (sportsgameodds.ts) is the primary source for both game
// lines and player props. TheRundown is the backstop for GAME LINES ONLY —
// verified live against the real 2026 Week 1 slate on 2026-09-09: real
// moneyline/spread/total pricing, distinct per book, live timestamps and
// price deltas. It has no free player-props tier (gated behind the $49/mo
// Starter plan), so there is no props fallback — if SGO is down, props sync
// simply reports nothing for that run rather than silently using stale or
// fabricated data.
//
// Base URL / auth: https://therundown.io/api/v2, header X-TheRundown-Key
// (THERUNDOWN_API_KEY in .env.local — never committed). affiliate_id 19 =
// DraftKings, 23 = FanDuel, sport_id 2 = NFL (all confirmed live).
// ============================================================================

const BASE = 'https://therundown.io/api/v2'
const NFL_SPORT_ID = 2
const AFFILIATE_IDS: Record<'draftkings' | 'fanduel', number> = { draftkings: 19, fanduel: 23 }

function apiKey(): string {
  const key = process.env.THERUNDOWN_API_KEY
  if (!key) throw new Error('Missing THERUNDOWN_API_KEY in .env.local')
  return key
}

async function getJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'X-TheRundown-Key': apiKey() } })
  if (!res.ok) throw new Error(`TheRundown fetch failed (${res.status}): ${url}`)
  return res.json() as Promise<T>
}

export interface RundownGameLineRow {
  rundownEventId: string
  homeTeamName: string // full name, e.g. "Seattle Seahawks" — matches nfl_edge.teams.name
  awayTeamName: string
  sportsbook: 'draftkings' | 'fanduel'
  homeSpread: number | null
  total: number | null
  homeMoneyline: number | null
  awayMoneyline: number | null
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function parseOneDate(data: { events: any[] }): RundownGameLineRow[] {
  const rows: RundownGameLineRow[] = []

  for (const ev of data.events ?? []) {
    const teams = ev.teams_normalized ?? []
    const homeMeta = teams.find((t: any) => t.is_home)
    const awayMeta = teams.find((t: any) => t.is_away)
    if (!homeMeta || !awayMeta) continue

    const markets = ev.markets ?? []
    const mlMarket = markets.find((m: any) => m.market_id === 1)
    const spMarket = markets.find((m: any) => m.market_id === 2)
    const totMarket = markets.find((m: any) => m.market_id === 3)

    for (const book of ['draftkings', 'fanduel'] as const) {
      const aff = String(AFFILIATE_IDS[book])

      // Moneyline / spread: participants are keyed by full team name.
      let homeMl: number | null = null
      let awayMl: number | null = null
      let homeSpread: number | null = null
      for (const p of mlMarket?.participants ?? []) {
        const price = p.lines?.[0]?.prices?.[aff]?.price
        if (p.name === homeMeta.name + ' ' + homeMeta.mascot) homeMl = numOrNull(price)
        if (p.name === awayMeta.name + ' ' + awayMeta.mascot) awayMl = numOrNull(price)
      }
      for (const p of spMarket?.participants ?? []) {
        if (p.name === homeMeta.name + ' ' + homeMeta.mascot) {
          homeSpread = numOrNull(p.lines?.[0]?.value)
        }
      }

      // Total: participants are "Over"/"Under", value is the same number on both sides.
      let total: number | null = null
      const overP = (totMarket?.participants ?? []).find((p: any) => p.name === 'Over')
      if (overP) total = numOrNull(overP.lines?.[0]?.value)

      if (homeMl === null && awayMl === null && homeSpread === null && total === null) continue

      rows.push({
        rundownEventId: String(ev.event_id),
        homeTeamName: `${homeMeta.name} ${homeMeta.mascot}`,
        awayTeamName: `${awayMeta.name} ${awayMeta.mascot}`,
        sportsbook: book,
        homeSpread,
        total,
        homeMoneyline: homeMl,
        awayMoneyline: awayMl,
      })
    }
  }
  return rows
}

/**
 * TheRundown's events endpoint is per-calendar-day, not per-range, so this
 * loops one call per date. An NFL week spans at most ~5 distinct dates
 * (Thu/Sun x2 waves/Mon, occasionally a Sat) — cheap either way.
 */
export async function getDatesMarketLines(datesISO: string[]): Promise<RundownGameLineRow[]> {
  const rows: RundownGameLineRow[] = []
  for (const dateISO of datesISO) {
    const url = `${BASE}/sports/${NFL_SPORT_ID}/events/${dateISO}?market_ids=1,2,3&affiliate_ids=19,23&main_line=true`
    const data = await getJson<{ events: any[] }>(url)
    rows.push(...parseOneDate(data))
  }
  return rows
}
