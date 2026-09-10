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
//  - Source: nflverse's own `schedules/games` dataset
//    (github.com/nflverse/nflverse-data/releases/download/schedules/games.csv),
//    which carries REAL historical Vegas closing lines (spread_line,
//    total_line) AND real final scores for every past season. No paid
//    historical-odds subscription needed.
//  - For each game, the model's projected margin/total is computed with
//    the SAME power-rating methodology as the live system
//    (power-rating-model.ts's blendRatings, cut off at that game's own
//    week — so the rating never sees that week's or any later week's
//    plays; this is what makes the test genuinely out-of-sample, not the
//    classic train/test split a fitted regression needs, because nothing
//    here is fitted to this data — HFA, league average, and the EWMA span
//    are the same fixed, documented constants scoring.ts already uses in
//    production, not tuned against this backtest).
//  - HONEST LIMITATION, stated plainly: this backtest reproduces only the
//    power-rating + home-field-advantage core of scoring.ts's projection.
//    It does NOT apply injury points, weather penalties, rest/bye
//    adjustments, or the sandwich/key-number ATS bonuses, because none of
//    that data exists historically at the same "as of kickoff" resolution
//    the live system has today (we don't have Week 6 2019's injury report
//    on file, for instance). That means this UNDERSTATES how good the full
//    live scoring engine could be (it's missing real signals) — but it
//    directly tests the single biggest input to every pick: are the power
//    ratings, weighted against the real closing line, actually finding
//    an edge? A model that can't clear the bar on this simplified test
//    has no business being trusted on the full one.
//  - Grading follows the PDF's own worked example exactly: cover_margin =
//    (home_score - away_score) + spread_line; home covers if > 0, away if
//    < 0, push if == 0. 52.4% is break-even at standard -110 odds; >55%
//    out-of-sample is a red flag for leakage rather than a reason to
//    celebrate (both PDFs make this same point, and it's correct).
//
// PERFORMANCE, 2026-09-10: originally this called computeBlendedRatings()
// once per (season, week) — up to 18 times per season — and that function
// re-downloads BOTH the prior-season and current-season play-by-play files
// (multi-MB gzipped) from scratch on every call. Fine for the live nightly
// sync (one call a day); prohibitively slow and wasteful for a multi-season
// backtest. Rewritten to fetch each distinct season's file exactly ONCE via
// loadPerGameValues() (cached across the season loop, since season N's
// "current" file is season N+1's "prior" file) and slice it in memory per
// week via ratingsAsOf() + blendRatings() — a 2015-2024 backtest now
// downloads 11 season files total (2014-2024), not up to 180.
//
// Usage:  npx tsx scripts/nfl-edge/backtest.ts <startSeason> <endSeason> [edgeThreshold]
//   edgeThreshold defaults to 1.5 points — only bet when the model's
//   projected margin differs from the market by at least this much,
//   the same "don't bet every game" discipline both PDFs call out.
// ============================================================================
import { loadPerGameValues, ratingsAsOf, blendRatings, mapTeam } from '../../src/lib/nfl-edge/power-rating-model'

const startSeason = Number(process.argv[2])
const endSeason = Number(process.argv[3] ?? startSeason)
const edgeThreshold = Number(process.argv[4] ?? 1.5)

if (!startSeason) {
  console.error('Usage: npx tsx scripts/nfl-edge/backtest.ts <startSeason> <endSeason> [edgeThreshold]')
  process.exit(1)
}

// Same fixed constants scoring.ts uses in production (DEFAULT_SETTINGS) —
// not fitted to this backtest's data.
const LEAGUE_AVG = 22.5
const HFA = 1.5

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

interface HistGame {
  season: number
  week: number
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  spreadLine: number | null // nflverse closing spread, home perspective — see the sign-convention note below
  totalLine: number | null
}

async function loadSchedule(): Promise<HistGame[]> {
  const url = 'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch schedules: HTTP ${res.status}`)
  const text = await res.text()
  const lines = text.split('\n').filter((l) => l.length > 0)
  const header = splitCsvLine(lines[0])
  const idx = Object.fromEntries(header.map((c, i) => [c, i]))

  const games: HistGame[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    if (cols[idx.game_type] !== 'REG') continue
    const season = Number(cols[idx.season])
    if (season < startSeason || season > endSeason) continue
    const num = (s: string) => (s === '' || s === undefined ? null : Number(s))
    games.push({
      season,
      week: Number(cols[idx.week]),
      homeTeam: cols[idx.home_team],
      awayTeam: cols[idx.away_team],
      homeScore: num(cols[idx.home_score]),
      awayScore: num(cols[idx.away_score]),
      spreadLine: num(cols[idx.spread_line]),
      totalLine: num(cols[idx.total_line]),
    })
  }
  return games
}

interface BetResult {
  season: number
  week: number
  market: 'ats' | 'total'
  edge: number
  result: 'win' | 'loss' | 'push'
}

