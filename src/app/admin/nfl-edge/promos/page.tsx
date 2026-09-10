// ============================================================================
// NFL Edge Board — promos & bonus EV
//
// Promo data is manual entry (see actions.ts's createPromo and promo-math.ts's
// header comment for why: DK's and FD's own Terms of Use explicitly prohibit
// scraping/bots, with account suspension the stated consequence, and the
// highest-value promos are personalized to one account anyway — invisible to
// any scraper regardless). Check a promo "Active" and this page immediately
// re-ranks the selected week's qualifying picks by how much extra dollar EV
// that specific promo adds to each — the direct answer to "where's the extra
// edge" for whatever's live right now.
// ============================================================================
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'
import { rankPromoAcrossRecommendations } from '@/lib/nfl-edge/promo-math'
import type { PromoCandidate } from '@/lib/nfl-edge/promo-math'
import type { Promo } from '@/lib/nfl-edge/types'
import { PromoToggle } from './_components/PromoToggle'
import { PromoForm } from './_components/PromoForm'
import { deletePromo } from '../actions'

export const dynamic = 'force-dynamic'

function currentSeasonYear(): number {
  const now = new Date()
  return now.getUTCMonth() >= 2 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}

const PROMO_TYPE_LABEL: Record<string, string> = {
  profit_boost: 'Profit boost',
  odds_boost: 'Odds boost',
  bonus_bet: 'Bonus bet',
  risk_free: 'Risk-free bet',
  other: 'Other',
}

function fmtPromoTerms(p: Promo): string {
  switch (p.promo_type) {
    case 'profit_boost':
      return p.boost_pct !== null ? `${(p.boost_pct * 100).toFixed(0)}% profit boost` : 'No boost % on file'
    case 'odds_boost':
      return p.boosted_odds !== null ? `Boosted to ${p.boosted_odds > 0 ? '+' : ''}${p.boosted_odds}` : 'No boosted odds on file'
    case 'bonus_bet':
      return p.bonus_amount !== null ? `$${p.bonus_amount.toFixed(0)} free-bet credit` : 'No face value on file'
    case 'risk_free':
      return p.bonus_amount !== null ? `Up to $${p.bonus_amount.toFixed(0)} refunded on a loss` : 'No refund amount on file'
    default:
      return '—'
  }
}

function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

