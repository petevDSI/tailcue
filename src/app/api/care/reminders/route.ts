import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LAPSE_HOURS = 36
const APP_URL = 'https://tailcue.com'
const FROM = 'Tailcue <reports@tailcue.com>'

export async function GET(request: NextRequest) {
  // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  // Service-role client: no user session here, so we must bypass RLS to read
  // across every member's pets/logs. Never expose this client to the browser.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = Date.now()
  const cutoff = now - LAPSE_HOURS * 3600_000

  // 1. Opted-in users
  const { data: users, error: usersErr } = await admin
    .from('care_users')
    .select('id, email, reminder_last_sent_at')
    .eq('reminders_enabled', true)
  if (usersErr) {
    console.error('reminders: users query failed', usersErr)
    return NextResponse.json({ error: usersErr.message }, { status: 500 })
  }
  if (!users || users.length === 0) {
    return NextResponse.json({ checked: 0, notified: 0 })
  }
  const userIds = users.map((u) => u.id)

  // 2. Their memberships (flat query — nested joins are unreliable here)
  const { data: members, error: memErr } = await admin
    .from('care_pet_members')
    .select('user_id, pet_id')
    .in('user_id', userIds)
  if (memErr) {
    console.error('reminders: members query failed', memErr)
    return NextResponse.json({ error: memErr.message }, { status: 500 })
  }
  const allPetIds = Array.from(new Set((members ?? []).map((m) => m.pet_id as string)))
  if (allPetIds.length === 0) {
    return NextResponse.json({ checked: users.length, notified: 0 })
  }

  // 3. Active pets only (exclude In-Memory)
  const { data: pets, error: petsErr } = await admin
    .from('care_pets')
    .select('id, name, created_at')
    .in('id', allPetIds)
    .is('memorialized_at', null)
  if (petsErr) {
    console.error('reminders: pets query failed', petsErr)
    return NextResponse.json({ error: petsErr.message }, { status: 500 })
  }
  const petMap = new Map((pets ?? []).map((p) => [p.id as string, p as { id: string; name: string; created_at: string }]))
  const activePetIds = (pets ?? []).map((p) => p.id as string)

  // 4. Most recent log per active pet (newest-first; keep first seen)
  const lastLog = new Map<string, string>()
  if (activePetIds.length > 0) {
    const { data: logs, error: logErr } = await admin
      .from('care_logs')
      .select('pet_id, logged_at')
      .in('pet_id', activePetIds)
      .order('logged_at', { ascending: false })
    if (logErr) {
      console.error('reminders: logs query failed', logErr)
      return NextResponse.json({ error: logErr.message }, { status: 500 })
    }
    for (const row of logs ?? []) {
      if (!lastLog.has(row.pet_id as string)) lastLog.set(row.pet_id as string, row.logged_at as string)
    }
  }

  // 5. Group active pets by user
  const petsByUser = new Map<string, string[]>()
  for (const m of members ?? []) {
    if (!petMap.has(m.pet_id as string)) continue // inactive/memorialized
    const arr = petsByUser.get(m.user_id as string) ?? []
    arr.push(m.pet_id as string)
    petsByUser.set(m.user_id as string, arr)
  }

  // 6. Decide who to notify
  const toNotify: { id: string; email: string; pets: string[] }[] = []
  for (const u of users) {
    const mine = petsByUser.get(u.id as string) ?? []
    const overdue: { name: string; activity: number }[] = []
    for (const pid of mine) {
      const pet = petMap.get(pid)!
      // "activity" = last log, or pet creation if never logged
      const activityIso = lastLog.get(pid) ?? pet.created_at
      const activity = new Date(activityIso).getTime()
      if (activity < cutoff) overdue.push({ name: pet.name, activity })
    }
    if (overdue.length === 0) continue
    const newestSignal = Math.max(...overdue.map((o) => o.activity))
    const lastSent = u.reminder_last_sent_at ? new Date(u.reminder_last_sent_at as string).getTime() : 0
    // One nudge per lapse episode: skip if we've already reminded since the
    // newest stale signal. A fresh log moves the signal forward and re-arms it.
    if (lastSent < newestSignal) {
      toNotify.push({ id: u.id as string, email: u.email as string, pets: overdue.map((o) => o.name) })
    }
  }

  // 7. Send + stamp
  let notified = 0
  for (const n of toNotify) {
    const petList =
      n.pets.length === 1
        ? n.pets[0]
        : n.pets.slice(0, -1).join(', ') + ' and ' + n.pets[n.pets.length - 1]
    try {
      await resend.emails.send({
        from: FROM,
        to: n.email,
        subject: `A gentle nudge to log ${n.pets.length === 1 ? n.pets[0] : 'your pets'}`,
        headers: { 'List-Unsubscribe': `<${APP_URL}/care?settings=1>` },
        html: reminderHtml(petList),
      })
      notified++
    } catch (e) {
      console.error('reminders: send failed for', n.email, e)
    }
  }

  if (toNotify.length > 0) {
    const { error: updErr } = await admin
      .from('care_users')
      .update({ reminder_last_sent_at: new Date(now).toISOString() })
      .in('id', toNotify.map((n) => n.id))
    if (updErr) console.error('reminders: stamp update failed', updErr)
  }

  console.log(`reminders: checked ${users.length} users, notified ${notified}`)
  return NextResponse.json({ checked: users.length, notified })
}

function reminderHtml(petList: string): string {
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1917;">
    <h1 style="font-size:18px;margin:0 0 12px;">Time to log ${petList}</h1>
    <p style="font-size:14px;line-height:1.5;color:#44403c;margin:0 0 16px;">
      It's been a little while since ${petList}'s last entry. A quick reading keeps the trend line accurate — and makes your next vet visit far easier.
    </p>
    <a href="${APP_URL}/care" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">Log today's reading</a>
    <p style="font-size:11px;color:#a8a29e;margin:24px 0 0;">
      You're getting this because daily reminders are on for your Tailcue account.
      <a href="${APP_URL}/care?settings=1" style="color:#a8a29e;">Manage or turn these off</a>.
    </p>
  </div>`
}
