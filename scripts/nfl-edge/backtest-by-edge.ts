// ============================================================================
// NFL Edge Board — backtest bucketed by edge size
//
// Direct answer to "what if I only bet the biggest-edge games?" — the
// closest honest historical proxy for "only bet Elite/top-ranked tiers."
// The live system's Elite/Strong/Lean tiers come from scoring.ts's
// confidence score, which folds in injury/weather/rest/sandwich/key-number
// signals that don't exist historically at the same "as of kickoff"
// resolution backtest.ts's header explains — so this can't literally replay
// tier assignment against history. What it CAN do: bucket every graded
// historical ATS bet by |edge| (model's projected margin vs. the market's —
// the single biggest input to the live confidence score too, and highly
// correlated with it) and show whether win rate actually climbs in the
// buckets that would realistically score higher live. Every game with a
// market spread is graded — no threshold filter — so buckets are exhaustive
// and directly comparable to each other.
//
// Usage: npx tsx scripts/nfl-edge/backtest-by-edge.ts <startSeason> <endSeason>
// ============================================================================
import { loadPerGameValues, ratingsAsOf, blendRatings, mapTeam } from '../../src/lib/nfl-edge/power-rating-model'

const startSeason = Number(process.argv[2])
const endSeason = Number(process.argv[3] ?? startSeason)
if (!startSeason) {
  console.error('Usage: npx tsx scripts/nfl-edge/backtest-by-edge.ts <startSeason> <endSeason>')
  process.exit(1)
}

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
  spreadLine: number | null
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
    })
  }
  return games
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

function gradeAts(homeScore: number, awayScore: number, spreadLine: number, pickedHome: boolean): Result {
  const coverMargin = homeScore - awayScore + spreadLine
  if (coverMargin === 0) return 'push'
  const homeCovered = coverMargin > 0
  return homeCovered === pickedHome ? 'win' : 'loss'
}

async function main() {
  console.log(`Loading real nflverse schedule/results for ${startSeason}-${endSeason}...`)
  const schedule = await loadSchedule()
  console.log(`${schedule.length} regular-season games loaded.\n`)

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

        const projHome = LEAGUE_AVG + home.off - away.def + HFA / 2
        const projAway = LEAGUE_AVG + away.off - home.def - HFA / 2
        const projMarginHome = projHome - projAway
        const vegasMarginHome = g.spreadLine // nflverse sign convention — see backtest.ts
        const edge = projMarginHome - vegasMarginHome
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

  let cumWins = 0
  let cumLosses = 0
  for (const b of BUCKETS) {
    const bucketBets = allBets.filter((x) => x.edge >= b.min && x.edge < b.max)
    const decided = bucketBets.filter((x) => x.result !== 'push')
    const wins = decided.filter((x) => x.result === 'win').length
    const losses = decided.filter((x) => x.result === 'loss').length
    const winRate = decided.length > 0 ? (wins / decided.length) * 100 : 0
    const units = wins * 0.909 - losses
    const roi = decided.length > 0 ? (units / decided.length) * 100 : 0
    cumWins += wins
    cumLosses += losses
    console.log(
      b.label.padEnd(24) +
        String(bucketBets.length).padStart(7) +
        `  ${wins}-${losses}-${bucketBets.length - decided.length}`.padEnd(16) +
        `${winRate.toFixed(1)}%`.padStart(8) +
        `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`.padStart(9)
    )
  }
  console.log('-'.repeat(66))

  // Cumulative "bet only edge >= X" view — this is the direct answer to
  // "what if I'd only bet the top-ranked games": each row is everything
  // AT OR ABOVE that edge floor, not just that one bucket.
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
