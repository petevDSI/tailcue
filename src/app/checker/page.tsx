'use client'

import { Suspense } from 'react'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Check,
  ChevronDown,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Send,
  PawPrint,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  PROCEDURES,
  METROS,
  NATIONAL_BENCHMARKS,
  type Procedure,
  type Metro,
} from '@/lib/seed-data'
import { supabase } from '@/lib/supabase'
import {
  calculateInsurancePayout,
  type InsuranceCalcResult,
} from '@/lib/insurance-calculator'
import Footer from '@/components/footer'

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type Species = 'dog' | 'cat'
type VerdictType = 'fair' | 'slightly_high' | 'high' | 'above_market'

interface InsuranceCarrier {
  slug: string
  display_name: string
  deductible_type: string
  exam_fee_covered: boolean
  reimbursement_options: number[]
  annual_limit_options: string[]
  notes: string | null
  affiliate_url: string | null
}

const CATEGORY_ORDER = [
  'wellness',
  'diagnostics',
  'surgical_routine',
  'surgical_common',
  'emergency',
  'skin_ear_eye',
] as const

const CATEGORY_LABELS: Record<string, string> = {
  wellness: 'Wellness / Preventive',
  diagnostics: 'Diagnostics',
  surgical_routine: 'Surgical — Routine',
  surgical_common: 'Surgical — Common',
  emergency: 'Emergency',
  skin_ear_eye: 'Skin, Ear & Eye',
}

const VERDICT: Record<
  VerdictType,
  { label: string; description: string; color: string; bg: string; border: string }
