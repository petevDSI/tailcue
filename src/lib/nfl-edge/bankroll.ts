// ============================================================================
// NFL Edge Board — bankroll allocator
//
// Splits two live, simultaneous bankrolls (DraftKings + FanDuel) across the
// week's qualifying recommendations (tier !== 'pass'), sized by the same
// flat-unit guidance as the scoring engine's footer disclaimer: 0.5-2% of
// bankroll per play, scaled by tier. Promo-aware: an active boost/bonus on
// one book nudges a bet toward that book when it plausibly applies.
//
// This is intentionally simple and transparent — it is not a Kelly-criterion
// or portfolio optimizer. Real money is involved; a staking plan Pete can
// read and second-guess at a glance is more valuable here than a "smarter"
// black box.
// ============================================================================

import { unitsFor } from './scoring'
import type { Promo, Sportsbook } from './types'

export interface AllocationCandidate {
  recommendationKey: string // caller's own id, e.g. bet_recommendations.id once inserted, or a temp key pre-insert
  tierN: 1 | 2 | 3 | 4
  betCategory: string
  description: string
  /** American odds at each book, when known from manual entry. Null = unknown/not priced yet. */
  oddsByBook: Partial<Record<Sportsbook, number>>
}

export interface Allocation {
  recommendationKey: string
  sportsbook: Sportsbook
  stake: number
  promoId: number | null
  reason: string
}

export interface AllocatorInput {
  bankrolls: Record<'draftkings' | 'fanduel', number>
  candidates: AllocationCandidate[]
  activePromos: Promo[]
}

const UNIT_PCT = 0.01 // 1 "unit" (scoring.unitsFor) = 1% of that book's bankroll

/**
 * Does this promo plausibly help this bet? Text-matching against
 * `applies_to` is deliberately loose (it's a free-text field Pete fills in
 * from the promo's terms) — false positives just mean a bet that could have
 * gone to either book anyway got a mild nudge, not a real mis-stake.
 */
function promoMatchesBet(promo: Promo, candidate: AllocationCandidate): boolean {
  if (!promo.is_active) return false
  const now = Date.now()
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) return false
  if (promo.ends_at && new Date(promo.ends_at).getTime() < now) return false
  if (!promo.applies_to) return true // generic sitewide promo (e.g. site-wide odds boost token)

  const hay = promo.applies_to.toLowerCase()
  const cat = candidate.betCategory.toLowerCase()
  if (cat === 'game_total' && hay.includes('total')) return true
  if (cat === 'game_ats' && (hay.includes('spread') || hay.includes('ats'))) return true
  if (cat === 'game_su' && (hay.includes('moneyline') || hay.includes('ml') || hay.includes('any nfl'))) return true
  if (cat === 'player_prop' && (hay.includes('prop') || hay.includes('touchdown') || hay.includes('td'))) return true
  return false
}

export function allocateBankroll(input: AllocatorInput): Allocation[] {
  const { bankrolls, candidates, activePromos } = input
  const qualifying = candidates.filter((c) => c.tierN < 4)
  if (qualifying.length === 0) return []

  // 1. Base stake per candidate, per book bankroll, before any promo nudge.
  type Draft = { candidate: AllocationCandidate; book: Sportsbook; stake: number; promo: Promo | null }
  const drafts: Draft[] = []

  for (const candidate of qualifying) {
    const unitPct = unitsFor(candidate.tierN) * UNIT_PCT

    // Which book(s) actually have a price for this bet?
    const pricedBooks = (Object.keys(candidate.oddsByBook) as Sportsbook[]).filter(
      (b) => b === 'draftkings' || b === 'fanduel'
    )
    const booksToConsider: ('draftkings' | 'fanduel')[] =
      pricedBooks.length > 0 ? (pricedBooks as ('draftkings' | 'fanduel')[]) : ['draftkings', 'fanduel']

    // Does an active promo favor one of them for this bet?
    const promoHits = activePromos.filter(
      (p) => (p.sportsbook === 'draftkings' || p.sportsbook === 'fanduel') && promoMatchesBet(p, candidate)
    )

    let chosenBook: 'draftkings' | 'fanduel'
    let chosenPromo: Promo | null = null

    if (promoHits.length > 0) {
      // Prefer the promo'd book if it's actually one we can bet this on.
      const hit = promoHits.find((p) => booksToConsider.includes(p.sportsbook as 'draftkings' | 'fanduel'))
      if (hit) {
        chosenBook = hit.sportsbook as 'draftkings' | 'fanduel'
        chosenPromo = hit
      } else {
        chosenBook = pickByPrice(candidate, booksToConsider)
      }
    } else if (pricedBooks.length === 1) {
      chosenBook = pricedBooks[0] as 'draftkings' | 'fanduel'
    } else if (pricedBooks.length === 2) {
      chosenBook = pickByPrice(candidate, booksToConsider)
    } else {
      // No prices entered yet for either book — split by whichever bankroll has more room; tie → draftkings.
      chosenBook = bankrolls.fanduel > bankrolls.draftkings ? 'fanduel' : 'draftkings'
    }

    const stake = Math.round(bankrolls[chosenBook] * unitPct * 100) / 100
    drafts.push({ candidate, book: chosenBook, stake, promo: chosenPromo })
  }

  // 2. Normalize so no book's total stake exceeds its own bankroll — scale
  //    that book's stakes down proportionally if the week's slate asks for
  //    more than 100% of it (should be rare: tiers cap at 2%/play, but a
  //    heavy week with many Elite plays could still stack past 100%).
  for (const book of ['draftkings', 'fanduel'] as const) {
    const mine = drafts.filter((d) => d.book === book)
    const total = mine.reduce((sum, d) => sum + d.stake, 0)
    if (total > bankrolls[book] && total > 0) {
      const scale = bankrolls[book] / total
      for (const d of mine) d.stake = Math.round(d.stake * scale * 100) / 100
    }
  }

  return drafts.map((d) => ({
    recommendationKey: d.candidate.recommendationKey,
    sportsbook: d.book,
    stake: d.stake,
    promoId: d.promo?.id ?? null,
    reason: d.promo
      ? `${unitsFor(d.candidate.tierN)}u sized off ${d.book} bankroll, routed here for "${d.promo.title}"`
      : `${unitsFor(d.candidate.tierN)}u sized off ${d.book} bankroll (best price / most room)`,
  }))
}

function pickByPrice(candidate: AllocationCandidate, books: ('draftkings' | 'fanduel')[]): 'draftkings' | 'fanduel' {
  if (books.length === 1) return books[0]
  const dk = candidate.oddsByBook.draftkings
  const fd = candidate.oddsByBook.fanduel
  if (dk === undefined && fd === undefined) return 'draftkings'
  if (dk === undefined) return 'fanduel'
  if (fd === undefined) return 'draftkings'
  // Better price = pays more for the same side. For positive American odds,
  // higher is better; for negative, closer to zero is better. Comparing the
  // decimal-odds equivalent handles both without branching on sign.
  const dkDecimal = dk > 0 ? 1 + dk / 100 : 1 + 100 / -dk
  const fdDecimal = fd > 0 ? 1 + fd / 100 : 1 + 100 / -fd
  return dkDecimal >= fdDecimal ? 'draftkings' : 'fanduel'
}
