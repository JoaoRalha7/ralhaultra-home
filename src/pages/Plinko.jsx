import { useEffect, useRef, useState } from 'react'
import { Confetti, Page, fmt, playSfx, useCasino, useFlag, MIN_BET, MAX_BET } from './CasinoShared'
import { PLINKO, plinkoTable } from '../lib/plinko'
import shared from './Casino.module.css'
import styles from './Plinko.module.css'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const num = (v) => Math.max(0, Number(v) || 0)
const clampBet = (v) => Math.max(MIN_BET, Math.min(MAX_BET, Math.floor(Number(v)) || MIN_BET))
const cap = (s) => s[0].toUpperCase() + s.slice(1)
const W = 720, PAD_T = 26, BIN_H = 30
const label = (m) => (m >= 1000 ? `${Math.round(m / 100) / 10}K`.replace('.0', '') : m >= 100 ? String(Math.round(m)) : String(+m.toFixed(1)))
// red at the edges, yellow in the middle
const binColor = (k, rows) => { const d = Math.abs(k - rows / 2) / (rows / 2); return `hsl(${Math.round(50 - 62 * d)} 94% ${Math.round(53 - 8 * d)}%)` }
const Chev = ({ up }) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{up ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}</svg>

function Money({ label: lb, value, setValue, disabled }) {
  return (
    <div className={styles.fld}>
      <span className={styles.lab}>{lb}</span>
      <div className={`${styles.money} ${disabled ? styles.off : ''}`}>
        <i className={styles.coin} aria-hidden="true" />
        <input type="number" inputMode="numeric" min={MIN_BET} value={value} disabled={disabled}
          onChange={(e) => setValue(e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value))))}
          onBlur={() => setValue(clampBet(value))} />
        <button type="button" disabled={disabled} onClick={() => setValue(clampBet((Number(value) || MIN_BET) / 2))}>1/2</button>
        <button type="button" disabled={disabled} onClick={() => setValue(clampBet((Number(value) || MIN_BET) * 2))}>2x</button>
      </div>
    </div>
  )
}

