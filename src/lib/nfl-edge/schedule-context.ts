// ============================================================================
// NFL Edge Board — sandwich / lookahead spot detection
//
// A "sandwich" (trap) game is a normal-looking matchup wedged between two
// emotionally/competitively bigger ones — a team fresh off (or about to
// play) a divisional rival or a primetime game can come out flat against a
// lesser opponent in between. This is a real, documented professional
// handicapping signal (see the project's methodology doc, "Lookahead &
// Sandwich Spots"), not a fabricated one — it only needs the schedule
// already synced (272 games, seeded since the first build), no new data
// source.
//
// Deliberately a SOFT signal: it nudges the ATS confidence score down a
// little for the team at risk (see scoring.ts's sandwichPenaltyAts), the
// same way the existing divisional-game and QB-questionable penalties do.
// It does NOT touch the projected margin/total itself, since "a team might
// not bring its A-game" isn't a point value anyone has rigorously fit —
// just a documented tendency worth a small confidence haircut, not a
// rewritten projection.
// ============================================================================

export interface ScheduleGameRef {
  isDivisional: boolean
  gameTime: string
}

/**
 * Thursday or Monday (any kickoff time), or a Sunday kickoff at/after 7pm
 * ET, count as primetime. Evaluated in America/New_York since that's how
 * the NFL itself schedules "primetime" regardless of the matchup's actual
 * time zone.
 */
export function isPrimetimeSlot(gameTimeIso: string): boolean {
  const d = new Date(gameTimeIso)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(d)
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  if (weekday === 'Thu' || weekday === 'Mon') return true
  if (weekday === 'Sun' && hour >= 19) return true
  return false
}

export interface SandwichRisk {
  lookaheadRisk: boolean
  hangoverRisk: boolean
  reasons: string[]
}

/**
 * `thisGame` only counts as a trap spot if it's itself unremarkable — not
 * divisional, not primetime; a team playing a big game doesn't need a
 * "sandwich" excuse. `prevGame`/`nextGame` are that same team's immediately
 * adjacent games on the full-season schedule (null at a season's edges).
 */
export function deriveSandwichRisk(
  thisGame: ScheduleGameRef,
  prevGame: ScheduleGameRef | null,
  nextGame: ScheduleGameRef | null
): SandwichRisk {
  const reasons: string[] = []
  const thisIsBig = thisGame.isDivisional || isPrimetimeSlot(thisGame.gameTime)
  if (thisIsBig) return { lookaheadRisk: false, hangoverRisk: false, reasons }

  const nextIsBig = !!nextGame && (nextGame.isDivisional || isPrimetimeSlot(nextGame.gameTime))
  const prevIsBig = !!prevGame && (prevGame.isDivisional || isPrimetimeSlot(prevGame.gameTime))

  if (nextIsBig) reasons.push('bigger game up next')
  if (prevIsBig) reasons.push('coming off a bigger game')

  return { lookaheadRisk: nextIsBig, hangoverRisk: prevIsBig, reasons }
}