function gradeAts(homeScore: number, awayScore: number, spreadLine: number, pickedHome: boolean): 'win' | 'loss' | 'push' {
  const coverMargin = homeScore - awayScore + spreadLine
  if (coverMargin === 0) return 'push'
  const homeCovered = coverMargin > 0
  return homeCovered === pickedHome ? 'win' : 'loss'
}

function gradeTotal(homeScore: number, awayScore: number, totalLine: number, pickedOver: boolean): 'win' | 'loss' | 'push' {
  const actualTotal = homeScore + awayScore
  if (actualTotal === totalLine) return 'push'
  const wentOver = actualTotal > totalLine
  return wentOver === pickedOver ? 'win' : 'loss'
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
  const schedule = await loadSchedule()
  console.log(`${schedule.length} regular-season games loaded.`)

  const seasons = Array.from(new Set(schedule.map((g) => g.season))).sort()
  const atsResults: BetResult[] = []
  const totalResults: BetResult[] = []
  let skippedNoRating = 0
  let skippedNoLine = 0
  let skippedNoResult = 0

  // One play-by-play download per DISTINCT year needed (each season's prior
  // AND current), cached here so adjacent seasons in a multi-season run
  // reuse each other's file — season N's "current" fetch is season N+1's
  // "prior" fetch — instead of re-downloading it. A 2015-2024 backtest
  // downloads 2014 through 2024 (11 files) exactly once each, versus up to
  // 180 fetches (10 seasons x up to 18 weeks) under the old approach.
  const perGameCache = new Map<number, Awaited<ReturnType<typeof loadPerGameValues>>>()
  async function getPerGame(year: number) {
    if (!perGameCache.has(year)) {
      console.log(`  Fetching ${year} play-by-play (once)...`)
      perGameCache.set(year, await loadPerGameValues(year))
    }
    return perGameCache.get(year)!
  }

  for (const season of seasons) {
    const priorPerGame = await getPerGame(season - 1)
    if (!priorPerGame) {
      // No prior-season file at all (nflverse's pbp data starts in 1999) —
      // every game this season is unratable, same as the old behavior.
      skippedNoRating += schedule.filter((g) => g.season === season).length
      continue
    }
    // Full completed prior season, no maxWeek cut — computed once per
    // season, not once per week (it can't change week to week).
    const priorRatings = ratingsAsOf(priorPerGame)
    const currentPerGame = await getPerGame(season)

    const weeks = Array.from(new Set(schedule.filter((g) => g.season === season).map((g) => g.week))).sort((a, b) => a - b)
    for (const week of weeks) {
      // Cheap, in-memory: no network call happens here.
      const currentRatings = currentPerGame ? ratingsAsOf(currentPerGame, week) : new Map()
      const ratings = blendRatings(priorRatings, currentRatings)

      for (const g of schedule.filter((x) => x.season === season && x.week === week)) {
        if (g.homeScore === null || g.awayScore === null) {
          skippedNoResult++
          continue
        }
        // nflverse's schedules file uses the same raw team codes as its
        // play-by-play file (LA/WAS, not this schema's LAR/WSH) — map
        // through the same function power-rating-model.ts uses when
        // building the ratings map, or these two teams' games silently
        // fail to find a rating and get skipped entirely.
        const home = ratings.get(mapTeam(g.homeTeam))
        const away = ratings.get(mapTeam(g.awayTeam))
        if (!home || !away) {
          skippedNoRating++
          continue
        }

        const projHome = LEAGUE_AVG + home.off - away.def + HFA / 2
        const projAway = LEAGUE_AVG + away.off - home.def - HFA / 2
        const projMarginHome = projHome - projAway
        const projTotal = projHome + projAway

        if (g.spreadLine !== null) {
          // IMPORTANT, verified empirically against this same file's real
          // home_moneyline column (2026-09-10): nflverse's spread_line uses
          // the OPPOSITE sign convention from a live sportsbook feed's
          // "home_spread" (which scoring.ts/clv.ts correctly negate).
          // Here, POSITIVE spread_line means the HOME team is favored by
          // that many points (e.g. spread_line=12.5 lined up with a real
          // -800 home moneyline and a 38-point home win in the 2024 data) —
          // so vegasMarginHome is spreadLine directly, not its negation.
          // Getting this backwards was caught because it produced an
          // impossible ~80% out-of-sample ATS win rate on a first run: the
          // wrong sign was effectively adding the model's own read on team
          // quality to Vegas's (also correlated) read instead of comparing
          // them, so it was really just predicting the actual winner more
          // often, not finding real closing-line value.
          const vegasMarginHome = g.spreadLine
          const edge = projMarginHome - vegasMarginHome
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
          const totalEdge = projTotal - g.totalLine
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
  summarize(`ATS backtest (edge >= ${edgeThreshold} pts, ${startSeason}-${endSeason})`, atsResults)
  summarize(`Totals backtest (edge >= ${edgeThreshold} pts, ${startSeason}-${endSeason})`, totalResults)

  // Per-season breakdown so a single hot/cold year doesn't hide in the total.
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
