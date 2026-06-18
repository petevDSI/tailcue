import { supabase } from '@/lib/supabase'

export type PricePageParams = {
  species: string
  procedure: string
  city: string
}

export type VetQuestion = {
  question: string
  listen_for: string
  why_it_matters: string
}

export type PricePageData = {
  procedure: {
    id: string
    slug: string
    display_name: string
    description_plain: string
    questions_to_ask: VetQuestion[]
  }
  metro: {
    metro_code: string
    display_name: string
    cost_multiplier: number
    tier: number
  }
  benchmarks: {
    p50: number
    p70: number
    p90: number
  }
  species: string
}

export function metroToSlug(displayName: string): string {
  const lastComma = displayName.lastIndexOf(', ')
  if (lastComma === -1) {
    return displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }
  const city = displayName.slice(0, lastComma)
  const state = displayName.slice(lastComma + 2)
  const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${citySlug}-${state.toLowerCase()}`
}

export async function getAllPricePageParams(): Promise<PricePageParams[]> {
  const [{ data: procedures }, { data: metros }] = await Promise.all([
    supabase.from('procedures').select('slug, species').eq('is_active', true),
    supabase.from('metros').select('display_name'),
  ])

  if (!procedures || !metros) return []

  const params: PricePageParams[] = []
  for (const proc of procedures) {
    const speciesList: string[] =
      proc.species === 'both' ? ['dog', 'cat'] : [proc.species as string]
    for (const metro of metros) {
      const citySlug = metroToSlug(metro.display_name)
      for (const species of speciesList) {
        params.push({ species, procedure: proc.slug, city: citySlug })
      }
    }
  }
  return params
}

export async function getPricePageData(
  species: string,
  procedureSlug: string,
  citySlug: string
): Promise<PricePageData | null> {
  const [{ data: procedure }, { data: metros }] = await Promise.all([
    supabase
      .from('procedures')
      .select('id, slug, display_name, description_plain, questions_to_ask')
      .eq('slug', procedureSlug)
      .eq('is_active', true)
      .maybeSingle(),
    supabase.from('metros').select('metro_code, display_name, cost_multiplier, tier'),
  ])

  if (!procedure || !metros) return null

  const metro = metros.find((m) => metroToSlug(m.display_name) === citySlug)
  if (!metro) return null

  const { data: benchmark } = await supabase
    .from('price_benchmarks')
    .select('p50_price, p70_price, p90_price')
    .eq('procedure_id', procedure.id)
    .eq('species', species)
    .eq('metro_code', 'NATIONAL')
    .maybeSingle()

  if (!benchmark) return null

  const multiplier = Number(metro.cost_multiplier)
  const adjust = (cents: number) => Math.round(((cents / 100) * multiplier) / 5) * 5

  return {
    procedure: {
      id: procedure.id,
      slug: procedure.slug,
      display_name: procedure.display_name,
      description_plain: procedure.description_plain ?? '',
      questions_to_ask: (procedure.questions_to_ask ?? []) as VetQuestion[],
    },
    metro: {
      metro_code: metro.metro_code,
      display_name: metro.display_name,
      cost_multiplier: multiplier,
      tier: Number(metro.tier),
    },
    benchmarks: {
      p50: adjust(benchmark.p50_price),
      p70: adjust(benchmark.p70_price),
      p90: adjust(benchmark.p90_price),
    },
    species,
  }
}
