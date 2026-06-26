'use client'

import { useCareAuth } from './CareAuthProvider'

export function CareAccountControl() {
  const { user, signOut, openSignIn } = useCareAuth()

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-stone-400 hidden sm:block">{user.email}</span>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-xs text-stone-500 hover:text-stone-700 transition-colors"
        >
          Sign out
        </button>
      </div>
    )
  }

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
