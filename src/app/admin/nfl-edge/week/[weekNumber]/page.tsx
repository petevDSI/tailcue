// ============================================================================
// NFL Edge Board — week detail
//
// Shows the slate: a market box (current DK/FD spread/total/ML, always
// visible) at the top of every game card, then the model's picks split
// into two boxes underneath — Game Lines & Total, then Player Props — so
// the two never get shuffled together by score the way they used to.
// A tier filter (Elite/Strong/Lean/All) narrows both boxes at once. Below
// that: any injury reports on file for the game, the manual line-entry
// form as a backstop/override, and the full raw list of every synced prop
// line (not just the recommended ones). Lines are auto-synced via
// sync-market-lines.ts / sync-player-props.ts (SportsGameOdds primary,
// TheRundown fallback for game lines) and injuries via sync-injuries.ts.
// "Recompute recommendations" re-scores everything (src/lib/nfl-edge/
// generate.ts) — game-level SU/ATS/Total picks and player props
// (props-scoring.ts) into the same bet_recommendations table. The Parlay
// Builder (src/lib/nfl-edge/parlay.ts) works off those same rows.
// ============================================================================
import Link from 'next/link'
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'
import { mergeLatestProps, groupPropsByGame } from '@/lib/nfl-edge/props-scoring'
import { saveMarketLine, recomputeWeek } from '../../actions'

export const dynamic = 'force-dynamic'

const TIER_STYLE: Record<string, string> = {
  elite: 'bg-primary/15 text-primary border-primary/30',
  strong: 'bg-calm/40 text-calm-foreground border-calm-dot/30',
  lean: 'bg-muted text-muted-foreground border-border',
  pass: 'bg-muted/50 text-muted-foreground border-border',
}

const INJURY_STYLE: Record<string, string> = {
  out: 'bg-destructive/15 text-destructive border-destructive/30',
  doubtful: 'bg-destructive/10 text-destructive border-destructive/20',
  questionable: 'bg-muted text-muted-foreground border-border',
  probable: 'bg-muted/50 text-muted-foreground border-border',
}

const TIER_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'elite', label: 'Elite' },
  { value: 'strong', label: 'Strong' },
  { value: 'lean', label: 'Lean' },
]

function fmtOdds(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return n > 0 ? `+${n}` : String(n)
}

function fmtSpread(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return n > 0 ? `+${n}` : String(n)
}

