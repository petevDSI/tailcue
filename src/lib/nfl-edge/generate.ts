// ============================================================================
// NFL Edge Board — weekly recommendation generator (shared core)
//
// Pulled out of scripts/nfl-edge/generate-recommendations.ts so the exact
// same logic runs from the CLI script AND from the dashboard's "Recompute"
// button (src/app/api/admin/nfl-edge/recompute/route.ts) — one
// implementation, two entry points.
//
// KNOWN GAP: nfl_edge.team_ratings has no rows yet — there's no free,
// verified EPA/power-rating feed wired in (nflverse was the plan; not built
// yet). Every team defaults to 0/0 (league average) until that's in place,
// so the model currently leans on market lines + injuries + line
// movement/RLM far more than on team strength.
// ============================================================================

import { nflEdgeDb } from './supabase-admin'
import { scoreGame, tierOf, deriveTeamInjuryImpact, deriveRestCode, DEFAULT_SETTINGS } from './scoring'
import { allocateBankroll, type AllocationCandidate } from './bankroll'
import type { Sportsbook } from './types'

const STANDARD_JUICE = -110

export interface GenerateResult {
  seasonYear: number
  week: number
  gameCount: number
  recommendationCount: number
}

export async function generateRecommendationsForWeek(seasonYear: number, week: number): Promise<GenerateResult> {
  const db = nflEdgeDb()

  const { data: games, error: gamesErr } = await db
    .from('games')
    .select(
      'id, home_team_id, away_team_id, game_time, is_divisional, home_team:home_team_id(name,is_dome), away_team:away_team_id(name)'
    )
    .eq('season_year', seasonYear)
    .eq('week_number', week)
  if (gamesErr) throw gamesErr
  if (!games || games.length === 0) {
    return { seasonYear, week, gameCount: 0, recommendationCount: 0 }
  }

  const { data: ratings } = await db
    .from('team_ratings')
    .select('team_id, off_rating, def_rating, as_of_week')
    .eq('season_year', seasonYear)
    .lte('as_of_week', week)
  const latestRating = new Map<string, { off: number; def: number }>()
  for (const r of ratings ?? []) {
    latestRating.set(r.team_id, { off: r.off_rating, def: r.def_rating })
  }

  const { data: weather } = await db.from('weather_snapshots').select('game_id, wind_mph, is_dome_or_indoor')
  const weatherByGame = new Map<string, any>((weather ?? []).map((w: any) => [w.game_id, w]))

  const { data: injuries } = await db
    .from('injuries')
    .select('game_id, team_id, player_name, position, designation, is_qb')
  const injuriesByGame = new Map<string, any[]>()
  for (const i of injuries ?? []) {
    const list = injuriesByGame.get(i.game_id) ?? []
    list.push(i)
    injuriesByGame.set(i.game_id, list)
  }

  const { data: marketLines } = await db
    .from('market_lines')
    .select('game_id, sportsbook, captured_at, home_spread, home_moneyline, away_moneyline, total')
  const linesByGame = new Map<string, any[]>()
  for (const l of marketLines ?? []) {
    const list = linesByGame.get(l.game_id) ?? []
    list.push(l)
    linesByGame.set(l.game_id, list)
  }

  const candidates: (AllocationCandidate & {
    gameId: string
    tier: 'elite' | 'strong' | 'lean' | 'pass'
    modelScore: number
    modelProb: number | null
    modelEdge: number | null
    description: string
    side: string
  })[] = []

  for (const game of games as any[]) {
    const lines = (linesByGame.get(game.id) ?? []).sort(
      (a: any, b: any) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
    )
    const dkLines = lines.filter((l: any) => l.sportsbook === 'draftkings')
    const fdLines = lines.filter((l: any) => l.sportsbook === 'fanduel')
    const openRow = lines[0] ?? null
    const currentRow = lines[lines.length - 1] ?? null

    const gameInjuries = injuriesByGame.get(game.id) ?? []
    const homeInj = deriveTeamInjuryImpact(gameInjuries, game.home_team_id)
    const awayInj = deriveTeamInjuryImpact(gameInjuries, game.away_team_id)

    const homeRating = latestRating.get(game.home_team_id) ?? { off: 0, def: 0 }
    const awayRating = latestRating.get(game.away_team_id) ?? { off: 0, def: 0 }

    const w = weatherByGame.get(game.id)

    const result = scoreGame(
      {
        homeOff: homeRating.off,
        homeDef: homeRating.def,
        awayOff: awayRating.off,
        awayDef: awayRating.def,
        homeRest: deriveRestCode(null, game.game_time),
        awayRest: deriveRestCode(null, game.game_time),
        homeInjuryPts: homeInj.points,
        awayInjuryPts: awayInj.points,
        homeQuestionableQb: homeInj.hasQuestionableQb,
        awayQuestionableQb: awayInj.hasQuestionableQb,
        isDivisional: game.is_divisional,
        windMph: w?.wind_mph ?? 0,
        isDome: w?.is_dome_or_indoor ?? game.home_team?.is_dome ?? false,
        marketSpreadHome: currentRow?.home_spread ?? null,
        openSpreadHome: openRow?.home_spread ?? null,
        marketTotal: currentRow?.total ?? null,
        publicHomePct: null,
        homeMoneyline: currentRow?.home_moneyline ?? null,
        awayMoneyline: currentRow?.away_moneyline ?? null,
      },
      DEFAULT_SETTINGS
    )

    const label = `${game.away_team?.name ?? 'Away'} @ ${game.home_team?.name ?? 'Home'}`

    const suTier = tierOf(result.suScore)
    if (suTier.n < 4) {
      const sideName = result.suSideIsHome ? game.home_team?.name : game.away_team?.name
      candidates.push({
        recommendationKey: `${game.id}:su`,
        gameId: game.id,
        tierN: suTier.n,
        tier: suTier.tier,
        betCategory: 'game_su',
        description: `${label} — ${sideName} ML`,
        side: sideName,
        modelScore: result.suScore,
        modelProb: result.suSideIsHome ? result.winProbHome : result.winProbAway,
        modelEdge: result.mlEdge,
        oddsByBook: {
          draftkings: result.suSideIsHome ? dkLines.at(-1)?.home_moneyline : dkLines.at(-1)?.away_moneyline,
          fanduel: result.suSideIsHome ? fdLines.at(-1)?.home_moneyline : fdLines.at(-1)?.away_moneyline,
        },
      })
    }

    if (result.atsScore !== null) {
      const atsTier = tierOf(result.atsScore)
      if (atsTier.n < 4) {
        const sideName = result.atsSideIsHome ? game.home_team?.name : game.away_team?.name
        const spreadForSide = result.atsSideIsHome ? currentRow?.home_spread : -currentRow?.home_spread
        candidates.push({
          recommendationKey: `${game.id}:ats`,
          gameId: game.id,
          tierN: atsTier.n,
          tier: atsTier.tier,
          betCategory: 'game_ats',
          description: `${label} — ${sideName} ${spreadForSide! >= 0 ? '+' : ''}${spreadForSide}`,
          side: sideName,
          modelScore: result.atsScore,
          modelProb: null,
          modelEdge: result.spreadEdgeHome,
          oddsByBook: { draftkings: STANDARD_JUICE, fanduel: STANDARD_JUICE },
        })
      }
    }

    if (result.totScore !== null) {
      const totTier = tierOf(result.totScore)
      if (totTier.n < 4) {
        const side = result.totSideIsOver ? 'Over' : 'Under'
        candidates.push({
          recommendationKey: `${game.id}:tot`,
          gameId: game.id,
          tierN: totTier.n,
          tier: totTier.tier,
          betCategory: 'game_total',
          description: `${label} — ${side} ${currentRow?.total ?? ''}`,
          side,
          modelScore: result.totScore,
          modelProb: null,
          modelEdge: result.totalEdge,
          oddsByBook: { draftkings: STANDARD_JUICE, fanduel: STANDARD_JUICE },
        })
      }
    }
  }

  const { data: accounts } = await db.from('sportsbook_accounts').select('sportsbook, bankroll')
  const bankrolls = { draftkings: 0, fanduel: 0 }
  for (const a of accounts ?? []) {
    if (a.sportsbook === 'draftkings' || a.sportsbook === 'fanduel')
      bankrolls[a.sportsbook as 'draftkings' | 'fanduel'] = a.bankroll
  }

  const { data: promos } = await db.from('promos').select('*').eq('is_active', true)

  const allocations = allocateBankroll({ bankrolls, candidates, activePromos: promos ?? [] })
  const allocByKey = new Map(allocations.map((a) => [a.recommendationKey, a]))

  await db.from('bet_recommendations').delete().eq('season_year', seasonYear).eq('week_number', week)

  const rows = candidates.map((c) => {
    const alloc = allocByKey.get(c.recommendationKey)
    return {
      season_year: seasonYear,
      week_number: week,
      game_id: c.gameId,
      bet_category: c.betCategory,
      description: c.description,
      side: c.side,
      model_score: c.modelScore,
      tier: c.tier,
      model_edge: c.modelEdge,
      model_prob: c.modelProb,
      recommended_sportsbook: (alloc?.sportsbook as Sportsbook) ?? null,
      recommended_stake: alloc?.stake ?? null,
      promo_id: alloc?.promoId ?? null,
      generated_at: new Date().toISOString(),
    }
  })

  if (rows.length > 0) {
    const { error: insErr } = await db.from('bet_recommendations').insert(rows)
    if (insErr) throw insErr
  }

  return { seasonYear, week, gameCount: games.length, recommendationCount: rows.length }
}
