export interface PetProfile {
  name: string
  species: 'cat'
  condition: 'feline_diabetes'
  createdAt: string
  insulinConcentration?: 'U-40' | 'U-100'
  vialSizeML?: number
}

export interface CareLogEntry {
  id: string
  date: string       // YYYY-MM-DD
  timestamp: string  // full ISO
  bloodGlucose: number
  insulinUnits: number
  insulinType: string
  appetite: 'poor' | 'normal' | 'ravenous'
}

export interface CurrentVial {
  startedAt: string               // ISO timestamp
  concentration: 'U-40' | 'U-100'
  vialSizeML: number
  unitsAlreadyUsedAtStart: number
}

export interface CareData {
  profile: PetProfile | null
  logs: CareLogEntry[]
  currentVial: CurrentVial | null
}

const STORAGE_KEY = 'tailcue_care_data'

const DEFAULT: CareData = { profile: null, logs: [], currentVial: null }

function read(): CareData {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as CareData
    return {
      profile: parsed.profile ?? null,
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      currentVial: parsed.currentVial ?? null,
    }
  } catch {
    return DEFAULT
  }
}

function write(data: CareData): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // storage quota exceeded — fail silently
  }
}

export function getCareData(): CareData {
  return read()
}

export function saveProfile(profile: PetProfile): void {
  const data = read()
  write({ ...data, profile })
}

export function addLogEntry(entry: CareLogEntry): void {
  const data = read()
  write({ ...data, logs: [entry, ...data.logs] })
}

export function deleteLogEntry(id: string): void {
  const data = read()
  write({ ...data, logs: data.logs.filter((l) => l.id !== id) })
}

export function getLogsForLastNDays(n: number): CareLogEntry[] {
  const data = read()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - n)
  cutoff.setHours(0, 0, 0, 0)
  return data.logs.filter((l) => new Date(l.timestamp) >= cutoff)
}

export function startNewVial(
  concentration: 'U-40' | 'U-100',
  vialSizeML: number,
  unitsAlreadyUsedAtStart: number = 0
): void {
  const data = read()
  write({
    ...data,
    currentVial: {
      startedAt: new Date().toISOString(),
      concentration,
      vialSizeML,
      unitsAlreadyUsedAtStart,
    },
  })
}

export function updateInsulinDefaults(concentration: 'U-40' | 'U-100', vialSizeML: number): void {
  const data = read()
  if (!data.profile) return
  write({
    ...data,
    profile: { ...data.profile, insulinConcentration: concentration, vialSizeML },
  })
}
