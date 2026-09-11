// ============================================================================
// NFL Edge Board — injury report sync (ESPN, free/keyless) — CLI wrapper
//
// The real logic lives in src/lib/nfl-edge/injuries-sync.ts so it can also
// be called from the sync-injuries cron route
// (src/app/api/admin/nfl-edge/cron/sync-injuries) — this script is now a
// thin manual-trigger wrapper around that, kept around for ad hoc runs.
//
// Usage:  npx tsx scripts/nfl-edge/sync-injuries.ts <seasonYear> <week>
// ============================================================================
import { config } from 'dotenv'
config({ path: '.env.local' }) // scripts run outside Next.js, which is what normally loads .env.local
import { syncInjuriesForWeek } from '../../src/lib/nfl-edge/injuries-sync'

const seasonYear = Number(process.argv[2])
const week = Number(process.argv[3])

if (!seasonYear || !week) {
  console.error('Usage: npx tsx scripts/nfl-edge/sync-injuries.ts <seasonYear> <week>')
  process.exit(1)
}

async function main() {
  console.log('Fetching league-wide injury report from ESPN...')
  const result = await syncInjuriesForWeek(seasonYear, week)
  if (result.status === 'no_games') {
    console.log(`No games found for ${seasonYear} week ${week} — run sync-schedule.ts first.`)
    return
  }
  for (const [teamId, count] of Object.entries(result.byTeam)) {
    console.log(`${teamId}: ${count} injury report entries`)
  }
  console.log(`Done. ${result.totalRows} injury rows written for week ${week}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
