// ============================================================================
// NFL Edge Board — closing-line auto-sync cron
//
// What this replaces: Pete pasted a Python asyncio "ClosingLinePoller" that
// runs a tight loop, checks every 60s for bets within 5-10 minutes of
// kickoff, and fetches sharp odds right at that moment to lock in true CLV.
// That's the right idea, but it's built for a different stack (a
// long-running Python worker against a local sqlite file) than this project
// has (a stateless Next.js app on Vercel, Postgres via Supabase) — so this
// is that same idea, translated to the stack that's actually here, with one
// honest caveat below.
//
// HONEST LIMITATION: Vercel Cron on the Hobby plan can only run once a day
// (Pro allows down to once a minute — see
// vercel.com/docs/cron-jobs/usage-and-pricing, checked 2026-09-10). That
// means this can't replicate a "poll every 60 seconds, fire 5-10 minutes
// before kickoff" pattern on Hobby. What it CAN do: run once daily and pull
// whatever the current market line is for the upcoming/in-progress week.
// Because market_lines is append-only, running this every day through the
// week still builds a real line-movement history, and the LAST snapshot
// captured before kickoff is a reasonable (if not minute-perfect) proxy for
// "closing line" — a meaningfully closer read than a single Tuesday
// snapshot, just not the precise 5-minutes-before-kickoff capture the
// original pasted code does. If Pete wants that tighter capture, it needs
// the Pro plan (or a schedule external to Vercel that can hit this route
// more often — this route itself doesn't care how often it's called).
//
// Auth: same Bearer CRON_SECRET pattern as /api/care/reminders/route.ts —
// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'
import { syncMarketLinesForWeek } from '@/lib/nfl-edge/market-lines-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = nflEdgeDb()

  // Auto-detect "the current week" instead of taking it as a param — this
  // runs unattended, so there's no one to pass it in. Find the earliest
  // game that's either still upcoming or started within the last 4 hours
  // (so a Sunday-afternoon run still resolves to today's week, not next
  // week's). No such game = off-season or between weeks; no-op.
  const fourHoursAgo = new Date(Date.now() - 4 * 3600_000).toISOString()
  const { data: nextGame, error: nextErr } = await db
    .from('games')
    .select('season_year, week_number, game_time')
    .gte('game_time', fourHoursAgo)
    .order('game_time', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (nextErr) {
    console.error('sync-closing-lines: lookup of current week failed', nextErr)
    return NextResponse.json({ error: nextErr.message }, { status: 500 })
  }
  if (!nextGame) {
    return NextResponse.json({ status: 'no_upcoming_week' })
  }

  try {
    const result = await syncMarketLinesForWeek(nextGame.season_year, nextGame.week_number)
    console.log(
      `sync-closing-lines: season ${nextGame.season_year} week ${nextGame.week_number} -> ${result.status}` +
        (result.status === 'inserted' ? ` (${result.count} rows via ${result.source})` : '')
    )
    return NextResponse.json({
      season_year: nextGame.season_year,
      week_number: nextGame.week_number,
      ...result,
    })
  } catch (err) {
    console.error('sync-closing-lines: sync failed', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
