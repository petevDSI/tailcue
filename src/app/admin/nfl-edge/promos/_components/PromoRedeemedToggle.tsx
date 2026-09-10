'use client'

import { useEffect, useState, useTransition } from 'react'
import { setPromoRedeemed } from '../../actions'

export function PromoRedeemedToggle({ id, redeemed }: { id: number; redeemed: boolean }) {
  const [checked, setChecked] = useState(redeemed)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setChecked(redeemed)
  }, [redeemed])

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
            setPromoRedeemed(id, next)
          })
        }}
        className="h-4 w-4 accent-primary"
      />
      <span className={`text-xs font-semibold uppercase ${checked ? 'text-destructive' : 'text-muted-foreground'}`}>
        {pending ? 'Saving…' : checked ? 'Used' : 'Available'}
      </span>
    </label>
  )
}
