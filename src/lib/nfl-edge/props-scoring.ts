// ============================================================================
// NFL Edge Board — player prop scoring
//
// HONEST SCOPE, READ BEFORE EXTENDING: this scores props using only the data
// that actually exists in this schema today — no fabricated matchup or
// history factors. Concretely, three real signals:
//
//  1. Cross-book no-vig price disagreement. When DraftKings and FanDuel both
//     price the exact same line, each book's own two-sided price implies a
//     "fair" (vig-removed) probability. Averaging the two books' fair
//     probabilities gives a consensus; if either book's actual price is
//     better than that consensus, that's a real, standard line-shopping
//     edge — no history required. When the books disagree on the NUMBER
//     itself (not just the price), that's flagged as a smaller "shop this"
//     signal instead of a scored edge, since there's no single fair line to
//     compare against.
//  2. Game-script lean from the game's own market line. Each team's implied
//     point total (derived from the game's spread + total, same formula the
//     methodology doc uses) is a well-documented driver of skill-position
//     volume — a team implied for 30 throws/runs more than a team implied
//     for 16. Applied only to yardage/attempt/TD markets, not kicking or
//     defense.
//  3. Injury redistribution. A player's own OUT/DOUBTFUL tag disqualifies
//     their own props outright (can't respect a line for someone not
//     playing). A teammate's OUT/DOUBTFUL tag at a related position (WR/TE
//     out → other pass-catchers' receiving props; RB out → other backs'
//     rushing props) gets a modest volume bump — "next man up," not a
//     precise target-share model, since we don't have target-share data.
//
// What this deliberately does NOT claim to use, because the data doesn't
// exist in this schema yet: the player's own season/recent stats (no
// historical game logs — nflverse is the identified free source, not yet
// wired in), opponent defense-vs-position splits (same gap), weather
// (weather_snapshots is seeded but empty), and team pace/plays-per-game.
// Scores here are correspondingly conservative — most props with only one
// book's price and no game-script/injury signal will land in "Pass," which
// is the correct, honest outcome given what's actually known.
// ============================================================================

import { impliedProbFromAmerican } from './scoring'
import type { InjuryDesignation, PlayerProp } from './types'

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export interface BookProp {
  line: number
  overPrice: number | null
  underPrice: number | null
}

export interface MergedProp {
  gameId: string
  player: string
  market: string
  teamId: string | null
  dk?: BookProp
  fd?: BookProp
}

/**
 * Dedupe append-only player_props rows to the latest snapshot per (game,
 * player, market, book), then merge DK+FD onto one row per (game, player,
 * market). `rows` must already be sorted newest-first by captured_at.
 */
