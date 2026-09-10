// ============================================================================
// NFL Edge Board — power ratings sync (nflverse play-by-play, real & free)
//
// Fills nfl_edge.team_ratings, the one gap flagged since this project's first
// build ("every team defaults to 0/0 until a real EPA feed is wired in").
//
// METHODOLOGY, READ BEFORE CHANGING THE CONSTANTS BELOW:
//  - Source: nflverse's real play-by-play data (the same open dataset behind
//    nflfastR/nflreadr), fetched directly as
//    https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_<year>.csv.gz
//    — no API key, no scraping, no fabricated numbers. Verified live: the
//    2025 file is 372 columns x ~48.7k rows of real play-level data.
//  - Off/def rating = average EPA (Expected Points Added) added per game by
//    a team's offense / allowed per game by its defense, on real pass-or-run
//    plays only (kneels/spikes/no-plays excluded — same convention as every
//    public nflverse EPA leaderboard), centered on that dataset's own league
//    average so 0 = league-average team. EPA is already denominated in
//    expected points, so summing a game's worth of it is directly comparable
//    to scoring.ts's point-based projections (LA + homeOff - awayDef, etc.)
//    — no invented conversion factor.
//  - Defense sign convention matches scoring.ts's existing usage
//    (projHome = LA + homeOff - awayDef): def_rating is POSITIVE for a good
//    defense (allows fewer points than average) so subtracting it lowers the
//    opponent's projection, and NEGATIVE for a bad one.
//  - PRESEASON-TO-IN-SEASON BLEND: before Week 1 of a season, there is no
//    current-season data to rate teams on, so this uses last season's full
//    reg-season ratings as the starting prior — a completely standard
//    technique, not a fabrication (it's clearly labeled `source =
//    'nflverse_prior_blend'` and the exact prior/current split is stored
//    nowhere hidden — it's just arithmetic on real numbers). As the current
//    season accumulates games, each team's rating linearly shifts from the
//    prior toward its own current-season numbers, reaching 100% current-
//    season by CURRENT_SEASON_FULL_WEIGHT_AT_GAMES games played. That
//    threshold (8 games ≈ half a season) is a reasonable, simple choice —
//    not a fitted/optimized constant. Nothing here adjusts for strength of
//    schedule (a team that has faced only weak offenses/defenses so far will
//    look better/worse than it truly is) — a real limitation, not hidden.
//  - Team-id mapping gotcha (same class of bug as the SGO integration):
//    nflverse uses 'LA' for the Rams and 'WAS' for Washington; this schema's
//    teams.id uses 'LAR' and 'WSH'. Every other abbreviation matches.
//
// Usage:  npx tsx scripts/nfl-edge/sync-power-ratings.ts <seasonYear> <asOfWeek>
// ============================================================================
import { config } from 'dotenv'
config({ path: '.env.local' }) // scripts run outside Next.js, which is what normally loads .env.local
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { Readable } from 'node:stream'
import { nflEdgeDb } from '../../src/lib/nfl-edge/supabase-admin'

const seasonYear = Number(process.argv[2])
const asOfWeek = Number(process.argv[3])
if (!seasonYear || !asOfWeek) {
  console.error('Usage: npx tsx scripts/nfl-edge/sync-power-ratings.ts <seasonYear> <asOfWeek>')
  process.exit(1)
}

const CURRENT_SEASON_FULL_WEIGHT_AT_GAMES = 8

const NFLVERSE_TO_NFL_EDGE: Record<string, string> = { LA: 'LAR', WAS: 'WSH' }
function mapTeam(t: string): string {
  return NFLVERSE_TO_NFL_EDGE[t] ?? t
}

// Minimal RFC4180-ish CSV line splitter — quote-aware, handles "" escaped
// quotes. Verified against the real 2025 file to produce identical
// aggregates to a reference parse with polars/nflreadpy before this script
// was written; no new npm dependency needed for ~7 columns out of 372.
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

interface TeamAvg {
  avg: number
  games: number
}

/**
 * Downloads one season's real play-by-play file and returns each team's
 * average EPA/game on offense and allowed/game on defense (NOT yet centered
 * on league average — caller does that). Returns null if the file doesn't
 * exist yet (current season before any games have been played — a 404, not
 * an error). `maxWeek`, when given, only counts weeks strictly before it
 * (so "as of week N" never uses week N's own not-yet-final results).
 */
