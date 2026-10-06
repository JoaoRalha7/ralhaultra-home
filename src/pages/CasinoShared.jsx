import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useStreamElementsPoints } from '../hooks/useStreamElementsPoints'
import { workerPost } from '../lib/points'
import styles from './Casino.module.css'

export const MIN_BET = 10
export const MAX_BET = 10000
export const fmt = (n) => Number(n ?? 0).toLocaleString('en-GB')

const ERR = {
  insufficient: 'Not enough points.',
  'invalid bet': `Bet must be between ${MIN_BET} and ${fmt(MAX_BET)} points.`,
  unauthorized: 'Log in again to play.',
  not_logged_in: 'Log in with Twitch to play.',
  conflict: 'Something changed, try again.',
}


// ── Sound (tiny WebAudio synth, off by default only if the viewer muted it) ───
let audioCtx = null
const isMuted = () => { try { return localStorage.getItem('casino-mute') === '1' } catch { return false } }
const NOTES = {
  click: [[520, .05]], card: [[320, .05]], gem: [[660, .07], [990, .1]], cash: [[880, .07], [1175, .14]],
  win: [[523, .09], [659, .09], [784, .09], [1047, .22]], lose: [[300, .13], [220, .24]], boom: [[120, .4, 'sawtooth']],
}
export function playSfx(name) {
  if (isMuted()) return
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    audioCtx = audioCtx || new AC()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    let t = audioCtx.currentTime
    for (const [freq, dur, type] of NOTES[name] || []) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain()
      o.type = type || 'sine'; o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + dur + 0.02)
      t += dur * 0.9
    }
  } catch { /* audio is optional */ }
}

export function SoundToggle() {
  const [muted, setMuted] = useState(isMuted)
  const flip = () => {
    const n = !muted
    setMuted(n)
    try { localStorage.setItem('casino-mute', n ? '1' : '0') } catch { /* ignore */ }
    if (!n) playSfx('click')
  }
  return (
    <button type="button" className={styles.snd} onClick={flip} aria-pressed={!muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} title={muted ? 'Sound off' : 'Sound on'}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9z" />
        {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.500a5 5 0 010 7M19 6a8.500 8.500 0 010 12" />}
      </svg>
    </button>
  )
}

// ── Confetti burst (canvas) ───────────────────────────────────────────────────
export function Confetti({ fire, colors = ['#3b82f6', '#93c5fd', '#f5c542', '#34d399', '#f472b6'] }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!fire) return
    const c = ref.current
    if (!c || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const dpr = window.devicePixelRatio || 1
    const w = c.parentElement.clientWidth, h = c.parentElement.clientHeight
    c.width = w * dpr; c.height = h * dpr
    const x = c.getContext('2d'); x.scale(dpr, dpr)
    const ps = Array.from({ length: 110 }, () => ({
      x: w / 2, y: h * 0.62, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 13 - 3,
      r: Math.random() * 5 + 3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, col: colors[(Math.random() * colors.length) | 0],
    }))
    let t0 = performance.now(), raf
    const step = (t) => {
      const dt = Math.min(2, (t - t0) / 16.7); t0 = t
      x.clearRect(0, 0, w, h)
      let alive = 0
      for (const p of ps) {
        p.vy += 0.38 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.vx *= 0.99
        if (p.y < h + 20) alive++
        x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.fillStyle = p.col
        x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); x.restore()
      }
      if (alive) raf = requestAnimationFrame(step); else x.clearRect(0, 0, w, h)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [fire])
  return <canvas ref={ref} className={styles.confetti} aria-hidden="true" />
}

// true for `ms` after the counter changes (drives one-off CSS effects like shake)
export function useFlag(counter, ms = 650) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!counter) return
    setOn(true)
    const t = setTimeout(() => setOn(false), ms)
    return () => clearTimeout(t)
  }, [counter, ms])
  return on
}

export function useCountUp(target, ms = 800) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf; const t0 = performance.now()
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