export default async function PromosPage({
  searchParams,
}: {
  searchParams: { season?: string; week?: string }
}) {
  const db = nflEdgeDb()
  const seasonYear = Number(searchParams.season) || currentSeasonYear()

  const { data: promos } = await db
    .from('promos')
    .select('*')
    .in('sportsbook', ['draftkings', 'fanduel'])
    .order('is_active', { ascending: false })
    .order('captured_at', { ascending: false })

  // Default week: first week this season with any recommendation on file,
  // falling back to 1. Simpler than page.tsx's kickoff-based detection —
  // this page cares about "which week has picks to rank," not schedule state.
  let defaultWeek = 1
  if (!searchParams.week) {
    const { data: latestRec } = await db
      .from('bet_recommendations')
      .select('week_number')
      .eq('season_year', seasonYear)
      .order('week_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latestRec) defaultWeek = latestRec.week_number
  }
  const week = Number(searchParams.week) || defaultWeek

  const { data: recs } = await db
    .from('bet_recommendations')
    .select('*')
    .eq('season_year', seasonYear)
    .eq('week_number', week)
    .neq('tier', 'pass')
    .order('model_score', { ascending: false })

  const candidates: PromoCandidate[] = (recs ?? [])
    .filter((r: any) => r.odds !== null && r.model_prob !== null)
    .map((r: any) => ({
      recommendationId: r.id,
      description: r.description,
      side: r.side,
      tier: r.tier,
      betCategory: r.bet_category,
      sportsbook: r.recommended_sportsbook,
      marketOdds: r.odds,
      modelProb: r.model_prob,
      stake: r.recommended_stake ?? 100, // nominal $100 reference stake when the allocator hasn't sized this one yet
    }))

  const activePromos: Promo[] = (promos ?? []).filter((p: Promo) => p.is_active && p.promo_type !== 'other')

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-foreground">Promos &amp; Bonus EV</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Log DK/FD promos here by hand as they show up in your accounts or app inbox. Check a promo active and the section
          below re-ranks {seasonYear} Week {week}&apos;s qualifying picks by how much extra dollar EV that promo adds to
          each — not just the model&apos;s top-ranked game, since bonus bets and risk-free bets favor different picks than
          a plain wager does (see the note under each result).
        </p>
      </div>

      <div className="mb-3 flex items-center gap-2 text-sm">
        <form className="flex items-center gap-2" action="/admin/nfl-edge/promos">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Season</label>
          <input
            name="season"
            type="number"
            defaultValue={seasonYear}
            className="w-24 rounded-md border border-border bg-background px-2 py-1 font-mono text-sm"
          />
          <label className="text-xs font-semibold uppercase text-muted-foreground">Week</label>
          <input
            name="week"
            type="number"
            defaultValue={week}
            className="w-16 rounded-md border border-border bg-background px-2 py-1 font-mono text-sm"
          />
          <button type="submit" className="rounded-md border border-border px-3 py-1 text-xs font-semibold hover:border-primary">
            View
          </button>
        </form>
      </div>

      <div className="mb-8 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Book</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Terms on file</th>
              <th className="px-3 py-2">Applies to</th>
              <th className="px-3 py-2">Window</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(promos ?? []).map((p: Promo) => (
              <tr key={p.id} className="border-t border-border align-top">
                <td className="px-3 py-2">
                  <PromoToggle id={p.id} isActive={p.is_active} />
                </td>
                <td className="px-3 py-2 capitalize">{p.sportsbook}</td>
                <td className="px-3 py-2 font-medium text-foreground">{p.title}</td>
                <td className="px-3 py-2 text-muted-foreground">{PROMO_TYPE_LABEL[p.promo_type] ?? p.promo_type}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{fmtPromoTerms(p)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{p.applies_to ?? 'any'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {p.starts_at ? new Date(p.starts_at).toLocaleDateString() : '—'}
                  {' – '}
                  {p.ends_at ? new Date(p.ends_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-2">
                  <form action={deletePromo.bind(null, p.id)}>
                    <button type="submit" className="text-xs text-muted-foreground hover:text-destructive">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(promos ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No promos logged yet — add the first one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-foreground">Add a promo</h2>
        <PromoForm />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Where&apos;s the extra edge — {seasonYear} Week {week}
        </h2>

        {candidates.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No priced, qualifying recommendations on file for {seasonYear} Week {week} yet. Run recommendations for that
            week first (Week page &rarr; &quot;Recompute recommendations&quot;).
          </div>
        )}

        {candidates.length > 0 && activePromos.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No active promos to rank against. Check one active above.
          </div>
        )}

        {candidates.length > 0 &&
          activePromos.map((promo) => {
            const ranked = rankPromoAcrossRecommendations(promo, candidates).filter((r) => r.extraEv > 0)
            return (
              <div key={promo.id} className="mb-6 overflow-hidden rounded-lg border border-border bg-card">
                <div className="border-b border-border bg-muted/30 px-4 py-2">
                  <span className="font-semibold text-foreground">{promo.title}</span>{' '}
                  <span className="text-xs uppercase text-muted-foreground">
                    ({promo.sportsbook} · {PROMO_TYPE_LABEL[promo.promo_type] ?? promo.promo_type})
                  </span>
                </div>
                {ranked.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No qualifying pick this week clears a positive extra EV for this promo (check its &quot;applies to&quot; text,
                    or its boost/bonus fields, if that&apos;s unexpected).
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs font-semibold uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2">Pick</th>
                        <th className="px-4 py-2">Tier</th>
                        <th className="px-4 py-2">Stake used</th>
                        <th className="px-4 py-2">Baseline EV</th>
                        <th className="px-4 py-2">Promo EV</th>
                        <th className="px-4 py-2">Extra EV</th>
                        <th className="px-4 py-2">Extra EV %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.slice(0, 8).map((r) => (
                        <tr key={r.candidate.recommendationId} className="border-t border-border align-top">
                          <td className="px-4 py-2">
                            <div className="font-medium text-foreground">{r.candidate.description}</div>
                            <div className="text-xs text-muted-foreground">{r.candidate.side}</div>
                            {r.notes.map((n, i) => (
                              <div key={i} className="mt-1 text-xs text-muted-foreground">
                                {n}
                              </div>
                            ))}
                          </td>
                          <td className="px-4 py-2 capitalize text-muted-foreground">{r.candidate.tier}</td>
                          <td className="px-4 py-2 font-mono">{fmtMoney(r.stakeUsed)}</td>
                          <td className="px-4 py-2 font-mono text-muted-foreground">{fmtMoney(r.baselineEv)}</td>
                          <td className="px-4 py-2 font-mono">{fmtMoney(r.promoEv)}</td>
                          <td className="px-4 py-2 font-mono font-semibold text-primary">{fmtMoney(r.extraEv)}</td>
                          <td className="px-4 py-2 font-mono text-muted-foreground">{r.extraEvPctOfStake.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