export default async function WeekPage({
  params,
  searchParams,
}: {
  params: { weekNumber: string }
  searchParams: { season?: string; tier?: string }
}) {
  const week = Number(params.weekNumber)
  const seasonYear = Number(searchParams.season) || new Date().getUTCFullYear()
  const tierFilter = TIER_FILTERS.some((t) => t.value === searchParams.tier) ? (searchParams.tier as string) : 'all'
  const db = nflEdgeDb()

  const { data: games } = await db
    .from('games')
    .select('id, game_time, status, is_divisional, home_team:home_team_id(id,name), away_team:away_team_id(id,name)')
    .eq('season_year', seasonYear)
    .eq('week_number', week)
    .order('game_time', { ascending: true })

  const gameIds = (games ?? []).map((g: any) => g.id)

  const { data: recs } = await db
    .from('bet_recommendations')
    .select('*')
    .eq('season_year', seasonYear)
    .eq('week_number', week)
    .order('model_score', { ascending: false })

  const { data: lines } = await db.from('market_lines').select('*').in('game_id', gameIds).order('captured_at', { ascending: false })

  const { data: injuries } = await db
    .from('injuries')
    .select('*')
    .in('game_id', gameIds)
    .order('updated_at', { ascending: false })

  // Supabase/PostgREST caps a single query at 1,000 rows by default — a
  // full week of props (16 games x ~130 rows) can exceed that, so page
  // through with .range() until a partial page tells us we're done.
  const props: any[] = []
  {
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

  const injuriesByGame = new Map<string, any[]>()
  for (const i of injuries ?? []) {
    const list = injuriesByGame.get(i.game_id) ?? []
    list.push(i)
    injuriesByGame.set(i.game_id, list)
  }

  // Same dedupe/merge props-scoring.ts uses for the model, so the page and
  // the generator never drift on what "the current line" means.
  const propsByGame = groupPropsByGame(mergeLatestProps(props ?? []))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">
          Week {week} <span className="text-base font-normal text-muted-foreground">· {seasonYear}</span>
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/nfl-edge/week/${week}/parlays?season=${seasonYear}`}
            className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
          >
            Parlay Builder →
          </Link>
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
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Tier:</span>
        {TIER_FILTERS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/nfl-edge/week/${week}?season=${seasonYear}${t.value === 'all' ? '' : `&tier=${t.value}`}`}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              tierFilter === t.value ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {(!games || games.length === 0) && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No games found for this week.
        </div>
      )}

      <div className="space-y-4">
        {(games ?? []).map((g: any) => {
          const allGameRecs = recsByGame.get(g.id) ?? []
          const matchesTier = (r: any) => tierFilter === 'all' || r.tier === tierFilter
          const gameLineRecs = allGameRecs.filter((r) => r.bet_category !== 'player_prop' && matchesTier(r)).sort((a, b) => b.model_score - a.model_score)
          const propPickRecs = allGameRecs.filter((r) => r.bet_category === 'player_prop' && matchesTier(r)).sort((a, b) => b.model_score - a.model_score)
          const anyPropRecs = allGameRecs.some((r) => r.bet_category === 'player_prop')

          const gameLines = linesByGame.get(g.id) ?? []
          const dkLine = gameLines.find((l) => l.sportsbook === 'draftkings')
          const fdLine = gameLines.find((l) => l.sportsbook === 'fanduel')
          const gameProps = (propsByGame.get(g.id) ?? []).slice().sort((a, b) =>
            a.player.localeCompare(b.player) || a.market.localeCompare(b.market)
          )
          const gameInjuries = (injuriesByGame.get(g.id) ?? []).sort((a, b) => a.player_name.localeCompare(b.player_name))

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

              {/* Market box — always visible, current lines at a glance */}
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(['draftkings', 'fanduel'] as const).map((book) => {
                  const line = book === 'draftkings' ? dkLine : fdLine
                  return (
                    <div key={book} className="rounded-md border border-border/60 bg-background px-3 py-2 text-xs">
                      <div className="mb-1 font-semibold uppercase text-muted-foreground">{book === 'draftkings' ? 'DraftKings' : 'FanDuel'}</div>
                      {line ? (
                        <div className="flex flex-wrap gap-3 font-mono text-foreground">
                          <span>Spread {fmtSpread(line.home_spread)}</span>
                          <span>Total {line.total ?? '—'}</span>
                          <span>ML {fmtOdds(line.home_moneyline)}/{fmtOdds(line.away_moneyline)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No line yet</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Game Lines & Total picks — always shown */}
              <div className="mb-3">
                <div className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Game Lines &amp; Total</div>
                {gameLineRecs.length > 0 ? (
                  <div className="space-y-1.5">
                    {gameLineRecs.map((r) => (
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
                  <p className="text-xs text-muted-foreground">
                    {tierFilter === 'all' ? 'No qualifying plays yet — enter lines below, then recompute.' : `No ${tierFilter} plays at this tier.`}
                  </p>
                )}
              </div>

              {/* Player Prop picks — underneath, same tier filter */}
              {anyPropRecs && (
                <div className="mb-3">
                  <div className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Player Props</div>
                  {propPickRecs.length > 0 ? (
                    <div className="space-y-1.5">
                      {propPickRecs.map((r) => (
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
                    <p className="text-xs text-muted-foreground">No prop plays at this tier.</p>
                  )}
                </div>
              )}

              {/* Injuries — only rendered when there's something on file */}
              {gameInjuries.length > 0 && (
                <div className="mb-3">
                  <div className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Injuries</div>
                  <div className="space-y-1">
                    {gameInjuries.map((inj) => {
                      const teamName = inj.team_id === g.home_team?.id ? g.home_team?.name : inj.team_id === g.away_team?.id ? g.away_team?.name : ''
                      return (
                        <div key={inj.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs">
                          <div className="text-foreground">
                            {inj.player_name}
                            {inj.is_qb && <span className="text-muted-foreground"> (QB)</span>}
                            <span className="text-muted-foreground"> — {inj.position ?? '—'} · {teamName}</span>
                          </div>
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${INJURY_STYLE[inj.designation ?? ''] ?? 'bg-muted text-muted-foreground border-border'}`}>
                            {inj.designation ?? 'probable'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
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
                    All synced prop lines ({gameProps.length})
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
                              DK {p.dk.line ?? '—'} ({fmtOdds(p.dk.overPrice)}/{fmtOdds(p.dk.underPrice)})
                            </span>
                          )}
                          {p.fd && (
                            <span>
                              FD {p.fd.line ?? '—'} ({fmtOdds(p.fd.overPrice)}/{fmtOdds(p.fd.underPrice)})
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
