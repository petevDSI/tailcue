// ============================================================================
// NFL Edge Board — schedule sync CLI
//
// The actual sync logic lives in src/lib/nfl-edge/schedule-sync.ts
// (extracted 2026-09-10 so the admin week page's manual "Sync scores"
// button and the sync-scores cron can call the exact same code this
// script does). This file just parses argv, calls it, and logs the same
// per-week output the original all-in-one script printed. Re-runnable
// any time — every row is upserted on espn_event_id, so scores/status
// flip from 'scheduled' to 'in_progress' to 'final' as the season plays
// out without touching anything else.
//
// Usage:  npx tsx scripts/nfl-edge/sync-schedule.ts [seasonYear]
// ============================================================================
import { config } from 'dotenv'
config({ path: '.env.local' }) // scripts run outside Next.js, which is what normally loads .env.local
import { syncScheduleSeason } from '../../src/lib/nfl-edge/schedule-sync'

const seasonYear = Number(process.argv[2] ?? new Date().getFullYear())

async function main() {
  const results = await syncScheduleSeason(seasonYear)
  let total = 0
  for (const r of results) {
    if (r.skipped === 'no_events') {
      console.log(`Week ${r.week}: no events returned (season may not be scheduled yet).`)
      continue
    }
    total += r.upserted
    console.log(`Week ${r.week}: upserted ${r.upserted} games`)
  }
  console.log(`Done. ${total} games upserted for ${seasonYear}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
