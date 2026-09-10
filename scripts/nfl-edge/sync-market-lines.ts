// ============================================================================
// NFL Edge Board — market line sync CLI (game lines: spread/total/moneyline)
//
// The actual fetch-and-insert logic lives in
// src/lib/nfl-edge/market-lines-sync.ts (extracted 2026-09-10 so the
// closing-lines cron route — src/app/api/admin/nfl-edge/cron/sync-closing-lines
// — can call the exact same code manually run here). This file is just:
// parse argv, call it, log the result.
//
// Usage:  npx tsx scripts/nfl-edge/sync-market-lines.ts <seasonYear> <week>
// ============================================================================
import { config } from 'dotenv'
config({ path: '.env.local' }) // scripts run outside Next.js, which is what normally loads .env.local
import { syncMarketLinesForWeek } from '../../src/lib/nfl-edge/market-lines-sync'

const seasonYear = Number(process.argv[2])
const week = Number(process.argv[3])
if (!seasonYear || !week) {
  console.error('Usage: npx tsx scripts/nfl-edge/sync-market-lines.ts <seasonYear> <week>')
  process.exit(1)
}

async function main() {
  const result = await syncMarketLinesForWeek(seasonYear, week)

  if (result.status === 'no_games') {
    console.log(`No games found for ${seasonYear} week ${week} — run sync-schedule.ts first.`)
    return
  }
  if (result.status === 'no_lines') {
    console.log(
      'Neither SportsGameOdds nor TheRundown returned usable lines for this week (lines usually post a few days out from kickoff).'
    )
    return
  }

  console.log(`Inserted ${result.count} line snapshots for ${seasonYear} week ${week} (source: ${result.source}).`)
  for (const r of result.rows) {
    console.log(`  ${r.sportsbook}: game ${r.game_id} spread=${r.home_spread} total=${r.total} ml=${r.home_moneyline}/${r.away_moneyline}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
