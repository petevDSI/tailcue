// ============================================================================
// NFL Edge Board — scoring engine
//
// This is a direct TypeScript port of the standalone "Edge Board" model
// (published earlier as a Claude artifact) so the same, already-reviewed
// math now runs against real Supabase data instead of manually-typed
// numbers. The formulas and the documented reasoning behind each constant
// are unchanged; only the inputs now come from the `nfl_edge` schema.
//
// Read src/lib/nfl-edge/types.ts first for the data shapes this consumes.
// ============================================================================

export type RestCode = 'normal' | 'short' | 'bye' | 'trip'
export type Tier = 'elite' | 'strong' | 'lean' | 'pass'

export interface ScoreSettings {
  /** League-average points per team per game. */
  leagueAvg: number
  /** Full home-field-advantage value in points (split ±half onto each side's projection). */
  hfa: number
  /** Std. dev. of NFL margin-of-victory, used to convert a projected margin into a win probability. */
  sigma: number
}

export const DEFAULT_SETTINGS: ScoreSettings = { leagueAvg: 22.5, hfa: 1.5, sigma: 13.5 }

// ── Injury pricing (points) ────────────────────────────────────────────────
// These are the same buckets as the original board's QB_IMPACT / OTHER_IMPACT
// dropdowns, documented there as: an elite QB out swings a line ~5-7 pts; a
// non-elite starter out, ~3-4 pts; skill/O-line starters, well under a point
// each; "questionable" tags price at roughly half the "out" value since
// availability itself is close to a coin flip.
export const QB_IMPACT = {
  healthy: 0,
  elite_questionable: -3.25,
  elite_out: -6.5,
  starter_questionable: -1.75,
  starter_out: -3.5,
  emergency: -8,
} as const

export const OTHER_IMPACT = { none: 0, minor: -0.5, moderate: -1.5, severe: -3.0 } as const

export const REST_IMPACT: Record<RestCode, number> = { normal: 0, short: -1.0, bye: 0.5, trip: -0.5 }

// ── Math helpers ────────────────────────────────────────────────────────────

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741,
    a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911
  const t = 1 / (1 + p * x)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return sign * y
}

/** P(margin <= x) under a normal(0, sd) model of NFL margin of victory. */
export function normCdf(x: number, sd: number): number {
  return 0.5 * (1 + erf(x / (sd * Math.SQRT2)))
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function impliedProbFromAmerican(a: number | null): number | null {
  if (a === null || !a) return null
  return a > 0 ? 100 / (a + 100) : -a / (-a + 100)
}

export function decimalFromAmerican(a: number): number {
  return a > 0 ? 1 + a / 100 : 1 + 100 / -a
}

export function americanFromDecimal(d: number): number | null {
  if (d <= 1) return null
  return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1))
}

export function americanLabel(a: number): string {
  return a > 0 ? `+${a}` : String(a)
}

export function tierOf(score: number | null): { n: 1 | 2 | 3 | 4; tier: Tier; label: string } {
  if (score === null) return { n: 4, tier: 'pass', label: '—' }
  if (score >= 78) return { n: 1, tier: 'elite', label: 'Elite' }
  if (score >= 64) return { n: 2, tier: 'strong', label: 'Strong' }
  if (score >= 50) return { n: 3, tier: 'lean', label: 'Lean' }
  return { n: 4, tier: 'pass', label: 'Pass' }
}

/** Suggested flat unit size per the board's own "0.5-2% of bankroll" guidance. */
export function unitsFor(tierN: number): number {
  return tierN === 1 ? 2.0 : tierN === 2 ? 1.0 : tierN === 3 ? 0.5 : 0
}

// ── Injury + rest derivation from raw DB rows ───────────────────────────────

import type { Injury } from './types'

export interface TeamInjuryImpact {
  points: number
  hasQuestionableQb: boolean
  notes: string[]
}

/**
 * Rolls a team's injury report into one point value the way the original
 * board's manual dropdowns did. Approximations, clearly flagged as such:
 *  - Only the single most severe QB designation counts (a team only starts
 *    one QB at a time).
 *  - Non-QB injuries stack additively but cap at the "severe" bucket
 *    (-3.0) — the model has no positional-importance data yet (starter vs.
 *    backup, WR1 vs. WR3), so every non-QB "out" is currently priced the
 *    same. Refining this needs a depth-chart/snap-count feed, which isn't
 *    wired up yet.
 */
