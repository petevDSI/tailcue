// ============================================================================
// NFL Edge Board — SportsGameOdds (SGO) client
//
// Primary odds source (game lines AND player props, DraftKings + FanDuel,
// both free) — verified live against the real 2026 Week 1 slate on
// 2026-09-09: real players (Drake Maye, Sam Darnold), real distinct
// per-book pricing on spread/total/moneyline/props, real book deeplinks,
// live-moving lines (open vs. current differ). Free "Amateur" tier caps at
// 2,500 objects/month, but an "object" = one event returned (confirmed via
// GET /account/usage), so even a couple of full 16-game-week syncs a day
// stays comfortably inside the cap for the whole season.
//
// Base URL / auth: https://api.sportsgameodds.com/v2, apiKey as a query
// param (SGO_API_KEY in .env.local — never committed).
//
// If this fails (key exhausted, outage, schema change), sync-market-lines.ts
// falls back to TheRundown (src/lib/nfl-edge/therundown.ts) for game lines —
// player props have no free fallback; see that file's header for why.
// ============================================================================

const BASE = 'https://api.sportsgameodds.com/v2'

function apiKey(): string {
  const key = process.env.SGO_API_KEY
  if (!key) throw new Error('Missing SGO_API_KEY in .env.local')
  return key
}

async function getJson<T = any>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, apiKey: apiKey() })
  const res = await fetch(`${BASE}${path}?${qs.toString()}`)
  if (!res.ok) throw new Error(`SGO fetch failed (${res.status}): ${path}`)
  return res.json() as Promise<T>
}

export type SgoBook = 'draftkings' | 'fanduel'
const BOOKS: SgoBook[] = ['draftkings', 'fanduel']

export interface SgoGameLineRow {
  sgoEventId: string
  homeSgoTeamId: string
  awaySgoTeamId: string
  sportsbook: SgoBook
  homeSpread: number | null
  total: number | null
  homeMoneyline: number | null
  awayMoneyline: number | null
}

export interface SgoPlayerPropRow {
  sgoEventId: string
  playerName: string
  playerSgoTeamId: string | null
  sportsbook: SgoBook
  market: string // e.g. "passing_yards"
  line: number | null
  overPrice: number | null
  underPrice: number | null
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** byBookmaker.<book> entry, or null if missing/explicitly marked unavailable. */
function bookEntry(odd: any, book: SgoBook): any | null {
  const entry = odd?.byBookmaker?.[book]
  if (!entry) return null
  if (entry.available === false) return null
  return entry
}

function extractGameLines(event: any): SgoGameLineRow[] {
  const home = event.teams?.home?.teamID
  const away = event.teams?.away?.teamID
  if (!home || !away) return []
  const odds = event.odds ?? {}

  const spreadOdd = odds['points-home-game-sp-home']
  const homeMlOdd = odds['points-home-game-ml-home']
  const awayMlOdd = odds['points-away-game-ml-away']
  const totalOdd = odds['points-all-game-ou-over']

  const rows: SgoGameLineRow[] = []
  for (const book of BOOKS) {
    const sp = bookEntry(spreadOdd, book)
    const hMl = bookEntry(homeMlOdd, book)
    const aMl = bookEntry(awayMlOdd, book)
    const tot = bookEntry(totalOdd, book)
    // Require at least one real number, otherwise skip (nothing usable from this book yet).
    if (!sp && !hMl && !aMl && !tot) continue
    rows.push({
      sgoEventId: event.eventID,
      homeSgoTeamId: home,
      awaySgoTeamId: away,
      sportsbook: book,
      homeSpread: numOrNull(sp?.spread),
      total: numOrNull(tot?.overUnder),
      homeMoneyline: numOrNull(hMl?.odds),
      awayMoneyline: numOrNull(aMl?.odds),
    })
  }
  return rows
}

function extractPlayerProps(event: any): SgoPlayerPropRow[] {
  const odds = event.odds ?? {}
  const players = event.players ?? {}
  const rows: SgoPlayerPropRow[] = []

  for (const odd of Object.values(odds) as any[]) {
    if (!odd?.playerID) continue // game-level lines have no playerID
    if (odd.periodID !== 'game') continue // SGO also returns 1Q/2Q/1H/etc. props under the same statID — full-game only
    if (odd.sideID !== 'over') continue // process each over/under pair once, keyed off the "over" side
    const underOdd = odd.opposingOddID ? odds[odd.opposingOddID] : null
    const player = players[odd.playerID]

    for (const book of BOOKS) {
      const overEntry = bookEntry(odd, book)
      const underEntry = underOdd ? bookEntry(underOdd, book) : null
      if (!overEntry && !underEntry) continue
      rows.push({
        sgoEventId: event.eventID,
        playerName: player?.name ?? odd.playerID,
        playerSgoTeamId: player?.teamID ?? null,
        sportsbook: book,
        market: odd.statID ?? 'unknown',
        line: numOrNull(overEntry?.overUnder ?? underEntry?.overUnder),
        overPrice: numOrNull(overEntry?.odds),
        underPrice: numOrNull(underEntry?.odds),
      })
    }
  }
  return rows
}

/**
 * Pulls every NFL event starting in [startsAfter, startsBefore) with open
 * DraftKings/FanDuel odds, and returns both game lines and player props
 * already flattened into insert-ready rows (still keyed by SGO's own event
 * and team IDs — the caller maps those to `games`/`teams` rows).
 */
export async function getWeekMarketData(
  startsAfter: string,
  startsBefore: string
): Promise<{ gameLines: SgoGameLineRow[]; playerProps: SgoPlayerPropRow[] }> {
  const gameLines: SgoGameLineRow[] = []
  const playerProps: SgoPlayerPropRow[] = []
  let cursor: string | undefined

  do {
    const params: Record<string, string> = {
      leagueID: 'NFL',
      oddsAvailable: 'true',
      bookmakerID: 'draftkings,fanduel',
      startsAfter,
      startsBefore,
      limit: '50',
    }
    if (cursor) params.cursor = cursor

    const data = await getJson<{ data: any[]; nextCursor?: string }>('/events', params)
    for (const event of data.data ?? []) {
      gameLines.push(...extractGameLines(event))
      playerProps.push(...extractPlayerProps(event))
    }
    cursor = data.nextCursor
  } while (cursor)

  return { gameLines, playerProps }
}
