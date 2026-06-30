import { getSupabaseBrowser } from './supabase-browser'
import { getAllPetsLocal, clearLocalStore } from './care-storage'

/**
 * Per-pet import of localStorage Care data into Supabase on sign-in.
 *
 * Imports each local pet whose id doesn't already exist remotely. Skips
 * (by id) pets that are already in the account — we do NOT attempt to merge
 * logs or meds into an existing remote pet; migration is pet-level only.
 *
 * Writes in pet → member → logs → medications order so RLS WITH CHECK
 * (care_is_member(pet_id)) passes for both care_logs and care_medications.
 *
 * Returns the number of pets actually imported (0 if nothing to do).
 */
export async function migrateLocalToRemote(): Promise<number> {
  const supabase = getSupabaseBrowser()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const localPets = getAllPetsLocal()
  if (localPets.length === 0) return 0

  const { data: existingPets, error: existErr } = await supabase
    .from('care_pets')
    .select('id')
  if (existErr) {
    console.error('Care migrate: existence check failed', existErr)
    return 0
  }
  const existingIds = new Set((existingPets ?? []).map((r: { id: string }) => r.id))

  let imported = 0
  for (const rec of localPets) {
    const p = rec.profile
    if (existingIds.has(p.id)) continue  // already remote — skip entire pet, no merge

    const setup: Record<string, unknown> = {}
    if (p.insulinConcentration !== undefined) setup.insulinConcentration = p.insulinConcentration
    if (p.vialSizeML !== undefined) setup.vialSizeML = p.vialSizeML
    if (p.chfBaselineSRR !== undefined) setup.chfBaselineSRR = p.chfBaselineSRR
    if (rec.currentVial) setup.currentVial = rec.currentVial

    // 1) pet
    const { error: petErr } = await supabase.from('care_pets').insert({
      id: p.id,
      name: p.name,
      species: p.species,
      condition: p.condition,
      created_at: p.createdAt,
      memorialized_at: p.memorializedAt ?? null,
      setup_data: setup,
      created_by: user.id,
    })
    if (petErr) throw new Error(`Care migrate: pet insert failed (${p.name}): ${petErr.message}`)

    // 2) owner membership — MUST exist before logs (care_logs RLS depends on it)
    const { error: memErr } = await supabase.from('care_pet_members').insert({
      pet_id: p.id,
      user_id: user.id,
      role: 'owner',
    })
    if (memErr) throw new Error(`Care migrate: member insert failed (${p.name}): ${memErr.message}`)

    // 3) logs (batch, preserving ids + backdated timestamps)
    if (rec.logs.length > 0) {
      const rows = rec.logs.map((e) => ({
        id: e.id,
        pet_id: p.id,
        entry: e as unknown as Record<string, unknown>,
        logged_at: e.timestamp,
        logged_by: user.id,
      }))
      const { error: logErr } = await supabase.from('care_logs').insert(rows)
      if (logErr) throw new Error(`Care migrate: logs insert failed (${p.name}): ${logErr.message}`)
    }

    // 4) medications
    if (rec.medications && rec.medications.length > 0) {
      const medRows = rec.medications.map((m) => ({
        id: m.id,
        pet_id: p.id,
        created_by: user.id,
        name: m.name,
        strength: m.strength ?? null,
        dose_amount: m.doseAmount ?? null,
        schedule_times: m.scheduleTimes,
        schedule_note: m.scheduleNote ?? null,
        reminders_enabled: m.remindersEnabled,
        started_at: m.startedAt ?? null,
        ended_at: m.endedAt ?? null,
        created_at: m.createdAt,
      }))
      const { error: medErr } = await supabase.from('care_medications').insert(medRows)
      if (medErr) throw new Error(`Care migrate: medications insert failed (${p.name}): ${medErr.message}`)
    }

    imported++
  }

  clearLocalStore()
  return imported
}
