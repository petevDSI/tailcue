// ============================================================================
// NFL Edge Board — service-role Supabase client
//
// Every table in the `nfl_edge` schema has RLS enabled with ZERO policies.
// That's deliberate: the anon and authenticated keys (the ones shipped to
// the browser) can't read or write any of it. Only the service-role key —
// which never leaves the server — can. That is the entire access-control
// story for this hidden personal tool.
//
// NEVER import this file from a 'use client' component or a file that ends
// up in the browser bundle. It is only ever used from:
//   - server components (no 'use client' directive) under src/app/admin/nfl-edge
//   - route handlers under src/app/api/admin/nfl-edge
//   - one-off scripts under scripts/nfl-edge (run via `npx tsx`)
// ============================================================================

import { createClient } from '@supabase/supabase-js'

// Typed as `any`: this project has no generated Database types, and the
// nfl_edge schema isn't `public`, so supabase-js's generic inference fights
// itself here more than it helps. Every caller already knows its own row
// shapes via src/lib/nfl-edge/types.ts.
let client: any = null

export function nflEdgeDb(): any {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
        'The NFL Edge Board reads/writes the nfl_edge schema exclusively with the ' +
        'service-role key — check .env.local.'
    )
  }

  client = createClient(url, serviceRoleKey, {
    db: { schema: 'nfl_edge' },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return client
}
