'use server'

// ============================================================================
// NFL Edge Board — server actions
// All of these run server-side only and use the service-role client — never
// import anything from here into a client component's bundle by accident;
// 'use server' at the top of the file already prevents that for the
// functions themselves, but keep it in mind if this file grows.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { nflEdgeDb } from '@/lib/nfl-edge/supabase-admin'
import { generateRecommendationsForWeek } from '@/lib/nfl-edge/generate'

export async function updateBankroll(formData: FormData) {
  const dk = Number(formData.get('draftkings'))
  const fd = Number(formData.get('fanduel'))
  const db = nflEdgeDb()

  await db.from('sportsbook_accounts').update({ bankroll: dk, updated_at: new Date().toISOString() }).eq('sportsbook', 'draftkings')
  await db.from('sportsbook_accounts').update({ bankroll: fd, updated_at: new Date().toISOString() }).eq('sportsbook', 'fanduel')

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
  await db.from('market_lines').insert({
    game_id: gameId,
    sportsbook,
    home_spread: homeSpread,
    total,
    home_moneyline: homeMoneyline,
    away_moneyline: awayMoneyline,
    source: 'manual',
    captured_at: new Date().toISOString(),
  })

  revalidatePath(`/admin/nfl-edge/week/${week}`)
}

export async function recomputeWeek(seasonYear: number, week: number) {
  await generateRecommendationsForWeek(seasonYear, week)
  revalidatePath(`/admin/nfl-edge/week/${week}`)
}
