// ============================================================================
// NFL Edge Board — injury report sync (ESPN, free/keyless)
//
// Pulls the ENTIRE league's current injury report in one call (see
// espn.ts's getAllCurrentInjuries — this replaced a broken per-team ESPN
// core-API endpoint on 2026-09-10) and writes each relevant team's entries
// against every game that team plays in the given week — nfl_edge.injuries
// rows are scoped to one game, not just one team, per the existing schema.
//
// Status mapping notes (real distribution seen live: Active 509, Out 55,
// Questionable 95, Doubtful 1, Injured Reserve 136, Suspension 4 — out of
// ~800 league-wide entries):
//  - ESPN's 'Active' status is the majority of entries and means the player
//    is a full practice participant / not actually limited — it is NOT an
//    injury designation in the fantasy/betting sense, so these are dropped
//    entirely rather than forced into some designation.
//  - ESPN's 'Suspension' status isn't an injury at all, but has the same
//    practical effect on availability as 'out', and nfl_edge.injuries'
//    designation column has no separate slot for it (out/doubtful/
//    questionable/probable only) — so it's mapped to 'out' here. Rare
//    (single digits league-wide) — a deliberate simplification, not a data
//    error, and worth a real 'suspended' designation later if it matters.
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
import { getAllCurrentInjuries } from '../../src/lib/nfl-edge/espn'

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
  Suspension: 'out', // not an injury, but same practical effect on availability — see header note
  // 'Active' intentionally has no entry here — not a real injury designation, dropped below
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

  console.log('Fetching league-wide injury report from ESPN...')
  const injuriesByTeam = await getAllCurrentInjuries()

  let totalRows = 0
  for (const game of games as any[]) {
    for (const side of ['home', 'away'] as const) {
      const teamId = side === 'home' ? game.home_team_id : game.away_team_id
      const espnTeamId = side === 'home' ? game.teams_home?.espn_team_id : game.teams_away?.espn_team_id
      if (!espnTeamId) continue

      const entries = injuriesByTeam.get(String(espnTeamId)) ?? []

      const rows = entries
        .map((inj) => {
          const designation = STATUS_MAP[inj.status] ?? null
          if (!designation) return null // e.g. 'Active' — not a real injury
          return {
            game_id: game.id,
            team_id: teamId,
            player_name: inj.playerName,
            position: inj.position,
            designation,
            practice_status: null,
            is_qb: inj.position === 'QB',
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
