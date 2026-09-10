// ============================================================================
// NFL Edge Board — Closing Line Value (CLV)
//
// CLV asks a narrower, more honest question than "did the pick win": did the
// number you bet get WORSE (from your side's perspective) by the time the
// market closed? If so, you beat the close — a well-documented predictor of
// long-run betting profitability that's independent of any single game's
// outcome (see the Sharp Football Analysis / VSiN sources already cited in
// this project's methodology doc).
//
// Needs at least two market_lines snapshots per game to mean anything: one
// near "bet time" (when the recommendation was generated) and one at or
// near kickoff (the closing number). market_lines is append-only by design
// specifically for this — every sync-market-lines.ts run adds a new
// snapshot rather than overwriting the last one. As of 2026-09-10 most
// games only have ONE snapshot on file (the first sync), so CLV numbers
// won't be meaningful until sync-market-lines.ts has been run more than
// once per game — ideally including one run shortly before each kickoff to
// capture a true closing number, not just "the latest number we happened
// to have."
//
// Scope: game-level bets only (ATS, total, straight-up/moneyline). Player
// props aren't covered here yet — matching a specific prop pick back to its
// own line's history needs its own join logic against player_props, not
// attempted in this first pass.
// ============================================================================

import { impliedProbFromAmerican } from './scoring'

export interface MarketSnapshot {
  capturedAt: string
  sportsbook: string
  homeSpread: number | null
  total: number | null
  homeMoneyline: number | null
  awayMoneyline: number | null
}

function ts(iso: string): number {
  return new Date(iso).getTime()
}

/**
 * Picks the snapshot at/just-before a target time, preferring
 * `preferredBook` (same book as the recommendation, so the comparison is
 * apples-to-apples). Falls back across books, and — if nothing was
 * captured before the target time (the bet predates our first sync) —
 * falls back to the earliest snapshot we do have.
 */
export function pickSnapshotAtOrBefore(
  snapshots: MarketSnapshot[],
  targetIso: string,
  preferredBook: string | null
): MarketSnapshot | null {
  const pool = preferredBook ? snapshots.filter((s) => s.sportsbook === preferredBook) : snapshots
  const usable = pool.length > 0 ? pool : snapshots
  if (usable.length === 0) return null
  const target = ts(targetIso)
  const before = usable.filter((s) => ts(s.capturedAt) <= target)
  if (before.length > 0) return before.reduce((a, b) => (ts(a.capturedAt) > ts(b.capturedAt) ? a : b))
  return usable.reduce((a, b) => (ts(a.capturedAt) < ts(b.capturedAt) ? a : b))
}

/**
 * The latest snapshot at/before kickoff — the true closing line once
 * kickoff has passed. Before kickoff there's no such thing as "closing"
 * yet, so this returns the latest number captured so far and flags
 * `isFinal: false` so the UI can label it "current" instead of "closing."
 */
export function pickClosingSnapshot(
  snapshots: MarketSnapshot[],
  kickoffIso: string,
  preferredBook: string | null
): { snapshot: MarketSnapshot | null; isFinal: boolean } {
  const pool = preferredBook ? snapshots.filter((s) => s.sportsbook === preferredBook) : snapshots
  const usable = pool.length > 0 ? pool : snapshots
  if (usable.length === 0) return { snapshot: null, isFinal: false }
  const kickoff = ts(kickoffIso)
  const now = Date.now()
  const beforeKickoff = usable.filter((s) => ts(s.capturedAt) <= kickoff)
  if (now >= kickoff && beforeKickoff.length > 0) {
    const closing = beforeKickoff.reduce((a, b) => (ts(a.capturedAt) > ts(b.capturedAt) ? a : b))
    return { snapshot: closing, isFinal: true }
  }
  const latest = usable.reduce((a, b) => (ts(a.capturedAt) > ts(b.capturedAt) ? a : b))
  return { snapshot: latest, isFinal: false }
}

export interface ClvOutcome {
  betValue: number | null
  closeValue: number | null
  /** Points (spread/total) or implied-probability points on a 0-100 scale (moneyline). Positive = beat the close. */
  clv: number | null
  isFinal: boolean
}

/** ATS CLV in points, from the picked side's perspective. */
export function computeAtsClv(
  betSnap: MarketSnapshot | null,
  closeInfo: { snapshot: MarketSnapshot | null; isFinal: boolean },
  sideIsHome: boolean
): ClvOutcome {
  const betValue = betSnap?.homeSpread ?? null
  const closeValue = closeInfo.snapshot?.homeSpread ?? null
  if (betValue === null || closeValue === null) return { betValue, closeValue, clv: null, isFinal: closeInfo.isFinal }
  return { betValue, closeValue, clv: (sideIsHome ? 1 : -1) * (betValue - closeValue), isFinal: closeInfo.isFinal }
}

/** Total CLV in points, from the picked side's perspective (Over wants the total to have been LOWER at bet time than at close). */
export function computeTotalClv(
  betSnap: MarketSnapshot | null,
  closeInfo: { snapshot: MarketSnapshot | null; isFinal: boolean },
  sideIsOver: boolean
): ClvOutcome {
  const betValue = betSnap?.total ?? null
  const closeValue = closeInfo.snapshot?.total ?? null
  if (betValue === null || closeValue === null) return { betValue, closeValue, clv: null, isFinal: closeInfo.isFinal }
  return { betValue, closeValue, clv: (sideIsOver ? 1 : -1) * (closeValue - betValue), isFinal: closeInfo.isFinal }
}

/** Moneyline CLV in implied-probability points (0-100 scale) for the picked side. Positive = the market moved toward your side after you bet it. */
export function computeMoneylineClv(
  betSnap: MarketSnapshot | null,
  closeInfo: { snapshot: MarketSnapshot | null; isFinal: boolean },
  sideIsHome: boolean
): ClvOutcome {
  const betOdds = betSnap ? (sideIsHome ? betSnap.homeMoneyline : betSnap.awayMoneyline) : null
  const closeOdds = closeInfo.snapshot ? (sideIsHome ? closeInfo.snapshot.homeMoneyline : closeInfo.snapshot.awayMoneyline) : null
  const betProb = impliedProbFromAmerican(betOdds ?? null)
  const closeProb = impliedProbFromAmerican(closeOdds ?? null)
  if (betProb === null || closeProb === null) {
    return { betValue: betOdds, closeValue: closeOdds, clv: null, isFinal: closeInfo.isFinal }
  }
  return { betValue: betOdds, closeValue: closeOdds, clv: (closeProb - betProb) * 100, isFinal: closeInfo.isFinal }
}
