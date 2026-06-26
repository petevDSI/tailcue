'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

interface CareAuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const CareAuthContext = createContext<CareAuthContextValue | null>(null)

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

export function CareAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseBrowser()

    supabase.auth.getSession().then(({ data: { session: s } }: { data: { session: Session | null } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
      if (s?.user) upsertCareUser(s.user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, s: Session | null) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) upsertCareUser(s.user)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/care` },
    })
  }, [])

  const signInWithMagicLink = useCallback(async (email: string) => {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/care` },
    })
  }, [])

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
  }, [])

  return (
    <CareAuthContext.Provider value={{ user, session, loading, signInWithGoogle, signInWithMagicLink, signOut }}>
      {children}
    </CareAuthContext.Provider>
  )
}

export function useCareAuth() {
  const ctx = useContext(CareAuthContext)
  if (!ctx) throw new Error('useCareAuth must be used within CareAuthProvider')
  return ctx
}