export function mergeLatestProps(rows: PlayerProp[]): Map<string, MergedProp> {
  const seen = new Set<string>()
  const merged = new Map<string, MergedProp>()

  for (const p of rows) {
    const dedupeKey = `${p.game_id}|${p.player_name}|${p.market}|${p.sportsbook}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const mergeKey = `${p.game_id}|${p.player_name}|${p.market}`
    const m: MergedProp = merged.get(mergeKey) ?? {
      gameId: p.game_id,
      player: p.player_name,
      market: p.market,
      teamId: p.team_id,
    }
    if (p.line !== null) {
      const book: BookProp = { line: Number(p.line), overPrice: p.over_price, underPrice: p.under_price }
      if (p.sportsbook === 'draftkings') m.dk = book
      if (p.sportsbook === 'fanduel') m.fd = book
    }
    merged.set(mergeKey, m)
  }
  return merged
}

export function groupPropsByGame(merged: Map<string, MergedProp>): Map<string, MergedProp[]> {
  const byGame = new Map<string, MergedProp[]>()
  for (const p of Array.from(merged.values())) {
    const list = byGame.get(p.gameId) ?? []
    list.push(p)
    byGame.set(p.gameId, list)
  }
  return byGame
}

// Markets where "more expected team scoring/volume" plausibly moves the
// number — used for the game-script lean. Deliberately excludes kicking,
// defense, and longest-play markets, which don't have a clean documented
// directional relationship to implied team total.
const VOLUME_MARKETS = new Set([
  'passing_yards',
  'passing_attempts',
  'passing_completions',
  'rushing_yards',
  'rushing_attempts',
  'receiving_yards',
  'receiving_receptions',
  'passing+rushing_yards',
  'rushing+receiving_yards',
])
const TD_MARKETS = new Set(['passing_touchdowns', 'receiving_touchdowns', 'rushing_touchdowns', 'touchdowns'])
const GAME_SCRIPT_MARKETS = new Set([...Array.from(VOLUME_MARKETS), ...Array.from(TD_MARKETS)])

const RECEIVING_MARKETS = new Set(['receiving_yards', 'receiving_receptions'])
const RUSHING_MARKETS = new Set(['rushing_yards', 'rushing_attempts'])

export interface TeammateInjuryBoosts {
  /** A teammate WR/TE is out or doubtful — bump this player's receiving props. */
  receiving: boolean
  /** A teammate RB is out or doubtful — bump this player's rushing props. */
  rushing: boolean
}

/** Rolls one game's injury rows into a per-team map of redistribution boosts. */
export function deriveTeammateInjuryBoosts(
  gameInjuries: { team_id: string; position: string | null; designation: InjuryDesignation }[]
): Map<string, TeammateInjuryBoosts> {
  const byTeam = new Map<string, TeammateInjuryBoosts>()
  for (const inj of gameInjuries) {
    if (inj.designation !== 'out' && inj.designation !== 'doubtful') continue
    const cur = byTeam.get(inj.team_id) ?? { receiving: false, rushing: false }
    if (inj.position === 'WR' || inj.position === 'TE') cur.receiving = true
    if (inj.position === 'RB') cur.rushing = true
    byTeam.set(inj.team_id, cur)
  }
  return byTeam
}

export interface PropCandidate {
  gameId: string
  player: string
  market: string
  side: 'Over' | 'Under'
  line: number
  score: number
  dkPrice: number | null
  fdPrice: number | null
  notes: string[]
}

export interface ScorePropInput {
  merged: MergedProp
  /** This player's own team's implied point total for this game, derived from spread + total. Null if no market line yet. */
  teamImpliedTotal: number | null
  leagueAvgTeamTotal: number
  /** This exact player's own injury designation this week, if any. */
  ownDesignation: InjuryDesignation
  teammateBoosts: TeammateInjuryBoosts
}

function noVigFairOver(overPrice: number | null, underPrice: number | null): number | null {
  const io = impliedProbFromAmerican(overPrice)
  const iu = impliedProbFromAmerican(underPrice)
  if (io === null || iu === null || io + iu <= 0) return null
  return io / (io + iu)
}

/**
 * Scores one player-prop line and returns which side (if either) is worth
 * surfacing. Returns null when the player is themselves OUT/DOUBTFUL (can't
 * bet a line for someone not playing) or when neither book has a price.
 */
export function scoreProp(input: ScorePropInput): PropCandidate | null {
  const { merged, teamImpliedTotal, leagueAvgTeamTotal, ownDesignation, teammateBoosts } = input
  const { dk, fd } = merged
  if (!dk && !fd) return null
  if (ownDesignation === 'out' || ownDesignation === 'doubtful') return null

  const notes: string[] = []
  let priceScoreOver = 0
  let priceScoreUnder = 0

  const dkFairOver = dk ? noVigFairOver(dk.overPrice, dk.underPrice) : null
  const fdFairOver = fd ? noVigFairOver(fd.overPrice, fd.underPrice) : null

  if (dk && fd && dk.line === fd.line && dkFairOver !== null && fdFairOver !== null) {
    const consensusFairOver = (dkFairOver + fdFairOver) / 2
    const bestOverPrice = Math.max(dk.overPrice ?? -Infinity, fd.overPrice ?? -Infinity)
    const bestUnderPrice = Math.max(dk.underPrice ?? -Infinity, fd.underPrice ?? -Infinity)
    const bestOverImplied = impliedProbFromAmerican(Number.isFinite(bestOverPrice) ? bestOverPrice : null)
    const bestUnderImplied = impliedProbFromAmerican(Number.isFinite(bestUnderPrice) ? bestUnderPrice : null)

    if (bestOverImplied !== null) {
      priceScoreOver = clamp((consensusFairOver - bestOverImplied) * 100, 0, 12) * 2
    }
    if (bestUnderImplied !== null) {
      priceScoreUnder = clamp((1 - consensusFairOver - bestUnderImplied) * 100, 0, 12) * 2
    }
    if (priceScoreOver > 4 || priceScoreUnder > 4) {
      notes.push('DraftKings/FanDuel price disagreement on the same line — real line-shopping edge')
    }
  } else if (dk && fd && dk.line !== fd.line) {
    notes.push(`Books disagree on the number (DK ${dk.line} vs FD ${fd.line}) — shop the line, no single fair price to size against`)
    priceScoreOver = 3
    priceScoreUnder = 3
  } else {
    notes.push('Only one book prices this line — no cross-book signal available')
  }

  let scriptScoreOver = 0
  let scriptScoreUnder = 0
  if (GAME_SCRIPT_MARKETS.has(merged.market) && teamImpliedTotal !== null) {
    const diff = teamImpliedTotal - leagueAvgTeamTotal
    const bonus = clamp(Math.abs(diff), 0, 8) * 1.5
    if (diff > 1) {
      scriptScoreOver += bonus
      notes.push(`Team implied for ${teamImpliedTotal.toFixed(1)} pts this game — plus game script`)
    } else if (diff < -1) {
      scriptScoreUnder += bonus
      notes.push(`Team implied for only ${teamImpliedTotal.toFixed(1)} pts this game — minus game script`)
    }
  }

  let injuryScoreOver = 0
  if (teammateBoosts.receiving && RECEIVING_MARKETS.has(merged.market)) {
    injuryScoreOver += 6
    notes.push('A teammate WR/TE is out/doubtful — likely more targets here')
  }
  if (teammateBoosts.rushing && RUSHING_MARKETS.has(merged.market)) {
    injuryScoreOver += 6
    notes.push('A teammate RB is out/doubtful — likely more carries here')
  }
  if (ownDesignation === 'questionable') {
    injuryScoreOver -= 4
    notes.push(`${merged.player} is Questionable — availability risk`)
  }

  const totalOver = 50 + priceScoreOver + scriptScoreOver + injuryScoreOver
  const totalUnder = 50 + priceScoreUnder + scriptScoreUnder
  const side: 'Over' | 'Under' = totalOver >= totalUnder ? 'Over' : 'Under'
  const score = clamp(side === 'Over' ? totalOver : totalUnder, 0, 100)
  const line = (dk ?? fd)!.line

  return {
    gameId: merged.gameId,
    player: merged.player,
    market: merged.market,
    side,
    line,
    score,
    dkPrice: dk ? (side === 'Over' ? dk.overPrice : dk.underPrice) : null,
    fdPrice: fd ? (side === 'Over' ? fd.overPrice : fd.underPrice) : null,
    notes,
  }
}
