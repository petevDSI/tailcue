// ============================================================================
// NFL Edge Board — promo/boost expected-value math
//
// Answers the actual question a DK/FD promo raises: given a real odds boost,
// percentage profit boost, bonus bet, or risk-free bet, and the model's own
// fair win probability for a specific pick, is this promo actually worth
// more than a plain wager — and on which of this week's qualifying picks is
// it worth the MOST? The promo data itself is manual entry (see the /promos
// admin page) — deliberately not scraped, see the implementation-status doc
// for why (both DK's and FD's own Terms of Use explicitly prohibit
// automated scraping/bots, with account suspension as the stated
// consequence, and the highest-value promos are personalized to one
// account anyway, invisible to any public scraper).
//
// Each promo_type needs genuinely different math, not one formula:
//  - profit_boost: boosts the PROFIT portion of a decimal-odds payout only,
//    never the stake. Standard, widely-documented conversion:
//    newDecimal = 1 + (oldDecimal - 1) * (1 + boostPct).
//  - odds_boost: the book directly replaces the market price with a better
//    one on a specific market — just re-run the normal EV formula at the
//    boosted price instead of the market price.
//  - bonus_bet (a free-bet credit): the STAKE is never returned, win or
//    lose — only the profit. This is NOT free-money-with-no-cost EV the way
//    the other types are relative to a real wager: there's no real stake at
//    risk, so "extra EV" here means the credit's own expected cash value,
//    not an improvement over a baseline real bet. A well-documented
//    consequence: free-bet EV is maximized by HIGHER payout odds
//    (bigger underdogs), not the model's highest-confidence picks, since
//    only the profit multiple matters and the stake cost is zero either
//    way — surfaced as a note here rather than silently favored, since a
//    huge-underdog free-bet play still needs a real, qualifying edge behind
//    it, not just long odds for their own sake.
//  - risk_free: a REAL stake is placed; a loss refunds some amount, almost
//    always as a bonus bet (not cash) — which itself isn't worth full face
//    value once redeemed. `bonusRedemptionRate` (default 0.75) is a
//    commonly cited rule-of-thumb for a bonus bet's real cash-equivalent
//    value, not an exact figure — adjust it if your own experience with
//    these books' redemption terms differs.
// ============================================================================

import { decimalFromAmerican, americanFromDecimal, americanLabel } from './scoring'
import { promoMatchesBet } from './bankroll'
import type { AllocationCandidate } from './bankroll'
import type { Promo, Sportsbook } from './types'

export interface PromoEvInput {
  promo: Promo
  /** Normal American market odds for the specific bet being considered (before any promo). */
  marketOdds: number
  /** Model's own fair win probability for the picked side, 0-1 (atsProbSide / totProbSide / winProbHome / fairProb — whichever applies). */
  modelProb: number
  /** Reference stake to evaluate — normally the bankroll allocator's own suggested stake for this pick. Ignored (in favor of promo.bonus_amount) for bonus_bet. */
  stake: number
  /** Commonly cited rule-of-thumb for a bonus-bet credit's real cash-equivalent value once redeemed — not exact. Only used for risk_free. */
  bonusRedemptionRate?: number
}

export interface PromoEvResult {
  applicable: boolean
  reason?: string
  /** $ EV of a plain wager at marketOdds/stakeUsed, no promo (0 for bonus_bet — there's no "plain wager" baseline for free money). */
  baselineEv: number
  /** $ EV with the promo applied. */
  promoEv: number
  /** promoEv - baselineEv — the dollar value the promo actually adds. */
  extraEv: number
  /** extraEv as a % of stakeUsed, so promos/bets of different sizes are comparable. */
  extraEvPctOfStake: number
  stakeUsed: number
  notes: string[]
}

function stakeEv(decimal: number, prob: number, stake: number): number {
  return stake * (prob * (decimal - 1) - (1 - prob))
}

function notApplicable(reason: string): PromoEvResult {
  return { applicable: false, reason, baselineEv: 0, promoEv: 0, extraEv: 0, extraEvPctOfStake: 0, stakeUsed: 0, notes: [] }
}

