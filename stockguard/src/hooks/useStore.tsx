'use client'
import { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import type { Store } from '@/types'
import { useAuth } from './useAuth'
import { createClient } from '@/lib/supabase/client'

interface StoreContextType {
  stores: Store[]
  activeStore: Store | null      // null = "all stores" view
  setActiveStore: (store: Store | null) => void
  loadingStores: boolean
}

const StoreContext = createContext<StoreContextType>({
  stores: [], activeStore: null,
  setActiveStore: () => {},
  loadingStores: true,
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [stores, setStores] = useState<Store[]>([])
  const [activeStore, setActiveStore] = useState<Store | null>(null)
  const [loadingStores, setLoadingStores] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return
    async function load() {
      let result: Store[]
      if (user!.canAccessAllStores) {
        const { data } = await supabase.from('stores').select('*').eq('is_active', true).order('name')
        result = data ?? []
      } else {
        result = user!.storeAccess
      }
      setStores(result)
      // If only one store, auto-select it
      if (result.length === 1) setActiveStore(result[0])
      setLoadingStores(false)
    }
    load()
  }, [user])

  return (
    <StoreContext.Provider value={{ stores, activeStore, setActiveStore, loadingStores }}>
      {children}
    </StoreContext.Provider>
  )
}

export const useStore = () => useContext(StoreContext)
