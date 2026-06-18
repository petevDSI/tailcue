import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { PROCEDURES, METROS, NATIONAL_BENCHMARKS } from '../src/lib/seed-data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function main() {
  // -------------------------------------------------------------------------
  // 1. Procedures
  // -------------------------------------------------------------------------
  console.log('Seeding procedures…')
  const { error: procError } = await supabase
    .from('procedures')
    .upsert(
      PROCEDURES.map((p) => ({
        slug: p.slug,
        display_name: p.display_name,
        clinical_name: p.clinical_name ?? null,
        category: p.category,
        species: p.species,
        description_plain: p.description_plain,
        questions_to_ask: p.questions_to_ask,
        sort_order: p.sort_order,
        is_active: p.is_active,
      })),
      { onConflict: 'slug' }
    )

  if (procError) {
    console.error('procedures error:', procError.message)
    process.exit(1)
  }

  // Fetch back slug → uuid map
  const { data: dbProcedures, error: fetchError } = await supabase
    .from('procedures')
    .select('id, slug')

  if (fetchError || !dbProcedures) {
    console.error('fetch procedures error:', fetchError?.message)
    process.exit(1)
  }

  const slugToId = Object.fromEntries(dbProcedures.map((p) => [p.slug, p.id]))
  console.log(`  ${dbProcedures.length} procedures in DB`)

  // -------------------------------------------------------------------------
  // 2. Metros
  // -------------------------------------------------------------------------
  console.log('Seeding metros…')
  const { error: metroError } = await supabase
    .from('metros')
    .upsert(
      METROS.map((m) => ({
        metro_code: m.metro_code,
        display_name: m.display_name,
        zip_prefixes: m.zip_prefixes,
        cost_multiplier: m.cost_multiplier,
        tier: m.tier,
      })),
      { onConflict: 'metro_code' }
    )

  if (metroError) {
    console.error('metros error:', metroError.message)
    process.exit(1)
  }

  const { count: metroCount } = await supabase
    .from('metros')
    .select('*', { count: 'exact', head: true })

  console.log(`  ${metroCount} metros in DB`)

  // -------------------------------------------------------------------------
  // 3. National price benchmarks (prices in dollars → multiply by 100 for cents)
  // -------------------------------------------------------------------------
  console.log('Seeding national price benchmarks…')

  const benchmarkRows: {
    procedure_id: string
    metro_code: string
    species: string
    p50_price: number
    p70_price: number
    p90_price: number
    data_year: number
    source_notes: string
  }[] = []

  for (const [slug, speciesMap] of Object.entries(NATIONAL_BENCHMARKS)) {
    const procedureId = slugToId[slug]
    if (!procedureId) {
      console.warn(`  WARNING: No DB procedure found for slug "${slug}" — skipping`)
      continue
    }

    for (const [species, prices] of Object.entries(speciesMap)) {
      if (!prices) continue
      benchmarkRows.push({
        procedure_id: procedureId,
        metro_code: 'NATIONAL',
        species,
        p50_price: Math.round(prices.p50 * 100),
        p70_price: Math.round(prices.p70 * 100),
        p90_price: Math.round(prices.p90 * 100),
        data_year: 2025,
        source_notes: 'NAPHIA SOI 2025 / Pawlicy Research 2024-25 / AVMA PFCE',
      })
    }
  }

  // Upsert in batches of 50 to stay within request limits
  const BATCH = 50
  for (let i = 0; i < benchmarkRows.length; i += BATCH) {
    const batch = benchmarkRows.slice(i, i + BATCH)
    const { error: benchError } = await supabase
      .from('price_benchmarks')
      .upsert(batch, { onConflict: 'procedure_id,metro_code,species' })

    if (benchError) {
      console.error(`price_benchmarks batch ${i / BATCH + 1} error:`, benchError.message)
      process.exit(1)
    }
  }

  const { count: benchCount } = await supabase
    .from('price_benchmarks')
    .select('*', { count: 'exact', head: true })

  console.log(`  ${benchCount} price_benchmark rows in DB`)

  // -------------------------------------------------------------------------
  // 4. Final row counts
  // -------------------------------------------------------------------------
  const [{ count: pCount }, { count: mCount }, { count: bCount }, { count: qCount }] =
    await Promise.all([
      supabase.from('procedures').select('*', { count: 'exact', head: true }),
      supabase.from('metros').select('*', { count: 'exact', head: true }),
      supabase.from('price_benchmarks').select('*', { count: 'exact', head: true }),
      supabase.from('quote_submissions').select('*', { count: 'exact', head: true }),
    ])

  console.log('\n=== Final row counts ===')
  console.log(`  procedures:       ${pCount}`)
  console.log(`  metros:           ${mCount}`)
  console.log(`  price_benchmarks: ${bCount}`)
  console.log(`  quote_submissions:${qCount}`)
  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
