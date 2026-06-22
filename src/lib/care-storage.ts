export interface PetProfile {
  id: string
  name: string
  species: 'cat' | 'dog'
  condition: 'feline_diabetes' | 'chf'
  createdAt: string
  // feline_diabetes fields
  insulinConcentration?: 'U-40' | 'U-100'
  vialSizeML?: number
  // chf fields
  chfBaselineSRR?: number
}

interface BaseLogEntry {
  id: string
  date: string       // YYYY-MM-DD
  timestamp: string  // full ISO
}

export interface DiabetesLogEntry extends BaseLogEntry {
  condition: 'feline_diabetes'
  bloodGlucose: number
  insulinUnits: number
  insulinType: string
  appetite: 'poor' | 'normal' | 'ravenous'
}

export interface CHFLogEntry extends BaseLogEntry {
  condition: 'chf'
  srrBpm: number
  lethargyLevel: 1 | 2 | 3 | 4 | 5
}

export type CareLogEntry = DiabetesLogEntry | CHFLogEntry

export interface CurrentVial {
  startedAt: string               // ISO timestamp
  concentration: 'U-40' | 'U-100'
  vialSizeML: number
  unitsAlreadyUsedAtStart: number
}

export interface PetRecord {
  profile: PetProfile
  logs: CareLogEntry[]
  currentVial: CurrentVial | null
}

interface PetStore {
  pets: Record<string, PetRecord>
}

const STORAGE_KEY = 'tailcue_care_data_v2'

const DEFAULT_STORE: PetStore = { pets: {} }

function read(): PetStore {
  if (typeof window === 'undefined') return DEFAULT_STORE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STORE
    const parsed = JSON.parse(raw)
    if (!parsed.pets || typeof parsed.pets !== 'object') return DEFAULT_STORE
    return parsed as PetStore
  } catch {
    return DEFAULT_STORE
  }
}

function write(store: PetStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // storage quota exceeded — fail silently
  }
}

export function getAllPets(): PetRecord[] {
  return Object.values(read().pets)
}

export function getPet(petId: string): PetRecord | null {
  return read().pets[petId] ?? null
}

export function createPet(profile: Omit<PetProfile, 'id'>): PetRecord {
  const id = crypto.randomUUID()
  const fullProfile: PetProfile = { id, ...profile }
  const record: PetRecord = { profile: fullProfile, logs: [], currentVial: null }
  const store = read()
  store.pets[id] = record
  write(store)
  return record
}

export function saveProfile(petId: string, profile: PetProfile): void {
  const store = read()
  if (!store.pets[petId]) return
  store.pets[petId] = { ...store.pets[petId], profile }
  write(store)
}

export function addLogEntry(petId: string, entry: CareLogEntry): void {
  const store = read()
  if (!store.pets[petId]) return
  store.pets[petId] = {
    ...store.pets[petId],
    logs: [entry, ...store.pets[petId].logs],
  }
  write(store)
}

export function deleteLogEntry(petId: string, logId: string): void {
  const store = read()
  if (!store.pets[petId]) return
  store.pets[petId] = {
    ...store.pets[petId],
    logs: store.pets[petId].logs.filter((l) => l.id !== logId),
  }
  write(store)
}

export function startNewVial(petId: string, vial: CurrentVial): void {
  const store = read()
  if (!store.pets[petId]) return
  store.pets[petId] = { ...store.pets[petId], currentVial: vial }
  write(store)
}

export function updateInsulinDefaults(petId: string, concentration: 'U-40' | 'U-100', vialSizeML: number): void {
  const store = read()
  if (!store.pets[petId]) return
  store.pets[petId] = {
    ...store.pets[petId],
    profile: { ...store.pets[petId].profile, insulinConcentration: concentration, vialSizeML },
  }
  write(store)
}

export function updateCHFBaseline(petId: string, baselineSRR: number): void {
  const store = read()
  if (!store.pets[petId]) return
  store.pets[petId] = {
    ...store.pets[petId],
    profile: { ...store.pets[petId].profile, chfBaselineSRR: baselineSRR },
  }
  write(store)
}

export function deletePet(petId: string): void {
  const store = read()
  delete store.pets[petId]
  write(store)
}
