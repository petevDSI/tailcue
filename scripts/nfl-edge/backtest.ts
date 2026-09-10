// ============================================================================
// NFL Edge Board — historical backtest (real closing lines + real results)
//
// Answers the question every handicapping system eventually has to answer:
// does the model actually beat the closing line, out of sample, on real
// history? Both the original 20-keys document and the follow-up PDF Pete
// uploaded (2026-09-10) independently converge on the same approach — and
// so did this project's own earlier research — so this is that approach,
// built for real:
//
//  - Source: nflverse's own `schedules/games` dataset (see
//    historical-backtest-lib.ts), which carries REAL historical Vegas
//    closing lines (spread_line, total_line), REAL final scores, and (used
//    starting 2026-09-10) each team's real days-of-rest and the game's real
//    recorded temp/wind/roof for every past season. No paid historical-odds
//    subscription needed.
//  - For each game, the model's projected margin/total is computed with
//    the SAME power-rating methodology as the live system
//    (power-rating-model.ts), cut off at that game's own week — so the
//    rating never sees that week's or any later week's plays; this is what
//    makes the test genuinely out-of-sample, not the classic train/test
//    split a fitted regression needs, because nothing in the PROJECTION
//    here is fitted to this data — HFA, league average, rest/weather
//    tiers, and the EWMA span are the same fixed, documented constants
//    scoring.ts already uses in production, not tuned against this
//    backtest. (fit-ats-weights.ts, a separate script, DOES fit against
//    this same historical data — see that file for why that's a different,
//    clearly-labeled exercise from this one.)
//  - UPDATED 2026-09-10: two real changes.
//     1. Ratings can now be computed either the original way (flat EWMA
//        average per team, `ratingMethod=flat`) or SOS-adjusted (opponent
//        strength solved for jointly via computeSosAdjustedRatings,
//        `ratingMethod=sos`, now the default) — see power-rating-model.ts
//        for the method. Pass `flat` as the 5th CLI arg to compare against
//        the pre-SOS baseline directly.
//     2. The projection now applies REAL historical rest and weather
//        adjustments (home_rest/away_rest, temp/wind/roof — see
//        historical-backtest-lib.ts's projectHistoricalGame), narrowing
//        the previously-stated "no rest/weather" limitation. Injuries
//        still aren't applied — no historical injury-report feed exists at
//        the same as-of-kickoff resolution anywhere free — so this still
//        UNDERSTATES how good the full live engine could be, but it now
//        tests more of it than before.
//  - Grading follows the PDF's own worked example exactly: cover_margin =
//    (home_score - away_score) + spread_line; home covers if > 0, away if
//    < 0, push if == 0. 52.4% is break-even at standard -110 odds; >55%
//    out-of-sample is a red flag for leakage rather than a reason to
//    celebrate (both PDFs make this same point, and it's correct).
//
// PERFORMANCE: fetches each distinct season's play-by-play file exactly
// ONCE via loadPerGameValues() (cached across the season loop, since season
// N's "current" file is season N+1's "prior" file) and slices it in memory
// per week — a 2015-2024 backtest downloads 11 season files total
// (2014-2024), not up to 180.
//
// Usage:  npx tsx scripts/nfl-edge/backtest.ts <startSeason> <endSeason> [edgeThreshold] [ratingMethod=sos|flat]
//   edgeThreshold defaults to 1.5 points — only bet when the model's
//   projected margin differs from the market by at least this much,
//   the same "don't bet every game" discipline both PDFs call out.
// ============================================================================
import { loadPerGameValues, ratingsAsOf, computeSosAdjustedRatings, blendRatings, mapTeam } from '../../src/lib/nfl-edge/power-rating-model'
import { loadHistoricalSchedule, projectHistoricalGame, gradeAts, gradeTotal } from '../../src/lib/nfl-edge/historical-backtest-lib'

const startSeason = Number(process.argv[2])
const endSeason = Number(process.argv[3] ?? startSeason)
const edgeThreshold = Number(process.argv[4] ?? 1.5)
const ratingMethod = (process.argv[5] === 'sos' ? 'sos' : 'flat') as 'flat' | 'sos'

if (!startSeason) {
  console.error('Usage: npx tsx scripts/nfl-edge/backtest.ts <startSeason> <endSeason> [edgeThreshold] [ratingMethod=sos|flat]')
  process.exit(1)
}

interface BetResult {
  season: number
  week: number
  market: 'ats' | 'total'
  edge: number
  result: 'win' | 'loss' | 'push'
}

