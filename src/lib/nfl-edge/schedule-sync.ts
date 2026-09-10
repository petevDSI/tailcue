// ============================================================================
// NFL Edge Board — schedule sync (shared logic)
//
// Extracted 2026-09-10 from scripts/nfl-edge/sync-schedule.ts so the CLI
// script, the admin week page's manual "Sync scores" button, and the
// sync-scores cron (src/app/api/admin/nfl-edge/cron/sync-scores) all call
// the exact same upsert logic. Every row is upserted on espn_event_id, so
// this is safe to call again any time — status flips 'scheduled' ->
// 'in_progress' -> 'final' and scores fill in as the week plays out,
// without touching anything else.
// ============================================================================
import { nflEdgeDb } from './supabase-admin'
import { getScoreboardWeek } from './espn'

export interface ScheduleSyncResult {
  week: number
  upserted: number
  skipped: 'no_events' | null
}

/** Syncs one week's games (schedule, status, scores) from ESPN. */
export async function syncScheduleWeek(seasonYear: number, week: number): Promise<ScheduleSyncResult> {
  const db = nflEdgeDb()
  const { data: teams, error: teamsErr } = await db.from('teams').select('id, espn_team_id, division')
  if (teamsErr) throw teamsErr
  const espnToTeam = new Map<string, any>((teams ?? []).map((t: any) => [t.espn_team_id, t]))

  const events = await getScoreboardWeek(seasonYear, week, 2)
  if (events.length === 0) {
    return { week, upserted: 0, skipped: 'no_events' }
  }

  const rows = events
    .map((ev) => {
      const home = ev.competitions[0]?.competitors.find((c) => c.homeAway === 'home')
      const away = ev.competitions[0]?.competitors.find((c) => c.homeAway === 'away')
      const homeTeam = home && espnToTeam.get(home.team.id)
      const awayTeam = away && espnToTeam.get(away.team.id)
      if (!homeTeam || !awayTeam) return null

      const status: 'scheduled' | 'in_progress' | 'final' = ev.status.type.completed
        ? 'final'
        : ev.status.type.state === 'in'
          ? 'in_progress'
          : 'scheduled'

      return {
        season_year: seasonYear,
        week_number: week,
        week_type: 'reg' as const,
        game_time: ev.date,
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        is_divisional: homeTeam.division === awayTeam.division,
        status,
        home_score: home?.score ? Number(home.score) : null,
        away_score: away?.score ? Number(away.score) : null,
        espn_event_id: ev.id,
        updated_at: new Date().toISOString(),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length === 0) {
    return { week, upserted: 0, skipped: 'no_events' }
  }

  const { error } = await db.from('games').upsert(rows, { onConflict: 'espn_event_id' })
  if (error) throw error

  return { week, upserted: rows.length, skipped: null }
}

/** Syncs every regular-season week (1-18) — the original full-season backfill/resync. */
export async function syncScheduleSeason(seasonYear: number): Promise<ScheduleSyncResult[]> {
  const results: ScheduleSyncResult[] = []
  for (let week = 1; week <= 18; week++) {
    results.push(await syncScheduleWeek(seasonYear, week))
  }
  return results
}
