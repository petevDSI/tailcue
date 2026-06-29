'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import {
  getMedications, createMedication, updateMedication, discontinueMedication,
  type CareMedication, type MedicationGivenLogEntry, type CareLogEntry,
} from '@/lib/care-storage'

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function isMedGivenLog(l: CareLogEntry): l is MedicationGivenLogEntry {
  return 'type' in l && (l as MedicationGivenLogEntry).type === 'medication_given'
}

// ── MedForm ────────────────────────────────────────────────────────────────

interface MedFormState {
  name: string
  strength: string
  doseAmount: string
  scheduleTimes: string[]
  scheduleNote: string
  remindersEnabled: boolean
  notes: string
  startedAt: string
}

const EMPTY_FORM: MedFormState = {
  name: '', strength: '', doseAmount: '', scheduleTimes: [],
  scheduleNote: '', remindersEnabled: false, notes: '', startedAt: '',
}

function medToForm(med: CareMedication): MedFormState {
  return {
    name: med.name,
    strength: med.strength ?? '',
    doseAmount: med.doseAmount ?? '',
    scheduleTimes: [...med.scheduleTimes],
    scheduleNote: med.scheduleNote ?? '',
    remindersEnabled: med.remindersEnabled,
    notes: med.notes ?? '',
    startedAt: med.startedAt ? med.startedAt.slice(0, 10) : '',
  }
}

