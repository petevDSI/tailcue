// ============================================================================
// NFL Edge Board — shared historical-backtest data loading + projection
//
// Extracted 2026-09-10 (SOS-adjustment / data-fit pass) from backtest.ts and
// backtest-by-edge.ts, for the same reason power-rating-model.ts itself was
// extracted: backtest.ts, backtest-by-edge.ts, and the new
// fit-ats-weights.ts all need the EXACT same historical schedule parsing and
// "what would the live model have projected" math. Three independent copies
// is exactly how the spread_line sign-convention bug documented in
// backtest.ts's header almost shipped twice — one shared implementation
// instead.
//
// This also narrows (does not fully close) backtest.ts's own stated honest
// limitation: it previously reproduced ONLY the power-rating + HFA core of
// scoring.ts's live projection, explicitly not applying rest or weather
// adjustments because "none of that data exists historically at the same
// as-of-kickoff resolution." That's still true for injuries (no historical
// injury-report feed exists anywhere free) — but nflverse's own
// schedules/games.csv, the exact file this backtest already loads for
// closing lines and final scores, ALSO carries each team's real
// days-of-rest (home_rest/away_rest) and that game's real recorded
// temperature/wind/roof. There's no reason not to use data already sitting
// in the file being parsed, so rest and weather are applied here too, using
// the identical thresholds/formula scoring.ts uses live (REST_IMPACT, the
// wind/temp tiers) — real signals, not fabricated ones. Divisional-game
// status (div_game) is carried through as well, since fit-ats-weights.ts
// needs it as a fit feature.
// ============================================================================
import { REST_IMPACT, type RestCode } from './scoring'

export const LEAGUE_AVG = 22.5
export const HFA = 1.5

export function splitCsvLine(line: string): string[] {
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

export interface HistGame {
  season: number
  week: number
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  /** nflverse convention: POSITIVE means the home team is favored by that many points — the opposite sign from a live sportsbook feed's home_spread. See backtest.ts's original header note; verified against real home_moneyline/margin data. */
  spreadLine: number | null
  totalLine: number | null
  divGame: boolean
  homeRestDays: number | null
  awayRestDays: number | null
  roof: string | null
  tempF: number | null
  windMph: number | null
}

export async function loadHistoricalSchedule(startSeason: number, endSeason: number): Promise<HistGame[]> {
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
      divGame: cols[idx.div_game] === '1',
      homeRestDays: num(cols[idx.home_rest]),
      awayRestDays: num(cols[idx.away_rest]),
      roof: cols[idx.roof] || null,
      tempF: num(cols[idx.temp]),
      windMph: num(cols[idx.wind]),
    })
  }
  return games
}

/** Maps nflverse's real recorded rest-days number onto the same short/bye/normal buckets scoring.ts's deriveRestCode uses live, so the historical projection applies the identical REST_IMPACT points. */
export function restCodeFromDays(days: number | null): RestCode {
  if (days === null) return 'normal'
  if (days <= 4.5) return 'short'
  if (days >= 12) return 'bye'
  return 'normal'
}

export interface HistProjection {
  projHome: number
  projAway: number
  projMarginHome: number
  projTotal: number
  weatherPenalty: number
}

/**
 * The historical replay of scoring.ts's projection math — power ratings +
 * HFA + rest + weather — MINUS injuries, which have no historical per-game
 * feed at "as of kickoff" resolution anywhere free. `roof` values of 'dome'
 * or 'closed' are both treated as indoor (matching how the live isDome flag
 * suppresses wind/temp penalties), so a dome game never gets a weather
 * penalty even on a day nflverse happens to record an outdoor-equivalent
 * temp/wind reading for the metro area.
 */
export function projectHistoricalGame(
  home: { off: number; def: number },
  away: { off: number; def: number },
  g: HistGame
): HistProjection {
  const homeRestAdj = REST_IMPACT[restCodeFromDays(g.homeRestDays)]
  const awayRestAdj = REST_IMPACT[restCodeFromDays(g.awayRestDays)]

  const isDome = g.roof === 'dome' || g.roof === 'closed'
  let windPenalty = 0
  if (!isDome && g.windMph !== null) {
    if (g.windMph >= 20) windPenalty = 1.5
    else if (g.windMph >= 15) windPenalty = 0.8
    else if (g.windMph >= 10) windPenalty = 0.3
  }
  let tempPenalty = 0
  if (!isDome && g.tempF !== null) {
    if (g.tempF < 20) tempPenalty = 1.0
    else if (g.tempF < 32) tempPenalty = 0.5
  }
  const weatherPenalty = windPenalty + tempPenalty

  const projHome = LEAGUE_AVG + home.off - away.def + HFA / 2 + homeRestAdj - weatherPenalty / 2
  const projAway = LEAGUE_AVG + away.off - home.def - HFA / 2 + awayRestAdj - weatherPenalty / 2

  return {
    projHome,
    projAway,
    projMarginHome: projHome - projAway,
    projTotal: projHome + projAway,
    weatherPenalty,
  }
}

/** Same KEY_NUMBERS list and "buying the key number" logic as scoring.ts's ATS score, standalone here so fit-ats-weights.ts can use it as a fit feature without reaching into scoring.ts internals. Takes the spread in nflverse's historical convention (positive = home favored) and converts internally. */
export const KEY_NUMBERS = [3, 7, 6, 10, 4, 14, 2, 1]
export function keyNumberBonusFlag(spreadLineHistorical: number, pickedHome: boolean): boolean {
  // Convert nflverse's home-favored-positive convention to "points the
  // picked side is getting (+) or laying (-)", same semantics as
  // scoring.ts's sideSpread.
  const sideSpread = pickedHome ? -spreadLineHistorical : spreadLineHistorical
  for (const k of KEY_NUMBERS) {
    if (sideSpread > 0 && sideSpread >= k + 0.25 && sideSpread <= k + 0.75) return true
    if (sideSpread < 0 && -sideSpread >= k - 0.75 && -sideSpread <= k - 0.25) return true
  }
  return false
}

export type GradeResult = 'win' | 'loss' | 'push'

export function gradeAts(homeScore: number, awayScore: number, spreadLine: number, pickedHome: boolean): GradeResult {
  const coverMargin = homeScore - awayScore + spreadLine
  if (coverMargin === 0) return 'push'
  const homeCovered = coverMargin > 0
  return homeCovered === pickedHome ? 'win' : 'loss'
}

export function gradeTotal(homeScore: number, awayScore: number, totalLine: number, pickedOver: boolean): GradeResult {
  const actualTotal = homeScore + awayScore
  if (actualTotal === totalLine) return 'push'
  const wentOver = actualTotal > totalLine
  return wentOver === pickedOver ? 'win' : 'loss'
}
