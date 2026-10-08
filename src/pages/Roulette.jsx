import { useEffect, useRef, useState } from 'react'
import { Confetti, Page, fmt, useFlag, playSfx, useCasino, MIN_BET, MAX_BET } from './CasinoShared'
import { WHEEL, rColor, ROULETTE } from '../lib/roulette'
import shared from './Casino.module.css'
import styles from './Roulette.module.css'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const num = (v) => Math.max(0, Number(v) || 0)
const CHIPS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
const SLICE = 360 / WHEEL.length
const short = (n) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(n))
const key = (t, v) => `${t}:${v ?? ''}`

// geometry: viewBox 360, centre 180. pockets r 104-138, ball track r 140-170
const C = 180
const R_TRACK = 152, R_POCKET = 113
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
    <div className={`${shared.wheelWrap} ${spinning ? shared.wSpin : ''}`}>
      <svg viewBox="0 0 360 360" className={shared.wheel} role="img" aria-label="Roulette wheel">
        <defs>
          <radialGradient id="rwWood" cx="50%" cy="50%" r="50%"><stop offset="86%" stopColor="#2a1a0c" /><stop offset="100%" stopColor="#0f0a05" /></radialGradient>
          <radialGradient id="rwTrack" cx="50%" cy="50%" r="50%"><stop offset="78%" stopColor="#0a0d14" /><stop offset="90%" stopColor="#1b2230" /><stop offset="100%" stopColor="#0a0d14" /></radialGradient>
          <radialGradient id="rwCone" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#3a2a12" /><stop offset="55%" stopColor="#1b1409" /><stop offset="100%" stopColor="#0d0a05" /></radialGradient>
          <radialGradient id="rwGold" cx="35%" cy="30%" r="80%"><stop offset="0%" stopColor="#fff3c4" /><stop offset="45%" stopColor="#f5c542" /><stop offset="100%" stopColor="#8a5a08" /></radialGradient>
          <radialGradient id="rwBall" cx="35%" cy="30%" r="75%"><stop offset="0%" stopColor="#fff" /><stop offset="60%" stopColor="#e5e7eb" /><stop offset="100%" stopColor="#9ca3af" /></radialGradient>
          <linearGradient id="rwSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity=".22" /><stop offset="45%" stopColor="#fff" stopOpacity="0" /><stop offset="100%" stopColor="#000" stopOpacity=".28" /></linearGradient>
        </defs>

        <circle cx={C} cy={C} r="178" fill="#10121a" />
        <circle cx={C} cy={C} r="170" fill="#0b0d13" />

        <g ref={wRef} transform={`rotate(0 ${C} ${C})`}>
          <circle cx={C} cy={C} r="140" fill="#0b0f16" />
          {WHEEL.map((n, i) => {
            const [tx, ty] = pt(i * SLICE, 126)
            return (
              <g key={n}>
                <path d={slicePath(i)} className={shared['w_' + rColor(n)]} />
                <text x={tx} y={ty} className={shared.wNum} transform={`rotate(${i * SLICE} ${tx} ${ty})`} textAnchor="middle" dominantBaseline="central">{n}</text>
              </g>
            )
          })}
          <circle cx={C} cy={C} r="104" fill="#07080c" />
          {SPOKES.map((d) => {
            const [x1, y1] = pt(d, 8), [x2, y2] = pt(d, 62), [kx, ky] = pt(d, 66)
            return <g key={d}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f2cf66" strokeWidth="5" strokeLinecap="round" /><circle cx={kx} cy={ky} r="5" fill="#f2cf66" /></g>
          })}
          <circle cx={C} cy={C} r="7" fill="#fff" />
          {hit != null && <path d={slicePath(hit)} className={shared.wHit} />}
        </g>

        <g ref={bRef} className={shared.wBallG} transform={`rotate(0 ${C} ${C})`} style={{ opacity: 0 }}>
          <circle ref={cRef} cx={C} cy={C - R_TRACK} r="6" fill="url(#rwBall)" className={shared.wBall} />
        </g>
      </svg>
      <div key={number ?? 'none'} className={`${shared.wResult} ${number != null ? shared['wr_' + rColor(number)] : ''}`}>{number != null ? number : ''}</div>
    </div>
  )
}

