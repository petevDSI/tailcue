'use client'

// Same "tell Pete something actually happened" fix as the week page's
// ActionButton — before this, Save was a plain <form action={updateBankroll}>
// with no feedback, so a successful save that didn't change how anything
// displayed (e.g. re-saving the same numbers) looked identical to a
// silent failure. This submits via a transition and shows a toast either
// way: green confirmation on success, red with the real error on failure.
import { useEffect, useRef, useState, useTransition } from 'react'
import { updateBankroll } from '../../actions'

export function BankrollForm({ dkDefault, fdDefault }: { dkDefault: number; fdDefault: number }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        setToast(null)
        startTransition(async () => {
          try {
            await updateBankroll(formData)
            setToast({ kind: 'success', text: 'Bankroll saved.' })
          } catch (err) {
            setToast({ kind: 'error', text: err instanceof Error ? err.message : 'Something went wrong.' })
          }
        })
      }}
      className="space-y-4 rounded-lg border border-border bg-card p-5"
    >
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">DraftKings ($)</label>
        <input
          name="draftkings"
          type="number"
          step="0.01"
          defaultValue={dkDefault}
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">FanDuel ($)</label>
        <input
          name="fanduel"
          type="number"
          step="0.01"
          defaultValue={fdDefault}
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
        />
      </div>
      <div className="relative inline-block">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        {toast && (
          <div
            role="status"
            className={`absolute left-0 top-full z-10 mt-2 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-semibold shadow-md ${
              toast.kind === 'success'
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
            }`}
          >
            {toast.kind === 'success' ? '✓ ' : '⚠ '}
            {toast.text}
          </div>
        )}
      </div>
    </form>
  )
}
