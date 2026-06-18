import Link from 'next/link'
import { PROCEDURES } from '@/lib/seed-data'

// ---------------------------------------------------------------------------
// Category display config
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  wellness: 'Wellness',
  diagnostics: 'Diagnostics',
  surgical_routine: 'Routine Surgery',
  surgical_common: 'Common Surgery',
  emergency: 'Emergency',
  skin_ear_eye: 'Skin / Ear / Eye',
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  wellness:         { bg: '#dcfce7', text: '#15803d' },
  diagnostics:      { bg: '#dbeafe', text: '#1d4ed8' },
  surgical_routine: { bg: '#ede9fe', text: '#7c3aed' },
  surgical_common:  { bg: '#ffedd5', text: '#c2410c' },
  emergency:        { bg: '#fee2e2', text: '#dc2626' },
  skin_ear_eye:     { bg: '#ccfbf1', text: '#0f766e' },
}

// ---------------------------------------------------------------------------
// Page (server component — no 'use client')
// ---------------------------------------------------------------------------

export default function HomePage() {
  return (
    <div style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif', background: '#FAFAF9', margin: 0 }}>

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <header style={{ background: '#fff', borderBottom: '1px solid #E7E5E4' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: '#F59E0B', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              🐾
            </div>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#1C1917', letterSpacing: '-0.3px' }}>VetQuoteCheck</span>
          </div>
          <Link
            href="/checker"
            style={{ background: '#F59E0B', color: '#1C1917', fontWeight: 700, padding: '9px 20px', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}
          >
            Check a Quote →
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section style={{ background: 'linear-gradient(160deg, #fffbeb 0%, #fef3c7 50%, #fafaf9 100%)', padding: '80px 24px 72px', textAlign: 'center' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {/* Trust badge */}
          <div style={{ display: 'inline-block', background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 999, padding: '6px 18px', fontSize: 13, fontWeight: 600, marginBottom: 32 }}>
            Independent · Pet-Owner Side · Free Forever
          </div>

          <h1 style={{ fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 900, color: '#1C1917', letterSpacing: '-1.5px', lineHeight: 1.08, margin: '0 0 4px' }}>
            Know if your vet quote is fair.
          </h1>
          <p style={{ fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 900, color: '#F59E0B', letterSpacing: '-1.5px', lineHeight: 1.08, margin: '0 0 28px' }}>
            before you say yes.
          </p>

          <p style={{ fontSize: 18, color: '#44403C', maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.65 }}>
            Enter your quote, ZIP code, and procedure. Get an instant plain-English verdict —
            fair, high, or above market — and the questions to ask your vet.
          </p>

          <Link
            href="/checker"
            style={{ display: 'inline-block', background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: '#1C1917', fontWeight: 700, fontSize: 17, padding: '16px 40px', borderRadius: 12, textDecoration: 'none', boxShadow: '0 4px 14px rgba(245,158,11,0.4)' }}
          >
            Check My Vet Quote →
          </Link>

          <p style={{ marginTop: 14, fontSize: 13, color: '#9ca3af' }}>
            Free. No account required. Takes 30 seconds.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Trust bar                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section style={{ background: '#fff', borderTop: '1px solid #E7E5E4', borderBottom: '1px solid #E7E5E4', padding: '20px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {[
            { icon: '🐾', text: 'Independent — not affiliated with any vet practice' },
            { icon: '📊', text: 'Based on NAPHIA claims data & published benchmarks' },
            { icon: '🚫', text: 'No ads. No pet insurance company funding.' },
            { icon: '✓',  text: '35 procedures covered' },
          ].map(({ icon, text }) => (
            <div
              key={text}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', border: '1px solid #E7E5E4', borderRadius: 999, padding: '8px 16px', fontSize: 13, color: '#44403C', fontWeight: 500 }}
            >
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How it works                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section style={{ padding: '80px 24px', textAlign: 'center', background: '#FAFAF9' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: '#1C1917', margin: '0 0 12px', letterSpacing: '-0.5px' }}>
            How it works
          </h2>
          <p style={{ fontSize: 16, color: '#78716c', margin: '0 0 52px' }}>
            Three steps. Thirty seconds. No veterinary expertise required.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, marginBottom: 48 }}>
            {[
              {
                icon: '🐾',
                title: 'Select your pet & procedure',
                body: 'Choose dog or cat, then pick from 35 common procedures — from spays to TPLO surgery to emergency visits.',
              },
              {
                icon: '📍',
                title: 'Enter your quote & ZIP',
                body: 'Tell us what you were quoted and where you live. We look up fair price ranges for your metro area.',
              },
              {
                icon: '✅',
                title: 'Get your verdict',
                body: 'See instantly if your quote is fair, slightly high, or above market — with plain-English explanations and questions to ask your vet.',
              },
            ].map(({ icon, title, body }) => (
              <div
                key={title}
                style={{ background: '#fff', borderRadius: 16, padding: '36px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)', textAlign: 'center' }}
              >
                <div style={{ fontSize: 40, marginBottom: 18 }}>{icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1C1917', margin: '0 0 10px' }}>{title}</h3>
                <p style={{ fontSize: 14, color: '#78716c', lineHeight: 1.65, margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>

          <Link
            href="/checker"
            style={{ display: 'inline-block', background: '#F59E0B', color: '#1C1917', fontWeight: 700, fontSize: 16, padding: '14px 36px', borderRadius: 12, textDecoration: 'none' }}
          >
            Check My Quote Now
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Procedure grid                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section style={{ background: '#fffbeb', padding: '80px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: '#1C1917', margin: '0 0 12px', letterSpacing: '-0.5px' }}>
              Procedures We Cover
            </h2>
            <p style={{ fontSize: 16, color: '#78716c', margin: 0 }}>
              Click any procedure to check a price instantly.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
            {PROCEDURES.map((proc) => {
              const speciesDefault = proc.species === 'cat' ? 'cat' : 'dog'
              const speciesLabel =
                proc.species === 'dog' ? '🐕 Dog' :
                proc.species === 'cat' ? '🐈 Cat' :
                '🐕🐈 Both'
              const catColor = CATEGORY_COLORS[proc.category] ?? { bg: '#f3f4f6', text: '#374151' }
              return (
                <Link
                  key={proc.id}
                  href={`/checker?procedure=${proc.slug}&species=${speciesDefault}`}
                  style={{ display: 'block', background: '#fff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textDecoration: 'none' }}
                >
                  <div style={{ display: 'inline-block', background: catColor.bg, color: catColor.text, fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '3px 9px', marginBottom: 8, whiteSpace: 'nowrap' }}>
                    {CATEGORY_LABELS[proc.category]}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#1C1917', lineHeight: 1.35, marginBottom: 6 }}>
                    {proc.display_name}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{speciesLabel}</div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Why this exists                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section style={{ padding: '80px 24px', textAlign: 'center', background: '#FAFAF9' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ fontSize: 52, marginBottom: 24 }}>💡</div>
          <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 800, color: '#1C1917', margin: '0 0 20px', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
            Veterinary prices have outpaced inflation for 4 years in a row.
          </h2>
          <p style={{ fontSize: 16, color: '#44403C', lineHeight: 1.75, margin: '0 0 20px' }}>
            Pet owners are facing an affordability crisis — 81% of veterinarians report clients
            are more cost-sensitive than ever, yet there&apos;s no independent tool that tells you
            if a quote is fair.
          </p>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#F59E0B', margin: 0 }}>
            VetQuoteCheck is the independent, pet-owner-side answer to that gap.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                               */}
      {/* ------------------------------------------------------------------ */}
      <footer style={{ background: '#fff', borderTop: '1px solid #E7E5E4', padding: '24px' }}>
        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', margin: 0 }}>
          Benchmark prices based on NAPHIA SOI 2025 and published industry data. For educational
          purposes only — not a substitute for veterinary advice.
        </p>
      </footer>

    </div>
  )
}
