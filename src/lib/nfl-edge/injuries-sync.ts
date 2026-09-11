// ============================================================================
// NFL Edge Board — injury report sync (ESPN, free/keyless)
//
// Extracted 2026-09-10 from scripts/nfl-edge/sync-injuries.ts (same reason
// as market-lines-sync.ts's extraction) so this same fetch-and-write logic
// can be called from both the manual CLI script AND a cron route
// (src/app/api/admin/nfl-edge/cron/sync-injuries) without duplicating it.
//
// Unlike market lines, this is NOT append-only — there's no unique
// constraint on nfl_edge.injuries to upsert against, so each call
// deletes-then-inserts per (game_id, team_id). That's fine for a cron: the
// point of injuries is "what's true right now," not a movement history.
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
// ============================================================================
import { nflEdgeDb } from './supabase-admin'
import { getAllCurrentInjuries } from './espn'

const STATUS_MAP: Record<string, 'out' | 'doubtful' | 'questionable' | 'probable'> = {
  Out: 'out',
  Doubtful: 'doubtful',
  Questionable: 'questionable',
  Probable: 'probable',
  'Injured Reserve': 'out',
  Suspension: 'out', // not an injury, but same practical effect on availability — see header note
  // 'Active' intentionally has no entry here — not a real injury designation, dropped below
}

export type InjurySyncResult =
  | { status: 'no_games' }
  | { status: 'synced'; totalRows: number; byTeam: Record<string, number> }

export async function syncInjuriesForWeek(seasonYear: number, week: number): Promise<InjurySyncResult> {
  const db = nflEdgeDb()

  const { data: games, error: gamesErr } = await db
    .from('games')
    .select('id, home_team_id, away_team_id, teams_home:home_team_id(espn_team_id), teams_away:away_team_id(espn_team_id)')
    .eq('season_year', seasonYear)
    .eq('week_number', week)
  if (gamesErr) throw gamesErr
  if (!games || games.length === 0) {
    return { status: 'no_games' }
  }

  const injuriesByTeam = await getAllCurrentInjuries()

  let totalRows = 0
  const byTeam: Record<string, number> = {}

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
      if (delErr) throw delErr

      if (rows.length > 0) {
        const { error: insErr } = await db.from('injuries').insert(rows)
        if (insErr) throw insErr
      }
      totalRows += rows.length
      byTeam[teamId] = rows.length
    }
  }

  return { status: 'synced', totalRows, byTeam }
}
