'use client'

import { useState, useEffect } from 'react'
import { Cloud, X } from 'lucide-react'
import { useCareAuth } from './CareAuthProvider'
import { getLocalEntryCount } from '@/lib/care-storage'

const ENTRY_THRESHOLD = 3
const DISMISS_KEY = 'tailcue_care_nudge_dismissed'

export function CareSyncNudge() {
  const { user, openSignIn, syncVersion } = useCareAuth()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (user) {
      setShow(false)
      return
    }
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      // ignore
    }
    setShow(!dismissed && getLocalEntryCount() >= ENTRY_THRESHOLD)
  }, [user, syncVersion])

  if (!show) return null

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3">
      <Cloud className="w-4 h-4 text-amber-600 shrink-0" />
      <p className="text-xs text-stone-700 flex-1 leading-snug">
        Sign in to back up your logs, sync across all your devices, and share care with family.
      </p>
      <button
        type="button"
        onClick={openSignIn}
        className="text-xs font-semibold text-amber-700 hover:text-amber-800 whitespace-nowrap"
      >
        Sign in
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, '1')
          } catch {
            // ignore
          }
          setShow(false)
        }}
        className="text-amber-500 hover:text-amber-700 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
