// ============================================================================
// NFL Edge Board — access gate
//
// Not real auth (no accounts, no sessions) — just a shared secret so this
// hidden page's real bankroll numbers aren't sitting behind a guessable
// URL. Mirrors the rest of /admin being "hidden by omission from
// nav/sitemap"; this one adds a passphrase because real money is involved.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { key } = await req.json().catch(() => ({ key: '' }))
  const expected = process.env.NFL_EDGE_ACCESS_KEY

  if (!expected || key !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('nfl_edge_access', expected, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 90, // 90 days
    path: '/admin/nfl-edge',
  })
  return res
}
