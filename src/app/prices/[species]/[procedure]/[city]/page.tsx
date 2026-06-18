import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PawPrint } from 'lucide-react'
import { getAllPricePageParams, getPricePageData } from '@/lib/prices-data'
import Footer from '@/components/footer'

export const revalidate = 86400

type PageParams = {
  species: string
  procedure: string
  city: string
}

// Tier 1 metros for related city links
const TIER1_METROS = [
  { display: 'New York, NY', slug: 'new-york-ny' },
  { display: 'Los Angeles, CA', slug: 'los-angeles-ca' },
  { display: 'Chicago, IL', slug: 'chicago-il' },
  { display: 'San Francisco / Bay Area, CA', slug: 'san-francisco-bay-area-ca' },
  { display: 'Seattle, WA', slug: 'seattle-wa' },
  { display: 'Boston, MA', slug: 'boston-ma' },
  { display: 'Washington, DC', slug: 'washington-dc' },
  { display: 'Miami, FL', slug: 'miami-fl' },
  { display: 'Denver, CO', slug: 'denver-co' },
  { display: 'San Diego, CA', slug: 'san-diego-ca' },
]

export async function generateStaticParams() {
  return getAllPricePageParams()
}

export async function generateMetadata({ params }: { params: PageParams }) {
  const data = await getPricePageData(params.species, params.procedure, params.city)
  if (!data) return {}

  const speciesLabel = data.species === 'dog' ? 'Dog' : 'Cat'
  const lastComma = data.metro.display_name.lastIndexOf(', ')
  const cityName = lastComma !== -1 ? data.metro.display_name.slice(0, lastComma) : data.metro.display_name
  const stateCode = lastComma !== -1 ? data.metro.display_name.slice(lastComma + 2) : ''
  const locationStr = stateCode ? `${cityName}, ${stateCode}` : cityName

  return {
    title: `${speciesLabel} ${data.procedure.display_name} Cost in ${locationStr} | Tailcue`,
    description: `How much does ${data.species} ${data.procedure.display_name.toLowerCase()} cost in ${locationStr}? See what pet owners actually pay — median $${data.benchmarks.p50.toLocaleString()}, typical range $${data.benchmarks.p50.toLocaleString()}–$${data.benchmarks.p70.toLocaleString()}. Check if your quote is fair in 30 seconds.`,
  }
}

function getCostLevelText(cityName: string, multiplier: number): string {
  const pct = Math.round(Math.abs(multiplier - 1) * 100)
  if (multiplier >= 1.20) {
    return `${cityName} veterinary practices operate in a higher cost-of-living market, with vet prices running roughly ${pct}% above the national average. Expect to pay more than in smaller cities.`
  }
  if (multiplier <= 0.90) {
    return `${cityName} is a more affordable veterinary market, with prices running roughly ${pct}% below the national average. You may find more competitive quotes here than in major metro areas.`
  }
  const direction = multiplier > 1 ? `about ${pct}% above` : 'near'
  return `${cityName} veterinary prices are ${direction} the national average, reflecting a mid-range cost-of-living market. Prices here are broadly in line with what most pet owners across the country pay.`
}

