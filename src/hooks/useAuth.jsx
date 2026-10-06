import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,         setUser]         = useState(null)
  const [profile,      setProfile]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [isSettingUp,  setIsSettingUp]  = useState(() => {
    const flag = sessionStorage.getItem('showSetupOverlay')
    if (flag) { sessionStorage.removeItem('showSetupOverlay'); return true }
    return false
  })

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInWithTwitch = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'user:read:email',
      },
    })
    if (error) console.error('Twitch login error:', error)
  }

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'local' })
    setUser(null)
    setProfile(null)
  }

  const isAdmin = () => {
    return user?.id === '13878854-d588-4c49-ad36-1428920902bd'
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isSettingUp,
      setIsSettingUp,
      signInWithTwitch,
      signOut,
      isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}