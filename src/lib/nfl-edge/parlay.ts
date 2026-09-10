// ============================================================================
// NFL Edge Board — parlay builder
//
// HONEST SCOPE, READ BEFORE EXTENDING: this ranks and suggests parlay
// combinations from the SAME per-leg probabilities the rest of the board
// already computes and stores (nothing new is fabricated here) — real
// win probabilities for moneyline picks, the same normal-margin model
// re-centered on the market spread/total for ATS/Total picks
// (scoring.ts's atsProbSide/totProbSide), and the cross-book no-vig
// consensus (or single-book implied probability) for player props
// (props-scoring.ts's fairProb). combineParlayLegs (scoring.ts) does the
// actual math: it multiplies each leg's probability together assuming
// INDEPENDENCE between legs.
//
// That independence assumption is the one thing this file cannot make
// honest on its own, and it matters most for same-game parlays: a QB's
// passing yards Over and his team's Over on the game total are not
// independent bets — they tend to hit or miss together. Real sportsbooks
// price same-game parlays with a correlation adjustment; this doesn't,
// so a "by game" suggestion's shown probability/EV is optimistic and
// should be read as "here's a same-game combo the model likes each leg
// of individually," not "here's the true odds of hitting all of it."
// Every same-game suggestion is flagged `correlated: true` for exactly
// this reason. Cross-game suggestions ("by day"/"by week"/"by remaining
// games") pick at most one leg per game specifically to avoid this
// problem — different games are a much safer independence assumption,
// though even that isn't perfectly clean (weather affecting a whole
// Sunday slate, e.g.) — just far more defensible than same-game legs.
// ============================================================================

import { combineParlayLegs, type ParlayLeg, type ParlayResult, type Tier } from './scoring'
import type { BetCategory, Sportsbook } from './types'

export interface ScoredLeg extends ParlayLeg {
  recommendationId: number
  betCategory: BetCategory
  tier: Tier
  tierN: 1 | 2 | 3
  modelScore: number
  sportsbook: Sportsbook | null
  description: string
  side: string
}

export interface GameMeta {
  gameId: string
  label: string
  gameTimeIso: string
}

export interface ParlaySuggestion {
  legs: ScoredLeg[]
  result: ParlayResult
}

export interface ParlayBucket {
  key: string
  label: string
  correlated: boolean
  suggestions: ParlaySuggestion[]
}

export type ParlayView = 'game' | 'day' | 'week' | 'remaining'

export interface BuildParlayOptions {
  includeProps: boolean
  /** Legs with tierN <= maxTierN qualify. 1 = Elite only, 2 = Elite+Strong, 3 = everything (Elite+Strong+Lean — 'pass' tier rows never exist in bet_recommendations). */
  maxTierN: 1 | 2 | 3
  /** How many legs per combo to try, e.g. [2, 3]. */
  legSizes: number[]
  /** How many ranked suggestions to keep per bucket. */
  topN: number
  /** Cap on how many candidate legs feed the combinatorics per bucket, to keep this fast. Ranked by model_score before capping. */
  poolCap: number
}

export const DEFAULT_PARLAY_OPTIONS: BuildParlayOptions = {
  includeProps: true,
  maxTierN: 3,
  legSizes: [2, 3],
  topN: 5,
  poolCap: 12,
}

const TIER_N: Record<string, 1 | 2 | 3> = { elite: 1, strong: 2, lean: 3 }

/** Raw shape this expects from a `bet_recommendations` row (plus the game's own kickoff time, joined separately). */
export interface RawRecommendation {
  id: number
  game_id: string | null
  bet_category: BetCategory
  description: string
  side: string
  model_score: number
  tier: string
  model_prob: number | null
  odds: number | null
  recommended_sportsbook: string | null
}

/**
 * Converts a raw `bet_recommendations` row into a parlay leg. Returns null
 * when the row is missing what real parlay math needs — a probability and
 * a price — rather than guessing either. This is common right now for
 * older rows generated before odds/model_prob were captured for every
 * category; recompute the week to backfill them.
 */
export function toScoredLeg(rec: RawRecommendation): ScoredLeg | null {
  if (rec.game_id === null) return null
  if (rec.model_prob === null || rec.odds === null) return null
  const tierN = TIER_N[rec.tier]
  if (!tierN) return null
  return {
    gameId: rec.game_id,
    label: rec.description,
    trueProb: rec.model_prob,
    bookOddsAmerican: rec.odds,
    recommendationId: rec.id,
    betCategory: rec.bet_category,
    tier: rec.tier as Tier,
    tierN,
    modelScore: rec.model_score,
    sportsbook: (rec.recommended_sportsbook as Sportsbook | null) ?? null,
    description: rec.description,
    side: rec.side,
  }
}

function kCombinations<T>(items: T[], k: number): T[][] {
  if (k <= 0 || k > items.length) return []
  const results: T[][] = []
  const combo: T[] = []
  function recurse(start: number) {
    if (combo.length === k) {
      results.push(combo.slice())
      return
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i])
      recurse(i + 1)
      combo.pop()
    }
  }
  recurse(0)
  return results
}

/** For cross-game buckets: at most one leg per game, the best-scoring one, so every combo drawn from the result is automatically cross-game (no correlated same-game legs sneaking in). */
export function bestLegPerGame(legs: ScoredLeg[]): ScoredLeg[] {
  const byGame = new Map<string, ScoredLeg>()
  for (const leg of legs) {
    const existing = byGame.get(leg.gameId)
    if (!existing || leg.modelScore > existing.modelScore) byGame.set(leg.gameId, leg)
  }
  return Array.from(byGame.values())
}

