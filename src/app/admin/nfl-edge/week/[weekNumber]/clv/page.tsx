// ============================================================================
// NFL Edge Board — Closing Line Value (CLV) report
//
// For each game-level recommendation (ATS, total, straight-up), shows the
// line captured at (or just before) the moment the recommendation was
// generated, next to the closing line (the last snapshot on file before
// kickoff — or, for a game that hasn't kicked off yet, the latest snapshot
// so far, clearly labeled "current" rather than "closing"). See
// src/lib/nfl-edge/clv.ts for the full CLV methodology and its current
// limitation: this only gets meaningful once sync-market-lines.ts has been
// run more than once per game, ideally including a run shortly before each
// kickoff. Player props aren't covered here yet (see clv.ts header).
// ============================================================================
import Link from 'next/link'
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'
import {
  pickSnapshotAtOrBefore,
  pickClosingSnapshot,
  computeAtsClv,
  computeTotalClv,
  computeMoneylineClv,
  type MarketSnapshot,
} from '@/lib/nfl-edge/clv'

export const dynamic = 'force-dynamic'

function fmtClv(clv: number | null, unit: string): string {
  if (clv === null) return '—'
  const sign = clv >= 0 ? '+' : ''
  return `${sign}${clv.toFixed(1)}${unit}`
}

function fmtLine(n: number | null): string {
  if (n === null) return '—'
  return n > 0 ? `+${n}` : String(n)
}

export default async function ClvPage({
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
    .select('id, game_time, home_team:home_team_id(id,name), away_team:away_team_id(id,name)')
    .eq('season_year', seasonYear)
    .eq('week_number', week)
    .order('game_time', { ascending: true })

  const gameIds = (games ?? []).map((g: any) => g.id)

  const { data: recs } = await db
    .from('bet_recommendations')
    .select('*')
    .eq('season_year', seasonYear)
    .eq('week_number', week)
    .in('bet_category', ['game_ats', 'game_total', 'game_su'])
    .order('generated_at', { ascending: true })

  const { data: lines } = await db.from('market_lines').select('*').in('game_id', gameIds)

  const gameById = new Map<string, any>((games ?? []).map((g: any) => [g.id, g]))
  const linesByGame = new Map<string, MarketSnapshot[]>()
  for (const l of lines ?? []) {
    const snap: MarketSnapshot = {
      capturedAt: l.captured_at,
      sportsbook: l.sportsbook,
      homeSpread: l.home_spread,
      total: l.total,
      homeMoneyline: l.home_moneyline,
      awayMoneyline: l.away_moneyline,
    }
    const list = linesByGame.get(l.game_id) ?? []
    list.push(snap)
    linesByGame.set(l.game_id, list)
  }

  const rows = (recs ?? []).map((r: any) => {
    const game = gameById.get(r.game_id)
    const snaps = linesByGame.get(r.game_id) ?? []
    const betSnap = pickSnapshotAtOrBefore(snaps, r.generated_at, r.recommended_sportsbook)
    const closeInfo = pickClosingSnapshot(snaps, game?.game_time ?? new Date().toISOString(), r.recommended_sportsbook)

    let outcome
    let unit = ''
    if (r.bet_category === 'game_ats') {
      const sideIsHome = r.side === game?.home_team?.name
      outcome = computeAtsClv(betSnap, closeInfo, sideIsHome)
      unit = 'pt'
    } else if (r.bet_category === 'game_total') {
      const sideIsOver = r.side === 'Over'
      outcome = computeTotalClv(betSnap, closeInfo, sideIsOver)
      unit = 'pt'
    } else {
      const sideIsHome = r.side === game?.home_team?.name
      outcome = computeMoneylineClv(betSnap, closeInfo, sideIsHome)
      unit = 'pp'
    }

    return {
      id: r.id,
      description: r.description,
      tier: r.tier,
      betValue: outcome.betValue,
      closeValue: outcome.closeValue,
      clv: outcome.clv,
      isFinal: outcome.isFinal,
      unit,
      snapCount: snaps.length,
    }
  })

  const withClv = rows.filter((r: (typeof rows)[number]) => r.clv !== null && r.isFinal)
  const avgClv = withClv.length > 0 ? withClv.reduce((a: number, r: (typeof rows)[number]) => a + (r.clv as number), 0) / withClv.length : null
  const positivePct = withClv.length > 0 ? (100 * withClv.filter((r: (typeof rows)[number]) => (r.clv as number) > 0).length) / withClv.length : null

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{seasonYear} · Week {week}</p>
          <h1 className="text-2xl font-bold text-foreground">Closing Line Value</h1>
        </div>
        <Link href={`/admin/nfl-edge/week/${week}?season=${seasonYear}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Week {week}
        </Link>
      </div>

      <p className="mb-4 max-w-2xl text-xs text-muted-foreground">
        Compares the line at the moment each pick was generated against the closing line (or, before kickoff, the
        latest number on file so far — labeled &quot;pending&quot;). This only gets meaningful once{' '}
        <code className="rounded bg-muted px-1 py-0.5">sync-market-lines.ts</code> has been run more than once per
        game — ideally once shortly before each kickoff to actually capture a close. Right now most games only have
        one snapshot on file, so expect a lot of &quot;pending&quot; and null CLV until more syncs accumulate.
      </p>

      {withClv.length > 0 && (
        <div className="mb-4 flex gap-6 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <div>
            <span className="text-xs uppercase text-muted-foreground">Avg CLV (settled picks)</span>{' '}
            <span className={`font-mono font-semibold ${avgClv !== null && avgClv >= 0 ? 'text-calm-foreground' : 'text-destructive'}`}>
              {avgClv !== null ? fmtClv(avgClv, '') : '—'}
            </span>
          </div>
          <div>
            <span className="text-xs uppercase text-muted-foreground">% Beat the close</span>{' '}
            <span className="font-mono font-semibold text-foreground">{positivePct !== null ? `${positivePct.toFixed(0)}%` : '—'}</span>
          </div>
          <div>
            <span className="text-xs uppercase text-muted-foreground">Settled</span>{' '}
            <span className="font-mono font-semibold text-foreground">{withClv.length} / {rows.length}</span>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No game-level recommendations for Week {week} yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">Pick</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2 text-right">Bet-time line</th>
                <th className="px-3 py-2 text-right">Close</th>
                <th className="px-3 py-2 text-right">CLV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: (typeof rows)[number]) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 text-foreground">{r.description}</td>
                  <td className="px-3 py-2 text-xs capitalize text-muted-foreground">{r.tier}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{fmtLine(r.betValue)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {fmtLine(r.closeValue)}
                    {!r.isFinal && <span className="ml-1 text-[10px] uppercase text-muted-foreground/70">(pending)</span>}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono text-xs font-semibold ${
                      r.clv === null ? 'text-muted-foreground' : r.clv >= 0 ? 'text-calm-foreground' : 'text-destructive'
                    }`}
                  >
                    {fmtClv(r.clv, r.unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
