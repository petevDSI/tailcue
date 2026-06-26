'use client'

import { useState } from 'react'
import { Share2, Copy, Check, X, RefreshCw, Trash2, Mail } from 'lucide-react'
import { createInvite, listInvites, revokeInvite, type InviteRow } from '@/lib/care-storage'

function isActive(inv: InviteRow): boolean {
  return inv.usedBy === null && new Date(inv.expiresAt).getTime() > Date.now()
}

function originUrl(): string {
  return typeof window !== 'undefined' ? window.location.origin : 'https://tailcue.com'
}

function buildMessage(petName: string, code: string): string {
  const origin = originUrl()
  return `Hi,

I'm tracking ${petName}'s health on Tailcue and I'd like to share it with you so we can both keep up with ${petName}'s care.

To join, open this link:
${origin}/care?join=${code}

Then sign in and you'll have access. If the link doesn't take you straight in, go to ${origin}/care, tap "Join a pet," and enter this code:

${code}

This invite can be used once and expires in 48 hours.

Thanks!`
}

export function CareShareButton({ petId, petName }: { petId: string; petName: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState<InviteRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'code' | 'msg' | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const all = await listInvites(petId)
      setActive(all.find(isActive) ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load invites.')
    } finally {
      setLoading(false)
    }
  }

  function handleOpen() {
    setOpen(true)
    setCopied(null)
    load()
  }

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      await createInvite(petId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a code.')
    } finally {
      setLoading(false)
    }
  }

  async function revoke() {
    if (!active) return
    setLoading(true)
    setError(null)
    try {
      await revokeInvite(active.id)
      setActive(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke.')
    } finally {
      setLoading(false)
    }
  }

  async function copyText(text: string, which: 'code' | 'msg') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // clipboard unavailable — ignore
    }
  }

  const message = active ? buildMessage(petName, active.code) : ''
  const mailtoHref = active
    ? `mailto:?subject=${encodeURIComponent(`Join ${petName}'s care on Tailcue`)}&body=${encodeURIComponent(message)}`
    : '#'

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
      >
        <Share2 className="w-3.5 h-3.5" />
        Share
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 max-w-sm w-full mx-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-lg font-bold text-stone-900">Share {petName}&apos;s care</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-stone-500 mb-5 leading-relaxed">
              Send the invite to a family member or caregiver. They sign in and join to share {petName}&apos;s logs. Single use, expires in 48 hours.
            </p>

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            {loading ? (
              <p className="text-sm text-stone-400">Working…</p>
            ) : active ? (
              <div className="space-y-4">
                {/* Code + copy */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-xl tracking-widest text-stone-900 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-center">
                    {active.code}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(active.code, 'code')}
                    aria-label="Copy code"
                    className="p-3 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600"
                  >
                    {copied === 'code' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-stone-400">Expires {new Date(active.expiresAt).toLocaleString()}</p>

                {/* Email + copy message */}
                <div className="flex items-center gap-2">
                  <a
                    href={mailtoHref}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Email invite
                  </a>
                  <button
                    type="button"
                    onClick={() => copyText(message, 'msg')}
                    className="flex-1 border border-stone-200 hover:bg-stone-50 text-stone-700 font-semibold text-sm py-2.5 rounded-xl transition-colors"
                  >
                    {copied === 'msg' ? 'Copied!' : 'Copy message'}
                  </button>
                </div>

                {/* Preview */}
                <textarea
                  readOnly
                  value={message}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full h-36 text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-xl p-3 resize-none leading-relaxed"
                />

                {/* Manage */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={generate}
                    className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> New code
                  </button>
                  <button
                    type="button"
                    onClick={revoke}
                    className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Revoke
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={generate}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
              >
                Generate invite code
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
