'use client'

import { UserPlus } from 'lucide-react'
import { useCareAuth } from './CareAuthProvider'

export function CareJoinButton({ className }: { className?: string }) {
  const { user, openJoin, openSignIn } = useCareAuth()
  return (
    <button
      type="button"
      onClick={() => (user ? openJoin() : openSignIn())}
      className={
        className ??
        'flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 border border-amber-200 hover:border-amber-300 bg-white rounded-xl px-3 py-1.5 transition-colors'
      }
    >
      <UserPlus className="w-3.5 h-3.5" />
      Join a pet
    </button>
  )
}
