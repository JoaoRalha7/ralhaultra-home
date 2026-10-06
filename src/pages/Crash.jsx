import { useEffect, useRef, useState } from 'react'
import { BetPanel, Page, Result, fmt, useCasino, MIN_BET } from './CasinoShared'
import styles from './Casino.module.css'

const multAt = (rate, ms) => Math.floor(Math.exp(rate * Math.max(0, ms)) * 100) / 100

function Graph({ rate, ms, mult, crashed }) {
  const W = 640, H = 300, P = 24
  const tMax = Math.max(8000, ms * 1.15)
  const yMax = Math.max(2, mult * 1.15)
  const pts = []
  const steps = 60
  for (let i = 0; i <= steps; i++) {
    const t = (Math.max(ms, 0) * i) / steps
    const m = Math.exp(rate * t)
    pts.push(`${(P + (t / tMax) * (W - 2 * P)).toFixed(1)},${(H - P - ((m - 1) / (yMax - 1)) * (H - 2 * P)).toFixed(1)}`)
  }
  const last = pts[pts.length - 1].split(',')
  return (
    <svg className={styles.graph} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Multiplier curve">
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={P} x2={W - P} y1={P + f * (H - 2 * P)} y2={P + f * (H - 2 * P)} stroke="currentColor" strokeOpacity=".08" />)}
      <polyline points={pts.join(' ')} fill="none" stroke={crashed ? '#f87171' : '#3b82f6'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="6" fill={crashed ? '#f87171' : '#93c5fd'} />
    </svg>
  )
}

export default function Crash() {
  const g = useCasino('crash')
  const [bet, setBet] = useState(100)
  const [auto, setAuto] = useState('')
  const [now, setNow] = useState(Date.now())
  const r = g.round
  const active = r?.status === 'active'
  const done = r?.status === 'done'
  const raf = useRef(0)

  // smooth local clock while a round runs
  useEffect(() => {
    if (!active) return
    const tick = () => { setNow(Date.now()); raf.current = requestAnimationFrame(tick) }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [active])

  // ask the server whether the round crashed (it alone knows the crash point)
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => g.poll(), 450)
    return () => clearInterval(t)
  }, [active, g.poll])

  const serverNow = now + g.offset
  const ms = r ? serverNow - r.startedAt : 0
  const live = active ? multAt(r.rate, ms) : null
  const crashed = done && !r.cashedAt
  const shown = done ? (r.cashedAt || r.crashAt) : (live ?? 1)
  const starting = active && ms < 0
  const potential = active && live ? Math.floor(r.bet * live) : 0

  return (
    <Page title="Crash" sub="The multiplier keeps climbing until it crashes. Cash out before it does.">
      <div className={styles.layout}>
        <BetPanel points={g.points} bet={bet} setBet={setBet} locked={active} loggedIn={!!g.user}>
          <label className={styles.lbl} htmlFor="auto">Auto cash out (optional)</label>
          <div className={styles.betRow}>
            <input id="auto" type="number" step="0.1" min="1.01" placeholder="e.g. 2.00" value={auto} disabled={active} onChange={(e) => setAuto(e.target.value)} />
            <span>x</span>
          </div>
          {active ? (
            <button type="button" className={styles.cta} disabled={g.busy || starting} onClick={() => g.act('cashout')}>
              {starting ? 'Starting...' : `Cash out ${fmt(potential)}`}
            </button>
          ) : (
            <button type="button" className={styles.cta} disabled={g.busy || !g.user || Number(bet) < MIN_BET}
              onClick={() => g.start({ bet: Number(bet), auto: auto === '' ? null : Number(auto) })}>
              {g.user ? 'Place bet' : 'Log in to play'}
            </button>
          )}
          {g.err && <p className={styles.err}>{g.err}</p>}
        </BetPanel>

        <section className={styles.stage}>
          <div className={`${styles.crashBox} ${crashed ? styles.crashed : ''}`}>
            <Graph rate={r?.rate || 0.00008} ms={Math.max(0, done ? Math.log(shown) / (r?.rate || 0.00008) : ms)} mult={shown} crashed={crashed} />
            <div className={styles.big}>
              {starting ? <span className={styles.wait}>Get ready</span> : <span>{shown.toFixed(2)}<small>x</small></span>}
              {crashed && <em>Crashed</em>}
            </div>
          </div>
          {done && <Result won={r.payout > 0} payout={r.payout} bet={r.bet}
            label={crashed ? `Crashed at ${r.crashAt.toFixed(2)}x` : `Cashed out ${r.cashedAt.toFixed(2)}x`} onAgain={() => g.setRound(null)} />}
        </section>
      </div>
    </Page>
  )
}
