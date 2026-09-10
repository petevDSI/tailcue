// ============================================================================
// NFL Edge Board — Top Bets
//
// One ranked list of the week's best straight bets, player props, and
// parlays together — the "what should I actually put money on" view, as
// opposed to the full Week page (every game, every tier, every raw prop
// line) or the Parlay Builder (every grouping/filter combo). Only Elite +
// Strong plays are shown here on purpose; Lean plays and the full raw prop
// list are still on the Week page for anyone who wants to dig further.
//
// Checking "I placed this" writes a row into nfl_edge.bets_placed (see
// actions.ts's toggleTrackSingleBet / toggleTrackParlay) using the price
// and stake this system already recommended — it does not let you edit
// the stake here; if a pick isn't priced yet (no market line entered, or
// the week hasn't been recomputed since a line changed), there's nothing
// honest to check off and the box doesn't show. Grading what happened
// lives on the separate Bet Tracker page (nav link above), and is always
// manual — see bet-tracker.ts's header comment for why.
//
// Top Parlays reuses the exact same parlay math as the Parlay Builder
// (src/lib/nfl-edge/parlay.ts) — specifically the "by week" cross-game
// view, since that's the one with the safest (most defensible)
// leg-independence assumption. A suggested flat stake (1 unit off the
// average of the two bankrolls) is shown for parlays since, unlike single
// bets, there's no bankroll.ts allocation for a multi-leg combo yet.
// ============================================================================
import Link from 'next/link'
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'
import { toScoredLeg, buildParlayView, DEFAULT_PARLAY_OPTIONS, type GameMeta, type ScoredLeg } from '@/lib/nfl-edge/parlay'
import { americanFromDecimal, americanLabel } from '@/lib/nfl-edge/scoring'
import { SortableBetList, type BetRow } from './_components/SortableBetList'
import { SortableParlayList, type ParlayRow } from './_components/SortableParlayList'

export const dynamic = 'force-dynamic'

function fmtStake(n: number): string {
  return `$${Math.round(n)}`
}