function summarize(label: string, bets: BetResult[]) {
  const decided = bets.filter((b) => b.result !== 'push')
  const wins = decided.filter((b) => b.result === 'win').length
  const losses = decided.filter((b) => b.result === 'loss').length
  const pushes = bets.length - decided.length
  const winRate = decided.length > 0 ? (wins / decided.length) * 100 : 0
  // -110 odds: win pays 0.909 units, loss costs 1 unit.
  const units = wins * 0.909 - losses
  const roi = decided.length > 0 ? (units / decided.length) * 100 : 0
  console.log(`\n${label}`)
  console.log(`  Bets placed: ${bets.length}  (${wins}-${losses}-${pushes})`)
  console.log(`  Win rate (excl. pushes): ${winRate.toFixed(1)}%  ${winRate >= 55 ? '⚠️  >55% out-of-sample — check for leakage before trusting this' : winRate >= 52.4 ? '(above the 52.4% -110 break-even line)' : '(below the 52.4% -110 break-even line)'}`)
  console.log(`  Units won: ${units >= 0 ? '+' : ''}${units.toFixed(2)}  ROI: ${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`)
}

async function main() {
  console.log(`Loading real nflverse schedule/results for ${startSeason}-${endSeason}...`)
  const schedule = await loadHistoricalSchedule(startSeason, endSeason)
  console.log(`${schedule.length} regular-season games loaded. Rating method: ${ratingMethod}.`)

  const seasons = Array.from(new Set(schedule.map((g) => g.season))).sort()
  const atsResults: BetResult[] = []
  const totalResults: BetResult[] = []
  let skippedNoRating = 0
  let skippedNoLine = 0
  let skippedNoResult = 0

  const perGameCache = new Map<number, Awaited<ReturnType<typeof loadPerGameValues>>>()
  async function getPerGame(year: number) {
    if (!perGameCache.has(year)) {
      console.log(`  Fetching ${year} play-by-play (once)...`)
      perGameCache.set(year, await loadPerGameValues(year))
    }
    return perGameCache.get(year)!
  }

  function computeRatings(perGame: NonNullable<Awaited<ReturnType<typeof loadPerGameValues>>>, maxWeek?: number) {
    return ratingMethod === 'sos' ? computeSosAdjustedRatings(perGame, maxWeek) : ratingsAsOf(perGame, maxWeek)
  }

  for (const season of seasons) {
    const priorPerGame = await getPerGame(season - 1)
    if (!priorPerGame) {
      skippedNoRating += schedule.filter((g) => g.season === season).length
      continue
    }
    const priorRatings = computeRatings(priorPerGame)
    const currentPerGame = await getPerGame(season)

    const weeks = Array.from(new Set(schedule.filter((g) => g.season === season).map((g) => g.week))).sort((a, b) => a - b)
    for (const week of weeks) {
      const currentRatings = currentPerGame ? computeRatings(currentPerGame, week) : new Map()
      const ratings = blendRatings(priorRatings, currentRatings)

      for (const g of schedule.filter((x) => x.season === season && x.week === week)) {
        if (g.homeScore === null || g.awayScore === null) {
          skippedNoResult++
          continue
        }
        const home = ratings.get(mapTeam(g.homeTeam))
        const away = ratings.get(mapTeam(g.awayTeam))
        if (!home || !away) {
          skippedNoRating++
          continue
        }

        const proj = projectHistoricalGame(home, away, g)

        if (g.spreadLine !== null) {
          // nflverse's spread_line: positive = home favored — see
          // historical-backtest-lib.ts's HistGame doc comment.
          const vegasMarginHome = g.spreadLine
          const edge = proj.projMarginHome - vegasMarginHome
          if (Math.abs(edge) >= edgeThreshold) {
            const pickedHome = edge > 0
            atsResults.push({
              season,
              week,
              market: 'ats',
              edge,
              result: gradeAts(g.homeScore, g.awayScore, g.spreadLine, pickedHome),
            })
          }
        } else {
          skippedNoLine++
        }

        if (g.totalLine !== null) {
          const totalEdge = proj.projTotal - g.totalLine
          if (Math.abs(totalEdge) >= edgeThreshold) {
            const pickedOver = totalEdge > 0
            totalResults.push({
              season,
              week,
              market: 'total',
              edge: totalEdge,
              result: gradeTotal(g.homeScore, g.awayScore, g.totalLine, pickedOver),
            })
          }
        }
      }
    }
  }

  console.log(`\nSkipped: ${skippedNoResult} not-yet-played, ${skippedNoRating} missing a rating (pre-1999 or data gap), ${skippedNoLine} missing a market line.`)
  summarize(`ATS backtest (edge >= ${edgeThreshold} pts, ${startSeason}-${endSeason}, rating=${ratingMethod})`, atsResults)
  summarize(`Totals backtest (edge >= ${edgeThreshold} pts, ${startSeason}-${endSeason}, rating=${ratingMethod})`, totalResults)

  console.log(`\nPer-season ATS breakdown:`)
  for (const season of seasons) {
    const seasonBets = atsResults.filter((b) => b.season === season)
    const decided = seasonBets.filter((b) => b.result !== 'push')
    const wins = decided.filter((b) => b.result === 'win').length
    const rate = decided.length > 0 ? (wins / decided.length) * 100 : 0
    console.log(`  ${season}: ${seasonBets.length} bets, ${wins}-${decided.length - wins} (${rate.toFixed(1)}%)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
