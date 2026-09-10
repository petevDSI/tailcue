'use client'

// Parlay version of TrackBetToggle — the extra fields (description,
// sportsbook, stake, odds) get baked in at render time since a parlay has
// no single bet_recommendations row to look the price back up from later.
import { useEffect, useState, useTransition } from 'react'
import { toggleTrackParlay } from '../../../../actions'

export function TrackParlayToggle({
  legIds,
  description,
  sportsbook,
  stake,
  odds,
  seasonYear,
  week,
  tracked,
}: {
  legIds: number[]
  description: string
  sportsbook: 'draftkings' | 'fanduel'
  stake: number
  odds: number
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
            toggleTrackParlay(legIds, description, sportsbook, stake, odds, seasonYear, week, next)
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