export function HistoryStrip({ items }) {
  if (!items.length) return <div className={styles.hist}><span className={styles.histEmpty}>Your recent rounds appear here</span></div>
  return (
    <div className={styles.hist} aria-label="Recent rounds">
      {items.map((h, i) => <span key={i} className={`${styles.hChip} ${styles['h_' + h.tone]}`} title={h.title}>{h.label}</span>)}
    </div>
  )
}

// Poker-chip stack for the current bet
const CHIPS = [[5000, '#f59e0b'], [1000, '#8b5cf6'], [500, '#10b981'], [100, '#3b82f6'], [25, '#ef4444'], [10, '#94a3b8']]
export function ChipStack({ amount }) {
  const chips = []
  let rest = Math.max(0, Number(amount) || 0)
  for (const [v, c] of CHIPS) { let n = Math.min(Math.floor(rest / v), 4); rest -= n * v; while (n-- > 0 && chips.length < 9) chips.push(c) }
  if (!chips.length) chips.push('#94a3b8')
  return (
    <div className={styles.chips} aria-hidden="true">
      {chips.map((c, i) => (
        <svg key={i} viewBox="0 0 48 48" width="48" height="48" style={{ '--i': i }}>
          <circle cx="24" cy="24" r="22" fill={c} /><circle cx="24" cy="24" r="22" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="3" strokeDasharray="7 7" />
          <circle cx="24" cy="24" r="14" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" />
        </svg>
      ))}
    </div>
  )
}

// Shared game plumbing: login/points, resuming an active round, start/act calls.
export function useCasino(game) {
  const { user, profile } = useAuth()
  const twitchUser = profile?.twitch_username || user?.user_metadata?.name || null
  const { points, setPoints, refresh } = useStreamElementsPoints(twitchUser)
  const [round, setRound] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [offset, setOffset] = useState(0) // server clock minus local clock


  // ── session history, sound and effects driven by round transitions ──
  const hkey = `casino-hist-${game}`
  const [history, setHistory] = useState(() => { try { return JSON.parse(localStorage.getItem(hkey)) || [] } catch { return [] } })
  const [fire, setFire] = useState(0)
  const [shake, setShake] = useState(0)
  const seen = useRef({ id: null, status: null, n: -1 })

  useEffect(() => {
    const r = round
    if (!r) { seen.current = { id: null, status: null, n: -1 }; return }
    const prev = seen.current
    const n = (r.revealed?.length ?? r.player?.length ?? 0)
    const fresh = prev.id !== null && prev.id === r.id
    if (fresh && n > prev.n) playSfx(game === 'mines' ? 'gem' : 'card')
    if (r.status === 'done' && !(prev.id === r.id && prev.status === 'done')) {
      const win = r.payout > r.bet, push = r.payout === r.bet && r.payout > 0
      if (fresh || prev.id === null) {
        playSfx(win ? 'win' : push ? 'cash' : game === 'mines' ? 'boom' : 'lose')
        if (win) setFire((f) => f + 1); else if (!push) setShake((x) => x + 1)
      }
      const item = game === 'mines'
        ? { tone: win ? 'win' : 'lose', label: win ? `${(r.payout / r.bet).toFixed(2)}x` : 'Mine', title: `${win ? '+' : '-'}${fmt(Math.abs(r.payout - r.bet))} pts` }
        : game === 'blackjack'
          ? { tone: win ? 'win' : push ? 'push' : 'lose', label: win ? 'Win' : push ? 'Push' : 'Loss', title: `${win ? '+' : push ? '' : '-'}${fmt(Math.abs(r.payout - r.bet))} pts` }
          : { tone: r.cashedAt ? 'win' : 'lose', label: `${(r.cashedAt || r.crashAt || 1).toFixed(2)}x`, title: r.cashedAt ? `Cashed out, +${fmt(r.payout - r.bet)} pts` : 'Crashed' }
      setHistory((h) => {
        const next = [item, ...h].slice(0, 14)
        try { localStorage.setItem(hkey, JSON.stringify(next)) } catch { /* ignore */ }
        return next
      })
    }
    seen.current = { id: r.id, status: r.status, n }
  }, [round]) // eslint-disable-line react-hooks/exhaustive-deps

  const apply = useCallback((data) => {
    if (data.newPoints != null) setPoints(data.newPoints)
    if (data.state) { setRound(data.state); setOffset((data.state.serverNow || Date.now()) - Date.now()) }
  }, [setPoints])

  useEffect(() => {
    if (!user) return
    let off = false
    workerPost('/casino/state', { game }).then(({ ok, data }) => { if (!off && ok && data.active) apply(data) })
    return () => { off = true }
  }, [user, game, apply])

  const call = useCallback(async (path, body) => {
    setBusy(true); setErr('')
    try {
      const { ok, data } = await workerPost(path, { game, ...body })
      apply(data)
      if (!ok) { setErr(ERR[data.error] || 'Something went wrong. Try again.'); return null }
      return data
    } catch { setErr('Connection error. Try again.'); return null }
    finally { setBusy(false) }
  }, [game, apply])

  const start = useCallback((body) => call('/casino/start', body), [call])
  const act = useCallback((action, extra) => call('/casino/action', { action, ...extra }), [call])
  const poll = useCallback(async () => {
    const { ok, data } = await workerPost('/casino/state', { game })
    if (ok && data.active !== undefined && data.state) apply(data)
  }, [game, apply])

  return { user, twitchUser, points, round, setRound, busy, err, setErr, start, act, poll, offset, refresh, history, fire, shake }
}

