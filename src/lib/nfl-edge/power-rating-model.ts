// ============================================================================
// NFL Edge Board — shared power-rating computation (nflverse play-by-play)
//
// Extracted 2026-09-10 from sync-power-ratings.ts so the exact same
// EWMA/garbage-time/prior-blend methodology backs both the live nightly
// sync (sync-power-ratings.ts) and the historical backtest (backtest.ts) —
// one implementation, not two that can silently drift apart. See
// sync-power-ratings.ts's header comment for the full methodology writeup;
// this file is pure computation, no DB access.
// ============================================================================
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { Readable } from 'node:stream'

export const CURRENT_SEASON_FULL_WEIGHT_AT_GAMES = 8

export const NFLVERSE_TO_NFL_EDGE: Record<string, string> = { LA: 'LAR', WAS: 'WSH' }
export function mapTeam(t: string): string {
  return NFLVERSE_TO_NFL_EDGE[t] ?? t
}

// Minimal RFC4180-ish CSV line splitter — quote-aware, handles "" escaped
// quotes. Verified against the real 2025 file to produce identical
// aggregates to a reference parse with polars/nflreadpy before this was
// written; no new npm dependency needed for ~7 columns out of 372.
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

export interface TeamAvg {
  /** Recency-weighted (EWMA) per-game value, NOT a flat average — see EWMA_SPAN below. */
  avg: number
  games: number
}

// Recency weighting: a flat season-to-date average reacts too slowly to
// injuries or mid-season schematic shifts — a well-documented gap between
// amateur and professional rating systems (amateurs use unweighted seasonal
// averages; professionals use an exponentially weighted moving average so
// recent games count more than early-season ones). Span 10 is the standard
// default used across public NFL-analytics EWMA examples (pandas' own
// `.ewm(span=10)`), not a fitted/optimized constant — a reasonable,
// documented starting point, same spirit as this file's other non-fitted
// constants.
export const EWMA_SPAN = 10

/** pandas-equivalent `.ewm(span=N, adjust=False).mean()` — recency-weighted average over values already in chronological order. */
export function ewma(valuesChronological: number[], span: number): number {
  const alpha = 2 / (span + 1)
  let result = valuesChronological[0]
  for (let i = 1; i < valuesChronological.length; i++) {
    result = alpha * valuesChronological[i] + (1 - alpha) * result
  }
  return result
}

/**
 * Downloads one season's real play-by-play file and returns each team's
 * EWMA-weighted EPA/game on offense and allowed/game on defense (NOT yet
 * centered on league average — caller does that). Returns null if the file
 * doesn't exist yet (current season before any games have been played — a
 * 404, not an error). `maxWeek`, when given, only counts weeks strictly
 * before it (so "as of week N" never uses week N's own not-yet-final
 * results — this is also what keeps the backtest honest/out-of-sample:
 * week N's prediction never sees week N's own plays).
 */
