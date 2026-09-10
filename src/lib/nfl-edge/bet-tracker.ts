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

import { decimalFromAmerican, impliedProbFromAmerican } from './scoring'

/** Profit if this bet wins (NOT including the stake itself) — standard American-odds payout math. */
export function profitIfWon(stake: number, odds: number): number {
  return stake * (decimalFromAmerican(odds) - 1)
}

export interface BetTrackerSummary {
  /** Every dollar ever staked across every tracked bet, win/lose/push/pending. The season's total handle. */
  totalStaked: number
  /** Stake sitting on bets still marked "pending" — not yet won, lost, or pushed. */
  atRisk: number
  /** Net profit/loss on won + lost bets only. Pushes are a wash; pending bets aren't resolved yet. */
  realizedPl: number
  wonCount: number
  lostCount: number
  pushCount: number
  /** Stake risked on won + lost bets only — the real denominator for ROI (pending stake hasn't been "put at risk and resolved" yet). */
  settledStaked: number
  /** wonCount / (wonCount + lostCount) as a percentage. Null with no decided bets yet. */
  winRatePct: number | null
  /**
   * The win rate these EXACT bets' own odds required to break even — a
   * stake-weighted average of each settled bet's own implied probability
   * (vig included), not a generic assumption like the standard -110 line's
   * 52.4%. A prop at +150 needs only 40% to break even; a heavy favorite
   * at -200 needs 66.7%. Comparing winRatePct against a fixed number is
   * misleading once the odds mix isn't uniform -- this is the real bar.
   * Null with no decided bets yet.
   */
  breakEvenWinRatePct: number | null
  /** Net realized P&L ÷ settled stake, as a percentage — the metric that actually reflects whether the picks are beating the market, independent of parlay/prop mix or odds. Null with no decided bets yet. */
  roiPct: number | null
}

/**
 * Aggregates a season's worth of `bets_placed` rows into the season-summary
 * numbers shown at the top of the Bet Tracker page. Pure function, no I/O,
 * so it's covered by the same "compute it once, share it" discipline as
 * power-rating-model.ts / historical-backtest-lib.ts.
 */
export function summarizeBets(bets: { stake: number | string; odds: number; result: string }[]): BetTrackerSummary {
  let totalStaked = 0
  let atRisk = 0
  let realizedPl = 0
  let wonCount = 0
  let lostCount = 0
  let pushCount = 0
  let settledStaked = 0
  let breakEvenWeightedSum = 0

  for (const b of bets) {
    const stake = Number(b.stake)
    totalStaked += stake
    if (b.result === 'pending') {
      atRisk += stake
    } else if (b.result === 'won') {
      realizedPl += profitIfWon(stake, b.odds)
      wonCount++
      settledStaked += stake
      breakEvenWeightedSum += stake * (impliedProbFromAmerican(b.odds) ?? 0)
    } else if (b.result === 'lost') {
      realizedPl -= stake
      lostCount++
      settledStaked += stake
      breakEvenWeightedSum += stake * (impliedProbFromAmerican(b.odds) ?? 0)
    } else if (b.result === 'push') {
      pushCount++
    }
  }

  const decided = wonCount + lostCount
  return {
    totalStaked,
    atRisk,
    realizedPl,
    wonCount,
    lostCount,
    pushCount,
    settledStaked,
    winRatePct: decided > 0 ? (wonCount / decided) * 100 : null,
    breakEvenWinRatePct: settledStaked > 0 ? (breakEvenWeightedSum / settledStaked) * 100 : null,
    roiPct: settledStaked > 0 ? (realizedPl / settledStaked) * 100 : null,
  }
}
