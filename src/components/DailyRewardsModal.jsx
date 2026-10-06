import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import styles from './DailyRewardsModal.module.css'

const SE_WORKER_URL = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'

const PRIZES = [
  { label: '10 pts',     points: 10,   weight: 35, color: '#1e3a8a', light: '#60a5fa' },
  { label: '25 pts',     points: 25,   weight: 25, color: '#1d4ed8', light: '#3b82f6' },
  { label: '50 pts',     points: 50,   weight: 20, color: '#0369a1', light: '#22d3ee' },
  { label: '100 pts',    points: 100,  weight: 10, color: '#065f46', light: '#34d399' },
  { label: '250 pts',    points: 250,  weight: 7,  color: '#92400e', light: '#fbbf24' },
  { label: '500 pts',    points: 500,  weight: 2,  color: '#9a3412', light: '#fb923c' },
  { label: 'JACKPOT 1K', points: 1000, weight: 1,  color: '#713f12', light: '#f5c542' },
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
    ctx.strokeStyle = winIdx >= 0 ? 'rgba(52,211,153,.25)' : 'rgba(59,130,246,.22)'
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
        ctx.fillStyle = i % 2 === 0 ? '#121a2b' : '#0e1522'
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
      ctx.font = `800 ${p.label.includes('JACKPOT') ? 11 : 14}px "Bricolage Grotesque","DM Sans",sans-serif`
      ctx.fillStyle = isWin ? '#fff' : 'rgba(255,255,255,.85)'
      ctx.fillText(p.label, R - 24, 5)
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
    const cGrd = ctx.createRadialGradient(CX-5, CY-5, 2, CX, CY, 30)
    cGrd.addColorStop(0, '#1e3a8a')
    cGrd.addColorStop(1, '#0b0e14')
    ctx.beginPath()
    ctx.arc(CX, CY, 28, 0, Math.PI*2)
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

  return <canvas ref={canvasRef} width={320} height={320} className={styles.wheelCanvas} />
}

// ── Main Modal ──────────────────────────────────────────────────────────────────
export default function DailyRewardsModal({ onClose, onPointsUpdate }) {
  const { user, profile } = useAuth()

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

  const claimed = claimStatus === 'claimed'
  const nextPts = STREAK_DAYS[Math.min(streakCount, 6)].pts
  const I = (d, sz = 16, sw = 2) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
  )

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Daily Rewards">

        <header className={styles.head}>
          <span className={styles.headIcon}>{I(<><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></>, 22)}</span>
          <div>
            <h2 className={styles.title}>Daily Rewards</h2>
            <p className={styles.sub}>Claim every day for a bigger streak, and spin once a day for a shot at 1,000 pts.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">{I(<path d="M18 6L6 18M6 6l12 12"/>, 14, 2.5)}</button>
        </header>

        <div className={styles.cols}>

          {/* ── Daily claim ── */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h3>{I(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, 16)}Daily Claim</h3>
              <span className={styles.streakChip}>Day {streakCount} of 7</span>
            </div>

            <div className={styles.streakHero}>
              <b>{streakCount}</b>
              <span>day streak<small>{streakCount >= 7 ? 'Maximum reached' : `${7 - streakCount} to the 500 pts bonus`}</small></span>
            </div>

            <div className={styles.days}>
              {STREAK_DAYS.map(({ day, pts }) => {
                const isDone  = day <= streakCount && streakCount > 0
                const isToday = !claimed && day === streakCount + 1
                const bonus   = day === 7
                return (
                  <div key={day} className={`${styles.day} ${isDone ? styles.done : ''} ${isToday ? styles.today : ''} ${bonus ? styles.bonus : ''}`}>
                    <small>Day {day}</small>
                    <span className={styles.dayIcon}>
                      {isDone ? I(<polyline points="20 6 9 17 4 12"/>, 15, 3)
                        : bonus ? I(<path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/>, 15)
                        : <i className={styles.coin} />}
                    </span>
                    <b>{pts}</b>
                  </div>
                )
              })}
            </div>

            <div className={styles.track}><i style={{ width: `${(streakCount / 7) * 100}%` }} /></div>
            <p className={styles.hint}>
              {claimed
                ? (streakCount >= 7 ? 'Full streak completed. Amazing!' : `Come back tomorrow for +${nextPts} pts on day ${streakCount + 1}.`)
                : `Day 7 pays 500 pts. Keep the streak alive.`}
            </p>

            <div className={styles.reward}>
              <div>
                <small>{claimed ? 'Next reward' : "Today's reward"}</small>
                <b><i className={styles.coin} />+{claimed ? nextPts : todayPts} pts</b>
              </div>
              {claimStatus === 'loading' ? (
                <div className={styles.skeleton} style={{ width: 130, height: 44 }} />
              ) : claimStatus === 'ready' ? (
                <button className={styles.cta} onClick={handleClaim} disabled={claimLoading}>{claimLoading ? 'Claiming…' : 'Claim now'}</button>
              ) : (
                <div className={styles.cd}>{I(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, 14)}{formatCountdown(claimCountdown)}</div>
              )}
            </div>

            {claimResult && (
              <div className={styles.result}>{I(<polyline points="20 6 9 17 4 12"/>, 15, 3)}+{claimResult} points added to your account</div>
            )}
          </section>

          {/* ── Wheel ── */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h3>{I(<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3v6.5M12 14.5V21M3 12h6.5M14.5 12H21"/></>, 16)}Lucky Wheel</h3>
              <span className={styles.streakChip}>1 spin / day</span>
            </div>

            <div className={styles.wheelWrap}>
              <div className={`${styles.pointer} ${spinning ? styles.pointerSpin : ''}`}>
                <svg width="26" height="32" viewBox="0 0 22 28" aria-hidden="true">
                  <defs><linearGradient id="ptg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde68a"/><stop offset="100%" stopColor="#d99a0b"/></linearGradient></defs>
                  <polygon points="11,27 1,1 21,1" fill="url(#ptg)" stroke="rgba(0,0,0,.45)" strokeWidth="1"/>
                </svg>
              </div>
              <WheelCanvas spinning={spinning} targetIndex={targetIndex} onSpinEnd={handleSpinEndFinal} winIndex={winIndex} />
            </div>

            <div className={styles.chips}>
              {PRIZES.map((p, i) => (
                <span key={p.label} className={`${styles.chipP} ${winIndex === i ? styles.won : ''} ${p.points >= 1000 ? styles.jack : ''}`} style={{ '--c': p.light }}>
                  <i />{p.label.replace('JACKPOT ', '')}<small>{p.weight}%</small>
                </span>
              ))}
            </div>

            {wheelResult && (
              <div className={styles.result}>{I(<polyline points="20 6 9 17 4 12"/>, 15, 3)}You won {wheelResult.prize}. Points added.</div>
            )}

            {wheelStatus === 'loading' ? (
              <div className={styles.skeleton} style={{ height: 46 }} />
            ) : wheelStatus === 'ready' ? (
              <button className={styles.cta} onClick={handleSpinClick}>Spin the wheel</button>
            ) : wheelStatus === 'spinning' ? (
              <button className={styles.cta} disabled>Spinning…</button>
            ) : (
              <div className={`${styles.cd} ${styles.cdFull}`}>{I(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, 14)}Next spin in {formatCountdown(wheelCountdown)}</div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
