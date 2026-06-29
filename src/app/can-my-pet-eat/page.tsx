import Link from 'next/link'
import { PawPrint } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Footer from '@/components/footer'

export const revalidate = 86400

type Row = {
  slug: string
  display_name: string
  species_scope: string
  category: string
}

const CATEGORY_LABELS: Record<string, string> = {
  generally_shared_small_amounts: 'Generally safe in small amounts',
  best_avoided: 'Best avoided',
  toxic_call_now: 'Toxic — call poison control',
}

const CATEGORY_ORDER = ['generally_shared_small_amounts', 'best_avoided', 'toxic_call_now']

export default async function FoodIndexPage() {
  const { data } = await supabase
    .from('food_toxin_entries')
    .select('slug, display_name, species_scope, category')
    .eq('active', true)
    .order('display_name')

  const rows = (data ?? []) as Row[]

  function forSpecies(species: 'dogs' | 'cats') {
    return rows.filter((r) => r.species_scope === species || r.species_scope === 'both')
  }

  function byCategory(rows: Row[], cat: string) {
    return rows.filter((r) => r.category === cat)
  }

  function Section({ species, label }: { species: 'dogs' | 'cats'; label: string }) {
    const entries = forSpecies(species)
    return (
      <div>
        <h2 className="mb-6 text-[22px] font-bold text-stone-900">{label}</h2>
        {CATEGORY_ORDER.map((cat) => {
          const items = byCategory(entries, cat)
          if (items.length === 0) return null
          return (
            <div key={cat} className="mb-8">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">
                {CATEGORY_LABELS[cat]}
              </h3>
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item.slug}>
                    <Link
                      href={`/can-my-pet-eat/${species}/${item.slug}`}
                      className="text-[15px] text-amber-700 hover:underline"
                    >
                      Can {species} eat {item.display_name}?
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-stone-50"
      style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}
    >
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500">
              <PawPrint className="h-5 w-5 text-white" />
            </div>
            <span className="text-[17px] font-bold tracking-tight text-stone-900">Tailcue</span>
          </Link>
          <Link
            href="/care"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-600"
          >
            Track your pet →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-3 text-[clamp(26px,3.5vw,36px)] font-black text-stone-900">
          Can my pet eat this?
        </h1>
        <p className="mb-12 text-[15px] text-stone-500 leading-relaxed max-w-xl">
          A plain-language guide to common foods — what&rsquo;s safe in small amounts, what to skip, and what&rsquo;s genuinely toxic. When in doubt, call ASPCA Poison Control (888) 426-4435.
        </p>

        <div className="grid grid-cols-1 gap-16 sm:grid-cols-2">
          <Section species="dogs" label="Dogs" />
          <Section species="cats" label="Cats" />
        </div>
      </main>

      <Footer disclaimer="Tailcue isn't a veterinarian and doesn't diagnose. When in doubt about anything your pet ate, the fastest expert help is ASPCA Animal Poison Control (888) 426-4435 or Pet Poison Helpline (855) 764-7661 — staffed by veterinary toxicologists 24/7. If your pet is showing severe symptoms (collapse, seizures, trouble breathing), go to the nearest emergency vet now." />
    </div>
  )
}