export default async function PricePage({ params }: { params: PageParams }) {
  const data = await getPricePageData(params.species, params.procedure, params.city)
  if (!data) notFound()

  const { procedure, metro, benchmarks, species } = data
  const speciesLabel = species === 'dog' ? 'Dog' : 'Cat'
  const speciesLower = species

  const lastComma = metro.display_name.lastIndexOf(', ')
  const cityName = lastComma !== -1 ? metro.display_name.slice(0, lastComma) : metro.display_name
  const stateCode = lastComma !== -1 ? metro.display_name.slice(lastComma + 2) : ''
  const locationStr = stateCode ? `${cityName}, ${stateCode}` : cityName

  const currentMonthYear = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const checkerUrl = `/checker?procedure=${procedure.slug}&species=${species}`

  const relatedCities = TIER1_METROS.filter((m) => m.slug !== params.city).slice(0, 6)

  const questions = procedure.questions_to_ask.slice(0, 3)

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
            href={checkerUrl}
            className="inline-flex min-h-[44px] items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-600"
          >
            Check a Quote →
          </Link>
        </div>
      </header>

      <main>
        {/* Section 1 — Hero */}
        <section className="border-b border-stone-100 bg-gradient-to-b from-amber-50 to-stone-50 px-6 py-14">
          <div className="mx-auto max-w-3xl text-center">
            <h1
              className="mb-4 font-black text-stone-900"
              style={{ fontSize: 'clamp(28px, 4vw, 46px)', lineHeight: 1.1 }}
            >
              How Much Does {speciesLabel} {procedure.display_name} Cost in {locationStr}?
            </h1>
            <p className="mb-10 text-[16px] text-stone-500">
              Based on {cityName} veterinary pricing data. Updated {currentMonthYear}.
            </p>

            {/* Price stat boxes */}
            <div className="mx-auto mb-10 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Typical Low — p50 */}
              <div
                className="rounded-xl border border-stone-200 bg-white p-5 text-center shadow-sm"
                style={{ borderRadius: '12px' }}
              >
                <p
                  className="text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: '#A8A29E' }}
                >
                  50th percentile
                </p>
                <p
                  className="mt-2 font-bold"
                  style={{ fontSize: '32px', color: '#1C1917' }}
                >
                  ${benchmarks.p50.toLocaleString()}
                </p>
                <p className="mt-1 text-sm font-medium text-stone-500">Typical Low</p>
              </div>

              {/* Above Average — p70 (amber highlight) */}
              <div
                className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5 text-center shadow-sm"
                style={{ borderRadius: '12px' }}
              >
                <p
                  className="text-[11px] font-semibold uppercase tracking-widest text-amber-600"
                >
                  70th percentile
                </p>
                <p
                  className="mt-2 font-bold text-amber-700"
                  style={{ fontSize: '32px' }}
                >
                  ${benchmarks.p70.toLocaleString()}
                </p>
                <p className="mt-1 text-sm font-medium text-amber-700">Above Average</p>
              </div>

              {/* High End — p90 */}
              <div
                className="rounded-xl border border-stone-200 bg-white p-5 text-center shadow-sm"
                style={{ borderRadius: '12px' }}
              >
                <p
                  className="text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: '#A8A29E' }}
                >
                  90th percentile
                </p>
                <p
                  className="mt-2 font-bold"
                  style={{ fontSize: '32px', color: '#1C1917' }}
                >
                  ${benchmarks.p90.toLocaleString()}
                </p>
                <p className="mt-1 text-sm font-medium text-stone-500">High End</p>
              </div>
            </div>

            <Link
              href={checkerUrl}
              className="inline-flex min-h-[52px] items-center rounded-xl bg-amber-500 px-8 text-base font-bold text-stone-900 transition-colors hover:bg-amber-600"
            >
              Check My Quote in {cityName} →
            </Link>
          </div>
        </section>

        <div className="mx-auto max-w-3xl space-y-16 px-6 py-16">

          {/* Section 2 — What affects cost */}
          <section>
            <h2 className="mb-5 text-[22px] font-bold text-stone-900">
              What Affects {procedure.display_name} Costs in {cityName}?
            </h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-stone-600">
              <p>{getCostLevelText(cityName, metro.cost_multiplier)}</p>
              <p>{procedure.description_plain}</p>
            </div>
          </section>

          {/* Section 3 — About this procedure */}
          <section>
            <h2 className="mb-5 text-[22px] font-bold text-stone-900">
              What Is {procedure.display_name}?
            </h2>
            <p className="mb-6 text-[15px] leading-relaxed text-stone-600">
              {procedure.description_plain}
            </p>
            {questions.length > 0 && (
              <>
                <h3 className="mb-4 text-[15px] font-semibold text-stone-800">
                  Questions to ask your vet before agreeing to a price:
                </h3>
                <ul className="space-y-2">
                  {questions.map((q, i) => (
                    <li key={i} className="flex items-start gap-2 text-[15px] text-stone-600">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
                        {i + 1}
                      </span>
                      {q.question}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Section 4 — CTA strip */}
          <section className="-mx-6 rounded-2xl bg-amber-50 px-8 py-10 text-center sm:mx-0">
            <h2 className="mb-2 text-[22px] font-bold text-stone-900">
              Is your {cityName} vet quote fair?
            </h2>
            <p className="mb-6 text-[15px] text-stone-500">
              Enter your actual quote and get an instant verdict — fair, high, or above market.
            </p>
            <Link
              href={checkerUrl}
              className="inline-flex min-h-[52px] items-center rounded-xl bg-amber-500 px-8 text-base font-bold text-stone-900 transition-colors hover:bg-amber-600"
            >
              Check My Quote Free →
            </Link>
          </section>

          {/* Section 5 — Related searches */}
          <section>
            <h2 className="mb-5 text-[22px] font-bold text-stone-900">
              Compare {procedure.display_name} Prices by City
            </h2>
            <ul className="space-y-2">
              {relatedCities.map((city) => (
                <li key={city.slug}>
                  <Link
                    href={`/prices/${speciesLower}/${procedure.slug}/${city.slug}`}
                    className="text-[15px] text-amber-700 hover:underline"
                  >
                    {procedure.display_name} Cost in {city.display}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[15px]">
              <Link
                href={`/prices/${speciesLower}/${params.city}`}
                className="text-stone-500 hover:text-stone-700 hover:underline"
              >
                Compare other {speciesLabel.toLowerCase()} procedures in {cityName} →
              </Link>
            </p>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  )
}
