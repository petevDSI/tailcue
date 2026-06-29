import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PawPrint, Phone } from 'lucide-react'
import { getAllFoodPageParams, getFoodPageData, type FoodEntry } from '@/lib/food-data'
import Footer from '@/components/footer'

export const revalidate = 86400

type PageParams = { species: string; food: string }

// Blog cross-links for contextually relevant toxic entries
const BLOG_CROSS_LINKS: Record<string, string> = {
  'grapes-raisins-dogs': '/blog/chronic-kidney-disease-in-dogs-guide',
  'xylitol-dogs': '/blog/canine-diabetes-newly-diagnosed-guide',
  'lilies-cats': '/blog/chronic-kidney-disease-in-cats-water-intake',
}

export async function generateStaticParams() {
  return getAllFoodPageParams()
}

export async function generateMetadata({ params }: { params: PageParams }) {
  const species = params.species as 'dogs' | 'cats'
  const entry = await getFoodPageData(species, params.food)
  if (!entry) return {}

  const speciesLabel = species === 'dogs' ? 'dogs' : 'cats'
  let description: string
  if (entry.category === 'toxic_call_now') {
    description = `No — ${entry.display_name} is toxic to ${speciesLabel}. ${entry.mechanism ?? ''} Find out what to do if your ${species === 'dogs' ? 'dog' : 'cat'} ate it.`.trim()
  } else if (entry.category === 'best_avoided') {
    description = `${entry.display_name} is best skipped for ${speciesLabel}. ${entry.mechanism ?? entry.notes ?? ''}`.trim()
  } else {
    description = `${entry.display_name} is generally safe for ${speciesLabel} in small amounts. ${entry.notes ?? ''}`.trim()
  }

  return {
    title: `Can ${speciesLabel} eat ${entry.display_name}? | Tailcue`,
    description: description.slice(0, 160),
  }
}

function HeroAnswer({ entry, species }: { entry: FoodEntry; species: 'dogs' | 'cats' }) {
  const singular = species === 'dogs' ? 'dog' : 'cat'
  if (entry.category === 'toxic_call_now') {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 px-6 py-5">
        <p className="text-lg font-bold text-red-900">
          No — {entry.display_name} is toxic to {species}.
        </p>
        {entry.any_amount_call_now && (
          <p className="mt-2 text-sm font-semibold text-red-800">
            There&rsquo;s no known safe amount — if your {singular} already ate any, treat it as an emergency.
          </p>
        )}
      </div>
    )
  }
  if (entry.category === 'best_avoided') {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-5">
        <p className="text-lg font-bold text-amber-900">Best skipped.</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-5">
      <p className="text-lg font-bold text-emerald-900">Generally yes, in small amounts.</p>
    </div>
  )
}

