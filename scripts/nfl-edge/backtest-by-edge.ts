// ============================================================================
// NFL Edge Board — backtest bucketed by edge size
//
// Direct answer to "what if I only bet the biggest-edge games?" — the
// closest honest historical proxy for "only bet Elite/top-ranked tiers."
// The live system's Elite/Strong/Lean tiers come from scoring.ts's
// confidence score, which folds in line-movement/RLM/QB-questionable/
// sandwich signals that don't exist historically at the same "as of
// kickoff" resolution historical-backtest-lib.ts's header explains — so
// this can't literally replay tier assignment against history. What it CAN
// do: bucket every graded historical ATS bet by |edge| (model's projected
// margin vs. the market's — the single biggest input to the live
// confidence score too, and highly correlated with it) and show whether
// win rate actually climbs in the buckets that would realistically score
// higher live. Every game with a market spread is graded — no threshold
// filter — so buckets are exhaustive and directly comparable to each
// other.
//
// UPDATED 2026-09-10: shares historical-backtest-lib.ts with backtest.ts
// (same schedule loader + projectHistoricalGame, now applying real
// historical rest/weather, not just power ratings + HFA) and can use
// either rating method — flat EWMA (`ratingMethod=flat`) or the new
// SOS-adjusted ratings (`ratingMethod=sos`, default) — for direct
// side-by-side comparison against the pre-SOS baseline.
//
// Usage: npx tsx scripts/nfl-edge/backtest-by-edge.ts <startSeason> <endSeason> [ratingMethod=sos|flat]
// ============================================================================
import { loadPerGameValues, ratingsAsOf, computeSosAdjustedRatings, blendRatings, mapTeam } from '../../src/lib/nfl-edge/power-rating-model'
import { loadHistoricalSchedule, projectHistoricalGame, gradeAts } from '../../src/lib/nfl-edge/historical-backtest-lib'

const startSeason = Number(process.argv[2])
const endSeason = Number(process.argv[3] ?? startSeason)
const ratingMethod = (process.argv[4] === 'sos' ? 'sos' : 'flat') as 'flat' | 'sos'
if (!startSeason) {
  console.error('Usage: npx tsx scripts/nfl-edge/backtest-by-edge.ts <startSeason> <endSeason> [ratingMethod=sos|flat]')
  process.exit(1)
}

const BUCKETS = [
  { label: '0-1 pts (weakest edge)', min: 0, max: 1 },
  { label: '1-2 pts', min: 1, max: 2 },
  { label: '2-3 pts', min: 2, max: 3 },
  { label: '3-4 pts', min: 3, max: 4 },
  { label: '4-5 pts', min: 4, max: 5 },
  { label: '5-7 pts', min: 5, max: 7 },
  { label: '7+ pts (biggest edge)', min: 7, max: Infinity },
]

type Result = 'win' | 'loss' | 'push'
interface Bet {
  edge: number
  result: Result
}

async function main() {
  console.log(`Loading real nflverse schedule/results for ${startSeason}-${endSeason}...`)
  const schedule = await loadHistoricalSchedule(startSeason, endSeason)
  console.log(`${schedule.length} regular-season games loaded. Rating method: ${ratingMethod}.\n`)

  const seasons = Array.from(new Set(schedule.map((g) => g.season))).sort()
  const allBets: Bet[] = []

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
    if (!priorPerGame) continue
    const priorRatings = computeRatings(priorPerGame)
    const currentPerGame = await getPerGame(season)

    const weeks = Array.from(new Set(schedule.filter((g) => g.season === season).map((g) => g.week))).sort((a, b) => a - b)
    for (const week of weeks) {
      const currentRatings = currentPerGame ? computeRatings(currentPerGame, week) : new Map()
      const ratings = blendRatings(priorRatings, currentRatings)

      for (const g of schedule.filter((x) => x.season === season && x.week === week)) {
        if (g.homeScore === null || g.awayScore === null || g.spreadLine === null) continue
        const home = ratings.get(mapTeam(g.homeTeam))
        const away = ratings.get(mapTeam(g.awayTeam))
        if (!home || !away) continue

        const proj = projectHistoricalGame(home, away, g)
        const vegasMarginHome = g.spreadLine
        const edge = proj.projMarginHome - vegasMarginHome
        const pickedHome = edge > 0

        allBets.push({
          edge: Math.abs(edge),
          result: gradeAts(g.homeScore, g.awayScore, g.spreadLine, pickedHome),
        })
      }
    }
  }

  console.log(`\nGraded ${allBets.length} total ATS bets (every game with a market spread — no edge filter).\n`)
  console.log('Edge bucket'.padEnd(24) + 'Bets'.padStart(7) + '  Record'.padEnd(16) + 'Win%'.padStart(8) + '  ROI'.padStart(9))
  console.log('-'.repeat(66))

  for (const b of BUCKETS) {
    const bucketBets = allBets.filter((x) => x.edge >= b.min && x.edge < b.max)
    const decided = bucketBets.filter((x) => x.result !== 'push')
    const wins = decided.filter((x) => x.result === 'win').length
    const losses = decided.filter((x) => x.result === 'loss').length
    const winRate = decided.length > 0 ? (wins / decided.length) * 100 : 0
    const units = wins * 0.909 - losses
    const roi = decided.length > 0 ? (units / decided.length) * 100 : 0
    console.log(
      b.label.padEnd(24) +
        String(bucketBets.length).padStart(7) +
        `  ${wins}-${losses}-${bucketBets.length - decided.length}`.padEnd(16) +
        `${winRate.toFixed(1)}%`.padStart(8) +
        `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`.padStart(9)
    )
  }
  console.log('-'.repeat(66))

  console.log(`\nCumulative "only bet edge >= X" view:`)
  for (const floor of [1.5, 2, 3, 4, 5, 7]) {
    const bets = allBets.filter((x) => x.edge >= floor)
    const decided = bets.filter((x) => x.result !== 'push')
    const wins = decided.filter((x) => x.result === 'win').length
    const losses = decided.filter((x) => x.result === 'loss').length
    const winRate = decided.length > 0 ? (wins / decided.length) * 100 : 0
    const units = wins * 0.909 - losses
    const roi = decided.length > 0 ? (units / decided.length) * 100 : 0
    console.log(`  edge >= ${floor}: ${bets.length} bets, ${wins}-${losses} (${winRate.toFixed(1)}%), ROI ${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
