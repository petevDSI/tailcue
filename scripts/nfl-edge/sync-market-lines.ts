// ============================================================================
// NFL Edge Board — market line sync (game lines: spread/total/moneyline)
//
// Primary source: SportsGameOdds (real DraftKings + FanDuel, free — see
// src/lib/nfl-edge/sportsgameodds.ts). If SGO returns nothing for the week
// (key exhausted/outage/schema change), falls back to TheRundown (also
// real, DraftKings + FanDuel, free for game lines — see therundown.ts).
// Only one source's rows get inserted per run — never both, so a fallback
// run can't double-count a week.
//
// market_lines is append-only by design (each run adds a new snapshot, so
// the scoring engine can compare opening vs. current for line-movement/RLM
// signals) — safe to run as often as you like through the week.
//
// Usage:  npx tsx scripts/nfl-edge/sync-market-lines.ts <seasonYear> <week>
// ============================================================================
import { config } from 'dotenv'
config({ path: '.env.local' }) // scripts run outside Next.js, which is what normally loads .env.local
import { nflEdgeDb } from '../../src/lib/nfl-edge/supabase-admin'
import { getWeekMarketData } from '../../src/lib/nfl-edge/sportsgameodds'
import { getDatesMarketLines } from '../../src/lib/nfl-edge/therundown'

const seasonYear = Number(process.argv[2])
const week = Number(process.argv[3])
if (!seasonYear || !week) {
  console.error('Usage: npx tsx scripts/nfl-edge/sync-market-lines.ts <seasonYear> <week>')
  process.exit(1)
}

type Row = {
  game_id: string
  sportsbook: 'draftkings' | 'fanduel'
  home_spread: number | null
  home_moneyline: number | null
  away_moneyline: number | null
  total: number | null
  source: string
  captured_at: string
}

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

async function main() {
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
    console.log(`No games found for ${seasonYear} week ${week} — run sync-schedule.ts first.`)
    return
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
    console.log(
      'Neither SportsGameOdds nor TheRundown returned usable lines for this week (lines usually post a few days out from kickoff).'
    )
    return
  }

  const { error: insErr } = await db.from('market_lines').insert(rows)
  if (insErr) throw insErr

  console.log(`Inserted ${rows.length} line snapshots for ${seasonYear} week ${week} (source: ${usedSource}).`)
  for (const r of rows) {
    console.log(`  ${r.sportsbook}: game ${r.game_id} spread=${r.home_spread} total=${r.total} ml=${r.home_moneyline}/${r.away_moneyline}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
