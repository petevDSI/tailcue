import { supabase } from '@/lib/supabase'

export type FoodPageParams = { species: string; food: string }

export type FoodEntry = {
  slug: string
  display_name: string
  species_scope: 'dogs' | 'cats' | 'both'
  category: 'generally_shared_small_amounts' | 'best_avoided' | 'toxic_call_now'
  any_amount_call_now: boolean
  mechanism: string | null
  signs: string | null
  notes: string | null
  source: string
  source_url: string | null
}

export async function getAllFoodPageParams(): Promise<FoodPageParams[]> {
  const { data } = await supabase
    .from('food_toxin_entries')
    .select('slug, species_scope')
    .eq('active', true)

  if (!data) return []

  const params: FoodPageParams[] = []
  for (const row of data as { slug: string; species_scope: string }[]) {
    if (row.species_scope === 'both') {
      params.push({ species: 'dogs', food: row.slug })
      params.push({ species: 'cats', food: row.slug })
    } else {
      params.push({ species: row.species_scope as string, food: row.slug })
    }
  }
  return params
}

export async function getFoodPageData(
  species: 'dogs' | 'cats',
  foodSlug: string
): Promise<FoodEntry | null> {
  const { data } = await supabase
    .from('food_toxin_entries')
    .select('slug, display_name, species_scope, category, any_amount_call_now, mechanism, signs, notes, source, source_url')
    .eq('slug', foodSlug)
    .eq('active', true)
    .or(`species_scope.eq.${species},species_scope.eq.both`)
    .maybeSingle()

  if (!data) return null
  return data as FoodEntry
}
