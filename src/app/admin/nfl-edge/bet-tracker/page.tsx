// ============================================================================
// NFL Edge Board — Bet Tracker
//
// A running record of the bets Pete has actually checked off as placed
// (from the Top Bets page — see week/[n]/top-bets/page.tsx), grouped by
// week, with a season-wide running P&L at the top. Grading is always
// manual (Won/Lost/Push buttons) — see src/lib/nfl-edge/bet-tracker.ts's
// header comment for why this system doesn't try to auto-grade: it only
// stores a human-readable description of each bet, not the exact
// spread/total number it was placed against, so an auto-grader for ATS/
// Total picks could silently get the push/cover math wrong with real
// money on the line. Realized P&L only counts settled bets (won/lost);
// pending bets are shown separately as "at risk," not folded into P&L.
// ============================================================================
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'
import { profitIfWon } from '@/lib/nfl-edge/bet-tracker'
import { americanLabel } from '@/lib/nfl-edge/scoring'
import { SettleButtons } from './_components/SettleButtons'

export const dynamic = 'force-dynamic'

function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

export default async function BetTrackerPage({ searchParams }: { searchParams: { season?: string } }) {
  const seasonYear = Number(searchParams.season) || new Date().getUTCFullYear()
  const db = nflEdgeDb()

  const { data: bets } = await db
    .from('bets_placed')
    .select('*')
    .eq('season_year', seasonYear)
    .order('week_number', { ascending: false })
    .order('placed_at', { ascending: false })

  const rows = (bets ?? []) as any[]

  let totalStaked = 0
  let atRisk = 0
  let realizedPl = 0
  let wonCount = 0
  let lostCount = 0
  let pushCount = 0

  for (const b of rows) {
    const stake = Number(b.stake)
    totalStaked += stake
    if (b.result === 'pending') atRisk += stake
    else if (b.result === 'won') {
      realizedPl += profitIfWon(stake, b.odds)
      wonCount++
    } else if (b.result === 'lost') {
      realizedPl -= stake
      lostCount++
    } else if (b.result === 'push') {
      pushCount++
    }
  }

  const byWeek = new Map<number, any[]>()
  for (const b of rows) {
    const list = byWeek.get(b.week_number) ?? []
    list.push(b)
    byWeek.set(b.week_number, list)
  }
  const weeks = Array.from(byWeek.keys()).sort((a, b) => b - a)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Bet Tracker <span className="text-base font-normal text-muted-foreground">· {seasonYear}</span>
        </h1>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-4">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Realized P&amp;L</div>
          <div className={`font-mono text-lg font-semibold ${realizedPl >= 0 ? 'text-calm-foreground' : 'text-destructive'}`}>
            {fmtMoney(realizedPl)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">At risk (pending)</div>
          <div className="font-mono text-lg font-semibold text-foreground">${Math.round(atRisk)}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">Record</div>
          <div className="font-mono text-lg font-semibold text-foreground">
            {wonCount}-{lostCount}-{pushCount}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">Total staked</div>
          <div className="font-mono text-lg font-semibold text-foreground">${Math.round(totalStaked)}</div>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No bets tracked yet for {seasonYear}. Check off a pick as &ldquo;placed&rdquo; on any week&rsquo;s Top Bets page.
        </div>
      )}

      <div className="space-y-6">
        {weeks.map((wk) => (
          <div key={wk}>
            <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Week {wk}</h2>
            <div className="space-y-1.5">
              {(byWeek.get(wk) ?? []).map((b: any) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      {b.bet_type === 'parlay' ? `${b.leg_recommendation_ids.length}-leg parlay` : 'single'}
                    </span>
                    <span className="font-medium text-foreground">{b.description}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                    <span>{b.sportsbook === 'draftkings' ? 'DK' : b.sportsbook === 'fanduel' ? 'FD' : b.sportsbook}</span>
                    <span className="font-semibold text-foreground">${Math.round(Number(b.stake))}</span>
                    <span>{americanLabel(b.odds)}</span>
                    <span>to win {fmtMoney(profitIfWon(Number(b.stake), b.odds))}</span>
                    <SettleButtons betId={b.id} result={b.result} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
