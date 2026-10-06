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

// a point on the wheel at angle deg (0 = top, clockwise) and radius r
const pt = (deg, r) => { const a = ((deg - 90) * Math.PI) / 180; return [150 + r * Math.cos(a), 150 + r * Math.sin(a)] }
function slicePath(i) {
  const a0 = i * SLICE - SLICE / 2, a1 = i * SLICE + SLICE / 2
  const [x0, y0] = pt(a0, 140), [x1, y1] = pt(a1, 140), [x2, y2] = pt(a1, 92), [x3, y3] = pt(a0, 92)
  return `M${x0} ${y0} A140 140 0 0 1 ${x1} ${y1} L${x2} ${y2} A92 92 0 0 0 ${x3} ${y3}Z`
}

function Wheel({ wheelRot, ballRot, drop, anim, ms, number }) {
  return (
    <div className={styles.wheelWrap}>
      <svg viewBox="0 0 300 300" className={styles.wheel} role="img" aria-label="Roulette wheel">
        <circle cx="150" cy="150" r="148" className={styles.wRim} />
        <g style={{ transformOrigin: '150px 150px', transform: `rotate(${wheelRot}deg)`, transition: anim ? `transform ${ms}ms cubic-bezier(.12,.62,.16,1)` : 'none' }}>
          {WHEEL.map((n, i) => {
            const [tx, ty] = pt(i * SLICE, 116)
            return (
              <g key={n}>
                <path d={slicePath(i)} className={styles['w_' + rColor(n)]} />
                <text x={tx} y={ty} className={styles.wNum} transform={`rotate(${i * SLICE} ${tx} ${ty})`} textAnchor="middle" dominantBaseline="central">{n}</text>
              </g>
            )
          })}
          <circle cx="150" cy="150" r="88" className={styles.wHub} />
          <circle cx="150" cy="150" r="22" className={styles.wCap} />
        </g>
        <g style={{ transformOrigin: '150px 150px', transform: `rotate(${ballRot}deg)`, transition: anim ? `transform ${ms}ms cubic-bezier(.2,.55,.25,1)` : 'none' }}>
          <circle cx="150" cy="14" r="6" className={styles.wBall} style={{ transform: `translateY(${drop ? 30 : 0}px)`, transition: 'transform .55s cubic-bezier(.3,1.6,.5,1)' }} />
        </g>
        <path d="M150 2 l7 12 h-14z" className={styles.wPointer} />
      </svg>
      <div className={`${styles.wResult} ${number != null ? styles['wr_' + rColor(number)] : ''}`}>{number != null ? number : ''}</div>
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
  const [wheel, setWheel] = useState({ rot: 0, ball: 0, drop: false, anim: false })
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

  const spin = async () => {
    const { bets: bs, turbo: tb } = R.current
    setSpinning(true); setRes(null); setShownNum(null)
    g.quiet.current = tb; g.hold.current = true
    const data = await g.start({ bets: bs.map((b) => ({ type: b.type, value: b.value, amount: b.amount })) })
    if (!data?.state || data.state.game !== 'roulette') { g.release(); setSpinning(false); return null }
    const s = data.state
    if (!tb) {
      const idx = WHEEL.indexOf(s.number), ms = 4800
      setWheel((w) => {
        const delta = ((-(idx * SLICE) - (w.rot % 360)) % 360 + 360) % 360
        return { rot: w.rot + 360 * 4 + delta, ball: w.ball - 360 * 7, drop: false, anim: true }
      })
      playSfx('card')
      await sleep(ms - 600)
      if (!alive.current) return s
      setWheel((w) => ({ ...w, drop: true }))
      await sleep(900)
    } else {
      const idx = WHEEL.indexOf(s.number)
      setWheel((w) => ({ rot: w.rot - (w.rot % 360) - idx * SLICE, ball: w.ball, drop: true, anim: false }))
      await sleep(60)
    }
    if (!alive.current) return s
    setShownNum(s.number); setRes(s)
    setWheel((w) => ({ ...w, drop: false, anim: false }))
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

          <Wheel wheelRot={wheel.rot} ballRot={wheel.ball} drop={wheel.drop} anim={wheel.anim} ms={4800} number={shownNum} />

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