function Spot({ c, t, v = null, cls = '', style, children }) {
  const a = c.amountAt(t, v)
  const win = c.res && c.res.bets?.some((b) => b.type === t && (b.value ?? null) === v) && c.res.payout > 0
  return (
    <button type="button" className={`${styles.spot} ${cls} ${a > 0 ? styles.has : ''}`} style={style} disabled={c.locked} onClick={() => c.add(t, v)} aria-label={`${t} ${v ?? ''}`}>
      <span className={styles.lab2}>{children}</span>
      {a > 0 && <i className={`${styles.chip} ${win ? styles.won : ''}`}>{short(a)}</i>}
    </button>
  )
}

export default function Roulette() {
  const g = useCasino('roulette')
  const [chip, setChip] = useState(100)
  const [bets, setBets] = useState([]) // { type, value, amount }
  const [mode, setMode] = useState('manual')
  const turbo = false
  const [adv, setAdv] = useState(false)
  const [off, setOff] = useState(1) // first chip shown in the chip carousel
  const shaking = useFlag(g.shake)
  const [cfg, setCfg] = useState({ rounds: '0', stopProfit: '', stopLoss: '' })
  const [auto, setAuto] = useState(false)
  const [stat, setStat] = useState({ n: 0, net: 0 })
  const [spinning, setSpinning] = useState(false)
  const [res, setRes] = useState(null) // finished round
  const wRef = useRef(null), bRef = useRef(null), cRef = useRef(null)
  const rot = useRef(0)
  const lockedIdx = useRef(null) // pocket the ball sits in (rides with the wheel)
  const animRef = useRef(false)
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
  // the wheel never stops: it turns at a steady speed, with the ball riding in its pocket between spins
  const ROT = 0.018 // degrees per ms
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    let raf = 0, last = 0
    const tick = (now) => {
      if (!animRef.current) {
        if (last) rot.current = (rot.current + (now - last) * ROT) % 360
        setW(rot.current)
        if (lockedIdx.current != null) setB(rot.current + lockedIdx.current * SLICE, R_POCKET)
      }
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const lock = (idx) => { lockedIdx.current = idx; setB(rot.current + idx * SLICE, R_POCKET); showBall() }

  // the wheel keeps its speed; the ball runs the track the other way, slows down, spirals in and
  // drops into the winning pocket wherever that pocket happens to be at that moment
  const animate = (idx) => new Promise((resolve) => {
    const T = 6200, N = 6
    const w0 = rot.current, t0 = performance.now()
    const target = idx * SLICE
    const prev = lockedIdx.current
    const gap = prev == null ? 0 : ((((prev * SLICE - target) % 360) + 360) % 360)
    const span = N * 360 + gap
    let lastPk = null, lastTick = 0
    animRef.current = true
    showBall()
    const frame = (now) => {
      if (!alive.current) { animRef.current = false; return resolve() }
      const p = Math.min(1, (now - t0) / T)
      const th = w0 + ROT * (now - t0)
      const eb = 1 - Math.pow(1 - p, 4)
      let rel = target + span * (1 - eb), r = R_TRACK
      if (prev != null && p < 0.06) r = R_POCKET + (R_TRACK - R_POCKET) * (p / 0.06)
      if (p > 0.6) {
        const k = (p - 0.6) / 0.4, sm = k * k * (3 - 2 * k)
        r = R_TRACK + (R_POCKET - R_TRACK) * sm
        if (p > 0.78) { const d = (p - 0.78) / 0.22, dec = Math.pow(1 - d, 2); r -= 7 * Math.abs(Math.sin(d * 19)) * dec; rel += 3.5 * Math.sin(d * 23) * dec }
      }
      setW(th); setB(th + rel, r)
      if (p > 0.5 && !g.quiet.current) {
        const pk = Math.floor(rel / SLICE)
        if (lastPk != null && pk !== lastPk && now - lastTick > 70) { lastTick = now; playSfx('click') }
        lastPk = pk
      }
      if (p < 1) requestAnimationFrame(frame)
      else { rot.current = ((th % 360) + 360) % 360; animRef.current = false; lock(idx); resolve() }
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
    if (!tb) { playSfx('card'); await animate(idx) } else lock(idx)
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
  const ctx = { amountAt, res, locked, add }
  const hitCls = (n) => (shownNum === n ? styles.hit : '')
  const half = () => { if (!locked) setBets((b) => b.map((x) => ({ ...x, amount: Math.max(1, Math.floor(x.amount / 2)) }))) }
  const recent = g.history.slice(0, 5).map((h) => ({ n: Number(h.label), k: rColor(Number(h.label)) }))
  const shownChips = CHIPS.slice(off, off + 4)
  const won = res && res.payout > res.bet

  return (
    <Page game="roulette" title="Roulette" sub="">
      <div className={shared.layout}>
        <aside className={`${shared.panel} ${styles.panel}`}>
          <div className={styles.tabs} role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'manual'} disabled={locked} className={mode === 'manual' ? styles.on : ''} onClick={() => setMode('manual')}>Manual</button>
            <button type="button" role="tab" aria-selected={mode === 'auto'} disabled={locked} className={mode === 'auto' ? styles.on : ''} onClick={() => setMode('auto')}>Auto</button>
          </div>

          <div className={styles.fld}>
            <span className={styles.lab}>Chip Value</span>
            <div className={styles.chips}>
              <button type="button" className={`${styles.arrow}`} aria-label="Previous chips" disabled={off === 0} onClick={() => setOff((o) => Math.max(0, o - 1))}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
              <div className={styles.chipRow}>
                {shownChips.map((c) => (
                  <button key={c} type="button" aria-label={`Chip ${c}`} aria-pressed={chip === c} className={`${styles.disc} ${styles['c' + Math.min(4, CHIPS.indexOf(c) % 5)]} ${chip === c ? styles.sel : ''}`} onClick={() => setChip(c)}>{short(c)}</button>
                ))}
              </div>
              <button type="button" className={`${styles.arrow}`} aria-label="Next chips" disabled={off + 4 >= CHIPS.length} onClick={() => setOff((o) => Math.min(CHIPS.length - 4, o + 1))}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></button>
            </div>
          </div>

          <div className={styles.fld}>
            <span className={styles.lab}>Total Bet</span>
            <div className={`${styles.total} ${locked ? styles.off : ''}`}>
              <i className={styles.coin} aria-hidden="true" />
              <b>{fmt(total)}</b>
              <button type="button" disabled={locked || !bets.length} onClick={half}>1/2</button>
              <button type="button" disabled={locked || !bets.length} onClick={double}>2x</button>
            </div>
          </div>

          {mode === 'auto' && (
            <>
              <div className={styles.fld}>
                <span className={styles.lab}>Number of Bets</span>
                <div className={`${styles.money} ${auto ? styles.off : ''}`}>
                  <input type="number" inputMode="numeric" min="0" value={cfg.rounds} disabled={auto} onChange={setC('rounds')} />
                  <span className={styles.inf} aria-hidden="true">&infin;</span>
                </div>
              </div>
              <button type="button" className={styles.advRow} onClick={() => setAdv((v) => !v)} aria-pressed={adv}>
                <span>Advanced Settings</span><i className={adv ? styles.swOn : ''} />
              </button>
              {adv && [['Stop on Profit', 'stopProfit'], ['Stop on Loss', 'stopLoss']].map(([l, k]) => (
                <div key={k} className={styles.fld}><span className={styles.lab}>{l}</span><div className={styles.money}><i className={styles.coin} /><input type="number" min="0" value={cfg[k]} disabled={auto} onChange={setC(k)} /></div></div>
              ))}
            </>
          )}
          <div className={styles.grow} />
          {auto ? (
            <button type="button" className={styles.go} onClick={() => { stop.current = true }}>Stop Autobet</button>
          ) : mode === 'auto' ? (
            <button type="button" className={styles.go} disabled={!canSpin} onClick={runAuto}>{g.user ? 'Start Autobet' : 'Log in to play'}</button>
          ) : (
            <button type="button" className={styles.go} disabled={!canSpin} onClick={spin}>{g.user ? 'Place Bet' : 'Log in to play'}</button>
          )}
          {g.err && <p className={styles.err}>{g.err}</p>}
        </aside>

        <section className={`${styles.stage} ${shaking ? shared.shake : ''}`}>
          <div className={styles.top}>
            {shownNum != null && <div className={`${styles.numBox} ${styles[rColor(shownNum)]}`} key={res?.id}>{shownNum}</div>}
            <div className={styles.wheelBox}>
              <Wheel wRef={wRef} bRef={bRef} cRef={cRef} spinning={spinning} hit={shownNum != null ? WHEEL.indexOf(shownNum) : null} number={shownNum} />
            </div>
            <div className={styles.recent} aria-label="Recent numbers">
              {recent.map((x, i) => <span key={`${i}-${x.n}`} className={styles[x.k]}>{x.n}</span>)}
            </div>
          </div>

          <div className={styles.tools}>
            <button type="button" disabled={locked || !bets.length} onClick={undo}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-3" /></svg>Undo
            </button>
            <button type="button" disabled={locked || !bets.length} onClick={clear}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 19l6-6" /><path d="M13 5l6 6-5 5-6-6z" /></svg>Clear
            </button>
          </div>

          <div className={styles.tableBox}>
          {won && (
            <div className={styles.pop} role="status" key={res.id}>
              <b>{(res.payout / res.bet).toFixed(2)}&times;</b>
              <hr />
              <span><i className={styles.coin} />{fmt(res.payout)}</span>
            </div>
          )}
            <div className={styles.tbl}>
              <Spot c={ctx} t="straight" v={0} cls={`${styles.green} ${hitCls(0)}`} style={{ gridColumn: 1, gridRow: '1 / 4' }}>0</Spot>
              {Array.from({ length: 36 }, (_, i) => {
                const col = Math.floor(i / 3), row = i % 3 // row 0 is the top line: 3, 6, 9 ...
                const n = col * 3 + (3 - row)
                return <Spot c={ctx} key={n} t="straight" v={n} cls={`${styles[rColor(n)]} ${hitCls(n)}`} style={{ gridColumn: col + 2, gridRow: row + 1 }}>{n}</Spot>
              })}
              {[3, 2, 1].map((c, r) => <Spot c={ctx} key={c} t="column" v={c} cls={styles.out} style={{ gridColumn: 14, gridRow: r + 1 }}>2:1</Spot>)}
              {[1, 2, 3].map((d) => <Spot c={ctx} key={d} t="dozen" v={d} cls={styles.out} style={{ gridColumn: `${2 + (d - 1) * 4} / span 4`, gridRow: 4 }}>{d === 1 ? '1 to 12' : d === 2 ? '13 to 24' : '25 to 36'}</Spot>)}
              <Spot c={ctx} t="low" cls={styles.out} style={{ gridColumn: '2 / span 2', gridRow: 5 }}>1 to 18</Spot>
              <Spot c={ctx} t="even" cls={styles.out} style={{ gridColumn: '4 / span 2', gridRow: 5 }}>Even</Spot>
              <Spot c={ctx} t="red" cls={`${styles.out} ${styles.red}`} style={{ gridColumn: '6 / span 2', gridRow: 5 }}>Red</Spot>
              <Spot c={ctx} t="black" cls={`${styles.out} ${styles.black}`} style={{ gridColumn: '8 / span 2', gridRow: 5 }}>Black</Spot>
              <Spot c={ctx} t="odd" cls={styles.out} style={{ gridColumn: '10 / span 2', gridRow: 5 }}>Odd</Spot>
              <Spot c={ctx} t="high" cls={styles.out} style={{ gridColumn: '12 / span 2', gridRow: 5 }}>19 to 36</Spot>
            </div>
          </div>
          <Confetti fire={g.fire} colors={['#e11d48', '#fda4af', '#f5c542', '#34d399', '#fff']} />
        </section>
      </div>
    </Page>
  )
}