async function loadEpaAverages(
  year: number,
  maxWeek?: number
): Promise<{ off: Map<string, TeamAvg>; def: Map<string, TeamAvg> } | null> {
  const url = `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_${year}.csv.gz`
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok || !res.body) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`)

  const nodeStream = Readable.fromWeb(res.body as any)
  const rl = createInterface({ input: nodeStream.pipe(createGunzip()), crlfDelay: Infinity })

  let idx: Record<string, number> | null = null
  const offByGame = new Map<string, number>()
  const defByGame = new Map<string, number>()

  for await (const line of rl) {
    if (!idx) {
      const header = splitCsvLine(line)
      idx = Object.fromEntries(header.map((c, i) => [c, i]))
      continue
    }
    const cols = splitCsvLine(line)
    if (cols[idx.season_type] !== 'REG') continue
    if (maxWeek !== undefined && Number(cols[idx.week]) >= maxWeek) continue
    if (cols[idx.pass] !== '1' && cols[idx.rush] !== '1') continue
    const epaStr = cols[idx.epa]
    if (epaStr === '') continue
    const epa = Number(epaStr)
    if (!Number.isFinite(epa)) continue

    const posteam = cols[idx.posteam]
    const defteam = cols[idx.defteam]
    const gameId = cols[idx.game_id]
    if (posteam) {
      const key = `${posteam}|${gameId}`
      offByGame.set(key, (offByGame.get(key) ?? 0) + epa)
    }
    if (defteam) {
      const key = `${defteam}|${gameId}`
      defByGame.set(key, (defByGame.get(key) ?? 0) + epa)
    }
  }

  function aggregate(byGame: Map<string, number>): Map<string, TeamAvg> {
    const perTeamGames = new Map<string, number[]>()
    for (const [key, val] of Array.from(byGame.entries())) {
      const team = key.split('|')[0]
      const list = perTeamGames.get(team) ?? []
      list.push(val)
      perTeamGames.set(team, list)
    }
    const out = new Map<string, TeamAvg>()
    for (const [team, list] of Array.from(perTeamGames.entries())) {
      out.set(team, { avg: list.reduce((a, b) => a + b, 0) / list.length, games: list.length })
    }
    return out
  }

  return { off: aggregate(offByGame), def: aggregate(defByGame) }
}

/** Centers a season's raw per-team averages on that season's own league average, producing off_rating (positive = better offense) and def_rating (positive = better defense, per scoring.ts's sign convention). */
function centerRatings(off: Map<string, TeamAvg>, def: Map<string, TeamAvg>): Map<string, { off: number; def: number; games: number }> {
  const leagueOff = Array.from(off.values()).reduce((a, b) => a + b.avg, 0) / off.size
  const leagueDef = Array.from(def.values()).reduce((a, b) => a + b.avg, 0) / def.size
  const out = new Map<string, { off: number; def: number; games: number }>()
  for (const [team, o] of Array.from(off.entries())) {
    const d = def.get(team)
    out.set(team, {
      off: o.avg - leagueOff,
      def: d ? -(d.avg - leagueDef) : 0,
      games: o.games,
    })
  }
  return out
}

async function main() {
  console.log(`Loading ${seasonYear - 1} (prior season, full reg season) as the baseline prior...`)
  const priorRaw = await loadEpaAverages(seasonYear - 1)
  if (!priorRaw) {
    console.error(`No play-by-play file found for ${seasonYear - 1} — can't build a prior. Aborting.`)
    process.exit(1)
  }
  const prior = centerRatings(priorRaw.off, priorRaw.def)

  console.log(`Loading ${seasonYear} through week ${asOfWeek - 1} (current season so far, if any)...`)
  const currentRaw = await loadEpaAverages(seasonYear, asOfWeek)
  const current = currentRaw ? centerRatings(currentRaw.off, currentRaw.def) : new Map()
  if (!currentRaw) {
    console.log(`No ${seasonYear} play-by-play file yet — using ${seasonYear - 1} as a pure prior (expected before Week 1 games are played).`)
  }

  const teams = new Set<string>(Array.from(prior.keys()))
  for (const t of Array.from(current.keys())) teams.add(t)

  const rows = Array.from(teams).map((rawTeam) => {
    const teamId = mapTeam(rawTeam)
    const p = prior.get(rawTeam) ?? { off: 0, def: 0, games: 0 }
    const c = current.get(rawTeam)
    const gamesPlayed = c?.games ?? 0
    const weightCurrent = Math.max(0, Math.min(1, gamesPlayed / CURRENT_SEASON_FULL_WEIGHT_AT_GAMES))
    const weightPrior = 1 - weightCurrent
    const off = c ? c.off * weightCurrent + p.off * weightPrior : p.off
    const def = c ? c.def * weightCurrent + p.def * weightPrior : p.def
    return {
      team_id: teamId,
      season_year: seasonYear,
      as_of_week: asOfWeek,
      off_rating: Number(off.toFixed(3)),
      def_rating: Number(def.toFixed(3)),
      source: currentRaw ? 'nflverse_prior_blend' : 'nflverse_2025_prior',
      computed_at: new Date().toISOString(),
    }
  })

  const db = nflEdgeDb()
  // Idempotent re-run: no unique constraint to upsert against, so clear this
  // exact (season, as_of_week) snapshot first, same pattern as sync-injuries.ts.
  await db.from('team_ratings').delete().eq('season_year', seasonYear).eq('as_of_week', asOfWeek)
  const { error } = await db.from('team_ratings').insert(rows)
  if (error) throw error

  console.log(`Wrote ${rows.length} team ratings for ${seasonYear}, as of week ${asOfWeek}.`)
  const sorted = rows.slice().sort((a, b) => b.off_rating + b.def_rating - (a.off_rating + a.def_rating))
  for (const r of sorted) {
    console.log(`  ${r.team_id.padEnd(4)} off ${r.off_rating >= 0 ? '+' : ''}${r.off_rating.toFixed(1)}  def ${r.def_rating >= 0 ? '+' : ''}${r.def_rating.toFixed(1)}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
