// ============================================================================
// NFL Edge Board — weekly recommendation generator (CLI)
//
// Thin wrapper around src/lib/nfl-edge/generate.ts, which is the same code
// the dashboard's "Recompute" button calls. See that file for the full
// explanation of what this does and its known gaps (no power ratings yet).
//
// Usage:  npx tsx scripts/nfl-edge/generate-recommendations.ts <seasonYear> <week>
// ============================================================================
import 'dotenv/config'
import { generateRecommendationsForWeek } from '../../src/lib/nfl-edge/generate'

const seasonYear = Number(process.argv[2])
const week = Number(process.argv[3])
if (!seasonYear || !week) {
  console.error('Usage: npx tsx scripts/nfl-edge/generate-recommendations.ts <seasonYear> <week>')
  process.exit(1)
}

generateRecommendationsForWeek(seasonYear, week)
  .then((result) => {
    if (result.gameCount === 0) {
      console.log(`No games for ${seasonYear} week ${week} — run sync-schedule.ts first.`)
      return
    }
    console.log(
      `${result.recommendationCount} qualifying plays (Lean or better) across ${result.gameCount} games. ` +
        `Wrote to bet_recommendations for week ${week}.`
    )
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
