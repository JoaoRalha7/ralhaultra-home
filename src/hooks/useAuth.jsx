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

  async function fetchProfile(userId, u) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (data && data.twitch_username) { setProfile(data); return }
    // logged in but no profile row (the callback's one-shot insert can fail): create it now from the Twitch data
    const meta = u?.user_metadata || {}
    const row = {
      id: userId,
      twitch_username: meta.name || meta.preferred_username || meta.full_name || '',
      avatar_url: meta.avatar_url || meta.picture || '',
      updated_at: new Date().toISOString(),
    }
    if (!row.twitch_username) return
    const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' })
    if (!error) setProfile({ ...(data || {}), ...row })
    else if (data) setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id, session.user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id, session.user)
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

  const OWNER = '13878854-d588-4c49-ad36-1428920902bd'
  const [extraAdmin, setExtraAdmin] = useState(false)
  useEffect(() => {
    if (!user || user.id === OWNER) { setExtraAdmin(false); return }
    supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setExtraAdmin(!!data), () => setExtraAdmin(false))
  }, [user?.id])
  const isOwner = () => user?.id === OWNER
  const isAdmin = () => user?.id === OWNER || extraAdmin

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
      isOwner,
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