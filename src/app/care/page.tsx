'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Cat, Dog, Plus, PawPrint, ChevronDown, ChevronUp, ArrowLeft, Cloud,
} from 'lucide-react'
import {
  getAllPets, createPet,
  type PetRecord, type PetProfile,
  type EpilepsyLogEntry, type HyperthyroidismLogEntry, type IBDLogEntry,
  type CDSLogEntry, type DMLogEntry,
} from '@/lib/care-storage'
import {
  evaluateGlucoseRisk, evaluateCHFRisk,
  evaluateCKDRisk, evaluateCushingsRisk, evaluateOARisk, evaluateEpilepsyRisk,
  evaluateHyperthyroidismRisk, evaluateIBDRisk, evaluateCDSRisk, evaluateDMRisk,
} from '@/lib/care-risk-engine'
import Footer from '@/components/footer'
import { useCareAuth } from '@/components/care/CareAuthProvider'
import { CareAccountControl } from '@/components/care/CareAccountControl'
import { CareSyncNudge } from '@/components/care/CareSyncNudge'
import { CareJoinButton } from '@/components/care/CareJoinButton'
import { CarePetManageMenu } from '@/components/care/CarePetManageMenu'
import { CareInstallBanner } from '@/components/care/CareInstallBanner'

// ── Helpers ───────────────────────────────────────────────────────────────

function SpeciesIcon({ species, className }: { species: 'cat' | 'dog'; className?: string }) {
  return species === 'dog' ? <Dog className={className} /> : <Cat className={className} />
}

type Condition = PetProfile['condition']

const CONDITION_LABELS: Record<Condition, string> = {
  feline_diabetes: 'Feline Diabetes',
  chf: 'Heart Disease (CHF)',
  chronic_kidney_disease: 'Kidney Disease (CKD)',
  cushings_disease: "Cushing's Disease",
  osteoarthritis: 'Arthritis / Joint Disease (OA)',
  epilepsy: 'Epilepsy / Seizure Disorder',
  feline_hyperthyroidism: 'Hyperthyroidism',
  ibd: 'Inflammatory Bowel Disease (IBD)',
  cognitive_dysfunction: 'Cognitive Dysfunction (CDS)',
  degenerative_myelopathy: 'Degenerative Myelopathy (DM)',
}

const CONDITION_META: Record<Condition, { label: string; description: string }> = {
  feline_diabetes: {
    label: 'Feline Diabetes',
    description: 'Daily glucose monitoring helps catch highs and lows early.',
  },
  chf: {
    label: 'Heart Disease (CHF)',
    description: 'Track resting respiratory rate to monitor heart failure at home.',
  },
  chronic_kidney_disease: {
    label: 'Kidney Disease (CKD)',
    description: 'Track hydration, vomiting, and SubQ fluids to catch dehydration and uremic crises early.',
  },
  cushings_disease: {
    label: "Cushing's Disease",
    description: 'Monitor medication response and watch for signs of Addisonian crisis from over-suppression.',
  },
  osteoarthritis: {
    label: 'Arthritis / Joint Disease (OA)',
    description: 'Log mobility and pain levels to track how well analgesic treatment is working.',
  },
  epilepsy: {
    label: 'Epilepsy / Seizure Disorder',
    description: 'Log seizure events as they happen — timing, duration, and severity help your vet optimize treatment.',
  },
  feline_hyperthyroidism: {
    label: 'Hyperthyroidism',
    description: 'Daily check-in helps detect methimazole side effects early and track treatment response.',
  },
  ibd: {
    label: 'Inflammatory Bowel Disease (IBD)',
    description: 'Log GI signs daily to identify flares, track diet compliance, and guide medication adjustments.',
  },
  cognitive_dysfunction: {
    label: 'Cognitive Dysfunction (CDS)',
    description: 'Weekly DISHAA scoring tracks cognitive decline across six domains and helps guide treatment timing.',
  },
  degenerative_myelopathy: {
    label: 'Degenerative Myelopathy (DM)',
    description: 'Weekly mobility logging tracks disease progression and helps guide physiotherapy and quality-of-life decisions.',
  },
}

const CAT_CONDITIONS: Condition[] = [
  'feline_diabetes', 'chf', 'chronic_kidney_disease', 'osteoarthritis', 'epilepsy',
  'feline_hyperthyroidism', 'ibd', 'cognitive_dysfunction',
]
const DOG_CONDITIONS: Condition[] = [
  'chf', 'chronic_kidney_disease', 'cushings_disease', 'osteoarthritis', 'epilepsy',
  'ibd', 'cognitive_dysfunction', 'degenerative_myelopathy',
]

// ── Setup Screen ──────────────────────────────────────────────────────────

