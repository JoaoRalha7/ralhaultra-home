import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useAuth } from '../hooks/useAuth'
import { workerGet } from '../lib/vip'
import styles from './WelcomePopup.module.css'

const fmt = (n) => Number(n || 0).toLocaleString('en-GB')
const pct = (a, b) => (b > 0 ? Math.max(3, Math.min(100, Math.round((a / b) * 100))) : 100)

// Shown right after the "Setting up your account" screen, on every login (`first` = the very first one).
export default function WelcomePopup({ onClose, first }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [vip, setVip] = useState(null)
  const [picBad, setPicBad] = useState(false)

  useEffect(() => { workerGet('/vip').then(setVip).catch(() => setVip({})) }, [])
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const me = vip?.me
  const levels = vip?.levels || []
  const name = me?.username || profile?.twitch_username || user?.user_metadata?.name || 'there'
  const pic = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null
  const lvl = Number(me?.level) || 0
  const cur = levels.find((l) => l.level === lvl)
  const next = levels.find((l) => l.level === lvl + 1)

  return createPortal(
    <div className={styles.back} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-label="Welcome">
        <div className={styles.ring}>
          {pic && !picBad
            ? <img src={pic} alt="" onError={() => setPicBad(true)} />
            : <span>{String(name).slice(0, 1).toUpperCase()}</span>}
        </div>
        <div className={styles.eyebrow}>{first ? 'Welcome to' : 'Welcome back to'}</div>
        <h1 className={styles.title}>JRALHA, {name}</h1>
        <p className={styles.text}>{first ? 'Your account is ready. Watch the stream, play the games and climb the VIP levels.' : 'Good to see you again. Here is where you stand in the VIP levels.'}</p>

        <div className={styles.level}>
          <svg width="46" height="46" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 4l16 6v12c0 10-6.500 17.500-16 22C14.500 39.500 8 32 8 22V10z" fill="#1d3b78" stroke="#5b9bff" strokeWidth="2" strokeLinejoin="round"/><path d="M24 15l2.600 5.300 5.800.8-4.200 4.100 1 5.800L24 28.200l-5.200 2.800 1-5.800-4.200-4.100 5.800-.8z" fill="#cfe1ff"/></svg>
          <div className={styles.lv}>
            <span>Your level</span>
            <b>{cur?.name || 'Member'}</b>
          </div>
          <i>Level {lvl}</i>
        </div>

        {next && me && (
          <div className={styles.bars}>
            <div className={styles.barHead}><span>Next: {next.name}</span><span>{fmt(me.wagered)} / {fmt(next.min_wagered)} wagered</span></div>
            <div className={styles.bar}><div style={{ width: `${pct(me.wagered, Number(next.min_wagered))}%` }} /></div>
            <div className={styles.barHead}><span>Watchtime since reset</span><span>{Math.floor((me.vipMinutes || 0) / 60)} / {next.min_watch_hours}h</span></div>
            <div className={`${styles.bar} ${styles.green}`}><div style={{ width: `${pct((me.vipMinutes || 0) / 60, Number(next.min_watch_hours))}%` }} /></div>
          </div>
        )}

        <button type="button" className={styles.go} onClick={onClose}>Let's go</button>
        <button type="button" className={styles.link} onClick={() => { onClose(); navigate('/vip') }}>See all VIP levels</button>
      </div>
    </div>,
    document.body,
  )
}
