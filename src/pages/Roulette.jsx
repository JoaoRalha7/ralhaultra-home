import { useEffect, useRef, useState } from 'react'
import { Coin, Confetti, HistoryStrip, Page, SoundToggle, fmt, playSfx, useCasino, MIN_BET, MAX_BET } from './CasinoShared'
import { WHEEL, rColor, ROULETTE } from '../lib/roulette'
import styles from './Casino.module.css'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const num = (v) => Math.max(0, Number(v) || 0)
const CHIPS = [10, 50, 100, 500, 1000]
const SLICE = 360 / WHEEL.length
const short = (n) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(n))
const key = (t, v) => `${t}:${v ?? ''}`

// geometry: viewBox 360, centre 180. pockets r 104-138, ball track r 140-170
const C = 180
const R_TRACK = 156, R_POCKET = 130
const pt = (deg, r) => { const a = ((deg - 90) * Math.PI) / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)] }
function slicePath(i) {
  const a0 = i * SLICE - SLICE / 2, a1 = i * SLICE + SLICE / 2
  const [x0, y0] = pt(a0, 138), [x1, y1] = pt(a1, 138), [x2, y2] = pt(a1, 104), [x3, y3] = pt(a0, 104)
  return `M${x0} ${y0} A138 138 0 0 1 ${x1} ${y1} L${x2} ${y2} A104 104 0 0 0 ${x3} ${y3}Z`
}
const SPOKES = [0, 90, 180, 270]
const DEFLECT = [22, 67, 112, 157, 202, 247, 292, 337]

function Wheel({ wRef, bRef, cRef, spinning, hit, number }) {
  return (
    <div className={`${styles.wheelWrap} ${spinning ? styles.wSpin : ''}`}>
      <svg viewBox="0 0 360 360" className={styles.wheel} role="img" aria-label="Roulette wheel">
        <defs>
          <radialGradient id="rwWood" cx="50%" cy="50%" r="50%"><stop offset="86%" stopColor="#2a1a0c" /><stop offset="100%" stopColor="#0f0a05" /></radialGradient>
          <radialGradient id="rwTrack" cx="50%" cy="50%" r="50%"><stop offset="78%" stopColor="#0a0d14" /><stop offset="90%" stopColor="#1b2230" /><stop offset="100%" stopColor="#0a0d14" /></radialGradient>
          <radialGradient id="rwCone" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#3a2a12" /><stop offset="55%" stopColor="#1b1409" /><stop offset="100%" stopColor="#0d0a05" /></radialGradient>
          <radialGradient id="rwGold" cx="35%" cy="30%" r="80%"><stop offset="0%" stopColor="#fff3c4" /><stop offset="45%" stopColor="#f5c542" /><stop offset="100%" stopColor="#8a5a08" /></radialGradient>
          <radialGradient id="rwBall" cx="35%" cy="30%" r="75%"><stop offset="0%" stopColor="#fff" /><stop offset="60%" stopColor="#e5e7eb" /><stop offset="100%" stopColor="#9ca3af" /></radialGradient>
          <linearGradient id="rwSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity=".22" /><stop offset="45%" stopColor="#fff" stopOpacity="0" /><stop offset="100%" stopColor="#000" stopOpacity=".28" /></linearGradient>
        </defs>

        <circle cx={C} cy={C} r="178" fill="url(#rwWood)" />
        <circle cx={C} cy={C} r="176" fill="none" stroke="#f5c542" strokeWidth="2" />
        <circle cx={C} cy={C} r="170" fill="url(#rwTrack)" />
        <circle cx={C} cy={C} r="170" fill="none" stroke="rgba(245,197,66,.55)" strokeWidth="1" />
        {DEFLECT.map((d) => { const [x, y] = pt(d, 163); return <rect key={d} x={x - 3} y={y - 3} width="6" height="6" transform={`rotate(${d + 45} ${x} ${y})`} fill="url(#rwGold)" /> })}

        <g ref={wRef} transform={`rotate(0 ${C} ${C})`}>
          <circle cx={C} cy={C} r="140" fill="#0b0f16" />
          {WHEEL.map((n, i) => {
            const [tx, ty] = pt(i * SLICE, 120)
            return (
              <g key={n}>
                <path d={slicePath(i)} className={styles['w_' + rColor(n)]} />
                <text x={tx} y={ty} className={styles.wNum} transform={`rotate(${i * SLICE} ${tx} ${ty})`} textAnchor="middle" dominantBaseline="central">{n}</text>
              </g>
            )
          })}
          <circle cx={C} cy={C} r="138" fill="none" stroke="#f5c542" strokeWidth="1.6" />
          <circle cx={C} cy={C} r="104" fill="url(#rwCone)" stroke="#f5c542" strokeWidth="1.4" />
          <circle cx={C} cy={C} r="78" fill="none" stroke="rgba(245,197,66,.25)" strokeWidth="1" />
          {SPOKES.map((d) => {
            const [x1, y1] = pt(d, 22), [x2, y2] = pt(d, 66), [kx, ky] = pt(d, 70)
            return <g key={d}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#rwGold)" strokeWidth="5" strokeLinecap="round" /><circle cx={kx} cy={ky} r="5.500" fill="url(#rwGold)" /></g>
          })}
          <circle cx={C} cy={C} r="24" fill="url(#rwGold)" stroke="#6b4a06" strokeWidth="1" />
          <circle cx={C} cy={C} r="9" fill="#fff3c4" opacity=".8" />
          {hit != null && <path d={slicePath(hit)} className={styles.wHit} />}
        </g>

        <circle cx={C} cy={C} r="170" fill="url(#rwSheen)" pointerEvents="none" />
        <g ref={bRef} className={styles.wBallG} transform={`rotate(0 ${C} ${C})`} style={{ opacity: 0 }}>
          <circle ref={cRef} cx={C} cy={C - R_TRACK} r="6" fill="url(#rwBall)" className={styles.wBall} />
        </g>
        <path d={`M${C} 20 l9 -17 h-18z`} className={styles.wPointer} />
      </svg>
      <div key={number ?? 'none'} className={`${styles.wResult} ${number != null ? styles['wr_' + rColor(number)] : ''}`}>{number != null ? number : ''}</div>
    </div>
  )
}

