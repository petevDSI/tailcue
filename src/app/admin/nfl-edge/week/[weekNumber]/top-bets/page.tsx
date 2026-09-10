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
import { TrackBetToggle } from './_components/TrackBetToggle'
import { TrackParlayToggle } from './_components/TrackParlayToggle'

export const dynamic = 'force-dynamic'

const TIER_STYLE: Record<string, string> = {
  elite: 'bg-primary/15 text-primary border-primary/30',
  strong: 'bg-calm/40 text-calm-foreground border-calm-dot/30',
}

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

  const straightRecs = allRecs
    .filter((r) => r.bet_category !== 'player_prop' && isTop(r))
    .sort((a, b) => b.model_score - a.model_score)
    .slice(0, 15)

  const propRecs = allRecs
    .filter((r) => r.bet_category === 'player_prop' && isTop(r))
    .sort((a, b) => b.model_score - a.model_score)
    .slice(0, 15)

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

  const renderStakeOrNote = (r: any) => {
    if (r.recommended_sportsbook && r.recommended_stake) {
      return (
        <span className="font-semibold text-foreground">
          {r.recommended_sportsbook === 'draftkings' ? 'DK' : 'FD'} {fmtStake(Number(r.recommended_stake))}
        </span>
      )
    }
    return <span>not priced yet</span>
  }

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
        {straightRecs.length > 0 ? (
          <div className="space-y-1.5">
            {straightRecs.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${TIER_STYLE[r.tier]}`}>
                    {r.tier}
                  </span>
                  <span className="font-medium text-foreground">{r.description}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                  <span>score {r.model_score.toFixed(0)}</span>
                  {renderStakeOrNote(r)}
                  {r.recommended_sportsbook && r.recommended_stake && r.odds !== null && (
                    <TrackBetToggle
                      recommendationId={r.id}
                      seasonYear={seasonYear}
                      week={week}
                      tracked={trackedSingleIds.has(r.id)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No Elite/Strong straight bets this week yet.</p>
        )}
      </div>

      {/* Top Player Props */}
      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Top Player Props</h2>
        {propRecs.length > 0 ? (
          <div className="space-y-1.5">
            {propRecs.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${TIER_STYLE[r.tier]}`}>
                    {r.tier}
                  </span>
                  <span className="font-medium text-foreground">{r.description}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                  <span>score {r.model_score.toFixed(0)}</span>
                  {renderStakeOrNote(r)}
                  {r.recommended_sportsbook && r.recommended_stake && r.odds !== null && (
                    <TrackBetToggle
                      recommendationId={r.id}
                      seasonYear={seasonYear}
                      week={week}
                      tracked={trackedSingleIds.has(r.id)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No Elite/Strong player props this week yet.</p>
        )}
      </div>

      {/* Top Parlays */}
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
          Top Parlays <span className="normal-case font-normal">(cross-game, Elite+Strong legs — suggested stake {fmtStake(suggestedParlayStake)}/1u)</span>
        </h2>
        {topParlays.length > 0 ? (
          <div className="space-y-1.5">
            {topParlays.map((s) => {
              const legIds = s.legs.map((l) => l.recommendationId)
              const key = legIds.slice().sort((a, b) => a - b).join(',')
              const description = s.legs.map((l) => l.description).join(' + ')
              const american = s.result.bookDecimal !== null ? americanFromDecimal(s.result.bookDecimal) : null
              return (
                <div
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
                >
                  <div className="flex-1 font-medium text-foreground">
                    {s.legs.length === 1 ? 'Straight' : `${s.legs.length}-leg`}: {description}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                    <span>{(s.result.combinedProb * 100).toFixed(1)}% · EV {s.result.evPct !== null ? `${s.result.evPct >= 0 ? '+' : ''}${s.result.evPct.toFixed(1)}%` : '—'}</span>
                    {american !== null && (
                      <>
                        <span className="font-semibold text-foreground">{americanLabel(american)}</span>
                        <TrackParlayToggle
                          legIds={legIds}
                          description={description}
                          sportsbook="draftkings"
                          stake={suggestedParlayStake}
                          odds={american}
                          seasonYear={seasonYear}
                          week={week}
                          tracked={trackedParlayKeys.has(key)}
                        />
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No Elite/Strong picks with a price yet this week.</p>
        )}
      </div>
    </div>
  )
}
