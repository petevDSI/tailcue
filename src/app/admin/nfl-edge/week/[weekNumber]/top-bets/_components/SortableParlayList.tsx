'use client'

// Parlay version of SortableBetList — a parlay spans multiple games, so
// "Day / Time" sorts by the EARLIEST leg's kickoff (the first game you'd
// need to have live/upcoming for this combo to still be bettable), and
// "Score" sorts by the parlay's own EV% (there's no single model_score
// for a multi-leg combo the way there is for one recommendation).
import { useState } from 'react'
import { TrackParlayToggle } from './TrackParlayToggle'

export interface ParlayRow {
  key: string
  legIds: number[]
  description: string
  legCount: number
  combinedProbPct: number
  evPct: number | null
  americanOdds: number | null
  americanLabel: string | null
  tracked: boolean
  /** Earliest kickoff among this parlay's legs, ISO, or null if unknown. */
  earliestGameTimeIso: string | null
  seasonYear: number
  week: number
  suggestedStake: number
}

function fmtKickoff(iso: string | null): string {
  if (!iso) return 'Time TBD'
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

type SortKey = 'score' | 'kickoff'
type SortDir = 'asc' | 'desc'

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: SortDir | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
        active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
      {active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  )
}

export function SortableParlayList({ rows, emptyLabel }: { rows: ParlayRow[]; emptyLabel: string }) {
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'score' ? 'desc' : 'asc')
    }
  }

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>
  }

  const sorted = [...rows].sort((a, b) => {
    const cmp =
      sortKey === 'score'
        ? (a.evPct ?? Number.NEGATIVE_INFINITY) - (b.evPct ?? Number.NEGATIVE_INFINITY)
        : (a.earliestGameTimeIso ? new Date(a.earliestGameTimeIso).getTime() : Number.POSITIVE_INFINITY) -
          (b.earliestGameTimeIso ? new Date(b.earliestGameTimeIso).getTime() : Number.POSITIVE_INFINITY)
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort by:</span>
        <SortButton label="EV %" active={sortKey === 'score'} dir={sortKey === 'score' ? sortDir : null} onClick={() => toggleSort('score')} />
        <SortButton
          label="Day / Time"
          active={sortKey === 'kickoff'}
          dir={sortKey === 'kickoff' ? sortDir : null}
          onClick={() => toggleSort('kickoff')}
        />
      </div>
      <div className="space-y-1.5">
        {sorted.map((s) => (
          <div
            key={s.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
          >
            <div className="flex-1">
              <div className="font-medium text-foreground">
                {s.legCount === 1 ? 'Straight' : `${s.legCount}-leg`}: {s.description}
              </div>
              <div className="text-xs text-muted-foreground">Earliest kickoff: {fmtKickoff(s.earliestGameTimeIso)}</div>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
              <span>
                {s.combinedProbPct.toFixed(1)}% · EV {s.evPct !== null ? `${s.evPct >= 0 ? '+' : ''}${s.evPct.toFixed(1)}%` : '—'}
              </span>
              {s.americanOdds !== null && s.americanLabel !== null && (
                <>
                  <span className="font-semibold text-foreground">{s.americanLabel}</span>
                  <TrackParlayToggle
                    legIds={s.legIds}
                    description={s.description}
                    sportsbook="draftkings"
                    stake={s.suggestedStake}
                    odds={s.americanOdds}
                    seasonYear={s.seasonYear}
                    week={s.week}
                    tracked={s.tracked}
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
