import type { CareLogEntry, CurrentVial } from './care-storage'

export type SupplyStatus = 'no_vial_started' | 'insufficient_data' | 'ok' | 'low' | 'unknown'

export interface SupplyEstimate {
  status: SupplyStatus
  daysRemaining: number | null
  unitsRemaining: number | null
  message: string
}

export function estimateInsulinSupply(
  logs: CareLogEntry[],
  currentVial: CurrentVial | null
): SupplyEstimate {
  if (!currentVial) {
    return {
      status: 'no_vial_started',
      daysRemaining: null,
      unitsRemaining: null,
      message: 'Set up your current vial to track supply.',
    }
  }

  const { concentration, vialSizeML, startedAt, unitsAlreadyUsedAtStart } = currentVial
  const unitsPerML = concentration === 'U-40' ? 40 : 100
  const totalUnitsPerVial = unitsPerML * vialSizeML

  const vialStartTime = new Date(startedAt).getTime()
  const now = Date.now()
  const msPerDay = 1000 * 60 * 60 * 24

  // Logs recorded since this vial was started
  const vialLogs = logs.filter((l) => new Date(l.timestamp).getTime() >= vialStartTime)
  const newUnitsLogged = vialLogs.reduce((sum, l) => sum + l.insulinUnits, 0)
  const unitsUsedSoFar = unitsAlreadyUsedAtStart + newUnitsLogged
  const unitsRemaining = Math.max(0, totalUnitsPerVial - unitsUsedSoFar)

  // Days elapsed since vial start — minimum 1 to avoid divide-by-zero on day one
  const daysElapsedSinceVialStart = Math.max(1, (now - vialStartTime) / msPerDay)

  let dailyRate: number | null = null

  // Primary: use only newly-logged units for the rate (no history for unitsAlreadyUsedAtStart)
  const distinctVialDays = new Set(vialLogs.map((l) => l.date)).size
  if (daysElapsedSinceVialStart >= 2 && distinctVialDays >= 2) {
    dailyRate = newUnitsLogged / daysElapsedSinceVialStart
  } else {
    // Fallback: average per logged day across the last 14 days of all history
    const cutoff14 = new Date()
    cutoff14.setDate(cutoff14.getDate() - 14)
    cutoff14.setHours(0, 0, 0, 0)
    const last14Logs = logs.filter((l) => new Date(l.timestamp) >= cutoff14)
    const distinctDays14 = new Set(last14Logs.map((l) => l.date)).size
    if (distinctDays14 >= 2) {
      const totalUnits14 = last14Logs.reduce((sum, l) => sum + l.insulinUnits, 0)
      dailyRate = totalUnits14 / distinctDays14
    }
  }

  if (dailyRate === null) {
    return {
      status: 'insufficient_data',
      daysRemaining: null,
      unitsRemaining,
      message: 'Log a few more days to estimate how long this vial will last.',
    }
  }

  if (dailyRate <= 0 || !isFinite(dailyRate)) {
    return {
      status: 'unknown',
      daysRemaining: null,
      unitsRemaining,
      message: 'Unable to estimate supply from current data.',
    }
  }

  const daysRemaining = Math.floor(unitsRemaining / dailyRate)

  if (daysRemaining <= 7) {
    return {
      status: 'low',
      daysRemaining,
      unitsRemaining,
      message: `About ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} of insulin left in this vial.`,
    }
  }

  return {
    status: 'ok',
    daysRemaining,
    unitsRemaining,
    message: `About ${daysRemaining} days of insulin left in this vial.`,
  }
}
