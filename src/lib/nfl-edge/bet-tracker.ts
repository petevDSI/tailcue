// ============================================================================
// NFL Edge Board — bet tracker math
//
// Shared, honest payout math for the bets Pete has actually checked off as
// placed (see bets_placed / the Top Bets and Bet Tracker pages). Grading
// stays manual (Pete clicks Won/Lost/Push on the Bet Tracker page) rather
// than auto-graded — this system doesn't store the exact spread/total
// number a bet was placed against (only the human-readable description
// text, since bet_recommendations has no numeric line column), so an
// auto-grader for ATS/Total picks could silently get push/cover math wrong
// with real money on the line. Moneyline and parlay legs could in
// principle be auto-graded from final scores, but keeping every bet type
// on the same manual-confirm flow is simpler and safer than a system
// that's automatic for some bets and not others.
// ============================================================================

import { decimalFromAmerican } from './scoring'

/** Profit if this bet wins (NOT including the stake itself) — standard American-odds payout math. */
export function profitIfWon(stake: number, odds: number): number {
  return stake * (decimalFromAmerican(odds) - 1)
}