export function Page({ title, sub, game, children }) {
  return (
    <div className={styles.page} data-game={game}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.sub}>{sub}</p>
        </div>
        <SoundToggle />
      </header>
      {children}
    </div>
  )
}

export const Coin = ({ s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5h4a1.7 1.7 0 010 3.5h-3a1.7 1.7 0 000 3.5h4" strokeLinecap="round" /></svg>
)

// Bet input with quick buttons. `locked` freezes it while a round is running.
export function BetPanel({ points, bet, setBet, locked, children, loggedIn }) {
  const cap = Math.max(MIN_BET, Math.min(MAX_BET, points ?? MAX_BET))
  const set = (v) => setBet(Math.max(MIN_BET, Math.min(cap, Math.floor(v) || MIN_BET)))
  return (
    <aside className={styles.panel}>
      <div className={styles.balance}>
        <Coin s={22} />
        <div><b>{points != null ? fmt(points) : loggedIn ? '...' : 'Log in'}</b><small>{points != null ? 'your points' : 'to play with your points'}</small></div>
      </div>
      <label className={styles.lbl} htmlFor="bet">Bet</label>
      <div className={styles.betRow}>
        <input id="bet" type="number" inputMode="numeric" min={MIN_BET} max={cap} value={bet} disabled={locked}
          onChange={(e) => setBet(e.target.value === '' ? '' : Math.floor(Number(e.target.value)))}
          onBlur={() => set(bet)} />
        <span><Coin s={16} /></span>
      </div>
      <div className={styles.quick}>
        <button type="button" disabled={locked} onClick={() => set(MIN_BET)}>Min</button>
        <button type="button" disabled={locked} onClick={() => set(bet / 2)}>1/2</button>
        <button type="button" disabled={locked} onClick={() => set(bet * 2)}>2x</button>
        <button type="button" disabled={locked} onClick={() => set(cap)}>Max</button>
      </div>
      {children}
    </aside>
  )
}

export function Result({ won, push, payout, bet, label, onAgain }) {
  const shown = useCountUp(won ? payout : 0)
  return (
    <div className={`${styles.result} ${won ? styles.resWin : push ? styles.resPush : styles.resLose}`} role="status">
      <div className={styles.resMain}>
        <b>{label}</b>
        <span>{won ? `+${fmt(payout - bet)} points profit` : push ? 'Bet returned' : `-${fmt(bet)} points`}</span>
      </div>
      {won && <div className={styles.resAmt}>{fmt(shown)}<small>pts</small></div>}
      {onAgain && <button type="button" onClick={onAgain}>New round</button>}
    </div>
  )
}
