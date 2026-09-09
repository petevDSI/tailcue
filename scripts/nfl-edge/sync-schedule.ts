// ============================================================================
// NFL Edge Board — schedule sync
//
// Re-runnable version of the one-off migration that first seeded the 2026
// season (272 games). Safe to run again any time — every row is upserted
// on `espn_event_id`, so scores/status flip from 'scheduled' to 'final' as
// the season plays out without touching anything else.
//
// Usage:  npx tsx scripts/nfl-edge/sync-schedule.ts [seasonYear]
// ============================================================================
import 'dotenv/config'
import { nflEdgeDb } from '../../src/lib/nfl-edge/supabase-admin'
import { getScoreboardWeek } from '../../src/lib/nfl-edge/espn'

const seasonYear = Number(process.argv[2] ?? new Date().getFullYear())

async function main() {
  const db = nflEdgeDb()
  const { data: teams, error: teamsErr } = await db.from('teams').select('id, espn_team_id, division')
  if (teamsErr) throw teamsErr
  const espnToTeam = new Map<string, any>((teams ?? []).map((t: any) => [t.espn_team_id, t]))

  let totalUpserted = 0
  for (let week = 1; week <= 18; week++) {
    const events = await getScoreboardWeek(seasonYear, week, 2)
    if (events.length === 0) {
      console.log(`Week ${week}: no events returned (season may not be scheduled yet).`)
      continue
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

    if (rows.length === 0) continue

    const { error } = await db.from('games').upsert(rows, { onConflict: 'espn_event_id' })
    if (error) {
      console.error(`Week ${week} upsert failed:`, error.message)
      continue
    }
    totalUpserted += rows.length
    console.log(`Week ${week}: upserted ${rows.length} games`)
  }
  console.log(`Done. ${totalUpserted} games upserted for ${seasonYear}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
