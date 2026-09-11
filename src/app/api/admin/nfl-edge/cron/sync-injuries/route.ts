// ============================================================================
// NFL Edge Board — cron: injury report sync
//
// Previously injuries only updated when Pete (or Claude) manually ran
// scripts/nfl-edge/sync-injuries.ts — unlike scores (every 30 min) and
// market lines (once daily), there was no automated refresh, so a
// same-day status change (e.g. a player moving to Out) could sit stale on
// the site indefinitely. This closes that gap the same way sync-scores
// does: auto-detect the current week and re-sync on a schedule.
//
// ESPN's league-wide injuries endpoint is free/keyless (see espn.ts's
// getAllCurrentInjuries), so — unlike the SGO/TheRundown market-lines
// cron — this needs no new environment variables to work in production.
//
// vercel.json schedules this every 30 minutes, matching sync-scores.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'
import { syncInjuriesForWeek } from '@/lib/nfl-edge/injuries-sync'

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
    console.error('sync-injuries: lookup of current week failed', nextErr)
    return NextResponse.json({ error: nextErr.message }, { status: 500 })
  }
  if (!nextGame) {
    return NextResponse.json({ status: 'no_upcoming_week' })
  }

  try {
    const result = await syncInjuriesForWeek(nextGame.season_year, nextGame.week_number)
    console.log(
      `sync-injuries: season ${nextGame.season_year} week ${nextGame.week_number} -> ${result.status}` +
        (result.status === 'synced' ? ` (${result.totalRows} rows)` : '')
    )
    return NextResponse.json({
      season_year: nextGame.season_year,
      week_number: nextGame.week_number,
      ...result,
    })
  } catch (err) {
    console.error('sync-injuries: sync failed', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
