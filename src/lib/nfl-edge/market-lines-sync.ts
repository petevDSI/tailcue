// ============================================================================
// NFL Edge Board — market line sync (game lines: spread/total/moneyline)
//
// Extracted 2026-09-10 from sync-market-lines.ts (same reason as
// power-rating-model.ts's extraction) so this same fetch-and-insert logic
// can be called from both the manual CLI script AND the closing-lines cron
// route (src/app/api/admin/nfl-edge/cron/sync-closing-lines) without
// duplicating it — one implementation, not two that can drift apart.
//
// Primary source: SportsGameOdds (real DraftKings + FanDuel, free — see
// sportsgameodds.ts). If SGO returns nothing for the week (key
// exhausted/outage/schema change), falls back to TheRundown (also real,
// DraftKings + FanDuel, free for game lines — see therundown.ts). Only one
// source's rows get inserted per run — never both, so a fallback run can't
// double-count a week.
//
// market_lines is append-only by design (each run adds a new snapshot, so
// the scoring engine can compare opening vs. current for line-movement/RLM
// signals, and so repeated runs across a week build a history that gets
// closer to the true closing line as kickoff approaches) — safe to call as
// often as the caller's schedule allows.
// ============================================================================
import { nflEdgeDb } from './supabase-admin'
import { getWeekMarketData } from './sportsgameodds'
import { getDatesMarketLines } from './therundown'

export type Row = {
  game_id: string
  sportsbook: 'draftkings' | 'fanduel'
  home_spread: number | null
  home_moneyline: number | null
  away_moneyline: number | null
  total: number | null
  source: string
  captured_at: string
}

export type SyncResult =
  | { status: 'no_games' }
  | { status: 'no_lines' }
  | { status: 'inserted'; count: number; source: string; rows: Row[] }

async function tryFetchSgo(
  games: any[],
  windowStart: string,
  windowEnd: string
): Promise<Row[] | null> {
  try {
    const { gameLines } = await getWeekMarketData(windowStart, windowEnd)
    if (gameLines.length === 0) return null

    const gameBySgoTeams = new Map<string, string>(
      games.map((g: any) => [`${g.home_sgo}|${g.away_sgo}`, g.id])
    )

    const rows: Row[] = gameLines
      .map((l) => {
        const gameId = gameBySgoTeams.get(`${l.homeSgoTeamId}|${l.awaySgoTeamId}`)
        if (!gameId) return null
        return {
          game_id: gameId,
          sportsbook: l.sportsbook,
          home_spread: l.homeSpread,
          home_moneyline: l.homeMoneyline,
          away_moneyline: l.awayMoneyline,
          total: l.total,
          source: 'sportsgameodds',
          captured_at: new Date().toISOString(),
        }
      })
      .filter((r): r is Row => r !== null)

    return rows.length > 0 ? rows : null
  } catch (err) {
    console.warn('SportsGameOdds fetch failed, will try TheRundown fallback:', (err as Error).message)
    return null
  }
}

async function tryFetchRundown(games: any[], datesISO: string[]): Promise<Row[] | null> {
  try {
    const lines = await getDatesMarketLines(datesISO)
    if (lines.length === 0) return null

    const gameByNames = new Map<string, string>(
      games.map((g: any) => [`${g.home_name}|${g.away_name}`, g.id])
    )

    const rows: Row[] = lines
      .map((l) => {
        const gameId = gameByNames.get(`${l.homeTeamName}|${l.awayTeamName}`)
        if (!gameId) return null
        return {
          game_id: gameId,
          sportsbook: l.sportsbook,
          home_spread: l.homeSpread,
          home_moneyline: l.homeMoneyline,
          away_moneyline: l.awayMoneyline,
          total: l.total,
          source: 'therundown',
          captured_at: new Date().toISOString(),
        }
      })
      .filter((r): r is Row => r !== null)

    return rows.length > 0 ? rows : null
  } catch (err) {
    console.warn('TheRundown fallback also failed:', (err as Error).message)
    return null
  }
}

/**
 * Fetches current market lines for one season/week from SGO (falling back
 * to TheRundown) and inserts them as a new market_lines snapshot. Pure
 * function, no CLI/process concerns — safe to call from a route handler.
 */
export async function syncMarketLinesForWeek(seasonYear: number, week: number): Promise<SyncResult> {
  const db = nflEdgeDb()

  const { data: games, error } = await db
    .from('games')
    .select(
      'id, game_time, home_team_id, away_team_id, home:teams!home_team_id(name, sgo_team_id), away:teams!away_team_id(name, sgo_team_id)'
    )
    .eq('season_year', seasonYear)
    .eq('week_number', week)
  if (error) throw error
  if (!games || games.length === 0) {
    return { status: 'no_games' }
  }

  const flat = games.map((g: any) => ({
    id: g.id,
    game_time: g.game_time,
    home_sgo: g.home?.sgo_team_id,
    away_sgo: g.away?.sgo_team_id,
    home_name: g.home?.name,
    away_name: g.away?.name,
  }))

  const times = flat.map((g: any) => new Date(g.game_time).getTime())
  const windowStart = new Date(Math.min(...times) - 6 * 3600_000).toISOString()
  const windowEnd = new Date(Math.max(...times) + 6 * 3600_000).toISOString()
  const datesSeen: Record<string, true> = {}
  for (const g of flat) {
    datesSeen[new Date(g.game_time).toISOString().slice(0, 10)] = true
  }
  const datesISO = Object.keys(datesSeen)

  let rows = await tryFetchSgo(flat, windowStart, windowEnd)
  let usedSource = 'sportsgameodds'
  if (!rows) {
    rows = await tryFetchRundown(flat, datesISO)
    usedSource = 'therundown'
  }

  if (!rows || rows.length === 0) {
    return { status: 'no_lines' }
  }

  const { error: insErr } = await db.from('market_lines').insert(rows)
  if (insErr) throw insErr

  return { status: 'inserted', count: rows.length, source: usedSource, rows }
}
