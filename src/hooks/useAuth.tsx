'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser, Profile, Store } from '@/types'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
  canAccessStore: (storeId: string) => boolean
  hasRole: (...roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true,
  signOut: async () => {},
  canAccessStore: () => false,
  hasRole: () => false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  async function loadUser(userId: string, email: string) {
    const [{ data: profile }, { data: access }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_store_access').select('store_id, stores(*)').eq('user_id', userId),
    ])

    if (!profile) return null

    const p = profile as Profile
    const stores = (access ?? []).map((a: any) => a.stores as Store).filter(Boolean)
    const canAll = p.role === 'admin' || p.role === 'manager'

    return { id: userId, email, profile: p, storeAccess: stores, canAccessAllStores: canAll } as AuthUser
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (u) setUser(await loadUser(u.id, u.email!))
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(await loadUser(session.user.id, session.user.email!))
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const canAccessStore = (storeId: string) => {
    if (!user) return false
    if (user.canAccessAllStores) return true
    return user.storeAccess.some(s => s.id === storeId)
  }

  const hasRole = (...roles: string[]) => {
    return !!user && roles.includes(user.profile.role)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, canAccessStore, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