export function deriveTeamInjuryImpact(injuries: Injury[], teamId: string): TeamInjuryImpact {
  const mine = injuries.filter((i) => i.team_id === teamId)
  const notes: string[] = []

  const qbRows = mine.filter((i) => i.is_qb)
  let qbPoints = 0
  let hasQuestionableQb = false
  if (qbRows.length > 0) {
    // Worst-case QB designation wins.
    const severity: Record<string, number> = { out: 3, doubtful: 2, questionable: 1, probable: 0 }
    const worst = qbRows.reduce((a, b) =>
      (severity[a.designation ?? ''] ?? -1) >= (severity[b.designation ?? ''] ?? -1) ? a : b
    )
    if (worst.designation === 'out') {
      qbPoints = QB_IMPACT.starter_out
      notes.push(`${worst.player_name} (QB) out`)
    } else if (worst.designation === 'doubtful') {
      qbPoints = (QB_IMPACT.starter_out + QB_IMPACT.starter_questionable) / 2
      notes.push(`${worst.player_name} (QB) doubtful`)
    } else if (worst.designation === 'questionable') {
      qbPoints = QB_IMPACT.starter_questionable
      hasQuestionableQb = true
      notes.push(`${worst.player_name} (QB) questionable`)
    } else if (worst.designation === 'probable') {
      qbPoints = QB_IMPACT.starter_questionable / 3
    }
  }

  const otherRows = mine.filter((i) => !i.is_qb)
  const perPlayer: Record<string, number> = { out: -1.0, doubtful: -0.6, questionable: -0.3, probable: -0.1 }
  let otherPoints = 0
  for (const row of otherRows) {
    otherPoints += perPlayer[row.designation ?? ''] ?? 0
  }
  otherPoints = clamp(otherPoints, OTHER_IMPACT.severe, 0)
  if (otherRows.length > 0) notes.push(`${otherRows.length} other injury report entr${otherRows.length === 1 ? 'y' : 'ies'}`)

  return { points: qbPoints + otherPoints, hasQuestionableQb, notes }
}

/** Days between a team's previous game and this one determine short-week / bye / normal. */
export function deriveRestCode(prevGameTimeIso: string | null, thisGameTimeIso: string): RestCode {
  if (!prevGameTimeIso) return 'normal'
  const diffDays = (new Date(thisGameTimeIso).getTime() - new Date(prevGameTimeIso).getTime()) / 86_400_000
  if (diffDays <= 4.5) return 'short'
  if (diffDays >= 12) return 'bye'
  return 'normal'
  // NOTE: "trip" (long road trip) needs travel distance between consecutive
  // away sites — teams.lat/lon is seeded, so this is a follow-up, not yet
  // wired into the generator script.
}

// ── Core per-game model ──────────────────────────────────────────────────

export interface ScoreGameInput {
  homeOff: number
  homeDef: number
  awayOff: number
  awayDef: number
  homeRest: RestCode
  awayRest: RestCode
  homeInjuryPts: number
  awayInjuryPts: number
  homeQuestionableQb: boolean
  awayQuestionableQb: boolean
  isDivisional: boolean
  /** True when this team is in a documented "sandwich"/lookahead spot — see schedule-context.ts's deriveSandwichRisk. */
  homeSandwichRisk: boolean
  awaySandwichRisk: boolean
  windMph: number
  isDome: boolean
  /** Consensus current home spread, e.g. -3 means home favored by 3. */
  marketSpreadHome: number | null
  /** Consensus opening home spread, for line-movement / RLM signals. */
  openSpreadHome: number | null
  marketTotal: number | null
  /** % of public bets/tickets on the home side, 0-100, when available. */
  publicHomePct: number | null
  homeMoneyline: number | null
  awayMoneyline: number | null
}

export interface ScoreGameResult {
  projHome: number
  projAway: number
  projMarginHome: number
  projTotal: number
  spreadEdgeHome: number | null
  totalEdge: number | null
  winProbHome: number
  winProbAway: number
  fairProbHome: number | null
  mlEdge: number | null
  suScore: number
  suSideIsHome: boolean
  atsScore: number | null
  atsSideIsHome: boolean | null
  /** P(the picked ATS side covers), same normal-margin model as winProbHome, re-centered on the market spread. Null when no market spread yet. */
  atsProbSide: number | null
  totScore: number | null
  totSideIsOver: boolean | null
  /** P(the picked total side hits), same model as atsProbSide applied to the total. Approximation: reuses margin SIGMA for total variance (no separately-fitted total-variance constant exists yet). Null when no market total yet. */
  totProbSide: number | null
  windPenalty: number
}

