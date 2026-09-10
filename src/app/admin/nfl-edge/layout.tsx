// ============================================================================
// NFL Edge Board — layout + access gate
//
// This whole feature is intentionally NOT in src/app/sitemap.ts or any nav
// — the existing Tailcue convention for internal/admin tools (see
// src/app/admin/policy-review). This one additionally checks a shared
// secret cookie before rendering anything, because unlike policy-review it
// shows real bankroll numbers. See src/app/api/admin/nfl-edge/gate/route.ts.
// ============================================================================
import { cookies } from 'next/headers'
import Link from 'next/link'
import { GateForm } from './_components/gate-form'

export const metadata = { robots: { index: false, follow: false } }

export default function NflEdgeLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const provided = cookieStore.get('nfl_edge_access')?.value
  const expected = process.env.NFL_EDGE_ACCESS_KEY

  if (!expected || provided !== expected) {
    return (
      <div className="min-h-screen bg-background">
        <GateForm />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/admin/nfl-edge" className="text-sm font-semibold">
            🏈 NFL Edge Board
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/admin/nfl-edge" className="hover:text-foreground">
              Season
            </Link>
            <Link href="/admin/nfl-edge/power-rankings" className="hover:text-foreground">
              Power Rankings
            </Link>
            <Link href="/admin/nfl-edge/bankroll" className="hover:text-foreground">
              Bankroll
            </Link>
            <Link href="/admin/nfl-edge/promos" className="hover:text-foreground">
              Promos
            </Link>
          </nav>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </div>
  )
}
