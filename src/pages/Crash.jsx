import { useEffect, useRef, useState } from 'react'
import { BetPanel, Confetti, HistoryStrip, Page, Result, fmt, playSfx, useCasino, useFlag, MIN_BET } from './CasinoShared'
import styles from './Casino.module.css'

const multAt = (rate, ms) => Math.floor(Math.exp(rate * Math.max(0, ms)) * 100) / 100
const tone = (m) => (m >= 10 ? 'gold' : m >= 5 ? 'violet' : m >= 2 ? 'cyan' : 'white')

function Graph({ rate, ms, mult, crashed }) {
  const W = 640, H = 320, PL = 44, PB = 26, PT = 18, PR = 22
  const tMax = Math.max(8000, ms * 1.12)
  const yMax = Math.max(2, mult * 1.18)
  const X = (t) => PL + (t / tMax) * (W - PL - PR)
  const Y = (m) => H - PB - ((m - 1) / (yMax - 1)) * (H - PB - PT)
  const steps = 70
  const pts = []
  for (let i = 0; i <= steps; i++) { const t = (Math.max(ms, 0) * i) / steps; pts.push([X(t), Y(Math.exp(rate * t))]) }
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  const [px, py] = pts[Math.max(0, pts.length - 4)]
  const ang = (Math.atan2(ly - py, lx - px) * 180) / Math.PI
  const col = crashed ? '#f87171' : '#60a5fa'
  const ticks = [1, 1.5, 2, 3, 5, 10, 20, 50, 100].filter((v) => v <= yMax)
  return (
    <svg className={styles.graph} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Multiplier curve">
      <defs>
        <linearGradient id="crArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={col} stopOpacity=".35" /><stop offset="1" stopColor={col} stopOpacity="0" /></linearGradient>
        <filter id="crGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PL} x2={W - PR} y1={Y(v)} y2={Y(v)} stroke="#fff" strokeOpacity=".07" />
          <text x={PL - 8} y={Y(v) + 4} textAnchor="end" className={styles.axis}>{v}x</text>
        </g>
      ))}
      <polygon points={`${PL},${H - PB} ${line} ${lx},${H - PB}`} fill="url(#crArea)" />
      <polyline points={line} fill="none" stroke={col} strokeWidth="9" strokeOpacity=".5" strokeLinecap="round" strokeLinejoin="round" filter="url(#crGlow)" />
      <polyline points={line} fill="none" stroke={col} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {crashed ? (
        <g transform={`translate(${lx} ${ly})`} className={styles.boomFx}>
          <circle r="10" fill="#fca5a5" /><circle r="22" fill="none" stroke="#f87171" strokeWidth="3" /><circle r="38" fill="none" stroke="#f87171" strokeOpacity=".5" strokeWidth="2" />
        </g>
      ) : (
        <g transform={`translate(${lx} ${ly}) rotate(${ang})`}>
          <path d="M-18 -7l-9 -6 3 6 -3 6zM-18 -7h22c8 0 13 3 15 7-2 4-7 7-15 7h-22z" fill="#e0ecff" stroke="#93c5fd" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="2" cy="0" r="3.500" fill="#3b82f6" />
          <path d="M-28 -3l-14 3 14 3z" fill="#fbbf24" className={styles.flame} />
        </g>
      )}
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
  const shaking = useFlag(g.shake)

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
  const rate = r?.rate || 0.00008

  return (
    <Page game="crash" title="Crash" sub="The multiplier keeps climbing until it crashes. Cash out before it does.">
      <div className={styles.layout}>
        <BetPanel points={g.points} bet={bet} setBet={setBet} locked={active} loggedIn={!!g.user}>
          <label className={styles.lbl} htmlFor="auto">Auto cash out (optional)</label>
          <div className={styles.betRow}>
            <input id="auto" type="number" step="0.1" min="1.01" placeholder="e.g. 2.00" value={auto} disabled={active} onChange={(e) => setAuto(e.target.value)} />
            <span>x</span>
          </div>
          <div className={styles.quick}>
            {[1.5, 2, 5, 10].map((v) => <button key={v} type="button" disabled={active} className={Number(auto) === v ? styles.on : ''} onClick={() => setAuto(String(v))}>{v}x</button>)}
          </div>
          {active ? (
            <button type="button" className={`${styles.cta} ${!starting ? styles.pulse : ''}`} disabled={g.busy || starting} onClick={() => { playSfx('cash'); g.act('cashout') }}>
              {starting ? 'Starting...' : `Cash out ${fmt(potential)}`}
            </button>
          ) : (
            <button type="button" className={styles.cta} disabled={g.busy || !g.user || Number(bet) < MIN_BET}
              onClick={() => { playSfx('click'); g.start({ bet: Number(bet), auto: auto === '' ? null : Number(auto) }) }}>
              {g.user ? 'Place bet' : 'Log in to play'}
            </button>
          )}
          {g.err && <p className={styles.err}>{g.err}</p>}
          <p className={styles.note}>The round starts as soon as you bet. Set an auto cash out to lock in a target.</p>
        </BetPanel>

        <section className={`${styles.stage} ${styles.space} ${shaking ? styles.shake : ''}`}>
          <HistoryStrip items={g.history} />
          <div className={`${styles.crashBox} ${crashed ? styles.crashed : ''}`}>
            <div className={styles.stars} aria-hidden="true" />
            <Graph rate={rate} ms={Math.max(0, done ? Math.log(shown) / rate : ms)} mult={shown} crashed={crashed} />
            <div className={`${styles.big} ${styles['c_' + tone(shown)]}`}>
              {starting ? <span className={styles.wait}>Get ready</span> : <span>{shown.toFixed(2)}<small>x</small></span>}
              {crashed && <em>Crashed</em>}
              {active && r.auto && !starting && <i>Auto at {r.auto.toFixed(2)}x</i>}
            </div>
          </div>
          {done && <Result won={r.payout > 0} payout={r.payout} bet={r.bet}
            label={crashed ? `Crashed at ${r.crashAt.toFixed(2)}x` : `Cashed out ${r.cashedAt.toFixed(2)}x`} onAgain={() => g.setRound(null)} />}
          <Confetti fire={g.fire} colors={['#60a5fa', '#a78bfa', '#f5c542', '#fff', '#22d3ee']} />
        </section>
      </div>
    </Page>
  )
}