/**
 * Ports `compute()` from the original artifact verbatim, generalized to take
 * DB-shaped inputs instead of form fields keyed by "home"/"away" objects.
 */
export function scoreGame(g: ScoreGameInput, settings: ScoreSettings = DEFAULT_SETTINGS): ScoreGameResult {
  const { leagueAvg: LA, hfa: HFA, sigma: SIGMA } = settings

  const homeRestAdj = REST_IMPACT[g.homeRest]
  const awayRestAdj = REST_IMPACT[g.awayRest]

  let windPenalty = 0
  if (!g.isDome && g.windMph >= 20) windPenalty = 1.5
  else if (!g.isDome && g.windMph >= 15) windPenalty = 0.8

  const projHome = LA + g.homeOff - g.awayDef + HFA / 2 + homeRestAdj + g.homeInjuryPts - windPenalty / 2
  const projAway = LA + g.awayOff - g.homeDef - HFA / 2 + awayRestAdj + g.awayInjuryPts - windPenalty / 2

  const projMarginHome = projHome - projAway
  const projTotal = projHome + projAway

  const vegasMarginHome = g.marketSpreadHome !== null ? -g.marketSpreadHome : null
  const spreadEdgeHome = vegasMarginHome !== null ? projMarginHome - vegasMarginHome : null

  const totalEdge = g.marketTotal !== null ? projTotal - g.marketTotal : null

  const winProbHome = normCdf(projMarginHome, SIGMA)
  const winProbAway = 1 - winProbHome

  let fairProbHome: number | null = null
  if (g.homeMoneyline !== null && g.awayMoneyline !== null) {
    const ih = impliedProbFromAmerican(g.homeMoneyline)
    const ia = impliedProbFromAmerican(g.awayMoneyline)
    if (ih !== null && ia !== null && ih + ia > 0) fairProbHome = ih / (ih + ia)
  }

  // ---- line movement ----
  let lineMoveBonus = 0
  if (g.openSpreadHome !== null && g.marketSpreadHome !== null && spreadEdgeHome !== null) {
    const move = g.marketSpreadHome - g.openSpreadHome // negative = moved toward home
    const modelFavorsHomeAts = spreadEdgeHome > 0
    const movedTowardHome = move < 0
    if (Math.abs(move) >= 0.5) lineMoveBonus = modelFavorsHomeAts === movedTowardHome ? 7 : -7
  }

  // ---- reverse line movement (public vs. line) ----
  let rlmBonus = 0
  if (
    g.publicHomePct !== null &&
    g.openSpreadHome !== null &&
    g.marketSpreadHome !== null &&
    spreadEdgeHome !== null
  ) {
    const pub = g.publicHomePct
    const move2 = g.marketSpreadHome - g.openSpreadHome
    const modelFavorsHome = spreadEdgeHome > 0
    if (pub >= 60 && move2 > 0.5) rlmBonus = modelFavorsHome ? -6 : 6
    else if (pub <= 40 && move2 < -0.5) rlmBonus = modelFavorsHome ? 6 : -6
  }

  const qbQuestionablePenalty = (g.homeQuestionableQb ? 4 : 0) + (g.awayQuestionableQb ? 4 : 0)
  const divisionalPenaltyAts = g.isDivisional ? 3 : 0

  // ---- ATS ----
  let atsScore: number | null = null
  let atsSideIsHome: boolean | null = null
  if (spreadEdgeHome !== null) {
    atsSideIsHome = spreadEdgeHome >= 0
    // Modest, undordered penalty when the picked side is in a documented
    // "sandwich"/lookahead spot (schedule-context.ts) — same soft-signal
    // treatment as the divisional and QB-questionable penalties above, not
    // baked into the projected margin itself.
    const sandwichPenaltyAts = (atsSideIsHome ? g.homeSandwichRisk : g.awaySandwichRisk) ? 3 : 0
    atsScore = clamp(
      50 +
        Math.min(Math.abs(spreadEdgeHome), 6) * 6 +
        lineMoveBonus +
        rlmBonus -
        qbQuestionablePenalty -
        divisionalPenaltyAts -
        sandwichPenaltyAts,
      0,
      100
    )
  }

  // Same normal-margin model already used for the SU win probability
  // (winProbHome = normCdf(projMarginHome, SIGMA)), just re-centered on the
  // market spread instead of a pick'em line: P(picked side covers) =
  // normCdf(|spreadEdgeHome|, SIGMA). This reuses the model's own edge
  // number through the exact same, already-reviewed distribution — not a
  // new fabricated probability — so it's safe to use for real parlay math.
  let atsProbSide: number | null = null
  if (spreadEdgeHome !== null) {
    atsProbSide = normCdf(Math.abs(spreadEdgeHome), SIGMA)
  }

  // ---- Totals ----
  let totScore: number | null = null
  let totSideIsOver: boolean | null = null
  if (totalEdge !== null) {
    totSideIsOver = totalEdge >= 0
    let windBonus = 0
    if (windPenalty > 0) windBonus = !totSideIsOver ? 6 : -6
    const divTotalAdj = g.isDivisional ? (!totSideIsOver ? 4 : -4) : 0
    totScore = clamp(50 + Math.min(Math.abs(totalEdge), 8) * 4.5 + windBonus + divTotalAdj, 0, 100)
  }

  // Same treatment as atsProbSide above, applied to the total. APPROXIMATION:
  // reuses the margin-of-victory SIGMA for total variance too (no
  // separately-fitted total-variance constant exists yet) — treat
  // totProbSide as directionally honest, not precisely calibrated.
  let totProbSide: number | null = null
  if (totalEdge !== null) {
    totProbSide = normCdf(Math.abs(totalEdge), SIGMA)
  }

  // ---- SU / Moneyline ----
  const suSideIsHome = winProbHome >= 0.5
  let mlEdge: number | null = null
  let suScore: number
  if (fairProbHome !== null) {
    mlEdge = suSideIsHome ? winProbHome - fairProbHome : winProbAway - (1 - fairProbHome)
    suScore = 50 + clamp(mlEdge * 100, 0, 12) * 3.2
  } else {
    suScore = 50 + Math.min(Math.abs(projMarginHome), 10) * 3
  }
  if (atsScore !== null && atsSideIsHome !== null && atsSideIsHome === suSideIsHome) suScore += 5
  suScore = clamp(suScore, 0, 100)

  return {
    projHome,
    projAway,
    projMarginHome,
    projTotal,
    spreadEdgeHome,
    totalEdge,
    winProbHome,
    winProbAway,
    fairProbHome,
    mlEdge,
    suScore,
    suSideIsHome,
    atsScore,
    atsSideIsHome,
    atsProbSide,
    totScore,
    totSideIsOver,
    totProbSide,
    windPenalty,
  }
}

