'use client'

// Manual grading only, on purpose — see src/lib/nfl-edge/bet-tracker.ts's
// header comment for why this system doesn't auto-grade. Pete clicks
// exactly what happened; "Pending" is there to undo a misclick rather than
// leaving a wrong grade stuck.
import { useTransition } from 'react'
import { settleBet } from '../../actions'

const OPTIONS: { key: 'won' | 'lost' | 'push' | 'pending'; label: string; activeClass: string }[] = [
  { key: 'won', label: 'Won', activeClass: 'border-calm-dot bg-calm/40 text-calm-foreground' },
  { key: 'lost', label: 'Lost', activeClass: 'border-destructive bg-destructive/15 text-destructive' },
  { key: 'push', label: 'Push', activeClass: 'border-border bg-muted text-foreground' },
  { key: 'pending', label: 'Pending', activeClass: 'border-primary bg-primary/10 text-primary' },
]

export function SettleButtons({ betId, result }: { betId: number; result: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => settleBet(betId, opt.key))}
          className={`rounded border px-2 py-1 text-[10px] font-bold uppercase transition disabled:opacity-50 ${
            result === opt.key ? opt.activeClass : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
