'use client'

import { useEffect, useState, useTransition } from 'react'
import { togglePromoActive } from '../../actions'

export function PromoToggle({ id, isActive }: { id: number; isActive: boolean }) {
  const [checked, setChecked] = useState(isActive)
  const [pending, startTransition] = useTransition()

  // Keep in sync with the server's value after a revalidate (e.g. another
  // tab toggled the same promo), without fighting the user's own click.
  useEffect(() => {
    setChecked(isActive)
  }, [isActive])

  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked
          setChecked(next)
          startTransition(() => {
            togglePromoActive(id, next)
          })
        }}
        className="h-4 w-4 accent-primary"
      />
      <span className="text-xs font-semibold uppercase text-muted-foreground">{pending ? 'Saving…' : checked ? 'Active' : 'Inactive'}</span>
    </label>
  )
}