// ── Parlay math ──────────────────────────────────────────────────────────

export interface ParlayLeg {
  gameId: string
  label: string
  trueProb: number
  bookOddsAmerican: number | null
}

export interface ParlayResult {
  legs: number
  combinedProb: number
  fairDecimal: number
  fairAmerican: number | null
  bookDecimal: number | null
  evPct: number | null
  hasCorrelatedLegs: boolean
  tooManyLegs: boolean
}

export function combineParlayLegs(legs: ParlayLeg[]): ParlayResult {
  const combinedProb = legs.reduce((acc, l) => acc * l.trueProb, 1)
  const fairDecimal = combinedProb > 0 ? 1 / combinedProb : Infinity
  const fairAmerican = americanFromDecimal(fairDecimal)

  const allOddsEntered = legs.every((l) => l.bookOddsAmerican !== null)
  const bookDecimal = allOddsEntered
    ? legs.reduce((acc, l) => acc * decimalFromAmerican(l.bookOddsAmerican as number), 1)
    : null

  const evPct = bookDecimal !== null ? (bookDecimal * combinedProb - 1) * 100 : null

  const gameIds = legs.map((l) => l.gameId)
  const hasCorrelatedLegs = new Set(gameIds).size !== gameIds.length

  return {
    legs: legs.length,
    combinedProb,
    fairDecimal,
    fairAmerican,
    bookDecimal,
    evPct,
    hasCorrelatedLegs,
    tooManyLegs: legs.length > 4,
  }
}
