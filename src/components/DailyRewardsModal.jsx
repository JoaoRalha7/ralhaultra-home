import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import styles from './DailyRewardsModal.module.css'

const SE_WORKER_URL = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'

const PRIZES = [
  { label: '10 pts',     points: 10,   weight: 35, color: '#4338ca', light: '#818cf8' },
  { label: '25 pts',     points: 25,   weight: 25, color: '#1d4ed8', light: '#60a5fa' },
  { label: '50 pts',     points: 50,   weight: 20, color: '#0369a1', light: '#38bdf8' },
  { label: '100 pts',    points: 100,  weight: 10, color: '#065f46', light: '#34d399' },
  { label: '250 pts',    points: 250,  weight: 7,  color: '#92400e', light: '#fbbf24' },
  { label: '500 pts',    points: 500,  weight: 2,  color: '#9a3412', light: '#fb923c' },
  { label: 'JACKPOT 1K', points: 1000, weight: 1,  color: '#713f12', light: '#facc15' },
]

const STREAK_DAYS = [
  { day: 1, pts: 50  },
  { day: 2, pts: 75  },
  { day: 3, pts: 100 },
  { day: 4, pts: 150 },
  { day: 5, pts: 200 },
  { day: 6, pts: 300 },
  { day: 7, pts: 500 },
]

const SLICE = 360 / PRIZES.length

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

// ── Wheel canvas ────────────────────────────────────────────────────────────────
function WheelCanvas({ spinning, targetIndex, onSpinEnd, winIndex }) {
  const canvasRef = useRef(null)
  const rotRef    = useRef(0)
  const rafRef    = useRef(null)

  function drawWheel(ctx, W, rot, winIdx = -1) {
    const CX = W/2, CY = W/2, R = CX - 8
    ctx.clearRect(0, 0, W, W)

    // Outer subtle ring
    ctx.beginPath()
    ctx.arc(CX, CY, R + 4, 0, Math.PI*2)
    ctx.strokeStyle = winIdx >= 0 ? 'rgba(34,197,94,.2)' : 'rgba(99,102,241,.15)'
    ctx.lineWidth = 8
    ctx.stroke()

    PRIZES.forEach((p, i) => {
      const start  = ((i * SLICE) - 90 + rot) * Math.PI/180
      const end    = (((i+1) * SLICE) - 90 + rot) * Math.PI/180
      const mid    = (start + end) / 2
      const isWin  = winIdx === i

      // Dark alternating fill
      ctx.beginPath()
      ctx.moveTo(CX, CY)
      ctx.arc(CX, CY, R, start, end)
      ctx.closePath()
      if (isWin) {
        const gWin = ctx.createRadialGradient(CX, CY, 0, CX, CY, R)
        gWin.addColorStop(0, 'rgba(34,197,94,.18)')
        gWin.addColorStop(1, 'rgba(34,197,94,.04)')
        ctx.fillStyle = gWin
      } else {
        ctx.fillStyle = i % 2 === 0 ? '#0d1020' : '#0a0d1a'
      }
      ctx.fill()

      // Colored accent arc near rim
      ctx.beginPath()
      ctx.arc(CX, CY, R - 5, start + 0.05, end - 0.05)
      if (isWin) {
        ctx.strokeStyle = '#22c55e'
        ctx.lineWidth = 5
        ctx.shadowColor = '#22c55e'
        ctx.shadowBlur = 12
      } else {
        ctx.strokeStyle = p.light
        ctx.lineWidth = 4
        ctx.shadowColor = p.light
        ctx.shadowBlur = 6
      }
      ctx.stroke()
      ctx.shadowBlur = 0

      // Divider
      ctx.beginPath()
      ctx.moveTo(CX, CY)
      ctx.lineTo(CX + R * Math.cos(start), CY + R * Math.sin(start))
      ctx.strokeStyle = 'rgba(255,255,255,.06)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Label
      ctx.save()
      ctx.translate(CX, CY)
      ctx.rotate(mid)
      ctx.textAlign = 'right'
      ctx.shadowColor = 'rgba(0,0,0,.9)'
      ctx.shadowBlur = 5
      ctx.font = `800 ${p.label.includes('JACKPOT') ? 9 : 11}px Rubik,sans-serif`
      ctx.fillStyle = isWin ? '#fff' : 'rgba(255,255,255,.85)'
      ctx.fillText(p.label, R - 28, 4)
      ctx.restore()
    })

    // Gold border
    ctx.beginPath()
    ctx.arc(CX, CY, R, 0, Math.PI*2)
    ctx.strokeStyle = winIdx >= 0 ? 'rgba(34,197,94,.5)' : 'rgba(250,204,21,.4)'
    ctx.lineWidth = 2.5
    ctx.shadowColor = winIdx >= 0 ? 'rgba(34,197,94,.3)' : 'rgba(250,204,21,.2)'
    ctx.shadowBlur = 8
    ctx.stroke()
    ctx.shadowBlur = 0

    // Center disc
    const cGrd = ctx.createRadialGradient(CX-5, CY-5, 2, CX, CY, 26)
    cGrd.addColorStop(0, '#1e1b4b')
    cGrd.addColorStop(1, '#080a0f')
    ctx.beginPath()
    ctx.arc(CX, CY, 24, 0, Math.PI*2)
    ctx.fillStyle = cGrd
    ctx.fill()
    ctx.strokeStyle = 'rgba(250,204,21,.4)'
    ctx.lineWidth = 2
    ctx.stroke()

    // Center star
    ctx.save()
    ctx.translate(CX, CY)
    ctx.rotate(rot * Math.PI/180)
    for (let i=0; i<6; i++) {
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -13)
      ctx.strokeStyle = 'rgba(250,204,21,.15)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.rotate(Math.PI/3)
    }
    ctx.restore()
  }

  // Initial draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    drawWheel(ctx, canvas.width, rotRef.current, winIndex >= 0 ? winIndex : -1)
  }, [winIndex])

  // Spin animation
  useEffect(() => {
    if (!spinning) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width

    const startRot = rotRef.current
    const targetDeg = 360 - (targetIndex * SLICE + SLICE / 2)
    const extra = 5 * 360 + ((targetDeg - startRot % 360) + 360) % 360
    const endRot = startRot + extra
    const t0 = performance.now()
    const dur = 4800

    function easeOut(t) { return 1 - Math.pow(1 - t, 4) }

    function frame(now) {
      const p = Math.min((now - t0) / dur, 1)
      const e = easeOut(p)
      const cur = startRot + (endRot - startRot) * e
      rotRef.current = cur
      drawWheel(ctx, W, cur)
      if (p < 1) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        rotRef.current = endRot % 360
        drawWheel(ctx, W, rotRef.current, targetIndex)
        onSpinEnd()
      }
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [spinning, targetIndex, onSpinEnd])

  return <canvas ref={canvasRef} width={260} height={260} className={styles.wheelCanvas} />
}

