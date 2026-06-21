'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import Link from 'next/link'
import {
  Cat, Dog, Plus, Minus, Trash2, ArrowLeft, ExternalLink,
  ChevronDown, ChevronUp, Settings,
} from 'lucide-react'
import {
  getCareData, saveProfile, addLogEntry, deleteLogEntry,
  startNewVial, updateInsulinDefaults, updateCHFBaseline,
  type CareLogEntry, type DiabetesLogEntry, type CHFLogEntry,
  type PetProfile, type CurrentVial,
} from '@/lib/care-storage'
import {
  evaluateGlucoseRisk, GLUCOSE_DISCLAIMER,
  evaluateCHFRisk, CHF_DISCLAIMER,
} from '@/lib/care-risk-engine'
import { estimateInsulinSupply } from '@/lib/care-supply-estimator'
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
  return species === 'dog'
    ? <Dog className={className} />
    : <Cat className={className} />
}

// ── Setup Screen ──────────────────────────────────────────────────────────

const CONDITION_META: Record<'feline_diabetes' | 'chf', { label: string; description: string }> = {
  feline_diabetes: {
    label: 'Feline Diabetes',
    description: 'Daily glucose monitoring helps catch highs and lows early.',
  },
  chf: {
    label: 'Heart Disease (CHF)',
    description: 'Track resting respiratory rate to monitor heart failure at home.',
  },
}