export default async function TopBetsPage({
  params,
  searchParams,
}: {
  params: { weekNumber: string }
  searchParams: { season?: string }
}) {
  const week = Number(params.weekNumber)
  const seasonYear = Number(searchParams.season) || new Date().getUTCFullYear()
  const db = nflEdgeDb()

  const { data: games } = await db
    .from('games')
    .select('id, game_time, home_team:home_team_id(name), away_team:away_team_id(name)')
    .eq('season_year', seasonYear)
    .eq('week_number', week)
    .order('game_time', { ascending: true })

  const { data: recs } = await db
    .from('bet_recommendations')
    .select('*')
    .eq('season_year', seasonYear)
    .eq('week_number', week)
    .order('model_score', { ascending: false })

  const { data: placed } = await db
    .from('bets_placed')
    .select('bet_type, recommendation_id, leg_recommendation_ids, result')
    .eq('season_year', seasonYear)
    .eq('week_number', week)

  const { data: accounts } = await db.from('sportsbook_accounts').select('sportsbook, bankroll')
  const dkBankroll = accounts?.find((a: any) => a.sportsbook === 'draftkings')?.bankroll ?? 0
  const fdBankroll = accounts?.find((a: any) => a.sportsbook === 'fanduel')?.bankroll ?? 0

  const trackedSingleIds = new Set(
    (placed ?? []).filter((p: any) => p.bet_type === 'single').map((p: any) => p.recommendation_id)
  )
  const trackedParlayKeys = new Set(
    (placed ?? [])
      .filter((p: any) => p.bet_type === 'parlay')
      .map((p: any) => (p.leg_recommendation_ids as number[]).slice().sort((a, b) => a - b).join(','))
  )

  const allRecs = (recs ?? []) as any[]
  const isTop = (r: any) => r.tier === 'elite' || r.tier === 'strong'

  // Game kickoff times, for the day/date/time shown on each bet and for
  // the "Day / Time" sort option below.
  const gameTimeById = new Map<string, string>((games ?? []).map((g: any) => [g.id, g.game_time]))

  const straightRows: BetRow[] = allRecs
    .filter((r) => r.bet_category !== 'player_prop' && isTop(r))
    .sort((a, b) => b.model_score - a.model_score)
    .slice(0, 15)
    .map((r) => toBetRow(r, null))

  const topPropRecsRaw = allRecs
    .filter((r) => r.bet_category === 'player_prop' && isTop(r))
    .sort((a, b) => b.model_score - a.model_score)
    .slice(0, 15)

  // Player prop recommendations don't carry their own team_id column, but
  // every prop's description leads with the exact player name used in the
  // synced player_props rows for its game — look the team up there,
  // scoped to just the (small) set of games behind this week's top props
  // rather than pulling every prop row for the week.
  const propGameIds = Array.from(new Set(topPropRecsRaw.map((r: any) => r.game_id).filter(Boolean)))
  const propTeamByKey = new Map<string, string>()
  if (propGameIds.length > 0) {
    const { data: propTeamRows } = await db
      .from('player_props')
      .select('game_id, player_name, team_id')
      .in('game_id', propGameIds)
    for (const p of propTeamRows ?? []) {
      if (p.team_id) propTeamByKey.set(`${p.game_id}|${p.player_name.toLowerCase()}`, p.team_id)
    }
  }

  function toBetRow(r: any, team: string | null): BetRow {
    return {
      id: r.id,
      tier: r.tier,
      description: r.description,
      modelScore: r.model_score,
      sportsbook: r.recommended_sportsbook ?? null,
      stake: r.recommended_stake !== null ? Number(r.recommended_stake) : null,
      odds: r.odds,
      tracked: trackedSingleIds.has(r.id),
      gameTimeIso: r.game_id ? gameTimeById.get(r.game_id) ?? null : null,
      team,
    }
  }

  const propRows: BetRow[] = topPropRecsRaw.map((r: any) => {
    const playerName = String(r.description).split(' — ')[0].toLowerCase()
    const team = r.game_id ? propTeamByKey.get(`${r.game_id}|${playerName}`) ?? null : null
    return toBetRow(r, team)
  })

  // Top Parlays — cross-game "by week" view, Elite+Strong legs only.
  const gamesMetaEntries: [string, GameMeta][] = (games ?? []).map((g: any) => [
    g.id,
    { gameId: g.id, label: `${g.away_team?.name ?? 'Away'} @ ${g.home_team?.name ?? 'Home'}`, gameTimeIso: g.game_time },
  ])
  const gamesMeta = new Map(gamesMetaEntries)
  const allLegs: ScoredLeg[] = allRecs.map((r) => toScoredLeg(r)).filter((l): l is ScoredLeg => l !== null)
  const parlayBuckets = buildParlayView(allLegs, gamesMeta, 'week', { ...DEFAULT_PARLAY_OPTIONS, maxTierN: 2, topN: 5 })
  const topParlays = parlayBuckets[0]?.suggestions ?? []
  const suggestedParlayStake = Math.max(1, Math.ceil(((dkBankroll + fdBankroll) / 2) * 0.01))

  const parlayRows: ParlayRow[] = topParlays.map((s) => {
    const legIds = s.legs.map((l) => l.recommendationId)
    const key = legIds.slice().sort((a, b) => a - b).join(',')
    const description = s.legs.map((l) => l.description).join(' + ')
    const american = s.result.bookDecimal !== null ? americanFromDecimal(s.result.bookDecimal) : null
    const kickoffTimes = s.legs
      .map((l) => gamesMeta.get(l.gameId)?.gameTimeIso)
      .filter((t): t is string => Boolean(t))
      .map((t) => new Date(t).getTime())
    const earliestGameTimeIso = kickoffTimes.length > 0 ? new Date(Math.min(...kickoffTimes)).toISOString() : null
    return {
      key,
      legIds,
      description,
      legCount: s.legs.length,
      combinedProbPct: s.result.combinedProb * 100,
      evPct: s.result.evPct,
      americanOdds: american,
      americanLabel: american !== null ? americanLabel(american) : null,
      tracked: trackedParlayKeys.has(key),
      earliestGameTimeIso,
      seasonYear,
      week,
      suggestedStake: suggestedParlayStake,
    }
  })

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/admin/nfl-edge/week/${week}?season=${seasonYear}`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to Week {week}
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            Top Bets <span className="text-base font-normal text-muted-foreground">· Week {week}, {seasonYear}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/nfl-edge/week/${week}/parlays?season=${seasonYear}`}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Parlay Builder →
          </Link>
          <Link
            href="/admin/nfl-edge/bet-tracker"
            className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
          >
            Bet Tracker →
          </Link>
        </div>
      </div>

      {allRecs.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No recommendations for this week yet — enter lines and recompute on the Week {week} page first.
        </div>
      )}

      {/* Top Straight Bets */}
      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Top Straight Bets</h2>
        <SortableBetList
          rows={straightRows}
          seasonYear={seasonYear}
          week={week}
          emptyLabel="No Elite/Strong straight bets this week yet."
        />
      </div>

      {/* Top Player Props */}
      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Top Player Props</h2>
        <SortableBetList
          rows={propRows}
          seasonYear={seasonYear}
          week={week}
          emptyLabel="No Elite/Strong player props this week yet."
        />
      </div>

      {/* Top Parlays */}
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
          Top Parlays <span className="normal-case font-normal">(cross-game, Elite+Strong legs — suggested stake {fmtStake(suggestedParlayStake)}/1u)</span>
        </h2>
        <SortableParlayList rows={parlayRows} emptyLabel="No Elite/Strong picks with a price yet this week." />
      </div>
    </div>
  )
}
