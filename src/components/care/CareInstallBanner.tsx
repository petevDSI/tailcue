'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY = 'tc_install_banner_dismissed'

function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua)
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua)
  return isIos && isSafari
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as { standalone?: boolean }).standalone === true
}

export function CareInstallBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isIosSafari()) return
    if (isStandalone()) return
    if (sessionStorage.getItem(STORAGE_KEY)) return
    const t = setTimeout(() => setVisible(true), 1200)
    return () => clearTimeout(t)
  }, [])

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="mx-4 mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-3">
      <div className="shrink-0 mt-0.5">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 2v10M6 5.5L10 2l4 3.5"
            stroke="#F59E0B"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="3" y="9" width="14" height="9" rx="2" stroke="#F59E0B" strokeWidth="1.8" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-900 mb-0.5">Add Tailcue Care to your home screen</p>
        <p className="text-xs text-amber-800 leading-relaxed">
          Tap the{' '}
          <svg
            width="13"
            height="13"
            viewBox="0 0 20 20"
            fill="none"
            className="inline-block align-text-bottom mx-0.5"
            aria-label="Share"
          >
            <path
              d="M10 2v10M6 5.5L10 2l4 3.5"
              stroke="#92400e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="3" y="9" width="14" height="9" rx="2" stroke="#92400e" strokeWidth="2" />
          </svg>{' '}
          button in Safari, then tap <strong>Add to Home Screen</strong>. Opens instantly, no browser bar.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-amber-400 hover:text-amber-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
