// ============================================================================
// NFL Edge Board — fit ATS confidence-score weights against real history
//
// The mathematician/statistician's critique of scoring.ts's ATS confidence
// score (recorded in the project roadmap doc, 2026-09-10 addendum): the
// formula `50 + min(|edge|,6)*6 + ... + keyNumberBonus - divisionalPenalty`
// uses hand-picked constants, not weights fit to real outcomes. Three of
// the score's inputs CAN be reconstructed at "as of kickoff" resolution for
// every historical game (edge size, divisional flag, key-number flag) —
// line movement, reverse-line-movement, and QB-questionable CANNOT (no
// historical opening-line, public-betting-%, or injury-designation feed
// exists anywhere free), so those three stay exactly as documented,
// hand-set constants; only edge/divisional/key-number are replaced here.
//
// Method: logistic regression (plain gradient descent, no new npm
// dependency — this project's own style, same as power-rating-model.ts's
// hand-rolled CSV parser) on standardized features, target = did the
// picked side actually cover. Two honesty guards, both important:
//  1. TRAIN/TEST SPLIT on the fit itself (2015-2021 train, 2022-2024 test)
//     — the same "don't trust a number that only looks good on the data it
//     was tuned against" discipline backtest.ts already applies to the
//     power ratings themselves, now applied to the score-weight fit too.
//     Only after checking the fit generalizes to the untouched 2022-2024
//     games is a FINAL model refit on the full 2015-2024 set for
//     deployment (standard practice: validate the method out-of-sample,
//     then use all available data for the deployed version).
//  2. Uses the LIVE-DEFAULT 'flat' power ratings (see
//     power-rating-model.ts's computeBlendedRatings doc — SOS-adjusted
//     ratings were tested and NOT adopted as the default), so the fitted
//     weights are calibrated against what the live system actually
//     computes, not a rating method that isn't running in production.
//
// Usage: npx tsx scripts/nfl-edge/fit-ats-weights.ts
// ============================================================================
import { loadPerGameValues, ratingsAsOf, blendRatings, mapTeam } from '../../src/lib/nfl-edge/power-rating-model'
import { loadHistoricalSchedule, projectHistoricalGame, gradeAts, keyNumberBonusFlag } from '../../src/lib/nfl-edge/historical-backtest-lib'

const TRAIN_START = 2015
const TRAIN_END = 2021
const TEST_START = 2022
const TEST_END = 2024
const EDGE_CAP = 6 // same cap the old hand-tuned formula used

interface Sample {
  season: number
  edgeAbsCapped: number
  divisional: number
  keyNumber: number
  y: number // 1 = picked side covered, 0 = lost (pushes excluded)
}

async function buildSamples(startSeason: number, endSeason: number): Promise<Sample[]> {
  const schedule = await loadHistoricalSchedule(startSeason, endSeason)
  const seasons = Array.from(new Set(schedule.map((g) => g.season))).sort()

  const perGameCache = new Map<number, Awaited<ReturnType<typeof loadPerGameValues>>>()
  async function getPerGame(year: number) {
    if (!perGameCache.has(year)) {
      console.log(`  Fetching ${year} play-by-play (once)...`)
      perGameCache.set(year, await loadPerGameValues(year))
    }
    return perGameCache.get(year)!
  }

  const samples: Sample[] = []
  for (const season of seasons) {
    const priorPerGame = await getPerGame(season - 1)
    if (!priorPerGame) continue
    const priorRatings = ratingsAsOf(priorPerGame)
    const currentPerGame = await getPerGame(season)

    const weeks = Array.from(new Set(schedule.filter((g) => g.season === season).map((g) => g.week))).sort((a, b) => a - b)
    for (const week of weeks) {
      const currentRatings = currentPerGame ? ratingsAsOf(currentPerGame, week) : new Map()
      const ratings = blendRatings(priorRatings, currentRatings)

      for (const g of schedule.filter((x) => x.season === season && x.week === week)) {
        if (g.homeScore === null || g.awayScore === null || g.spreadLine === null) continue
        const home = ratings.get(mapTeam(g.homeTeam))
        const away = ratings.get(mapTeam(g.awayTeam))
        if (!home || !away) continue

        const proj = projectHistoricalGame(home, away, g)
        const edge = proj.projMarginHome - g.spreadLine
        const pickedHome = edge > 0
        const result = gradeAts(g.homeScore, g.awayScore, g.spreadLine, pickedHome)
        if (result === 'push') continue

        samples.push({
          season,
          edgeAbsCapped: Math.min(Math.abs(edge), EDGE_CAP),
          divisional: g.divGame ? 1 : 0,
          keyNumber: keyNumberBonusFlag(g.spreadLine, pickedHome) ? 1 : 0,
          y: result === 'win' ? 1 : 0,
        })
      }
    }
  }
  return samples
}

