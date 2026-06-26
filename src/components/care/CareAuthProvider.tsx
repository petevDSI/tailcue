'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { migrateLocalToRemote } from '@/lib/care-migrate'
import { CareSignIn } from './CareSignIn'

interface CareAuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  syncVersion: number
  signInOpen: boolean
  openSignIn: () => void
  closeSignIn: () => void
  signInWithGoogle: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const CareAuthContext = createContext<CareAuthContextValue | null>(null)

let migrationAttempted = false

async function upsertCareUser(user: User) {
  const supabase = getSupabaseBrowser()
  await supabase.from('care_users').upsert(
    {
      id: user.id,
      email: user.email ?? '',
      display_name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? '',
    },
    { onConflict: 'id' }
  )
}

async function runMigrationOnce(bump: () => void) {
  if (migrationAttempted) return
  migrationAttempted = true
  try {
    const n = await migrateLocalToRemote()
    if (n > 0) bump()
  } catch (e) {
    console.error('Care migration failed', e)
    migrationAttempted = false
  }
}

export function CareAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncVersion, setSyncVersion] = useState(0)
  const [signInOpen, setSignInOpen] = useState(false)

  const bumpSync = useCallback(() => setSyncVersion((v) => v + 1), [])

  useEffect(() => {
    const supabase = getSupabaseBrowser()

    supabase.auth.getSession().then(async ({ data: { session: s } }: { data: { session: Session | null } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        await upsertCareUser(s.user)
        await runMigrationOnce(bumpSync)
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, s: Session | null) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        upsertCareUser(s.user)
        runMigrationOnce(bumpSync)
        setSignInOpen(false)
      }
      bumpSync()
    })

    return () => subscription.unsubscribe()
  }, [bumpSync])

  const openSignIn = useCallback(() => setSignInOpen(true), [])
  const closeSignIn = useCallback(() => setSignInOpen(false), [])

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }, [])

  const signInWithMagicLink = useCallback(async (email: string) => {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
  }, [])

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
  }, [])

  return (
    <CareAuthContext.Provider
      value={{
        user,
        session,
        loading,
        syncVersion,
        signInOpen,
        openSignIn,
        closeSignIn,
        signInWithGoogle,
        signInWithMagicLink,
        signOut,
      }}
    >
      {children}
      {signInOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <CareSignIn onDismiss={closeSignIn} />
        </div>
      )}
    </CareAuthContext.Provider>
  )
}

export function useCareAuth() {
  const ctx = useContext(CareAuthContext)
  if (!ctx) throw new Error('useCareAuth must be used within CareAuthProvider')
  return ctx
}
