import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const ALLOWED_TOPICS = [
  'Price Check question',
  'Insurance question',
  'Branding / partnership inquiry',
  'Care issue or bug',
  'Something else',
] as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }

  // Honeypot — bots fill the website field; silently pretend success
  if (body.website && String(body.website).trim().length > 0) {
    return NextResponse.json({ ok: true })
  }

  const name    = typeof body.name    === 'string' ? body.name.trim()    : ''
  const email   = typeof body.email   === 'string' ? body.email.trim()   : ''
  const topic   = typeof body.topic   === 'string' ? body.topic.trim()   : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!name || name.length > 200)
    return NextResponse.json({ ok: false, error: 'Name is required (max 200 characters).' }, { status: 400 })
  if (!email || !EMAIL_RE.test(email))
    return NextResponse.json({ ok: false, error: 'A valid email address is required.' }, { status: 400 })
  if (!(ALLOWED_TOPICS as readonly string[]).includes(topic))
    return NextResponse.json({ ok: false, error: 'Please select a topic.' }, { status: 400 })
  if (!message || message.length > 5000)
    return NextResponse.json({ ok: false, error: 'Message is required (max 5000 characters).' }, { status: 400 })

  const userAgent = req.headers.get('user-agent') ?? null

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const resend = new Resend(process.env.RESEND_API_KEY)

  let insertOk = true
  let emailOk  = true

  // 1. Insert into DB (non-fatal if it fails)
  const { error: dbErr } = await admin.from('contact_messages').insert({
    name,
    email,
    topic,
    message,
    user_agent: userAgent,
  })
  if (dbErr) {
    console.error('contact: db insert failed', dbErr)
    insertOk = false
  }

  // 2. Notify Pete
  const submittedAt = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const messageHtml = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;color:#1c1917;padding:24px;">
  <h2 style="margin:0 0 16px;font-size:18px;">New contact message</h2>
  <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.6;">
    <tr>
      <td style="padding:6px 0;color:#78716c;width:90px;vertical-align:top;">Topic</td>
      <td style="padding:6px 0;font-weight:600;">${topic}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#78716c;vertical-align:top;">Name</td>
      <td style="padding:6px 0;">${name}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#78716c;vertical-align:top;">Email</td>
      <td style="padding:6px 0;"><a href="mailto:${email}" style="color:#d97706;">${email}</a></td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#78716c;vertical-align:top;">Received</td>
      <td style="padding:6px 0;">${submittedAt} ET</td>
    </tr>
  </table>
  <hr style="border:none;border-top:1px solid #e7e5e4;margin:16px 0;" />
  <p style="margin:0;font-size:14px;line-height:1.7;color:#292524;">${messageHtml}</p>
</div>`

  try {
    const { error: sendErr } = await resend.emails.send({
      from: 'Tailcue Contact <reports@tailcue.com>',
      to: process.env.CONTACT_NOTIFY_EMAIL!,
      replyTo: email,
      subject: `[Tailcue Contact] ${topic} — ${name}`,
      html,
    })
    if (sendErr) {
      console.error('contact: resend failed', sendErr)
      emailOk = false
    }
  } catch (e) {
    console.error('contact: resend threw', e)
    emailOk = false
  }

  if (!insertOk && !emailOk) {
    return NextResponse.json({ ok: false, error: 'Something went wrong. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
