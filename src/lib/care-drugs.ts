import { getSupabaseBrowser } from './supabase-browser'

export interface DrugReference {
  name: string
  brandNames?: string
  conditions: string[]
  speciesScope: 'dogs' | 'cats' | 'both'
  commonStrengths: string[]
  commonRoute?: string
  note?: string
}

export async function getDrugReference(): Promise<DrugReference[]> {
  const supabase = getSupabaseBrowser()
  const { data, error } = await supabase
    .from('care_drug_reference')
    .select('name, brand_names, conditions, species_scope, common_strengths, common_route, note')
    .eq('active', true)
    .order('sort_order')
  if (error) {
    console.error('getDrugReference:', error)
    return []
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    name: r.name as string,
    brandNames: r.brand_names as string | undefined,
    conditions: (r.conditions ?? []) as string[],
    speciesScope: r.species_scope as 'dogs' | 'cats' | 'both',
    commonStrengths: (r.common_strengths ?? []) as string[],
    commonRoute: r.common_route as string | undefined,
    note: r.note as string | undefined,
  }))
}
