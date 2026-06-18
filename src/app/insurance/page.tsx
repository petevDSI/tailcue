'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PawPrint } from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────

const CARRIERS = [
  'Trupanion', 'Healthy Paws', 'Embrace', 'Spot',
  'Figo', 'Nationwide', 'ASPCA', 'Lemonade',
]

const SCENARIOS = [
  { title: 'Budget Plan',    label: 'Basic coverage', reimbPct: 80, deductible: 500, popular: false },
  { title: 'Standard Plan',  label: 'Most popular',   reimbPct: 80, deductible: 250, popular: true  },
  { title: 'Premium Plan',   label: 'Best coverage',  reimbPct: 90, deductible: 100, popular: false },
]

// ── Helpers ───────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n)
}

function calcFlowA(cost: number, deductible: number, reimbPct: number, deductibleMet: boolean) {
  if (deductibleMet) {
    const ins = Math.round(cost * reimbPct / 100)
    return { insurancePays: ins, ownerPays: cost - ins }
  }
  if (cost <= deductible) return { insurancePays: 0, ownerPays: cost }
  const after = cost - deductible
  const ins = Math.round(after * reimbPct / 100)
  return { insurancePays: ins, ownerPays: cost - ins }
}

function calcScenario(cost: number, deductible: number, reimbPct: number) {
  if (cost <= deductible) return { ownerPays: cost, insurancePays: 0, savings: 0 }
  const after = cost - deductible
  const ins = Math.round(after * reimbPct / 100)
  const ownerPays = cost - ins
  return { insurancePays: ins, ownerPays, savings: ins }
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function InsurancePage() {
  const [hasInsurance, setHasInsurance] = useState<'yes' | 'no' | null>(null)
  const [procedureName, setProcedureName] = useState('')
  const [costStr, setCostStr] = useState('')
  const [carrier, setCarrier] = useState('')
  const [deductibleStr, setDeductibleStr] = useState('')
  const [reimbPct, setReimbPct] = useState<number | null>(null)
  const [deductibleMet, setDeductibleMet] = useState<boolean | null>(null)

  const cost = parseFloat(costStr) || 0
  const deductible = parseFloat(deductibleStr) || 0

  const showFlowAResult = hasInsurance === 'yes' && cost > 0 && reimbPct !== null && deductibleMet !== null
  const showFlowBResult = hasInsurance === 'no' && cost > 0

  const flowAResult = showFlowAResult ? calcFlowA(cost, deductible, reimbPct!, deductibleMet!) : null

  const scenarioResults = showFlowBResult
    ? SCENARIOS.map((s) => ({ ...s, ...calcScenario(cost, s.deductible, s.reimbPct) }))
    : null
  const standardResult = scenarioResults?.[1]

  return (
    <div
      className="min-h-screen bg-stone-50"
      style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}
    >
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500">
              <PawPrint className="h-5 w-5 text-white" />
            </div>
            <span className="text-[17px] font-bold tracking-tight text-stone-900">Tailcue</span>
          </Link>
          <Link
            href="/checker"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-600"
          >
            Check a Quote →
          </Link>
        </div>
      </header>

      {/* Page header */}
      <section className="border-b border-stone-100 bg-gradient-to-b from-amber-50 to-stone-50 px-6 py-12 text-center">
        <div className="mx-auto max-w-xl">
          <h1 className="mb-2 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight text-stone-900">
            Pet Insurance Calculator
          </h1>
          <p className="text-base text-stone-500">
            Understand what insurance pays — and what it doesn&apos;t
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-2xl space-y-5 px-6 py-10">

        {/* Insurance toggle */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-center text-[15px] font-semibold text-stone-700">
            Do you have pet insurance?
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(['yes', 'no'] as const).map((val) => (
              <button
                key={val}
                onClick={() => setHasInsurance(val)}
                className={`min-h-[52px] rounded-xl border-2 text-sm font-semibold transition-colors ${
                  hasInsurance === val
                    ? 'border-amber-500 bg-amber-50 text-amber-800'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                }`}
              >
                {val === 'yes' ? "Yes, I'm covered" : "No, I don't have it"}
              </button>
            ))}
          </div>
        </div>

        {/* Shared inputs */}
        {hasInsurance !== null && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-600">Procedure</label>
                <input
                  type="text"
                  value={procedureName}
                  onChange={(e) => setProcedureName(e.target.value)}
                  placeholder="e.g. Dog spay, ACL surgery"
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 placeholder-stone-300 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-600">Estimated cost</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={costStr}
                    onChange={(e) => setCostStr(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-stone-200 py-3 pl-8 pr-4 text-sm text-stone-800 placeholder-stone-300 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Flow A additional fields */}
              {hasInsurance === 'yes' && (
                <div className="space-y-4 border-t border-stone-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                    Your plan details
                  </p>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-stone-600">
                      Insurance carrier
                    </label>
                    <select
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 focus:border-amber-400 focus:outline-none"
                    >
                      <option value="">Select carrier…</option>
                      {CARRIERS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-stone-600">
                      Annual deductible
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={deductibleStr}
                        onChange={(e) => setDeductibleStr(e.target.value)}
                        placeholder="0"
                        className="w-full rounded-xl border border-stone-200 py-3 pl-8 pr-4 text-sm text-stone-800 placeholder-stone-300 focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-600">
                      Reimbursement rate
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[70, 80, 90].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => setReimbPct(pct)}
                          className={`min-h-[44px] rounded-xl border-2 text-sm font-semibold transition-colors ${
                            reimbPct === pct
                              ? 'border-amber-500 bg-amber-50 text-amber-800'
                              : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-600">
                      Has your deductible been met this year?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {([true, false] as const).map((val) => (
                        <button
                          key={String(val)}
                          onClick={() => setDeductibleMet(val)}
                          className={`min-h-[44px] rounded-xl border-2 text-sm font-semibold transition-colors ${
                            deductibleMet === val
                              ? 'border-amber-500 bg-amber-50 text-amber-800'
                              : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                          }`}
                        >
                          {val ? 'Yes' : 'No'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Flow A Results ───────────────────────────────────────────── */}
        {flowAResult && (
          <>
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-[15px] font-bold text-stone-800">Your estimated breakdown</h2>

              {/* Visual bar */}
              <div className="mb-5">
                <div className="flex h-4 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="bg-amber-400 transition-all duration-500"
                    style={{
                      width: `${Math.round((flowAResult.insurancePays / cost) * 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-xs text-stone-400">
                  <span>
                    Insurance: {Math.round((flowAResult.insurancePays / cost) * 100)}%
                  </span>
                  <span>
                    You pay: {Math.round((flowAResult.ownerPays / cost) * 100)}%
                  </span>
                </div>
              </div>

              {/* Amounts */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-amber-50 p-4 text-center">
                  <p className="mb-1 text-xs font-medium text-stone-500">Insurance covers</p>
                  <p className="text-2xl font-extrabold text-amber-600">
                    {fmt(flowAResult.insurancePays)}
                  </p>
                </div>
                <div className="rounded-xl bg-stone-50 p-4 text-center">
                  <p className="mb-1 text-xs font-medium text-stone-500">Your out-of-pocket</p>
                  <p className="text-2xl font-extrabold text-stone-800">
                    {fmt(flowAResult.ownerPays)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              {flowAResult.ownerPays > cost * 0.4 && (
                <p className="mb-3 text-sm leading-relaxed text-stone-700">
                  Your plan left you with a significant portion of this bill. Some plans offer
                  better reimbursement rates — it may be worth comparing your options.
                </p>
              )}
              <a
                href="https://www.theswiftest.com/pet-insurance/"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-xl bg-amber-500 py-3.5 text-center text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-600"
              >
                Compare Pet Insurance Plans →
              </a>
            </div>
          </>
        )}

        {/* ── Flow B Results ───────────────────────────────────────────── */}
        {scenarioResults && standardResult && (
          <>
            <div>
              <h2 className="mb-4 text-[15px] font-bold text-stone-800">
                Here&apos;s what insurance would have covered
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {scenarioResults.map((s) => (
                  <div
                    key={s.title}
                    className={`relative rounded-2xl border p-5 ${
                      s.popular
                        ? 'border-amber-400 bg-amber-50 shadow-md'
                        : 'border-stone-200 bg-white shadow-sm'
                    }`}
                  >
                    {s.popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-3 py-0.5 text-[11px] font-bold text-stone-900">
                        Most Popular
                      </span>
                    )}
                    <p className="mb-0.5 text-[13px] font-bold text-stone-800">{s.title}</p>
                    <p className="mb-3 text-xs text-stone-400">
                      {s.reimbPct}% reimbursement · ${s.deductible} deductible
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">You would pay</span>
                        <span className="font-bold text-stone-800">{fmt(s.ownerPays)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Insurance covers</span>
                        <span className="font-bold text-amber-600">{fmt(s.insurancePays)}</span>
                      </div>
                      <div className="flex justify-between border-t border-stone-100 pt-2 text-sm">
                        <span className="text-stone-500">You would save</span>
                        <span className="font-bold text-emerald-600">{fmt(s.savings)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Callout */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="mb-4 text-sm leading-relaxed text-stone-700">
                Uninsured, you paid the full{' '}
                <span className="font-semibold">{fmt(cost)}</span>. With a standard plan, you
                would have paid approximately{' '}
                <span className="font-semibold">{fmt(standardResult.ownerPays)}</span>. That&apos;s
                a difference of{' '}
                <span className="font-semibold text-emerald-700">{fmt(standardResult.savings)}</span>.
              </p>
              <a
                href="https://www.theswiftest.com/pet-insurance/"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-xl bg-amber-500 py-3.5 text-center text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-600"
              >
                Get Covered Before Your Next Visit →
              </a>
            </div>

            <p className="text-center text-xs leading-relaxed text-stone-400">
              Estimates based on typical plan structures. Actual reimbursement depends on your
              policy terms, waiting periods, and whether the condition is pre-existing.
            </p>
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-6 text-center">
        <p className="text-xs text-stone-400">
          Benchmark prices based on NAPHIA SOI 2025 and published industry data. For educational
          purposes only — not a substitute for veterinary advice.
        </p>
      </footer>
    </div>
  )
}
