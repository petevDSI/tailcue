// ============================================================================
// NFL Edge Board — parlay builder (server shell)
//
// Fetches the week's qualifying recommendations + each game's kickoff time,
// turns the raw rows into ScoredLeg[] (src/lib/nfl-edge/parlay.ts — skips
// any row missing a real price/probability rather than guessing), and
// hands everything to the client component that does the actual grouping/
// ranking (kept client-side since it's pure filtering of already-fetched
// data — no need for extra round-trips as Pete flips the props toggle,
// tier filter, or view tab).
// ============================================================================
import Link from 'next/link'
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'
import { toScoredLeg, type GameMeta, type ScoredLeg } from '@/lib/nfl-edge/parlay'
import { ParlayBuilderClient } from './ParlayBuilderClient'

export const dynamic = 'force-dynamic'

export default async function ParlaysPage({
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
    .select('id, game_time, status, home_team:home_team_id(name), away_team:away_team_id(name)')
    .eq('season_year', seasonYear)
    .eq('week_number', week)
    .order('game_time', { ascending: true })

  const { data: recs } = await db
    .from('bet_recommendations')
    .select('id, game_id, bet_category, description, side, model_score, tier, model_prob, odds, recommended_sportsbook')
    .eq('season_year', seasonYear)
    .eq('week_number', week)

  const gamesMetaEntries: [string, GameMeta][] = (games ?? []).map((g: any) => [
    g.id,
    {
      gameId: g.id,
      label: `${g.away_team?.name ?? 'Away'} @ ${g.home_team?.name ?? 'Home'}`,
      gameTimeIso: g.game_time,
    },
  ])

  const allLegs: ScoredLeg[] = (recs ?? [])
    .map((r: any) => toScoredLeg(r))
    .filter((l: ScoredLeg | null): l is ScoredLeg => l !== null)

  const missingCount = (recs ?? []).length - allLegs.length

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/admin/nfl-edge/week/${week}?season=${seasonYear}`} className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to Week {week}
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            Parlay Builder <span className="text-base font-normal text-muted-foreground">· Week {week}, {seasonYear}</span>
          </h1>
        </div>
      </div>

      {(!games || games.length === 0) && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No games found for this week.
        </div>
      )}

      {games && games.length > 0 && allLegs.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No qualifying recommendations with both a price and a probability yet. Enter lines and click{' '}
          <span className="font-semibold text-foreground">Recompute recommendations</span> on the Week {week} page first.
        </div>
      )}

      {allLegs.length > 0 && (
        <ParlayBuilderClient allLegs={allLegs} gamesMetaEntries={gamesMetaEntries} missingCount={missingCount} />
      )}
    </div>
  )
}
