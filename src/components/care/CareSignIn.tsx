'use client'

import { useState } from 'react'
import { useCareAuth } from './CareAuthProvider'

export function CareSignIn({ onDismiss }: { onDismiss?: () => void }) {
  const { signInWithGoogle, signInWithMagicLink } = useCareAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleMagicLink() {
    if (!email.trim()) return
    setSending(true)
    await signInWithMagicLink(email.trim())
    setSent(true)
    setSending(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 max-w-sm w-full mx-auto">
      <h2 className="text-lg font-bold text-stone-900 mb-1">Sync your pet&apos;s care across devices</h2>
      <p className="text-sm text-stone-500 mb-6 leading-relaxed">
        Sign in to back up logs, access from any device, and share with your vet or family.
      </p>

      {sent ? (
        <div className="text-center py-4">
          <p className="text-sm font-semibold text-stone-800 mb-1">Check your email</p>
          <p className="text-sm text-stone-500">We sent a sign-in link to <strong>{email}</strong>.</p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-2.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 font-semibold text-sm py-2.5 rounded-xl transition-colors mb-4"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 border-t border-stone-200" />
            <span className="text-xs text-stone-400">or</span>
            <div className="flex-1 border-t border-stone-200" />
          </div>

          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleMagicLink()}
            className="w-full border border-stone-300 rounded-xl px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 mb-3"
          />
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={sending || !email.trim()}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
          >
            {sending ? 'Sending…' : 'Email me a sign-in link'}
          </button>
        </>
      )}

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="w-full mt-3 text-xs text-stone-400 hover:text-stone-600 transition-colors py-1"
        >
          Continue without signing in
        </button>
      )}
    </div>
  )
}
