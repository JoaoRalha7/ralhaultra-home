import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'

const SE_WORKER_URL = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'

const STEPS = [
  { id: 'session', label: 'Validating session'   },
  { id: 'profile', label: 'Loading your profile' },
  { id: 'points',  label: 'Syncing your points'  },
  { id: 'done',    label: 'All set!'              },
]

function StepRow({ label, status, index }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '13px 18px', borderRadius: 12,
      background: status === 'running' ? 'rgba(59,130,246,.10)'
                : status === 'done'    ? 'rgba(34,197,94,.06)'
                : 'transparent',
      border: `1px solid ${
        status === 'running' ? 'rgba(59,130,246,.25)'
        : status === 'done'  ? 'rgba(34,197,94,.15)'
        : 'rgba(255,255,255,.05)'
      }`,
      transition: 'background .35s, border-color .35s',
    }}>
      <div style={{ width: 28, height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {status === 'running' && (
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid rgba(59,130,246,.25)',
            borderTopColor: '#3b82f6',
            animation: 'spin .7s linear infinite',
          }} />
        )}
        {status === 'done' && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="rgba(34,197,94,.15)" stroke="rgba(34,197,94,.4)" strokeWidth="1.5"/>
            <path d="M8 12.5l2.5 2.5 5-5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {status === 'idle' && (
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.2)', fontFamily: 'Rubik, sans-serif' }}>
            {index + 1}
          </span>
        )}
      </div>
      <span style={{
        fontFamily: 'Rubik, sans-serif',
        fontSize: 14, fontWeight: status === 'running' ? 700 : 500,
        color: status === 'running' ? '#fff'
             : status === 'done'    ? 'rgba(255,255,255,.7)'
             : 'rgba(255,255,255,.25)',
        transition: 'color .3s', letterSpacing: '.01em',
      }}>
        {label}
      </span>
    </div>
  )
}

export default function AccountSetupOverlay() {
  const { setIsSettingUp, user, profile } = useAuth()
  const pic = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null
  const [picBad, setPicBad] = useState(false)
  const [statuses,  setStatuses]  = useState({ session: 'running', profile: 'idle', points: 'idle', done: 'idle' })
  const [completed, setCompleted] = useState(0)
  const [visible,   setVisible]   = useState(true)
  const didRun = useRef(false)

  function setStep(id, status) {
    setStatuses(prev => ({ ...prev, [id]: status }))
  }
  function advance(id) {
    setStep(id, 'done')
    setCompleted(prev => prev + 1)
  }

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    async function run() {
      // Step 1 — session já existe (veio do AuthCallback)
      await new Promise(r => setTimeout(r, 1000))
      advance('session')

      // Step 2 — profile
      setStep('profile', 'running')
      await new Promise(r => setTimeout(r, 1200))
      advance('profile')

      // Step 3 — points
      setStep('points', 'running')
      const username = profile?.twitch_username || user?.user_metadata?.name || ''
      try {
        if (username) await fetch(`${SE_WORKER_URL}?username=${username.toLowerCase()}`)
      } catch (_) {}
      await new Promise(r => setTimeout(r, 1300))
      advance('points')

      // Step 4 — done
      setStep('done', 'running')
      await new Promise(r => setTimeout(r, 1400))
      advance('done')

      // Fade out e remove
      await new Promise(r => setTimeout(r, 1200))
      setVisible(false)
      await new Promise(r => setTimeout(r, 400))
      setIsSettingUp(false)
    }

    run()
  }, [setIsSettingUp, user, profile])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      background: 'rgba(8,10,15,.75)',
      opacity: visible ? 1 : 0,
      transition: 'opacity .4s ease',
      pointerEvents: visible ? 'all' : 'none',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes setupFadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }`}</style>

      <div style={{
        width: '100%', maxWidth: 400, margin: '0 20px',
        animation: 'setupFadeUp .4s ease both',
      }}>

        {/* Twitch picture of the person logging in; the site logo while it is not available */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ height: 60, minWidth: 60, padding: pic && !picBad ? 0 : '0 22px', borderRadius: 16, margin: '0 auto', display: 'inline-grid', placeItems: 'center', overflow: 'hidden', background: 'linear-gradient(135deg, #1b2238, #10131d)', border: '1px solid rgba(255,255,255,.1)' }}>
            {pic && !picBad
              ? <img src={pic} alt="" onError={() => setPicBad(true)} style={{ width: 60, height: 60, objectFit: 'cover', display: 'block' }} />
              : <img src="/assets/logo-jralha-beta.png" alt="JRALHA Beta" style={{ height: 34, width: 'auto', objectFit: 'contain' }} />}
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#0c0f17',
          border: '1px solid rgba(255,255,255,.09)',
          borderRadius: 24, padding: '30px 26px',
          boxShadow: '0 24px 80px rgba(0,0,0,.6)',
        }}>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '.01em', fontFamily: 'Rubik, sans-serif' }}>
              Setting up your account
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(232,238,252,.4)', lineHeight: 1.5, fontFamily: 'Rubik, sans-serif' }}>
              This only takes a moment.
            </p>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.3)', letterSpacing: '.04em', fontFamily: 'Rubik, sans-serif' }}>PROGRESS</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', fontFamily: 'Rubik, sans-serif' }}>{completed} of {STEPS.length} steps</span>
            </div>
            <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                background: '#3b82f6',
                width: `${(completed / STEPS.length) * 100}%`,
                transition: 'width .5s cubic-bezier(.4,0,.2,1)',
              }} />
            </div>
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STEPS.map((step, i) => (
              <StepRow key={step.id} label={step.label} status={statuses[step.id]} index={i} />
            ))}
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,.18)', letterSpacing: '.02em', fontFamily: 'Rubik, sans-serif' }}>
          18+ · Gamble responsibly
        </p>
      </div>
    </div>
  )
}