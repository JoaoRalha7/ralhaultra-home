import { useEffect, useRef, useState } from 'react'
import { BetPanel, Confetti, HistoryStrip, Page, fmt, playSfx, useCasino, MIN_BET, MAX_BET } from './CasinoShared'
import { PLINKO, plinkoTable } from '../lib/plinko'
import styles from './Casino.module.css'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const num = (v) => Math.max(0, Number(v) || 0)
const W = 640, PAD_T = 34, BIN_H = 34
const tone = (m) => (m >= 100 ? 'hot' : m >= 10 ? 'warm' : m >= 2 ? 'amber' : m >= 1 ? 'mild' : 'cold')

export default function Plinko() {
  const g = useCasino('plinko')
  const [bet, setBet] = useState(100)
  const [rows, setRows] = useState(12)
  const [risk, setRisk] = useState('medium')
  const [mode, setMode] = useState('manual')
  const [turbo, setTurbo] = useState(false)
  const [cfg, setCfg] = useState({ rounds: '10', stopProfit: '', stopLoss: '', onWin: '', onLoss: '' })
  const [auto, setAuto] = useState(false)
  const [stat, setStat] = useState({ n: 0, net: 0 })
  const [playing, setPlaying] = useState(false)
  const [balls, setBalls] = useState([]) // in flight: { k, x, y } in board units
  const [hits, setHits] = useState({}) // slot -> balls landed in the current drop
  const [count, setCount] = useState(1)
  const [last, setLast] = useState(null)

  const R = useRef({})
  R.current = { rows, risk, turbo, cfg, count }
  const stop = useRef(false)
  const alive = useRef(true)
  const raf = useRef(0)
  useEffect(() => { alive.current = true; return () => { alive.current = false; stop.current = true; cancelAnimationFrame(raf.current) } }, [])

  const locked = playing || auto
  const table = plinkoTable(rows, risk)
  const dx = (W - 56) / (rows + 2)
  const dy = Math.min(30, 420 / (rows + 1))
  const H = PAD_T + (rows + 1) * dy + BIN_H + 18
  const cx = W / 2
  const pegY = (i) => PAD_T + i * dy
  const binY = PAD_T + (rows + 1) * dy
  const binX = (k) => cx + ((2 * k - rows) * dx) / 2

  // drops several balls at once (staggered); every ball follows its server path peg by peg
  const fall = (items, nrows, speed, onLand) => new Promise((resolve) => {
    const dxx = (W - 56) / (nrows + 2), dyy = Math.min(30, 420 / (nrows + 1))
    const total = speed * nrows
    const xs = items.map((it) => { const a = [0]; it.path.forEach((p) => a.push(a[a.length - 1] + (p ? 1 : -1))); return a })
    const landed = items.map(() => false)
    let done = 0, lastTick = 0
    const t0 = performance.now()
    const tick = (now) => {
      if (!alive.current) return resolve()
      const out = []
      items.forEach((it, i) => {
        if (landed[i]) return
        const el = now - t0 - it.delay
        if (el < 0) return
        if (el >= total) { landed[i] = true; done++; onLand(i); return }
        const row = Math.min(nrows - 1, Math.floor(el / speed)), t = (el - row * speed) / speed, e = t * t * (3 - 2 * t)
        const x = cx + ((xs[i][row] + (xs[i][row + 1] - xs[i][row]) * e) * dxx) / 2
        const y = PAD_T + row * dyy + dyy * t * t - Math.sin(Math.PI * t) * 7
        out.push({ k: i, x, y })
        if (items.length === 1 && t > 0.02 && t < 0.12) playSfx('click')
      })
      if (items.length > 1 && now - lastTick > 90 && out.length && !g.quiet.current) { lastTick = now; playSfx('click') }
      setBalls(out)
      if (done < items.length) raf.current = requestAnimationFrame(tick); else { setBalls([]); resolve() }
    }
    raf.current = requestAnimationFrame(tick)
  })

  const playRound = async (stake, count = 1) => {
    const { rows: rw, risk: rk, turbo: tb } = R.current
    setPlaying(true); setHits({})
    g.quiet.current = tb
    if (count > 1) {
      const data = await g.batch({ bet: stake, rows: rw, risk: rk, count })
      const list = data?.balls
      if (!Array.isArray(list) || !list.length) { setPlaying(false); return null }
      const speed = Math.max(95, 190 - rw * 6), gap = list.length > 12 ? 70 : 115
      const acc = { n: 0, pay: 0 } // only what has landed so far: later balls must not leak into the totals
      const land = (i) => {
        const r = list[i]; g.settle(r)
        acc.n++; acc.pay += r.payout
        setHits((h) => ({ ...h, [r.slot]: (h[r.slot] || 0) + 1 }))
        setLast({ ...r, bet: stake * acc.n, payout: acc.pay, mult: acc.pay / (stake * acc.n) })
      }
      if (!tb) await fall(list.map((r, i) => ({ path: r.path, delay: i * gap })), rw, speed, land)
      else list.forEach((_, i) => land(i))
      if (!alive.current) return null
      const tot = list.reduce((a, x) => a + x.payout, 0), cost = stake * list.length
      if (data.newPoints != null) g.setPoints(data.newPoints)
      g.cheer(tot - cost)
      setPlaying(false)
      return { bet: cost, payout: tot, count: list.length }
    }
    g.hold.current = true
    const data = await g.start({ bet: stake, rows: rw, risk: rk })
    if (!data?.state || data.state.game !== 'plinko') { g.release(); setPlaying(false); return null }
    const s = data.state
    if (!tb) await fall([{ path: s.path, delay: 0 }], s.rows, Math.max(95, 190 - s.rows * 6), () => {})
    if (!alive.current) return s
    setHits({ [s.slot]: 1 }); setLast(s)
    if (tb) await sleep(60)
    g.release()
    setPlaying(false)
    return { ...s, count: 1 }
  }

  const playOnce = async () => {
    if (locked || Number(bet) < MIN_BET) return
    await playRound(Number(bet), count)
  }

  const runAuto = async () => {
    if (locked || Number(bet) < MIN_BET) return
    stop.current = false; setAuto(true); setStat({ n: 0, net: 0 })
    const base = Number(bet)
    let cur = base, n = 0, net = 0
    while (!stop.current && alive.current) {
      const c = R.current.cfg
      const max = Math.floor(num(c.rounds))
      if (max && n >= max) break
      const s = await playRound(cur, R.current.count)
      if (!s) break
      n += s.count; const profit = s.payout - s.bet; net += profit
      setStat({ n, net })
      if (num(c.stopProfit) && net >= num(c.stopProfit)) break
      if (num(c.stopLoss) && -net >= num(c.stopLoss)) break
      const pct = profit > 0 ? num(c.onWin) : num(c.onLoss)
      cur = pct ? Math.min(MAX_BET, Math.max(MIN_BET, Math.round(cur * (1 + pct / 100)))) : base
      await sleep(R.current.turbo ? 80 : 450)
    }
    g.quiet.current = false
    if (alive.current) { setAuto(false); setPlaying(false) }
  }

  const setC = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.value }))
  const disabledStart = g.busy || !g.user || Number(bet) < MIN_BET || playing
  const profit = last ? last.payout - last.bet : 0

  return (
    <Page game="plinko" title="Plinko" sub="Drop the ball through the pegs. The further from the middle it lands, the more it pays.">
      <div className={styles.layout}>
        <BetPanel points={g.points} bet={bet} setBet={setBet} locked={locked} loggedIn={!!g.user}>
          <div className={styles.seg} role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'manual'} className={mode === 'manual' ? styles.on : ''} disabled={auto} onClick={() => setMode('manual')}>Manual</button>
            <button type="button" role="tab" aria-selected={mode === 'auto'} className={mode === 'auto' ? styles.on : ''} disabled={auto} onClick={() => setMode('auto')}>Auto</button>
          </div>

          <span className={styles.lbl}>Risk</span>
          <div className={`${styles.quick} ${styles.riskRow}`}>
            {PLINKO.risks.map((k) => (
              <button key={k} type="button" disabled={locked} className={risk === k ? styles.on : ''} onClick={() => setRisk(k)}>{k[0].toUpperCase() + k.slice(1)}</button>
            ))}
          </div>

          <span className={styles.lbl}>Rows <b className={styles.mcount}>{rows}</b></span>
          <input type="range" min={PLINKO.minRows} max={PLINKO.maxRows} step="1" value={rows} disabled={locked} aria-label="Number of rows"
            className={styles.range} style={{ '--p': `${((rows - PLINKO.minRows) / (PLINKO.maxRows - PLINKO.minRows)) * 100}%` }}
            onChange={(e) => { setRows(Number(e.target.value)); setHits({}) }} />

          <span className={styles.lbl}>Balls per drop</span>
          <div className={`${styles.quick} ${styles.ballRow}`}>
            {[1, 5, 10, 25].map((n) => <button key={n} type="button" disabled={locked} className={count === n ? styles.on : ''} onClick={() => setCount(n)}>{n}</button>)}
          </div>

          {mode === 'auto' && (
            <>
              <div className={styles.kRow}>
                <label>Bets (0 = endless)<input type="number" min="0" inputMode="numeric" value={cfg.rounds} disabled={auto} onChange={setC('rounds')} /></label>
                <label>Stop on profit<input type="number" min="0" inputMode="numeric" placeholder="off" value={cfg.stopProfit} disabled={auto} onChange={setC('stopProfit')} /></label>
                <label>On win, bet +%<input type="number" min="0" inputMode="numeric" placeholder="reset" value={cfg.onWin} disabled={auto} onChange={setC('onWin')} /></label>
                <label>On loss, bet +%<input type="number" min="0" inputMode="numeric" placeholder="reset" value={cfg.onLoss} disabled={auto} onChange={setC('onLoss')} /></label>
              </div>
              <div className={styles.kRow} style={{ gridTemplateColumns: '1fr' }}>
                <label>Stop on loss<input type="number" min="0" inputMode="numeric" placeholder="off" value={cfg.stopLoss} disabled={auto} onChange={setC('stopLoss')} /></label>
              </div>
            </>
          )}

          <button type="button" className={`${styles.turbo} ${turbo ? styles.on : ''}`} aria-pressed={turbo} onClick={() => setTurbo((t) => !t)}>
            <span>Turbo<small>No ball animation or sound</small></span><i />
          </button>

          {auto && (
            <div className={styles.autoStat}>
              <span>Balls {stat.n}</span>
              <span className={stat.net >= 0 ? styles.pos : styles.neg}>{stat.net >= 0 ? '+' : '-'}{fmt(Math.abs(stat.net))} pts</span>
            </div>
          )}

          {auto ? (
            <button type="button" className={styles.ctaAlt} onClick={() => { stop.current = true }}>Stop auto</button>
          ) : mode === 'auto' ? (
            <button type="button" className={styles.cta} disabled={disabledStart} onClick={runAuto}>{g.user ? 'Start auto bet' : 'Log in to play'}</button>
          ) : (
            <button type="button" className={styles.cta} disabled={disabledStart} onClick={playOnce}>{!g.user ? 'Log in to play' : count > 1 ? `Drop ${count} balls (${fmt(Number(bet) * count)})` : 'Drop ball'}</button>
          )}
          {g.err && <p className={styles.err}>{g.err}</p>}
          <p className={styles.note}>Each ball falls through random bounces decided by the server. Return is about 98.5% to 99%. More rows and higher risk mean rarer but bigger edge payouts.</p>
        </BetPanel>

        <section className={styles.stage}>
          <HistoryStrip items={g.history} />
          <div className={styles.ribbon}>
            <div><small>Rows</small><b>{rows}</b></div>
            <div><small>Risk</small><b style={{ textTransform: 'capitalize' }}>{risk}</b></div>
            <div><small>{count > 1 ? 'Drop multiplier' : 'Last multiplier'}</small><b>{last ? `${last.mult.toFixed(2)}x` : '-'}</b></div>
            <div className={last && profit > 0 ? styles.ribGold : ''}><small>Profit</small><b>{last ? `${profit >= 0 ? '+' : '-'}${fmt(Math.abs(profit))}` : '-'}</b></div>
          </div>

          <svg className={styles.plinko} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Plinko board">
            {Array.from({ length: rows }, (_, i) => Array.from({ length: i + 3 }, (_, k) => (
              <circle key={`${i}-${k}`} cx={cx + ((2 * k - (i + 2)) * dx) / 2} cy={pegY(i)} r="3.4" className={styles.peg} />
            )))}
            {table.map((m, k) => {
              const bw = dx * 0.9
              return (
                <g key={`${k}-${hits[k] || 0}`} className={`${styles.pbin} ${styles['pb_' + tone(m)]} ${hits[k] ? styles.pbHit : ''}`}>
                  <rect x={binX(k) - bw / 2} y={binY} width={bw} height={BIN_H} rx="6" />
                  {hits[k] > 1 && <text x={binX(k)} y={binY - 5} textAnchor="middle" className={styles.pbCount}>x{hits[k]}</text>}
                  <text x={binX(k)} y={binY + BIN_H / 2 + 4} textAnchor="middle" fontSize={rows > 13 ? 10.5 : rows > 10 ? 12 : 14}>{m >= 1000 ? '1k' : m >= 100 ? Math.round(m) : m}</text>
                </g>
              )
            })}
            {balls.map((b) => <circle key={b.k} cx={b.x} cy={b.y} r={balls.length > 4 ? 5.500 : 7} className={styles.pball} />)}
          </svg>
          <Confetti fire={g.fire} colors={['#22d3ee', '#67e8f9', '#f5c542', '#f472b6', '#fff']} />
        </section>
      </div>
    </Page>
  )
}
