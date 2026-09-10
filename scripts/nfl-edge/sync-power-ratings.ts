// ============================================================================
// NFL Edge Board — power ratings sync (nflverse play-by-play, real & free)
//
// Fills nfl_edge.team_ratings, the one gap flagged since this project's first
// build ("every team defaults to 0/0 until a real EPA feed is wired in").
//
// The actual EPA/EWMA/prior-blend computation lives in
// src/lib/nfl-edge/power-rating-model.ts (extracted 2026-09-10 so the live
// sync here and the historical backtest in backtest.ts share one
// implementation instead of two that can drift apart) — see that file's
// header comment for the full methodology writeup (garbage-time filtering,
// EWMA recency weighting, the preseason-to-in-season blend, the LA/WAS vs
// LAR/WSH team-id mapping gotcha). This file is just: call it, write the
// result to Supabase, log a summary.
//
// Usage:  npx tsx scripts/nfl-edge/sync-power-ratings.ts <seasonYear> <asOfWeek>
// ============================================================================
import { config } from 'dotenv'
config({ path: '.env.local' }) // scripts run outside Next.js, which is what normally loads .env.local
import { nflEdgeDb } from '../../src/lib/nfl-edge/supabase-admin'
import { computeBlendedRatings } from '../../src/lib/nfl-edge/power-rating-model'

const seasonYear = Number(process.argv[2])
const asOfWeek = Number(process.argv[3])
// Defaults to 'flat' (the original, validated method) — see
// computeBlendedRatings's header comment in power-rating-model.ts for why
// the SOS-adjusted alternative isn't the default yet (tested against the
// real backtest 2026-09-10, mixed/negative full-sample result). Pass 'sos'
// here only for deliberate live experimentation.
const ratingMethod = (process.argv[4] === 'sos' ? 'sos' : 'flat') as 'flat' | 'sos'
if (!seasonYear || !asOfWeek) {
  console.error('Usage: npx tsx scripts/nfl-edge/sync-power-ratings.ts <seasonYear> <asOfWeek> [ratingMethod=flat|sos]')
  process.exit(1)
}

async function main() {
  console.log(`Computing ${seasonYear} ratings as of week ${asOfWeek} (prior season: ${seasonYear - 1}, method: ${ratingMethod})...`)
  const ratings = await computeBlendedRatings(seasonYear, asOfWeek, ratingMethod)
  if (!ratings) {
    console.error(`No play-by-play file found for ${seasonYear - 1} — can't build a prior. Aborting.`)
    process.exit(1)
  }

  const rows = Array.from(ratings.entries()).map(([teamId, r]) => ({
    team_id: teamId,
    season_year: seasonYear,
    as_of_week: asOfWeek,
    off_rating: Number(r.off.toFixed(3)),
    def_rating: Number(r.def.toFixed(3)),
    source: r.source,
    computed_at: new Date().toISOString(),
  }))

  const db = nflEdgeDb()
  // Idempotent re-run: no unique constraint to upsert against, so clear this
  // exact (season, as_of_week) snapshot first, same pattern as sync-injuries.ts.
  await db.from('team_ratings').delete().eq('season_year', seasonYear).eq('as_of_week', asOfWeek)
  const { error } = await db.from('team_ratings').insert(rows)
  if (error) throw error

  console.log(`Wrote ${rows.length} team ratings for ${seasonYear}, as of week ${asOfWeek}.`)
  const sorted = rows.slice().sort((a, b) => b.off_rating + b.def_rating - (a.off_rating + a.def_rating))
  for (const r of sorted) {
    console.log(`  ${r.team_id.padEnd(4)} off ${r.off_rating >= 0 ? '+' : ''}${r.off_rating.toFixed(1)}  def ${r.def_rating >= 0 ? '+' : ''}${r.def_rating.toFixed(1)}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
