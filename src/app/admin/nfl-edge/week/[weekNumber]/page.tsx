// ============================================================================
// NFL Edge Board — week detail
//
// Shows the slate: game lines and player props (auto-synced via
// sync-market-lines.ts / sync-player-props.ts — SportsGameOdds primary,
// TheRundown fallback for game lines), a manual line-entry form as a
// backstop/override, and a "Recompute recommendations" trigger.
// ============================================================================
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'
import { saveMarketLine, recomputeWeek } from '../../actions'

export const dynamic = 'force-dynamic'

const TIER_STYLE: Record<string, string> = {
  elite: 'bg-primary/15 text-primary border-primary/30',
  strong: 'bg-calm/40 text-calm-foreground border-calm-dot/30',
  lean: 'bg-muted text-muted-foreground border-border',
  pass: 'bg-muted/50 text-muted-foreground border-border',
}

function fmtOdds(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return n > 0 ? `+${n}` : String(n)
}

export default async function WeekPage({
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
    .select('id, game_time, status, is_divisional, home_team:home_team_id(id,name), away_team:away_team_id(id,name)')
    .eq('season_year', seasonYear)
    .eq('week_number', week)
    .order('game_time', { ascending: true })

  const { data: recs } = await db
    .from('bet_recommendations')
    .select('*')
    .eq('season_year', seasonYear)
    .eq('week_number', week)
    .order('model_score', { ascending: false })

  const { data: lines } = await db
    .from('market_lines')
    .select('*')
    .in('game_id', (games ?? []).map((g: any) => g.id))
    .order('captured_at', { ascending: false })

  // Supabase/PostgREST caps a single query at 1,000 rows by default — a
  // full week of props (16 games x ~130 rows) can exceed that, so page
  // through with .range() until a partial page tells us we're done.
  const props: any[] = []
  {
    const gameIds = (games ?? []).map((g: any) => g.id)
    const PAGE_SIZE = 1000
    let from = 0
    while (true) {
      const { data: page, error } = await db
        .from('player_props')
        .select('*')
        .in('game_id', gameIds)
        .order('captured_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      props.push(...(page ?? []))
      if (!page || page.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  const recsByGame = new Map<string, any[]>()
  for (const r of recs ?? []) {
    const list = recsByGame.get(r.game_id) ?? []
    list.push(r)
    recsByGame.set(r.game_id, list)
  }

  const linesByGame = new Map<string, any[]>()
  for (const l of lines ?? []) {
    const list = linesByGame.get(l.game_id) ?? []
    list.push(l)
    linesByGame.set(l.game_id, list)
  }

  // Dedupe to the latest snapshot per (game, player, market, book) — props
  // is append-only, so re-syncs add rows rather than replace them.
  const latestPropKey = new Set<string>()
  type MergedProp = { player: string; market: string; dk?: any; fd?: any }
  const propsByGame = new Map<string, Map<string, MergedProp>>()
  for (const p of props ?? []) {
    const dedupeKey = `${p.game_id}|${p.player_name}|${p.market}|${p.sportsbook}`
    if (latestPropKey.has(dedupeKey)) continue // already have a newer snapshot for this exact line
    latestPropKey.add(dedupeKey)

    const gameMap = propsByGame.get(p.game_id) ?? new Map<string, MergedProp>()
    const mergeKey = `${p.player_name}|${p.market}`
    const merged: MergedProp = gameMap.get(mergeKey) ?? { player: p.player_name, market: p.market }
    if (p.sportsbook === 'draftkings') merged.dk = p
    if (p.sportsbook === 'fanduel') merged.fd = p
    gameMap.set(mergeKey, merged)
    propsByGame.set(p.game_id, gameMap)
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">
          Week {week} <span className="text-base font-normal text-muted-foreground">· {seasonYear}</span>
        </h1>
        <form
          action={async () => {
            'use server'
            await recomputeWeek(seasonYear, week)
          }}
        >
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Recompute recommendations
          </button>
        </form>
      </div>

      {(!games || games.length === 0) && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No games found for this week.
        </div>
      )}

      <div className="space-y-4">
        {(games ?? []).map((g: any) => {
          const gameRecs = (recsByGame.get(g.id) ?? []).sort((a, b) => b.model_score - a.model_score)
          const gameLines = linesByGame.get(g.id) ?? []
          const dkLine = gameLines.find((l) => l.sportsbook === 'draftkings')
          const fdLine = gameLines.find((l) => l.sportsbook === 'fanduel')
          const gameProps = Array.from(propsByGame.get(g.id)?.values() ?? []).sort((a, b) =>
            a.player.localeCompare(b.player) || a.market.localeCompare(b.market)
          )

          return (
            <div key={g.id} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-base font-semibold text-foreground">
                  {g.away_team?.name} <span className="text-muted-foreground">@</span> {g.home_team?.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(g.game_time).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {g.is_divisional ? ' · Divisional' : ''}
                </div>
              </div>

              {gameRecs.length > 0 ? (
                <div className="mb-3 space-y-1.5">
                  {gameRecs.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${TIER_STYLE[r.tier]}`}>
                          {r.tier}
                        </span>
                        <span className="font-medium text-foreground">{r.description}</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                        <span>score {r.model_score.toFixed(0)}</span>
                        {r.recommended_sportsbook && r.recommended_stake ? (
                          <span className="font-semibold text-foreground">
                            {r.recommended_sportsbook === 'draftkings' ? 'DK' : 'FD'} ${Number(r.recommended_stake).toFixed(2)}
                          </span>
                        ) : (
                          <span>no stake</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-3 text-xs text-muted-foreground">No qualifying plays yet — enter lines below, then recompute.</p>
              )}

              <details className="text-sm">
                <summary className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">
                  Enter / update lines
                </summary>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(['draftkings', 'fanduel'] as const).map((book) => {
                    const existing = book === 'draftkings' ? dkLine : fdLine
                    return (
                      <form key={book} action={saveMarketLine} className="rounded-md border border-border/60 p-3">
                        <input type="hidden" name="gameId" value={g.id} />
                        <input type="hidden" name="sportsbook" value={book} />
                        <input type="hidden" name="week" value={week} />
                        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                          {book === 'draftkings' ? 'DraftKings' : 'FanDuel'}{' '}
                          {existing && <span className="font-normal">(last: {fmtOdds(existing.home_spread)} / {existing.total ?? '—'})</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input name="homeSpread" placeholder="Home spread" type="number" step="0.5" className="rounded border border-border bg-background px-2 py-1 text-xs" />
                          <input name="total" placeholder="Total" type="number" step="0.5" className="rounded border border-border bg-background px-2 py-1 text-xs" />
                          <input name="homeMoneyline" placeholder="Home ML" type="number" className="rounded border border-border bg-background px-2 py-1 text-xs" />
                          <input name="awayMoneyline" placeholder="Away ML" type="number" className="rounded border border-border bg-background px-2 py-1 text-xs" />
                        </div>
                        <button type="submit" className="mt-2 w-full rounded bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">
                          Save {book === 'draftkings' ? 'DK' : 'FD'} line
                        </button>
                      </form>
                    )
                  })}
                </div>
              </details>

              {gameProps.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">
                    Player props ({gameProps.length})
                  </summary>
                  <div className="mt-2 max-h-96 space-y-1 overflow-y-auto pr-1">
                    {gameProps.map((p) => (
                      <div
                        key={`${p.player}|${p.market}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs"
                      >
                        <div className="font-medium text-foreground">
                          {p.player} <span className="text-muted-foreground">— {p.market.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="flex items-center gap-3 font-mono text-muted-foreground">
                          {p.dk && (
                            <span>
                              DK {p.dk.line ?? '—'} ({fmtOdds(p.dk.over_price)}/{fmtOdds(p.dk.under_price)})
                            </span>
                          )}
                          {p.fd && (
                            <span>
                              FD {p.fd.line ?? '—'} ({fmtOdds(p.fd.over_price)}/{fmtOdds(p.fd.under_price)})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
