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
// Kickoff time is always shown in Eastern (Pete's timezone), regardless
// of what timezone the server that rendered the page happens to be in.
// Once a game has a result, that kickoff line is joined (or replaced, for
// finals) by the actual score — status/score come from ESPN via
// sync-schedule.ts / schedule-sync.ts, kept fresh by the sync-scores cron
// and the "Sync scores" button below, both calling the same
// syncScheduleWeek() as the CLI script. "Recompute recommendations"
// re-scores everything (src/lib/nfl-edge/generate.ts) — game-level SU/ATS/
// Total picks and player props (props-scoring.ts) into the same
// bet_recommendations table. The Parlay Builder (src/lib/nfl-edge/
// parlay.ts) works off those same rows.
// ============================================================================
import Link from 'next/link'
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'
import { mergeLatestProps, groupPropsByGame } from '@/lib/nfl-edge/props-scoring'
import { saveMarketLine, recomputeWeek, syncWeekScores } from '../../actions'

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

/** Always Eastern (Pete's timezone), regardless of the rendering server's own timezone. */
function fmtKickoff(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

type PickGrade = 'win' | 'loss' | 'push'

const GRADE_STYLE: Record<PickGrade, string> = {
  win: 'bg-primary/15 text-primary border-primary/30',
  loss: 'bg-destructive/15 text-destructive border-destructive/30',
  push: 'bg-muted text-muted-foreground border-border',
}

/**
 * Grades one already-issued recommendation against the final score. Reads
 * the exact number that was recommended straight out of `description`
 * (e.g. "... — Chiefs -3.5", "... — Over 47.5") rather than re-deriving it
 * from market_lines, since the line can move after a pick goes out — this
 * grades the analysis we actually provided, not whatever the market shows
 * now. Player props aren't graded here: no box-score/stat feed is synced
 * to check them against.
 */
function gradeRecommendation(
  r: { bet_category: string; description: string; side: string },
  homeName: string | undefined,
  awayName: string | undefined,
  homeScore: number,
  awayScore: number
): PickGrade | null {
  if (r.bet_category === 'game_su') {
    const pickedHome = r.side === homeName
    const pickedAway = r.side === awayName
    if (!pickedHome && !pickedAway) return null
    if (homeScore === awayScore) return 'push'
    const homeWon = homeScore > awayScore
    return (pickedHome && homeWon) || (pickedAway && !homeWon) ? 'win' : 'loss'
  }
  if (r.bet_category === 'game_ats') {
    const m = r.description.match(/([+-]?\d+(?:\.\d+)?)\s*$/)
    if (!m) return null
    const spreadForSide = parseFloat(m[1])
    const pickedHome = r.side === homeName
    const pickedAway = r.side === awayName
    if (!pickedHome && !pickedAway) return null
    const diff = (pickedHome ? homeScore - awayScore : awayScore - homeScore) + spreadForSide
    if (diff > 0) return 'win'
    if (diff < 0) return 'loss'
    return 'push'
  }
  if (r.bet_category === 'game_total') {
    const m = r.description.match(/(\d+(?:\.\d+)?)\s*$/)
    if (!m) return null
    const totalLine = parseFloat(m[1])
    const sum = homeScore + awayScore
    const isOver = r.side === 'Over'
    if (sum === totalLine) return 'push'
    const overHit = sum > totalLine
    return (isOver && overHit) || (!isOver && !overHit) ? 'win' : 'loss'
  }
  return null
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
    .select(
      'id, game_time, status, is_divisional, home_score, away_score, home_team:home_team_id(id,name), away_team:away_team_id(id,name)'
    )
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

  // Ordered ascending so a later as_of_week snapshot overwrites an earlier
  // one below (same pattern/reasoning as generate.ts's rating lookup).
  const { data: ratings } = await db
    .from('team_ratings')
    .select('team_id, off_rating, def_rating, as_of_week')
    .eq('season_year', seasonYear)
    .lte('as_of_week', week)
    .order('as_of_week', { ascending: true })

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

  const ratingByTeam = new Map<string, { off: number; def: number }>()
  for (const r of ratings ?? []) {
    ratingByTeam.set(r.team_id, { off: r.off_rating, def: r.def_rating })
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
          <Link
            href={`/admin/nfl-edge/week/${week}/clv?season=${seasonYear}`}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            CLV →
          </Link>
          <form
            action={async () => {
              'use server'
              await syncWeekScores(seasonYear, week)
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Sync scores
            </button>
          </form>
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
          const homeInjuries = (injuriesByGame.get(g.id) ?? [])
            .filter((inj) => inj.team_id === g.home_team?.id)
            .sort((a, b) => a.player_name.localeCompare(b.player_name))
          const awayInjuries = (injuriesByGame.get(g.id) ?? [])
            .filter((inj) => inj.team_id === g.away_team?.id)
            .sort((a, b) => a.player_name.localeCompare(b.player_name))
          const awayRating = ratingByTeam.get(g.away_team?.id)
          const homeRating = ratingByTeam.get(g.home_team?.id)

          // Graded independent of the tier filter above — this is a record of
          // what was actually recommended, not a view that should change when
          // Pete narrows the page to "Elite only."
          const gradedRecs =
            g.status === 'final' && g.home_score !== null && g.away_score !== null
              ? allGameRecs
                  .filter((r) => r.bet_category !== 'player_prop')
                  .map((r) => ({ r, grade: gradeRecommendation(r, g.home_team?.name, g.away_team?.name, g.home_score, g.away_score) }))
                  .filter((x): x is { r: any; grade: PickGrade } => x.grade !== null)
              : []
          const gradeTally = gradedRecs.reduce(
            (acc, { grade }) => ({ ...acc, [grade]: acc[grade] + 1 }),
            { win: 0, loss: 0, push: 0 } as Record<PickGrade, number>
          )

          return (
            <div key={g.id} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="text-base font-semibold text-foreground">
                  {g.away_team?.name} <span className="text-muted-foreground">@</span> {g.home_team?.name}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>
                    {fmtKickoff(g.game_time)}
                    {g.is_divisional ? ' · Divisional' : ''}
                  </div>
                  {g.status === 'final' && (
                    <div className="mt-0.5 text-sm font-semibold text-foreground">
                      Final: {g.away_team?.name} {g.away_score} – {g.home_team?.name} {g.home_score}
                    </div>
                  )}
                  {g.status === 'in_progress' && (
                    <div className="mt-0.5 text-sm font-semibold text-primary">
                      Live: {g.away_team?.name} {g.away_score ?? 0} – {g.home_team?.name} {g.home_score ?? 0}
                    </div>
                  )}
                </div>
              </div>

              {/* Result box — only for concluded games, graded against every game-level pick we issued */}
              {gradedRecs.length > 0 && (
                <div className="mb-3 rounded-md border border-border/60 bg-background px-3 py-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Our picks vs. the final</span>
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {gradeTally.win}-{gradeTally.loss}
                      {gradeTally.push > 0 ? `-${gradeTally.push}` : ''}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {gradedRecs.map(({ r, grade }) => (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-foreground">{r.description}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${GRADE_STYLE[grade]}`}>
                          {grade}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(awayRating || homeRating) && (
                <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>
                    Power: {g.away_team?.name}{' '}
                    <span className="font-mono font-semibold text-foreground">
                      {awayRating ? `${(awayRating.off + awayRating.def >= 0 ? '+' : '')}${(awayRating.off + awayRating.def).toFixed(1)}` : '—'}
                    </span>{' '}
                    vs {g.home_team?.name}{' '}
                    <span className="font-mono font-semibold text-foreground">
                      {homeRating ? `${(homeRating.off + homeRating.def >= 0 ? '+' : '')}${(homeRating.off + homeRating.def).toFixed(1)}` : '—'}
                    </span>
                  </span>
                </div>
              )}

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

              {/* Player Prop picks — underneath, same tier filter. Collapsed by
                  default (accordion arrow) since a full slate of props per
                  game gets long fast; the count in the summary gives the
                  scent without needing to open it. */}
              {anyPropRecs && (
                <details className="group mb-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground [&::-webkit-details-marker]:hidden">
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3 w-3 flex-shrink-0 transition-transform group-open:rotate-90"
                    >
                      <path d="M6 4l8 6-8 6V4z" />
                    </svg>
                    Player Props ({propPickRecs.length})
                  </summary>
                  <div className="mt-1.5">
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
                </details>
              )}

              {/* Injuries — home team on the left, away on the right, never
                  intermixed. Collapsed by default (accordion arrow), same
                  pattern as Player Props above. */}
              {(homeInjuries.length > 0 || awayInjuries.length > 0) && (
                <details className="group mb-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground [&::-webkit-details-marker]:hidden">
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3 w-3 flex-shrink-0 transition-transform group-open:rotate-90"
                    >
                      <path d="M6 4l8 6-8 6V4z" />
                    </svg>
                    Injuries ({homeInjuries.length + awayInjuries.length})
                  </summary>
                  <div className="mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {([
                      { teamName: g.home_team?.name, list: homeInjuries },
                      { teamName: g.away_team?.name, list: awayInjuries },
                    ] as const).map(({ teamName, list }, colIdx) => (
                      <div key={colIdx}>
                        <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">{teamName}</div>
                        {list.length > 0 ? (
                          <div className="space-y-1">
                            {list.map((inj) => (
                              <div key={inj.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs">
                                <div className="text-foreground">
                                  {inj.player_name}
                                  {inj.is_qb && <span className="text-muted-foreground"> (QB)</span>}
                                  <span className="text-muted-foreground"> — {inj.position ?? '—'}</span>
                                </div>
                                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${INJURY_STYLE[inj.designation ?? ''] ?? 'bg-muted text-muted-foreground border-border'}`}>
                                  {inj.designation ?? 'probable'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">None reported.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
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