function MedForm({
  petId,
  existing,
  onSaved,
  onCancel,
}: {
  petId: string
  existing: CareMedication | null
  onSaved: (meds: CareMedication[]) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<MedFormState>(existing ? medToForm(existing) : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [newTime, setNewTime] = useState('')

  const doseChanged = existing && (
    (form.strength.trim() || undefined) !== existing.strength ||
    (form.doseAmount.trim() || undefined) !== existing.doseAmount
  )

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const today = todayDate()

      if (existing && doseChanged) {
        await discontinueMedication(petId, existing.id, today)
        await createMedication(petId, {
          id: crypto.randomUUID(),
          petId,
          name: form.name.trim(),
          strength: form.strength.trim() || undefined,
          doseAmount: form.doseAmount.trim() || undefined,
          scheduleTimes: form.scheduleTimes,
          scheduleNote: form.scheduleNote.trim() || undefined,
          remindersEnabled: form.remindersEnabled,
          notes: form.notes.trim() || undefined,
          startedAt: form.startedAt || today,
          endedAt: null,
          createdAt: now,
        })
      } else if (existing) {
        await updateMedication(petId, {
          ...existing,
          name: form.name.trim(),
          strength: form.strength.trim() || undefined,
          doseAmount: form.doseAmount.trim() || undefined,
          scheduleTimes: form.scheduleTimes,
          scheduleNote: form.scheduleNote.trim() || undefined,
          remindersEnabled: form.remindersEnabled,
          notes: form.notes.trim() || undefined,
          startedAt: form.startedAt || existing.startedAt,
        })
      } else {
        await createMedication(petId, {
          id: crypto.randomUUID(),
          petId,
          name: form.name.trim(),
          strength: form.strength.trim() || undefined,
          doseAmount: form.doseAmount.trim() || undefined,
          scheduleTimes: form.scheduleTimes,
          scheduleNote: form.scheduleNote.trim() || undefined,
          remindersEnabled: form.remindersEnabled,
          notes: form.notes.trim() || undefined,
          startedAt: form.startedAt || undefined,
          endedAt: null,
          createdAt: now,
        })
      }
      onSaved(await getMedications(petId))
    } finally {
      setSaving(false)
    }
  }

  function addTime() {
    const t = newTime.trim()
    if (!t || form.scheduleTimes.includes(t)) return
    setForm((f) => ({ ...f, scheduleTimes: [...f.scheduleTimes, t].sort() }))
    setNewTime('')
  }

  return (
    <div className="space-y-3 pt-1">
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Medication name *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Atenolol"
          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900
            focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Strength</label>
          <input
            type="text"
            value={form.strength}
            onChange={(e) => setForm((f) => ({ ...f, strength: e.target.value }))}
            placeholder="e.g. 6.25 mg"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Dose amount</label>
          <input
            type="text"
            value={form.doseAmount}
            onChange={(e) => setForm((f) => ({ ...f, doseAmount: e.target.value }))}
            placeholder="e.g. 1 tablet"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
      </div>

      {doseChanged && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
          Changing dose or strength creates a new history entry to preserve records.
        </p>
      )}

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1.5">Schedule times</label>
        {form.scheduleTimes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.scheduleTimes.map((t) => (
              <span key={t} className="flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-medium px-2 py-1 rounded-lg">
                {t}
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, scheduleTimes: f.scheduleTimes.filter((x) => x !== t) }))}
                  className="text-amber-600 hover:text-amber-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-1.5 text-sm text-stone-900
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
          <button
            type="button"
            onClick={addTime}
            disabled={!newTime}
            className="text-xs font-medium px-3 py-1.5 rounded-xl border border-stone-300 bg-white
              hover:bg-amber-50 transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
        <p className="text-xs text-stone-400 mt-1">Leave blank for as-needed meds</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Schedule note</label>
        <input
          type="text"
          value={form.scheduleNote}
          onChange={(e) => setForm((f) => ({ ...f, scheduleNote: e.target.value }))}
          placeholder="e.g. with food, every other day"
          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900
            focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        />
      </div>

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, remindersEnabled: !f.remindersEnabled }))}
          className={`mt-0.5 w-9 h-5 rounded-full flex items-center transition-colors shrink-0 ${
            form.remindersEnabled ? 'bg-amber-500 justify-end' : 'bg-stone-300 justify-start'
          } px-0.5`}
          role="switch"
          aria-checked={form.remindersEnabled}
        >
          <span className="w-4 h-4 bg-white rounded-full shadow-sm" />
        </button>
        <div>
          <p className="text-xs font-medium text-stone-700">Mention in daily email if not logged</p>
          <p className="text-xs text-stone-400">Used by Tailcue&rsquo;s daily summary email</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Notes</label>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Any other notes"
          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900
            focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Started date</label>
        <input
          type="date"
          value={form.startedAt}
          onChange={(e) => setForm((f) => ({ ...f, startedAt: e.target.value }))}
          className="rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900
            focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !form.name.trim()}
          className="text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600
            disabled:opacity-50 px-4 py-2 rounded-xl transition-colors min-h-[36px]"
        >
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Add medication'}
        </button>
        <button
          onClick={onCancel}
          className="text-xs font-medium text-stone-500 hover:text-stone-700 px-3 py-2
            rounded-xl border border-stone-200 hover:bg-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

interface Props {
  petId: string
  logs: CareLogEntry[]
  onLogEntry: (entry: CareLogEntry) => void
  onDeleteLog: (id: string) => void
}

