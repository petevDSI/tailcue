'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCareAuth } from './CareAuthProvider'
import { getReminderPrefRemote, setRemindersEnabledRemote } from '@/lib/care-storage-remote'

export function CareAccountControl() {
  const { user, signOut, openSignIn } = useCareAuth()
  const [open, setOpen] = useState(false)
  const [reminders, setReminders] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()

  // Open automatically when arriving from an email "manage reminders" link
  useEffect(() => {
    if (user && searchParams.get('settings') === '1') setOpen(true)
  }, [user, searchParams])

  // Load current preference the first time the panel opens
  useEffect(() => {
    if (open && reminders === null) {
      getReminderPrefRemote().then(setReminders).catch(() => setReminders(true))
    }
  }, [open, reminders])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!user) {
    return (
      <button
        type="button"
        onClick={openSignIn}
        className="text-xs text-amber-600 hover:text-amber-700 font-semibold transition-colors"
      >
        Sign in to sync
      </button>
    )
  }

  async function toggleReminders() {
    if (reminders === null || saving) return
    const next = !reminders
    setSaving(true)
    setReminders(next) // optimistic
    try {
      await setRemindersEnabledRemote(next)
    } catch {
      setReminders(!next) // revert on failure
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-stone-500 hover:text-stone-700 transition-colors flex items-center gap-1"
      >
        <span className="hidden sm:block max-w-[160px] truncate">{user.email}</span>
        <span className="sm:hidden">Account</span>
        <svg width="10" height="10" viewBox="0 0 12 12" className="opacity-60" aria-hidden="true">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border border-stone-200 bg-white shadow-lg p-3 z-50">
          <p className="text-xs text-stone-400 mb-3 truncate">{user.email}</p>

          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-stone-700 font-medium text-xs">Daily reminders</p>
              <p className="text-stone-400 text-[11px] leading-tight">
                Email nudge when a pet hasn&rsquo;t been logged.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={reminders === true}
              disabled={reminders === null || saving}
              onClick={toggleReminders}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                reminders ? 'bg-amber-500' : 'bg-stone-300'
              } ${reminders === null ? 'opacity-50' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  reminders ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={() => signOut()}
            className="w-full text-left text-xs text-stone-500 hover:text-stone-700 transition-colors border-t border-stone-100 pt-2"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
