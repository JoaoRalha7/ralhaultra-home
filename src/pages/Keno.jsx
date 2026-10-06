import { useEffect, useRef, useState } from 'react'
import { BetPanel, Confetti, HistoryStrip, Page, fmt, playSfx, useCasino, MIN_BET, MAX_BET } from './CasinoShared'
import { KENO, KENO_RISK, kenoTable } from '../lib/keno'
import styles from './Casino.module.css'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const num = (v) => Math.max(0, Number(v) || 0)

export default function Keno() {
  const g = useCasino('keno')
  const [bet, setBet] = useState(100)
  const [picks, setPicks] = useState([])
  const [mode, setMode] = useState('manual')
  const [risk, setRisk] = useState('classic')
  const [turbo, setTurbo] = useState(false)
  const [cfg, setCfg] = useState({ rounds: '10', stopProfit: '', stopLoss: '', onWin: '', onLoss: '' })
  const [view, setView] = useState(null) // { res, shown }
  const [auto, setAuto] = useState(false)
  const [stat, setStat] = useState({ n: 0, net: 0 })
  const [playing, setPlaying] = useState(false)

  // latest values for the async loops
  const R = useRef({})
  R.current = { bet, picks, turbo, cfg, risk }
  const stop = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; stop.current = true } }, [])

  const locked = playing || auto
  const table = picks.length ? kenoTable(picks.length, risk) : []
  const res = view?.res
  const done = !!res && view.shown >= KENO.draw
  const drawnSet = new Set(res ? res.draw.slice(0, view.shown) : [])

  const toggle = (n) => {
    if (locked) return
    setView(null)
    setPicks((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length < KENO.max ? [...p, n].sort((a, b) => a - b) : p))
    playSfx('click')
  }
  const randomPick = () => {
    if (locked) return
    const count = picks.length || KENO.max
    const all = Array.from({ length: KENO.size }, (_, i) => i + 1).sort(() => Math.random() - 0.5)
    setView(null); setPicks(all.slice(0, count).sort((a, b) => a - b)); playSfx('click')
  }
  const clear = () => { if (!locked) { setPicks([]); setView(null) } }

  // one round: server settles instantly, the client only animates the reveal
  const playRound = async (stake) => {
    const { picks: pk, turbo: tb, risk: rk } = R.current
    setPlaying(true); setView(null)
    g.quiet.current = tb
    const data = await g.start({ bet: stake, picks: pk, risk: rk })
    if (!data?.state || data.state.game !== 'keno') { setPlaying(false); return null }
    const s = data.state
    if (tb) { setView({ res: s, shown: KENO.draw }) }
    else {
      for (let i = 1; i <= KENO.draw; i++) {
        if (!alive.current) return s
        setView({ res: s, shown: i })
        playSfx(pk.includes(s.draw[i - 1]) ? 'gem' : 'click')
        await sleep(i === KENO.draw ? 260 : 120)
      }
    }
    setPlaying(false)
    return s
  }

  const playOnce = async () => {
    if (locked || !picks.length || Number(bet) < MIN_BET) return
    await playRound(Number(bet))
  }

  const runAuto = async () => {
    if (locked || !picks.length || Number(bet) < MIN_BET) return
    stop.current = false; setAuto(true); setStat({ n: 0, net: 0 })
    const base = Number(bet)
    let cur = base, n = 0, net = 0
    while (!stop.current && alive.current) {
      const c = R.current.cfg
      const max = Math.floor(num(c.rounds))
      if (max && n >= max) break
      const s = await playRound(cur)
      if (!s) break
      n++; net += s.payout - s.bet
      setStat({ n, net })
      const profit = s.payout - s.bet
      if (num(c.stopProfit) && net >= num(c.stopProfit)) break
      if (num(c.stopLoss) && -net >= num(c.stopLoss)) break
      const pct = profit > 0 ? num(c.onWin) : num(c.onLoss)
      cur = pct ? Math.min(MAX_BET, Math.max(MIN_BET, Math.round(cur * (1 + pct / 100)))) : base
      await sleep(R.current.turbo ? 90 : 650)
    }
    g.quiet.current = false
    if (alive.current) { setAuto(false); setPlaying(false) }
  }

  const won = done && res.payout > res.bet
  const profit = done ? res.payout - res.bet : 0
  const setC = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.value }))
  const disabledStart = g.busy || !g.user || !picks.length || Number(bet) < MIN_BET

  return (
    <Page game="keno" title="Keno" sub="Pick up to 10 numbers. The house draws 10 of 40. The more you match, the more you win.">
      <div className={styles.layout}>
        <BetPanel points={g.points} bet={bet} setBet={setBet} locked={locked} loggedIn={!!g.user}>
          <div className={styles.seg} role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'manual'} className={mode === 'manual' ? styles.on : ''} disabled={auto} onClick={() => setMode('manual')}>Manual</button>
            <button type="button" role="tab" aria-selected={mode === 'auto'} className={mode === 'auto' ? styles.on : ''} disabled={auto} onClick={() => setMode('auto')}>Auto</button>
          </div>

          <span className={styles.lbl}>Risk</span>
          <div className={`${styles.quick} ${styles.riskRow}`}>
            {Object.keys(KENO_RISK).map((k) => (
              <button key={k} type="button" disabled={locked} className={risk === k ? styles.on : ''} onClick={() => { setRisk(k); setView(null) }}>{k[0].toUpperCase() + k.slice(1)}</button>
            ))}
          </div>

          {mode === 'auto' && (
            <>
              <div className={styles.kRow}>
                <label>Rounds (0 = endless)<input type="number" min="0" inputMode="numeric" value={cfg.rounds} disabled={auto} onChange={setC('rounds')} /></label>
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
            <span>Turbo<small>No draw animation or sound</small></span><i />
          </button>

          {auto && (
            <div className={styles.autoStat}>
              <span>Round {stat.n}</span>
              <span className={stat.net >= 0 ? styles.pos : styles.neg}>{stat.net >= 0 ? '+' : '-'}{fmt(Math.abs(stat.net))} pts</span>
            </div>
          )}

          {auto ? (
            <button type="button" className={styles.ctaAlt} onClick={() => { stop.current = true }}>Stop auto</button>
          ) : mode === 'auto' ? (
            <button type="button" className={styles.cta} disabled={disabledStart || playing} onClick={runAuto}>{g.user ? 'Start auto bet' : 'Log in to play'}</button>
          ) : (
            <button type="button" className={styles.cta} disabled={disabledStart || playing} onClick={playOnce}>
              {!g.user ? 'Log in to play' : !picks.length ? 'Pick your numbers' : 'Bet'}
            </button>
          )}
          {g.err && <p className={styles.err}>{g.err}</p>}
          <p className={styles.note}>Payouts are fixed by the odds of your pick count (about 99% return, 1000x max). Higher risk pays less on low hits and far more on high hits. Autobet stops on its own if you run out of points or hit an error.</p>
        </BetPanel>

        <section className={styles.stage}>
          <HistoryStrip items={g.history} />
          <div className={styles.ribbon}>
            <div><small>Picks</small><b>{picks.length}/{KENO.max}</b></div>
            <div><small>Hits</small><b>{done ? `${res.hits}/${res.picks.length}` : '-'}</b></div>
            <div><small>Multiplier</small><b>{done ? `${res.mult.toFixed(2)}x` : '-'}</b></div>
            <div className={won ? styles.ribGold : ''}><small>Profit</small><b>{done ? `${profit >= 0 ? '+' : '-'}${fmt(Math.abs(profit))}` : '-'}</b></div>
          </div>

          <div className={styles.kenoGrid}>
            {Array.from({ length: KENO.size }, (_, i) => {
              const n = i + 1
              const sel = picks.includes(n), drawn = drawnSet.has(n)
              return (
                <button key={n} type="button" disabled={locked} onClick={() => toggle(n)} aria-pressed={sel}
                  className={`${styles.kn} ${sel ? styles.sel : ''} ${drawn ? styles.drawn : ''} ${sel && drawn ? styles.hit : ''}`}>{n}</button>
              )
            })}
          </div>

          <div className={styles.kenoTools}>
            <button type="button" disabled={locked} onClick={randomPick}>Random pick</button>
            <button type="button" disabled={locked || !picks.length} onClick={clear}>Clear</button>
          </div>

          {picks.length > 0 && (
            <div className={styles.payRow} aria-label="Paytable">
              {table.map((m, h) => (
                <span key={h} className={done && res.hits === h ? styles.cur : ''}><small>{h} hit{h === 1 ? '' : 's'}</small>{m ? `${m.toFixed(2)}x` : '0x'}</span>
              ))}
            </div>
          )}
          <Confetti fire={g.fire} colors={['#ec4899', '#f9a8d4', '#34d399', '#f5c542', '#fff']} />
        </section>
      </div>
    </Page>
  )
}
