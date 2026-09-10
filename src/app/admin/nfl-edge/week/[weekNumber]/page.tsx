// ============================================================================
// NFL Edge Board â€” week detail
//
// Shows the slate: a market box (current DK/FD spread/total/ML, always
// visible) at the top of every game card, then the model's picks split
// into two boxes underneath â€” Game Lines & Total, then Player Props â€” so
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
// finals) by the actual score â€” status/score come from ESPN via
// sync-schedule.ts / schedule-sync.ts, kept fresh by the sync-scores cron
// and the "Sync scores" button below, both calling the same
// syncScheduleWeek() as the CLI script. "Recompute recommendations"
// re-scores everything (src/lib/nfl-edge/generate.ts) â€” game-level SU/ATS/
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
  if (n === null || n === undefined) return 'â€”'
  return n > 0 ? `+${n}` : String(n)
}

function fmtSpread(n: number | null | undefined) {
  if (n === null || n === undefined) return 'â€”'
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

  // Supabase/PostgREST caps a single query at 1,000 rows by default â€” a
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
          Week {week} <span className="text-base font-normal text-muted-foreground">Â· {seasonYear}</span>
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/nfl-edge/week/${week}/parlays?season=${seasonYear}`}
            className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
          >
            Parlay Builder â†’
          </Link>
          <Link
            href={`/admin/nfl-edge/week/${week}/clv?season=${seasonYear}`}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            CLV â†’
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
          const gameInjuries = (injuriesByGame.get(g.id) ?? []).sort((a, b) => a.player_name.localeCompare(b.player_name))
          const awayRating = ratingByTeam.get(g.away_team?.id)
          const homeRating = ratingByTeam.get(g.home_team?.id)

          return (
            <div key={g.id} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="text-base font-semibold text-foreground">
                  {g.away_team?.name} <span className="text-muted-foreground">@</span> {g.home_team?.name}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>
                    {fmtKickoff(g.game_time)}
                    {g.is_divisional ? ' Â· Divisional' : ''}
                  </div>
                  {g.status === 'final' && (
                    <div className="mt-0.5 text-sm font-semibold text-foreground">
                      Final: {g.away_team?.name} {g.away_score} â€“ {g.home_team?.name} {g.home_score}
                    </div>
                  )}
                  {g.status === 'in_progress' && (
                    <div className="mt-0.5 text-sm font-semibold text-primary">
                      Live: {g.away_team?.name} {g.away_score ?? 0} â€“ {g.home_team?.name} {g.home_score ?? 0}
                    </div>
                  )}
                </div>
              </div>

              {(awayRating || homeRating) && (
                <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>
                    Power: {g.away_team?.name}{' '}
                    <span className="font-mono font-semibold text-foreground">
                      {awayRating ? `${(awayRating.off + awayRating.def >= 0 ? '+' : '')}${(awayRating.off + awayRating.def).toFixed(1)}` : 'â€”'}
                    </span>{' '}
                    vs {g.home_team?.name}{' '}
                    <span className="font-mono font-semibold text-foreground">
                      {homeRating ? `${(homeRating.off + homeRating.def >= 0 ? '+' : '')}${(homeRating.off + homeRating.def).toFixed(1)}` : 'â€”'}
                    </span>
                  </span>
                </div>
              )}

              {/* Market box â€” always visible, current lines at a glance */}
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(['draftkings', 'fanduel'] as const).map((book) => {
                  const line = book === 'draftkings' ? dkLine : fdLine
                  return (
                    <div key={book} className="rounded-md border border-border/60 bg-background px-3 py-2 text-xs">
                      <div className="mb-1 font-semibold uppercase text-muted-foreground">{book === 'draftkings' ? 'DraftKings' : 'FanDuel'}</div>
                      {line ? (
                        <div className="flex flex-wrap gap-3 font-mono text-foreground">
                          <span>Spread {fmtSpread(line.home_spread)}</span>
                          <span>Total {line.total ?? 'â€”'}</span>
                          <span>ML {fmtOdds(line.home_moneyline)}/{fmtOdds(line.away_moneyline)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No line yet</span>
                      )
                    </div>
                  )
                })}
              </div>

              {/* Game Lines & Total picks â€” always shown */}
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
                    {tierFilter === 'all' ? 'No qualifying plays yet â€” enter lines below, then recompute.' : `No ${tierFilter} plays at this tier.`}
                  </p>
                )}
              </div>

              {/* Player Prop picks â€” underneath, same tier filter */}
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
  €€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµµÕÑ•µ™½É•É½Õ¹ˆù9¼ÁÉ½ÀÁ±…åÌ…ĞÑ¡¥ÌÑ¥•È¸ğ½Àø(€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€¥ô((€€€€€€€€€€€€€ì¼¨%¹©ÕÉ¥•ÌƒŠP½¹±äÉ•¹‘•É•İ¡•¸Ñ¡•É”ÌÍ½µ•Ñ¡¥¹œ½¸™¥±”€¨½ô(€€€€€€€€€€€€€í…µ•%¹©ÕÉ¥•Ì¹±•¹Ñ €ø€À€˜˜€ (€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µˆ´Ìˆø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µˆ´Ä¸ÔÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±ÕÁÁ•É…Í”Ñ•áĞµµÕÑ•µ™½É•É½Õ¹ˆù%¹©ÕÉ¥•Ìğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Äˆø(€€€€€€€€€€€€€€€€€€€í…µ•%¹©ÕÉ¥•Ì¹µ…À ¡¥¹¨¤€ôøì(€€€€€€€€€€€€€€€€€€€€€½¹ÍĞÑ•…µ9…µ”€ô¥¹¨¹Ñ•…µ}¥€ôôôœ¹¡½µ•}Ñ•…´ü¹¥€üœ¹¡½µ•}Ñ•…´ü¹¹…µ”€è¥¹¨¹Ñ•…µ}¥€ôôôœ¹…İ…å}Ñ•…´ü¹¥€üœ¹…İ…å}Ñ•…´ü¹¹…µ”€è€œœ(€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø­•äõí¥¹¨¹¥‘ô±…ÍÍ9…µ”ô‰™±•à™±•àµİÉ…À¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÈÉ½Õ¹‘•µµ‰½É‘•È‰½É‘•Èµ‰½É‘•È¼ØÀ‰œµ‰…­É½Õ¹Áà´ÌÁä´Ä¸ÔÑ•áĞµáÌˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ™½É•É½Õ¹ˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€í¥¹¨¹Á±…å•É}¹…µ•ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€í¥¹¨¹¥Í}Åˆ€˜˜€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµµÕÑ•µ™½É•É½Õ¹ˆø€¡E¤ğ½ÍÁ…¸ùô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµµÕÑ•µ™½É•É½Õ¹ˆøƒŠPí¥¹¨¹Á½Í¥Ñ¥½¸€üü€ŸŠPôƒ
ÜíÑ•…µ9…µ•ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÉ½Õ¹‘•µ™Õ±°‰½É‘•ÈÁà´ÈÁä´À¸ÔÑ•áĞµlåÁát™½¹Ğµ‰½±ÕÁÁ•É…Í”€‘í%9)UIe}MQe1m¥¹¨¹‘•Í¥¹…Ñ¥½¸€üü€œt€üü€‰œµµÕÑ•Ñ•áĞµµÕÑ•µ™½É•É½Õ¹‰½É‘•Èµ‰½É‘•Èõôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€í¥¹¨¹‘•Í¥¹…Ñ¥½¸€üü€ÁÉ½‰…‰±”ô(€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€¥ô((€€€€€€€€€€€€€€ñ‘•Ñ…¥±Ì±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´ˆø(€€€€€€€€€€€€€€€€ñÍÕµµ…Éä±…ÍÍ9…µ”ô‰ÕÉÍ½ÈµÁ½¥¹Ñ•ÈÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±ÕÁÁ•É…Í”Ñ•áĞµµÕÑ•µ™½É•É½Õ¹ˆø(€€€€€€€€€€€€€€€€€¹Ñ•È€¼ÕÁ‘…Ñ”±¥¹•Ì(€€€€€€€€€€€€€€€€ğ½ÍÕµµ…Éäø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ¥É¥µ½±Ì´Ä…À´ÌÍ´éÉ¥µ½±Ì´Èˆø(€€€€€€€€€€€€€€€€€ì¡l‘É…™Ñ­¥¹Ìœ°€™…¹‘Õ•°t…Ì½¹ÍĞ¤¹µ…À ¡‰½½¬¤€ôøì(€€€€€€€€€€€€€€€€€€€½¹ÍĞ•á¥ÍÑ¥¹œ€ô‰½½¬€ôôô€‘É…™Ñ­¥¹Ìœ€ü‘­1¥¹”€è™‘1¥¹”(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€€€ñ™½É´­•äõí‰½½­ô…Ñ¥½¸õíÍ…Ù•5…É­•Ñ1¥¹•ô±…ÍÍ9…µ”ô‰É½Õ¹‘•µµ‰½É‘•È‰½É‘•Èµ‰½É‘•È¼ØÀÀ´Ìˆø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¡¥‘‘•¸ˆ¹…µ”ô‰…µ•%ˆÙ…±Õ”õíœ¹¥‘ô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¡¥‘‘•¸ˆ¹…µ”ô‰ÍÁ½ÉÑÍ‰½½¬ˆÙ…±Õ”õí‰½½­ô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¡¥‘‘•¸ˆ¹…µ”ô‰İ••¬ˆÙ…±Õ”õíİ••­ô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µˆ´ÈÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±ÕÁÁ•É…Í”Ñ•áĞµµÕÑ•µ™½É•É½Õ¹ˆø(€€€€€€€€€€€€€€€€€€€€€€€€€í‰½½¬€ôôô€‘É…™Ñ­¥¹Ìœ€ü€É…™Ñ-¥¹Ìœ€è€…¹Õ•°õìœ€ô(€€€€€€€€€€€€€€€€€€€€€€€€€í•á¥ÍÑ¥¹œ€˜˜€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹Ğµ¹½Éµ…°ˆø¡±…ÍĞèí™µÑ=‘‘Ì¡•á¥ÍÑ¥¹œ¹¡½µ•}ÍÁÉ•…¥ô€¼í•á¥ÍÑ¥¹œ¹Ñ½Ñ…°€üü€ŸŠPô¤ğ½ÍÁ…¸ùô(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´Èˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞ¹…µ”ô‰¡½µ•MÁÉ•…ˆÁ±…•¡½±‘•Èô‰!½µ”ÍÁÉ•…ˆÑåÁ”ô‰¹Õµ‰•ÈˆÍÑ•ÀôˆÀ¸Ôˆ±…ÍÍ9…µ”ô‰É½Õ¹‘•‰½É‘•È‰½É‘•Èµ‰½É‘•È‰œµ‰…­É½Õ¹Áà´ÈÁä´ÄÑ•áĞµáÌˆ€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞ¹…µ”ô‰Ñ½Ñ…°ˆÁ±…•¡½±‘•Èô‰Q½Ñ…°ˆÑåÁ”ô‰¹Õµ‰•ÈˆÍÑ•ÀôˆÀ¸Ôˆ±…ÍÍ9…µ”ô‰É½Õ¹‘•‰½É‘•È‰½É‘•Èµ‰½É‘•È‰œµ‰…­É½Õ¹Áà´ÈÁä´ÄÑ•áĞµáÌˆ€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞ¹…µ”ô‰¡½µ•5½¹•å±¥¹”ˆÁ±…•¡½±‘•Èô‰!½µ”50ˆÑåÁ”ô‰¹Õµ‰•Èˆ±…ÍÍ9…µ”ô‰É½Õ¹‘•‰½É‘•È‰½É‘•Èµ‰½É‘•È‰œµ‰…­É½Õ¹Áà´ÈÁä´ÄÑ•áĞµáÌˆ€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞ¹…µ”ô‰…İ…å5½¹•å±¥¹”ˆÁ±…•¡½±‘•Èô‰İ…ä50ˆÑåÁ”ô‰¹Õµ‰•Èˆ±…ÍÍ9…µ”ô‰É½Õ¹‘•‰½É‘•È‰½É‘•Èµ‰½É‘•È‰œµ‰…­É½Õ¹Áà´ÈÁä´ÄÑ•áĞµáÌˆ€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰ÍÕ‰µ¥Ğˆ±…ÍÍ9…µ”ô‰µĞ´ÈÜµ™Õ±°É½Õ¹‘•‰œµÍ•½¹‘…ÉäÁà´ÈÁä´ÄÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÍ•½¹‘…Éäµ™½É•É½Õ¹ˆø(€€€€€€€€€€€€€€€€€€€€€€€€€M…Ù”í‰½½¬€ôôô€‘É…™Ñ­¥¹Ìœ€ü€,œ€è€ô±¥¹”(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€ğ½™½É´ø(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘•Ñ…¥±Ìø((€€€€€€€€€€€€€í…µ•AÉ½ÁÌ¹±•¹Ñ €ø€À€˜˜€ (€€€€€€€€€€€€€€€€ñ‘•Ñ…¥±Ì±…ÍÍ9…µ”ô‰µĞ´ÌÑ•áĞµÍ´ˆø(€€€€€€€€€€€€€€€€€€ñÍÕµµ…Éä±…ÍÍ9…µ”ô‰ÕÉÍ½ÈµÁ½¥¹Ñ•ÈÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±ÕÁÁ•É…Í”Ñ•áĞµµÕÑ•µ™½É•É½Õ¹ˆø(€€€€€€€€€€€€€€€€€€€±°Íå¹•ÁÉ½À±¥¹•Ì€¡í…µ•AÉ½ÁÌ¹±•¹Ñ¡ô¤(€€€€€€€€€€€€€€€€€€ğ½ÍÕµµ…Éäø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Èµ…àµ ´äØÍÁ…”µä´Ä½Ù•É™±½Üµäµ…ÕÑ¼ÁÈ´Äˆø(€€€€€€€€€€€€€€€€€€€í…µ•AÉ½ÁÌ¹µ…À ¡À¤€ôø€ (€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€€€€€€€€€­•äõí€‘íÀ¹Á±…å•Éõğ‘íÀ¹µ…É­•Ñõô(€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰™±•à™±•àµİÉ…À¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÈÉ½Õ¹‘•µµ‰½É‘•È‰½É‘•Èµ‰½É‘•È¼ØÀ‰œµ‰…­É½Õ¹Áà´ÌÁä´Ä¸ÔÑ•áĞµáÌˆ(€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ğµµ•‘¥Õ´Ñ•áĞµ™½É•É½Õ¹ˆø(€€€€€€€€€€€€€€€€€€€€€€€€€íÀ¹Á±…å•Éô€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµµÕÑ•µ™½É•É½Õ¹ˆûŠPíÀ¹µ…É­•Ğ¹É•Á±…” ½|½œ°€œ€œ¥ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ì™½¹Ğµµ½¹¼Ñ•áĞµµÕÑ•µ™½É•É½Õ¹ˆø(€€€€€€€€€€€€€€€€€€€€€€€€€íÀ¹‘¬€˜˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€,íÀ¹‘¬¹±¥¹”€üü€ŸŠPô€¡í™µÑ=‘‘Ì¡À¹‘¬¹½Ù•ÉAÉ¥”¥ô½í™µÑ=‘‘Ì¡À¹‘¬¹Õ¹‘•ÉAÉ¥”¥ô¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€íÀ¹™€˜˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€íÀ¹™¹±¥¹”€üü€ŸŠPô€¡í™µÑ=‘‘Ì¡À¹™¹½Ù•ÉAÉ¥”¥ô½í™µÑ=‘‘Ì¡À¹™¹Õ¹‘•ÉAÉ¥”¥ô¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€ğ½‘•Ñ…¥±Ìø(€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€¤(€€€€€€€ô¥ô(€€€€€€ğ½‘¥Øø(€€€€ğ½‘¥Øø(€€¤)ô(