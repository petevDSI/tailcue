'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import Link from 'next/link'
import {
  Cat, Dog, Plus, Minus, Trash2, ArrowLeft, ExternalLink,
  ChevronDown, ChevronUp, Settings, X, Check,
} from 'lucide-react'
import {
  getPet, getAllPets, addLogEntry, deleteLogEntry,
  startNewVial, updateInsulinDefaults, updateCHFBaseline,
  type CareLogEntry, type DiabetesLogEntry, type CHFLogEntry,
  type CKDLogEntry, type CushingsLogEntry, type OALogEntry, type EpilepsyLogEntry,
  type HyperthyroidismLogEntry, type IBDLogEntry, type CDSLogEntry, type DMLogEntry,
  type PetProfile, type CurrentVial, type PetRecord,
} from '@/lib/care-storage'
import {
  evaluateGlucoseRisk, GLUCOSE_DISCLAIMER,
  evaluateCHFRisk, CHF_DISCLAIMER,
  evaluateCKDRisk, CKD_DISCLAIMER,
  evaluateCushingsRisk, CUSHINGS_DISCLAIMER,
  evaluateOARisk, OA_DISCLAIMER,
  evaluateEpilepsyRisk, EPILEPSY_DISCLAIMER,
  evaluateHyperthyroidismRisk, HYPERTHYROIDISM_DISCLAIMER,
  evaluateIBDRisk, IBD_DISCLAIMER,
  evaluateCDSRisk, computeDISHAAScore, CDS_DISCLAIMER,
  evaluateDMRisk, DM_DISCLAIMER,
} from '@/lib/care-risk-engine'
import { estimateInsulinSupply } from '@/lib/care-supply-estimator'
import { CareExportButton } from '@/components/care/CareExportButton'
import { CareAccountControl } from '@/components/care/CareAccountControl'
import { CareSyncNudge } from '@/components/care/CareSyncNudge'
import { CareShareButton } from '@/components/care/CareShareButton'
import { CarePetManageMenu } from '@/components/care/CarePetManageMenu'
import { useCareAuth } from '@/components/care/CareAuthProvider'
import Footer from '@/components/footer'

const CHEWY_RESTOCK_URL = process.env.NEXT_PUBLIC_CHEWY_AFFILIATE_URL ?? 'https://www.chewy.com/pharmacy'
const PETMEDS_RESTOCK_URL = process.env.NEXT_PUBLIC_PETMEDS_AFFILIATE_URL ?? 'https://www.1800petmeds.com'

// ── Helpers ───────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function SpeciesIcon({ species, className }: { species: 'cat' | 'dog'; className?: string }) {
  return species === 'dog' ? <Dog className={className} /> : <Cat className={className} />
}

// ── Appetite Selector ─────────────────────────────────────────────────────

type Appetite = 'poor' | 'normal' | 'ravenous'

const APPETITE_OPTIONS: { value: Appetite; label: string }[] = [
  { value: 'poor',     label: 'Poor'     },
  { value: 'normal',   label: 'Normal'   },
  { value: 'ravenous', label: 'Ravenous' },
]