function RiskSelect({ value, setValue, disabled }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    if (!open) return
    const off = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [open])
  return (
    <div className={styles.fld} ref={box}>
      <span className={styles.lab}>Risk</span>
      <button type="button" className={`${styles.sel} ${disabled ? styles.off : ''}`} disabled={disabled} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <b>{cap(value)}</b><Chev up={open} />
      </button>
      {open && (
        <ul className={styles.list} role="listbox">
          {PLINKO.risks.map((k) => (
            <li key={k} role="option" aria-selected={k === value} className={k === value ? styles.cur : ''} onClick={() => { setValue(k); setOpen(false) }}>{cap(k)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Plinko() {
  const g = useCasino('plinko')
  const [bet, setBet] = useState(100)
  const [rows, setRows] = useState(16)
  const [risk, setRisk] = useState('medium')
  const [tab, setTab] = useState('manual')
  const [nBets, setNBets] = useState(0)
  const [adv, setAdv] = useState(false)
  const [cfg, setCfg] = useState({ stopProfit: '', stopLoss: '', onWin: '', onLoss: '' })
  const [auto, setAuto] = useState(false)
  const [sending, setSending] = useState(false)
  const [view, setView] = useState({ balls: [], rips: [] })
  const [hits, setHits] = useState({}) // slot -> landing counter (restarts the bin animation)
  const [recent, setRecent] = useState([]) // newest first
  const shaking = useFlag(g.shake)

  const R = useRef({})
  R.current = { bet, rows, risk, cfg, nBets }
  const stop = useRef(false), alive = useRef(true)
  const B = useRef({ balls: [], rips: [], raf: 0, id: 0, net: 0, last: null })
  useEffect(() => { alive.current = true; return () => { alive.current = false; stop.current = true; cancelAnimationFrame(B.current.raf) } }, [])

  const flying = view.balls.length > 0
  const lockBoard = flying || auto
  const table = plinkoTable(rows, risk)
  const dx = (W - 56) / (rows + 2)
  const dy = Math.min(dx * 0.9, 470 / (rows + 1))
  const H = PAD_T + (rows + 1) * dy + BIN_H + 14
  const cx = W / 2
  const pegY = (i) => PAD_T + i * dy
  const binY = PAD_T + (rows + 1) * dy
  const binX = (k) => cx + ((2 * k - rows) * dx) / 2

  // one loop moves every ball in flight; each ball follows its server path peg by peg
  const tick = (now) => {
    const S = B.current
    const out = []
    S.balls = S.balls.filter((b) => {
      const el = now - b.t0
      if (el >= b.total) { b.land(); return false }
      const row = Math.min(b.rows - 1, Math.floor(el / b.speed)), t = (el - row * b.speed) / b.speed, e = t * t * (3 - 2 * t)
      if (row !== b.row) {
        b.row = row
        S.rips.push({ id: ++S.id, x: b.cx + (b.xs[row] * b.dx) / 2, y: PAD_T + row * b.dy, until: now + 430 })
      }
      out.push({ id: b.id, x: b.cx + ((b.xs[row] + (b.xs[row + 1] - b.xs[row]) * e) * b.dx) / 2, y: PAD_T + row * b.dy + b.dy * t * t - Math.sin(Math.PI * t) * 6 })
      return true
    })
    S.rips = S.rips.filter((r) => r.until > now)
    setView({ balls: out, rips: [...S.rips] })
    S.raf = S.balls.length || S.rips.length ? requestAnimationFrame(tick) : 0
  }

  const addBall = (s, stake, newPoints, onLanded) => {
    const S = B.current
    const nrows = s.rows, ddx = (W - 56) / (nrows + 2), ddy = Math.min(ddx * 0.9, 470 / (nrows + 1))
    const xs = [0]; s.path.forEach((p) => xs.push(xs[xs.length - 1] + (p ? 1 : -1)))
    const speed = Math.max(95, 190 - nrows * 6)
    S.balls.push({
      id: ++S.id, path: s.path, rows: nrows, speed, total: speed * nrows, t0: performance.now(), row: -1, xs, cx, dx: ddx, dy: ddy,
      land: () => {
        playSfx('click')
        setHits((h) => ({ ...h, [s.slot]: (h[s.slot] || 0) + 1 }))
        setRecent((r) => [{ id: s.id || S.id, m: s.mult, c: binColor(s.slot, nrows) }, ...r].slice(0, 12))
        g.settle(s)
        if (newPoints != null) g.setPoints(newPoints)
        onLanded?.(s)
      },
    })
    if (!S.raf) S.raf = requestAnimationFrame(tick)
  }

  // sends one ball; resolves when the server has accepted it (the ball keeps falling on its own)
  const drop = async (stake, onLanded) => {
    const { rows: rw, risk: rk } = R.current
    setSending(true)
    const data = await g.batch({ bet: stake, rows: rw, risk: rk, count: 1 })
    setSending(false)
    const s = data?.state
    if (!s || s.game !== 'plinko') return null
    addBall(s, stake, data.newPoints, onLanded)
    return s
  }

  const place = async () => {
    if (sending || !g.user || Number(bet) < MIN_BET) return
    playSfx('click')
    await drop(clampBet(bet), (s) => { const net = s.payout - s.bet; if (net > 0) g.cheer(net) })
  }

  const runAuto = async () => {
    if (auto || !g.user || Number(bet) < MIN_BET) return
    stop.current = false; setAuto(true)
    const base = clampBet(bet)
    let cur = base, n = 0
    B.current.net = 0; B.current.last = null
    while (!stop.current && alive.current) {
      const c = R.current.cfg, max = Math.floor(num(R.current.nBets))
      if (max && n >= max) break
      const net = B.current.net
      if (num(c.stopProfit) && net >= num(c.stopProfit)) break
      if (num(c.stopLoss) && -net >= num(c.stopLoss)) break
      const l = B.current.last
      if (l) { const pct = l > 0 ? num(c.onWin) : num(c.onLoss); cur = pct ? Math.min(MAX_BET, Math.max(MIN_BET, Math.round(cur * (1 + pct / 100)))) : base; B.current.last = null }
      const s = await drop(cur, (r) => { const p = r.payout - r.bet; B.current.net += p; B.current.last = p || -1 })
      if (!s) break
      n++
      await sleep(380)
    }
    while (B.current.balls.length && alive.current) await sleep(120)
    if (alive.current) setAuto(false)
  }

  const setC = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.value }))
  const canGo = g.user && !sending && Number(bet) >= MIN_BET

  return (
    <Page game="plinko" title="Plinko" sub="">
      <div className={shared.layout}>
        <aside className={`${shared.panel} ${styles.panel}`}>
          <div className={styles.tabs} role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'manual'} disabled={auto} className={tab === 'manual' ? styles.on : ''} onClick={() => setTab('manual')}>Manual</button>
            <button type="button" role="tab" aria-selected={tab === 'auto'} disabled={auto} className={tab === 'auto' ? styles.on : ''} onClick={() => setTab('auto')}>Auto</button>
          </div>
          <Money label="Bet Amount" value={bet} setValue={setBet} disabled={auto} />
          <div className={styles.fld}>
            <span className={styles.lab}>Rows</span>
            <div className={styles.rowsRow}>
            <b>{rows}</b>
            <input type="range" min={PLINKO.minRows} max={PLINKO.maxRows} step="1" value={rows} disabled={lockBoard} aria-label="Number of rows"
              className={styles.range} style={{ '--p': `${((rows - PLINKO.minRows) / (PLINKO.maxRows - PLINKO.minRows)) * 100}%` }}
              onChange={(e) => { setRows(Number(e.target.value)); setHits({}) }} />
            </div>
          </div>
          <RiskSelect value={risk} setValue={setRisk} disabled={lockBoard} />

          {tab === 'auto' && (
            <>
              <div className={styles.fld}>
                <span className={styles.lab}>Number of Bets</span>
                <div className={`${styles.money} ${auto ? styles.off : ''}`}>
                  <input type="number" inputMode="numeric" min="0" value={nBets} disabled={auto} onChange={(e) => setNBets(e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value))))} />
                  <span className={styles.inf} aria-hidden="true">&infin;</span>
                </div>
              </div>
              <button type="button" className={styles.advRow} onClick={() => setAdv((v) => !v)} aria-pressed={adv}>
                <span>Advanced Settings</span><i className={adv ? styles.swOn : ''} />
              </button>
              {adv && (
                <>
                  {[['Stop on Profit', 'stopProfit'], ['Stop on Loss', 'stopLoss']].map(([l, k]) => (
                    <div key={k} className={styles.fld}><span className={styles.lab}>{l}</span><div className={styles.money}><i className={styles.coin} /><input type="number" min="0" value={cfg[k]} disabled={auto} onChange={setC(k)} /></div></div>
                  ))}
                  {[['On Win, Increase Bet by %', 'onWin'], ['On Loss, Increase Bet by %', 'onLoss']].map(([l, k]) => (
                    <div key={k} className={styles.fld}><span className={styles.lab}>{l}</span><div className={styles.money}><input type="number" min="0" placeholder="Reset" value={cfg[k]} disabled={auto} onChange={setC(k)} /><span className={styles.inf}>%</span></div></div>
                  ))}
                </>
              )}
            </>
          )}
          <div className={styles.grow} />
          {auto ? (
            <button type="button" className={styles.go} onClick={() => { stop.current = true }}>Stop Autobet</button>
          ) : tab === 'auto' ? (
            <button type="button" className={styles.go} disabled={!canGo} onClick={runAuto}>{g.user ? 'Start Autobet' : 'Log in to play'}</button>
          ) : (
            <button type="button" className={styles.go} disabled={!canGo} onClick={place}>{g.user ? 'Place Bet' : 'Log in to play'}</button>
          )}
          {g.err && <p className={styles.err}>{g.err}</p>}
        </aside>

        <section className={`${styles.stage} ${shaking ? shared.shake : ''}`}>
          <svg className={styles.board} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Plinko board">
            {Array.from({ length: rows }, (_, i) => Array.from({ length: i + 3 }, (_, k) => (
              <circle key={`${i}-${k}`} cx={cx + ((2 * k - (i + 2)) * dx) / 2} cy={pegY(i)} r={Math.max(3.4, dx * 0.1)} className={styles.peg} />
            )))}
            {view.rips.map((r) => <circle key={r.id} cx={r.x} cy={r.y} r={Math.max(9, dx * 0.3)} className={styles.rip} />)}
            {table.map((m, k) => {
              const bw = dx * 0.86
              return (
                <g key={`${k}-${hits[k] || 0}`} className={`${styles.bin} ${hits[k] ? styles.binHit : ''}`}>
                  <rect x={binX(k) - bw / 2} y={binY} width={bw} height={BIN_H} rx="5" fill={binColor(k, rows)} />
                  <text x={binX(k)} y={binY + BIN_H / 2 + 4.500} textAnchor="middle" fontSize={rows > 14 ? 11 : rows > 11 ? 13 : 15}>{label(m)}</text>
                </g>
              )
            })}
            {view.balls.map((b) => <circle key={b.id} cx={b.x} cy={b.y} r={Math.max(5, dx * 0.15)} className={styles.ball} />)}
          </svg>
          <div className={styles.recent} aria-label="Recent results">
            {recent.map((x) => <span key={x.id} style={{ background: x.c }}>{label(x.m)}</span>)}
          </div>
          <Confetti fire={g.fire} colors={['#34d399', '#6ee7b7', '#22d3ee', '#f5c542', '#fff']} />
        </section>
      </div>
    </Page>
  )
}
