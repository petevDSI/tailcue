'use client'

// Client-side sortable list shared by "Top Straight Bets" and "Top Player
// Props" — both are one row per bet_recommendations row, tied to exactly
// one game, so they share a row shape. Sorting happens in the browser
// (no page reload, no server round-trip) since it's just reordering data
// already sent down with the page.
import { useState } from 'react'
import { TrackBetToggle } from '../../../../_components/TrackBetToggle'

export interface BetRow {
  id: number
  tier: 'elite' | 'strong'
  description: string
  modelScore: number
  sportsbook: 'draftkings' | 'fanduel' | null
  stake: number | null
  odds: number | null
  tracked: boolean
  /** ISO kickoff time for this bet's game, or null if the game/kickoff isn't known. */
  gameTimeIso: string | null
  /** Team abbreviation the player is on, for player props. Null for straight bets. */
  team: string | null
}

const TIER_STYLE: Record<string, string> = {
  elite: 'bg-primary/15 text-primary border-primary/30',
  strong: 'bg-calm/40 text-calm-foreground border-calm-dot/30',
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

function fmtStake(n: number): string {
  return `$${Math.round(n)}`
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

export function SortableBetList({
  rows,
  seasonYear,
  week,
  emptyLabel,
}: {
  rows: BetRow[]
  seasonYear: number
  week: number
  emptyLabel: string
}) {
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Sensible default direction per key: best score first, soonest kickoff first.
      setSortDir(key === 'score' ? 'desc' : 'asc')
    }
  }

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>
  }

  const sorted = [...rows].sort((a, b) => {
    const cmp =
      sortKey === 'score'
        ? a.modelScore - b.modelScore
        : (a.gameTimeIso ? new Date(a.gameTimeIso).getTime() : Number.POSITIVE_INFINITY) -
          (b.gameTimeIso ? new Date(b.gameTimeIso).getTime() : Number.POSITIVE_INFINITY)
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort by:</span>
        <SortButton label="Score" active={sortKey === 'score'} dir={sortKey === 'score' ? sortDir : null} onClick={() => toggleSort('score')} />
        <SortButton
          label="Day / Time"
          active={sortKey === 'kickoff'}
          dir={sortKey === 'kickoff' ? sortDir : null}
          onClick={() => toggleSort('kickoff')}
        />
      </div>
      <div className="space-y-1.5">
        {sorted.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${TIER_STYLE[r.tier]}`}>{r.tier}</span>
              {r.team && (
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                  {r.team}
                </span>
              )}
              <span className="font-medium text-foreground">{r.description}</span>
              <span className="text-xs text-muted-foreground">{fmtKickoff(r.gameTimeIso)}</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
              <span>score {r.modelScore.toFixed(0)}</span>
              {r.sportsbook && r.stake !== null ? (
                <span className="font-semibold text-foreground">
                  {r.sportsbook === 'draftkings' ? 'DK' : 'FD'} {fmtStake(r.stake)}
                </span>
              ) : (
                <span>not priced yet</span>
              )}
              {r.sportsbook && r.stake !== null && r.odds !== null && (
                <TrackBetToggle recommendationId={r.id} seasonYear={seasonYear} week={week} tracked={r.tracked} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
