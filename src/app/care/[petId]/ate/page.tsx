'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Phone, MapPin, Cat, Dog, X } from 'lucide-react'
import { getPet, type PetProfile } from '@/lib/care-storage'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import Footer from '@/components/footer'

// ── Types ─────────────────────────────────────────────────────────────────

interface FoodToxinEntry {
  display_name: string
  slug: string
  species_scope: 'cats' | 'dogs' | 'both'
  any_amount_call_now: boolean
  mechanism: string | null
  notes: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────

type Condition = PetProfile['condition']

const CONDITION_LABELS: Record<Condition, string> = {
  feline_diabetes: 'Feline diabetes',
  chf: 'Heart disease (CHF)',
  chronic_kidney_disease: 'Chronic kidney disease (CKD)',
  cushings_disease: "Cushing's disease",
  osteoarthritis: 'Arthritis / joint disease (OA)',
  epilepsy: 'Epilepsy / seizure disorder',
  feline_hyperthyroidism: 'Hyperthyroidism',
  ibd: 'Inflammatory bowel disease (IBD)',
  cognitive_dysfunction: 'Cognitive dysfunction (CDS)',
  degenerative_myelopathy: 'Degenerative myelopathy (DM)',
}

function SpeciesIcon({ species, className }: { species: 'cat' | 'dog'; className?: string }) {
  return species === 'dog' ? <Dog className={className} /> : <Cat className={className} />
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PetAtePage() {
  const params = useParams()
  const router = useRouter()
  const petId = params.petId as string

  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState<PetProfile | null>(null)
  const [foodEntries, setFoodEntries] = useState<FoodToxinEntry[]>([])

  const [weightStr, setWeightStr] = useState('')
  const [weightEditing, setWeightEditing] = useState(false)
  const [ageStr, setAgeStr] = useState('')
  const [ageEditing, setAgeEditing] = useState(false)

  const [foodSearch, setFoodSearch] = useState('')
  const [showFoodDropdown, setShowFoodDropdown] = useState(false)
  const [selectedFood, setSelectedFood] = useState<FoodToxinEntry | null>(null)
  const [useCustom, setUseCustom] = useState(false)
  const [customFood, setCustomFood] = useState('')

  const [howMuch, setHowMuch] = useState('')
  const [whenStr, setWhenStr] = useState('')
  const [inGeorgia, setInGeorgia] = useState(false)

  useEffect(() => {
    setMounted(true)
    getPet(petId).then((r) => {
      if (!r) { router.replace('/care'); return }
      setProfile(r.profile)
    })
  }, [petId, router])

  useEffect(() => {
    if (!profile) return
    const scope = profile.species === 'cat' ? 'cats' : 'dogs'
    const supabase = getSupabaseBrowser()
    supabase
      .from('food_toxin_entries')
      .select('display_name, slug, species_scope, any_amount_call_now, mechanism, notes')
      .eq('active', true)
      .or(`species_scope.eq.${scope},species_scope.eq.both`)
      .order('display_name')
      .then(({ data }: { data: unknown }) => {
        if (data) setFoodEntries(data as FoodToxinEntry[])
      })
  }, [profile])

  const filteredFoods = useMemo(() => {
    const q = foodSearch.trim().toLowerCase()
    if (!q) return foodEntries
    return foodEntries.filter((f) => f.display_name.toLowerCase().includes(q))
  }, [foodEntries, foodSearch])

  if (!mounted || !profile) return null

  const conditionLabel = CONDITION_LABELS[profile.condition]
  const hasWeight = profile.weightLbs !== undefined
  const hasAge = profile.ageYears !== undefined
  const anyAmountCallNow = selectedFood?.any_amount_call_now ?? false

  const callButtons = (
    <div className="space-y-3">
      <a
        href="tel:+18884264435"
        className="flex items-center justify-center gap-2 w-full min-h-[56px] rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[15px] transition-colors shadow-sm"
      >
        <Phone className="w-5 h-5 shrink-0" />
        ASPCA Animal Poison Control — (888) 426-4435
      </a>
      <a
        href="tel:+18557647661"
        className="flex items-center justify-center gap-2 w-full min-h-[56px] rounded-2xl bg-stone-700 hover:bg-stone-800 text-white font-bold text-[15px] transition-colors shadow-sm"
      >
        <Phone className="w-5 h-5 shrink-0" />
        Pet Poison Helpline — (855) 764-7661
      </a>
    </div>
  )

  return (
    <div
      className="min-h-screen bg-[#FFFBF0] flex flex-col"
      style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}
    >
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3">
        <Link
          href={`/care/${petId}`}
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to {profile.name}
        </Link>
        <span className="text-stone-200 shrink-0">|</span>
        <div className="flex items-center gap-2 min-w-0">
          <SpeciesIcon species={profile.species} className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-sm font-semibold text-stone-800 truncate">My pet ate something</span>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-5 pb-24 sm:pb-8">

        {/* 1. Pet context */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <SpeciesIcon species={profile.species} className="w-5 h-5 text-amber-500" />
            <p className="font-semibold text-stone-900">
              {profile.name}&nbsp;&middot;&nbsp;{profile.species === 'dog' ? 'Dog' : 'Cat'}&nbsp;&middot;&nbsp;{conditionLabel}
            </p>
          </div>
          <p className="text-xs text-amber-800 bg-amber-50 rounded-xl px-3 py-2 leading-relaxed">
            Tell the toxicologist about this condition — it affects their advice.
          </p>
        </div>

        {/* 2. Hero: Call now */}
        {inGeorgia ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-4">
            <div>
              <p className="text-sm font-bold text-amber-900 mb-1">
                Georgia residents: both national hotlines can&rsquo;t give direct guidance (state law SB 105)
              </p>
              <p className="text-sm text-amber-800 leading-relaxed">
                Call your veterinarian or nearest 24/7 emergency clinic — bring the details below.
                The hotlines can still help via a veterinarian if needed.
              </p>
            </div>
            {callButtons}
          </div>
        ) : (
          <div className="space-y-3">
            {callButtons}
            <p className="text-xs text-stone-400 text-center leading-relaxed px-2">
              Staffed by veterinary toxicologists, 24/7. A consult fee may apply (about $75–95).
              They&rsquo;ll ask the details below.
            </p>
          </div>
        )}

        {/* Georgia toggle */}
        <div className="flex items-center gap-2.5">
          <input
            id="georgia-check"
            type="checkbox"
            checked={inGeorgia}
            onChange={(e) => setInGeorgia(e.target.checked)}
            className="rounded border-stone-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
          />
          <label htmlFor="georgia-check" className="text-xs text-stone-500 cursor-pointer leading-relaxed">
            I&rsquo;m in Georgia (SB 105 limits direct guidance from national hotlines)
          </label>
        </div>

        {/* 3. Context card */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1">
              Have this ready when you call
            </p>
            <p className="text-xs text-stone-400 leading-relaxed">
              We don&rsquo;t diagnose. These details just help the toxicologist help you faster — have them ready when you call.
            </p>
          </div>

          {/* Pet summary */}
          <div className="rounded-xl bg-stone-50 border border-stone-100 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Pet</span>
              <span className="text-xs text-stone-700">{profile.name}, {profile.species === 'dog' ? 'dog' : 'cat'}</span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-stone-500 shrink-0">Condition</span>
              <span className="text-xs text-stone-700 text-right">{conditionLabel}</span>
            </div>
          </div>

          {/* Weight */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">
              Approximate weight (lbs)
            </label>
            {hasWeight && !weightEditing ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                  {profile.weightLbs} lbs
                </span>
                <button
                  type="button"
                  onClick={() => { setWeightEditing(true); setWeightStr(String(profile.weightLbs ?? '')) }}
                  className="text-xs text-stone-400 hover:text-stone-600 transition-colors px-1"
                >
                  edit
                </button>
              </div>
            ) : (
              <input
                type="number"
                inputMode="decimal"
                value={weightStr}
                onChange={(e) => setWeightStr(e.target.value)}
                placeholder="e.g. 12"
                min="0"
                step="0.1"
                className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
                  focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
            )}
          </div>

          {/* Age */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">
              Approximate age (years)
            </label>
            {hasAge && !ageEditing ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                  {profile.ageYears} {profile.ageYears === 1 ? 'year' : 'years'} old
                </span>
                <button
                  type="button"
                  onClick={() => { setAgeEditing(true); setAgeStr(String(profile.ageYears ?? '')) }}
                  className="text-xs text-stone-400 hover:text-stone-600 transition-colors px-1"
                >
                  edit
                </button>
              </div>
            ) : (
              <input
                type="number"
                inputMode="decimal"
                value={ageStr}
                onChange={(e) => setAgeStr(e.target.value)}
                placeholder="e.g. 8"
                min="0"
                step="0.5"
                className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
                  focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
            )}
          </div>

          {/* What they ate */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">What they ate</label>
            {useCustom ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customFood}
                  onChange={(e) => setCustomFood(e.target.value)}
                  placeholder="Describe what they ate"
                  className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
                    focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => { setUseCustom(false); setCustomFood('') }}
                  className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                >
                  ← Search the list instead
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <input
                    type="search"
                    value={selectedFood ? selectedFood.display_name : foodSearch}
                    onChange={(e) => {
                      setFoodSearch(e.target.value)
                      setSelectedFood(null)
                      setShowFoodDropdown(true)
                    }}
                    onFocus={() => setShowFoodDropdown(true)}
                    onBlur={() => setTimeout(() => setShowFoodDropdown(false), 150)}
                    placeholder="Search foods, plants, substances…"
                    className={`w-full rounded-xl border px-3 py-2.5 text-stone-900 text-sm pr-8
                      focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent ${
                      selectedFood
                        ? 'border-amber-400 bg-amber-50/50'
                        : 'border-stone-300'
                    }`}
                  />
                  {selectedFood && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setSelectedFood(null); setFoodSearch('') }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {showFoodDropdown && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-stone-200 bg-white shadow-lg max-h-52 overflow-y-auto">
                    {filteredFoods.length === 0 && foodSearch && (
                      <p className="px-3 py-2 text-xs text-stone-400 italic">No matches — try the option below</p>
                    )}
                    {filteredFoods.slice(0, 20).map((f) => (
                      <button
                        key={f.slug}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedFood(f)
                          setFoodSearch('')
                          setShowFoodDropdown(false)
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm text-stone-700 hover:bg-amber-50 transition-colors flex items-center justify-between gap-2"
                      >
                        <span>{f.display_name}</span>
                        {f.any_amount_call_now && (
                          <span className="text-xs text-amber-700 font-medium shrink-0">call — any amount</span>
                        )}
                      </button>
                    ))}
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setUseCustom(true)
                        setShowFoodDropdown(false)
                        setSelectedFood(null)
                        setFoodSearch('')
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm text-stone-400 hover:bg-stone-50 border-t border-stone-100 transition-colors italic"
                    >
                      Something else — type it
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* any_amount_call_now callout */}
          {anyAmountCallNow && selectedFood && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-xs text-amber-900 leading-relaxed">
                There&rsquo;s no known safe amount of this — call now even if it was a tiny amount.
                {selectedFood.mechanism ? ` ${selectedFood.mechanism}.` : ''}
              </p>
            </div>
          )}

          {/* How much */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">How much (approx)</label>
            <input
              type="text"
              value={howMuch}
              onChange={(e) => setHowMuch(e.target.value)}
              placeholder="e.g. 3 chocolate chips, half a grape, one stick of gum"
              className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
                focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>

          {/* When */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">When they ate it</label>
            <input
              type="text"
              value={whenStr}
              onChange={(e) => setWhenStr(e.target.value)}
              placeholder="e.g. about 20 minutes ago, around 3pm today"
              className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-stone-900 text-sm
                focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>
        </div>

        {/* 5. Find care */}
        <a
          href="https://www.google.com/maps/search/24+hour+emergency+veterinary+hospital"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-2xl border border-stone-200 bg-white hover:border-amber-300 hover:bg-amber-50/30 text-sm font-semibold text-stone-700 transition-colors"
        >
          <MapPin className="w-4 h-4 text-stone-400" />
          Find the nearest 24/7 emergency vet
        </a>

        {/* 6. Do NOT do this */}
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3.5">
          <p className="text-xs font-semibold text-stone-600 mb-1">Do NOT do this yet</p>
          <p className="text-xs text-stone-500 leading-relaxed">
            Don&rsquo;t try to make your pet vomit unless a vet or poison control tells you to — the wrong home remedy can make things worse.
          </p>
        </div>

      </main>

      <Footer disclaimer="Tailcue isn't a veterinarian and doesn't diagnose. When in doubt about anything your pet ate, the fastest expert help is ASPCA Animal Poison Control (888) 426-4435 or Pet Poison Helpline (855) 764-7661 — staffed by veterinary toxicologists 24/7. If your pet is showing severe symptoms (collapse, seizures, trouble breathing), go to the nearest emergency vet now." />
    </div>
  )
}