function AppetiteSelector({ value, onChange }: { value: Appetite; onChange: (v: Appetite) => void }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-stone-300">
      {APPETITE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            value === opt.value
              ? 'bg-amber-500 text-white'
              : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Lethargy Selector ─────────────────────────────────────────────────────

const LETHARGY_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Normal energy',
  2: 'Slightly quieter than usual',
  3: 'Noticeably low energy',
  4: 'Very lethargic, reluctant to move',
  5: "Won't get up / unresponsive to stimuli",
}

function LethargySelector({
  value,
  onChange,
}: {
  value: 1 | 2 | 3 | 4 | 5
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void
}) {
  return (
    <div>
      <div className="flex rounded-xl overflow-hidden border border-stone-300">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              value === n
                ? 'bg-amber-500 text-white'
                : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-stone-400 mt-1.5">{LETHARGY_LABELS[value]}</p>
    </div>
  )
}

// ── Settings Panels ───────────────────────────────────────────────────────

function DiabetesSettingsPanel({
  petId,
  profile,
  onSave,
  onClose,
}: {
  petId: string
  profile: PetProfile
  onSave: () => void
  onClose: () => void
}) {
  const [concentration, setConcentration] = useState<'U-40' | 'U-100'>(
    profile.insulinConcentration ?? 'U-40'
  )
  const [vialSizeMlStr, setVialSizeMlStr] = useState(String(profile.vialSizeML ?? 10))

  async function handleSave() {
    const ml = parseFloat(vialSizeMlStr)
    if (isNaN(ml) || ml <= 0) return
    await updateInsulinDefaults(petId, concentration, ml)
    onSave()
  }

  return (
    <div className="bg-stone-50 border-b border-stone-200 px-4 py-4">
      <div className="max-w-lg mx-auto">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Insulin Defaults</p>
        <p className="text-xs text-stone-400 mb-4">
          These pre-fill the &ldquo;Start New Vial&rdquo; form. To update the vial you&rsquo;re using right now,
          use &ldquo;Start New Vial&rdquo; in the supply section below.
        </p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Concentration</label>
            <div className="flex rounded-xl overflow-hidden border border-stone-300 w-fit">
              {(['U-40', 'U-100'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setConcentration(c)}
                  className={`px-5 py-2 text-xs font-medium transition-colors ${
                    concentration === c
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Default Vial Size (mL)</label>
            <input
              type="number"
              inputMode="decimal"
              value={vialSizeMlStr}
              onChange={(e) => setVialSizeMlStr(e.target.value)}
              min="1"
              className="w-28 rounded-xl border border-stone-300 px-3 py-2 text-stone-900 text-sm
                focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-xl transition-colors"
          >
            Save Defaults
          </button>
          <button
            onClick={onClose}
            className="text-xs font-medium text-stone-500 hover:text-stone-700 px-3 py-1.5
              rounded-xl border border-stone-200 hover:bg-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function CHFSettingsPanel({
  petId,
  profile,
  onSave,
  onClose,
}: {
  petId: string
  profile: PetProfile
  onSave: () => void
  onClose: () => void
}) {
  const [baselineSRRStr, setBaselineSRRStr] = useState(
    profile.chfBaselineSRR != null ? String(profile.chfBaselineSRR) : ''
  )

  async function handleSave() {
    const srr = parseFloat(baselineSRRStr)
    if (isNaN(srr) || srr <= 0) return
    await updateCHFBaseline(petId, srr)
    onSave()
  }

  return (
    <div className="bg-stone-50 border-b border-stone-200 px-4 py-4">
      <div className="max-w-lg mx-auto">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">
          Baseline Resting Rate
        </p>
        <p className="text-xs text-stone-400 mb-4">
          Your vet&rsquo;s normal target for {profile.name}. Used to flag readings that are significantly
          higher than {profile.name}&rsquo;s established normal, even if still under 30 bpm.
        </p>
        <div className="mb-4">
          <label className="block text-xs font-medium text-stone-600 mb-1.5">
            Baseline (breaths/min)
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={baselineSRRStr}
            onChange={(e) => setBaselineSRRStr(e.target.value)}
            placeholder="e.g. 24"
            min="1"
            max="60"
            className="w-28 rounded-xl border border-stone-300 px-3 py-2 text-stone-900 text-sm
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-xl transition-colors"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="text-xs font-medium text-stone-500 hover:text-stone-700 px-3 py-1.5
              rounded-xl border border-stone-200 hover:bg-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── New Vial Form (diabetes only) ─────────────────────────────────────────

function NewVialForm({
  profile,
  onConfirm,
  onCancel,
}: {
  profile: PetProfile
  onConfirm: (concentration: 'U-40' | 'U-100', vialSizeML: number, unitsAlreadyUsedAtStart: number) => void
  onCancel: () => void
}) {
  const [concentration, setConcentration] = useState<'U-40' | 'U-100'>(
    profile.insulinConcentration ?? 'U-40'
  )
  const [vialSizeMlStr, setVialSizeMlStr] = useState(String(profile.vialSizeML ?? 10))
  const [vialStatus, setVialStatus] = useState<'new' | 'existing'>('new')
  const [unitsUsedStr, setUnitsUsedStr] = useState('')

  function handleConfirm() {
    const ml = parseFloat(vialSizeMlStr)
    if (isNaN(ml) || ml <= 0) return
    const usedAtStart = vialStatus === 'existing' ? (parseFloat(unitsUsedStr) || 0) : 0
    if (!window.confirm('Start tracking this vial? This replaces your current supply estimate.')) return
    onConfirm(concentration, ml, usedAtStart)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1.5">Concentration</label>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {(['U-40', 'U-100'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setConcentration(c)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                concentration === c ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1.5">Vial Size (mL)</label>
        <input
          type="number"
          inputMode="decimal"
          value={vialSizeMlStr}
          onChange={(e) => setVialSizeMlStr(e.target.value)}
          min="1"
          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-stone-900 text-sm
            focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1.5">Vial status</label>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'new' as const, label: 'Brand new' },
            { value: 'existing' as const, label: 'Already in use' },
          ]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setVialStatus(opt.value)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                vialStatus === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {vialStatus === 'existing' && (
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">
            Units already used <span className="text-stone-400 font-normal">(skip if unsure)</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={unitsUsedStr}
            onChange={(e) => setUnitsUsedStr(e.target.value)}
            placeholder="0"
            min="0"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-stone-900 text-sm
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleConfirm}
          disabled={!vialSizeMlStr || parseFloat(vialSizeMlStr) <= 0}
          className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-stone-200
            disabled:text-stone-400 text-white font-semibold py-2.5 text-xs transition-colors"
        >
          Start Tracking This Vial
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2.5 text-xs font-medium text-stone-500 hover:text-stone-700
            rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Supply Card (diabetes only) ───────────────────────────────────────────

function SupplyCard({
  petId,
  profile,
  logs,
  currentVial,
  onVialStarted,
}: {
  petId: string
  profile: PetProfile
  logs: DiabetesLogEntry[]
  currentVial: CurrentVial | null
  onVialStarted: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const supply = estimateInsulinSupply(logs, currentVial)

  async function handleVialConfirmed(
    concentration: 'U-40' | 'U-100',
    vialSizeML: number,
    unitsAlreadyUsedAtStart: number
  ) {
    await startNewVial(petId, {
      startedAt: new Date().toISOString(),
      concentration,
      vialSizeML,
      unitsAlreadyUsedAtStart,
    })
    onVialStarted()
    setShowForm(false)
  }

  if (showForm) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-4">Start New Vial</p>
        <NewVialForm
          profile={profile}
          onConfirm={handleVialConfirmed}
          onCancel={() => setShowForm(false)}
        />
      </div>
    )
  }

  if (supply.status === 'no_vial_started') {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Insulin Supply</p>
        <p className="text-sm font-medium text-stone-700 mb-1">Track your insulin supply</p>
        <p className="text-xs text-stone-400 mb-3">
          Tell Tailcue when you open a new vial — we&rsquo;ll estimate how long it will last based on your logged doses.
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
        >
          + Start tracking this vial
        </button>
      </div>
    )
  }

  if (supply.status === 'insufficient_data' || supply.status === 'unknown') {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Insulin Supply</p>
            <p className="text-sm text-stone-500">{supply.message}</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors shrink-0"
          >
            New vial →
          </button>
        </div>
      </div>
    )
  }

  if (supply.status === 'low') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">
          Insulin Supply — Running Low
        </p>
        <p className="text-sm font-medium text-amber-900 mb-2">{supply.message}</p>
        <p className="text-xs text-amber-700 mb-2">Compare options to restock your supplies.</p>
        <div className="flex gap-2 mb-4">
          <a
            href={CHEWY_RESTOCK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800
              border border-amber-300 bg-white rounded-xl px-3 py-2 transition-colors"
          >
            Chewy Pharmacy <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
          <a
            href={PETMEDS_RESTOCK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800
              border border-amber-300 bg-white rounded-xl px-3 py-2 transition-colors"
          >
            1-800-PetMeds <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          Opened a new vial? Start tracking it →
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Insulin Supply</p>
          <p className="text-sm text-stone-600">{supply.message}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors shrink-0 mt-0.5"
        >
          New vial →
        </button>
      </div>
    </div>
  )
}

// ── Shared backdating disclosure ──────────────────────────────────────────

function BackdateDisclosure({
  open,
  onToggle,
  value,
  onChange,
}: {
  open: boolean
  onToggle: () => void
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-500 transition-colors"
      >
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Log for a different date
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
          <label className="block text-xs font-medium text-stone-600 mb-1.5">Entry date</label>
          <input
            type="date"
            value={value}
            max={today()}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-2 text-stone-900 text-sm
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
          {value && (
            <p className="text-xs text-amber-600 mt-1.5">Will save as {value} at 12:00 noon.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Collapsible Log Form wrapper ─────────────────────────────────────────

interface CollapsibleLogFormProps {
  ctaLabel: string
  greetingHeader: string
  children: React.ReactNode
  onSave: () => void
  canSave: boolean
  saveLabel: string
  saveClassName?: string
  backdateOpen: boolean
  onBackdateToggle: () => void
  backdateValue: string
  onBackdateChange: (v: string) => void
}

function CollapsibleLogForm({
  ctaLabel,
  greetingHeader,
  children,
  onSave,
  canSave,
  saveLabel,
  saveClassName,
  backdateOpen,
  onBackdateToggle,
  backdateValue,
  onBackdateChange,
}: CollapsibleLogFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    onSave()
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setIsOpen(false)
    }, 2000)
  }

  if (saved) {
    return (
      <div className="w-full bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex items-center justify-center gap-2">
        <Check className="w-4 h-4 text-green-600" />
        <span className="text-green-700 font-semibold text-sm">Logged</span>
      </div>
    )
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl
          text-base transition-colors shadow-sm flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        {ctaLabel}
      </button>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-stone-100">
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold text-stone-900">{greetingHeader}</p>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-stone-300 hover:text-stone-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="px-5 py-4 space-y-6">
        {children}
        <BackdateDisclosure
          open={backdateOpen}
          onToggle={onBackdateToggle}
          value={backdateValue}
          onChange={onBackdateChange}
        />
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className={`w-full font-bold py-4 rounded-xl text-base transition-colors
            ${saveClassName ?? 'bg-amber-500 hover:bg-amber-600 text-white'}
            disabled:bg-stone-200 disabled:text-stone-400`}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  )
}

// ── Diabetes Log Form ─────────────────────────────────────────────────────

function DiabetesLogForm({ onSave, petName }: { onSave: (entry: CareLogEntry) => void; petName: string }) {
  const [bgInput, setBgInput] = useState('')
  const [insulinUnits, setInsulinUnits] = useState(1.0)
  const [insulinType, setInsulinType] = useState('')
  const [appetite, setAppetite] = useState<Appetite>('normal')
  const [backdateOpen, setBackdateOpen] = useState(false)
  const [selectedLogDate, setSelectedLogDate] = useState('')

  const adjustInsulin = (delta: number) => {
    setInsulinUnits((prev) => Math.max(0, Math.round((prev + delta) * 2) / 2))
  }

  const handleSave = useCallback(() => {
    const bg = parseInt(bgInput, 10)
    if (isNaN(bg) || bg <= 0) return

    const entryDate = selectedLogDate || today()
    const entryTimestamp = selectedLogDate
      ? new Date(`${selectedLogDate}T12:00:00`).toISOString()
      : new Date().toISOString()

    const entry: DiabetesLogEntry = {
      id: crypto.randomUUID(),
      date: entryDate,
      timestamp: entryTimestamp,
      condition: 'feline_diabetes',
      bloodGlucose: bg,
      insulinUnits,
      insulinType: insulinType.trim(),
      appetite,
    }

    onSave(entry)
    setBgInput('')
    setInsulinUnits(1.0)
    setInsulinType('')
    setAppetite('normal')
    setSelectedLogDate('')
    setBackdateOpen(false)
  }, [bgInput, insulinUnits, insulinType, appetite, selectedLogDate, onSave])

  return (
    <CollapsibleLogForm
      ctaLabel={`Log a reading for ${petName} →`}
      greetingHeader={`How's ${petName}'s glucose today?`}
      onSave={handleSave}
      canSave={bgInput.trim().length > 0 && parseInt(bgInput, 10) > 0}
      saveLabel="Save Reading"
      backdateOpen={backdateOpen}
      onBackdateToggle={() => { setBackdateOpen(!backdateOpen); if (backdateOpen) setSelectedLogDate('') }}
      backdateValue={selectedLogDate}
      onBackdateChange={setSelectedLogDate}
    >
      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">What was the reading?</p>
        <p className="text-sm text-stone-500 mb-3">Enter in mg/dL</p>
        <input
          type="number"
          inputMode="numeric"
          value={bgInput}
          onChange={(e) => setBgInput(e.target.value)}
          placeholder="—"
          min="1"
          max="999"
          className="w-full text-center text-3xl font-bold text-stone-900 rounded-xl
            border-2 border-stone-200 focus:border-amber-400 focus:ring-0 py-4
            focus:outline-none bg-white"
        />
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">How much insulin did you give?</p>
        <p className="text-sm text-stone-500 mb-3">Units</p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => adjustInsulin(-0.5)} disabled={insulinUnits <= 0}
            className="w-12 h-12 flex items-center justify-center rounded-xl border border-stone-300
              text-stone-600 hover:bg-[#FFF8E7] disabled:opacity-30 transition-colors">
            <Minus className="w-5 h-5" />
          </button>
          <span className="w-20 text-center text-stone-900 font-bold text-3xl tabular-nums">
            {insulinUnits % 1 === 0 ? `${insulinUnits}.0` : insulinUnits}
          </span>
          <button type="button" onClick={() => adjustInsulin(0.5)}
            className="w-12 h-12 flex items-center justify-center rounded-xl border border-stone-300
              text-stone-600 hover:bg-[#FFF8E7] transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Which insulin?</p>
        <p className="text-sm text-stone-500 mb-3">Optional — e.g. Glargine, PZI</p>
        <input
          type="text"
          value={insulinType}
          onChange={(e) => setInsulinType(e.target.value)}
          placeholder="e.g. Glargine, PZI"
          className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
            focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        />
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">How was the appetite?</p>
        <AppetiteSelector value={appetite} onChange={setAppetite} />
      </div>
    </CollapsibleLogForm>
  )
}

// ── CHF Log Form ──────────────────────────────────────────────────────────

function CHFLogForm({ onSave, petName }: { onSave: (entry: CareLogEntry) => void; petName: string }) {
  const [srrInput, setSrrInput] = useState('')
  const [lethargyLevel, setLethargyLevel] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [backdateOpen, setBackdateOpen] = useState(false)
  const [selectedLogDate, setSelectedLogDate] = useState('')

  const handleSave = useCallback(() => {
    const srr = parseInt(srrInput, 10)
    if (isNaN(srr) || srr <= 0) return

    const entryDate = selectedLogDate || today()
    const entryTimestamp = selectedLogDate
      ? new Date(`${selectedLogDate}T12:00:00`).toISOString()
      : new Date().toISOString()

    const entry: CHFLogEntry = {
      id: crypto.randomUUID(),
      date: entryDate,
      timestamp: entryTimestamp,
      condition: 'chf',
      srrBpm: srr,
      lethargyLevel,
    }

    onSave(entry)
    setSrrInput('')
    setLethargyLevel(1)
    setSelectedLogDate('')
    setBackdateOpen(false)
  }, [srrInput, lethargyLevel, selectedLogDate, onSave])

  return (
    <CollapsibleLogForm
      ctaLabel={`Log ${petName}'s breathing rate →`}
      greetingHeader={`How's ${petName} breathing today?`}
      onSave={handleSave}
      canSave={srrInput.trim().length > 0 && parseInt(srrInput, 10) > 0}
      saveLabel="Save Reading"
      backdateOpen={backdateOpen}
      onBackdateToggle={() => { setBackdateOpen(!backdateOpen); if (backdateOpen) setSelectedLogDate('') }}
      backdateValue={selectedLogDate}
      onBackdateChange={setSelectedLogDate}
    >
      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">What was the resting respiratory rate?</p>
        <p className="text-sm text-stone-500 mb-3">Count breaths for 30 seconds while they&apos;re asleep, then × 2. Enter the result in breaths/min.</p>
        <input
          type="number"
          inputMode="numeric"
          value={srrInput}
          onChange={(e) => setSrrInput(e.target.value)}
          placeholder="—"
          min="1"
          max="99"
          className="w-full text-center text-3xl font-bold text-stone-900 rounded-xl
            border-2 border-stone-200 focus:border-amber-400 focus:ring-0 py-4
            focus:outline-none bg-white"
        />
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">How&apos;s the energy today?</p>
        <LethargySelector value={lethargyLevel} onChange={setLethargyLevel} />
      </div>
    </CollapsibleLogForm>
  )
}

// ── Shared 1–5 Score Selector ─────────────────────────────────────────────

function ScoreSelector({
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  value: number
  onChange: (v: number) => void
  lowLabel: string
  highLabel: string
}) {
  return (
    <div>
      <div className="flex rounded-xl overflow-hidden border border-stone-300">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              value === n
                ? 'bg-amber-500 text-white'
                : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <p className="text-xs text-stone-400">{lowLabel}</p>
        <p className="text-xs text-stone-400">{highLabel}</p>
      </div>
    </div>
  )
}

// ── CKD Log Form ──────────────────────────────────────────────────────────

function CKDLogForm({ onSave, petName }: { onSave: (entry: CareLogEntry) => void; petName: string }) {
  const [vomitingCount, setVomitingCount] = useState(0)
  const [skinTurgor, setSkinTurgor] = useState<'normal' | 'sticky' | 'tented'>('normal')
  const [appetite, setAppetite] = useState<'normal' | 'reduced' | 'refused'>('normal')
  const [lethargyScore, setLethargyScore] = useState(1)
  const [onSubQ, setOnSubQ] = useState(false)
  const [subqFluidMlStr, setSubqFluidMlStr] = useState('100')
  const [backdateOpen, setBackdateOpen] = useState(false)
  const [selectedLogDate, setSelectedLogDate] = useState('')

  const handleSave = useCallback(() => {
    const entryDate = selectedLogDate || today()
    const entryTimestamp = selectedLogDate
      ? new Date(`${selectedLogDate}T12:00:00`).toISOString()
      : new Date().toISOString()
    const entry: CKDLogEntry = {
      id: crypto.randomUUID(),
      date: entryDate,
      timestamp: entryTimestamp,
      condition: 'chronic_kidney_disease',
      subqFluidMl: onSubQ ? (parseFloat(subqFluidMlStr) || 0) : null,
      vomitingCount,
      skinTurgor,
      appetite,
      lethargyScore,
    }
    onSave(entry)
    setVomitingCount(0)
    setSkinTurgor('normal')
    setAppetite('normal')
    setLethargyScore(1)
    setSelectedLogDate('')
    setBackdateOpen(false)
  }, [vomitingCount, skinTurgor, appetite, lethargyScore, onSubQ, subqFluidMlStr, selectedLogDate, onSave])

  return (
    <CollapsibleLogForm
      ctaLabel={`Log today's check-in for ${petName} →`}
      greetingHeader={`How's ${petName} doing today?`}
      onSave={handleSave}
      canSave={true}
      saveLabel="Save Check-In"
      backdateOpen={backdateOpen}
      onBackdateToggle={() => { setBackdateOpen(!backdateOpen); if (backdateOpen) setSelectedLogDate('') }}
      backdateValue={selectedLogDate}
      onBackdateChange={setSelectedLogDate}
    >
      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Any vomiting in the last 24 hours?</p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setVomitingCount(Math.max(0, vomitingCount - 1))}
            disabled={vomitingCount <= 0}
            className="w-12 h-12 flex items-center justify-center rounded-xl border border-stone-300
              text-stone-600 hover:bg-[#FFF8E7] disabled:opacity-30 transition-colors">
            <Minus className="w-5 h-5" />
          </button>
          <span className="w-20 text-center text-stone-900 font-bold text-3xl tabular-nums">{vomitingCount}</span>
          <button type="button" onClick={() => setVomitingCount(Math.min(10, vomitingCount + 1))}
            className="w-12 h-12 flex items-center justify-center rounded-xl border border-stone-300
              text-stone-600 hover:bg-[#FFF8E7] transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Hydration check — how&apos;s the skin turgor?</p>
        <p className="text-sm text-stone-500 mb-3">Gently pinch the scruff. How quickly does it snap back?</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'normal' as const, label: 'Snaps back' },
            { value: 'sticky' as const, label: 'Slight delay' },
            { value: 'tented' as const, label: 'Stays lifted' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setSkinTurgor(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                skinTurgor === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">How&apos;s the appetite?</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'normal' as const, label: 'Normal' },
            { value: 'reduced' as const, label: 'Reduced' },
            { value: 'refused' as const, label: 'Refused' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setAppetite(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                appetite === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Energy level today?</p>
        <ScoreSelector value={lethargyScore} onChange={setLethargyScore} lowLabel="Normal" highLabel="Unresponsive" />
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Did you give SubQ fluids today?</p>
        <button type="button" onClick={() => setOnSubQ(!onSubQ)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors
            ${onSubQ ? 'bg-amber-50 border-amber-400 text-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'}`}>
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
            ${onSubQ ? 'bg-amber-500 border-amber-500' : 'border-stone-300'}`}>
            {onSubQ && <Check className="w-3 h-3 text-white" />}
          </div>
          <span className="text-sm font-medium">Yes, SubQ fluids given</span>
        </button>
        {onSubQ && (
          <div className="mt-3">
            <p className="text-sm text-stone-500 mb-2">Amount (mL)</p>
            <div className="flex items-center gap-2">
              {[50, 100, 150, 200].map((ml) => (
                <button key={ml} type="button" onClick={() => setSubqFluidMlStr(String(ml))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
                    subqFluidMlStr === String(ml) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-stone-600 border-stone-300 hover:bg-[#FFF8E7]'
                  }`}>
                  {ml}
                </button>
              ))}
              <input type="number" inputMode="numeric" value={subqFluidMlStr}
                onChange={(e) => setSubqFluidMlStr(e.target.value)} placeholder="mL"
                className="w-20 rounded-xl border border-stone-300 px-2 py-1.5 text-stone-900 text-xs
                  focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
            </div>
          </div>
        )}
      </div>
    </CollapsibleLogForm>
  )
}

// ── Cushing's Log Form ────────────────────────────────────────────────────

function CushingsLogForm({ onSave, petName }: { onSave: (entry: CareLogEntry) => void; petName: string }) {
  const [waterIntake, setWaterIntake] = useState<'normal' | 'elevated' | 'excessive'>('normal')
  const [indoorAccidents, setIndoorAccidents] = useState(false)
  const [lethargyScore, setLethargyScore] = useState(1)
  const [appetite, setAppetite] = useState<'normal' | 'reduced' | 'refused'>('normal')
  const [vomitingOrDiarrhea, setVomitingOrDiarrhea] = useState(false)
  const [medicationGiven, setMedicationGiven] = useState(true)
  const [backdateOpen, setBackdateOpen] = useState(false)
  const [selectedLogDate, setSelectedLogDate] = useState('')

  const handleSave = useCallback(() => {
    const entryDate = selectedLogDate || today()
    const entryTimestamp = selectedLogDate
      ? new Date(`${selectedLogDate}T12:00:00`).toISOString()
      : new Date().toISOString()
    const entry: CushingsLogEntry = {
      id: crypto.randomUUID(),
      date: entryDate,
      timestamp: entryTimestamp,
      condition: 'cushings_disease',
      waterIntake,
      indoorAccidents,
      lethargyScore,
      appetite,
      vomitingOrDiarrhea,
      medicationGiven,
    }
    onSave(entry)
    setWaterIntake('normal')
    setIndoorAccidents(false)
    setLethargyScore(1)
    setAppetite('normal')
    setVomitingOrDiarrhea(false)
    setMedicationGiven(true)
    setSelectedLogDate('')
    setBackdateOpen(false)
  }, [waterIntake, indoorAccidents, lethargyScore, appetite, vomitingOrDiarrhea, medicationGiven, selectedLogDate, onSave])

  return (
    <CollapsibleLogForm
      ctaLabel={`Log today's check-in for ${petName} →`}
      greetingHeader={`How's ${petName} doing today?`}
      onSave={handleSave}
      canSave={true}
      saveLabel="Save Check-In"
      backdateOpen={backdateOpen}
      onBackdateToggle={() => { setBackdateOpen(!backdateOpen); if (backdateOpen) setSelectedLogDate('') }}
      backdateValue={selectedLogDate}
      onBackdateChange={setSelectedLogDate}
    >
      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Did {petName} get their Vetoryl / trilostane today?</p>
        <p className="text-sm text-stone-500 mb-3">With food — this matters for absorption</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: true, label: 'Yes, given' },
            { value: false, label: 'No / missed' },
          ]).map((opt) => (
            <button key={String(opt.value)} type="button" onClick={() => setMedicationGiven(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                medicationGiven === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">How was the water intake?</p>
        <p className="text-sm text-stone-500 mb-3">Compared to pre-treatment baseline</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'normal' as const, label: 'Normal' },
            { value: 'elevated' as const, label: 'Elevated' },
            { value: 'excessive' as const, label: 'Excessive' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setWaterIntake(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                waterIntake === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Energy level today?</p>
        <ScoreSelector value={lethargyScore} onChange={setLethargyScore} lowLabel="Normal" highLabel="Unresponsive" />
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">How&apos;s the appetite?</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'normal' as const, label: 'Normal' },
            { value: 'reduced' as const, label: 'Reduced' },
            { value: 'refused' as const, label: 'Refused' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setAppetite(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                appetite === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <button type="button" onClick={() => setVomitingOrDiarrhea(!vomitingOrDiarrhea)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors
            ${vomitingOrDiarrhea ? 'bg-amber-50 border-amber-400 text-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'}`}>
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
            ${vomitingOrDiarrhea ? 'bg-amber-500 border-amber-500' : 'border-stone-300'}`}>
            {vomitingOrDiarrhea && <Check className="w-3 h-3 text-white" />}
          </div>
          <span className="text-sm font-medium">Any vomiting or diarrhea today?</span>
        </button>
        <button type="button" onClick={() => setIndoorAccidents(!indoorAccidents)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors
            ${indoorAccidents ? 'bg-amber-50 border-amber-400 text-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'}`}>
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
            ${indoorAccidents ? 'bg-amber-500 border-amber-500' : 'border-stone-300'}`}>
            {indoorAccidents && <Check className="w-3 h-3 text-white" />}
          </div>
          <span className="text-sm font-medium">Any indoor urination accidents?</span>
        </button>
      </div>
    </CollapsibleLogForm>
  )
}

// ── OA Log Form ───────────────────────────────────────────────────────────

function OALogForm({ onSave, petName }: { onSave: (entry: CareLogEntry) => void; petName: string }) {
  const [easOfRising, setEasOfRising] = useState<'smooth' | 'hesitant' | 'refused'>('smooth')
  const [stairsNegotiated, setStairsNegotiated] = useState<'yes' | 'assisted' | 'refused' | 'no_stairs'>('no_stairs')
  const [jumpingAttempted, setJumpingAttempted] = useState<'yes' | 'hesitant' | 'no'>('yes')
  const [painMedGiven, setPainMedGiven] = useState(false)
  const [mobilityScore, setMobilityScore] = useState(1)
  const [backdateOpen, setBackdateOpen] = useState(false)
  const [selectedLogDate, setSelectedLogDate] = useState('')

  const handleSave = useCallback(() => {
    const entryDate = selectedLogDate || today()
    const entryTimestamp = selectedLogDate
      ? new Date(`${selectedLogDate}T12:00:00`).toISOString()
      : new Date().toISOString()
    const entry: OALogEntry = {
      id: crypto.randomUUID(),
      date: entryDate,
      timestamp: entryTimestamp,
      condition: 'osteoarthritis',
      easOfRising,
      stairsNegotiated,
      jumpingAttempted,
      painMedGiven,
      overallMobilityScore: mobilityScore,
    }
    onSave(entry)
    setEasOfRising('smooth')
    setStairsNegotiated('no_stairs')
    setJumpingAttempted('yes')
    setPainMedGiven(false)
    setMobilityScore(1)
    setSelectedLogDate('')
    setBackdateOpen(false)
  }, [easOfRising, stairsNegotiated, jumpingAttempted, painMedGiven, mobilityScore, selectedLogDate, onSave])

  return (
    <CollapsibleLogForm
      ctaLabel={`Log ${petName}'s mobility today →`}
      greetingHeader={`How did ${petName} move today?`}
      onSave={handleSave}
      canSave={true}
      saveLabel="Save Check-In"
      backdateOpen={backdateOpen}
      onBackdateToggle={() => { setBackdateOpen(!backdateOpen); if (backdateOpen) setSelectedLogDate('') }}
      backdateValue={selectedLogDate}
      onBackdateChange={setSelectedLogDate}
    >
      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Getting up from rest — how did it go?</p>
        <p className="text-sm text-stone-500 mb-3">When they got up from lying or sleeping</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'smooth' as const, label: 'Smooth' },
            { value: 'hesitant' as const, label: 'Hesitant' },
            { value: 'refused' as const, label: 'Refused' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setEasOfRising(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                easOfRising === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Overall mobility today?</p>
        <p className="text-sm text-stone-500 mb-3">1 = best they usually get, 5 = worst you&apos;ve seen</p>
        <ScoreSelector value={mobilityScore} onChange={setMobilityScore} lowLabel="Best" highLabel="Worst" />
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Any jumping or climbing today?</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'yes' as const, label: 'Yes' },
            { value: 'hesitant' as const, label: 'Hesitant' },
            { value: 'no' as const, label: 'No' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setJumpingAttempted(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                jumpingAttempted === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Stairs today?</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'yes' as const, label: 'Managed' },
            { value: 'assisted' as const, label: 'Assisted' },
            { value: 'refused' as const, label: 'Refused' },
            { value: 'no_stairs' as const, label: 'N/A' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setStairsNegotiated(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                stairsNegotiated === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Pain meds or supplements given today?</p>
        <button type="button" onClick={() => setPainMedGiven(!painMedGiven)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors
            ${painMedGiven ? 'bg-amber-50 border-amber-400 text-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'}`}>
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
            ${painMedGiven ? 'bg-amber-500 border-amber-500' : 'border-stone-300'}`}>
            {painMedGiven && <Check className="w-3 h-3 text-white" />}
          </div>
          <span className="text-sm font-medium">Yes, given today</span>
        </button>
      </div>
    </CollapsibleLogForm>
  )
}

// ── Epilepsy Log Form ─────────────────────────────────────────────────────

function EpilepsyLogForm({ onSave }: { onSave: (entry: CareLogEntry) => void }) {
  const nowStr = () => {
    const now = new Date()
    now.setSeconds(0, 0)
    return now.toISOString().slice(0, 16)
  }
  const [seizedAt, setSeizedAt] = useState(nowStr)
  const [durationStr, setDurationStr] = useState('')
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate')
  const [postIctalStr, setPostIctalStr] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(() => {
    const dur = parseFloat(durationStr)
    const postIctal = parseFloat(postIctalStr)
    if (isNaN(dur) || dur <= 0) return
    setSaving(true)
    const ts = new Date(seizedAt).toISOString()
    const entry: EpilepsyLogEntry = {
      id: crypto.randomUUID(),
      date: ts.slice(0, 10),
      timestamp: ts,
      condition: 'epilepsy',
      durationMinutes: dur,
      severity,
      postIctalMinutes: isNaN(postIctal) ? 0 : postIctal,
      notes: notes.trim() || undefined,
    }
    onSave(entry)
    setSeizedAt(nowStr())
    setDurationStr('')
    setSeverity('moderate')
    setPostIctalStr('')
    setNotes('')
    setSaving(false)
  }, [seizedAt, durationStr, severity, postIctalStr, notes, onSave])

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-stone-100">
        <p className="text-lg font-bold text-stone-900">Log this seizure event</p>
      </div>
      <div className="px-5 py-4 space-y-6">
        <div>
          <p className="text-base font-semibold text-stone-900 mb-3">When did it happen?</p>
          <input type="datetime-local" value={seizedAt}
            max={new Date().toISOString().slice(0, 16)}
            onChange={(e) => setSeizedAt(e.target.value)}
            className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
        </div>

        <div>
          <p className="text-base font-semibold text-stone-900 mb-1">How long did the seizure last?</p>
          <p className="text-sm text-stone-500 mb-3">Estimate is fine — even &ldquo;about 2 minutes&rdquo; helps your vet</p>
          <input type="number" inputMode="decimal" value={durationStr}
            onChange={(e) => setDurationStr(e.target.value)}
            placeholder="—" min="0.1" step="0.5"
            className="w-full text-center text-3xl font-bold text-stone-900 rounded-xl
              border-2 border-stone-200 focus:border-amber-400 focus:ring-0 py-4
              focus:outline-none bg-white" />
        </div>

        <div>
          <p className="text-base font-semibold text-stone-900 mb-1">How severe was it?</p>
          <p className="text-sm text-stone-500 mb-3">Mild = facial twitching · Moderate = partial body · Severe = full grand mal</p>
          <div className="flex rounded-xl overflow-hidden border border-stone-300">
            {([
              { value: 'mild' as const, label: 'Mild' },
              { value: 'moderate' as const, label: 'Moderate' },
              { value: 'severe' as const, label: 'Severe' },
            ]).map((opt) => (
              <button key={opt.value} type="button" onClick={() => setSeverity(opt.value)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  severity === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-base font-semibold text-stone-900 mb-1">How long to recover?</p>
          <p className="text-sm text-stone-500 mb-3">When did they seem like themselves again? (minutes)</p>
          <input type="number" inputMode="numeric" value={postIctalStr}
            onChange={(e) => setPostIctalStr(e.target.value)}
            placeholder="—" min="0"
            className="w-full text-center text-3xl font-bold text-stone-900 rounded-xl
              border-2 border-stone-200 focus:border-amber-400 focus:ring-0 py-4
              focus:outline-none bg-white" />
        </div>

        <div>
          <p className="text-base font-semibold text-stone-900 mb-1">Anything else to note?</p>
          <p className="text-sm text-stone-500 mb-3">Any trigger, unusual behavior before, or observations</p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any trigger you noticed? Unusual behavior before?"
            rows={2}
            className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none" />
        </div>

        <button type="button"
          disabled={!durationStr.trim() || parseFloat(durationStr) <= 0 || saving}
          onClick={handleSave}
          className="w-full rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-stone-200
            disabled:text-stone-400 text-white font-bold py-4 text-base transition-colors">
          Save Seizure Event
        </button>
      </div>
    </div>
  )
}

// ── Hyperthyroidism Log Form ──────────────────────────────────────────────

function HyperthyroidismLogForm({ onSave, petName }: { onSave: (entry: CareLogEntry) => void; petName: string }) {
  const [medicationGiven, setMedicationGiven] = useState(true)
  const [appetite, setAppetite] = useState<'normal' | 'reduced' | 'ravenous'>('normal')
  const [weightChange, setWeightChange] = useState<'stable' | 'losing'>('stable')
  const [vomitingStr, setVomitingStr] = useState('0')
  const [lethargyScore, setLethargyScore] = useState(1)
  const [facialScratching, setFacialScratching] = useState(false)
  const [yellowSkinOrGums, setYellowSkinOrGums] = useState(false)
  const [bleedingOrBruising, setBleedingOrBruising] = useState(false)
  const [notes, setNotes] = useState('')
  const [backdateOpen, setBackdateOpen] = useState(false)
  const [selectedLogDate, setSelectedLogDate] = useState('')

  const handleSave = useCallback(() => {
    const vomitCount = parseInt(vomitingStr, 10)
    if (isNaN(vomitCount) || vomitCount < 0) return
    const entryDate = selectedLogDate || today()
    const entryTimestamp = selectedLogDate
      ? new Date(`${selectedLogDate}T12:00:00`).toISOString()
      : new Date().toISOString()
    const entry: HyperthyroidismLogEntry = {
      id: crypto.randomUUID(),
      date: entryDate,
      timestamp: entryTimestamp,
      condition: 'feline_hyperthyroidism',
      medicationGiven,
      appetite,
      weightChange,
      vomitingCount: vomitCount,
      lethargyScore,
      facialScratching,
      yellowSkinOrGums,
      bleedingOrBruising,
      notes: notes.trim() || undefined,
    }
    onSave(entry)
    setMedicationGiven(true)
    setAppetite('normal')
    setWeightChange('stable')
    setVomitingStr('0')
    setLethargyScore(1)
    setFacialScratching(false)
    setYellowSkinOrGums(false)
    setBleedingOrBruising(false)
    setNotes('')
    setSelectedLogDate('')
    setBackdateOpen(false)
  }, [medicationGiven, appetite, weightChange, vomitingStr, lethargyScore, facialScratching, yellowSkinOrGums, bleedingOrBruising, notes, selectedLogDate, onSave])

  return (
    <CollapsibleLogForm
      ctaLabel={`Log today's check-in for ${petName} →`}
      greetingHeader={`How's ${petName} doing today?`}
      onSave={handleSave}
      canSave={true}
      saveLabel="Save Check-In"
      backdateOpen={backdateOpen}
      onBackdateToggle={() => { setBackdateOpen(!backdateOpen); if (backdateOpen) setSelectedLogDate('') }}
      backdateValue={selectedLogDate}
      onBackdateChange={setSelectedLogDate}
    >
      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Did {petName} get their methimazole / Felimazole today?</p>
        <div className="mt-3">
          <button type="button" onClick={() => setMedicationGiven(!medicationGiven)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors
              ${medicationGiven ? 'bg-amber-50 border-amber-400 text-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'}`}>
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
              ${medicationGiven ? 'bg-amber-500 border-amber-500' : 'border-stone-300'}`}>
              {medicationGiven && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm font-medium">Yes, given today</span>
          </button>
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">How was the appetite?</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'normal' as const, label: 'Normal' },
            { value: 'reduced' as const, label: 'Reduced' },
            { value: 'ravenous' as const, label: 'Ravenous' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setAppetite(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                appetite === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Weight check?</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'stable' as const, label: 'Stable' },
            { value: 'losing' as const, label: 'Losing' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setWeightChange(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                weightChange === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Vomiting episodes today?</p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setVomitingStr(String(Math.max(0, parseInt(vomitingStr, 10) - 1)))}
            disabled={parseInt(vomitingStr, 10) <= 0}
            className="w-12 h-12 flex items-center justify-center rounded-xl border border-stone-300
              text-stone-600 hover:bg-[#FFF8E7] disabled:opacity-30 transition-colors">
            <Minus className="w-5 h-5" />
          </button>
          <span className="w-20 text-center text-stone-900 font-bold text-3xl tabular-nums">{vomitingStr}</span>
          <button type="button" onClick={() => setVomitingStr(String(Math.min(20, parseInt(vomitingStr, 10) + 1)))}
            className="w-12 h-12 flex items-center justify-center rounded-xl border border-stone-300
              text-stone-600 hover:bg-[#FFF8E7] transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Energy level?</p>
        <ScoreSelector value={lethargyScore} onChange={setLethargyScore} lowLabel="Normal" highLabel="Unresponsive" />
      </div>

      <div className="space-y-3">
        <button type="button" onClick={() => setFacialScratching(!facialScratching)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors
            ${facialScratching ? 'bg-amber-50 border-amber-400 text-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'}`}>
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
            ${facialScratching ? 'bg-amber-500 border-amber-500' : 'border-stone-300'}`}>
            {facialScratching && <Check className="w-3 h-3 text-white" />}
          </div>
          <span className="text-sm font-medium">Scratching face or neck? (possible drug reaction)</span>
        </button>
        <button type="button" onClick={() => setYellowSkinOrGums(!yellowSkinOrGums)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors
            ${yellowSkinOrGums ? 'bg-red-50 border-red-400 text-red-900' : 'bg-white border-stone-200 text-stone-700 hover:border-red-200'}`}>
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
            ${yellowSkinOrGums ? 'bg-red-500 border-red-500' : 'border-stone-300'}`}>
            {yellowSkinOrGums && <Check className="w-3 h-3 text-white" />}
          </div>
          <span className="text-sm font-semibold"><span className="font-bold">Yellow skin or gums?</span> — stop medication &amp; call vet now</span>
        </button>
        <button type="button" onClick={() => setBleedingOrBruising(!bleedingOrBruising)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors
            ${bleedingOrBruising ? 'bg-red-50 border-red-400 text-red-900' : 'bg-white border-stone-200 text-stone-700 hover:border-red-200'}`}>
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
            ${bleedingOrBruising ? 'bg-red-500 border-red-500' : 'border-stone-300'}`}>
            {bleedingOrBruising && <Check className="w-3 h-3 text-white" />}
          </div>
          <span className="text-sm font-semibold"><span className="font-bold">Unexplained bleeding or bruising?</span> — stop medication &amp; call vet now</span>
        </button>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Anything else to note?</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Any changes in behaviour or appetite patterns?"
          rows={2}
          className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
            focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none mt-2" />
      </div>
    </CollapsibleLogForm>
  )
}

// ── IBD Log Form ──────────────────────────────────────────────────────────

function IBDLogForm({ onSave, petName }: { onSave: (entry: CareLogEntry) => void; petName: string }) {
  const [stoolConsistency, setStoolConsistency] = useState<'normal' | 'soft' | 'watery' | 'bloody'>('normal')
  const [vomitingStr, setVomitingStr] = useState('0')
  const [appetite, setAppetite] = useState<'normal' | 'reduced' | 'refused'>('normal')
  const [weightChange, setWeightChange] = useState<'stable' | 'losing'>('stable')
  const [dietCompliance, setDietCompliance] = useState(true)
  const [lethargyScore, setLethargyScore] = useState(1)
  const [notes, setNotes] = useState('')
  const [backdateOpen, setBackdateOpen] = useState(false)
  const [selectedLogDate, setSelectedLogDate] = useState('')

  const handleSave = useCallback(() => {
    const vomitCount = parseInt(vomitingStr, 10)
    if (isNaN(vomitCount) || vomitCount < 0) return
    const entryDate = selectedLogDate || today()
    const entryTimestamp = selectedLogDate
      ? new Date(`${selectedLogDate}T12:00:00`).toISOString()
      : new Date().toISOString()
    const entry: IBDLogEntry = {
      id: crypto.randomUUID(),
      date: entryDate,
      timestamp: entryTimestamp,
      condition: 'ibd',
      stoolConsistency,
      vomitingCount: vomitCount,
      appetite,
      weightChange,
      dietCompliance,
      lethargyScore,
      notes: notes.trim() || undefined,
    }
    onSave(entry)
    setStoolConsistency('normal')
    setVomitingStr('0')
    setAppetite('normal')
    setWeightChange('stable')
    setDietCompliance(true)
    setLethargyScore(1)
    setNotes('')
    setSelectedLogDate('')
    setBackdateOpen(false)
  }, [stoolConsistency, vomitingStr, appetite, weightChange, dietCompliance, lethargyScore, notes, selectedLogDate, onSave])

  return (
    <CollapsibleLogForm
      ctaLabel={`Log today's check-in for ${petName} →`}
      greetingHeader={`How's ${petName}'s digestion today?`}
      onSave={handleSave}
      canSave={true}
      saveLabel="Save Check-In"
      backdateOpen={backdateOpen}
      onBackdateToggle={() => { setBackdateOpen(!backdateOpen); if (backdateOpen) setSelectedLogDate('') }}
      backdateValue={selectedLogDate}
      onBackdateChange={setSelectedLogDate}
    >
      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">How was the stool today?</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'normal' as const, label: 'Normal' },
            { value: 'soft' as const, label: 'Soft' },
            { value: 'watery' as const, label: 'Watery' },
            { value: 'bloody' as const, label: 'Bloody' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setStoolConsistency(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                stoolConsistency === opt.value
                  ? opt.value === 'bloody' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                  : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
        {stoolConsistency === 'bloody' && (
          <p className="text-sm text-red-600 font-medium mt-2">If you see blood, contact your vet today.</p>
        )}
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Vomiting episodes today?</p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setVomitingStr(String(Math.max(0, parseInt(vomitingStr, 10) - 1)))}
            disabled={parseInt(vomitingStr, 10) <= 0}
            className="w-12 h-12 flex items-center justify-center rounded-xl border border-stone-300
              text-stone-600 hover:bg-[#FFF8E7] disabled:opacity-30 transition-colors">
            <Minus className="w-5 h-5" />
          </button>
          <span className="w-20 text-center text-stone-900 font-bold text-3xl tabular-nums">{vomitingStr}</span>
          <button type="button" onClick={() => setVomitingStr(String(Math.min(20, parseInt(vomitingStr, 10) + 1)))}
            className="w-12 h-12 flex items-center justify-center rounded-xl border border-stone-300
              text-stone-600 hover:bg-[#FFF8E7] transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">How was the appetite?</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'normal' as const, label: 'Normal' },
            { value: 'reduced' as const, label: 'Reduced' },
            { value: 'refused' as const, label: 'Refused' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setAppetite(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                appetite === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Weight — any change recently?</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'stable' as const, label: 'Stable' },
            { value: 'losing' as const, label: 'Losing' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setWeightChange(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                weightChange === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Staying on the prescribed diet?</p>
        <button type="button" onClick={() => setDietCompliance(!dietCompliance)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors
            ${dietCompliance ? 'bg-amber-50 border-amber-400 text-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'}`}>
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
            ${dietCompliance ? 'bg-amber-500 border-amber-500' : 'border-stone-300'}`}>
            {dietCompliance && <Check className="w-3 h-3 text-white" />}
          </div>
          <span className="text-sm font-medium">Yes, following prescribed diet</span>
        </button>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Energy level?</p>
        <ScoreSelector value={lethargyScore} onChange={setLethargyScore} lowLabel="Normal" highLabel="Unresponsive" />
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Anything else to note?</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Any trigger foods, stress, or other observations?"
          rows={2}
          className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
            focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none mt-2" />
      </div>
    </CollapsibleLogForm>
  )
}

// ── CDS Weekly Check-In Form ──────────────────────────────────────────────

function CDSLogForm({ onSave, petName }: { onSave: (entry: CareLogEntry) => void; petName: string }) {
  const [disorientation, setDisorientation] = useState<'none' | 'sometimes' | 'often'>('none')
  const [socialInteraction, setSocialInteraction] = useState<'normal' | 'reduced' | 'changed'>('normal')
  const [sleepChanges, setSleepChanges] = useState<'none' | 'mild' | 'significant'>('none')
  const [houseTraining, setHouseTraining] = useState<'normal' | 'occasional_accidents' | 'frequent_accidents'>('normal')
  const [activityChanges, setActivityChanges] = useState<'normal' | 'less_active' | 'aimless_pacing'>('normal')
  const [anxiety, setAnxiety] = useState<'none' | 'mild' | 'significant'>('none')
  const [notes, setNotes] = useState('')
  const [backdateOpen, setBackdateOpen] = useState(false)
  const [selectedLogDate, setSelectedLogDate] = useState('')

  const previewEntry: CDSLogEntry = {
    id: '', date: '', timestamp: '',
    condition: 'cognitive_dysfunction',
    disorientation, socialInteraction, sleepChanges, houseTraining, activityChanges, anxiety,
  }
  const liveScore = computeDISHAAScore(previewEntry)

  const handleSave = useCallback(() => {
    const entryDate = selectedLogDate || today()
    const entryTimestamp = selectedLogDate
      ? new Date(`${selectedLogDate}T12:00:00`).toISOString()
      : new Date().toISOString()
    const entry: CDSLogEntry = {
      id: crypto.randomUUID(),
      date: entryDate,
      timestamp: entryTimestamp,
      condition: 'cognitive_dysfunction',
      disorientation,
      socialInteraction,
      sleepChanges,
      houseTraining,
      activityChanges,
      anxiety,
      notes: notes.trim() || undefined,
    }
    onSave(entry)
    setDisorientation('none')
    setSocialInteraction('normal')
    setSleepChanges('none')
    setHouseTraining('normal')
    setActivityChanges('normal')
    setAnxiety('none')
    setNotes('')
    setSelectedLogDate('')
    setBackdateOpen(false)
  }, [disorientation, socialInteraction, sleepChanges, houseTraining, activityChanges, anxiety, notes, selectedLogDate, onSave])

  return (
    <CollapsibleLogForm
      ctaLabel={`Log this week's check-in for ${petName} →`}
      greetingHeader={`How has ${petName} been this week?`}
      onSave={handleSave}
      canSave={true}
      saveLabel="Save Weekly Check-In"
      backdateOpen={backdateOpen}
      onBackdateToggle={() => { setBackdateOpen(!backdateOpen); if (backdateOpen) setSelectedLogDate('') }}
      backdateValue={selectedLogDate}
      onBackdateChange={setSelectedLogDate}
    >
      <div className="flex items-center justify-between -mt-2 mb-2">
        <p className="text-sm text-stone-500">Six quick questions about this week. Takes about a minute.</p>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
          liveScore >= 8 ? 'bg-red-100 text-red-700 border-red-300'
          : liveScore >= 4 ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
          : 'bg-green-100 text-green-700 border-green-300'
        }`}>
          Score: {liveScore}/12
        </span>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Any confusion or disorientation this week?</p>
        <p className="text-sm text-stone-500 mb-3">Getting lost at home, staring into space, seeming confused</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'none' as const, label: 'None' },
            { value: 'sometimes' as const, label: 'Sometimes' },
            { value: 'often' as const, label: 'Often' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setDisorientation(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                disorientation === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">How about interaction with the family?</p>
        <p className="text-sm text-stone-500 mb-3">Any change in how they engage with people or other pets?</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'normal' as const, label: 'Normal' },
            { value: 'reduced' as const, label: 'Reduced' },
            { value: 'changed' as const, label: 'Changed' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setSocialInteraction(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                socialInteraction === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Any sleep changes?</p>
        <p className="text-sm text-stone-500 mb-3">Extra day sleeping, restlessness at night, or reversed schedule</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'none' as const, label: 'None' },
            { value: 'mild' as const, label: 'Mild' },
            { value: 'significant' as const, label: 'Significant' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setSleepChanges(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                sleepChanges === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Any accidents in the house?</p>
        <p className="text-sm text-stone-500 mb-3">Toileting indoors despite access to outside or litter box</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'normal' as const, label: 'None' },
            { value: 'occasional_accidents' as const, label: 'Occasional' },
            { value: 'frequent_accidents' as const, label: 'Frequent' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setHouseTraining(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                houseTraining === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Activity changes this week?</p>
        <p className="text-sm text-stone-500 mb-3">Less interest in play, exploration, or purposeful movement</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'normal' as const, label: 'Normal' },
            { value: 'less_active' as const, label: 'Less Active' },
            { value: 'aimless_pacing' as const, label: 'Pacing' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setActivityChanges(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                activityChanges === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Any anxious behavior or unexplained distress?</p>
        <p className="text-sm text-stone-500 mb-3">Vocalizing more, seeking unusual attention, or seeming unsettled</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'none' as const, label: 'None' },
            { value: 'mild' as const, label: 'Mild' },
            { value: 'significant' as const, label: 'Significant' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setAnxiety(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                anxiety === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Anything else to note this week?</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Any specific episodes or observations this week?"
          rows={2}
          className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
            focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none mt-2" />
      </div>
    </CollapsibleLogForm>
  )
}

// ── DM Weekly Check-In Form ───────────────────────────────────────────────

function DMLogForm({ onSave, petName }: { onSave: (entry: CareLogEntry) => void; petName: string }) {
  const [hindLimbWalking, setHindLimbWalking] = useState<'normal_gait' | 'wobbling_or_weak' | 'knuckling' | 'cannot_walk'>('wobbling_or_weak')
  const [canRiseUnassisted, setCanRiseUnassisted] = useState<'yes' | 'with_difficulty' | 'no'>('yes')
  const [pawPlacement, setPawPlacement] = useState<'normal' | 'knuckling_occasional' | 'knuckling_constant'>('normal')
  const [continenceStatus, setContinenceStatus] = useState<'continent' | 'occasional_accident' | 'incontinent'>('continent')
  const [forelimbStrength, setForelimbStrength] = useState<'normal' | 'mild_weakness' | 'significant_weakness'>('normal')
  const [rehabDoneToday, setRehabDoneToday] = useState(false)
  const [notes, setNotes] = useState('')
  const [backdateOpen, setBackdateOpen] = useState(false)
  const [selectedLogDate, setSelectedLogDate] = useState('')

  const handleSave = useCallback(() => {
    const entryDate = selectedLogDate || today()
    const entryTimestamp = selectedLogDate
      ? new Date(`${selectedLogDate}T12:00:00`).toISOString()
      : new Date().toISOString()
    const entry: DMLogEntry = {
      id: crypto.randomUUID(),
      date: entryDate,
      timestamp: entryTimestamp,
      condition: 'degenerative_myelopathy',
      hindLimbWalking,
      canRiseUnassisted,
      pawPlacement,
      continenceStatus,
      forelimbStrength,
      rehabDoneToday,
      notes: notes.trim() || undefined,
    }
    onSave(entry)
    setHindLimbWalking('wobbling_or_weak')
    setCanRiseUnassisted('yes')
    setPawPlacement('normal')
    setContinenceStatus('continent')
    setForelimbStrength('normal')
    setRehabDoneToday(false)
    setNotes('')
    setSelectedLogDate('')
    setBackdateOpen(false)
  }, [hindLimbWalking, canRiseUnassisted, pawPlacement, continenceStatus, forelimbStrength, rehabDoneToday, notes, selectedLogDate, onSave])

  return (
    <CollapsibleLogForm
      ctaLabel={`Log ${petName}'s weekly mobility check-in →`}
      greetingHeader={`How has ${petName} been moving this week?`}
      onSave={handleSave}
      canSave={true}
      saveLabel="Save Weekly Check-In"
      backdateOpen={backdateOpen}
      onBackdateToggle={() => { setBackdateOpen(!backdateOpen); if (backdateOpen) setSelectedLogDate('') }}
      backdateValue={selectedLogDate}
      onBackdateChange={setSelectedLogDate}
    >
      <p className="text-sm text-stone-500 -mt-2 mb-2">A quick weekly snapshot helps your vet track changes over time.</p>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">How are the back legs this week?</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'normal_gait' as const, label: 'Normal' },
            { value: 'wobbling_or_weak' as const, label: 'Wobbling' },
            { value: 'knuckling' as const, label: 'Knuckling' },
            { value: 'cannot_walk' as const, label: "Can't walk" },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setHindLimbWalking(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                hindLimbWalking === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Can {petName} get up without help?</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'yes' as const, label: 'Yes' },
            { value: 'with_difficulty' as const, label: 'With difficulty' },
            { value: 'no' as const, label: 'No' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setCanRiseUnassisted(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                canRiseUnassisted === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Paw placement — any knuckling?</p>
        <p className="text-sm text-stone-500 mb-3">Knuckling is when the paw curls under while walking</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'normal' as const, label: 'Normal' },
            { value: 'knuckling_occasional' as const, label: 'Occasional' },
            { value: 'knuckling_constant' as const, label: 'Constant' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setPawPlacement(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                pawPlacement === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Any incontinence this week?</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'continent' as const, label: 'Continent' },
            { value: 'occasional_accident' as const, label: 'Occasional' },
            { value: 'incontinent' as const, label: 'Incontinent' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setContinenceStatus(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                continenceStatus === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Front leg strength?</p>
        <p className="text-sm text-stone-500 mb-3">DM can eventually affect the front legs too</p>
        <div className="flex rounded-xl overflow-hidden border border-stone-300">
          {([
            { value: 'normal' as const, label: 'Normal' },
            { value: 'mild_weakness' as const, label: 'Mild weakness' },
            { value: 'significant_weakness' as const, label: 'Significant' },
          ]).map((opt) => (
            <button key={opt.value} type="button" onClick={() => setForelimbStrength(opt.value)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                forelimbStrength === opt.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-600 hover:bg-[#FFF8E7]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-3">Did {petName} get physical therapy or exercises today?</p>
        <button type="button" onClick={() => setRehabDoneToday(!rehabDoneToday)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors
            ${rehabDoneToday ? 'bg-amber-50 border-amber-400 text-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'}`}>
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
            ${rehabDoneToday ? 'bg-amber-500 border-amber-500' : 'border-stone-300'}`}>
            {rehabDoneToday && <Check className="w-3 h-3 text-white" />}
          </div>
          <span className="text-sm font-medium">Yes, done today</span>
        </button>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900 mb-1">Anything to note this week?</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Any changes from last week? New equipment or adaptations?"
          rows={2}
          className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
            focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none mt-2" />
      </div>
    </CollapsibleLogForm>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────

function Dashboard({
  petId,
  petCount,
  profile,
  logs,
  currentVial,
  onNewLog,
  onDeleteLog,
  onVialStarted,
  onProfileUpdate,
}: {
  petId: string
  petCount: number
  profile: PetProfile
  logs: CareLogEntry[]
  currentVial: CurrentVial | null
  onNewLog: (entry: CareLogEntry) => void
  onDeleteLog: (id: string) => void
  onVialStarted: () => void
  onProfileUpdate: () => void
}) {
  const router = useRouter()
  const { user } = useCareAuth()
  const [removed, setRemoved] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [showEpilepsyForm, setShowEpilepsyForm] = useState(false)

  const condition = profile.condition
  const isCHF = condition === 'chf'
  const isDiabetes = condition === 'feline_diabetes'
  const isCKD = condition === 'chronic_kidney_disease'
  const isCushings = condition === 'cushings_disease'
  const isOA = condition === 'osteoarthritis'
  const isEpilepsy = condition === 'epilepsy'
  const isHyperthyroidism = condition === 'feline_hyperthyroidism'
  const isIBD = condition === 'ibd'
  const isCDS = condition === 'cognitive_dysfunction'
  const isDM = condition === 'degenerative_myelopathy'
  const isWeekly = isCDS || isDM
  const hasSettings = isDiabetes || isCHF

  const latestLog = logs[0] ?? null
  const epilepsyLogs = logs.filter((l): l is EpilepsyLogEntry => l.condition === 'epilepsy')

  const latestRisk = (() => {
    if (isEpilepsy) return evaluateEpilepsyRisk(epilepsyLogs)
    if (!latestLog) return null
    switch (latestLog.condition) {
      case 'feline_diabetes': return evaluateGlucoseRisk(latestLog.bloodGlucose)
      case 'chf': return evaluateCHFRisk(latestLog.srrBpm, profile.chfBaselineSRR ?? null, latestLog.lethargyLevel)
      case 'chronic_kidney_disease': return evaluateCKDRisk(latestLog)
      case 'cushings_disease': return evaluateCushingsRisk(latestLog)
      case 'osteoarthritis': return evaluateOARisk(latestLog)
      case 'feline_hyperthyroidism': return evaluateHyperthyroidismRisk(latestLog as HyperthyroidismLogEntry)
      case 'ibd': return evaluateIBDRisk(latestLog as IBDLogEntry)
      case 'cognitive_dysfunction': return evaluateCDSRisk(latestLog as CDSLogEntry)
      case 'degenerative_myelopathy': return evaluateDMRisk(latestLog as DMLogEntry)
      default: return null
    }
  })()

  const chartCutoff = new Date()
  chartCutoff.setDate(chartCutoff.getDate() - 7)
  chartCutoff.setHours(0, 0, 0, 0)

  function getChartValue(l: CareLogEntry): number | null {
    switch (l.condition) {
      case 'feline_diabetes': return l.bloodGlucose
      case 'chf': return l.srrBpm
      case 'chronic_kidney_disease': return l.lethargyScore
      case 'cushings_disease': return l.lethargyScore
      case 'osteoarthritis': return l.overallMobilityScore
      case 'feline_hyperthyroidism': return l.lethargyScore
      case 'ibd': return l.vomitingCount
      default: return null
    }
  }

  const chartData = (isEpilepsy || isWeekly) ? [] : logs
    .filter((l) => new Date(l.timestamp) >= chartCutoff)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .flatMap((l) => {
      const v = getChartValue(l)
      return v !== null ? [{ timestamp: l.timestamp, value: v }] : []
    })

  const chartUnit = isCHF ? 'bpm' : isDiabetes ? 'mg/dL'
    : isOA ? 'mobility (1–5)'
    : isIBD ? 'vomit episodes'
    : 'lethargy (1–5)'
  const disclaimer = isDiabetes ? GLUCOSE_DISCLAIMER
    : isCHF ? CHF_DISCLAIMER
    : isCKD ? CKD_DISCLAIMER
    : isCushings ? CUSHINGS_DISCLAIMER
    : isOA ? OA_DISCLAIMER
    : isEpilepsy ? EPILEPSY_DISCLAIMER
    : isHyperthyroidism ? HYPERTHYROIDISM_DISCLAIMER
    : isIBD ? IBD_DISCLAIMER
    : isCDS ? CDS_DISCLAIMER
    : DM_DISCLAIMER

  const now = Date.now()
  const ms24h = 24 * 60 * 60 * 1000
  const ms30d = 30 * 24 * 60 * 60 * 1000
  const seizures24h = epilepsyLogs.filter((l) => now - new Date(l.timestamp).getTime() <= ms24h).length
  const seizures30d = epilepsyLogs.filter((l) => now - new Date(l.timestamp).getTime() <= ms30d).length

  const recentLogs = logs.slice(0, 5)
  const diabetesLogs = logs.filter((l): l is DiabetesLogEntry => l.condition === 'feline_diabetes')

  const nameAndIcon = (
    <>
      <SpeciesIcon species={profile.species} className="w-5 h-5 text-amber-500" />
      <span className="font-semibold text-stone-800">{profile.name}&rsquo;s Care Log</span>
    </>
  )

  if (removed) {
    return (
      <div className="min-h-screen bg-[#FFFBF0] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-sm">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-stone-400" />
          </div>
          <h1 className="text-xl font-bold text-stone-900 mb-1">{profile.name} was removed</h1>
          <p className="text-sm text-stone-500 mb-6">
            Their profile and all logs have been permanently deleted.
          </p>
          <Link
            href="/care"
            className="inline-flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            Return to Tailcue Care
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFFBF0] flex flex-col">
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>
        <span className="text-stone-200">|</span>
        {petCount >= 1 ? (
          <>
            <Link
              href="/care?all=1"
              className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All Pets
            </Link>
            <span className="text-stone-200">|</span>
            <div className="flex items-center gap-3">{nameAndIcon}</div>
          </>
        ) : (
          <div className="flex items-center gap-3">{nameAndIcon}</div>
        )}
        <div className="ml-auto flex items-center gap-3">
          <CareAccountControl />
          <CareShareButton petId={petId} petName={profile.name} />
          <CarePetManageMenu
            petId={petId}
            petName={profile.name}
            memorialized={!!profile.memorializedAt}
            isOwner={!profile.createdBy || profile.createdBy === user?.id}
            onChanged={() => router.push('/care?all=1')}
            onRemoved={() => setRemoved(true)}
          />
          <Link
            href="/care?setup=true"
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Pet
          </Link>
          {hasSettings && (
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </button>
        )}
        </div>
      </header>

      <CareSyncNudge />

      {settingsOpen && hasSettings && (
        isCHF ? (
          <CHFSettingsPanel
            petId={petId}
            profile={profile}
            onSave={() => { onProfileUpdate(); setSettingsOpen(false) }}
            onClose={() => setSettingsOpen(false)}
          />
        ) : (
          <DiabetesSettingsPanel
            petId={petId}
            profile={profile}
            onSave={() => { onProfileUpdate(); setSettingsOpen(false) }}
            onClose={() => setSettingsOpen(false)}
          />
        )
      )}

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-6 pb-24 sm:pb-8">

        <div className="flex justify-end">
          <CareExportButton petId={petId} />
        </div>

        <Link
          href={`/care/${petId}/ate`}
          className="flex items-center justify-center w-full min-h-[44px] rounded-xl border border-stone-200 bg-white hover:border-amber-300 hover:bg-amber-50/30 text-sm font-semibold text-stone-700 transition-colors"
        >
          My pet ate something
        </Link>

        {/* ── Epilepsy dashboard ── */}
        {isEpilepsy && (
          <>
            {latestRisk && latestRisk.level === 'critical' && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">⚠ Emergency</p>
                <p className="text-sm font-medium text-red-900">{latestRisk.message}</p>
              </div>
            )}
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Seizure Activity</p>
                  <div className="flex gap-6 mt-2">
                    <div>
                      <p className="text-2xl font-bold text-stone-900">{seizures24h}</p>
                      <p className="text-xs text-stone-400">last 24 hours</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-stone-900">{seizures30d}</p>
                      <p className="text-xs text-stone-400">last 30 days</p>
                    </div>
                  </div>
                </div>
                {latestRisk && latestRisk.level !== 'critical' && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${latestRisk.badgeColor}`}>
                    {latestRisk.level.charAt(0).toUpperCase() + latestRisk.level.slice(1)}
                  </span>
                )}
              </div>
              {latestRisk && latestRisk.level !== 'critical' && (
                <p className="text-sm text-stone-600">{latestRisk.message}</p>
              )}
            </div>
            {showEpilepsyForm ? (
              <div>
                <EpilepsyLogForm onSave={(e) => { onNewLog(e); setShowEpilepsyForm(false) }} />
                <button onClick={() => setShowEpilepsyForm(false)}
                  className="mt-2 w-full text-xs text-stone-400 hover:text-stone-600 transition-colors py-2">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setShowEpilepsyForm(true)}
                className="w-full rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold py-4 text-base transition-colors">
                + Log a Seizure
              </button>
            )}
          </>
        )}

        {/* ── Weekly conditions (CDS / DM) ── */}
        {isWeekly && (
          <>
            {latestRisk && latestLog && (
              <div className="bg-white rounded-xl border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-stone-400 mb-1">Latest weekly check-in</p>
                    {isCDS && latestLog.condition === 'cognitive_dysfunction' && (
                      <p className="text-3xl font-bold text-stone-900">
                        {computeDISHAAScore(latestLog as CDSLogEntry)}
                        <span className="text-base font-normal text-stone-400">/12</span>
                        <span className="text-base font-normal text-stone-400 ml-1">DISHAA</span>
                      </p>
                    )}
                    {isDM && latestLog.condition === 'degenerative_myelopathy' && (
                      <p className="text-base font-semibold text-stone-900">
                        {(latestLog as DMLogEntry).hindLimbWalking.replace(/_/g, ' ')}
                      </p>
                    )}
                    <p className="text-xs text-stone-400 mt-0.5">
                      {fmtDate(latestLog.date)} at {fmtTime(latestLog.timestamp)}
                    </p>
                  </div>
                  <span className={`mt-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${latestRisk.badgeColor}`}>
                    {latestRisk.displayLabel ?? (latestRisk.level.charAt(0).toUpperCase() + latestRisk.level.slice(1))}
                  </span>
                </div>
                <p className="text-sm text-stone-600 mt-3">{latestRisk.message}</p>
              </div>
            )}
            {isDM && latestLog && latestLog.condition === 'degenerative_myelopathy' &&
              ((latestLog as DMLogEntry).hindLimbWalking === 'cannot_walk' || (latestLog as DMLogEntry).continenceStatus === 'incontinent') && (
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1">Mobility Aid Resources</p>
                <p className="text-sm text-stone-600">
                  Wheelchair carts, drag bags, and sling harnesses can significantly improve quality of life at this stage.
                  Ask your vet or a veterinary rehabilitation specialist for recommendations suited to your dog&rsquo;s size.
                </p>
              </div>
            )}
            {isCDS && <CDSLogForm onSave={onNewLog} petName={profile.name} />}
            {isDM && <DMLogForm onSave={onNewLog} petName={profile.name} />}
            {recentLogs.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Recent Check-Ins</p>
                  {logs.length > 5 && (
                    <Link href={`/care/${petId}/history`}
                      className="text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors">
                      View all →
                    </Link>
                  )}
                </div>
                <ul className="divide-y divide-stone-100">
                  {recentLogs.map((log) => {
                    const weeklyRisk = (() => {
                      if (log.condition === 'cognitive_dysfunction') return evaluateCDSRisk(log as CDSLogEntry)
                      if (log.condition === 'degenerative_myelopathy') return evaluateDMRisk(log as DMLogEntry)
                      return null
                    })()
                    if (!weeklyRisk) return null
                    const isConfirming = pendingDeleteId === log.id
                    return (
                      <li key={log.id} className="py-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {log.condition === 'cognitive_dysfunction' && (
                              <span className="font-semibold text-stone-900 text-sm">DISHAA {computeDISHAAScore(log as CDSLogEntry)}/12</span>
                            )}
                            {log.condition === 'degenerative_myelopathy' && (
                              <span className="font-semibold text-stone-900 text-sm">{(log as DMLogEntry).hindLimbWalking.replace(/_/g, ' ')}</span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${weeklyRisk.badgeColor}`}>
                              {weeklyRisk.displayLabel ?? weeklyRisk.level}
                            </span>
                          </div>
                          <p className="text-xs text-stone-400 mt-0.5">
                            {fmtDate(log.date)} &middot; {fmtTime(log.timestamp)}
                          </p>
                        </div>
                        {isConfirming ? (
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={() => { onDeleteLog(log.id); setPendingDeleteId(null) }}
                              className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">Delete</button>
                            <button onClick={() => setPendingDeleteId(null)}
                              className="text-xs font-medium text-stone-500 hover:text-stone-700 px-2 py-1 rounded border border-stone-200 hover:bg-stone-50 transition-colors">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setPendingDeleteId(log.id)}
                            className="text-stone-300 hover:text-red-400 transition-colors shrink-0 mt-0.5" aria-label="Delete entry">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </>
        )}

        {/* ── Daily check-in conditions (non-epilepsy, non-weekly) ── */}
        {!isEpilepsy && !isWeekly && latestRisk && latestLog && (
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-stone-400 mb-1">Latest reading</p>
                {latestLog.condition === 'feline_diabetes' && (
                  <p className="text-3xl font-bold text-stone-900">
                    {latestLog.bloodGlucose}
                    <span className="text-base font-normal text-stone-400 ml-1">mg/dL</span>
                  </p>
                )}
                {latestLog.condition === 'chf' && (
                  <p className="text-3xl font-bold text-stone-900">
                    {latestLog.srrBpm}
                    <span className="text-base font-normal text-stone-400 ml-1">bpm</span>
                  </p>
                )}
                {latestLog.condition === 'chronic_kidney_disease' && (
                  <p className="text-3xl font-bold text-stone-900">
                    {latestLog.vomitingCount}
                    <span className="text-base font-normal text-stone-400 ml-1">vomit episodes</span>
                  </p>
                )}
                {latestLog.condition === 'cushings_disease' && (
                  <p className="text-3xl font-bold text-stone-900">
                    {latestLog.lethargyScore}<span className="text-base font-normal text-stone-400">/5</span>
                    <span className="text-base font-normal text-stone-400 ml-1">lethargy</span>
                  </p>
                )}
                {latestLog.condition === 'osteoarthritis' && (
                  <p className="text-3xl font-bold text-stone-900">
                    {latestLog.overallMobilityScore}<span className="text-base font-normal text-stone-400">/5</span>
                    <span className="text-base font-normal text-stone-400 ml-1">mobility</span>
                  </p>
                )}
                {latestLog.condition === 'feline_hyperthyroidism' && (
                  <p className="text-3xl font-bold text-stone-900">
                    {(latestLog as HyperthyroidismLogEntry).vomitingCount}
                    <span className="text-base font-normal text-stone-400 ml-1">vomit episodes</span>
                  </p>
                )}
                {latestLog.condition === 'ibd' && (
                  <p className="text-xl font-bold text-stone-900">
                    {(latestLog as IBDLogEntry).stoolConsistency}
                    <span className="text-base font-normal text-stone-400 ml-1">stool</span>
                  </p>
                )}
                <p className="text-xs text-stone-400 mt-0.5">
                  {fmtDate(latestLog.date)} at {fmtTime(latestLog.timestamp)}
                </p>
              </div>
              <span className={`mt-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${latestRisk.badgeColor}`}>
                {latestRisk.displayLabel ?? (latestRisk.level.charAt(0).toUpperCase() + latestRisk.level.slice(1))}
              </span>
            </div>
            <p className="text-sm text-stone-600 mt-3">{latestRisk.message}</p>
          </div>
        )}

        {isDiabetes && (
          <SupplyCard
            petId={petId}
            profile={profile}
            logs={diabetesLogs}
            currentVial={currentVial}
            onVialStarted={onVialStarted}
          />
        )}

        {isDiabetes && <DiabetesLogForm onSave={onNewLog} petName={profile.name} />}
        {isCHF && <CHFLogForm onSave={onNewLog} petName={profile.name} />}
        {isCKD && <CKDLogForm onSave={onNewLog} petName={profile.name} />}
        {isCushings && <CushingsLogForm onSave={onNewLog} petName={profile.name} />}
        {isOA && <OALogForm onSave={onNewLog} petName={profile.name} />}
        {isHyperthyroidism && <HyperthyroidismLogForm onSave={onNewLog} petName={profile.name} />}
        {isIBD && <IBDLogForm onSave={onNewLog} petName={profile.name} />}

        {!isEpilepsy && !isWeekly && chartData.length >= 2 && (
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">7-Day Trend</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis
                  dataKey="timestamp"
                  type="category"
                  tick={{ fontSize: 10, fill: '#a8a29e' }}
                  tickFormatter={(ts: string) =>
                    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e5e4' }}
                  formatter={(value) => [`${value} ${chartUnit}`, isCHF ? 'Resp. Rate' : 'Reading']}
                  labelFormatter={(ts) => {
                    const d = new Date(String(ts))
                    return (
                      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
                      ', ' +
                      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    )
                  }}
                  labelStyle={{ color: '#78716c', marginBottom: 4 }}
                />
                {isCHF && (
                  <>
                    <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '30', fontSize: 9, fill: '#f59e0b', position: 'right' }} />
                    <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="4 2" label={{ value: '35', fontSize: 9, fill: '#ef4444', position: 'right' }} />
                  </>
                )}
                {isDiabetes && (
                  <>
                    <ReferenceLine y={80}  stroke="#22c55e" strokeDasharray="4 2" label={{ value: '80',  fontSize: 9, fill: '#22c55e', position: 'right' }} />
                    <ReferenceLine y={250} stroke="#22c55e" strokeDasharray="4 2" label={{ value: '250', fontSize: 9, fill: '#22c55e', position: 'right' }} />
                  </>
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent readings — daily non-epilepsy conditions */}
        {!isEpilepsy && !isWeekly && recentLogs.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Recent Readings</p>
              {logs.length > 5 && (
                <Link
                  href={`/care/${petId}/history`}
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
                >
                  View all →
                </Link>
              )}
            </div>
            <ul className="divide-y divide-stone-100">
              {recentLogs.map((log) => {
                const risk = (() => {
                  switch (log.condition) {
                    case 'feline_diabetes': return evaluateGlucoseRisk(log.bloodGlucose)
                    case 'chf': return evaluateCHFRisk(log.srrBpm, profile.chfBaselineSRR ?? null, log.lethargyLevel)
                    case 'chronic_kidney_disease': return evaluateCKDRisk(log)
                    case 'cushings_disease': return evaluateCushingsRisk(log)
                    case 'osteoarthritis': return evaluateOARisk(log)
                    case 'feline_hyperthyroidism': return evaluateHyperthyroidismRisk(log as HyperthyroidismLogEntry)
                    case 'ibd': return evaluateIBDRisk(log as IBDLogEntry)
                    default: return null
                  }
                })()
                if (!risk) return null
                const isConfirming = pendingDeleteId === log.id
                return (
                  <li key={log.id} className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {log.condition === 'feline_diabetes' && (
                          <span className="font-semibold text-stone-900 text-sm">{log.bloodGlucose} mg/dL</span>
                        )}
                        {log.condition === 'chf' && (
                          <span className="font-semibold text-stone-900 text-sm">{log.srrBpm} bpm</span>
                        )}
                        {log.condition === 'chronic_kidney_disease' && (
                          <span className="font-semibold text-stone-900 text-sm">{log.vomitingCount} vomit · skin: {log.skinTurgor}</span>
                        )}
                        {log.condition === 'cushings_disease' && (
                          <span className="font-semibold text-stone-900 text-sm">lethargy {log.lethargyScore}/5 · water: {log.waterIntake}</span>
                        )}
                        {log.condition === 'osteoarthritis' && (
                          <span className="font-semibold text-stone-900 text-sm">mobility {log.overallMobilityScore}/5 · rising: {log.easOfRising}</span>
                        )}
                        {log.condition === 'feline_hyperthyroidism' && (
                          <span className="font-semibold text-stone-900 text-sm">{(log as HyperthyroidismLogEntry).vomitingCount} vomit · appetite: {(log as HyperthyroidismLogEntry).appetite}</span>
                        )}
                        {log.condition === 'ibd' && (
                          <span className="font-semibold text-stone-900 text-sm">stool: {(log as IBDLogEntry).stoolConsistency} · {(log as IBDLogEntry).vomitingCount} vomit</span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${risk.badgeColor}`}>
                          {risk.displayLabel ?? risk.level}
                        </span>
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {fmtDate(log.date)} &middot; {fmtTime(log.timestamp)}
                        {log.condition === 'chf' && ` · lethargy ${log.lethargyLevel}`}
                        {log.condition === 'feline_diabetes' && (
                          (log.insulinUnits > 0 ? ` · ${log.insulinUnits}u ${log.insulinType || 'insulin'}` : '') + ` · ${log.appetite}`
                        )}
                      </p>
                    </div>
                    {isConfirming ? (
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => { onDeleteLog(log.id); setPendingDeleteId(null) }}
                          className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1
                            rounded border border-red-200 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setPendingDeleteId(null)}
                          className="text-xs font-medium text-stone-500 hover:text-stone-700 px-2 py-1
                            rounded border border-stone-200 hover:bg-stone-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPendingDeleteId(log.id)}
                        className="text-stone-300 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                        aria-label="Delete entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Epilepsy: seizure event list */}
        {isEpilepsy && epilepsyLogs.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Seizure History</p>
              {epilepsyLogs.length > 5 && (
                <Link href={`/care/${petId}/history`}
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors">
                  View all →
                </Link>
              )}
            </div>
            <ul className="divide-y divide-stone-100">
              {epilepsyLogs.slice(0, 5).map((log) => (
                <li key={log.id} className="py-3">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                      log.severity === 'severe'   ? 'bg-red-100 text-red-800 border-red-300' :
                      log.severity === 'moderate' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                      'bg-yellow-100 text-yellow-800 border-yellow-300'
                    }`}>
                      {log.severity}
                    </span>
                    <span className={`font-semibold text-sm ${log.durationMinutes >= 5 ? 'text-red-700' : 'text-stone-900'}`}>
                      {log.durationMinutes} min
                    </span>
                    {log.durationMinutes >= 5 && (
                      <span className="text-xs text-red-600 font-medium">⚠ 5+ min</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400">
                    {fmtDate(log.date)} at {fmtTime(log.timestamp)}
                    {log.postIctalMinutes > 0 && ` · ${log.postIctalMinutes} min recovery`}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-stone-400 text-center leading-relaxed px-2">{disclaimer}</p>
      </main>

      <Footer disclaimer="Tailcue Care is a logging tool to help you track your pet's condition at home. It does not provide medical advice or diagnoses. Always follow your veterinarian's guidance." />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PetDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const petId = params.petId as string

  const [mounted, setMounted] = useState(false)
  const [record, setRecord] = useState<PetRecord | null>(null)
  const [petCount, setPetCount] = useState(1)

  useEffect(() => {
    setMounted(true)
    getPet(petId).then((r) => {
      if (!r) {
        router.replace('/care')
        return
      }
      setRecord(r)
    })
    getAllPets().then((all) => setPetCount(all.length))
  }, [petId, router])

  if (!mounted || !record) return null

  return (
    <Dashboard
      petId={petId}
      petCount={petCount}
      profile={record.profile}
      logs={record.logs}
      currentVial={record.currentVial}
      onNewLog={(entry) => {
        setRecord((prev) => prev ? { ...prev, logs: [entry, ...prev.logs] } : prev)
        addLogEntry(petId, entry)
      }}
      onDeleteLog={(id) => {
        setRecord((prev) => prev ? { ...prev, logs: prev.logs.filter((l) => l.id !== id) } : prev)
        deleteLogEntry(petId, id)
      }}
      onVialStarted={() => {
        getPet(petId).then((r) => { if (r) setRecord(r) })
      }}
      onProfileUpdate={() => {
        getPet(petId).then((r) => { if (r) setRecord(r) })
      }}
    />
  )
}
