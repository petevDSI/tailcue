import Link from 'next/link'
import { PawPrint, ArrowRight } from 'lucide-react'
import Footer from '@/components/footer'

const TOOLS = [
  {
    emoji: '📊',
    title: 'Price Check',
    description: "Is your vet quote fair?",
    cta: 'Check a Quote',
    href: '/checker',
    accentBorder: 'border-t-amber-500',
    iconBg: 'bg-amber-50',
    iconRing: 'ring-amber-200',
    ctaColor: 'text-amber-600',
  },
  {
    emoji: '🛡️',
    title: 'Insurance',
    description: 'What will insurance actually pay?',
    cta: 'Calculate Coverage',
    href: '/insurance',
    accentBorder: 'border-t-blue-400',
    iconBg: 'bg-blue-50',
    iconRing: 'ring-blue-200',
    ctaColor: 'text-blue-600',
  },
  {
    emoji: '🩺',
    title: 'Care',
    description: "Track your pet's chronic condition",
    cta: 'Open Care',
    href: '/care',
    accentBorder: 'border-t-green-500',
    iconBg: 'bg-green-50',
    iconRing: 'ring-green-200',
    ctaColor: 'text-green-600',
  },
] as const

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FFFBF0]" style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500">
              <PawPrint className="h-5 w-5 text-white" />
            </div>
            <span className="text-[17px] font-bold tracking-tight text-stone-900">Tailcue</span>
          </div>
          <span className="hidden text-sm text-stone-400 sm:block">Smart tools for pet owners</span>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-12 text-center bg-gradient-to-b from-[#FEF3C7] to-[#FFFBF0] border-b border-stone-100">
        <div className="mx-auto max-w-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-800">
            Independent · Pet-Owner Side · Free Forever
          </div>
          <h1 className="mb-3 text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight text-stone-900">
            Smart tools for<br className="sm:hidden" /> pet owners
          </h1>
          <p className="text-base text-stone-600 leading-relaxed max-w-sm mx-auto">
            Understand vet pricing, see what insurance pays, and track your pet&apos;s chronic condition at home.
          </p>
          <p className="mt-4 text-sm text-stone-500">
            Questions, or want to work together?{' '}
            <Link href="/contact" className="font-semibold text-amber-600 hover:text-amber-700 hover:underline">
              Get in touch →
            </Link>
          </p>
        </div>
      </section>

      {/* Tool cards */}
      <main className="mx-auto max-w-5xl px-5 py-10 pb-28 sm:pb-14">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {TOOLS.map((tool) => (
            <Link
              key={tool.title}
              href={tool.href}
              className={`group block bg-white rounded-2xl border border-stone-200 border-t-4 ${tool.accentBorder}
                shadow-sm hover:shadow-md transition-shadow overflow-hidden`}
            >
              {/* Mobile: horizontal layout */}
              <div className="flex items-center gap-4 p-5 sm:hidden">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl
                  ${tool.iconBg} ring-2 ${tool.iconRing}`}>
                  {tool.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-stone-900 mb-0.5">{tool.title}</p>
                  <p className="text-sm text-stone-500 leading-snug">{tool.description}</p>
                </div>
                <ArrowRight className={`w-5 h-5 shrink-0 ${tool.ctaColor} transition-transform group-hover:translate-x-0.5`} />
              </div>

              {/* Desktop: vertical layout */}
              <div className="hidden sm:flex flex-col p-7 h-full">
                <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-3xl
                  ${tool.iconBg} ring-2 ${tool.iconRing}`}>
                  {tool.emoji}
                </div>
                <h2 className="mb-1 text-[17px] font-bold text-stone-900">{tool.title}</h2>
                <p className="mb-5 flex-1 text-sm leading-relaxed text-stone-500">{tool.description}</p>
                <div className={`mt-auto flex items-center gap-1.5 text-sm font-semibold ${tool.ctaColor}`}>
                  {tool.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Trust bar */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {[
            '✓ No account needed',
            '✓ No ads',
            '✓ Built for pet owners',
          ].map((item) => (
            <span key={item} className="text-xs text-stone-400 font-medium">{item}</span>
          ))}
        </div>
      </main>

      <Footer />

      <p className="hidden">Impact-Site-Verification: c70378e1-1a47-4272-bc9c-111038e5d25c</p>

    </div>
  )
}
