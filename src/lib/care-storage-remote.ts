import { getSupabaseBrowser } from './supabase-browser'
import type { PetProfile, CareLogEntry, PetRecord, CurrentVial } from './care-storage'

interface SetupData {
  insulinConcentration?: 'U-40' | 'U-100'
  vialSizeML?: number
  chfBaselineSRR?: number
  currentVial?: CurrentVial | null
}

interface CarePetRow {
  id: string
  name: string
  species: string
  condition: string
  created_at: string
  setup_data: SetupData | null
}

interface CareLogRow {
  id: string
  pet_id: string
  entry: CareLogEntry
  logged_at: string
}

function rowToProfile(row: CarePetRow): PetProfile {
  const setup = row.setup_data ?? {}
  return {
    id: row.id,
    name: row.name,
    species: row.species as PetProfile['species'],
    condition: row.condition as PetProfile['condition'],
    createdAt: row.created_at,
    ...(setup.insulinConcentration !== undefined && { insulinConcentration: setup.insulinConcentration }),
    ...(setup.vialSizeML !== undefined && { vialSizeML: setup.vialSizeML }),
    ...(setup.chfBaselineSRR !== undefined && { chfBaselineSRR: setup.chfBaselineSRR }),
  }
}

function buildRecord(row: CarePetRow, allLogs: CareLogRow[]): PetRecord {
  const logs = allLogs
    .filter((l) => l.pet_id === row.id)
    .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())
    .map((l) => l.entry)
  return {
    profile: rowToProfile(row),
    logs,
    currentVial: row.setup_data?.currentVial ?? null,
  }
}

async function readSetupData(petId: string): Promise<SetupData> {
  const supabase = getSupabaseBrowser()
  const { data } = await supabase.from('care_pets').select('setup_data').eq('id', petId).single()
  return (data?.setup_data as SetupData) ?? {}
}

export async function getAllPetsRemote(): Promise<PetRecord[]> {
  const supabase = getSupabaseBrowser()
  const { data: pets, error } = await supabase.from('care_pets').select('*')
  if (error || !pets || pets.length === 0) return []

  const petIds = pets.map((p: CarePetRow) => p.id)
  const { data: logs } = await supabase.from('care_logs').select('*').in('pet_id', petIds)

  return (pets as CarePetRow[]).map((p) => buildRecord(p, (logs as CareLogRow[]) ?? []))
}

export async function getPetRemote(petId: string): Promise<PetRecord | null> {
  const supabase = getSupabaseBrowser()
  const { data: pet, error } = await supabase.from('care_pets').select('*').eq('id', petId).single()
  if (error || !pet) return null

  const { data: logs } = await supabase.from('care_logs').select('*').eq('pet_id', petId)
  return buildRecord(pet as CarePetRow, (logs as CareLogRow[]) ?? [])
}

export async function createPetRemote(profile: Omit<PetProfile, 'id'>): Promise<PetRecord> {
  const supabase = getSupabaseBrowser()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const id = crypto.randomUUID()
  const setup: SetupData = {}
  if (profile.insulinConcentration !== undefined) setup.insulinConcentration = profile.insulinConcentration
  if (profile.vialSizeML !== undefined) setup.vialSizeML = profile.vialSizeML
  if (profile.chfBaselineSRR !== undefined) setup.chfBaselineSRR = profile.chfBaselineSRR

  const { data: pet, error: petError } = await supabase
    .from('care_pets')
    .insert({
      id,
      name: profile.name,
      species: profile.species,
      condition: profile.condition,
      created_at: profile.createdAt,
      setup_data: setup, // always an object; {} when empty. Column is NOT NULL.
      created_by: user.id,
    })
    .select()
    .single()

  if (petError || !pet) throw new Error(petError?.message ?? 'Failed to create pet')

  const { error: memberError } = await supabase.from('care_pet_members').insert({
    pet_id: id,
    user_id: user.id,
    role: 'owner',
  })
  if (memberError) throw new Error(memberError.message)

  return { profile: rowToProfile(pet as CarePetRow), logs: [], currentVial: null }
}

export async function saveProfileRemote(petId: string, profile: PetProfile): Promise<void> {
  const supabase = getSupabaseBrowser()
  const existing = await readSetupData(petId)
  const setup: SetupData = {
    ...existing,
    ...(profile.insulinConcentration !== undefined && { insulinConcentration: profile.insulinConcentration }),
    ...(profile.vialSizeML !== undefined && { vialSizeML: profile.vialSizeML }),
    ...(profile.chfBaselineSRR !== undefined && { chfBaselineSRR: profile.chfBaselineSRR }),
  }
  await supabase
    .from('care_pets')
    .update({ name: profile.name, species: profile.species, condition: profile.condition, setup_data: setup })
    .eq('id', petId)
}

export async function addLogEntryRemote(petId: string, entry: CareLogEntry): Promise<void> {
  const supabase = getSupabaseBrowser()
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('care_logs').insert({
    id: entry.id,
    pet_id: petId,
    entry: entry as unknown as Record<string, unknown>,
    logged_at: entry.timestamp,
    logged_by: user?.id,
  })
}

export async function deleteLogEntryRemote(petId: string, logId: string): Promise<void> {
  const supabase = getSupabaseBrowser()
  await supabase.from('care_logs').delete().eq('id', logId).eq('pet_id', petId)
}

export async function startNewVialRemote(petId: string, vial: CurrentVial): Promise<void> {
  const supabase = getSupabaseBrowser()
  const existing = await readSetupData(petId)
  await supabase.from('care_pets').update({ setup_data: { ...existing, currentVial: vial } }).eq('id', petId)
}

export async function updateInsulinDefaultsRemote(petId: string, concentration: 'U-40' | 'U-100', vialSizeML: number): Promise<void> {
  const supabase = getSupabaseBrowser()
  const existing = await readSetupData(petId)
  await supabase.from('care_pets').update({ setup_data: { ...existing, insulinConcentration: concentration, vialSizeML } }).eq('id', petId)
}

export async function updateCHFBaselineRemote(petId: string, baselineSRR: number): Promise<void> {
  const supabase = getSupabaseBrowser()
  const existing = await readSetupData(petId)
  await supabase.from('care_pets').update({ setup_data: { ...existing, chfBaselineSRR: baselineSRR } }).eq('id', petId)
}

export async function deletePetRemote(petId: string): Promise<void> {
  const supabase = getSupabaseBrowser()
  await supabase.from('care_pets').delete().eq('id', petId)
}