function Spot({ c, t, v = null, cls = '', style, children }) {
  const a = c.amountAt(t, v)
  const win = c.res && c.res.bets?.some((b) => b.type === t && (b.value ?? null) === v) && c.res.payout > 0
  return (
    <button type="button" className={`${styles.rSpot} ${cls} ${a ? styles.rOn : ''}`} style={style} disabled={c.locked} onClick={() => c.add(t, v)} aria-label={`${t} ${v ?? ''}`}>
      {children}
      {a > 0 && <i className={`${styles.rChip} ${win ? styles.rChipWin : ''}`}>{short(a)}</i>}
    </button>
  )
}

export default function Roulette() {
  const g = useCasino('roulette')
  const [chip, setChip] = useState(100)
  const [bets, setBets] = useState([]) // { type, value, amount }
  const [mode, setMode] = useState('manual')
  const [turbo, setTurbo] = useState(false)
  const [cfg, setCfg] = useState({ rounds: '10', stopProfit: '', stopLoss: '' })
  const [auto, setAuto] = useState(false)
  const [stat, setStat] = useState({ n: 0, net: 0 })
  const [spinning, setSpinning] = useState(false)
  const [res, setRes] = useState(null) // finished round
  const wRef = useRef(null), bRef = useRef(null), cRef = useRef(null)
  const rot = useRef(0)
  const [shownNum, setShownNum] = useState(null)

  const R = useRef({})
  R.current = { bets, turbo, cfg }
  const stop = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; stop.current = true } }, [])

  const locked = spinning || auto
  const total = bets.reduce((a, b) => a + b.amount, 0)
  const amountAt = (t, v) => bets.find((b) => b.type === t && (b.value ?? null) === (v ?? null))?.amount || 0
  const add = (type, value = null) => {
    if (locked) return
    if (!g.user) return
    setBets((prev) => {
      const i = prev.findIndex((b) => b.type === type && (b.value ?? null) === value)
      const next = prev.map((b) => ({ ...b }))
      if (i >= 0) next[i].amount = Math.min(MAX_BET, next[i].amount + chip)
      else if (next.length < ROULETTE.maxBets) next.push({ type, value, amount: chip })
      return next
    })
    setRes(null); setShownNum(null)
    playSfx('click')
  }
  const undo = () => { if (!locked) setBets((b) => b.slice(0, -1)) }
  const clear = () => { if (!locked) { setBets([]); setRes(null); setShownNum(null) } }
  const double = () => { if (!locked) setBets((b) => b.map((x) => ({ ...x, amount: Math.min(MAX_BET, x.amount * 2) }))) }

  const setW = (a) => wRef.current?.setAttribute('transform', `rotate(${a} ${C} ${C})`)
  const setB = (a, r) => { bRef.current?.setAttribute('transform', `rotate(${a} ${C} ${C})`); cRef.current?.setAttribute('cy', String(C - r)) }
  const showBall = () => { if (bRef.current) bRef.current.style.opacity = '1' }
  const snap = (idx) => { rot.current = (((-idx * SLICE) % 360) + 360) % 360; setW(rot.current); setB(0, R_POCKET); showBall() }

  // wheel turns clockwise and slows down, the ball runs the track the other way, then spirals in
  // and hops into the winning pocket, which finishes under the pointer (top)
  const animate = (idx) => new Promise((resolve) => {
    const T = 6200, N = 6, w0 = rot.current
    const base = -idx * SLICE
    const wEnd = base + 360 * (Math.ceil((w0 - base) / 360) + 3)
    const t0 = performance.now()
    let lastPk = null, lastTick = 0
    showBall(); setB(N * 360, R_TRACK)
    const frame = (now) => {
      if (!alive.current) return resolve()
      const p = Math.min(1, (now - t0) / T)
      const ew = 1 - Math.pow(1 - p, 3), eb = 1 - Math.pow(1 - p, 4)
      const th = w0 + (wEnd - w0) * ew
      let ph = N * 360 * (1 - eb), r = R_TRACK
      if (p > 0.6) {
        const k = (p - 0.6) / 0.4, sm = k * k * (3 - 2 * k)
        r = R_TRACK + (R_POCKET - R_TRACK) * sm
        if (p > 0.78) { const d = (p - 0.78) / 0.22, dec = Math.pow(1 - d, 2); r -= 7 * Math.abs(Math.sin(d * 19)) * dec; ph += 3.500 * Math.sin(d * 23) * dec }
      }
      setW(th); setB(ph, r)
      if (p > 0.5 && !g.quiet.current) {
        const pk = Math.floor((ph - th) / SLICE)
        if (lastPk != null && pk !== lastPk && now - lastTick > 70) { lastTick = now; playSfx('click') }
        lastPk = pk
      }
      if (p < 1) requestAnimationFrame(frame)
      else { rot.current = ((base % 360) + 360) % 360; setW(rot.current); setB(0, R_POCKET); resolve() }
    }
    requestAnimationFrame(frame)
  })

  const spin = async () => {
    const { bets: bs, turbo: tb } = R.current
    setSpinning(true); setRes(null); setShownNum(null)
    g.quiet.current = tb; g.hold.current = true
    const data = await g.start({ bets: bs.map((b) => ({ type: b.type, value: b.value, amount: b.amount })) })
    if (!data?.state || data.state.game !== 'roulette') { g.release(); setSpinning(false); return null }
    const s = data.state
    const idx = WHEEL.indexOf(s.number)
    if (!tb) { playSfx('card'); await animate(idx) } else snap(idx)
    if (!alive.current) return s
    setShownNum(s.number); setRes(s)
    g.release()
    setSpinning(false)
    return s
  }

  const runAuto = async () => {
    if (locked || !bets.length) return
    stop.current = false; setAuto(true); setStat({ n: 0, net: 0 })
    let n = 0, net = 0
    while (!stop.current && alive.current) {
      const c = R.current.cfg
      const max = Math.floor(num(c.rounds))
      if (max && n >= max) break
      const s = await spin()
      if (!s) break
      n++; net += s.payout - s.bet
      setStat({ n, net })
      if (num(c.stopProfit) && net >= num(c.stopProfit)) break
      if (num(c.stopLoss) && -net >= num(c.stopLoss)) break
      await sleep(R.current.turbo ? 90 : 900)
    }
    g.quiet.current = false
    if (alive.current) { setAuto(false); setSpinning(false) }
  }

  const setC = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.value }))
  const canSpin = !!g.user && !!bets.length && !locked && !g.busy && total >= MIN_BET && total <= MAX_BET * 5
  const profit = res ? res.payout - res.bet : 0
  const ctx = { amountAt, res, locked, add }
  const numCls = (n) => `${styles['rn_' + rColor(n)]} ${shownNum === n ? styles.rHit : ''}`

  return (
    <Page game="roulette" title="Roulette" sub="European roulette with a single zero. Place chips, spin, and the server picks the number.">
      <div className={styles.layout}>
        <aside className={styles.panel}>
          <div className={styles.balance}>
            <Coin s={22} />
            <div><b>{g.points != null ? fmt(g.points) : g.user ? '...' : 'Log in'}</b><small>{g.points != null ? 'your points' : 'to play with your points'}</small></div>
          </div>

          <div className={styles.seg} role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'manual'} className={mode === 'manual' ? styles.on : ''} disabled={auto} onClick={() => setMode('manual')}>Manual</button>
            <button type="button" role="tab" aria-selected={mode === 'auto'} className={mode === 'auto' ? styles.on : ''} disabled={auto} onClick={() => setMode('auto')}>Auto</button>
          </div>

          <span className={styles.lbl}>Chip value</span>
          <div className={`${styles.quick} ${styles.chipRow}`}>
            {CHIPS.map((c) => <button key={c} type="button" className={chip === c ? styles.on : ''} onClick={() => setChip(c)}>{short(c)}</button>)}
          </div>
          <div className={styles.quick}>
            <button type="button" disabled={locked || !bets.length} onClick={undo}>Undo</button>
            <button type="button" disabled={locked || !bets.length} onClick={double}>2x</button>
            <button type="button" disabled={locked || !bets.length} onClick={clear}>Clear</button>
          </div>

          {mode === 'auto' && (
            <div className={styles.kRow}>
              <label>Spins (0 = endless)<input type="number" min="0" inputMode="numeric" value={cfg.rounds} disabled={auto} onChange={setC('rounds')} /></label>
              <label>Stop on profit<input type="number" min="0" inputMode="numeric" placeholder="off" value={cfg.stopProfit} disabled={auto} onChange={setC('stopProfit')} /></label>
              <label style={{ gridColumn: '1 / -1' }}>Stop on loss<input type="number" min="0" inputMode="numeric" placeholder="off" value={cfg.stopLoss} disabled={auto} onChange={setC('stopLoss')} /></label>
            </div>
          )}

          <button type="button" className={`${styles.turbo} ${turbo ? styles.on : ''}`} aria-pressed={turbo} onClick={() => setTurbo((t) => !t)}>
            <span>Turbo<small>Skip the wheel animation</small></span><i />
          </button>

          <div className={styles.autoStat}><span>Total bet</span><span>{fmt(total)} pts</span></div>
          {auto && (
            <div className={styles.autoStat}>
              <span>Spin {stat.n}</span>
              <span className={stat.net >= 0 ? styles.pos : styles.neg}>{stat.net >= 0 ? '+' : '-'}{fmt(Math.abs(stat.net))} pts</span>
            </div>
          )}

          {auto ? (
            <button type="button" className={styles.ctaAlt} onClick={() => { stop.current = true }}>Stop auto</button>
          ) : mode === 'auto' ? (
            <button type="button" className={styles.cta} disabled={!canSpin} onClick={runAuto}>{g.user ? 'Start auto spin' : 'Log in to play'}</button>
          ) : (
            <button type="button" className={styles.cta} disabled={!canSpin} onClick={spin}>{!g.user ? 'Log in to play' : !bets.length ? 'Place a bet' : `Spin (${fmt(total)})`}</button>
          )}
          {g.err && <p className={styles.err}>{g.err}</p>}
          <p className={styles.note}>Single zero: straight 35:1, dozens and columns 2:1, red/black, odd/even and 1-18 / 19-36 pay 1:1. Return is 97.3%. Bets stay on the table so you can spin again.</p>
        </aside>

        <section className={styles.stage}>
          <HistoryStrip items={g.history} />
          <div className={styles.ribbon}>
            <div><small>Number</small><b>{shownNum ?? '-'}</b></div>
            <div><small>Total bet</small><b>{fmt(res ? res.bet : total)}</b></div>
            <div><small>Payout</small><b>{res ? fmt(res.payout) : '-'}</b></div>
            <div className={res && profit > 0 ? styles.ribGold : ''}><small>Profit</small><b>{res ? `${profit >= 0 ? '+' : '-'}${fmt(Math.abs(profit))}` : '-'}</b></div>
          </div>

          <Wheel wRef={wRef} bRef={bRef} cRef={cRef} spinning={spinning} hit={shownNum != null ? WHEEL.indexOf(shownNum) : null} number={shownNum} />

          <div className={styles.rTableWrap}>
            <div className={styles.rTable}>
              <Spot c={ctx} t="straight" v={0} cls={`${styles.rn_green} ${shownNum === 0 ? styles.rHit : ''}`} style={{ gridColumn: 1, gridRow: '1 / 4' }}>0</Spot>
              {Array.from({ length: 36 }, (_, i) => {
                const col = Math.floor(i / 3), row = i % 3 // row 0 is the top line: 3, 6, 9 ...
                const n = col * 3 + (3 - row)
                return <Spot c={ctx} key={n} t="straight" v={n} cls={numCls(n)} style={{ gridColumn: col + 2, gridRow: row + 1 }}>{n}</Spot>
              })}
              {[3, 2, 1].map((c, r) => <Spot c={ctx} key={c} t="column" v={c} cls={styles.rOut} style={{ gridColumn: 14, gridRow: r + 1 }}>2:1</Spot>)}
              {[1, 2, 3].map((d) => <Spot c={ctx} key={d} t="dozen" v={d} cls={styles.rOut} style={{ gridColumn: `${2 + (d - 1) * 4} / span 4`, gridRow: 4 }}>{d === 1 ? '1st 12' : d === 2 ? '2nd 12' : '3rd 12'}</Spot>)}
              <Spot c={ctx} t="low" cls={styles.rOut} style={{ gridColumn: '2 / span 2', gridRow: 5 }}>1-18</Spot>
              <Spot c={ctx} t="even" cls={styles.rOut} style={{ gridColumn: '4 / span 2', gridRow: 5 }}>Even</Spot>
              <Spot c={ctx} t="red" cls={`${styles.rOut} ${styles.rRed}`} style={{ gridColumn: '6 / span 2', gridRow: 5 }}>Red</Spot>
              <Spot c={ctx} t="black" cls={`${styles.rOut} ${styles.rBlack}`} style={{ gridColumn: '8 / span 2', gridRow: 5 }}>Black</Spot>
              <Spot c={ctx} t="odd" cls={styles.rOut} style={{ gridColumn: '10 / span 2', gridRow: 5 }}>Odd</Spot>
              <Spot c={ctx} t="high" cls={styles.rOut} style={{ gridColumn: '12 / span 2', gridRow: 5 }}>19-36</Spot>
            </div>
          </div>
          <Confetti fire={g.fire} colors={['#e11d48', '#fda4af', '#f5c542', '#34d399', '#fff']} />
        </section>
      </div>
    </Page>
  )
}
