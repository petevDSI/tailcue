'use client'

// Same pattern as the promos page's PromoToggle — an optimistic checkbox
// that calls a server action in a transition, then re-syncs to whatever
// the server ends up saying (e.g. if the same bet gets tracked from
// another tab).
import { useEffect, useState, useTransition } from 'react'
import { toggleTrackSingleBet } from '../../../../actions'

export function TrackBetToggle({
  recommendationId,
  seasonYear,
  week,
  tracked,
}: {
  recommendationId: number
  seasonYear: number
  week: number
  tracked: boolean
}) {
  const [checked, setChecked] = useState(tracked)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setChecked(tracked)
  }, [tracked])

  return (
    <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked
          setChecked(next)
          startTransition(() => {
            toggleTrackSingleBet(recommendationId, seasonYear, week, next)
          })
        }}
        className="h-4 w-4 accent-primary"
      />
      <span className="text-[11px] font-semibold uppercase text-muted-foreground">
        {pending ? 'Saving…' : checked ? 'Placed' : 'I placed this'}
      </span>
    </label>
  )
}
