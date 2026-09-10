'use server'

// ============================================================================
// NFL Edge Board — server actions
// All of these run server-side only and use the service-role client — never
// import anything from here into a client component's bundle by accident;
// 'use server' at the top of the file already prevents that for the
// functions themselves, but keep it in mind if this file grows.
//
// Every mutation below now throws when Supabase returns an error instead
// of swallowing it. Before 2026-09-10 a failed insert/update (bad data,
// a constraint, a dropped connection) would fail completely silently —
// the form would just reload with nothing changed and no indication
// anything went wrong. Throwing means Next.js shows its error overlay
// instead, which is still not a pretty error message, but "visibly
// broken" beats "silently did nothing."
// ============================================================================

import { revalidatePath } from 'next/cache'
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'
import { generateRecommendationsForWeek } from '@/lib/nfl-edge/generate'
import { syncScheduleWeek } from '@/lib/nfl-edge/schedule-sync'

export async function updateBankroll(formData: FormData) {
  const dk = Number(formData.get('draftkings'))
  const fd = Number(formData.get('fanduel'))
  const db = nflEdgeDb()

  const { error: dkErr } = await db
    .from('sportsbook_accounts')
    .update({ bankroll: dk, updated_at: new Date().toISOString() })
    .eq('sportsbook', 'draftkings')
  if (dkErr) throw dkErr

  const { error: fdErr } = await db
    .from('sportsbook_accounts')
    .update({ bankroll: fd, updated_at: new Date().toISOString() })
    .eq('sportsbook', 'fanduel')
  if (fdErr) throw fdErr

  revalidatePath('/admin/nfl-edge')
  revalidatePath('/admin/nfl-edge/bankroll')
}

export async function saveMarketLine(formData: FormData) {
  const gameId = String(formData.get('gameId'))
  const sportsbook = String(formData.get('sportsbook')) as 'draftkings' | 'fanduel'
  const homeSpread = formData.get('homeSpread') ? Number(formData.get('homeSpread')) : null
  const total = formData.get('total') ? Number(formData.get('total')) : null
  const homeMoneyline = formData.get('homeMoneyline') ? Number(formData.get('homeMoneyline')) : null
  const awayMoneyline = formData.get('awayMoneyline') ? Number(formData.get('awayMoneyline')) : null
  const week = String(formData.get('week'))

  const db = nflEdgeDb()
  const { error } = await db.from('market_lines').insert({
    game_id: gameId,
    sportsbook,
    home_spread: homeSpread,
    total,
    home_moneyline: homeMoneyline,
    away_moneyline: awayMoneyline,
    source: 'manual',
    captured_at: new Date().toISOString(),
  })
  if (error) throw error

  revalidatePath(`/admin/nfl-edge/week/${week}`)
}

export async function recomputeWeek(seasonYear: number, week: number) {
  await generateRecommendationsForWeek(seasonYear, week)
  revalidatePath(`/admin/nfl-edge/week/${week}`)
}

/** Pulls this week's game statuses/scores from ESPN — the manual backstop to the sync-scores cron. */
export async function syncWeekScores(seasonYear: number, week: number) {
  await syncScheduleWeek(seasonYear, week)
  revalidatePath(`/admin/nfl-edge/week/${week}`)
}

// ── Promos ──────────────────────────────────────────────────────────────
// Promo data is manual entry by design (see promo-math.ts's header comment
// for why: both DK's and FD's Terms of Use explicitly prohibit
// scraping/bots, and the highest-value promos are personalized to one
// account anyway, invisible to any scraper). This is the entry point.

export async function createPromo(formData: FormData) {
  const sportsbook = String(formData.get('sportsbook'))
  const title = String(formData.get('title') || '').trim()
  if (!title) return
  const promoType = String(formData.get('promo_type'))
  const description = String(formData.get('description') || '').trim() || null
  const appliesTo = String(formData.get('applies_to') || '').trim() || null
  const terms = String(formData.get('terms') || '').trim() || null
  const startsAt = formData.get('starts_at') ? new Date(String(formData.get('starts_at'))).toISOString() : null
  const endsAt = formData.get('ends_at') ? new Date(String(formData.get('ends_at'))).toISOString() : null
  const boostPct = formData.get('boost_pct') ? Number(formData.get('boost_pct')) / 100 : null
  const boostedOdds = formData.get('boosted_odds') ? Number(formData.get('boosted_odds')) : null
  const bonusAmount = formData.get('bonus_amount') ? Number(formData.get('bonus_amount')) : null
  const maxStake = formData.get('max_stake') ? Number(formData.get('max_stake')) : null
  const isActive = formData.get('is_active') === 'on'

  const db = nflEdgeDb()
  const { error } = await db.from('promos').insert({
    sportsbook,
    title,
    description,
    promo_type: promoType,
    applies_to: appliesTo,
    terms,
    starts_at: startsAt,
    ends_at: endsAt,
    is_active: isActive,
    captured_at: new Date().toISOString(),
    boost_pct: boostPct,
    boosted_odds: boostedOdds,
    bonus_amount: bonusAmount,
    max_stake: maxStake,
  })
  if (error) throw error

  revalidatePath('/admin/nfl-edge/promos')
}

export async function togglePromoActive(id: number, isActive: boolean) {
  const db = nflEdgeDb()
  const { error } = await db.from('promos').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
  revalidatePath('/admin/nfl-edge/promos')
}

export async function deletePromo(id: number) {
  const db = nflEdgeDb()
  const { error } = await db.from('promos').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/admin/nfl-edge/promos')
}
