'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PawPrint, ArrowLeft } from 'lucide-react'
import Footer from '@/components/footer'

const TOPICS = [
  'Price Check question',
  'Insurance question',
  'Branding / partnership inquiry',
  'Care issue or bug',
  'Something else',
] as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FormState {
  name: string
  email: string
  topic: string
  message: string
}

const EMPTY: FormState = { name: '', email: '', topic: '', message: '' }

export default function ContactPage() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [website, setWebsite] = useState('') // honeypot
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [fieldError, setFieldError] = useState('')
  const [serverError, setServerError] = useState('')

  function validate(): string {
    if (!form.name.trim()) return 'Please enter your name.'
    if (!form.email.trim() || !EMAIL_RE.test(form.email.trim())) return 'Please enter a valid email address.'
    if (!form.topic) return 'Please select a topic.'
    if (!form.message.trim()) return 'Please enter a message.'
    return ''
  }

  async function handleSubmit() {
    setServerError('')
    const err = validate()
    if (err) { setFieldError(err); return }
    setFieldError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          topic: form.topic,
          message: form.message.trim(),
          website, // honeypot
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setDone(true)
      } else {
        setServerError(json.error ?? 'Something went wrong — please try again in a moment.')
      }
    } catch {
      setServerError('Something went wrong — please try again in a moment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFBF0] flex flex-col" style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>
        <span className="text-stone-200">|</span>
        <div className="flex items-center gap-2">
          <PawPrint className="w-5 h-5 text-amber-500" />
          <span className="font-semibold text-stone-800">Tailcue</span>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-lg">

          {done ? (
            <div className="text-center py-16">
              <p className="text-2xl mb-3">✉️</p>
              <h1 className="text-xl font-bold text-stone-900 mb-2">Thanks!</h1>
              <p className="text-sm text-stone-600 leading-relaxed mb-6">
                Your message is on its way. Pete typically replies within a couple of days.
              </p>
              <Link href="/" className="text-sm font-semibold text-amber-600 hover:text-amber-700 hover:underline">
                ← Back to home
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-stone-900 mb-1">Get in touch</h1>
              <p className="text-sm text-stone-500 mb-8 leading-relaxed">
                Questions about a quote, insurance, Tailcue Care, or interested in working together? Send a note and Pete will get back to you.
              </p>

              <div className="space-y-4">

                {/* Honeypot — hidden from humans */}
                <div className="absolute left-[-9999px]" aria-hidden>
                  <label>Leave this blank
                    <input
                      type="text"
                      name="website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm text-stone-900
                      focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm text-stone-900
                      focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Topic *</label>
                  <select
                    value={form.topic}
                    onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm text-stone-900
                      focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                  >
                    <option value="" disabled>What&apos;s this about?</option>
                    {TOPICS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Message *</label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    rows={5}
                    placeholder="What's on your mind?"
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm text-stone-900
                      focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-y"
                  />
                </div>

                {fieldError && (
                  <p className="text-xs font-medium text-red-600">{fieldError}</p>
                )}
                {serverError && (
                  <p className="text-xs font-medium text-red-600">{serverError}</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50
                    text-sm font-semibold text-white transition-colors min-h-[44px]"
                >
                  {submitting ? 'Sending…' : 'Send message'}
                </button>

                <p className="text-xs text-stone-400 text-center">
                  We&rsquo;ll only use your email to reply. No newsletters, no spam.
                </p>

              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