export function evaluatePromo(input: PromoEvInput): PromoEvResult {
  const { promo, marketOdds, modelProb, stake, bonusRedemptionRate = 0.75 } = input
  if (modelProb <= 0 || modelProb >= 1) return notApplicable('Model probability out of range.')

  const stakeUsed = promo.max_stake !== null ? Math.min(stake, promo.max_stake) : stake
  const baselineDecimal = decimalFromAmerican(marketOdds)
  const baselineEv = stakeEv(baselineDecimal, modelProb, stakeUsed)
  const notes: string[] = []

  switch (promo.promo_type) {
    case 'profit_boost': {
      if (promo.boost_pct === null) return notApplicable('No boost % on file for this promo.')
      const boostedDecimal = 1 + (baselineDecimal - 1) * (1 + promo.boost_pct)
      const promoEv = stakeEv(boostedDecimal, modelProb, stakeUsed)
      const effAmerican = americanFromDecimal(boostedDecimal)
      notes.push(
        `${(promo.boost_pct * 100).toFixed(0)}% profit boost turns ${americanLabel(marketOdds)} into an effective ${effAmerican !== null ? americanLabel(effAmerican) : '—'} on the profit portion only (stake isn't boosted).`
      )
      return {
        applicable: true,
        baselineEv,
        promoEv,
        extraEv: promoEv - baselineEv,
        extraEvPctOfStake: stakeUsed > 0 ? ((promoEv - baselineEv) / stakeUsed) * 100 : 0,
        stakeUsed,
        notes,
      }
    }
    case 'odds_boost': {
      if (promo.boosted_odds === null) return notApplicable('No boosted odds on file for this promo.')
      const boostedDecimal = decimalFromAmerican(promo.boosted_odds)
      const promoEv = stakeEv(boostedDecimal, modelProb, stakeUsed)
      notes.push(`Market price ${americanLabel(marketOdds)} boosted directly to ${americanLabel(promo.boosted_odds)}.`)
      return {
        applicable: true,
        baselineEv,
        promoEv,
        extraEv: promoEv - baselineEv,
        extraEvPctOfStake: stakeUsed > 0 ? ((promoEv - baselineEv) / stakeUsed) * 100 : 0,
        stakeUsed,
        notes,
      }
    }
    case 'bonus_bet': {
      if (promo.bonus_amount === null) return notApplicable('No bonus-bet face value on file for this promo.')
      const faceValue = promo.max_stake !== null ? Math.min(promo.bonus_amount, promo.max_stake) : promo.bonus_amount
      // Stake is never returned, win or lose — only the profit multiple matters, so there's no "baseline real wager" to compare against.
      const promoEv = faceValue * modelProb * (baselineDecimal - 1)
      notes.push(
        `Free-bet credit — stake ($${faceValue.toFixed(2)}) is never returned, so this is the credit's own expected cash value, not an upgrade over a real wager. Free-bet EV is mathematically maximized by higher payout odds (bigger underdogs) with real edge behind them, not the model's highest-probability picks — worth checking a qualifying underdog play here too, not just the top-ranked game.`
      )
      return {
        applicable: true,
        baselineEv: 0,
        promoEv,
        extraEv: promoEv,
        extraEvPctOfStake: faceValue > 0 ? (promoEv / faceValue) * 100 : 0,
        stakeUsed: faceValue,
        notes,
      }
    }
    case 'risk_free': {
      if (promo.bonus_amount === null) return notApplicable('No risk-free refund amount on file for this promo.')
      const refundAmount = Math.min(promo.bonus_amount, stakeUsed)
      const promoEv =
        modelProb * stakeUsed * (baselineDecimal - 1) - (1 - modelProb) * stakeUsed + (1 - modelProb) * refundAmount * bonusRedemptionRate
      notes.push(
        `A loss refunds up to $${refundAmount.toFixed(2)} as a bonus bet, assumed worth ~${(bonusRedemptionRate * 100).toFixed(0)}% of face value once redeemed (a rule of thumb — adjust bonusRedemptionRate if your own experience with this book differs).`
      )
      return {
        applicable: true,
        baselineEv,
        promoEv,
        extraEv: promoEv - baselineEv,
        extraEvPctOfStake: stakeUsed > 0 ? ((promoEv - baselineEv) / stakeUsed) * 100 : 0,
        stakeUsed,
        notes,
      }
    }
    case 'other':
    default:
      return notApplicable('Generic/"other" promo type has no computable fields — logged for reference only.')
  }
}

export interface PromoCandidate {
  recommendationId: number
  description: string
  side: string
  tier: string
  betCategory: string
  sportsbook: Sportsbook | null
  marketOdds: number | null
  modelProb: number | null
  stake: number
}

export interface RankedPromoUse extends PromoEvResult {
  candidate: PromoCandidate
}

/**
 * Ranks this week's qualifying picks by how much dollar EV this specific
 * promo would add if applied there — the direct answer to "where's the
 * extra edge." Reuses bankroll.ts's own promoMatchesBet (loose applies_to
 * text matching) so a promo's eligible-market logic can't quietly drift
 * between the stake-routing use (bankroll.ts) and this ranking use.
 */
export function rankPromoAcrossRecommendations(promo: Promo, candidates: PromoCandidate[]): RankedPromoUse[] {
  const results: RankedPromoUse[] = []
  for (const c of candidates) {
    if (promo.sportsbook !== 'draftkings' && promo.sportsbook !== 'fanduel') continue
    if (c.sportsbook !== null && c.sportsbook !== promo.sportsbook) continue
    if (c.marketOdds === null || c.modelProb === null) continue

    const asAllocationCandidate: AllocationCandidate = {
      recommendationKey: String(c.recommendationId),
      tierN: 1,
      betCategory: c.betCategory,
      description: c.description,
      oddsByBook: { [promo.sportsbook]: c.marketOdds } as Partial<Record<Sportsbook, number>>,
    }
    if (!promoMatchesBet(promo, asAllocationCandidate)) continue

    const r = evaluatePromo({ promo, marketOdds: c.marketOdds, modelProb: c.modelProb, stake: c.stake })
    if (r.applicable) results.push({ ...r, candidate: c })
  }
  return results.sort((a, b) => b.extraEv - a.extraEv)
}