function filterLegs(legs: ScoredLeg[], opts: BuildParlayOptions): ScoredLeg[] {
  return legs.filter((l) => {
    if (!opts.includeProps && l.betCategory === 'player_prop') return false
    if (l.tierN > opts.maxTierN) return false
    return true
  })
}

/** Builds ranked parlay suggestions from one pool of legs (already the right set — same-game pool, or a best-leg-per-game cross-game pool). */
export function buildSuggestionsFromPool(pool: ScoredLeg[], opts: BuildParlayOptions): ParlaySuggestion[] {
  const capped = pool
    .slice()
    .sort((a, b) => b.modelScore - a.modelScore)
    .slice(0, opts.poolCap)

  const all: ParlaySuggestion[] = []
  for (const size of opts.legSizes) {
    for (const combo of kCombinations(capped, size)) {
      const result = combineParlayLegs(combo)
      if (result.evPct === null) continue // missing a price somewhere in the combo — shouldn't happen given toScoredLeg's guard, but skip rather than show a broken number
      all.push({ legs: combo, result })
    }
  }

  // Fallback: legSizes defaults to [2, 3], so a bucket that can only ever
  // hold ONE qualifying leg — a standalone Thursday/Monday-nighter that's
  // the lone game on its calendar day, or a game with just one qualifying
  // pick in the "by game" view — produced zero combos above and used to
  // vanish from the page entirely, with no indication the pick even
  // existed. Surface it as a straight/single bet instead: this is exactly
  // the "single... action" half of what the project brief asks for, not
  // just parlays.
  if (all.length === 0 && capped.length > 0) {
    for (const combo of kCombinations(capped, 1)) {
      const result = combineParlayLegs(combo)
      if (result.evPct === null) continue
      all.push({ legs: combo, result })
    }
  }

  all.sort((a, b) => {
    const evA = a.result.evPct ?? -Infinity
    const evB = b.result.evPct ?? -Infinity
    if (evB !== evA) return evB - evA
    return b.result.combinedProb - a.result.combinedProb
  })

  return all.slice(0, opts.topN)
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Groups a week's qualifying legs into "by game" / "by day" / "by week" /
 * "by remaining games" buckets and ranks parlay suggestions within each,
 * per the view requested. `games` gives each game's own label + kickoff
 * time (needed for day-grouping and the remaining-games filter).
 */
export function buildParlayView(
  allLegs: ScoredLeg[],
  games: Map<string, GameMeta>,
  view: ParlayView,
  opts: BuildParlayOptions = DEFAULT_PARLAY_OPTIONS,
  now: number = Date.now()
): ParlayBucket[] {
  const legs = filterLegs(allLegs, opts)

  if (view === 'game') {
    const byGame = new Map<string, ScoredLeg[]>()
    for (const leg of legs) {
      const list = byGame.get(leg.gameId) ?? []
      list.push(leg)
      byGame.set(leg.gameId, list)
    }
    const buckets: ParlayBucket[] = []
    for (const [gameId, gameLegs] of Array.from(byGame.entries())) {
      const suggestions = buildSuggestionsFromPool(gameLegs, opts)
      if (suggestions.length === 0) continue
      buckets.push({
        key: gameId,
        label: games.get(gameId)?.label ?? gameId,
        correlated: suggestions.some((s) => s.result.legs > 1),
        suggestions,
      })
    }
    // Games with a kickoff time first, most legs (most to work with) as a tiebreak.
    buckets.sort((a, b) => {
      const ta = games.get(a.key)?.gameTimeIso ?? ''
      const tb = games.get(b.key)?.gameTimeIso ?? ''
      return ta.localeCompare(tb)
    })
    return buckets
  }

  // Cross-game views: reduce to one (best) leg per game first so every
  // combo built below is automatically correlation-safe.
  const reduced = bestLegPerGame(legs)

  if (view === 'week') {
    const suggestions = buildSuggestionsFromPool(reduced, { ...opts, poolCap: Math.max(opts.poolCap, 16) })
    return suggestions.length > 0 ? [{ key: 'week', label: 'Full week', correlated: false, suggestions }] : []
  }

  if (view === 'remaining') {
    const upcoming = reduced.filter((l) => {
      const meta = games.get(l.gameId)
      return meta ? new Date(meta.gameTimeIso).getTime() > now : false
    })
    const suggestions = buildSuggestionsFromPool(upcoming, { ...opts, poolCap: Math.max(opts.poolCap, 16) })
    return suggestions.length > 0
      ? [{ key: 'remaining', label: 'Remaining games this week', correlated: false, suggestions }]
      : []
  }

  // view === 'day'
  const byDay = new Map<string, { label: string; legs: ScoredLeg[] }>()
  for (const leg of reduced) {
    const meta = games.get(leg.gameId)
    if (!meta) continue
    const key = dayKey(meta.gameTimeIso)
    const entry = byDay.get(key) ?? { label: dayLabel(meta.gameTimeIso), legs: [] }
    entry.legs.push(leg)
    byDay.set(key, entry)
  }
  const buckets: ParlayBucket[] = []
  for (const [key, entry] of Array.from(byDay.entries())) {
    const suggestions = buildSuggestionsFromPool(entry.legs, opts)
    if (suggestions.length === 0) continue
    buckets.push({ key, label: entry.label, correlated: false, suggestions })
  }
  buckets.sort((a, b) => a.key.localeCompare(b.key))
  return buckets
}
