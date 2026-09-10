// ============================================================================
// NFL Edge Board — OpenWeatherMap client (free tier)
//
// Pete's free-tier key only covers the 5-day/3-hour forecast endpoint (no
// 16-day daily forecast, no historical data — those need a paid plan). That
// means this only produces a real forecast for games kicking off within
// roughly the next 5 days; anything further out gets nothing back, by
// design, rather than a fabricated guess. Re-run sync-weather.ts closer to
// kickoff to pick games up as they enter that window.
//
// Domes/indoor stadiums never need a weather call at all — scoring.ts
// zeroes the wind penalty whenever isDome is true, so sync-weather.ts skips
// them outright rather than spending API calls on a number that won't be
// used.
// ============================================================================

const BASE = 'https://api.openweathermap.org/data/2.5'

export interface ForecastPoint {
  /** Forecast timestamp (UTC). */
  dt: string
  windMph: number
  tempF: number
  /** Probability of precipitation, 0-100. */
  precipPct: number
}

/**
 * Pulls the free 5-day/3-hour forecast for a lat/lon and returns the single
 * 3-hour bucket closest to `targetIso` (typically a game's kickoff time).
 * Returns null if OpenWeather has no bucket within 12 hours of the target
 * (kickoff is outside the free tier's ~5-day forecast horizon) or the call
 * fails for any reason (bad/inactive key, rate limit, etc.) — callers
 * should treat null as "no real data yet," never fall back to a guess.
 */
export async function getForecastNear(
  lat: number,
  lon: number,
  targetIso: string,
  apiKey: string
): Promise<ForecastPoint | null> {
  const url = `${BASE}/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    return null
  }
  if (!res.ok) return null

  const data = (await res.json()) as { list?: Array<{ dt: number; main: { temp: number }; wind: { speed: number }; pop: number }> }
  const list = data.list ?? []
  if (list.length === 0) return null

  const target = new Date(targetIso).getTime()
  let best: (typeof list)[number] | null = null
  let bestDiff = Infinity
  for (const point of list) {
    const diff = Math.abs(point.dt * 1000 - target)
    if (diff < bestDiff) {
      bestDiff = diff
      best = point
    }
  }
  if (!best || bestDiff > 12 * 3_600_000) return null // more than 12h from the nearest bucket — outside the useful forecast window

  return {
    dt: new Date(best.dt * 1000).toISOString(),
    windMph: Math.round(best.wind.speed * 10) / 10,
    tempF: Math.round(best.main.temp),
    precipPct: Math.round((best.pop ?? 0) * 100),
  }
}
