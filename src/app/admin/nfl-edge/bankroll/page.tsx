// ============================================================================
// NFL Edge Board — bankroll settings
// ============================================================================
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'
import { BankrollForm } from './_components/BankrollForm'

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
      <BankrollForm dkDefault={dk?.bankroll ?? 0} fdDefault={fd?.bankroll ?? 0} />
    </div>
  )
}
