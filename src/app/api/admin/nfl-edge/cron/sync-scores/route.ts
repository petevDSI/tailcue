// ============================================================================
// NFL Edge Board — cron: game status/score sync
//
// Keeps games.status and games.home_score/away_score current so the week
// page can show "Final: AWAY x – HOME y" (or "Live: ...") without Pete
// running scripts/nfl-edge/sync-schedule.ts by hand. Same "find the
// currently relevant week" lookup as sync-closing-lines: the nearest game
// at/after 4 hours ago. That alone would miss a Monday-night game once
// the week has fully rolled over to the next one (by the time we're
// looking at next week's Thursday game, Monday's result is already more
// than 4 hours old) — so this also re-syncs the PREVIOUS week every run,
// which is cheap (one more ESPN call) and makes that gap self-healing.
// vercel.json currently schedules this every 30 minutes (Pro plan has no
// Hobby-style once-daily floor), so in practice a final score should show
// up well within the hour of the game ending.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'
import { syncScheduleWeek } from '@/lib/nfl-edge/schedule-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = nflEdgeDb()

  const fourHoursAgo = new Date(Date.now() - 4 * 3600_000).toISOString()
  const { data: nextGame, error: nextErr } = await db
    .from('games')
    .select('season_year, week_number, game_time')
    .gte('game_time', fourHoursAgo)
    .order('game_time', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (nextErr) {
    console.error('sync-scores: lookup of current week failed', nextErr)
    return NextResponse.json({ error: nextErr.message }, { status: 500 })
  }
  if (!nextGame) {
    return NextResponse.json({ status: 'no_upcoming_week' })
  }

  const weeksToSync = Array.from(new Set([nextGame.week_number, nextGame.week_number - 1])).filter((w) => w >= 1)

  try {
    const results = []
    for (const week of weeksToSync) {
      const result = await syncScheduleWeek(nextGame.season_year, week)
      results.push(result)
      console.log(`sync-scores: season ${nextGame.season_year} week ${week} -> upserted ${result.upserted}`)
    }
    return NextResponse.json({ season_year: nextGame.season_year, results })
  } catch (err) {
    console.error('sync-scores: sync failed', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
