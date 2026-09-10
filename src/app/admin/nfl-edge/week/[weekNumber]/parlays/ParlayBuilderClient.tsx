'use client'

// ============================================================================
// NFL Edge Board — parlay builder (client)
//
// Pure client-side filtering/ranking of the legs the server already fetched
// and validated (see page.tsx + src/lib/nfl-edge/parlay.ts for what "valid"
// means — a real price and a real, non-fabricated probability). Flipping
// the view tab, the props toggle, or the tier filter never re-hits the
// database; it just re-runs buildParlayView() in memory.
// ============================================================================
import { useMemo, useState } from 'react'
import { americanFromDecimal, americanLabel } from '@/lib/nfl-edge/scoring'
import {
  buildParlayView,
  DEFAULT_PARLAY_OPTIONS,
  type BuildParlayOptions,
  type GameMeta,
  type ParlayView,
  type ScoredLeg,
} from '@/lib/nfl-edge/parlay'

const TIER_STYLE: Record<string, string> = {
  elite: 'bg-primary/15 text-primary border-primary/30',
  strong: 'bg-calm/40 text-calm-foreground border-calm-dot/30',
  lean: 'bg-muted text-muted-foreground border-border',
}

const VIEWS: { key: ParlayView; label: string }[] = [
  { key: 'game', label: 'By game' },
  { key: 'day', label: 'By day' },
  { key: 'week', label: 'By week' },
  { key: 'remaining', label: 'By remaining games' },
]

const TIER_OPTIONS: { n: 1 | 2 | 3; label: string }[] = [
  { n: 1, label: 'Elite only' },
  { n: 2, label: 'Elite + Strong' },
  { n: 3, label: 'Elite + Strong + Lean (all)' },
]

function fmtPct(p: number): string {
  return `${(p * 100).toFixed(1)}%`
}

function fmtEv(evPct: number | null): string {
  if (evPct === null) return '—'
  return `${evPct >= 0 ? '+' : ''}${evPct.toFixed(1)}%`
}

function fmtBookOdds(decimal: number | null): string {
  if (decimal === null) return '—'
  const a = americanFromDecimal(decimal)
  return a !== null ? americanLabel(a) : decimal.toFixed(2) + 'x'
}

export function ParlayBuilderClient({
  allLegs,
  gamesMetaEntries,
  missingCount,
}: {
  allLegs: ScoredLeg[]
  gamesMetaEntries: [string, GameMeta][]
  missingCount: number
}) {
  const [view, setView] = useState<ParlayView>('week')
  const [includeProps, setIncludeProps] = useState(true)
  const [maxTierN, setMaxTierN] = useState<1 | 2 | 3>(3)

  const gamesMeta = useMemo(() => new Map(gamesMetaEntries), [gamesMetaEntries])

  const opts: BuildParlayOptions = useMemo(
    () => ({ ...DEFAULT_PARLAY_OPTIONS, includeProps, maxTierN }),
    [includeProps, maxTierN]
  )

  const buckets = useMemo(() => buildParlayView(allLegs, gamesMeta, view, opts), [allLegs, gamesMeta, view, opts])

  return (
    <div>
      <div className="mb-4 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Combined odds/probability assume each leg is independent. That&apos;s a reasonable assumption across different
        games, but <span className="font-semibold text-foreground">not</span> within one game — a same-game parlay&apos;s
        numbers are shown for reference (each leg individually checks out) but likely overstate the true combined
        probability, since real sportsbooks price same-game correlation and this doesn&apos;t. Every same-game suggestion
        below is flagged for that reason.
        {missingCount > 0 && (
          <span> ({missingCount} recommendation{missingCount === 1 ? '' : 's'} skipped — missing a price or probability; recompute the week to backfill.)</span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-border bg-card p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                view === v.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setIncludeProps((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
            includeProps ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'
          }`}
        >
          Player props: {includeProps ? 'On' : 'Off'}
        </button>

        <select
          value={maxTierN}
          onChange={(e) => setMaxTierN(Number(e.target.value) as 1 | 2 | 3)}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold text-foreground"
        >
          {TIER_OPTIONS.map((t) => (
            <option key={t.n} value={t.n}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {buckets.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No parlay combos for this view with the current filters — try widening the tier filter, turning props on, or
          a different view.
        </div>
      )}

      <div className="space-y-4">
        {buckets.map((bucket) => (
          <div key={bucket.key} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-foreground">{bucket.label}</div>
              {bucket.correlated && (
                <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">
                  Same game — correlated
                </span>
              )}
            </div>

            <div className="space-y-2">
              {bucket.suggestions.map((s, i) => (
                <div key={i} className="rounded-md border border-border/60 bg-background p-3">
                  <div className="mb-2 space-y-1">
                    {s.legs.map((leg) => (
                      <div key={leg.recommendationId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${TIER_STYLE[leg.tier]}`}>
                            {leg.tier}
                          </span>
                          <span className="text-foreground">{leg.description}</span>
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">
                          {leg.sportsbook === 'draftkings' ? 'DK' : leg.sportsbook === 'fanduel' ? 'FD' : ''} {americanLabel(leg.bookOddsAmerican ?? 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 border-t border-border/60 pt-2 font-mono text-xs">
                    <span className="text-muted-foreground">
                      {s.legs.length === 1 ? 'Straight bet' : `${s.legs.length}-leg parlay`} · payout{' '}
                      <span className="font-semibold text-foreground">{fmtBookOdds(s.result.bookDecimal)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      model win prob <span className="font-semibold text-foreground">{fmtPct(s.result.combinedProb)}</span>
                    </span>
                    <span className={s.result.evPct !== null && s.result.evPct >= 0 ? 'text-calm-foreground' : 'text-muted-foreground'}>
                      edge vs. price <span className="font-semibold">{fmtEv(s.result.evPct)}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
