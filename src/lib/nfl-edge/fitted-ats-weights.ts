// ============================================================================
// NFL Edge Board — data-fit ATS score weights
//
// Generated 2026-09-10 by scripts/nfl-edge/fit-ats-weights.ts. Replaces the
// hand-picked edge/divisional/key-number constants in scoring.ts's ATS
// score with real logistic-regression weights, fit against every graded
// historical ATS bet 2015-2024 (2,456 games with a market spread and a
// final score, live-default 'flat' power ratings — see that script's
// header for the full methodology and honesty guards).
//
// METHODOLOGY SUMMARY (see the fitting script for the full run):
//  - Train/test split BEFORE trusting this: fit on 2015-2021 (n=1,649),
//    evaluated on the untouched 2022-2024 holdout (n=807). Holdout log loss
//    0.6847 / Brier 0.2458 — both clearly BETTER than the OLD hand-tuned
//    formula's same-features log loss 0.7995 / Brier 0.2865 on that same
//    holdout. Calibration buckets were roughly monotonic on both train and
//    holdout (predicted probability tracked actual win rate reasonably
//    closely at every quintile) — a real, out-of-sample improvement, not
//    an artifact of fitting and grading on the same data.
//  - These deployed coefficients are the FINAL refit on the full
//    2015-2024 set (standard practice once the method is validated
//    out-of-sample above: use all available data for the deployed model).
//  - Line movement, reverse-line-movement, and the QB-questionable penalty
//    are NOT part of this fit and are UNCHANGED in scoring.ts — no
//    historical opening-line, public-betting-%, or injury-designation feed
//    exists anywhere free, so those stay the original hand-set, sourced
//    constants (see the methodology doc). Only the edge / divisional /
//    key-number portion of the score is replaced by this fit.
//
// HONEST, notable finding worth flagging directly to Pete: the fitted
// keyNumberCoef came out NEGATIVE (games where the market's number sits
// just favorably positioned relative to a key number — 3, 7, etc. — FOR
// THE MODEL'S OWN PICKED SIDE covered slightly LESS often historically,
// not more), the opposite direction from the old formula's +2 "buying the
// key number" bonus. This doesn't necessarily refute standard key-number
// theory in general market pricing (a different question about which side
// of an already-shopped line to prefer) — it's specific to this model's
// own edge-based pick, and the effect is modest but was stable between the
// train-only fit (-0.2465) and the full-sample fit (-0.2388), which argues
// against it being pure noise. Recorded here as-is because surfacing a
// real disagreement between assumed betting folklore and what the data
// actually shows is the entire point of fitting to outcomes instead of
// keeping whichever hand-set number felt right.
//
// Reproduce or update: npx tsx scripts/nfl-edge/fit-ats-weights.ts
// ============================================================================

export const FITTED_ATS_WEIGHTS = {
  intercept: 0.0872525828461091,
  edgeCoef: 0.04989054692147488,
  divisionalCoef: -0.022006029014181756,
  keyNumberCoef: -0.23883618012405688,
  edgeCap: 6,
  fitSampleRange: '2015-2024',
  fitSampleSize: 2456,
  generatedAt: '2026-09-10',
} as const

/** logit -> probability, then to a 0-100 base score (before the still-hand-set line-movement/RLM/QB/sandwich bonuses are added in scoring.ts). */
export function fittedAtsBaseScore(edgeAbs: number, isDivisional: boolean, hasKeyNumber: boolean): number {
  const w = FITTED_ATS_WEIGHTS
  const cappedEdge = Math.min(edgeAbs, w.edgeCap)
  const z = w.intercept + w.edgeCoef * cappedEdge + w.divisionalCoef * (isDivisional ? 1 : 0) + w.keyNumberCoef * (hasKeyNumber ? 1 : 0)
  const prob = 1 / (1 + Math.exp(-z))
  return prob * 100
}
