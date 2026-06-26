'use client'

import { useState } from 'react'
import { Share2, Copy, Check, X, RefreshCw, Trash2 } from 'lucide-react'
import { createInvite, listInvites, revokeInvite, type InviteRow } from '@/lib/care-storage'

function isActive(inv: InviteRow): boolean {
  return inv.usedBy === null && new Date(inv.expiresAt).getTime() > Date.now()
}

export function CareShareButton({ petId, petName }: { petId: string; petName: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState<InviteRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
    setCopied(false)
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

  async function copy() {
    if (!active) return
    try {
      await navigator.clipboard.writeText(active.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — ignore
    }
  }

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
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 max-w-sm w-full mx-auto">
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
              Send this code to a family member or caregiver. They sign in and enter it to share {petName}&apos;s logs. Single use, expires in 48 hours.
            </p>

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            {loading ? (
              <p className="text-sm text-stone-400">Working…</p>
            ) : active ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-xl tracking-widest text-stone-900 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-center">
                    {active.code}
                  </div>
                  <button
                    type="button"
                    onClick={copy}
                    aria-label="Copy code"
                    className="p-3 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-stone-400">Expires {new Date(active.expiresAt).toLocaleString()}</p>
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
