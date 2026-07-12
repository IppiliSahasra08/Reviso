'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface SessionContextValue {
  user: User | null
  loading: boolean
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
})

export function SessionProvider({
  initialUser = null,
  children,
}: {
  initialUser?: User | null
  children: ReactNode
}) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [loading, setLoading] = useState(!initialUser)

  useEffect(() => {
    const supabase = createClient()

    if (!initialUser) {
      supabase.auth.getUser().then(({ data }) => {
        setUser(data.user)
        setLoading(false)
      })
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SessionContext.Provider value={{ user, loading }}>
      {children}
    </SessionContext.Provider>
  )
}

/** Read the current Supabase auth user anywhere below <SessionProvider>. */
export function useSession() {
  return useContext(SessionContext)
}