export async function loadEpaAverages(
  year: number,
  maxWeek?: number
): Promise<{ off: Map<string, TeamAvg>; def: Map<string, TeamAvg> } | null> {
  const url = `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_${year}.csv.gz`
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok || !res.body) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`)

  const nodeStream = Readable.fromWeb(res.body as any)
  const rl = createInterface({ input: nodeStream.pipe(createGunzip()), crlfDelay: Infinity })

  let idx: Record<string, number> | null = null
  const offByGame = new Map<string, number>()
  const defByGame = new Map<string, number>()
  // game_id -> real game date, so per-team per-game values can be sorted
  // chronologically before computing the EWMA (the pbp file's own row
  // order roughly follows the schedule but isn't a guaranteed sort key).
  const dateByGame = new Map<string, string>()

  for await (const line of rl) {
    if (!idx) {
      const header = splitCsvLine(line)
      idx = Object.fromEntries(header.map((c, i) => [c, i]))
      continue
    }
    const cols = splitCsvLine(line)
    if (cols[idx.season_type] !== 'REG') continue
    if (maxWeek !== undefined && Number(cols[idx.week]) >= maxWeek) continue
    if (cols[idx.pass] !== '1' && cols[idx.rush] !== '1') continue
    // Garbage-time filter: drop plays where the game was already
    // functionally decided (posteam win probability outside 5-95%).
    // Verified against the real 2025 file: this excludes ~15% of
    // pass/rush plays and meaningfully changes team averages (e.g. a bad
    // team's garbage-time snaps against a prevent defense no longer
    // inflate its offensive EPA/game) — every public EPA leaderboard
    // applies some version of this, and `wp` is populated on 100% of real
    // pass/rush plays in that file, so this isn't dropping data we can't
    // afford to lose.
    const wpStr = cols[idx.wp]
    if (wpStr !== '') {
      const wp = Number(wpStr)
      if (Number.isFinite(wp) && (wp < 0.05 || wp > 0.95)) continue
    }
    const epaStr = cols[idx.epa]
    if (epaStr === '') continue
    const epa = Number(epaStr)
    if (!Number.isFinite(epa)) continue

    const posteam = cols[idx.posteam]
    const defteam = cols[idx.defteam]
    const gameId = cols[idx.game_id]
    if (!dateByGame.has(gameId) && cols[idx.game_date]) dateByGame.set(gameId, cols[idx.game_date])
    if (posteam) {
      const key = `${posteam}|${gameId}`
      offByGame.set(key, (offByGame.get(key) ?? 0) + epa)
    }
    if (defteam) {
      const key = `${defteam}|${gameId}`
      defByGame.set(key, (defByGame.get(key) ?? 0) + epa)
    }
  }

  function aggregate(byGame: Map<string, number>): Map<string, TeamAvg> {
    const perTeamGames = new Map<string, { date: string; val: number }[]>()
    for (const [key, val] of Array.from(byGame.entries())) {
      const [team, gameId] = key.split('|')
      const list = perTeamGames.get(team) ?? []
      list.push({ date: dateByGame.get(gameId) ?? '', val })
      perTeamGames.set(team, list)
    }
    const out = new Map<string, TeamAvg>()
    for (const [team, list] of Array.from(perTeamGames.entries())) {
      const sorted = list.slice().sort((a, b) => a.date.localeCompare(b.date))
      out.set(team, { avg: ewma(sorted.map((g) => g.val), EWMA_SPAN), games: sorted.length })
    }
    return out
  }

  return { off: aggregate(offByGame), def: aggregate(defByGame) }
}

/** Centers a season's raw per-team averages on that season's own league average, producing off_rating (positive = better offense) and def_rating (positive = better defense, per scoring.ts's sign convention). */
export function centerRatings(
  off: Map<string, TeamAvg>,
  def: Map<string, TeamAvg>
): Map<string, { off: number; def: number; games: number }> {
  const leagueOff = Array.from(off.values()).reduce((a, b) => a + b.avg, 0) / off.size
  const leagueDef = Array.from(def.values()).reduce((a, b) => a + b.avg, 0) / def.size
  const out = new Map<string, { off: number; def: number; games: number }>()
  for (const [team, o] of Array.from(off.entries())) {
    const d = def.get(team)
    out.set(team, {
      off: o.avg - leagueOff,
      def: d ? -(d.avg - leagueDef) : 0,
      games: o.games,
    })
  }
  return out
}

export interface BlendedTeamRating {
  off: number
  def: number
  gamesPlayed: number
  source: 'nflverse_prior_blend' | 'nflverse_pure_prior'
}

/**
 * Blends a completed prior season's centered ratings with however much of
 * the current season has been played (see sync-power-ratings.ts header for
 * the blend rationale) -- pure computation, factored out so
 * `computeBlendedRatings` (one network fetch per call, fine for the live
 * nightly sync) and the backtest (which needs this same blend for many
 * different "as of week" cuts of ONE already-downloaded season) share one
 * implementation.
 */
export function blendRatings(
  prior: Map<string, { off: number; def: number; games: number }>,
  current: Map<string, { off: number; def: number; games: number }>
): Map<string, BlendedTeamRating> {
  const teams = new Set<string>(Array.from(prior.keys()))
  for (const t of Array.from(current.keys())) teams.add(t)

  const out = new Map<string, BlendedTeamRating>()
  for (const rawTeam of Array.from(teams)) {
    const teamId = mapTeam(rawTeam)
    const p = prior.get(rawTeam) ?? { off: 0, def: 0, games: 0 }
    const c = current.get(rawTeam)
    const gamesPlayed = c?.games ?? 0
    const weightCurrent = Math.max(0, Math.min(1, gamesPlayed / CURRENT_SEASON_FULL_WEIGHT_AT_GAMES))
    const weightPrior = 1 - weightCurrent
    out.set(teamId, {
      off: c ? c.off * weightCurrent + p.off * weightPrior : p.off,
      def: c ? c.def * weightCurrent + p.def * weightPrior : p.def,
      gamesPlayed,
      source: current.size > 0 ? 'nflverse_prior_blend' : 'nflverse_pure_prior',
    })
  }
  return out
}

export interface PerGameValue {
  week: number
  date: string
  val: number
}

/**
 * Like loadEpaAverages, but returns EVERY game's per-team value (not yet
 * EWMA'd, centered, or week-filtered) with its week number attached, sorted
 * chronologically per team. Exists so a caller that needs ratings "as of"
 * many different weeks of the SAME season (the backtest, which tests every
 * week of every season) can fetch that one season's play-by-play file
 * exactly ONCE and slice it in memory per week, instead of re-downloading
 * the same multi-week file 18 times (once per `loadEpaAverages(year,
 * maxWeek)` call) -- a real difference when backtesting many seasons.
 */
export async function loadPerGameValues(
  year: number
): Promise<{ off: Map<string, PerGameValue[]>; def: Map<string, PerGameValue[]> } | null> {
  const url = `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_${year}.csv.gz`
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok || !res.body) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`)

  const nodeStream = Readable.fromWeb(res.body as any)
  const rl = createInterface({ input: nodeStream.pipe(createGunzip()), crlfDelay: Infinity })

  let idx: Record<string, number> | null = null
  const offByGame = new Map<string, number>()
  const defByGame = new Map<string, number>()
  const dateByGame = new Map<string, string>()
  const weekByGame = new Map<string, number>()

  for await (const line of rl) {
    if (!idx) {
      const header = splitCsvLine(line)
      idx = Object.fromEntries(header.map((c, i) => [c, i]))
      continue
    }
    const cols = splitCsvLine(line)
    if (cols[idx.season_type] !== 'REG') continue
    if (cols[idx.pass] !== '1' && cols[idx.rush] !== '1') continue
    const wpStr = cols[idx.wp]
    if (wpStr !== '') {
      const wp = Number(wpStr)
      if (Number.isFinite(wp) && (wp < 0.05 || wp > 0.95)) continue
    }
    const epaStr = cols[idx.epa]
    if (epaStr === '') continue
    const epa = Number(epaStr)
    if (!Number.isFinite(epa)) continue

    const posteam = cols[idx.posteam]
    const defteam = cols[idx.defteam]
    const gameId = cols[idx.game_id]
    if (!dateByGame.has(gameId) && cols[idx.game_date]) dateByGame.set(gameId, cols[idx.game_date])
    if (!weekByGame.has(gameId) && cols[idx.week]) weekByGame.set(gameId, Number(cols[idx.week]))
    if (posteam) {
      const key = `${posteam}|${gameId}`
      offByGame.set(key, (offByGame.get(key) ?? 0) + epa)
    }
    if (defteam) {
      const key = `${defteam}|${gameId}`
      defByGame.set(key, (defByGame.get(key) ?? 0) + epa)
    }
  }

  function aggregate(byGame: Map<string, number>): Map<string, PerGameValue[]> {
    const perTeamGames = new Map<string, PerGameValue[]>()
    for (const [key, val] of Array.from(byGame.entries())) {
      const [team, gameId] = key.split('|')
      const list = perTeamGames.get(team) ?? []
      list.push({ week: weekByGame.get(gameId) ?? 0, date: dateByGame.get(gameId) ?? '', val })
      perTeamGames.set(team, list)
    }
    for (const list of Array.from(perTeamGames.values())) {
      list.sort((a, b) => a.date.localeCompare(b.date))
    }
    return perTeamGames
  }

  return { off: aggregate(offByGame), def: aggregate(defByGame) }
}

