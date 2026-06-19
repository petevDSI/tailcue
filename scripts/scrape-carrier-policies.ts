/**
 * Firecrawl carrier policy pipeline — Phase 1 manual test runner
 *
 * Usage: npx tsx scripts/scrape-carrier-policies.ts
 *
 * Required env vars in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← Supabase dashboard → Settings → API → service_role
 *   FIRECRAWL_API_KEY           ← app.firecrawl.dev → API Keys
 *   ANTHROPIC_API_KEY           ← console.anthropic.com → API Keys
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { EXTRACTION_SCHEMA_DESCRIPTION, type ExtractedPolicyFacts } from '../src/lib/policy-extraction-schema'

// ── Validate required env vars ────────────────────────────────────────────

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FIRECRAWL_API_KEY',
  'ANTHROPIC_API_KEY',
] as const

for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`)
    console.error('Add it to .env.local and retry.')
    process.exit(1)
  }
}

// ── Clients ───────────────────────────────────────────────────────────────

// Service role key bypasses RLS — required for inserting into admin-only tables
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Types ─────────────────────────────────────────────────────────────────

type Source = {
  id: string
  carrier_id: string
  policy_type: string
  source_url: string
  source_format: string
  carrier_slug: string
  carrier_display_name: string
}

type DiffSummary = Record<string, { old: unknown; new: unknown }> | { first_scrape: true }

// ── Firecrawl ─────────────────────────────────────────────────────────────

async function scrapeUrl(url: string): Promise<string> {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, formats: ['markdown'] }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Firecrawl HTTP ${res.status}: ${body.slice(0, 200)}`)
  }

  const json = await res.json()
  if (!json.success) {
    throw new Error(`Firecrawl returned success=false: ${JSON.stringify(json).slice(0, 200)}`)
  }

  const content: string = json.data?.markdown ?? json.data?.content ?? ''
  if (!content) throw new Error('Firecrawl returned empty content')
  return content
}

// ── Claude extraction ─────────────────────────────────────────────────────

async function extractFacts(rawContent: string): Promise<ExtractedPolicyFacts> {
  // 20k covers most PDFs in full and gets further into long HTML pages.
  // Embrace's 40k state-terms page still needs a PDF source swap to fully solve.
  const LIMIT = 20_000
  const truncated = rawContent.slice(0, LIMIT)

  const systemPrompt = `You are extracting structured facts from a pet insurance policy document for a comparison database. Extract ONLY the facts requested in the schema below. Paraphrase exclusions and definitions in your own words — do not copy verbatim sentences from the source document, as this is copyrighted material. If a fact isn't clearly stated in the document, use null and lower the extraction_confidence. Respond with ONLY valid JSON matching this exact schema, no markdown formatting, no preamble:

${EXTRACTION_SCHEMA_DESCRIPTION}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: truncated }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  // Strip markdown code fences if Claude wraps in them despite instructions
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

  return JSON.parse(cleaned) as ExtractedPolicyFacts
}

// ── Diff ──────────────────────────────────────────────────────────────────

async function computeDiff(
  carrierId: string,
  policyType: string,
  newFacts: ExtractedPolicyFacts
): Promise<DiffSummary> {
  const { data: existing } = await supabase
    .from('carrier_policy_facts')
    .select('facts')
    .eq('carrier_id', carrierId)
    .eq('policy_type', policyType)
    .maybeSingle()

  if (!existing) return { first_scrape: true }

  const oldFacts = existing.facts as Record<string, unknown>
  const newFactsRaw = newFacts as unknown as Record<string, unknown>
  const changes: Record<string, { old: unknown; new: unknown }> = {}

  for (const key of Object.keys(newFactsRaw)) {
    const oldVal = JSON.stringify(oldFacts[key] ?? null)
    const newVal = JSON.stringify(newFactsRaw[key] ?? null)
    if (oldVal !== newVal) {
      changes[key] = { old: oldFacts[key] ?? null, new: newFactsRaw[key] ?? null }
    }
  }

  return changes
}

// ── Main loop ─────────────────────────────────────────────────────────────

async function main() {
  const { data: sources, error } = await supabase
    .from('carrier_policy_sources')
    .select(`
      id,
      carrier_id,
      policy_type,
      source_url,
      source_format,
      insurance_carriers!inner (
        slug,
        display_name
      )
    `)
    .eq('is_active', true)

  if (error) {
    console.error('Failed to load sources:', error.message)
    process.exit(1)
  }

  // Flatten the nested join
  const rows: Source[] = (sources ?? []).map((s: Record<string, unknown>) => {
    const ic = s['insurance_carriers'] as { slug: string; display_name: string }
    return {
      id: s.id as string,
      carrier_id: s.carrier_id as string,
      policy_type: s.policy_type as string,
      source_url: s.source_url as string,
      source_format: s.source_format as string,
      carrier_slug: ic.slug,
      carrier_display_name: ic.display_name,
    }
  })

  console.log(`\nFound ${rows.length} active sources. Starting scrape run...\n`)

  const results: { label: string; status: 'ok' | 'error'; detail: string; facts?: ExtractedPolicyFacts }[] = []

  for (const source of rows) {
    const label = `${source.carrier_display_name} — ${source.policy_type}`

    try {
      // 1. Scrape
      console.log(`  Scraping ${label}...`)
      const rawContent = await scrapeUrl(source.source_url)

      // 2. Extract
      console.log(`  Extracting facts from ${label}...`)
      const extractedFacts = await extractFacts(rawContent)

      // 3. Diff
      const diffSummary = await computeDiff(source.carrier_id, source.policy_type, extractedFacts)
      const changedFields = 'first_scrape' in diffSummary ? null : Object.keys(diffSummary)
      const diffDetail = 'first_scrape' in diffSummary
        ? 'first scrape'
        : `${changedFields!.length} field${changedFields!.length !== 1 ? 's' : ''} changed`

      // 4. Store
      const { error: insertError } = await supabase
        .from('carrier_policy_scrapes')
        .insert({
          source_id: source.id,
          raw_content: rawContent,
          extracted_facts: extractedFacts,
          diff_summary: diffSummary,
          status: 'pending_review',
        })

      if (insertError) throw new Error(`DB insert failed: ${insertError.message}`)

      results.push({ label, status: 'ok', detail: diffDetail, facts: extractedFacts })
      console.log(`  ✅ ${label} — stored (${diffDetail})`)

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      // Store error record so we have a trace
      await supabase.from('carrier_policy_scrapes').insert({
        source_id: source.id,
        raw_content: null,
        extracted_facts: null,
        diff_summary: null,
        status: 'rejected',
        error_message: message,
      })

      results.push({ label, status: 'error', detail: message })
      console.log(`  ❌ ${label} — ${message}`)
    }

    // Rate-limit buffer between carriers
    await new Promise((r) => setTimeout(r, 2000))
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  const succeeded = results.filter((r) => r.status === 'ok')
  const failed = results.filter((r) => r.status === 'error')

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Run complete: ${succeeded.length} succeeded, ${failed.length} failed`)
  console.log(`${'─'.repeat(60)}\n`)

  for (const r of results) {
    const icon = r.status === 'ok' ? '✅' : '❌'
    console.log(`${icon} ${r.label} — ${r.detail}`)
  }

  // Print extracted_facts for first 3 successes so caller can sanity-check
  const sample = succeeded.slice(0, 3)
  if (sample.length > 0) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log('Sample extracted_facts (first 3 successes):')
    console.log(`${'─'.repeat(60)}\n`)
    for (const r of sample) {
      console.log(`── ${r.label} ──`)
      console.log(JSON.stringify(r.facts, null, 2))
      console.log()
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
