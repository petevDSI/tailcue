'use client'

// A button wired to a server action that always tells Pete something
// happened — even when the action didn't change anything (e.g.
// "Recompute" on a week that's already current, or "Sync scores" when
// ESPN has nothing new). Before this, both buttons on the week page were
// plain <form action={...}> submits with zero visible feedback: a
// successful no-op recompute and a silently-swallowed failure looked
// identical (nothing seemed to happen either way). This shows a small
// pending state on the button itself, then a toast underneath it —
// green for success, red with the real error message if the action
// threw — that fades out on its own after a few seconds.
import { useEffect, useState, useTransition } from 'react'

export function ActionButton({
  label,
  pendingLabel,
  successMessage,
  action,
  className,
}: {
  label: string
  pendingLabel: string
  successMessage: string
  action: () => Promise<void>
  className: string
}) {
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setToast(null)
          startTransition(async () => {
            try {
              await action()
              setToast({ kind: 'success', text: successMessage })
            } catch (err) {
              setToast({ kind: 'error', text: err instanceof Error ? err.message : 'Something went wrong.' })
            }
          })
        }}
        className={`${className} disabled:opacity-60`}
      >
        {pending ? pendingLabel : label}
      </button>
      {toast && (
        <div
          role="status"
          className={`absolute right-0 top-full z-10 mt-2 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-semibold shadow-md ${
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
  )
}