// ── Main Modal ──────────────────────────────────────────────────────────────────
export default function DailyRewardsModal({ onClose, onPointsUpdate }) {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('claim')

  // Refs for precise countdown targeting
  const claimTargetTime = useRef(null)
  const wheelTargetTime = useRef(null)

  // Claim state
  const [claimStatus,    setClaimStatus]    = useState('loading')
  const [claimCountdown, setClaimCountdown] = useState(0)
  const [claimLoading,   setClaimLoading]   = useState(false)
  const [claimResult,    setClaimResult]    = useState(null)
  const [streakCount,    setStreakCount]    = useState(0)
  const [todayPts,       setTodayPts]       = useState(50)

  // Wheel state
  const [wheelStatus,    setWheelStatus]    = useState('loading')
  const [wheelCountdown, setWheelCountdown] = useState(0)
  const [spinning,       setSpinning]       = useState(false)
  const [targetIndex,    setTargetIndex]    = useState(0)
  const [winIndex,       setWinIndex]       = useState(-1)
  const [wheelResult,    setWheelResult]    = useState(null)

  const username = profile?.twitch_username || user?.user_metadata?.name || null
  const userId   = user?.id || null

  // ESC to close
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Load cooldowns + streak
  useEffect(() => {
    if (!userId) return
    supabase
      .from('profiles')
      .select('last_daily_claim, last_wheel_spin, streak_count, streak_last_day')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        const now = Date.now()
        const streak = data?.streak_count ?? 0
        setStreakCount(streak)
        
        const dayIdx = streak > 0 ? Math.min(streak - 1, 6) : 0
        setTodayPts(STREAK_DAYS[dayIdx].pts)

        if (data?.last_daily_claim) {
          const diff = now - new Date(data.last_daily_claim).getTime()
          if (diff < 86400000) { 
            setClaimStatus('claimed')
            claimTargetTime.current = now + (86400000 - diff)
            setClaimCountdown(86400000 - diff) 
          } else {
            setClaimStatus('ready')
          }
        } else {
          setClaimStatus('ready')
        }

        if (data?.last_wheel_spin) {
          const diff = now - new Date(data.last_wheel_spin).getTime()
          if (diff < 86400000) { 
            setWheelStatus('claimed')
            wheelTargetTime.current = now + (86400000 - diff)
            setWheelCountdown(86400000 - diff) 
          } else {
            setWheelStatus('ready')
          }
        } else {
          setWheelStatus('ready')
        }
      })
  }, [userId])

  // Claim robust countdown
  useEffect(() => {
    if (claimStatus !== 'claimed' || !claimTargetTime.current) return
    const t = setInterval(() => {
      const remaining = claimTargetTime.current - Date.now()
      if (remaining <= 0) { 
        setClaimStatus('ready')
        setClaimCountdown(0)
        clearInterval(t) 
      } else {
        setClaimCountdown(remaining)
      }
    }, 1000)
    return () => clearInterval(t)
  }, [claimStatus])

  // Wheel robust countdown
  useEffect(() => {
    if (wheelStatus !== 'claimed' || !wheelTargetTime.current) return
    const t = setInterval(() => {
      const remaining = wheelTargetTime.current - Date.now()
      if (remaining <= 0) { 
        setWheelStatus('ready')
        setWheelCountdown(0)
        clearInterval(t) 
      } else {
        setWheelCountdown(remaining)
      }
    }, 1000)
    return () => clearInterval(t)
  }, [wheelStatus])

  async function handleClaim() {
    if (!username || !userId || claimLoading || claimStatus !== 'ready') return
    setClaimLoading(true)
    setClaimResult(null)
    try {
      const res  = await fetch(`${SE_WORKER_URL}/daily/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'already_claimed') { 
          setClaimStatus('claimed')
          claimTargetTime.current = Date.now() + data.nextClaimMs
          setClaimCountdown(data.nextClaimMs) 
        }
        return
      }
      setClaimResult(data.points)
      setClaimStatus('claimed')
      
      const fullDay = 86400000
      claimTargetTime.current = Date.now() + fullDay
      setClaimCountdown(fullDay)
      
      const newStreak = data.streak ?? Math.min(streakCount + 1, 7)
      setStreakCount(newStreak)
      setTodayPts(data.points ?? STREAK_DAYS[Math.min(newStreak - 1, 6)].pts)
      
      onPointsUpdate?.()
    } finally { setClaimLoading(false) }
  }

  // Store wheel result when spinning completes
  const wheelResultRef = useRef(null)
  
  async function handleSpinClick() {
    if (!username || !userId || spinning || wheelStatus !== 'ready') return
    setWheelResult(null)
    wheelResultRef.current = null
    try {
      const res  = await fetch(`${SE_WORKER_URL}/daily/wheel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'already_spun') { 
          setWheelStatus('claimed')
          wheelTargetTime.current = Date.now() + data.nextSpinMs
          setWheelCountdown(data.nextSpinMs) 
        }
        return
      }
      wheelResultRef.current = data
      setTargetIndex(data.prizeIndex)
      setWinIndex(-1)
      setSpinning(true)
      setWheelStatus('spinning')
    } catch (e) { console.error(e) }
  }

  const handleSpinEndFinal = useCallback(() => {
    setSpinning(false)
    setWheelStatus('claimed')
    
    const fullDay = 86400000
    wheelTargetTime.current = Date.now() + fullDay
    setWheelCountdown(fullDay)

    if (wheelResultRef.current) {
      setWheelResult(wheelResultRef.current)
      setWinIndex(wheelResultRef.current.prizeIndex)
    }
    onPointsUpdate?.()
  }, [onPointsUpdate])

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Daily Rewards</h2>
            <p className={styles.modalSub}>Come back every day for bigger rewards</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'claim' ? styles.tabActive : ''}`} onClick={() => setTab('claim')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Daily Claim
            {claimStatus === 'ready' && <span className={styles.tabDot} />}
          </button>
          <button className={`${styles.tab} ${tab === 'wheel' ? styles.tabActive : ''}`} onClick={() => setTab('wheel')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            Spin Wheel
            {wheelStatus === 'ready' && <span className={styles.tabDot} />}
          </button>
        </div>

        {/* ── TAB: CLAIM ── */}
        {tab === 'claim' && (
          <div className={styles.tabContent}>

            {/* Streak days */}
            <div className={styles.streakGrid}>
              {STREAK_DAYS.map(({ day, pts }) => {
                const claimedToday = claimStatus === 'claimed'
                const daysCompleted = claimedToday ? streakCount : streakCount
                const isDone  = day <= daysCompleted && daysCompleted > 0
                const isToday = !claimedToday && day === daysCompleted + 1
                const isBonus = day === 7
                return (
                  <div
                    key={day}
                    className={`${styles.streakDay} ${isDone ? styles.streakDone : ''} ${isToday ? styles.streakToday : ''}`}
                  >
                    <span className={styles.streakDayNum}>DAY {day}</span>
                    <div className={styles.streakCoin}>
                      {isDone ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : isBonus ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isToday ? '#facc15' : 'rgba(250,204,21,.35)'} strokeWidth="2" strokeLinecap="round"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isToday ? '#facc15' : 'rgba(255,255,255,.2)'} strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      )}
                    </div>
                    <span className={styles.streakPts}>{pts}</span>
                  </div>
                )
              })}
            </div>

            {/* Progress bar */}
            <div className={styles.streakProgressWrap}>
              <div className={styles.streakProgressInfo}>
                <span className={styles.streakProgressLeft}>
                  Day {streakCount} of 7 completed
                </span>
                <span className={styles.streakProgressRight}>
                  {claimStatus === 'claimed'
                    ? streakCount === 7 ? '🎉 Full streak!' : `Next: +${STREAK_DAYS[streakCount]?.pts ?? 50} pts on Day ${streakCount + 1}`
                    : `Claim today: +${todayPts} pts`
                  }
                </span>
              </div>
              <div className={styles.streakProgressTrack}>
                <div
                  className={styles.streakProgressFill}
                  style={{ width: `${(streakCount / 7) * 100}%` }}
                />
              </div>
            </div>

            {/* Today's / Next claim */}
            <div className={styles.claimBanner}>
              <div>
                <div className={styles.claimBannerLabel}>
                  {claimStatus === 'claimed' ? 'Next reward' : "Today's reward"}
                </div>
                <div className={styles.claimBannerPts}>
                  + {claimStatus === 'claimed'
                    ? (STREAK_DAYS[Math.min(streakCount, 6)].pts)
                    : todayPts} pts
                </div>
              </div>
              {claimStatus === 'loading' ? (
                <div className={styles.skeleton} style={{ width: 110, height: 38 }} />
              ) : claimStatus === 'ready' ? (
                <button className={styles.claimBtn} onClick={handleClaim} disabled={claimLoading}>
                  {claimLoading ? 'Claiming…' : 'Claim Now'}
                </button>
              ) : (
                <div className={styles.cdPill}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {formatCountdown(claimCountdown)}
                </div>
              )}
            </div>

            {claimResult && (
              <div className={styles.resultBanner}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                +{claimResult} points added to your account!
              </div>
            )}
          </div>
        )}

        {/* ── TAB: WHEEL ── */}
        {tab === 'wheel' && (
          <div className={styles.tabContent}>
            <div className={styles.wheelArea}>

              {/* Pointer + canvas */}
              <div className={styles.wheelWrap}>
                <div className={`${styles.wheelPointer} ${spinning ? styles.pointerSpinning : ''}`}>
                  <svg width="22" height="28" viewBox="0 0 22 28">
                    <defs>
                      <linearGradient id="ptg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#facc15"/>
                        <stop offset="100%" stopColor="#d97706"/>
                      </linearGradient>
                    </defs>
                    <polygon points="11,27 1,1 21,1" fill="url(#ptg)" stroke="rgba(0,0,0,.4)" strokeWidth="1"/>
                    <polygon points="11,20 5,5 17,5" fill="rgba(255,255,255,.22)"/>
                  </svg>
                </div>
                <WheelCanvas spinning={spinning} targetIndex={targetIndex} onSpinEnd={handleSpinEndFinal} winIndex={winIndex} />
              </div>

              {/* Prize list */}
              <div className={styles.prizeList}>
                {PRIZES.map((p, i) => {
                  const isWon = winIndex === i
                  return (
                    <div key={p.label} className={`${styles.prizeItem} ${p.label.includes('JACKPOT') ? styles.prizeJackpot : ''} ${isWon ? styles.prizeWon : ''}`}>
                      <div className={styles.prizeDot} style={{ background: isWon ? '#22c55e' : p.light }} />
                      <span className={styles.prizeLabel} style={isWon ? { color: '#86efac' } : p.label.includes('JACKPOT') ? { color: '#fde68a' } : {}}>{p.label}</span>
                      {isWon
                        ? <svg style={{ marginLeft: 'auto' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        : <span className={styles.prizeChance}>{p.weight}%</span>
                      }
                    </div>
                  )
                })}
              </div>
            </div>

            {wheelResult && (
              <div className={styles.resultBanner} style={{ marginTop: 12 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                You won {wheelResult.prize}! Points added to your account.
              </div>
            )}

            {wheelStatus === 'loading' ? (
              <div className={styles.skeleton} style={{ height: 44, marginTop: 12 }} />
            ) : wheelStatus === 'ready' ? (
              <button className={`${styles.claimBtn} ${styles.spinBtn}`} onClick={handleSpinClick}>
                Spin the Wheel
              </button>
            ) : wheelStatus === 'spinning' ? (
              <button className={`${styles.claimBtn} ${styles.spinBtn}`} disabled style={{ opacity: .5 }}>
                Spinning…
              </button>
            ) : (
              <div className={styles.cdPillFull}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Next spin in {formatCountdown(wheelCountdown)}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}