export function CareMedicationSection({ petId, logs, onLogEntry, onDeleteLog }: Props) {
  const [meds, setMeds] = useState<CareMedication[]>([])
  const [loaded, setLoaded] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [confirmStopId, setConfirmStopId] = useState<string | null>(null)
  const [showDiscontinued, setShowDiscontinued] = useState(false)
  const [pendingUndoId, setPendingUndoId] = useState<string | null>(null)

  const todayStr = todayDate()
  const medGivenLogs = logs.filter(isMedGivenLog)
  const activeMeds = meds.filter((m) => !m.endedAt)
  const discontinuedMeds = meds.filter((m) => !!m.endedAt)
  const scheduledMeds = activeMeds.filter((m) => m.scheduleTimes.length > 0)
  const asNeededMeds = activeMeds.filter((m) => m.scheduleTimes.length === 0)

  useEffect(() => {
    getMedications(petId).then((m) => { setMeds(m); setLoaded(true) })
  }, [petId])

  if (!loaded) return null

  function givenTodayLog(medicationId: string, scheduledTime: string) {
    return medGivenLogs.find(
      (l) => l.medicationId === medicationId &&
        l.scheduledTime === scheduledTime &&
        l.timestamp.slice(0, 10) === todayStr
    )
  }

  function markGiven(med: CareMedication, scheduledTime: string) {
    const entry: MedicationGivenLogEntry = {
      id: crypto.randomUUID(),
      date: todayStr,
      timestamp: new Date().toISOString(),
      type: 'medication_given',
      medicationId: med.id,
      name: med.name,
      doseAmount: med.doseAmount,
      scheduledTime: scheduledTime || undefined,
    }
    onLogEntry(entry)
  }

  async function handleStop(medId: string) {
    await discontinueMedication(petId, medId, todayStr)
    setMeds(await getMedications(petId))
    setConfirmStopId(null)
    setEditingId(null)
  }

  function closeForm() {
    setEditingId(null)
    setAddingNew(false)
  }

  return (
    <>
      {/* ── Today's meds checklist ─────────────────────────────────────── */}
      {scheduledMeds.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Today&rsquo;s Meds
          </p>
          <ul className="divide-y divide-stone-100">
            {scheduledMeds.flatMap((med) =>
              med.scheduleTimes.map((t) => {
                const given = givenTodayLog(med.id, t)
                const isUndoing = !!given && pendingUndoId === given.id
                return (
                  <li key={`${med.id}-${t}`} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate">{med.name}</p>
                      <p className="text-xs text-stone-400">
                        {t}
                        {med.doseAmount && ` · ${med.doseAmount}`}
                        {med.scheduleNote && ` · ${med.scheduleNote}`}
                      </p>
                    </div>
                    {given ? (
                      isUndoing ? (
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => { onDeleteLog(given.id); setPendingUndoId(null) }}
                            className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1.5
                              rounded border border-red-200 hover:bg-red-50 transition-colors min-h-[36px]"
                          >
                            Undo
                          </button>
                          <button
                            onClick={() => setPendingUndoId(null)}
                            className="text-xs font-medium text-stone-500 px-2 py-1.5 rounded
                              border border-stone-200 hover:bg-stone-50 transition-colors min-h-[36px]"
                          >
                            Keep
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPendingUndoId(given.id)}
                          className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium
                            shrink-0 hover:text-stone-500 transition-colors py-2 min-h-[44px]"
                        >
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          Given {fmtTime(given.timestamp)}
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => markGiven(med, t)}
                        className="text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600
                          px-3 py-2 rounded-xl transition-colors min-h-[44px] shrink-0"
                      >
                        Mark as given
                      </button>
                    )}
                  </li>
                )
              })
            )}
          </ul>

          {asNeededMeds.length > 0 && (
            <>
              <p className="text-xs font-medium text-stone-400 mt-3 mb-1">As needed</p>
              <ul className="divide-y divide-stone-100">
                {asNeededMeds.map((med) => (
                  <li key={med.id} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate">{med.name}</p>
                      {(med.doseAmount || med.scheduleNote) && (
                        <p className="text-xs text-stone-400">
                          {[med.doseAmount, med.scheduleNote].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => markGiven(med, '')}
                      className="text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-amber-50
                        hover:text-amber-800 px-3 py-2 rounded-xl transition-colors min-h-[44px] shrink-0"
                    >
                      Give now
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* As-needed only (no scheduled times) */}
      {scheduledMeds.length === 0 && asNeededMeds.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
            As-Needed Meds
          </p>
          <ul className="divide-y divide-stone-100">
            {asNeededMeds.map((med) => (
              <li key={med.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-900 truncate">{med.name}</p>
                  {(med.doseAmount || med.scheduleNote) && (
                    <p className="text-xs text-stone-400">
                      {[med.doseAmount, med.scheduleNote].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => markGiven(med, '')}
                  className="text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-amber-50
                    hover:text-amber-800 px-3 py-2 rounded-xl transition-colors min-h-[44px] shrink-0"
                >
                  Give now
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Manage medications ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-stone-200">
        <button
          onClick={() => { setManageOpen(!manageOpen); closeForm(); setConfirmStopId(null) }}
          className="w-full flex items-center justify-between px-4 py-3 min-h-[44px]"
        >
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
            Medications
            {activeMeds.length > 0 && (
              <span className="ml-1.5 text-stone-400 font-normal normal-case">
                · {activeMeds.length} active
              </span>
            )}
          </p>
          {manageOpen
            ? <ChevronUp className="w-4 h-4 text-stone-400" />
            : <ChevronDown className="w-4 h-4 text-stone-400" />
          }
        </button>

        {manageOpen && (
          <div className="border-t border-stone-100 px-4 py-3 space-y-3">
            {activeMeds.length === 0 && !addingNew && (
              <p className="text-sm text-stone-400 py-1">No active medications tracked yet.</p>
            )}

            {activeMeds.map((med) => (
              <div key={med.id}>
                {editingId === med.id ? (
                  <MedForm
                    petId={petId}
                    existing={med}
                    onSaved={(updated) => { setMeds(updated); closeForm() }}
                    onCancel={closeForm}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-2 py-1.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900">{med.name}</p>
                      <p className="text-xs text-stone-400">
                        {[med.strength, med.doseAmount].filter(Boolean).join(' · ')}
                        {med.scheduleTimes.length > 0 && ` · ${med.scheduleTimes.join(', ')}`}
                        {med.scheduleNote && ` · ${med.scheduleNote}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {confirmStopId === med.id ? (
                        <>
                          <button
                            onClick={() => handleStop(med.id)}
                            className="text-xs font-medium text-stone-700 px-2 py-1.5 rounded
                              border border-stone-300 hover:bg-stone-100 transition-colors min-h-[32px]"
                          >
                            Discontinue
                          </button>
                          <button
                            onClick={() => setConfirmStopId(null)}
                            className="text-xs font-medium text-stone-400 hover:text-stone-600 px-2 py-1.5 min-h-[32px]"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingId(med.id); setAddingNew(false); setConfirmStopId(null) }}
                            className="text-xs font-medium text-stone-500 hover:text-stone-700 px-2 py-1.5
                              rounded border border-stone-200 hover:bg-stone-50 transition-colors min-h-[32px]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirmStopId(med.id)}
                            className="text-xs font-medium text-stone-400 hover:text-red-500 px-2 py-1.5
                              rounded border border-stone-200 hover:border-red-200 hover:bg-red-50
                              transition-colors min-h-[32px]"
                          >
                            Stop
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {addingNew ? (
              <MedForm
                petId={petId}
                existing={null}
                onSaved={(updated) => { setMeds(updated); closeForm() }}
                onCancel={closeForm}
              />
            ) : (
              <button
                onClick={() => { setAddingNew(true); setEditingId(null); setConfirmStopId(null) }}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-600
                  hover:text-amber-700 transition-colors py-1 min-h-[36px]"
              >
                <Plus className="w-3.5 h-3.5" />
                Add medication
              </button>
            )}

            {discontinuedMeds.length > 0 && (
              <div className="pt-1 border-t border-stone-100">
                <button
                  onClick={() => setShowDiscontinued(!showDiscontinued)}
                  className="text-xs text-stone-400 hover:text-stone-600 transition-colors py-1"
                >
                  {showDiscontinued ? 'Hide' : 'Show'} discontinued ({discontinuedMeds.length})
                </button>
                {showDiscontinued && (
                  <ul className="mt-2 space-y-1.5">
                    {discontinuedMeds.map((med) => (
                      <li key={med.id} className="text-xs text-stone-400">
                        <span className="line-through">{med.name}</span>
                        {med.endedAt && ` · stopped ${med.endedAt.slice(0, 10)}`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