/**
 * EWMA + league-average-centered ratings from a `loadPerGameValues` result,
 * restricted to games strictly before `maxWeek` (or every game, when
 * `maxWeek` is omitted -- used for a completed prior season). Pure
 * in-memory computation, no network access -- the whole point of splitting
 * this out from `loadEpaAverages`.
 */
export function ratingsAsOf(
  perGame: { off: Map<string, PerGameValue[]>; def: Map<string, PerGameValue[]> },
  maxWeek?: number
): Map<string, { off: number; def: number; games: number }> {
  function toTeamAvg(byTeam: Map<string, PerGameValue[]>): Map<string, TeamAvg> {
    const out = new Map<string, TeamAvg>()
    for (const [team, list] of Array.from(byTeam.entries())) {
      const filtered = maxWeek === undefined ? list : list.filter((g) => g.week < maxWeek)
      if (filtered.length === 0) continue
      out.set(team, { avg: ewma(filtered.map((g) => g.val), EWMA_SPAN), games: filtered.length })
    }
    return out
  }
  return centerRatings(toTeamAvg(perGame.off), toTeamAvg(perGame.def))
}

/**
 * Full "as of week N" rating for every team: last season's full reg-season
 * ratings blended with however many of the current season's games have
 * been played so far (see sync-power-ratings.ts header for the blend
 * rationale), returned keyed by this schema's team_id (LAR/WSH already
 * mapped from nflverse's LA/WAS). `priorRaw` is loaded internally from
 * `year - 1`; pass a pre-fetched `currentRaw` when the caller is looping
 * over many weeks of the same season so the current-season file is only
 * downloaded once (loadEpaAverages accepts `maxWeek` to bound it per call
 * regardless).
 */
export async function computeBlendedRatings(
  year: number,
  asOfWeek: number
): Promise<Map<string, BlendedTeamRating> | null> {
  const priorRaw = await loadEpaAverages(year - 1)
  if (!priorRaw) return null
  const prior = centerRatings(priorRaw.off, priorRaw.def)

  const currentRaw = await loadEpaAverages(year, asOfWeek)
  const current = currentRaw ? centerRatings(currentRaw.off, currentRaw.def) : new Map()

  return blendRatings(prior, current)
}
