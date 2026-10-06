import { useCallback, useEffect, useState } from 'react'
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

// Shared game plumbing: login/points, resuming an active round, start/act calls.
export function useCasino(game) {
  const { user, profile } = useAuth()
  const twitchUser = profile?.twitch_username || user?.user_metadata?.name || null
  const { points, setPoints, refresh } = useStreamElementsPoints(twitchUser)
  const [round, setRound] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [offset, setOffset] = useState(0) // server clock minus local clock

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

  return { user, twitchUser, points, round, setRound, busy, err, setErr, start, act, poll, offset, refresh }
}

export function Page({ title, sub, children }) {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.sub}>{sub}</p>
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
  return (
    <div className={`${styles.result} ${won ? styles.resWin : push ? styles.resPush : styles.resLose}`} role="status">
      <b>{label}</b>
      <span>{won ? `+${fmt(payout - bet)} points` : push ? 'Bet returned' : `-${fmt(bet)} points`}</span>
      {onAgain && <button type="button" onClick={onAgain}>New round</button>}
    </div>
  )
}
