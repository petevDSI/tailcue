// ============================================================================
// NFL Edge Board — season overview
// ============================================================================
import Link from 'next/link'
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'

export const dynamic = 'force-dynamic'

function currentSeasonYear(): number {
  const now = new Date()
  return now.getUTCMonth() >= 2 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}

export default async function NflEdgeSeasonPage({
  searchParams,
}: {
  searchParams: { season?: string }
}) {
  const seasonYear = Number(searchParams.season) || currentSeasonYear()
  const db = nflEdgeDb()

  const { data: games } = await db
    .from('games')
    .select('id, week_number, game_time, status')
    .eq('season_year', seasonYear)
    .order('week_number', { ascending: true })

  const { data: accounts } = await db.from('sportsbook_accounts').select('sportsbook, bankroll')
  const dk = accounts?.find((a: any) => a.sportsbook === 'draftkings')?.bankroll ?? 0
  const fd = accounts?.find((a: any) => a.sportsbook === 'fanduel')?.bankroll ?? 0

  const now = Date.now()
  const byWeek = new Map<number, { count: number; nextKickoff: number | null; anyFinal: boolean; anyUpcoming: boolean }>()
  for (const g of games ?? []) {
    const entry = byWeek.get(g.week_number) ?? { count: 0, nextKickoff: null, anyFinal: false, anyUpcoming: false }
    entry.count += 1
    const t = new Date(g.game_time).getTime()
    if (g.status === 'final') entry.anyFinal = true
    if (t > now) {
      entry.anyUpcoming = true
      if (entry.nextKickoff === null || t < entry.nextKickoff) entry.nextKickoff = t
    }
    byWeek.set(g.week_number, entry)
  }

  let currentWeek = 1
  for (const [wk, entry] of Array.from(byWeek.entries())) {
    if (entry.anyUpcoming) {
      currentWeek = wk
      break
    }
    if (entry.anyFinal) currentWeek = wk + 1
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{seasonYear} Season</p>
          <h1 className="text-2xl font-bold text-foreground">Weekly Edge Board</h1>
        </div>
        <div className="flex gap-4 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <div>
            <div className="text-xs uppercase text-muted-foreground">DraftKings</div>
            <div className="font-mono text-base font-semibold">${dk.toLocaleString()}</div>
          </div>
          <div className="border-l border-border pl-4">
            <div className="text-xs uppercase text-muted-foreground">FanDuel</div>
            <div className="font-mono text-base font-semibold">${fd.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {(!games || games.length === 0) && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No games loaded for {seasonYear} yet. Run{' '}
          <code className="rounded bg-muted px-1 py-0.5">npx tsx scripts/nfl-edge/sync-schedule.ts {seasonYear}</code>.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {Array.from({ length: 18 }, (_, i) => i + 1).map((wk) => {
          const entry = byWeek.get(wk)
          const isCurrent = wk === currentWeek
          return (
            <Link
              key={wk}
              href={`/admin/nfl-edge/week/${wk}?season=${seasonYear}`}
              className={`rounded-lg border p-4 text-center transition ${
                isCurrent ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              <div className="text-xs uppercase text-muted-foreground">Week</div>
              <div className="text-xl font-bold text-foreground">{wk}</div>
              <div className="mt-1 text-xs text-muted-foreground">{entry ? `${entry.count} games` : 'bye-heavy'}</div>
              {isCurrent && <div className="mt-1 text-[10px] font-semibold uppercase text-primary">Current</div>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