> = {
  fair: {
    label: 'Fair Price',
    description:
      "This quote is at or below the median price for this procedure. You're in good shape.",
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-600',
  },
  slightly_high: {
    label: 'Slightly High',
    description:
      'Above the median but within a reasonable range. Worth asking a few questions.',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-600',
  },
  high: {
    label: 'High',
    description:
      'Above the 70th percentile. We recommend using the questions below before agreeing.',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-600',
  },
  above_market: {
    label: 'Above Market',
    description:
      'Exceeds the 90th percentile. Getting a second opinion is strongly recommended.',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-600',
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectMetro(zip: string): Metro | null {
  const prefix = zip.slice(0, 3)
  return METROS.find((m) => m.zip_prefixes.includes(prefix)) ?? null
}

function getVerdict(price: number, p50: number, p70: number, p90: number): VerdictType {
  if (price <= p50) return 'fair'
  if (price <= p70) return 'slightly_high'
  if (price <= p90) return 'high'
  return 'above_market'
}

// ---------------------------------------------------------------------------
// StepLabel
// ---------------------------------------------------------------------------

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
        {n}
      </span>
      <span className="text-[15px] font-semibold text-stone-900">{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProcedureSelect — custom combobox
// ---------------------------------------------------------------------------

function ProcedureSelect({
  procedures,
  selected,
  onSelect,
}: {
  procedures: Procedure[]
  selected: Procedure | null
  onSelect: (p: Procedure) => void
}) {
  const [open, setOpen] = useState(false)
  const [opensUp, setOpensUp] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function handleToggle() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      // Open upward if button is in the lower 60% of the viewport
      setOpensUp(rect.bottom > window.innerHeight * 0.6)
    }
    setOpen((v) => !v)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-xl border bg-white px-3.5 text-sm shadow-sm transition-all',
          open
            ? 'border-amber-500 ring-2 ring-amber-100'
            : 'border-stone-200 hover:border-stone-300'
        )}
      >
        <span className={selected ? 'text-stone-900' : 'text-stone-400'}>
          {selected ? selected.display_name : 'Search procedures…'}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-stone-400 transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            'absolute left-0 right-0 z-[100] rounded-xl border border-stone-200 bg-white shadow-lg',
            opensUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          )}
        >
          <Command>
            <CommandInput placeholder="Search procedures…" />
            <CommandList className="max-h-[320px] overflow-y-auto">
              <CommandEmpty>No procedure found.</CommandEmpty>
              {CATEGORY_ORDER.map((cat) => {
                const group = procedures.filter((p) => p.category === cat)
                if (!group.length) return null
                return (
                  <CommandGroup key={cat} heading={CATEGORY_LABELS[cat]}>
                    {group.map((proc) => (
                      <CommandItem
                        key={proc.id}
                        value={`${proc.display_name} ${proc.clinical_name ?? ''}`}
                        onSelect={() => {
                          onSelect(proc)
                          setOpen(false)
                        }}
                        className={cn(selected?.id === proc.id && 'font-medium text-amber-700')}
                      >
                        <Check
                          className={cn(
                            'mr-1.5 h-3.5 w-3.5 shrink-0',
                            selected?.id === proc.id ? 'opacity-100 text-amber-500' : 'opacity-0'
                          )}
                        />
                        {proc.display_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              })}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// VerdictIcon
// ---------------------------------------------------------------------------

function VerdictIcon({ verdict, className }: { verdict: VerdictType; className?: string }) {
  switch (verdict) {
    case 'fair':
      return <ShieldCheck className={className} />
    case 'slightly_high':
    case 'high':
      return <TrendingUp className={className} />
    case 'above_market':
      return <AlertTriangle className={className} />
  }
}

// ---------------------------------------------------------------------------
// PriceRangeBar
// ---------------------------------------------------------------------------

function PriceRangeBar({
  p50,
  p70,
  p90,
  quotedPrice,
}: {
  p50: number
  p70: number
  p90: number
  quotedPrice: number
}) {
  const ceiling = Math.max(p90 * 1.45, quotedPrice * 1.15)
  const toPct = (v: number) => Math.min(100, Math.max(0, (v / ceiling) * 100))

  const p50pct = toPct(p50)
  const p70pct = toPct(p70)
  const p90pct = toPct(p90)
  const quotedPct = toPct(quotedPrice)

  return (
    <div className="space-y-4">
      <div className="relative mx-1 h-2.5 overflow-visible rounded-full bg-stone-100">
        <div
          className="absolute inset-y-0 left-0 rounded-l-full bg-green-400"
          style={{ width: `${p50pct}%` }}
        />
        <div
          className="absolute inset-y-0 bg-amber-400"
          style={{ left: `${p50pct}%`, width: `${p70pct - p50pct}%` }}
        />
        <div
          className="absolute inset-y-0 bg-orange-400"
          style={{ left: `${p70pct}%`, width: `${p90pct - p70pct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-full bg-red-400"
          style={{ left: `${p90pct}%` }}
        />
        <div
          className="absolute w-[3px] rounded-full bg-stone-900 shadow-sm"
          style={{ left: `calc(${quotedPct}% - 1.5px)`, top: '-4px', bottom: '-4px' }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        {[
          { label: 'Median', sublabel: 'P50', value: p50, bg: 'bg-green-50', text: 'text-green-700' },
          { label: 'Above Avg', sublabel: 'P70', value: p70, bg: 'bg-amber-50', text: 'text-amber-700' },
          { label: 'High End', sublabel: 'P90', value: p90, bg: 'bg-red-50', text: 'text-red-700' },
        ].map(({ label, sublabel, value, bg, text }) => (
          <div key={sublabel} className={cn('rounded-xl p-3', bg)}>
            <p className={cn('text-lg font-bold leading-none', text)}>${value.toLocaleString()}</p>
            <p className={cn('mt-1 text-xs font-medium opacity-80', text)}>{label}</p>
            <p className={cn('text-xs opacity-60', text)}>{sublabel}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-stone-500">
        Your quote:{' '}
        <span className="font-semibold text-stone-900">${quotedPrice.toLocaleString()}</span>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// QuestionsAccordion
// ---------------------------------------------------------------------------

function QuestionsAccordion({
  questions,
}: {
  questions: { question: string; listen_for: string; why_it_matters: string }[]
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      {questions.map((q, i) => {
        const isOpen = openIndex === i
        return (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-stone-200 bg-white"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium leading-snug text-stone-800">
                {q.question}
              </span>
              <span className="ml-2 shrink-0 text-stone-400 text-xs mt-0.5">
                {isOpen ? '↑' : '→'}
              </span>
            </button>

            <div
              style={{
                maxHeight: isOpen ? '400px' : '0px',
                transition: 'max-height 0.25s ease',
                overflow: 'hidden',
              }}
            >
              <div className="space-y-3 border-t border-stone-100 px-4 pb-4 pt-3">
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                    What to listen for
                  </p>
                  <p className="text-[13px] leading-relaxed text-stone-600">{q.listen_for}</p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                    Why it matters
                  </p>
                  <p className="text-[13px] leading-relaxed text-stone-600">{q.why_it_matters}</p>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CheckerContent — reads URL params, contains all checker logic
// ---------------------------------------------------------------------------

function CheckerContent() {
  const searchParams = useSearchParams()

  // Read ?species=dog|cat from URL
  const rawSpecies = searchParams.get('species')
  const initialSpecies: Species | null =
    rawSpecies === 'dog' || rawSpecies === 'cat' ? rawSpecies : null

  // Read ?procedure=SLUG from URL, validate against species
  const initialSlug = searchParams.get('procedure')
  const foundProcedure = initialSlug
    ? PROCEDURES.find((p) => p.slug === initialSlug) ?? null
    : null
  const initialProcedure: Procedure | null =
    foundProcedure && initialSpecies
      ? foundProcedure.species === initialSpecies || foundProcedure.species === 'both'
        ? foundProcedure
        : null
      : foundProcedure

  // State — initialized from URL params when present
  const [species, setSpecies] = useState<Species | null>(initialSpecies)
  const [procedure, setProcedure] = useState<Procedure | null>(initialProcedure)
  const [zip, setZip] = useState('')
  const [zipError, setZipError] = useState('')
  const [metro, setMetro] = useState<Metro | null>(null)
  const [price, setPrice] = useState('')
  const [hasInsurance, setHasInsurance] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{
    verdict: VerdictType
    p50: number
    p70: number
    p90: number
    submissionId: string | null
    insurancePayout: InsuranceCalcResult | null
  } | null>(null)
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  const sessionId = useRef<string>(crypto.randomUUID())

  // Insurance detail state
  const [carriers, setCarriers] = useState<InsuranceCarrier[]>([])
  const [selectedCarrier, setSelectedCarrier] = useState<InsuranceCarrier | null>(null)
  const [deductibleCents, setDeductibleCents] = useState<number | null>(null)
  const [deductiblePctKey, setDeductiblePctKey] = useState<string>('0')
  const [insuranceReimbursementPct, setInsuranceReimbursementPct] = useState<number | null>(null)

  const filteredProcedures = useMemo(() => {
    if (!species) return []
    return PROCEDURES.filter((p) => p.species === species || p.species === 'both')
  }, [species])

  const showProcedure = !!species
  const showZip = !!procedure
  const showPrice = zip.length === 5 && !zipError
  const parsedPrice = price ? parseFloat(price) : 0
  const showInsurance = showPrice && parsedPrice > 0
  const insuranceFieldsValid =
    hasInsurance !== true ||
    (deductibleCents !== null && insuranceReimbursementPct !== null)
  const canSubmit =
    !!species && !!procedure && showPrice && parsedPrice > 0 && hasInsurance !== null && insuranceFieldsValid

  function handleSpeciesSelect(s: Species) {
    setSpecies(s)
    if (procedure && procedure.species !== 'both' && procedure.species !== s) {
      setProcedure(null)
    }
  }

  function handleZipChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 5)
    setZip(digits)
    setZipError('')
    if (digits.length === 5) {
      setMetro(detectMetro(digits))
    } else {
      setMetro(null)
    }
  }

  function handleZipBlur() {
    if (zip.length > 0 && zip.length < 5) {
      setZipError('Enter a valid 5-digit ZIP code.')
    }
  }

  function handleInsuranceToggle(value: boolean) {
    setHasInsurance(value)
    if (!value) {
      setSelectedCarrier(null)
      setDeductibleCents(null)
      setDeductiblePctKey('0')
      setInsuranceReimbursementPct(null)
    }
  }

  async function handleSubmit() {
    if (!canSubmit || !procedure || !species) return
    setIsLoading(true)

    let benchmarks: { p50: number; p70: number; p90: number } | null = null
    let procedureDbId: string | null = null

    try {
      const { data: proc } = await supabase
        .from('procedures')
        .select('id')
        .eq('slug', procedure.slug)
        .maybeSingle()

      if (proc) {
        procedureDbId = proc.id

        if (metro) {
          const { data: bench } = await supabase
            .from('price_benchmarks')
            .select('p50_price, p70_price, p90_price')
            .eq('procedure_id', proc.id)
            .eq('species', species)
            .eq('metro_code', metro.metro_code)
            .maybeSingle()

          if (bench) {
            benchmarks = {
              p50: bench.p50_price / 100,
              p70: bench.p70_price / 100,
              p90: bench.p90_price / 100,
            }
          }
        }

        if (!benchmarks) {
          const { data: natBench } = await supabase
            .from('price_benchmarks')
            .select('p50_price, p70_price, p90_price')
            .eq('procedure_id', proc.id)
            .eq('species', species)
            .eq('metro_code', 'NATIONAL')
            .maybeSingle()

          if (natBench) {
            benchmarks = {
              p50: natBench.p50_price / 100,
              p70: natBench.p70_price / 100,
              p90: natBench.p90_price / 100,
            }
          }
        }
      }
    } catch {
      // Supabase unavailable — fall through to local seed data
    }

    if (!benchmarks) {
      const local = NATIONAL_BENCHMARKS[procedure.slug]?.[species]
      if (local) benchmarks = { p50: local.p50, p70: local.p70, p90: local.p90 }
    }

    if (!benchmarks) {
      setIsLoading(false)
      return
    }

    const verdict = getVerdict(parsedPrice, benchmarks.p50, benchmarks.p70, benchmarks.p90)

    let submissionId: string | null = null
    try {
      const { data: saved } = await supabase
        .from('quote_submissions')
        .insert({
          metro_code: metro?.metro_code ?? null,
          zip_code: zip,
          species,
          quoted_price: Math.round(parsedPrice * 100),
          has_insurance: hasInsurance,
          verdict,
        })
        .select('id')
        .single()
      submissionId = saved?.id ?? null
    } catch {
      // Non-fatal
    }

    // Compute insurance payout client-side when user has insurance
    let insurancePayout: InsuranceCalcResult | null = null
    if (hasInsurance && deductibleCents !== null && insuranceReimbursementPct !== null) {
      const totalVetBillCents = Math.round(parsedPrice * 100)
      const deductibleAlreadyMetCents = Math.round(
        deductibleCents * (Number(deductiblePctKey) / 100)
      )
      insurancePayout = calculateInsurancePayout({
        totalVetBillCents,
        examFeeCents: 0,
        examFeeCovered: selectedCarrier?.exam_fee_covered ?? false,
        annualDeductibleCents: deductibleCents,
        deductibleAlreadyMetCents,
        reimbursementPct: insuranceReimbursementPct,
        annualLimitCents: null,
      })

      // Fire-and-forget — non-blocking
      supabase
        .from('insurance_claim_estimates')
        .insert({
          session_id: sessionId.current,
          procedure_id: procedureDbId,
          quoted_price_cents: totalVetBillCents,
          carrier_slug:
            selectedCarrier && selectedCarrier.slug !== 'unknown'
              ? selectedCarrier.slug
              : null,
          annual_deductible_cents: deductibleCents,
          deductible_met_cents: deductibleAlreadyMetCents,
          reimbursement_pct: insuranceReimbursementPct,
          annual_limit_cents: null,
          exam_fee_cents: 0,
          eligible_amount_cents: insurancePayout.eligibleAmountCents,
          remaining_deductible_cents: insurancePayout.remainingDeductibleCents,
          base_payout_cents: insurancePayout.basePayoutCents,
          final_payout_cents: insurancePayout.finalPayoutCents,
          out_of_pocket_cents: insurancePayout.outOfPocketCents,
        })
        .then(() => {})
    }

    setResult({ verdict, ...benchmarks, submissionId, insurancePayout })
    setIsLoading(false)

    setTimeout(() => {
      document.getElementById('verdict-section')?.scrollIntoView({ behavior: 'smooth' })
    }, 80)
  }

  async function handleEmailSubmit() {
    if (!email || !result || !procedure || !species) return
    const ip = result.insurancePayout
    try {
      await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          procedure_slug: procedure.slug,
          species,
          metro_code: metro?.metro_code ?? null,
          quoted_price: parsedPrice,
          verdict: result.verdict,
          p50: result.p50,
          p70: result.p70,
          p90: result.p90,
          submission_id: result.submissionId ?? null,
          // Insurance fields — only populated when user had insurance
          insurance_carrier_name: ip ? (selectedCarrier?.display_name ?? null) : null,
          insurance_out_of_pocket: ip ? ip.outOfPocketCents / 100 : null,
          insurance_final_payout: ip ? ip.finalPayoutCents / 100 : null,
          insurance_deductible_applied: ip ? ip.remainingDeductibleCents / 100 : null,
          insurance_reimbursement_pct: ip ? ip.reimbursementPct : null,
          insurance_is_high_out_of_pocket: ip ? ip.isHighOutOfPocket : null,
        }),
      })
    } catch {
      // Non-fatal — still mark as sent
    }
    setEmailSent(true)
  }

  function handleReset() {
    setSpecies(null)
    setProcedure(null)
    setZip('')
    setZipError('')
    setMetro(null)
    setPrice('')
    setHasInsurance(null)
    setSelectedCarrier(null)
    setDeductibleCents(null)
    setDeductiblePctKey('0')
    setInsuranceReimbursementPct(null)
    setResult(null)
    setEmail('')
    setEmailSent(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const verdictCfg = result ? VERDICT[result.verdict] : null

  const priceComparison = result
    ? ({
        fair: 'at or below the median for this area',
        slightly_high: 'above the median but within a typical range for this area',
        high: 'above the 70th percentile for this area',
        above_market: 'above the 90th percentile — well above market for this area',
      } as const)[result.verdict]
    : ''

  useEffect(() => {
    supabase
      .from('insurance_carriers')
      .select('slug, display_name, deductible_type, exam_fee_covered, reimbursement_options, annual_limit_options, notes, affiliate_url')
      .eq('active', true)
      .order('display_name')
      .then(({ data }) => {
        if (data) setCarriers(data as InsuranceCarrier[])
      })
  }, [])

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'vqc-print'
    el.textContent = `
      @media print {
        body * { visibility: hidden; }
        #print-content, #print-content * { visibility: visible; }
        #print-content {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          padding: 0.75in;
          box-sizing: border-box;
          background: white;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11pt;
          color: #000;
          line-height: 1.55;
        }
        .pq-block { page-break-inside: avoid; break-inside: avoid; }
      }
    `
    document.head.appendChild(el)
    return () => el.remove()
  }, [])

  return (
    <>
    <div className="min-h-screen bg-stone-50">

      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="hidden text-sm text-stone-400 transition-colors hover:text-stone-600 sm:block"
            >
              ← Back to home
            </Link>
            <div className="hidden h-4 w-px bg-stone-200 sm:block" />
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500">
                <PawPrint className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-stone-900">Tailcue</span>
            </Link>
          </div>
          <span className="hidden text-sm text-stone-400 sm:block">
            Free · Instant · No Account Needed
          </span>
        </div>
        {/* Mobile back link */}
        <div className="border-t border-stone-100 px-4 py-2 sm:hidden">
          <Link href="/" className="text-sm text-stone-400 hover:text-stone-600">
            ← Back to home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-stone-50 py-10 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-stone-900 sm:text-[40px]">
            Is Your Vet Quote Fair?
          </h1>
          <p className="mx-auto mt-3 max-w-[520px] text-[16px] leading-relaxed text-stone-500">
            Enter your quote and get an instant benchmark from real vet prices across the country.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-[640px] space-y-5 px-4 pb-20">

        {/* Form card */}
        <Card className="rounded-2xl border border-stone-200 border-t-4 border-t-amber-500 shadow-md">
          <CardContent className="space-y-7 p-5 sm:p-7">

            {/* Step 1 — Species */}
            <div className="space-y-4">
              <StepLabel n={1} label="What's your pet?" />
              <div className="grid grid-cols-2 gap-3">
                {(['dog', 'cat'] as Species[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSpeciesSelect(s)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-2 rounded-xl border-2 py-5 font-semibold transition-all',
                      species === s
                        ? 'border-amber-500 bg-amber-50 text-amber-900'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'
                    )}
                  >
                    <span className="text-[2.5rem]" aria-hidden>
                      {s === 'dog' ? '🐕' : '🐈'}
                    </span>
                    <span className="text-base">{s === 'dog' ? 'Dog' : 'Cat'}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2 — Procedure */}
            {showProcedure && (
              <>
                <Separator className="bg-stone-100" />
                <div className="space-y-4">
                  <StepLabel n={2} label="What procedure were you quoted for?" />
                  <ProcedureSelect
                    procedures={filteredProcedures}
                    selected={procedure}
                    onSelect={setProcedure}
                  />
                </div>
              </>
            )}

            {/* Step 3 — ZIP */}
            {showZip && (
              <>
                <Separator className="bg-stone-100" />
                <div className="space-y-4">
                  <StepLabel n={3} label="What's your ZIP code?" />
                  <div className="space-y-1.5">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 10001"
                      value={zip}
                      onChange={(e) => handleZipChange(e.target.value)}
                      onBlur={handleZipBlur}
                      maxLength={5}
                      className={cn(
                        'h-11 rounded-xl border-stone-200 text-base',
                        zipError && 'border-red-400 focus-visible:ring-red-300'
                      )}
                    />
                    {zipError && <p className="text-sm text-red-500">{zipError}</p>}
                    {!zipError && metro && (
                      <p className="flex items-center gap-1 text-sm text-green-600">
                        <Check className="h-3.5 w-3.5" />
                        {metro.display_name} pricing area detected
                      </p>
                    )}
                    {!zipError && zip.length === 5 && !metro && (
                      <p className="text-sm text-stone-400">
                        ZIP not matched to a metro area — national averages will be used.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Step 4 — Price */}
            {showPrice && (
              <>
                <Separator className="bg-stone-100" />
                <div className="space-y-4">
                  <StepLabel n={4} label="What price were you quoted?" />
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-medium text-stone-400">
                      $
                    </span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      min={0}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="h-11 rounded-xl border-stone-200 pl-7 text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Step 5 — Insurance */}
            {showInsurance && (
              <>
                <Separator className="bg-stone-100" />
                <div className="space-y-4">
                  <StepLabel n={5} label="Do you have pet insurance?" />
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: true, label: 'I have insurance' },
                      { value: false, label: 'No insurance' },
                    ].map(({ value, label }) => (
                      <button
                        key={String(value)}
                        type="button"
                        onClick={() => handleInsuranceToggle(value)}
                        className={cn(
                          'rounded-xl border-2 py-4 text-sm font-semibold transition-all',
                          hasInsurance === value
                            ? 'border-amber-500 bg-amber-50 text-amber-900'
                            : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Insurance detail fields — fade in when 'I have insurance' selected */}
                  <div
                    className={cn(
                      'space-y-4 transition-opacity duration-300',
                      hasInsurance === true
                        ? 'opacity-100'
                        : 'pointer-events-none h-0 overflow-hidden opacity-0'
                    )}
                  >
                    {/* Field A: Carrier */}
                    <div className="space-y-1.5">
                      <label className="block text-[13px] font-medium text-stone-600">
                        Your insurance provider
                      </label>
                      <select
                        value={selectedCarrier?.slug ?? ''}
                        onChange={(e) => {
                          const slug = e.target.value
                          if (slug === 'unknown') {
                            setSelectedCarrier({
                              slug: 'unknown',
                              display_name: "My carrier isn't listed / I'm not sure",
                              deductible_type: 'annual',
                              exam_fee_covered: false,
                              reimbursement_options: [],
                              annual_limit_options: [],
                              notes: null,
                              affiliate_url: null,
                            })
                            setInsuranceReimbursementPct(null)
                          } else {
                            const carrier = carriers.find((c) => c.slug === slug) ?? null
                            setSelectedCarrier(carrier)
                            if (carrier && carrier.reimbursement_options.length === 1) {
                              setInsuranceReimbursementPct(carrier.reimbursement_options[0])
                            } else {
                              setInsuranceReimbursementPct(null)
                            }
                          }
                        }}
                        className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3.5 text-sm text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      >
                        <option value="">Select your provider…</option>
                        {carriers.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.display_name}
                          </option>
                        ))}
                        <option value="unknown">My carrier isn&apos;t listed / I&apos;m not sure</option>
                      </select>
                    </div>

                    {/* Field B: Annual deductible */}
                    <div className="space-y-1.5">
                      <label className="block text-[13px] font-medium text-stone-600">
                        Annual deductible
                      </label>
                      <select
                        value={deductibleCents ?? ''}
                        onChange={(e) =>
                          setDeductibleCents(e.target.value ? Number(e.target.value) : null)
                        }
                        className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3.5 text-sm text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      >
                        <option value="">Select deductible…</option>
                        {([
                          [10000, '$100'],
                          [20000, '$200'],
                          [25000, '$250'],
                          [30000, '$300'],
                          [50000, '$500'],
                          [75000, '$750'],
                          [100000, '$1,000'],
                          [150000, '$1,500'],
                          [200000, '$2,000'],
                        ] as [number, string][]).map(([cents, label]) => (
                          <option key={cents} value={cents}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Field C: Deductible already met */}
                    <div className="space-y-1.5">
                      <label className="block text-[13px] font-medium text-stone-600">
                        How much of your deductible have you already used this year?
                      </label>
                      <select
                        value={deductiblePctKey}
                        onChange={(e) => setDeductiblePctKey(e.target.value)}
                        className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3.5 text-sm text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      >
                        <option value="0">$0 (none)</option>
                        <option value="25">25% met</option>
                        <option value="50">50% met</option>
                        <option value="75">75% met</option>
                        <option value="100">100% (fully met)</option>
                      </select>
                    </div>

                    {/* Field D: Reimbursement rate */}
                    <div className="space-y-1.5">
                      <label className="block text-[13px] font-medium text-stone-600">
                        Your reimbursement rate
                      </label>
                      {selectedCarrier &&
                      selectedCarrier.slug !== 'unknown' &&
                      selectedCarrier.reimbursement_options.length === 1 ? (
                        <div className="flex h-11 items-center">
                          <span className="inline-flex items-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                            {selectedCarrier.reimbursement_options[0]}% — fixed for{' '}
                            {selectedCarrier.display_name}
                          </span>
                        </div>
                      ) : (
                        <select
                          value={insuranceReimbursementPct ?? ''}
                          onChange={(e) =>
                            setInsuranceReimbursementPct(
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3.5 text-sm text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        >
                          <option value="">Select rate…</option>
                          <option value="70">70%</option>
                          <option value="80">80%</option>
                          <option value="90">90%</option>
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Submit */}
            {canSubmit && !result && (
              <>
                <Separator className="bg-stone-100" />
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="h-[52px] w-full rounded-xl bg-amber-500 text-base font-bold text-stone-900 hover:bg-amber-600 disabled:opacity-60"
                >
                  {isLoading ? 'Checking…' : 'Check My Quote →'}
                </Button>
              </>
            )}

          </CardContent>
        </Card>

        {/* Verdict section */}
        {result && procedure && verdictCfg && (
          <div id="verdict-section" className="space-y-5">

            {/* Verdict card */}
            <Card
              className={cn(
                'overflow-hidden rounded-2xl border-2 shadow-sm',
                verdictCfg.border,
                verdictCfg.bg
              )}
            >
              <CardContent className="p-6">
                <div className={cn('mb-2 flex items-center gap-3', verdictCfg.color)}>
                  <VerdictIcon verdict={result.verdict} className="h-7 w-7 shrink-0" />
                  <span className="text-[28px] font-extrabold leading-none tracking-tight">
                    {verdictCfg.label.toUpperCase()}
                  </span>
                </div>
                <p className={cn('text-[15px] leading-relaxed', verdictCfg.color)}>
                  {verdictCfg.description}
                </p>
              </CardContent>
            </Card>

            {/* Insurance payout panel */}
            {result.insurancePayout && (
              <Card className="overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <CardContent className="p-6">
                  <h3 className="mb-4 text-[15px] font-semibold text-stone-900">
                    Your estimated insurance coverage
                  </h3>

                  <div className="divide-y divide-stone-100">
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-stone-500">Estimated payout</span>
                      <span className="text-sm font-medium text-stone-900">
                        ${(result.insurancePayout.finalPayoutCents / 100).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-stone-500">Your out-of-pocket</span>
                      <span className="text-[18px] font-bold text-stone-900">
                        ${(result.insurancePayout.outOfPocketCents / 100).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-stone-500">Deductible applied</span>
                      <span className="text-sm font-medium text-stone-900">
                        ${(result.insurancePayout.remainingDeductibleCents / 100).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-stone-500">Reimbursement rate</span>
                      <span className="text-sm font-medium text-stone-900">
                        {result.insurancePayout.reimbursementPct}%
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-stone-400">
                    Estimate based on your inputs. Actual reimbursement depends on your specific policy terms.
                  </p>

                  {result.insurancePayout.isHighOutOfPocket && (
                    <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3">
                      <p className="mb-3 text-sm leading-relaxed text-amber-800">
                        Your policy may leave significant out-of-pocket costs. Compare plans that could work harder for you.
                      </p>
                      <a
                        href="https://www.theswiftest.com/pet-insurance/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-600"
                      >
                        Compare Pet Insurance Plans →
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Price range bar */}
            <Card className="overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-5 text-[15px] font-semibold text-stone-900">
                  Price Range —{' '}
                  <span className="font-normal text-stone-600">{procedure.display_name}</span>
                  {metro ? (
                    <span className="font-normal text-stone-400"> · {metro.display_name}</span>
                  ) : (
                    <span className="font-normal text-stone-400"> · National Average</span>
                  )}
                </h3>
                <PriceRangeBar
                  p50={result.p50}
                  p70={result.p70}
                  p90={result.p90}
                  quotedPrice={parsedPrice}
                />
              </CardContent>
            </Card>

            {/* Print button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-400 bg-white px-4 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50"
              >
                🖨️ Print This Report
              </button>
            </div>

            {/* Procedure info + questions */}
            <Card className="overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <CardContent className="space-y-5 p-6">
                <div>
                  <div className="text-[16px] font-bold text-stone-900">
                    {procedure.display_name}
                  </div>
                  {procedure.clinical_name && (
                    <div className="mt-0.5 text-xs italic text-stone-400">
                      {procedure.clinical_name}
                    </div>
                  )}
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">
                    {procedure.description_plain}
                  </p>
                </div>

                <Separator className="bg-stone-100" />

                <div>
                  <h4 className="mb-4 text-[15px] font-semibold text-stone-900">
                    Questions to Ask Your Vet
                  </h4>
                  <QuestionsAccordion questions={procedure.questions_to_ask} />
                </div>
              </CardContent>
            </Card>

            {/* Email capture */}
            <Card className="overflow-hidden rounded-2xl border-amber-200 bg-amber-50 shadow-sm">
              <CardContent className="p-6">
                {emailSent ? (
                  <div className="space-y-1 text-center">
                    <p className="font-bold text-stone-900">Report on the way!</p>
                    <p className="text-sm text-stone-500">
                      Check your inbox for your free summary.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-bold text-stone-900">Get Your Free Report</h4>
                      <p className="mt-0.5 text-sm text-stone-500">
                        Includes your verdict, price breakdown, and the questions to ask.
                        No spam — one email only.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                        className="h-11 flex-1 rounded-xl border-amber-200 bg-white"
                      />
                      <Button
                        onClick={handleEmailSubmit}
                        disabled={!email}
                        className="h-11 shrink-0 rounded-xl bg-amber-500 font-semibold text-stone-900 hover:bg-amber-600 disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" />
                        <span className="ml-1.5 hidden sm:inline">Send</span>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reset */}
            <div className="pb-4 text-center">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex min-h-[44px] items-center px-4 text-sm font-medium text-amber-600 hover:underline"
              >
                ← Check another procedure
              </button>
            </div>

          </div>
        )}
      </main>

      <Footer />
    </div>

    {/* ------------------------------------------------------------------ */}
    {/* Print-only content — hidden on screen, shown by @media print CSS   */}
    {/* ------------------------------------------------------------------ */}
    {result && procedure && verdictCfg && species && (
      <div id="print-content" style={{ display: 'none' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16pt', paddingBottom: '8pt', borderBottom: '2px solid #000' }}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '16pt', letterSpacing: '-0.01em' }}>Tailcue.com</div>
            <div style={{ fontSize: '9pt', color: '#666', marginTop: '2pt' }}>Independent vet price benchmarks for pet owners</div>
          </div>
          <div style={{ fontSize: '9pt', color: '#666', textAlign: 'right' }}>
            <div style={{ fontWeight: 'bold' }}>Quote Analysis Report</div>
            <div style={{ marginTop: '2pt' }}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>

        {/* Pet & Procedure Summary */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14pt', fontSize: '11pt' }}>
          <tbody>
            <tr>
              <td style={{ fontWeight: 'bold', width: '130pt', paddingBottom: '4pt', verticalAlign: 'top' }}>Procedure:</td>
              <td style={{ paddingBottom: '4pt' }}>{procedure.display_name}</td>
            </tr>
            {procedure.clinical_name && (
              <tr>
                <td style={{ fontWeight: 'bold', paddingBottom: '4pt', verticalAlign: 'top' }}>Clinical name:</td>
                <td style={{ paddingBottom: '4pt', fontStyle: 'italic' }}>{procedure.clinical_name}</td>
              </tr>
            )}
            <tr>
              <td style={{ fontWeight: 'bold', paddingBottom: '4pt' }}>Species:</td>
              <td style={{ paddingBottom: '4pt' }}>{species === 'dog' ? 'Dog' : 'Cat'}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', paddingBottom: '4pt' }}>Your quote:</td>
              <td style={{ paddingBottom: '4pt' }}>${parsedPrice.toLocaleString()}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold' }}>Location:</td>
              <td>{metro ? metro.display_name : 'National Average'}</td>
            </tr>
          </tbody>
        </table>

        {/* Verdict */}
        <div style={{ border: '2px solid #000', borderRadius: '3pt', padding: '10pt 14pt', marginBottom: '14pt' }}>
          <div style={{ fontSize: '14pt', fontWeight: 'bold', letterSpacing: '0.04em' }}>
            VERDICT: {verdictCfg.label.toUpperCase()}
          </div>
          <div style={{ marginTop: '4pt', fontSize: '10pt' }}>{verdictCfg.description}</div>
        </div>

        {/* Price Benchmarks */}
        <div style={{ marginBottom: '14pt' }}>
          <div style={{ fontSize: '12pt', fontWeight: 'bold', marginBottom: '8pt', paddingBottom: '4pt', borderBottom: '1px solid #ccc' }}>
            Price Benchmarks
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8pt' }}>
            <thead>
              <tr>
                {[
                  { label: 'Median', sublabel: 'P50' },
                  { label: 'Above Average', sublabel: 'P70' },
                  { label: 'High End', sublabel: 'P90' },
                ].map(({ label, sublabel }) => (
                  <th key={sublabel} style={{ border: '1px solid #bbb', padding: '5pt 8pt', textAlign: 'center', fontSize: '9pt', fontWeight: 'bold', background: '#f0f0f0' }}>
                    {label} ({sublabel})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {[result.p50, result.p70, result.p90].map((v, i) => (
                  <td key={i} style={{ border: '1px solid #bbb', padding: '6pt 8pt', textAlign: 'center', fontSize: '13pt', fontWeight: 'bold' }}>
                    ${v.toLocaleString()}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: '10pt' }}>
            Your quote of <strong>${parsedPrice.toLocaleString()}</strong> is {priceComparison}.
          </div>
        </div>

        {/* About This Procedure */}
        <div style={{ marginBottom: '14pt' }}>
          <div style={{ fontSize: '12pt', fontWeight: 'bold', marginBottom: '6pt', paddingBottom: '4pt', borderBottom: '1px solid #ccc' }}>
            About This Procedure
          </div>
          <p style={{ margin: 0, fontSize: '10pt', lineHeight: '1.6' }}>{procedure.description_plain}</p>
        </div>

        {/* Questions */}
        <div>
          <div style={{ fontSize: '13pt', fontWeight: 'bold', marginBottom: '12pt', paddingBottom: '5pt', borderBottom: '2px solid #000' }}>
            Questions to Ask Your Vet
          </div>
          {procedure.questions_to_ask.map((q, i) => (
            <div
              key={i}
              className="pq-block"
              style={{
                marginBottom: i < procedure.questions_to_ask.length - 1 ? '14pt' : 0,
                paddingBottom: i < procedure.questions_to_ask.length - 1 ? '14pt' : 0,
                borderBottom: i < procedure.questions_to_ask.length - 1 ? '1px solid #ddd' : 'none',
              }}
            >
              <div style={{ display: 'flex', gap: '7pt', alignItems: 'flex-start', marginBottom: '6pt' }}>
                <span style={{ fontSize: '13pt', lineHeight: '1.3', flexShrink: 0 }}>☐</span>
                <div style={{ fontSize: '12pt', fontWeight: 'bold', lineHeight: '1.35' }}>{q.question}</div>
              </div>
              <div style={{ marginLeft: '20pt' }}>
                <div style={{ fontSize: '8pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#555', marginBottom: '2pt' }}>
                  What to Listen For
                </div>
                <p style={{ margin: '0 0 7pt 0', fontSize: '10pt', lineHeight: '1.55' }}>{q.listen_for}</p>
                <div style={{ fontSize: '8pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#555', marginBottom: '2pt' }}>
                  Why It Matters
                </div>
                <p style={{ margin: 0, fontSize: '10pt', lineHeight: '1.55' }}>{q.why_it_matters}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '20pt', paddingTop: '8pt', borderTop: '1px solid #ccc', fontSize: '8pt', color: '#666' }}>
          <p style={{ margin: '0 0 3pt 0' }}>
            Prices based on NAPHIA SOI 2025 and published veterinary industry benchmarks. For educational purposes only — not veterinary advice.
          </p>
          <p style={{ margin: 0 }}>Generated by Tailcue.com</p>
        </div>

      </div>
    )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Default export — wraps CheckerContent in Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function CheckerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-stone-50">
          <p className="text-stone-400">Loading…</p>
        </div>
      }
    >
      <CheckerContent />
    </Suspense>
  )
}
