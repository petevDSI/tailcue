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
import { scoreGame, tierOf, atsTierOf, deriveTeamInjuryImpact, deriveRestCode, DEFAULT_SETTINGS } from './scoring'
import { deriveSandwichRisk, type ScheduleGameRef } from './schedule-context'
import { allocateBankroll, type AllocationCandidate } from './bankroll'
import { mergeLatestProps, deriveTeammateInjuryBoosts, scoreProp } from './props-scoring'
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

  // Ordered ascending so that, when a team has ratings snapshots from more
  // than one as_of_week (e.g. week 1 and week 3), the later one wins in the
  // Map below — Supabase doesn't guarantee row order without an explicit
  // .order(), and this bug would otherwise silently pick an arbitrary
  // snapshot once sync-power-ratings.ts has been run more than once.
  const { data: ratings } = await db
    .from('team_ratings')
    .select('team_id, off_rating, def_rating, as_of_week')
    .eq('season_year', seasonYear)
    .lte('as_of_week', week)
    .order('as_of_week', { ascending: true })
  const latestRating = new Map<string, { off: number; def: number }>()
  for (const r of ratings ?? []) {
    latestRating.set(r.team_id, { off: r.off_rating, def: r.def_rating })
  }

  const { data: weather } = await db.from('weather_snapshots').select('game_id, wind_mph, temp_f, is_dome_or_indoor')
  const weatherByGame = new Map<string, any>((weather ?? []).map((w: any) => [w.game_id, w]))

  // Sandwich/lookahead detection needs each team's FULL-SEASON schedule
  // (272 games, cheap to pull in one go) — "next game" and "previous game"
  // for a team usually fall outside the week actually being scored.
  const { data: seasonGames } = await db
    .from('games')
    .select('id, game_time, is_divisional, home_team_id, away_team_id')
    .eq('season_year', seasonYear)
    .order('game_time', { ascending: true })

  interface TeamScheduleEntry extends ScheduleGameRef {
    gameId: string
  }
  const gamesByTeam = new Map<string, TeamScheduleEntry[]>()
  for (const g of (seasonGames ?? []) as any[]) {
    const entry: TeamScheduleEntry = { gameId: g.id, isDivisional: g.is_divisional, gameTime: g.game_time }
    for (const teamId of [g.home_team_id, g.away_team_id]) {
      const list = gamesByTeam.get(teamId) ?? []
      list.push(entry)
      gamesByTeam.set(teamId, list)
    }
  }
  for (const list of Array.from(gamesByTeam.values())) {
    list.sort((a, b) => new Date(a.gameTime).getTime() - new Date(b.gameTime).getTime())
  }
  function adjacentGames(teamId: string, gameId: string): { prev: ScheduleGameRef | null; next: ScheduleGameRef | null } {
    const list = gamesByTeam.get(teamId) ?? []
    const idx = list.findIndex((g) => g.gameId === gameId)
    if (idx === -1) return { prev: null, next: null }
    return { prev: list[idx - 1] ?? null, next: list[idx + 1] ?? null }
  }

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

  const gameIds = (games as any[]).map((g) => g.id)
  const propRows: any[] = []
  {
    const PAGE_SIZE = 1000
    let from = 0
    while (true) {
      const { data: page, error: propsErr } = await db
        .from('player_props')
        .select('game_id, sportsbook, player_name, team_id, market, line, over_price, under_price, captured_at')
        .in('game_id', gameIds)
        .order('captured_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
      if (propsErr) throw propsErr
      propRows.push(...(page ?? []))
      if (!page || page.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }
  const mergedProps = mergeLatestProps(propRows)

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
    const teammateBoostsByTeam = deriveTeammateInjuryBoosts(gameInjuries)

    const homeRating = latestRating.get(game.home_team_id) ?? { off: 0, def: 0 }
    const awayRating = latestRating.get(game.away_team_id) ?? { off: 0, def: 0 }

    const w = weatherByGame.get(game.id)

    const thisGameRef: ScheduleGameRef = { isDivisional: game.is_divisional, gameTime: game.game_time }
    const { prev: homePrev, next: homeNext } = adjacentGames(game.home_team_id, game.id)
    const { prev: awayPrev, next: awayNext } = adjacentGames(game.away_team_id, game.id)
    const homeSandwich = deriveSandwichRisk(thisGameRef, homePrev, homeNext)
    const awaySandwich = deriveSandwichRisk(thisGameRef, awayPrev, awayNext)

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
        homeSandwichRisk: homeSandwich.lookaheadRisk || homeSandwich.hangoverRisk,
        awaySandwichRisk: awaySandwich.lookaheadRisk || awaySandwich.hangoverRisk,
        windMph: w?.wind_mph ?? 0,
        tempF: w?.temp_f ?? null,
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
      const atsTier = atsTierOf(result.atsScore)
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
          modelProb: result.atsProbSide,
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
          modelProb: result.totProbSide,
          modelEdge: result.totalEdge,
          oddsByBook: { draftkings: STANDARD_JUICE, fanduel: STANDARD_JUICE },
        })
      }
    }

    // ---- player props for this game (see props-scoring.ts for the honest
    // scope of what this can and can't claim to know) ----
    const homeSpread = currentRow?.home_spread ?? null
    const gameTotal = currentRow?.total ?? null
    const homeImplied = homeSpread !== null && gameTotal !== null ? (gameTotal - homeSpread) / 2 : null
    const awayImplied = homeSpread !== null && gameTotal !== null ? (gameTotal + homeSpread) / 2 : null

    for (const merged of Array.from(mergedProps.values())) {
      if (merged.gameId !== game.id) continue
      const ownInjury = gameInjuries.find(
        (i: any) => i.team_id === merged.teamId && i.player_name.toLowerCase() === merged.player.toLowerCase()
      )
      const teamImpliedTotal =
        merged.teamId === game.home_team_id ? homeImplied : merged.teamId === game.away_team_id ? awayImplied : null

      const propResult = scoreProp({
        merged,
        teamImpliedTotal,
        leagueAvgTeamTotal: DEFAULT_SETTINGS.leagueAvg,
        ownDesignation: ownInjury?.designation ?? null,
        teammateBoosts: teammateBoostsByTeam.get(merged.teamId ?? '') ?? { receiving: false, rushing: false },
      })
      if (!propResult) continue

      const propTier = tierOf(propResult.score)
      if (propTier.n >= 4) continue

      candidates.push({
        recommendationKey: `${game.id}:prop:${merged.player}:${merged.market}`,
        gameId: game.id,
        tierN: propTier.n,
        tier: propTier.tier,
        betCategory: 'player_prop',
        description: `${merged.player} — ${merged.market.replace(/_/g, ' ')} ${propResult.side} ${propResult.line}`,
        side: propResult.side,
        modelScore: propResult.score,
        modelProb: propResult.fairProb,
        modelEdge: null,
        oddsByBook: {
          ...(propResult.dkPrice !== null ? { draftkings: propResult.dkPrice } : {}),
          ...(propResult.fdPrice !== null ? { fanduel: propResult.fdPrice } : {}),
        },
      })
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
    // Real price for this pick, for parlay math later — whichever book got
    // the stake, else whichever book actually has a price (moneyline for
    // game_su, standard -110 juice for game_ats/game_total since no
    // distinct spread/total juice feed exists, actual DK/FD price for
    // player_prop).
    const priceBook = (alloc?.sportsbook as Sportsbook | undefined) ?? (c.oddsByBook.draftkings !== undefined ? 'draftkings' : 'fanduel')
    const odds = c.oddsByBook[priceBook] ?? c.oddsByBook.draftkings ?? c.oddsByBook.fanduel ?? null
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
      odds: odds ?? null,
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
