'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { redeemInvite } from '@/lib/care-storage'

const STATUS_MESSAGES: Record<string, string> = {
  invalid: "That code isn't valid. Double-check it and try again.",
  expired: 'That invite has expired. Ask the owner for a new code.',
  already_used: 'That code has already been used.',
  not_authenticated: 'Please sign in first, then enter the code.',
}

export function CareJoinModal({ onDismiss }: { onDismiss: () => void }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleJoin() {
    const c = code.trim()
    if (!c) return
    setBusy(true)
    setError(null)
    try {
      const { petId, status } = await redeemInvite(c)
      if ((status === 'joined' || status === 'already_member') && petId) {
        onDismiss()
        router.push(`/care/${petId}`)
        return
      }
      setError(STATUS_MESSAGES[status] ?? 'Could not join with that code.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 max-w-sm w-full mx-auto">
      <h2 className="text-lg font-bold text-stone-900 mb-1">Join a shared pet</h2>
      <p className="text-sm text-stone-500 mb-5 leading-relaxed">
        Enter the invite code a pet&apos;s owner shared with you. You&apos;ll be able to view and add to their care logs.
      </p>

      <input
        type="text"
        autoCapitalize="characters"
        placeholder="Invite code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        className="w-full border border-stone-300 rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest text-stone-800 placeholder:text-stone-400 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-amber-400 mb-3"
      />

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <button
        type="button"
        onClick={handleJoin}
        disabled={busy || !code.trim()}
        className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
      >
        {busy ? 'Joining…' : 'Join pet'}
      </button>

      <button
        type="button"
        onClick={onDismiss}
        className="w-full mt-3 text-xs text-stone-400 hover:text-stone-600 transition-colors py-1"
      >
        Cancel
      </button>
    </div>
  )
}
