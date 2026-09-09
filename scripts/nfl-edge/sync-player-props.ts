// ============================================================================
// NFL Edge Board — player prop sync
//
// SportsGameOdds only — real DraftKings + FanDuel player props, free (see
// src/lib/nfl-edge/sportsgameodds.ts). No free fallback exists (TheRundown
// gates props behind its $49/mo Starter plan), so if SGO is unavailable
// this run simply reports nothing rather than using a paid/partial source.
//
// player_props is append-only, same rationale as market_lines — safe to
// run as often as you like through the week to catch line movement.
//
// Usage:  npx tsx scripts/nfl-edge/sync-player-props.ts <seasonYear> <week>
// ============================================================================
import { config } from 'dotenv'
config({ path: '.env.local' }) // scripts run outside Next.js, which is what normally loads .env.local
import { nflEdgeDb } from '../../src/lib/nfl-edge/supabase-admin'
import { getWeekMarketData } from '../../src/lib/nfl-edge/sportsgameodds'

const seasonYear = Number(process.argv[2])
const week = Number(process.argv[3])
if (!seasonYear || !week) {
  console.error('Usage: npx tsx scripts/nfl-edge/sync-player-props.ts <seasonYear> <week>')
  process.exit(1)
}

async function main() {
  const db = nflEdgeDb()

  const { data: games, error } = await db
    .from('games')
    .select(
      'id, game_time, home:teams!home_team_id(sgo_team_id), away:teams!away_team_id(sgo_team_id)'
    )
    .eq('season_year', seasonYear)
    .eq('week_number', week)
  if (error) throw error
  if (!games || games.length === 0) {
    console.log(`No games found for ${seasonYear} week ${week} — run sync-schedule.ts first.`)
    return
  }

  const gameBySgoTeams = new Map<string, string>(
    games.map((g: any) => [`${g.home?.sgo_team_id}|${g.away?.sgo_team_id}`, g.id])
  )

  // Which of our games' home/away SGO team pair a prop's team belongs to,
  // so we can attach game_id + team_id to props keyed only by playerSgoTeamId.
  const { data: teams, error: teamErr } = await db.from('teams').select('id, sgo_team_id')
  if (teamErr) throw teamErr
  const teamBySgoId = new Map<string, string>(
    (teams ?? []).map((t: any) => [t.sgo_team_id, t.id])
  )

  const times = games.map((g: any) => new Date(g.game_time).getTime())
  const windowStart = new Date(Math.min(...times) - 6 * 3600_000).toISOString()
  const windowEnd = new Date(Math.max(...times) + 6 * 3600_000).toISOString()

  const { playerProps } = await getWeekMarketData(windowStart, windowEnd)
  if (playerProps.length === 0) {
    console.log('SportsGameOdds returned no player props for this week yet (props usually post closer to kickoff than game lines).')
    return
  }

  // Map each prop's event to one of our games via the event's own team pair —
  // gameLines already proved the pairing works, but props don't carry the
  // opposing team, so match on eventID by cross-referencing the game lines
  // we'd get from the same payload isn't available here; instead we rely on
  // the player's own team being one of the two teams in *some* game this
  // week, which is unambiguous since each team plays exactly once per week.
  const gameByTeamSgoId = new Map<string, string>()
  gameBySgoTeams.forEach((gameId, pairKey) => {
    const [homeSgo, awaySgo] = pairKey.split('|')
    gameByTeamSgoId.set(homeSgo, gameId)
    gameByTeamSgoId.set(awaySgo, gameId)
  })

  const rows = playerProps
    .map((p) => {
      if (!p.playerSgoTeamId) return null
      const gameId = gameByTeamSgoId.get(p.playerSgoTeamId)
      if (!gameId) return null
      return {
        game_id: gameId,
        sportsbook: p.sportsbook,
        player_name: p.playerName,
        team_id: teamBySgoId.get(p.playerSgoTeamId) ?? null,
        market: p.market,
        line: p.line,
        over_price: p.overPrice,
        under_price: p.underPrice,
        source: 'sportsgameodds',
        captured_at: new Date().toISOString(),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length === 0) {
    console.log('No props matched to this week\'s games (teams may not have synced sgo_team_id yet).')
    return
  }

  const { error: insErr } = await db.from('player_props').insert(rows)
  if (insErr) throw insErr

  console.log(`Inserted ${rows.length} player prop snapshots for ${seasonYear} week ${week}.`)
  const byMarket = new Map<string, number>()
  for (const r of rows) byMarket.set(r.market, (byMarket.get(r.market) ?? 0) + 1)
  byMarket.forEach((count, market) => console.log(`  ${market}: ${count}`))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
