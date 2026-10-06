import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function AuthCallback() {
  const navigate       = useNavigate()
  const { setIsSettingUp } = useAuth()
  const didRun         = useRef(false)

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const user = session.user
        const meta = user.user_metadata || {}

        supabase.from('profiles').upsert({
          id: user.id,
          twitch_username: meta.name || meta.preferred_username || '',
          avatar_url: meta.avatar_url || meta.picture || '',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })

        setIsSettingUp(true)
        sessionStorage.setItem('showSetupOverlay', '1')
      }
      navigate('/', { replace: true })
    })
  }, [navigate, setIsSettingUp])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#080a0f',
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        border: '2px solid rgba(255,255,255,.15)',
        borderTopColor: '#3b82f6',
        animation: 'spin .7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}