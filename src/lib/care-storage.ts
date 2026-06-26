export interface PetProfile {
  id: string
  name: string
  species: 'cat' | 'dog'
  condition: 'feline_diabetes' | 'chf' | 'chronic_kidney_disease' | 'cushings_disease' | 'osteoarthritis' | 'epilepsy' | 'feline_hyperthyroidism' | 'ibd' | 'cognitive_dysfunction' | 'degenerative_myelopathy'
  createdAt: string
  memorializedAt?: string | null
  createdBy?: string
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

export interface CKDLogEntry extends BaseLogEntry {
  condition: 'chronic_kidney_disease'
  subqFluidMl: number | null
  vomitingCount: number
  skinTurgor: 'normal' | 'sticky' | 'tented'
  appetite: 'normal' | 'reduced' | 'refused'
  lethargyScore: number
  notes?: string
}

export interface CushingsLogEntry extends BaseLogEntry {
  condition: 'cushings_disease'
  waterIntake: 'normal' | 'elevated' | 'excessive'
  indoorAccidents: boolean
  lethargyScore: number
  appetite: 'normal' | 'reduced' | 'refused'
  vomitingOrDiarrhea: boolean
  medicationGiven: boolean
  notes?: string
}

export interface OALogEntry extends BaseLogEntry {
  condition: 'osteoarthritis'
  easOfRising: 'smooth' | 'hesitant' | 'refused'
  stairsNegotiated: 'yes' | 'assisted' | 'refused' | 'no_stairs'
  jumpingAttempted: 'yes' | 'hesitant' | 'no'
  painMedGiven: boolean
  overallMobilityScore: number
  notes?: string
}

export interface EpilepsyLogEntry extends BaseLogEntry {
  condition: 'epilepsy'
  durationMinutes: number
  severity: 'mild' | 'moderate' | 'severe'
  postIctalMinutes: number
  notes?: string
}

export interface HyperthyroidismLogEntry extends BaseLogEntry {
  condition: 'feline_hyperthyroidism'
  medicationGiven: boolean
  appetite: 'normal' | 'reduced' | 'ravenous'
  weightChange: 'stable' | 'losing'
  vomitingCount: number
  lethargyScore: number
  facialScratching: boolean
  yellowSkinOrGums: boolean
  bleedingOrBruising: boolean
  notes?: string
}

export interface IBDLogEntry extends BaseLogEntry {
  condition: 'ibd'
  stoolConsistency: 'normal' | 'soft' | 'watery' | 'bloody'
  vomitingCount: number
  appetite: 'normal' | 'reduced' | 'refused'
  weightChange: 'stable' | 'losing'
  dietCompliance: boolean
  lethargyScore: number
  notes?: string
}

export interface CDSLogEntry extends BaseLogEntry {
  condition: 'cognitive_dysfunction'
  disorientation: 'none' | 'sometimes' | 'often'
  socialInteraction: 'normal' | 'reduced' | 'changed'
  sleepChanges: 'none' | 'mild' | 'significant'
  houseTraining: 'normal' | 'occasional_accidents' | 'frequent_accidents'
  activityChanges: 'normal' | 'less_active' | 'aimless_pacing'
  anxiety: 'none' | 'mild' | 'significant'
  notes?: string
}

export interface DMLogEntry extends BaseLogEntry {
  condition: 'degenerative_myelopathy'
  hindLimbWalking: 'normal_gait' | 'wobbling_or_weak' | 'knuckling' | 'cannot_walk'
  canRiseUnassisted: 'yes' | 'with_difficulty' | 'no'
  pawPlacement: 'normal' | 'knuckling_occasional' | 'knuckling_constant'
  continenceStatus: 'continent' | 'occasional_accident' | 'incontinent'
  forelimbStrength: 'normal' | 'mild_weakness' | 'significant_weakness'
  rehabDoneToday: boolean
  notes?: string
}

export type CareLogEntry = DiabetesLogEntry | CHFLogEntry | CKDLogEntry | CushingsLogEntry | OALogEntry | EpilepsyLogEntry | HyperthyroidismLogEntry | IBDLogEntry | CDSLogEntry | DMLogEntry

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

import { getSupabaseBrowser } from './supabase-browser'
import {
  getAllPetsRemote, getPetRemote, createPetRemote, saveProfileRemote,
  addLogEntryRemote, deleteLogEntryRemote, startNewVialRemote,
  updateInsulinDefaultsRemote, updateCHFBaselineRemote, deletePetRemote,
  memorializePetRemote, restorePetRemote,
} from './care-storage-remote'

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

export function getAllPetsLocal(): PetRecord[] {
  return Object.values(read().pets)
}

export function getLocalEntryCount(): number {
  return getAllPetsLocal().reduce((sum, p) => sum + p.logs.length, 0)
}

export function clearLocalStore(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

function getPetLocal(petId: string): PetRecord | null {
  return read().pets[petId] ?? null
}

function createPetLocal(profile: Omit<PetProfile, 'id'>): PetRecord {
  const id = crypto.randomUUID()
  const fullProfile: PetProfile = { id, ...profile }
  const record: PetRecord = { profile: fullProfile, logs: [], currentVial: null }
  const store = read()
  store.pets[id] = record
  write(store)
  return record
}

function saveProfileLocal(petId: string, profile: PetProfile): void {
  const store = read()
  if (!store.pets[petId]) return
  store.pets[petId] = { ...store.pets[petId], profile }
  write(store)
}

function addLogEntryLocal(petId: string, entry: CareLogEntry): void {
  const store = read()
  if (!store.pets[petId]) return
  store.pets[petId] = {
    ...store.pets[petId],
    logs: [entry, ...store.pets[petId].logs],
  }
  write(store)
}

function deleteLogEntryLocal(petId: string, logId: string): void {
  const store = read()
  if (!store.pets[petId]) return
  store.pets[petId] = {
    ...store.pets[petId],
    logs: store.pets[petId].logs.filter((l) => l.id !== logId),
  }
  write(store)
}

function startNewVialLocal(petId: string, vial: CurrentVial): void {
  const store = read()
  if (!store.pets[petId]) return
  store.pets[petId] = { ...store.pets[petId], currentVial: vial }
  write(store)
}

function updateInsulinDefaultsLocal(petId: string, concentration: 'U-40' | 'U-100', vialSizeML: number): void {
  const store = read()
  if (!store.pets[petId]) return
  store.pets[petId] = {
    ...store.pets[petId],
    profile: { ...store.pets[petId].profile, insulinConcentration: concentration, vialSizeML },
  }
  write(store)
}

function updateCHFBaselineLocal(petId: string, baselineSRR: number): void {
  const store = read()
  if (!store.pets[petId]) return
  store.pets[petId] = {
    ...store.pets[petId],
    profile: { ...store.pets[petId].profile, chfBaselineSRR: baselineSRR },
  }
  write(store)
}

function deletePetLocal(petId: string): void {
  const store = read()
  delete store.pets[petId]
  write(store)
}

function memorializePetLocal(petId: string): void {
  const store = read()
  const rec = store.pets[petId]
  if (rec) {
    rec.profile.memorializedAt = new Date().toISOString()
    write(store)
  }
}

function restorePetLocal(petId: string): void {
  const store = read()
  const rec = store.pets[petId]
  if (rec) {
    rec.profile.memorializedAt = null
    write(store)
  }
}

async function isAuthed(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const supabase = getSupabaseBrowser()
  const { data: { session } } = await supabase.auth.getSession()
  return session !== null
}

export async function getAllPets(): Promise<PetRecord[]> {
  return (await isAuthed()) ? getAllPetsRemote() : getAllPetsLocal()
}

export async function getPet(petId: string): Promise<PetRecord | null> {
  return (await isAuthed()) ? getPetRemote(petId) : getPetLocal(petId)
}

export async function createPet(profile: Omit<PetProfile, 'id'>): Promise<PetRecord> {
  return (await isAuthed()) ? createPetRemote(profile) : createPetLocal(profile)
}

export async function saveProfile(petId: string, profile: PetProfile): Promise<void> {
  return (await isAuthed()) ? saveProfileRemote(petId, profile) : saveProfileLocal(petId, profile)
}

export async function addLogEntry(petId: string, entry: CareLogEntry): Promise<void> {
  return (await isAuthed()) ? addLogEntryRemote(petId, entry) : addLogEntryLocal(petId, entry)
}

export async function deleteLogEntry(petId: string, logId: string): Promise<void> {
  return (await isAuthed()) ? deleteLogEntryRemote(petId, logId) : deleteLogEntryLocal(petId, logId)
}

export async function startNewVial(petId: string, vial: CurrentVial): Promise<void> {
  return (await isAuthed()) ? startNewVialRemote(petId, vial) : startNewVialLocal(petId, vial)
}

export async function updateInsulinDefaults(petId: string, concentration: 'U-40' | 'U-100', vialSizeML: number): Promise<void> {
  return (await isAuthed()) ? updateInsulinDefaultsRemote(petId, concentration, vialSizeML) : updateInsulinDefaultsLocal(petId, concentration, vialSizeML)
}

export async function updateCHFBaseline(petId: string, baselineSRR: number): Promise<void> {
  return (await isAuthed()) ? updateCHFBaselineRemote(petId, baselineSRR) : updateCHFBaselineLocal(petId, baselineSRR)
}

export async function deletePet(petId: string): Promise<void> {
  return (await isAuthed()) ? deletePetRemote(petId) : deletePetLocal(petId)
}

export async function memorializePet(petId: string): Promise<void> {
  return (await isAuthed()) ? memorializePetRemote(petId) : memorializePetLocal(petId)
}

export async function restorePet(petId: string): Promise<void> {
  return (await isAuthed()) ? restorePetRemote(petId) : restorePetLocal(petId)
}

export {
  createInvite,
  listInvites,
  revokeInvite,
  redeemInvite,
} from './care-storage-remote'
export type { InviteRow } from './care-storage-remote'