export default async function FoodPage({ params }: { params: PageParams }) {
  const species = params.species as 'dogs' | 'cats'
  if (species !== 'dogs' && species !== 'cats') notFound()

  const entry = await getFoodPageData(species, params.food)
  if (!entry) notFound()

  const singular = species === 'dogs' ? 'dog' : 'cat'
  const crossLinkKey = `${params.food}-${species}`
  const crossLinkHref = BLOG_CROSS_LINKS[crossLinkKey] ?? null

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
            href="/care"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-600"
          >
            Track your pet →
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-stone-100 bg-gradient-to-b from-amber-50 to-stone-50 px-6 py-12">
          <div className="mx-auto max-w-3xl">
            <p className="mb-3 text-sm text-stone-400">
              <Link href="/can-my-pet-eat" className="hover:underline">Foods &amp; {species}</Link>
              {' '}/ {entry.display_name}
            </p>
            <h1
              className="mb-6 font-black text-stone-900"
              style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', lineHeight: 1.15 }}
            >
              Can {species} eat {entry.display_name}?
            </h1>
            <HeroAnswer entry={entry} species={species} />
          </div>
        </section>

        <div className="mx-auto max-w-3xl space-y-10 px-6 py-12">

          {/* ── generally_shared_small_amounts ── */}
          {entry.category === 'generally_shared_small_amounts' && (
            <>
              {entry.notes && (
                <section>
                  <p className="text-[15px] leading-relaxed text-stone-600">{entry.notes}</p>
                </section>
              )}
              <section>
                <h2 className="mb-4 text-[18px] font-bold text-stone-900">A few rules to keep it safe</h2>
                <ul className="space-y-2 text-[15px] text-stone-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    Treats should be no more than 10% of your {singular}&rsquo;s daily calories.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    Serve plain — no seasoning, salt, sugar, butter, or oil.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    Cut into bite-size pieces to prevent choking.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    Introduce one new food at a time so you can spot any reaction.
                  </li>
                </ul>
                <p className="mt-4 text-[14px] text-stone-400">
                  Stop and check with your vet if it causes vomiting, diarrhea, or unusual behavior.
                </p>
              </section>
              {crossLinkHref && (
                <section>
                  <p className="text-[15px] text-stone-600">
                    <Link href={crossLinkHref} className="text-amber-700 hover:underline font-medium">
                      Read about managing your {singular}&rsquo;s chronic condition →
                    </Link>
                  </p>
                </section>
              )}
              <section className="rounded-2xl border border-stone-200 bg-white px-6 py-5">
                <p className="text-sm font-semibold text-stone-700 mb-1">Tracking a chronic condition?</p>
                <p className="text-sm text-stone-500 mb-3">
                  Tailcue Care helps you log symptoms, spot trends, and come to every vet visit prepared.
                </p>
                <Link
                  href="/care"
                  className="text-sm font-semibold text-amber-600 hover:text-amber-700 transition-colors"
                >
                  Start tracking free →
                </Link>
              </section>
            </>
          )}

          {/* ── best_avoided ── */}
          {entry.category === 'best_avoided' && (
            <>
              {entry.mechanism && (
                <section>
                  <h2 className="mb-3 text-[18px] font-bold text-stone-900">Why it&rsquo;s best skipped</h2>
                  <p className="text-[15px] leading-relaxed text-stone-600">{entry.mechanism}</p>
                </section>
              )}
              {entry.notes && (
                <section>
                  <p className="text-[15px] leading-relaxed text-stone-600">{entry.notes}</p>
                </section>
              )}
              <section className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4">
                <p className="text-[14px] text-stone-500 leading-relaxed">
                  This isn&rsquo;t usually an emergency, but if your {singular} ate a significant amount and seems unwell — vomiting, lethargy, or distress — contact your vet.
                </p>
              </section>
              <section className="rounded-2xl border border-stone-200 bg-white px-6 py-5">
                <p className="text-sm font-semibold text-stone-700 mb-1">Tracking a chronic condition?</p>
                <p className="text-sm text-stone-500 mb-3">
                  Tailcue Care helps you log symptoms, spot trends, and come to every vet visit prepared.
                </p>
                <Link
                  href="/care"
                  className="text-sm font-semibold text-amber-600 hover:text-amber-700 transition-colors"
                >
                  Start tracking free →
                </Link>
              </section>
            </>
          )}

          {/* ── toxic_call_now ── */}
          {entry.category === 'toxic_call_now' && (
            <>
              {entry.mechanism && (
                <section>
                  <h2 className="mb-3 text-[18px] font-bold text-stone-900">Why it&rsquo;s toxic</h2>
                  <p className="text-[15px] leading-relaxed text-stone-600">{entry.mechanism}</p>
                </section>
              )}
              {entry.signs && (
                <section>
                  <h2 className="mb-3 text-[18px] font-bold text-stone-900">Signs worth knowing</h2>
                  <p className="text-[15px] leading-relaxed text-stone-600">{entry.signs}</p>
                </section>
              )}
              {entry.notes && (
                <section>
                  <p className="text-[15px] leading-relaxed text-stone-500">{entry.notes}</p>
                </section>
              )}

              {/* Emergency routing block */}
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-4">
                <div>
                  <p className="text-base font-bold text-stone-900 mb-1">
                    Did your {singular} already eat this?
                  </p>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Call a veterinary toxicologist now. Both lines are staffed 24/7. A consult fee may apply (about $75–95).
                  </p>
                </div>
                <div className="space-y-3">
                  <a
                    href="tel:+18884264435"
                    className="flex items-center justify-center gap-2 w-full min-h-[52px] rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-colors"
                  >
                    <Phone className="w-4 h-4 shrink-0" />
                    ASPCA Animal Poison Control — (888) 426-4435
                  </a>
                  <a
                    href="tel:+18557647661"
                    className="flex items-center justify-center gap-2 w-full min-h-[52px] rounded-xl bg-stone-700 hover:bg-stone-800 text-white font-bold text-sm transition-colors"
                  >
                    <Phone className="w-4 h-4 shrink-0" />
                    Pet Poison Helpline — (855) 764-7661
                  </a>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Or use the{' '}
                  <Link href="/care" className="font-semibold text-amber-700 hover:underline">
                    Tailcue Care emergency tool
                  </Link>
                  {' '}to have your pet&rsquo;s details ready before you call.
                </p>
              </section>

              {crossLinkHref && (
                <section>
                  <p className="text-[15px] text-stone-600">
                    <Link href={crossLinkHref} className="text-amber-700 hover:underline font-medium">
                      Learn more about managing this condition in {species} →
                    </Link>
                  </p>
                </section>
              )}
            </>
          )}

          {/* Source */}
          <section className="border-t border-stone-200 pt-6">
            <p className="text-[13px] text-stone-400">
              Source:{' '}
              {entry.source_url ? (
                <a
                  href={entry.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline text-stone-500"
                >
                  {entry.source}
                </a>
              ) : (
                <span>{entry.source}</span>
              )}
            </p>
          </section>

        </div>
      </main>

      <Footer disclaimer="Tailcue isn't a veterinarian and doesn't diagnose. When in doubt about anything your pet ate, the fastest expert help is ASPCA Animal Poison Control (888) 426-4435 or Pet Poison Helpline (855) 764-7661 — staffed by veterinary toxicologists 24/7. If your pet is showing severe symptoms (collapse, seizures, trouble breathing), go to the nearest emergency vet now." />
    </div>
  )
}
