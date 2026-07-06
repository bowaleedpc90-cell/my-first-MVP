import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [agency, setAgency] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) {
        setProfile(null)
        setAgency(null)
        setLoading(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', userId).single()
      let a = null
      if (p?.agency_id) {
        const { data } = await supabase.from('agencies').select('*').eq('id', p.agency_id).single()
        a = data
      }
      if (!cancelled) {
        setProfile(p ?? null)
        setAgency(a)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthCtx.Provider value={{ session, profile, agency, loading, signOut }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}
