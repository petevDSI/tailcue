import Link from 'next/link'
import { PawPrint, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import Footer from '@/components/footer'

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    emoji: '📊',
    title: 'Price Check',
    description: 'See if your vet quote is fair',
    detail:
      'Get an instant verdict — fair, high, or above market — based on real price data for your metro area. Includes questions to ask your vet.',
    cta: 'Check a Quote',
    href: '/checker',
    active: true,
    accent: 'border-amber-400',
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
  },
  {
    emoji: '🛡️',
    title: 'Insurance Calculator',
    description: 'Find out what pet insurance actually pays',
    detail:
      'Enter your deductible, reimbursement rate, and carrier. See your estimated out-of-pocket cost before agreeing to any procedure.',
    cta: 'Calculate Coverage',
    href: '/insurance',
    active: true,
    accent: 'border-blue-400',
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-600',
  },
  {
    emoji: '🩺',
    title: 'Care',
    description: 'Track your pet\'s chronic condition',
    detail:
      'Log symptoms, medications, and vet visits in one place — so every appointment starts with the full picture.',
    cta: null,
    href: null,
    active: false,
    accent: 'border-stone-200',
    iconBg: 'bg-stone-100',
    iconText: 'text-stone-400',
  },
] as const

// ---------------------------------------------------------------------------
// Page (server component)
// ---------------------------------------------------------------------------

export default function HomePage() {
  return (
    <div className="min-h-screen bg-stone-50" style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500">
              <PawPrint className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-[17px] font-bold tracking-tight text-stone-900">Tailcue</span>
              <span className="ml-2 hidden text-sm text-stone-400 sm:inline">Smart tools for pet owners</span>
            </div>
          </div>
          <Link
            href="/checker"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-600"
          >
            Check a Quote →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-stone-100 bg-gradient-to-b from-amber-50 to-stone-50 px-6 py-16 text-center">
        <div className="mx-auto max-w-xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-800">
            Independent · Pet-Owner Side · Free Forever
          </div>
          <h1 className="mb-4 text-[clamp(28px,5vw,44px)] font-extrabold leading-tight tracking-tight text-stone-900">
            Smart tools for pet owners
          </h1>
          <p className="mx-auto max-w-md text-base leading-relaxed text-stone-500">
            Understand vet pricing, estimate what insurance really pays, and make confident decisions for your pet.
          </p>
        </div>
      </section>

      {/* Tool cards */}
      <main className="mx-auto max-w-5xl px-6 py-14">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {TOOLS.map((tool) => {
            const cardInner = (
              <Card
                className={`h-full overflow-hidden rounded-2xl border-t-4 shadow-sm transition-shadow ${tool.accent} ${
                  tool.active
                    ? 'border border-stone-200 hover:shadow-md'
                    : 'border border-stone-200 opacity-60'
                }`}
              >
                <CardContent className="flex h-full flex-col p-7">
                  {/* Icon */}
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${tool.iconBg}`}>
                    {tool.emoji}
                  </div>

                  {/* Coming soon badge */}
                  {!tool.active && (
                    <span className="mb-3 inline-flex w-fit items-center rounded-full bg-stone-200 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                      Coming Soon
                    </span>
                  )}

                  {/* Text */}
                  <h2 className="mb-1 text-[17px] font-bold text-stone-900">{tool.title}</h2>
                  <p className="mb-3 text-sm font-medium text-stone-500">{tool.description}</p>
                  <p className="mb-6 flex-1 text-sm leading-relaxed text-stone-400">{tool.detail}</p>

                  {/* CTA */}
                  {tool.active && tool.cta ? (
                    <div className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-amber-600">
                      {tool.cta}
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="mt-auto text-sm text-stone-300">Available soon</div>
                  )}
                </CardContent>
              </Card>
            )

            return tool.active && tool.href ? (
              <Link key={tool.title} href={tool.href} className="block">
                {cardInner}
              </Link>
            ) : (
              <div key={tool.title} className="cursor-default">
                {cardInner}
              </div>
            )
          })}
        </div>
      </main>

      <Footer />

    </div>
  )
}
