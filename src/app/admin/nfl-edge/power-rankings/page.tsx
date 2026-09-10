// ============================================================================
// NFL Edge Board — power rankings
//
// Shows nfl_edge.team_ratings for the most recent as_of_week on file for the
// season (sync-power-ratings.ts writes one snapshot per week it's run for).
// off_rating/def_rating are both "points above a league-average team, per
// game" — off from average EPA/game generated on real pass/run plays,
// def from average EPA/game allowed, both from real nflverse play-by-play
// (see that script's header for the full methodology and its honest limits,
// chiefly: no strength-of-schedule adjustment, and early-season numbers are
// a blend of last season's full-year rating and however many real games
// this season has actually been played so far).
// ============================================================================
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'

export const dynamic = 'force-dynamic'

function currentSeasonYear(): number {
  const now = new Date()
  return now.getUTCMonth() >= 2 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}

function fmtRating(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}`
}

export default async function PowerRankingsPage({ searchParams }: { searchParams: { season?: string } }) {
  const seasonYear = Number(searchParams.season) || currentSeasonYear()
  const db = nflEdgeDb()

  const { data: latestWeekRow } = await db
    .from('team_ratings')
    .select('as_of_week')
    .eq('season_year', seasonYear)
    .order('as_of_week', { ascending: false })
    .limit(1)
    .maybeSingle()

  const asOfWeek = latestWeekRow?.as_of_week ?? null

  const { data: ratings } = asOfWeek
    ? await db
        .from('team_ratings')
        .select('team_id, off_rating, def_rating, source, teams:team_id(name, conference, division)')
        .eq('season_year', seasonYear)
        .eq('as_of_week', asOfWeek)
    : { data: [] as any[] }

  const rows = (ratings ?? [])
    .map((r: any) => ({
      teamId: r.team_id,
      name: r.teams?.name ?? r.team_id,
      conference: r.teams?.conference ?? '',
      division: r.teams?.division ?? '',
      off: r.off_rating,
      def: r.def_rating,
      overall: r.off_rating + r.def_rating,
      source: r.source,
    }))
    .sort((a: { overall: number }, b: { overall: number }) => b.overall - a.overall)

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{seasonYear} Season</p>
          <h1 className="text-2xl font-bold text-foreground">Power Rankings</h1>
        </div>
        {asOfWeek && <div className="text-xs text-muted-foreground">As of Week {asOfWeek} · {rows[0]?.source}</div>}
      </div>

      <p className="mb-4 max-w-2xl text-xs text-muted-foreground">
        Off/Def are points above a league-average team, per game, from real play-by-play (EPA per play on real pass/run
        snaps, offense generated vs. defense allowed). Overall = Off + Def. Early in a season these blend last
        season&apos;s full-year numbers with however many real {seasonYear} games have actually been played — not
        adjusted for strength of schedule.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No power ratings yet for {seasonYear}. Run{' '}
          <code className="rounded bg-muted px-1 py-0.5">npx tsx scripts/nfl-edge/sync-power-ratings.ts {seasonYear} 1</code>.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2 text-right">Off</th>
                <th className="px-3 py-2 text-right">Def</th>
                <th className="px-3 py-2 text-right">Overall</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: (typeof rows)[number], i: number) => (
                <tr key={r.teamId} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {r.name} <span className="text-xs text-muted-foreground">({r.teamId})</span>
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-xs ${r.off >= 0 ? 'text-calm-foreground' : 'text-destructive'}`}>{fmtRating(r.off)}</td>
                  <td className={`px-3 py-2 text-right font-mono text-xs ${r.def >= 0 ? 'text-calm-foreground' : 'text-destructive'}`}>{fmtRating(r.def)}</td>
                  <td className="px-3 py-2 text-right font-mono text-sm font-semibold text-foreground">{fmtRating(r.overall)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