// ---- plain logistic regression, batch gradient descent ----
interface FitResult {
  interceptRaw: number
  edgeCoefRaw: number
  divisionalCoefRaw: number
  keyNumberCoefRaw: number
}

function fitLogistic(samples: Sample[], iterations = 4000, lr = 0.3, l2 = 1e-3): FitResult {
  const n = samples.length
  const edges = samples.map((s) => s.edgeAbsCapped)
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const std = (xs: number[], m: number) => Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1

  const edgeMean = mean(edges)
  const edgeStd = std(edges, edgeMean)
  const divMean = mean(samples.map((s) => s.divisional))
  const divStd = std(samples.map((s) => s.divisional), divMean)
  const keyMean = mean(samples.map((s) => s.keyNumber))
  const keyStd = std(samples.map((s) => s.keyNumber), keyMean)

  const X = samples.map((s) => [
    (s.edgeAbsCapped - edgeMean) / edgeStd,
    (s.divisional - divMean) / divStd,
    (s.keyNumber - keyMean) / keyStd,
  ])
  const y = samples.map((s) => s.y)

  const w = [0, 0, 0] // standardized-space coefficients
  let b = 0

  for (let iter = 0; iter < iterations; iter++) {
    const gradW = [0, 0, 0]
    let gradB = 0
    for (let i = 0; i < n; i++) {
      const z = b + w[0] * X[i][0] + w[1] * X[i][1] + w[2] * X[i][2]
      const p = 1 / (1 + Math.exp(-z))
      const err = p - y[i]
      gradB += err
      gradW[0] += err * X[i][0]
      gradW[1] += err * X[i][1]
      gradW[2] += err * X[i][2]
    }
    gradB /= n
    for (let k = 0; k < 3; k++) gradW[k] = gradW[k] / n + l2 * w[k]
    b -= lr * gradB
    for (let k = 0; k < 3; k++) w[k] -= lr * gradW[k]
  }

  // Convert standardized-space coefficients back to raw-feature-space.
  const edgeCoefRaw = w[0] / edgeStd
  const divisionalCoefRaw = w[1] / divStd
  const keyNumberCoefRaw = w[2] / keyStd
  const interceptRaw = b - (w[0] * edgeMean) / edgeStd - (w[1] * divMean) / divStd - (w[2] * keyMean) / keyStd

  return { interceptRaw, edgeCoefRaw, divisionalCoefRaw, keyNumberCoefRaw }
}

function predictProb(fit: FitResult, s: { edgeAbsCapped: number; divisional: number; keyNumber: number }): number {
  const z =
    fit.interceptRaw +
    fit.edgeCoefRaw * s.edgeAbsCapped +
    fit.divisionalCoefRaw * s.divisional +
    fit.keyNumberCoefRaw * s.keyNumber
  return 1 / (1 + Math.exp(-z))
}

function evaluate(fit: FitResult, samples: Sample[], label: string) {
  let logLoss = 0
  let brier = 0
  for (const s of samples) {
    const p = Math.min(Math.max(predictProb(fit, s), 1e-6), 1 - 1e-6)
    logLoss += -(s.y * Math.log(p) + (1 - s.y) * Math.log(1 - p))
    brier += (p - s.y) ** 2
  }
  logLoss /= samples.length
  brier /= samples.length

  console.log(`\n${label} (n=${samples.length})`)
  console.log(`  Log loss: ${logLoss.toFixed(4)}   Brier score: ${brier.toFixed(4)}  (lower is better for both)`)

  // Reliability: bucket by predicted probability decile, compare to actual win rate.
  const withPred = samples.map((s) => ({ p: predictProb(fit, s), y: s.y })).sort((a, b) => a.p - b.p)
  const buckets = 5
  const size = Math.ceil(withPred.length / buckets)
  console.log(`  Calibration (${buckets} buckets by predicted P(cover)):`)
  for (let bIdx = 0; bIdx < buckets; bIdx++) {
    const chunk = withPred.slice(bIdx * size, (bIdx + 1) * size)
    if (chunk.length === 0) continue
    const avgPred = mean(chunk.map((c) => c.p))
    const actual = mean(chunk.map((c) => c.y))
    console.log(`    predicted ~${(avgPred * 100).toFixed(1)}%  →  actual ${(actual * 100).toFixed(1)}%  (n=${chunk.length})`)
  }

  function mean(xs: number[]) {
    return xs.reduce((a, b) => a + b, 0) / xs.length
  }
}

