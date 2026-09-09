// ============================================================================
// NFL Edge Board — market line sync (DraftKings, via ESPN, real & free)
//
// ESPN's scoreboard exposes a real DraftKings line for every game — verified
// live against actual 2026 Week 1 odds (see src/lib/nfl-edge/espn.ts for the
// details). No FanDuel feed exists this way; FanDuel stays manual-entry in
// the dashboard (/admin/nfl-edge/week/[n]) unless a paid aggregator like The
// Odds API gets wired in later.
//
// market_lines is append-only by design (each run adds a new snapshot, so
// the scoring engine can compare opening vs. current for line-movement/RLM
// signals) — this script is safe to run as often as you like, e.g. a few
// times through the week to catch line movement, and again close to kickoff.
//
// Usage:  npx tsx scripts/nfl-edge/sync-market-lines.ts <seasonYear> <week>
// ============================================================================
import 'dotenv/config'
import { nflEdgeDb } from '../../src/lib/nfl-edge/supabase-admin'
import { getWeekMarketLines } from '../../src/lib/nfl-edge/espn'

const seasonYear = Number(process.argv[2])
const week = Number(process.argv[3])
if (!seasonYear || !week) {
  console.error('Usage: npx tsx scripts/nfl-edge/sync-market-lines.ts <seasonYear> <week>')
  process.exit(1)
}

async function main() {
  const db = nflEdgeDb()

  const { data: games, error } = await db
    .from('games')
    .select('id, espn_event_id')
    .eq('season_year', seasonYear)
    .eq('week_number', week)
  if (error) throw error
  if (!games || games.length === 0) {
    console.log(`No games found for ${seasonYear} week ${week} — run sync-schedule.ts first.`)
    return
  }

  const gameByEspnId = new Map<string, string>(games.map((g: any) => [g.espn_event_id, g.id]))

  const lines = await getWeekMarketLines(seasonYear, week)
  if (lines.length === 0) {
    console.log('ESPN returned no odds for this week yet (lines usually post a few days out from kickoff).')
    return
  }

  const rows = lines
    .map((l) => {
      const gameId = gameByEspnId.get(l.espnEventId)
      if (!gameId) return null
      return {
        game_id: gameId,
        sportsbook: 'draftkings' as const,
        home_spread: l.homeSpread,
        total: l.total,
        home_moneyline: l.homeMoneyline,
        away_moneyline: l.awayMoneyline,
        source: 'espn',
        captured_at: new Date().toISOString(),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length === 0) {
    console.log('No matching games for the odds ESPN returned.')
    return
  }

  const { error: insErr } = await db.from('market_lines').insert(rows)
  if (insErr) throw insErr

  console.log(`Inserted ${rows.length} DraftKings line snapshots for ${seasonYear} week ${week}.`)
  for (const l of lines) {
    if (gameByEspnId.has(l.espnEventId)) {
      console.log(`  ${l.providerName}: espn#${l.espnEventId} spread=${l.homeSpread} total=${l.total}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
