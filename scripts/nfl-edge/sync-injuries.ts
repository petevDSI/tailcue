// ============================================================================
// NFL Edge Board — injury report sync (ESPN, free/keyless — verified real)
//
// For each team playing in the given week, pulls current injuries from
// ESPN's core API, resolves player name/position off that team's roster,
// and upserts into nfl_edge.injuries against that week's game row.
//
// There's no unique constraint on nfl_edge.injuries to upsert against, so
// this script deletes-then-inserts per (game_id, team_id) — simplest way to
// keep it idempotent without a migration change.
//
// Usage:  npx tsx scripts/nfl-edge/sync-injuries.ts <seasonYear> <week>
// ============================================================================
import { config } from 'dotenv'
config({ path: '.env.local' }) // scripts run outside Next.js, which is what normally loads .env.local
import { nflEdgeDb } from '../../src/lib/nfl-edge/supabase-admin'
import { getTeamCurrentInjuries, getTeamRosterMap } from '../../src/lib/nfl-edge/espn'

const seasonYear = Number(process.argv[2])
const week = Number(process.argv[3])

if (!seasonYear || !week) {
  console.error('Usage: npx tsx scripts/nfl-edge/sync-injuries.ts <seasonYear> <week>')
  process.exit(1)
}

const STATUS_MAP: Record<string, 'out' | 'doubtful' | 'questionable' | 'probable'> = {
  Out: 'out',
  Doubtful: 'doubtful',
  Questionable: 'questionable',
  Probable: 'probable',
  'Injured Reserve': 'out',
}

async function main() {
  const db = nflEdgeDb()

  const { data: games, error: gamesErr } = await db
    .from('games')
    .select('id, home_team_id, away_team_id, teams_home:home_team_id(espn_team_id), teams_away:away_team_id(espn_team_id)')
    .eq('season_year', seasonYear)
    .eq('week_number', week)
  if (gamesErr) throw gamesErr
  if (!games || games.length === 0) {
    console.log(`No games found for ${seasonYear} week ${week} — run sync-schedule.ts first.`)
    return
  }

  let totalRows = 0
  for (const game of games as any[]) {
    for (const side of ['home', 'away'] as const) {
      const teamId = side === 'home' ? game.home_team_id : game.away_team_id
      const espnTeamId = side === 'home' ? game.teams_home?.espn_team_id : game.teams_away?.espn_team_id
      if (!espnTeamId) continue

      const [injuries, rosterMap] = await Promise.all([
        getTeamCurrentInjuries(espnTeamId),
        getTeamRosterMap(espnTeamId),
      ])

      const rows = injuries
        .map((inj) => {
          const player = rosterMap.get(inj.athleteId)
          const designation = STATUS_MAP[inj.status] ?? null
          if (!player || !designation) return null
          return {
            game_id: game.id,
            team_id: teamId,
            player_name: player.name,
            position: player.position || null,
            designation,
            practice_status: null,
            is_qb: player.position === 'QB',
            note: inj.note,
            source: 'espn',
            updated_at: new Date().toISOString(),
          }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)

      // idempotent re-run: clear this game+team's prior report, then insert fresh
      const { error: delErr } = await db.from('injuries').delete().eq('game_id', game.id).eq('team_id', teamId)
      if (delErr) {
        console.error(`Clear failed for game ${game.id}/${teamId}:`, delErr.message)
        continue
      }
      if (rows.length > 0) {
        const { error: insErr } = await db.from('injuries').insert(rows)
        if (insErr) {
          console.error(`Insert failed for game ${game.id}/${teamId}:`, insErr.message)
          continue
        }
      }
      totalRows += rows.length
      console.log(`${teamId}: ${rows.length} injury report entries`)
    }
  }
  console.log(`Done. ${totalRows} injury rows written for week ${week}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
