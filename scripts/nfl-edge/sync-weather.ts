// ============================================================================
// NFL Edge Board — weather sync (OpenWeatherMap, free tier)
//
// Fills nfl_edge.weather_snapshots so scoring.ts's wind penalty (already
// wired up in generate.ts — it reads this table today, it just had nothing
// to read) is driven by a real forecast instead of always defaulting to 0.
//
// Free-tier limitation, real and worth remembering: OpenWeather's free key
// only covers the 5-day/3-hour forecast endpoint (no 16-day daily forecast,
// no historical data). A game kicking off more than ~5 days out gets
// skipped — not guessed at — and picked up on a later re-run as it enters
// that window. Safe to re-run anytime through the week; each run
// overwrites that game's prior snapshot (delete-then-insert per game_id,
// same idempotency pattern as sync-injuries.ts).
//
// Domes/indoor stadiums are written with is_dome_or_indoor = true and no
// API call at all — scoring.ts already zeroes the wind penalty whenever
// isDome is true, so there's nothing a forecast would add there.
//
// Usage:  npx tsx scripts/nfl-edge/sync-weather.ts <seasonYear> <week>
// ============================================================================
import { config } from 'dotenv'
config({ path: '.env.local' }) // scripts run outside Next.js, which is what normally loads .env.local
import { nflEdgeDb } from '../../src/lib/nfl-edge/supabase-admin'
import { getForecastNear } from '../../src/lib/nfl-edge/openweather'

const seasonYear = Number(process.argv[2])
const week = Number(process.argv[3])

if (!seasonYear || !week) {
  console.error('Usage: npx tsx scripts/nfl-edge/sync-weather.ts <seasonYear> <week>')
  process.exit(1)
}

async function main() {
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) {
    console.error('Missing OPENWEATHER_API_KEY in .env.local')
    process.exit(1)
  }

  const db = nflEdgeDb()

  const { data: games, error: gamesErr } = await db
    .from('games')
    .select('id, game_time, home_team:home_team_id(id, lat, lon, is_dome)')
    .eq('season_year', seasonYear)
    .eq('week_number', week)
  if (gamesErr) throw gamesErr
  if (!games || games.length === 0) {
    console.log(`No games found for ${seasonYear} week ${week} — run sync-schedule.ts first.`)
    return
  }

  let written = 0
  let skippedOutOfRange = 0
  for (const game of games as any[]) {
    const team = game.home_team
    await db.from('weather_snapshots').delete().eq('game_id', game.id)

    if (team?.is_dome) {
      const { error } = await db.from('weather_snapshots').insert({
        game_id: game.id,
        wind_mph: 0,
        temp_f: null,
        precip_pct: null,
        is_dome_or_indoor: true,
        source: 'openweathermap',
      })
      if (error) console.error(`Insert failed (dome) for game ${game.id}:`, error.message)
      else written++
      console.log(`${game.id}: dome — no forecast needed`)
      continue
    }

    if (team?.lat === null || team?.lat === undefined || team?.lon === null || team?.lon === undefined) {
      console.log(`${game.id}: home team has no lat/lon on file — skipping`)
      continue
    }

    const forecast = await getForecastNear(team.lat, team.lon, game.game_time, apiKey)
    if (!forecast) {
      skippedOutOfRange++
      console.log(`${game.id}: no forecast available yet (likely outside the 5-day free-tier window) — re-run closer to kickoff`)
      continue
    }

    const { error } = await db.from('weather_snapshots').insert({
      game_id: game.id,
      wind_mph: forecast.windMph,
      temp_f: forecast.tempF,
      precip_pct: forecast.precipPct,
      is_dome_or_indoor: false,
      source: 'openweathermap',
    })
    if (error) {
      console.error(`Insert failed for game ${game.id}:`, error.message)
      continue
    }
    written++
    console.log(`${game.id}: wind ${forecast.windMph}mph, ${forecast.tempF}°F, ${forecast.precipPct}% precip (forecast for ${forecast.dt})`)
  }

  console.log(`Done. ${written} weather snapshots written, ${skippedOutOfRange} game(s) outside the 5-day forecast window.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