function SetupScreen({
  onSave,
  onBack,
}: {
  onSave: (
    name: string,
    species: 'cat' | 'dog',
    condition: Condition,
    concentration?: 'U-40' | 'U-100',
    vialSizeML?: number,
    baselineSRR?: number
  ) => void
  onBack?: () => void
}) {
  const { user, signOut, openSignIn } = useCareAuth()
  const [species, setSpecies] = useState<'cat' | 'dog'>('cat')
  const [condition, setCondition] = useState<Condition>('feline_diabetes')
  const [name, setName] = useState('')

  const [showInsulinDetails, setShowInsulinDetails] = useState(false)
  const [concentration, setConcentration] = useState<'U-40' | 'U-100' | null>(null)
  const [vialSizeMlStr, setVialSizeMlStr] = useState('')

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

  function handleConditionChange(c: Condition) {
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
    <div className="min-h-screen bg-[#FFFBF0] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {user ? (
          <div className="flex items-center justify-end gap-2 mb-4">
            <span className="text-xs text-stone-400 hidden sm:block">{user.email}</span>
            <button
              type="button"
              onClick={() => signOut()}
              className="text-xs text-stone-500 hover:text-stone-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openSignIn}
            className="w-full mb-6 flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-sm py-2.5 transition-colors"
          >
            <Cloud className="w-4 h-4" />
            Already have pets saved? Sign in
          </button>
        )}
        <div className="mb-6 text-center">
          <CareJoinButton className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 transition-colors" />
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to pets
          </button>
        )}

        <div className="flex items-center gap-2 mb-8">
          <SpeciesIcon species={species} className="w-7 h-7 text-amber-500" />
          <span className="text-xl font-semibold text-stone-800">Tailcue Care</span>
        </div>

        <h1 className="text-2xl font-bold text-stone-900 mb-6">
          Set up your tracker
        </h1>

        <div className="mb-4">
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Species</label>
          <div className="flex rounded-xl overflow-hidden border border-stone-300">
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

        <div className="mb-4">
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Condition</label>
          <div className="space-y-1.5">
            {(species === 'cat' ? CAT_CONDITIONS : DOG_CONDITIONS).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleConditionChange(c)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  condition === c
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                }`}
              >
                {CONDITION_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">About this tracker</p>
          <p className="text-xs text-amber-700 mt-1">{conditionMeta.description}</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Your {species}&rsquo;s name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={species === 'dog' ? 'e.g. Buddy' : 'e.g. Mochi'}
            className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && handleSave()}
          />
        </div>

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
              <div className="mt-3 space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1.5">Insulin Concentration</label>
                  <div className="flex rounded-xl overflow-hidden border border-stone-300">
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
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-stone-900 text-sm
                      focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        )}

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
              <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
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
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-stone-900 text-sm
                    focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
            )}
          </div>
        )}

        <button
          disabled={!name.trim()}
          onClick={handleSave}
          className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-stone-200
            disabled:text-stone-400 text-white font-semibold py-3 text-sm transition-colors"
        >
          Start Tracking
        </button>
      </div>
    </div>
  )
}

// ── Pet List Card ─────────────────────────────────────────────────────────

function getPetRisk(record: PetRecord) {
  const { profile, logs } = record
  if (profile.condition === 'epilepsy') {
    const eLogs = logs.filter((l): l is EpilepsyLogEntry => l.condition === 'epilepsy')
    return evaluateEpilepsyRisk(eLogs)
  }
  const latestLog = logs[0] ?? null
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
}

function AngelWings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 7c-1.6-2.6-4.2-4-6.7-4C4.1 3 3 4.1 3 6c0 3.1 3.1 5.2 6 5.6M12 7c1.6-2.6 4.2-4 6.7-4C19.9 3 21 4.1 21 6c0 3.1-3.1 5.2-6 5.6M12 7v9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PetCard({
  record,
  memorialized,
  isOwner,
  onChanged,
  onRemoved,
}: {
  record: PetRecord
  memorialized: boolean
  isOwner: boolean
  onChanged: () => void
  onRemoved: () => void
}) {
  const { profile } = record
  const risk = memorialized ? null : getPetRisk(record)

  const badge = memorialized ? (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-stone-100 text-stone-400 border-stone-200 flex items-center gap-1 shrink-0">
      <AngelWings className="w-3.5 h-3.5" />
      In memory
    </span>
  ) : risk ? (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${risk.badgeColor}`}>
      {risk.displayLabel ?? (risk.level.charAt(0).toUpperCase() + risk.level.slice(1))}
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-stone-100 text-stone-400 border-stone-200 shrink-0">
      No readings yet
    </span>
  )

  return (
    <div
      className={`bg-white rounded-xl border p-4 flex items-center gap-3 transition-colors ${
        memorialized ? 'border-stone-200 opacity-70' : 'border-stone-200 hover:border-amber-200 hover:bg-amber-50/30'
      }`}
    >
      <Link href={`/care/${profile.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <SpeciesIcon
          species={profile.species}
          className={`w-8 h-8 shrink-0 ${memorialized ? 'text-stone-300' : 'text-amber-500'}`}
        />
        <div className="flex-1 min-w-0">
          <p className={`font-semibold ${memorialized ? 'text-stone-500' : 'text-stone-900'}`}>{profile.name}</p>
          <p className="text-xs text-stone-400">{CONDITION_LABELS[profile.condition]}</p>
        </div>
        {badge}
      </Link>
      <CarePetManageMenu
        petId={profile.id}
        petName={profile.name}
        memorialized={memorialized}
        isOwner={isOwner}
        onChanged={onChanged}
        onRemoved={onRemoved}
      />
    </div>
  )
}

// ── Pet List Screen ───────────────────────────────────────────────────────

function PetListScreen({
  activePets,
  memorialized,
  currentUserId,
  onAddPet,
  authSlot,
  nudge,
  onReload,
}: {
  activePets: PetRecord[]
  memorialized: PetRecord[]
  currentUserId?: string
  onAddPet: () => void
  authSlot?: React.ReactNode
  nudge?: React.ReactNode
  onReload: () => void
}) {
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
        <div className="flex items-center gap-2">
          <PawPrint className="w-5 h-5 text-amber-500" />
          <span className="font-semibold text-stone-800">Tailcue Care</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {authSlot}
          <CareJoinButton />
          <button
            type="button"
            onClick={onAddPet}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700
              border border-amber-200 hover:border-amber-300 bg-white rounded-xl px-3 py-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Pet
          </button>
        </div>
      </header>

      {nudge}

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-3 pb-24 sm:pb-6">
        {/* iOS install nudge — only renders on iOS Safari, hides when already installed */}
        <CareInstallBanner />
        <p className="text-xs text-stone-400 mb-1">Your pets</p>
        {activePets.length === 0 ? (
          <p className="text-sm text-stone-400 py-6 text-center">No active pets. Tap &ldquo;Add Pet&rdquo; to start tracking.</p>
        ) : (
          activePets.map((record) => (
            <PetCard
              key={record.profile.id}
              record={record}
              memorialized={false}
              isOwner={!record.profile.createdBy || record.profile.createdBy === currentUserId}
              onChanged={onReload}
              onRemoved={onReload}
            />
          ))
        )}

        {memorialized.length > 0 && (
          <div className="pt-6 space-y-3">
            <p className="text-xs text-stone-400 mb-1">In Memory</p>
            {memorialized.map((record) => (
              <PetCard
                key={record.profile.id}
                record={record}
                memorialized
                isOwner={!record.profile.createdBy || record.profile.createdBy === currentUserId}
                onChanged={onReload}
                onRemoved={onReload}
              />
            ))}
          </div>
        )}
      </main>

      <Footer disclaimer="Tailcue Care is a logging tool to help you track your pet's condition at home. It does not provide medical advice or diagnoses. Always follow your veterinarian's guidance." />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

function CareIndexInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { syncVersion, user, openJoin, openSignIn } = useCareAuth()
  const [mounted, setMounted] = useState(false)
  const [pets, setPets] = useState<PetRecord[]>([])
  const [showSetup, setShowSetup] = useState(false)

  const setupMode = searchParams.get('setup') === 'true'
  const listMode = searchParams.get('all') === '1'

  const activePets = pets.filter((p) => !p.profile.memorializedAt)
  const memorializedPets = pets.filter((p) => p.profile.memorializedAt)
  const shouldRedirect = activePets.length === 1 && !setupMode && !listMode

  const reload = () => {
    getAllPets().then(setPets)
  }

  useEffect(() => {
    setMounted(true)
    getAllPets().then((allPets) => {
      setPets(allPets)
      const active = allPets.filter((p) => !p.profile.memorializedAt)
      if (active.length === 1 && !setupMode && !listMode) {
        router.replace(`/care/${active[0].profile.id}`)
      }
    })
  }, [router, setupMode, listMode, syncVersion])

  // Arriving via an invite link (/care?join=CODE)
  useEffect(() => {
    if (!searchParams.get('join')) return
    if (user) {
      openJoin()
    } else {
      openSignIn()
    }
  }, [user, searchParams, openJoin, openSignIn])

  if (!mounted) return null

  // Single active pet (and not deliberately viewing the full list) — transparent redirect
  if (shouldRedirect) return null

  async function handleSave(
    name: string,
    species: 'cat' | 'dog',
    condition: Condition,
    concentration?: 'U-40' | 'U-100',
    vialSizeML?: number,
    baselineSRR?: number
  ) {
    const record = await createPet({
      name,
      species,
      condition,
      createdAt: new Date().toISOString(),
      ...(concentration ? { insulinConcentration: concentration } : {}),
      ...(vialSizeML   ? { vialSizeML }                          : {}),
      ...(baselineSRR  ? { chfBaselineSRR: baselineSRR }         : {}),
    })
    router.push(`/care/${record.profile.id}`)
  }

  const onBack = setupMode
    ? () => router.back()
    : pets.length > 0
    ? () => setShowSetup(false)
    : undefined

  if ((activePets.length === 0 && memorializedPets.length === 0) || showSetup || setupMode) {
    return <SetupScreen onSave={handleSave} onBack={onBack} />
  }

  return (
    <PetListScreen
      activePets={activePets}
      memorialized={memorializedPets}
      currentUserId={user?.id}
      onAddPet={() => setShowSetup(true)}
      authSlot={<CareAccountControl />}
      nudge={<CareSyncNudge />}
      onReload={reload}
    />
  )
}

export default function CareIndexPage() {
  return (
    <Suspense>
      <CareIndexInner />
    </Suspense>
  )
}