function SetupScreen({
  onSave,
}: {
  onSave: (
    name: string,
    species: 'cat' | 'dog',
    condition: 'feline_diabetes' | 'chf',
    concentration?: 'U-40' | 'U-100',
    vialSizeML?: number,
    baselineSRR?: number
  ) => void
}) {
  const [species, setSpecies] = useState<'cat' | 'dog'>('cat')
  const [condition, setCondition] = useState<'feline_diabetes' | 'chf'>('feline_diabetes')
  const [name, setName] = useState('')

  // diabetes optional fields
  const [showInsulinDetails, setShowInsulinDetails] = useState(false)
  const [concentration, setConcentration] = useState<'U-40' | 'U-100' | null>(null)
  const [vialSizeMlStr, setVialSizeMlStr] = useState('')

  // chf optional fields
  const [showBaselineDetails, setShowBaselineDetails] = useState(false)
  const [baselineSRRStr, setBaselineSRRStr] = useState('')

  function handleSpeciesChange(s: 'cat' | 'dog') {
    setSpecies(s)
    setCondition(s === 'dog' ? 'chf' : 'feline_diabetes')
    setShowInsulinDetails(false)
    setShowBaselineDetails(false)
    setConcentration(null)
    setVialSizeMlStr('')
    setBaselineSRRStr('')
  }

  function handleConditionChange(c: 'feline_diabetes' | 'chf') {
    setCondition(c)
    setShowInsulinDetails(false)
    setShowBaselineDetails(false)
    setConcentration(null)
    setVialSizeMlStr('')
    setBaselineSRRStr('')
  }

  function handleSave() {
    if (!name.trim()) return
    const conc = concentration ?? undefined
    const mlParsed = parseFloat(vialSizeMlStr)
    const ml = vialSizeMlStr && !isNaN(mlParsed) && mlParsed > 0 ? mlParsed : undefined
    const srrParsed = parseFloat(baselineSRRStr)
    const srr = baselineSRRStr && !isNaN(srrParsed) && srrParsed > 0 ? srrParsed : undefined
    onSave(name.trim(), species, condition, conc, ml, srr)
  }

  const conditionMeta = CONDITION_META[condition]

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <SpeciesIcon species={species} className="w-7 h-7 text-amber-500" />
          <span className="text-xl font-semibold text-stone-800">Tailcue Care</span>
        </div>

        <h1 className="text-2xl font-bold text-stone-900 mb-6">
          Set up your tracker
        </h1>

        {/* Species selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Species</label>
          <div className="flex rounded-lg overflow-hidden border border-stone-300">
            {([
              { value: 'cat' as const, label: 'Cat' },
              { value: 'dog' as const, label: 'Dog' },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSpeciesChange(opt.value)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  species === opt.value
                    ? 'bg-amber-500 text-white'
                    : 'bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Condition selector — cats get a choice, dogs auto-select CHF */}
        {species === 'cat' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Condition</label>
            <div className="flex rounded-lg overflow-hidden border border-stone-300">
              {([
                { value: 'feline_diabetes' as const, label: 'Diabetes' },
                { value: 'chf'             as const, label: 'Heart Disease' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleConditionChange(opt.value)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    condition === opt.value
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Condition description card */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
            {species === 'dog' ? 'Condition' : 'Tracking'}
          </p>
          <p className="text-sm text-amber-900 font-medium">{conditionMeta.label}</p>
          <p className="text-xs text-amber-700 mt-1">{conditionMeta.description}</p>
        </div>

        {/* Pet name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Your {species}&rsquo;s name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={species === 'dog' ? 'e.g. Buddy' : 'e.g. Mochi'}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && handleSave()}
          />
        </div>

        {/* Optional: diabetes insulin details */}
        {condition === 'feline_diabetes' && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowInsulinDetails(!showInsulinDetails)}
              className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              {showInsulinDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Insulin details (optional — you can add this later)
            </button>
            {showInsulinDetails && (
              <div className="mt-3 space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1.5">Insulin Concentration</label>
                  <div className="flex rounded-lg overflow-hidden border border-stone-300">
                    {(['U-40', 'U-100'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setConcentration(concentration === c ? null : c)}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${
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
                  <label className="block text-xs font-medium text-stone-600 mb-1.5">Vial Size (mL)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={vialSizeMlStr}
                    onChange={(e) => setVialSizeMlStr(e.target.value)}
                    placeholder="10"
                    min="1"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 text-sm
                      focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Optional: CHF baseline SRR */}
        {condition === 'chf' && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowBaselineDetails(!showBaselineDetails)}
              className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              {showBaselineDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Baseline resting rate (optional — you can set this later)
            </button>
            {showBaselineDetails && (
              <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <label className="block text-xs font-medium text-stone-600 mb-1.5">
                  Baseline resting rate (breaths/min)
                </label>
                <p className="text-xs text-stone-400 mb-2">
                  Your vet&rsquo;s normal target for {name.trim() || 'your pet'}, used to catch smaller
                  increases early. Skip this — you can set it from Settings after a few days of readings.
                </p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={baselineSRRStr}
                  onChange={(e) => setBaselineSRRStr(e.target.value)}
                  placeholder="e.g. 24"
                  min="1"
                  max="60"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 text-sm
                    focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
            )}
          </div>
        )}

        <button
          disabled={!name.trim()}
          onClick={handleSave}
          className="w-full rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-stone-200
            disabled:text-stone-400 text-white font-semibold py-3 text-sm transition-colors"
        >
          Start Tracking
        </button>
      </div>
    </div>
  )
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
    <div className="flex rounded-lg overflow-hidden border border-stone-300">
      {APPETITE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-amber-500 text-white'
              : 'bg-white text-stone-600 hover:bg-stone-50'
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
      <div className="flex rounded-lg overflow-hidden border border-stone-300">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              value === n
                ? 'bg-amber-500 text-white'
                : 'bg-white text-stone-600 hover:bg-stone-50'
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
  profile,
  onSave,
  onClose,
}: {
  profile: PetProfile
  onSave: () => void
  onClose: () => void
}) {
  const [concentration, setConcentration] = useState<'U-40' | 'U-100'>(
    profile.insulinConcentration ?? 'U-40'
  )
  const [vialSizeMlStr, setVialSizeMlStr] = useState(String(profile.vialSizeML ?? 10))

  function handleSave() {
    const ml = parseFloat(vialSizeMlStr)
    if (isNaN(ml) || ml <= 0) return
    updateInsulinDefaults(concentration, ml)
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
            <div className="flex rounded-lg overflow-hidden border border-stone-300 w-fit">
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
              className="w-28 rounded-lg border border-stone-300 px-3 py-2 text-stone-900 text-sm
                focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            Save Defaults
          </button>
          <button
            onClick={onClose}
            className="text-xs font-medium text-stone-500 hover:text-stone-700 px-3 py-1.5
              rounded-lg border border-stone-200 hover:bg-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function CHFSettingsPanel({
  profile,
  onSave,
  onClose,
}: {
  profile: PetProfile
  onSave: () => void
  onClose: () => void
}) {
  const [baselineSRRStr, setBaselineSRRStr] = useState(
    profile.chfBaselineSRR != null ? String(profile.chfBaselineSRR) : ''
  )

  function handleSave() {
    const srr = parseFloat(baselineSRRStr)
    if (isNaN(srr) || srr <= 0) return
    updateCHFBaseline(srr)
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
            className="w-28 rounded-lg border border-stone-300 px-3 py-2 text-stone-900 text-sm
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="text-xs font-medium text-stone-500 hover:text-stone-700 px-3 py-1.5
              rounded-lg border border-stone-200 hover:bg-white transition-colors"
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
        <div className="flex rounded-lg overflow-hidden border border-stone-300">
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
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 text-sm
            focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1.5">Vial status</label>
        <div className="flex rounded-lg overflow-hidden border border-stone-300">
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
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 text-sm
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleConfirm}
          disabled={!vialSizeMlStr || parseFloat(vialSizeMlStr) <= 0}
          className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-stone-200
            disabled:text-stone-400 text-white font-semibold py-2.5 text-xs transition-colors"
        >
          Start Tracking This Vial
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2.5 text-xs font-medium text-stone-500 hover:text-stone-700
            rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Supply Card (diabetes only) ───────────────────────────────────────────

function SupplyCard({
  profile,
  logs,
  currentVial,
  onVialStarted,
}: {
  profile: PetProfile
  logs: DiabetesLogEntry[]
  currentVial: CurrentVial | null
  onVialStarted: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const supply = estimateInsulinSupply(logs, currentVial)

  function handleVialConfirmed(
    concentration: 'U-40' | 'U-100',
    vialSizeML: number,
    unitsAlreadyUsedAtStart: number
  ) {
    startNewVial(concentration, vialSizeML, unitsAlreadyUsedAtStart)
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
              border border-amber-300 bg-white rounded-lg px-3 py-2 transition-colors"
          >
            Chewy Pharmacy <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
          <a
            href={PETMEDS_RESTOCK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800
              border border-amber-300 bg-white rounded-lg px-3 py-2 transition-colors"
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
        <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
          <label className="block text-xs font-medium text-stone-600 mb-1.5">Entry date</label>
          <input
            type="date"
            value={value}
            max={today()}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-stone-900 text-sm
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

// ── Diabetes Log Form ─────────────────────────────────────────────────────

function DiabetesLogForm({ onSave }: { onSave: (entry: CareLogEntry) => void }) {
  const [bgInput, setBgInput] = useState('')
  const [insulinUnits, setInsulinUnits] = useState(1.0)
  const [insulinType, setInsulinType] = useState('')
  const [appetite, setAppetite] = useState<Appetite>('normal')
  const [saving, setSaving] = useState(false)
  const [backdateOpen, setBackdateOpen] = useState(false)
  const [selectedLogDate, setSelectedLogDate] = useState('')

  const adjustInsulin = (delta: number) => {
    setInsulinUnits((prev) => Math.max(0, Math.round((prev + delta) * 2) / 2))
  }

  const handleSave = useCallback(() => {
    const bg = parseInt(bgInput, 10)
    if (isNaN(bg) || bg <= 0) return
    setSaving(true)

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
    setSaving(false)
  }, [bgInput, insulinUnits, insulinType, appetite, selectedLogDate, onSave])

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-4">Log a Reading</p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Blood Glucose (mg/dL)</label>
          <input
            type="number"
            inputMode="numeric"
            value={bgInput}
            onChange={(e) => setBgInput(e.target.value)}
            placeholder="e.g. 180"
            min="1"
            max="999"
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Insulin Units</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => adjustInsulin(-0.5)}
              disabled={insulinUnits <= 0}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-stone-300
                text-stone-600 hover:bg-stone-50 disabled:opacity-30 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-14 text-center text-stone-900 font-semibold text-lg tabular-nums">
              {insulinUnits % 1 === 0 ? `${insulinUnits}.0` : insulinUnits}
            </span>
            <button
              type="button"
              onClick={() => adjustInsulin(0.5)}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-stone-300
                text-stone-600 hover:bg-stone-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Insulin Type <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={insulinType}
            onChange={(e) => setInsulinType(e.target.value)}
            placeholder="e.g. Glargine, PZI"
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Appetite</label>
          <AppetiteSelector value={appetite} onChange={setAppetite} />
        </div>

        <BackdateDisclosure
          open={backdateOpen}
          onToggle={() => { setBackdateOpen(!backdateOpen); if (backdateOpen) setSelectedLogDate('') }}
          value={selectedLogDate}
          onChange={setSelectedLogDate}
        />

        <button
          type="button"
          disabled={!bgInput.trim() || parseInt(bgInput, 10) <= 0 || saving}
          onClick={handleSave}
          className="w-full rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-stone-200
            disabled:text-stone-400 text-white font-semibold py-3 text-sm transition-colors"
        >
          Save Reading
        </button>
      </div>
    </div>
  )
}

// ── CHF Log Form ──────────────────────────────────────────────────────────

function CHFLogForm({ onSave }: { onSave: (entry: CareLogEntry) => void }) {
  const [srrInput, setSrrInput] = useState('')
  const [lethargyLevel, setLethargyLevel] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [saving, setSaving] = useState(false)
  const [backdateOpen, setBackdateOpen] = useState(false)
  const [selectedLogDate, setSelectedLogDate] = useState('')

  const handleSave = useCallback(() => {
    const srr = parseInt(srrInput, 10)
    if (isNaN(srr) || srr <= 0) return
    setSaving(true)

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
    setSaving(false)
  }, [srrInput, lethargyLevel, selectedLogDate, onSave])

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-4">Log a Reading</p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Sleeping Respiratory Rate (breaths/min)
          </label>
          <p className="text-xs text-stone-400 mb-2">
            Count breaths for 30 seconds while your pet is calm or asleep, then multiply by 2.
          </p>
          <input
            type="number"
            inputMode="numeric"
            value={srrInput}
            onChange={(e) => setSrrInput(e.target.value)}
            placeholder="e.g. 24"
            min="1"
            max="99"
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Energy Level <span className="text-stone-400 font-normal">(1 = normal, 5 = won&rsquo;t get up)</span>
          </label>
          <LethargySelector value={lethargyLevel} onChange={setLethargyLevel} />
        </div>

        <BackdateDisclosure
          open={backdateOpen}
          onToggle={() => { setBackdateOpen(!backdateOpen); if (backdateOpen) setSelectedLogDate('') }}
          value={selectedLogDate}
          onChange={setSelectedLogDate}
        />

        <button
          type="button"
          disabled={!srrInput.trim() || parseInt(srrInput, 10) <= 0 || saving}
          onClick={handleSave}
          className="w-full rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-stone-200
            disabled:text-stone-400 text-white font-semibold py-3 text-sm transition-colors"
        >
          Save Reading
        </button>
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────

function Dashboard({
  profile,
  logs,
  currentVial,
  onNewLog,
  onDeleteLog,
  onVialStarted,
  onProfileUpdate,
}: {
  profile: PetProfile
  logs: CareLogEntry[]
  currentVial: CurrentVial | null
  onNewLog: (entry: CareLogEntry) => void
  onDeleteLog: (id: string) => void
  onVialStarted: () => void
  onProfileUpdate: () => void
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const latestLog = logs[0] ?? null

  // Risk assessment for the status card
  const latestRisk = latestLog
    ? latestLog.condition === 'chf'
      ? evaluateCHFRisk(latestLog.srrBpm, profile.chfBaselineSRR ?? null, latestLog.lethargyLevel)
      : evaluateGlucoseRisk(latestLog.bloodGlucose)
    : null

  // Chart data — one point per entry, 7-day window
  const chartCutoff = new Date()
  chartCutoff.setDate(chartCutoff.getDate() - 7)
  chartCutoff.setHours(0, 0, 0, 0)

  const chartData = logs
    .filter((l) => new Date(l.timestamp) >= chartCutoff)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((l) => ({
      timestamp: l.timestamp,
      value: l.condition === 'chf' ? l.srrBpm : l.bloodGlucose,
    }))

  const isCHF = profile.condition === 'chf'
  const chartUnit = isCHF ? 'bpm' : 'mg/dL'
  const disclaimer = isCHF ? CHF_DISCLAIMER : GLUCOSE_DISCLAIMER

  const recentLogs = logs.slice(0, 5)

  // Filtered diabetes logs for supply estimator
  const diabetesLogs = logs.filter((l): l is DiabetesLogEntry => l.condition === 'feline_diabetes')

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>
        <span className="text-stone-200">|</span>
        <SpeciesIcon species={profile.species} className="w-5 h-5 text-amber-500" />
        <span className="font-semibold text-stone-800">{profile.name}&rsquo;s Care Log</span>
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="ml-auto flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>
      </header>

      {/* Settings panel */}
      {settingsOpen && (
        isCHF ? (
          <CHFSettingsPanel
            profile={profile}
            onSave={() => { onProfileUpdate(); setSettingsOpen(false) }}
            onClose={() => setSettingsOpen(false)}
          />
        ) : (
          <DiabetesSettingsPanel
            profile={profile}
            onSave={() => { onProfileUpdate(); setSettingsOpen(false) }}
            onClose={() => setSettingsOpen(false)}
          />
        )
      )}

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-6">

        {/* Status card */}
        {latestRisk && latestLog && (
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-stone-400 mb-1">Latest reading</p>
                <p className="text-3xl font-bold text-stone-900">
                  {latestLog.condition === 'chf' ? latestLog.srrBpm : latestLog.bloodGlucose}
                  <span className="text-base font-normal text-stone-400 ml-1">{chartUnit}</span>
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {fmtDate(latestLog.date)} at {fmtTime(latestLog.timestamp)}
                </p>
              </div>
              <span className={`mt-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${latestRisk.badgeColor}`}>
                {latestRisk.level.charAt(0).toUpperCase() + latestRisk.level.slice(1)}
              </span>
            </div>
            <p className="text-sm text-stone-600 mt-3">{latestRisk.message}</p>
          </div>
        )}

        {/* Supply card — diabetes only */}
        {!isCHF && (
          <SupplyCard
            profile={profile}
            logs={diabetesLogs}
            currentVial={currentVial}
            onVialStarted={onVialStarted}
          />
        )}

        {/* 7-day trend chart */}
        {chartData.length >= 2 && (
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
                  formatter={(value) => [`${value} ${chartUnit}`, isCHF ? 'Resp. Rate' : 'Blood Glucose']}
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
                {isCHF ? (
                  <>
                    <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '30', fontSize: 9, fill: '#f59e0b', position: 'right' }} />
                    <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="4 2" label={{ value: '35', fontSize: 9, fill: '#ef4444', position: 'right' }} />
                  </>
                ) : (
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

        {/* Log form — condition-specific */}
        {isCHF
          ? <CHFLogForm onSave={onNewLog} />
          : <DiabetesLogForm onSave={onNewLog} />
        }

        {/* Recent log entries */}
        {recentLogs.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Recent Readings</p>
              {logs.length > 5 && (
                <Link
                  href="/care/history"
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
                >
                  View all →
                </Link>
              )}
            </div>
            <ul className="divide-y divide-stone-100">
              {recentLogs.map((log) => {
                const risk = log.condition === 'chf'
                  ? evaluateCHFRisk(log.srrBpm, profile.chfBaselineSRR ?? null, log.lethargyLevel)
                  : evaluateGlucoseRisk(log.bloodGlucose)
                const isConfirming = pendingDeleteId === log.id
                return (
                  <li key={log.id} className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-stone-900 text-sm">
                          {log.condition === 'chf' ? `${log.srrBpm} bpm` : `${log.bloodGlucose} mg/dL`}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${risk.badgeColor}`}>
                          {risk.level}
                        </span>
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {fmtDate(log.date)} &middot; {fmtTime(log.timestamp)}
                        {log.condition === 'chf'
                          ? ` · lethargy ${log.lethargyLevel}`
                          : (log.insulinUnits > 0 ? ` · ${log.insulinUnits}u ${log.insulinType || 'insulin'}` : '') +
                            ` · ${log.appetite}`
                        }
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

        {/* Disclaimer */}
        <p className="text-xs text-stone-400 text-center leading-relaxed px-2">{disclaimer}</p>
      </main>

      <Footer disclaimer="Tailcue Care is a logging tool to help you track your pet's condition at home. It does not provide medical advice or diagnoses. Always follow your veterinarian's guidance." />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function CarePage() {
  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState<PetProfile | null>(null)
  const [logs, setLogs] = useState<CareLogEntry[]>([])
  const [currentVial, setCurrentVial] = useState<CurrentVial | null>(null)

  useEffect(() => {
    setMounted(true)
    const data = getCareData()
    setProfile(data.profile)
    setLogs(data.logs)
    setCurrentVial(data.currentVial)
  }, [])

  if (!mounted) return null

  if (!profile) {
    return (
      <SetupScreen
        onSave={(name, species, condition, concentration, vialSizeML, baselineSRR) => {
          const p: PetProfile = {
            name,
            species,
            condition,
            createdAt: new Date().toISOString(),
            ...(concentration ? { insulinConcentration: concentration } : {}),
            ...(vialSizeML   ? { vialSizeML }                          : {}),
            ...(baselineSRR  ? { chfBaselineSRR: baselineSRR }         : {}),
          }
          saveProfile(p)
          setProfile(p)
        }}
      />
    )
  }

  return (
    <Dashboard
      profile={profile}
      logs={logs}
      currentVial={currentVial}
      onNewLog={(entry) => {
        addLogEntry(entry)
        setLogs((prev) => [entry, ...prev])
      }}
      onDeleteLog={(id) => {
        deleteLogEntry(id)
        setLogs((prev) => prev.filter((l) => l.id !== id))
      }}
      onVialStarted={() => {
        setCurrentVial(getCareData().currentVial)
      }}
      onProfileUpdate={() => {
        setProfile(getCareData().profile)
      }}
    />
  )
}