// Baseline for comparison: the OLD hand-tuned formula's edge/divisional/
// key-number sub-score (before the 50-baseline/other terms), converted to
// an implied probability the same way, so "did the fit actually help" is a
// fair like-for-like comparison, not a comparison against nothing.
function oldFormulaImpliedProb(s: { edgeAbsCapped: number; divisional: number; keyNumber: number }): number {
  const oldSubscore = 50 + s.edgeAbsCapped * 6 + (s.keyNumber ? 2 : 0) - (s.divisional ? 3 : 0)
  return Math.min(Math.max(oldSubscore / 100, 1e-6), 1 - 1e-6)
}

function evaluateOldFormula(samples: Sample[], label: string) {
  let logLoss = 0
  let brier = 0
  for (const s of samples) {
    const p = oldFormulaImpliedProb(s)
    logLoss += -(s.y * Math.log(p) + (1 - s.y) * Math.log(1 - p))
    brier += (p - s.y) ** 2
  }
  logLoss /= samples.length
  brier /= samples.length
  console.log(`\n${label} — OLD hand-tuned formula, same 3 features (n=${samples.length})`)
  console.log(`  Log loss: ${logLoss.toFixed(4)}   Brier score: ${brier.toFixed(4)}`)
}

async function main() {
  console.log(`Building TRAIN samples (${TRAIN_START}-${TRAIN_END})...`)
  const trainSamples = await buildSamples(TRAIN_START, TRAIN_END)
  console.log(`Building TEST samples (${TEST_START}-${TEST_END})...`)
  const testSamples = await buildSamples(TEST_START, TEST_END)

  console.log(`\nTrain samples: ${trainSamples.length}, test samples: ${testSamples.length}`)

  const trainFit = fitLogistic(trainSamples)
  console.log(`\nFitted on TRAIN (${TRAIN_START}-${TRAIN_END}):`)
  console.log(`  intercept=${trainFit.interceptRaw.toFixed(4)}  edgeCoef=${trainFit.edgeCoefRaw.toFixed(4)}  divisionalCoef=${trainFit.divisionalCoefRaw.toFixed(4)}  keyNumberCoef=${trainFit.keyNumberCoefRaw.toFixed(4)}`)

  evaluate(trainFit, trainSamples, `TRAIN self-evaluation`)
  evaluate(trainFit, testSamples, `HOLDOUT evaluation (train-fit weights on untouched ${TEST_START}-${TEST_END} data)`)
  evaluateOldFormula(testSamples, `HOLDOUT`)

  console.log(`\n${'='.repeat(70)}`)
  console.log(`If the holdout numbers above look reasonable (fitted log-loss/Brier`)
  console.log(`at or below the old formula's, and calibration buckets roughly`)
  console.log(`monotonic), refitting on the FULL ${TRAIN_START}-${TEST_END} set for deployment:`)
  console.log('='.repeat(70))

  const allSamples = [...trainSamples, ...testSamples]
  const fullFit = fitLogistic(allSamples)
  console.log(`\nFinal fit on FULL ${TRAIN_START}-${TEST_END} (n=${allSamples.length}):`)
  console.log(`  intercept=${fullFit.interceptRaw.toFixed(4)}  edgeCoef=${fullFit.edgeCoefRaw.toFixed(4)}  divisionalCoef=${fullFit.divisionalCoefRaw.toFixed(4)}  keyNumberCoef=${fullFit.keyNumberCoefRaw.toFixed(4)}`)
  evaluate(fullFit, allSamples, `FULL-SAMPLE self-evaluation (for reference only — not out-of-sample)`)

  console.log(`\nCopy these FULL-sample coefficients into fitted-ats-weights.ts:`)
  console.log(JSON.stringify({ ...fullFit, edgeCap: EDGE_CAP, trainRange: `${TRAIN_START}-${TEST_END}`, sampleSize: allSamples.length }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
