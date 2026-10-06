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
  const [ball, setBall] = useState(null) // { x, y } in board units
  const [hit, setHit] = useState(null) // { slot, id }
  const [last, setLast] = useState(null)

  const R = useRef({})
  R.current = { rows, risk, turbo, cfg }
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

  // one ball: follows the server path peg by peg
  const drop = (path, nrows, speed) => new Promise((resolve) => {
    const dxx = (W - 56) / (nrows + 2), dyy = Math.min(30, 420 / (nrows + 1))
    const xs = [0]; path.forEach((p) => xs.push(xs[xs.length - 1] + (p ? 1 : -1)))
    const per = speed, total = per * nrows, t0 = performance.now()
    const tick = (now) => {
      if (!alive.current) return resolve()
      const el = Math.min(now - t0, total), row = Math.min(nrows - 1, Math.floor(el / per)), t = (el - row * per) / per
      const e = t * t * (3 - 2 * t)
      const x = cx + ((xs[row] + (xs[row + 1] - xs[row]) * e) * dxx) / 2
      const y = PAD_T + row * dyy + dyy * t * t - Math.sin(Math.PI * t) * 7
      setBall({ x, y })
      if (el < total && (row < nrows - 1 || t < 1)) { raf.current = requestAnimationFrame(tick); if (t > 0.02 && t < 0.12) playSfx('click') } else resolve()
    }
    raf.current = requestAnimationFrame(tick)
  })

  const playRound = async (stake) => {
    const { rows: rw, risk: rk, turbo: tb } = R.current
    setPlaying(true); setHit(null)
    g.quiet.current = tb; g.hold.current = true
    const data = await g.start({ bet: stake, rows: rw, risk: rk })
    if (!data?.state || data.state.game !== 'plinko') { g.release(); setPlaying(false); return null }
    const s = data.state
    if (!tb) { await drop(s.path, s.rows, Math.max(95, 190 - s.rows * 6)); setBall(null) }
    if (!alive.current) return s
    setHit({ slot: s.slot, id: s.id }); setLast(s)
    if (tb) await sleep(60)
    g.release()
    setPlaying(false)
    return s
  }

  const playOnce = async () => {
    if (locked || Number(bet) < MIN_BET) return
    await playRound(Number(bet))
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
      const s = await playRound(cur)
      if (!s) break
      n++; const profit = s.payout - s.bet; net += profit
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
            onChange={(e) => { setRows(Number(e.target.value)); setHit(null) }} />

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
              <span>Ball {stat.n}</span>
              <span className={stat.net >= 0 ? styles.pos : styles.neg}>{stat.net >= 0 ? '+' : '-'}{fmt(Math.abs(stat.net))} pts</span>
            </div>
          )}

          {auto ? (
            <button type="button" className={styles.ctaAlt} onClick={() => { stop.current = true }}>Stop auto</button>
          ) : mode === 'auto' ? (
            <button type="button" className={styles.cta} disabled={disabledStart} onClick={runAuto}>{g.user ? 'Start auto bet' : 'Log in to play'}</button>
          ) : (
            <button type="button" className={styles.cta} disabled={disabledStart} onClick={playOnce}>{g.user ? 'Drop ball' : 'Log in to play'}</button>
          )}
          {g.err && <p className={styles.err}>{g.err}</p>}
          <p className={styles.note}>Each ball falls through random bounces decided by the server. Return is about 98.5% to 99%. More rows and higher risk mean rarer but bigger edge payouts.</p>
        </BetPanel>

        <section className={styles.stage}>
          <HistoryStrip items={g.history} />
          <div className={styles.ribbon}>
            <div><small>Rows</small><b>{rows}</b></div>
            <div><small>Risk</small><b style={{ textTransform: 'capitalize' }}>{risk}</b></div>
            <div><small>Last multiplier</small><b>{last ? `${last.mult.toFixed(2)}x` : '-'}</b></div>
            <div className={last && profit > 0 ? styles.ribGold : ''}><small>Profit</small><b>{last ? `${profit >= 0 ? '+' : '-'}${fmt(Math.abs(profit))}` : '-'}</b></div>
          </div>

          <svg className={styles.plinko} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Plinko board">
            {Array.from({ length: rows }, (_, i) => Array.from({ length: i + 3 }, (_, k) => (
              <circle key={`${i}-${k}`} cx={cx + ((2 * k - (i + 2)) * dx) / 2} cy={pegY(i)} r="3.4" className={styles.peg} />
            )))}
            {table.map((m, k) => {
              const bw = dx * 0.9
              return (
                <g key={`${k}-${hit && hit.slot === k ? hit.id : 0}`} className={`${styles.pbin} ${styles['pb_' + tone(m)]} ${hit && hit.slot === k ? styles.pbHit : ''}`}>
                  <rect x={binX(k) - bw / 2} y={binY} width={bw} height={BIN_H} rx="6" />
                  <text x={binX(k)} y={binY + BIN_H / 2 + 4} textAnchor="middle" fontSize={rows > 13 ? 10.5 : rows > 10 ? 12 : 14}>{m >= 1000 ? '1k' : m >= 100 ? Math.round(m) : m}</text>
                </g>
              )
            })}
            {ball && <circle cx={ball.x} cy={ball.y} r="7" className={styles.pball} />}
          </svg>
          <Confetti fire={g.fire} colors={['#22d3ee', '#67e8f9', '#f5c542', '#f472b6', '#fff']} />
        </section>
      </div>
    </Page>
  )
}
