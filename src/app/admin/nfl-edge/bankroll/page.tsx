// ============================================================================
// NFL Edge Board — bankroll settings
// ============================================================================
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'
import { updateBankroll } from '../actions'

export const dynamic = 'force-dynamic'

export default async function BankrollPage() {
  const db = nflEdgeDb()
  const { data: accounts } = await db.from('sportsbook_accounts').select('sportsbook, bankroll, updated_at')
  const dk = accounts?.find((a: any) => a.sportsbook === 'draftkings')
  const fd = accounts?.find((a: any) => a.sportsbook === 'fanduel')

  return (
    <div className="max-w-md">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Bankroll</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        What&apos;s live in each book right now. The allocator sizes every recommended stake off these two numbers —
        update them whenever you deposit, withdraw, or just want the numbers to reflect reality.
      </p>
      <form action={updateBankroll} className="space-y-4 rounded-lg border border-border bg-card p-5">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">DraftKings ($)</label>
          <input
            name="draftkings"
            type="number"
            step="0.01"
            defaultValue={dk?.bankroll ?? 0}
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">FanDuel ($)</label>
          <input
            name="fanduel"
            type="number"
            step="0.01"
            defaultValue={fd?.bankroll ?? 0}
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
        </div>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Save
        </button>
      </form>
    </div>
  )
}
