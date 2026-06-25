'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PawPrint } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type ExtractionConfidence = 'high' | 'medium' | 'low'

interface WaitingPeriods {
  accident_days: number | null
  illness_days: number | null
  orthopedic_days: number | null
  cruciate_ligament_days: number | null
  notes: string | null
}

interface DentalCoverage {
  injury_covered: boolean | null
  illness_covered: boolean | null
  routine_cleaning_covered: boolean | null
}

interface PreExistingConditions {
  covered: boolean
  definition_summary: string
  curable_after_symptom_free_days: number | null
}

interface ExtractedFacts {
  deductible_type: string
  reimbursement_options: string
  waiting_periods: WaitingPeriods
  wellness_available: boolean
  wellness_addon_name: string | null
  dental: DentalCoverage
  pre_existing_conditions: PreExistingConditions
  exclusions: string[]
  extraction_confidence: ExtractionConfidence
  extraction_notes: string
  policy_document_date: string
}

interface PolicyScrapeRow {
  id: string
  scraped_at: string
  extracted_facts: ExtractedFacts
  diff_summary: Record<string, unknown>
  source_url: string
  carrier_id: string
  carrier_name: string
  policy_type: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const CONFIDENCE_ORDER: Record<ExtractionConfidence, number> = { low: 0, medium: 1, high: 2 }

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPolicyType(t: string): string {
  if (t === 'accident_illness') return 'Accident & Illness'
  if (t === 'wellness') return 'Wellness'
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function boolCell(val: boolean | null): string {
  if (val === null) return 'Unknown'
  return val ? 'Yes' : 'No'
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ExclusionsToggle({ exclusions }: { exclusions: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-stone-500 hover:text-stone-700 font-medium transition-colors"
      >
        {open ? '▲ Hide exclusions' : `▼ Show exclusions (${exclusions.length})`}
      </button>
      {open && (
        <ul className="mt-2 list-disc list-inside space-y-1">
          {exclusions.map((excl, i) => (
            <li key={i} className="text-sm text-stone-600">
              {excl}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PolicyReviewPage() {
  const [scrapes, setScrapes] = useState<PolicyScrapeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)

      // Query 1: fetch pending scrapes (flat)
      const { data: scrapeData, error: scrapeError } = await supabase
        .from('carrier_policy_scrapes')
        .select(`
          id,
          scraped_at,
          extracted_facts,
          diff_summary,
          source_id
        `)
        .eq('status', 'pending_review')
        .order('scraped_at', { ascending: false })

      if (scrapeError || !scrapeData) {
        console.error('Failed to load scrapes', scrapeError)
        setLoading(false)
        return
      }

      // Query 2: fetch all carrier_policy_sources
      const { data: sourceData, error: sourceError } = await supabase
        .from('carrier_policy_sources')
        .select(`
          id,
          policy_type,
          source_url,
          carrier_id
        `)

      if (sourceError || !sourceData) {
        console.error('Failed to load sources', sourceError)
        setLoading(false)
        return
      }

      // Query 3: fetch all insurance_carriers
      const { data: carrierData, error: carrierError } = await supabase
        .from('insurance_carriers')
        .select(`
          id,
          display_name
        `)

      if (carrierError || !carrierData) {
        console.error('Failed to load carriers', carrierError)
        setLoading(false)
        return
      }

      // Build lookup maps
      const sourceMap = new Map(sourceData.map((s) => [s.id, s]))
      const carrierMap = new Map(carrierData.map((c) => [c.id, c]))

      // Flatten into PolicyScrapeRow[]
      const flat: PolicyScrapeRow[] = []
      for (const r of scrapeData) {
        if (!r.extracted_facts) continue
        const src = sourceMap.get(r.source_id)
        if (!src) continue
        const carrier = carrierMap.get(src.carrier_id)
        if (!carrier) continue
        flat.push({
          id: r.id,
          scraped_at: r.scraped_at,
          extracted_facts: r.extracted_facts as ExtractedFacts,
          diff_summary: (r.diff_summary as Record<string, unknown>) ?? {},
          source_url: src.source_url,
          carrier_id: src.carrier_id,
          carrier_name: carrier.display_name,
          policy_type: src.policy_type,
        })
      }

      // Group by (carrier_id, policy_type) — keep only the most recent per group
      const groups = new Map<string, PolicyScrapeRow[]>()
      for (const row of flat) {
        const key = `${row.carrier_id}::${row.policy_type}`
        const existing = groups.get(key) ?? []
        groups.set(key, [...existing, row])
      }

      const toDisplay: PolicyScrapeRow[] = []
      const toRejectIds: string[] = []

      for (const group of Array.from(groups.values())) {
        const sorted = [...group].sort(
          (a, b) => new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime()
        )
        toDisplay.push(sorted[0])
        for (const older of sorted.slice(1)) {
          toRejectIds.push(older.id)
        }
      }

      // Auto-reject older duplicates (fire-and-forget)
      if (toRejectIds.length > 0) {
        supabase
          .from('carrier_policy_scrapes')
          .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
          .in('id', toRejectIds)
          .then(({ error: e }) => {
            if (e) console.error('Auto-reject failed', e)
          })
      }

      // Sort: low confidence first, then carrier name
      toDisplay.sort((a, b) => {
        const ca = CONFIDENCE_ORDER[a.extracted_facts.extraction_confidence ?? 'low']
        const cb = CONFIDENCE_ORDER[b.extracted_facts.extraction_confidence ?? 'low']
        if (ca !== cb) return ca - cb
        return a.carrier_name.localeCompare(b.carrier_name)
      })

      setScrapes(toDisplay)
      setLoading(false)
    }

    load()
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleApprove(row: PolicyScrapeRow) {
    const { error: insertError } = await supabase.from('carrier_policy_facts').upsert({
      carrier_id: row.carrier_id,
      policy_type: row.policy_type,
      facts: row.extracted_facts,
      source_url: row.source_url,
      last_verified_at: new Date().toISOString(),
      approved_scrape_id: row.id,
    }, { onConflict: 'carrier_id,policy_type' })

    if (insertError) {
      console.error('Upsert carrier_policy_facts failed', insertError)
      showToast('Error inserting facts — check console')
      return
    }

    const { error: updateError } = await supabase
      .from('carrier_policy_scrapes')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', row.id)

    if (updateError) {
      console.error('Approve scrape failed', updateError)
      showToast('Error approving — check console')
      return
    }

    setScrapes((prev) => prev.filter((s) => s.id !== row.id))
    showToast(`✓ ${row.carrier_name} ${row.policy_type} approved`)
  }

  async function handleReject(row: PolicyScrapeRow) {
    const { error } = await supabase
      .from('carrier_policy_scrapes')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', row.id)

    if (error) {
      console.error('Reject scrape failed', error)
      showToast('Error rejecting — check console')
      return
    }

    setScrapes((prev) => prev.filter((s) => s.id !== row.id))
    showToast(`Rejected ${row.carrier_name} ${row.policy_type}`)
  }

  return (
    <div className="min-h-screen bg-[#FFFBF0]">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-900">Policy Review</h1>
          {!loading && (
            <p className="text-stone-500 text-sm mt-1">
              {scrapes.length === 0
                ? 'No scrapes pending review'
                : `${scrapes.length} scrape${scrapes.length === 1 ? '' : 's'} pending review`}
            </p>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-20 text-stone-400 text-sm">Loading…</div>
        )}

        {/* Empty state */}
        {!loading && scrapes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <PawPrint className="w-10 h-10 text-stone-300 mb-3" />
            <p className="text-stone-800 font-semibold text-lg">All caught up</p>
            <p className="text-stone-400 text-sm mt-1">No scrapes pending review.</p>
          </div>
        )}

        {/* Review cards */}
        <div className="space-y-6">
          {scrapes.map((row) => {
            const facts = row.extracted_facts
            const confidence = facts.extraction_confidence ?? 'low'
            const confBadgeClass =
              confidence === 'high'
                ? 'bg-green-100 text-green-700'
                : confidence === 'medium'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'
            const isFirstScrape = row.diff_summary?.first_scrape === true
            const wp = facts.waiting_periods
            const dental = facts.dental
            const preEx = facts.pre_existing_conditions
            const truncatedUrl =
              row.source_url.replace(/^https?:\/\//, '').slice(0, 45) +
              (row.source_url.length > 50 ? '…' : '')

            const factRows: [string, string][] = [
              [
                'Deductible type',
                facts.deductible_type === 'per_condition'
                  ? 'Per Condition'
                  : facts.deductible_type === 'annual'
                  ? 'Annual'
                  : facts.deductible_type ?? '—',
              ],
              ['Reimbursement', facts.reimbursement_options ?? '—'],
              ['Waiting: accident', wp?.accident_days != null ? `${wp.accident_days} days` : 'N/A'],
              ['Waiting: illness', wp?.illness_days != null ? `${wp.illness_days} days` : 'N/A'],
              ['Waiting: orthopedic', wp?.orthopedic_days != null ? `${wp.orthopedic_days} days` : 'N/A'],
              ['Waiting: cruciate', wp?.cruciate_ligament_days != null ? `${wp.cruciate_ligament_days} days` : 'N/A'],
              [
                'Wellness',
                facts.wellness_available
                  ? `Yes${facts.wellness_addon_name ? ` (${facts.wellness_addon_name})` : ''}`
                  : 'No',
              ],
              ['Dental: injury', boolCell(dental?.injury_covered ?? null)],
              ['Dental: illness', boolCell(dental?.illness_covered ?? null)],
              ['Dental: routine cleaning', boolCell(dental?.routine_cleaning_covered ?? null)],
              [
                'Pre-existing covered',
                preEx
                  ? `${preEx.covered ? 'Yes' : 'No'}${
                      preEx.curable_after_symptom_free_days
                        ? ` (curable after ${preEx.curable_after_symptom_free_days}d symptom-free)`
                        : ''
                    }`
                  : '—',
              ],
              ['Policy document date', facts.policy_document_date ?? '—'],
            ]

            return (
              <div
                key={row.id}
                className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                  <div>
                    <span className="text-base font-bold text-stone-900">{row.carrier_name}</span>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="bg-stone-100 text-stone-600 text-xs font-medium px-2 py-0.5 rounded-full">
                        {formatPolicyType(row.policy_type)}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${confBadgeClass}`}>
                        {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
                      </span>
                      {isFirstScrape && (
                        <span className="bg-stone-100 text-stone-400 text-xs px-2 py-0.5 rounded-full">
                          First scrape — no prior baseline
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-stone-400 shrink-0 text-right">
                    <div>Scraped {fmtDate(row.scraped_at)}</div>
                    <a
                      href={row.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {truncatedUrl}
                    </a>
                  </div>
                </div>

                {/* Facts table */}
                <div className="divide-y divide-stone-50 border border-stone-100 rounded-xl overflow-hidden mb-4">
                  {factRows.map(([label, val]) => (
                    <div key={label} className="flex gap-4 px-3 py-2">
                      <span className="text-stone-500 text-sm w-44 shrink-0">{label}</span>
                      <span className="text-stone-800 text-sm font-medium flex-1">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Pre-existing definition summary */}
                {preEx?.definition_summary && (
                  <p className="text-xs text-stone-400 italic mb-3">
                    Pre-existing definition: {preEx.definition_summary}
                  </p>
                )}

                {/* Exclusions */}
                {(facts.exclusions?.length ?? 0) > 0 && (
                  <ExclusionsToggle exclusions={facts.exclusions} />
                )}

                {/* Waiting period notes */}
                {wp?.notes && (
                  <p className="text-xs text-stone-400 italic mt-2">{wp.notes}</p>
                )}

                {/* Extraction notes */}
                {facts.extraction_notes && (
                  <p className="text-xs text-stone-400 italic mt-3">{facts.extraction_notes}</p>
                )}

                {/* Approve / Reject */}
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => handleApprove(row)}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(row)}
                    className="flex-1 border border-stone-300 text-stone-600 hover:bg-stone-50 font-semibold py-2.5 rounded-xl transition-colors text-sm"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })}
        </div>

      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
