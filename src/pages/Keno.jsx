import { useEffect, useRef, useState } from 'react'
import { Confetti, HistoryStrip, Page, fmt, playSfx, useCasino, useFlag, MIN_BET, MAX_BET } from './CasinoShared'
import { KENO, KENO_RISK, kenoTable } from '../lib/keno'
import shared from './Casino.module.css'
import styles from './Keno.module.css'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const num = (v) => Math.max(0, Number(v) || 0)
const clampBet = (v) => Math.max(MIN_BET, Math.min(MAX_BET, Math.floor(Number(v)) || MIN_BET))
const cap = (s) => s[0].toUpperCase() + s.slice(1)
const xfmt = (m) => (m >= 100 ? Math.round(m).toLocaleString('en-US') : Number.isInteger(m) ? String(m) : m.toFixed(2)) + 'x'
const Chev = ({ up }) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{up ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}</svg>

function Money({ label, value, setValue, disabled }) {
  return (
    <div className={styles.fld}>
      <span className={styles.lab}>{label}</span>
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
          {Object.keys(KENO_RISK).map((k) => (
            <li key={k} role="option" aria-selected={k === value} className={k === value ? styles.cur : ''} onClick={() => { setValue(k); setOpen(false) }}>{cap(k)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Keno() {
  const g = useCasino('keno')
  const [bet, setBet] = useState(100)
  const [picks, setPicks] = useState([])
  const [tab, setTab] = useState('manual')
  const [risk, setRisk] = useState('classic')
  const [nBets, setNBets] = useState(0)
  const [adv, setAdv] = useState(false)
  const [cfg, setCfg] = useState({ stopProfit: '', stopLoss: '', onWin: '', onLoss: '' })
  const [view, setView] = useState(null) // { res, shown }
  const [auto, setAuto] = useState(false)
  const [playing, setPlaying] = useState(false)
  const shaking = useFlag(g.shake)

  // latest values for the async loops
  const R = useRef({})
  R.current = { bet, picks, cfg, risk, nBets }
  const stop = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; stop.current = true } }, [])

  const locked = playing || auto
  const table = picks.length ? kenoTable(picks.length, risk) : []
  const res = view?.res
  const done = !!res && view.shown >= KENO.draw
  const drawn = res ? res.draw.slice(0, view.shown) : []
  const drawnSet = new Set(drawn)
  const pickSet = new Set(res ? res.picks : picks)
  const hitsNow = drawn.filter((n) => pickSet.has(n)).length
  const won = done && res.payout > res.bet

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
    const { picks: pk, risk: rk } = R.current
    setPlaying(true); setView(null)
    g.hold.current = true
    const data = await g.start({ bet: stake, picks: pk, risk: rk })
    if (!data?.state || data.state.game !== 'keno') { g.release(); setPlaying(false); return null }
    const s = data.state
    for (let i = 1; i <= KENO.draw; i++) {
      if (!alive.current) return s
      setView({ res: s, shown: i })
      playSfx(pk.includes(s.draw[i - 1]) ? 'gem' : 'click')
      await sleep(i === KENO.draw ? 260 : 120)
    }
    g.release()
    setPlaying(false)
    return s
  }

  const playOnce = async () => {
    if (locked || !picks.length || Number(bet) < MIN_BET) return
    await playRound(clampBet(bet))
  }

  const runAuto = async () => {
    if (locked || !picks.length || Number(bet) < MIN_BET) return
    stop.current = false; setAuto(true)
    const base = clampBet(bet)
    let cur = base, n = 0, net = 0
    while (!stop.current && alive.current) {
      const c = R.current.cfg
      const max = Math.floor(num(R.current.nBets))
      if (max && n >= max) break
      const s = await playRound(cur)
      if (!s) break
      n++; net += s.payout - s.bet
      const profit = s.payout - s.bet
      if (num(c.stopProfit) && net >= num(c.stopProfit)) break
      if (num(c.stopLoss) && -net >= num(c.stopLoss)) break
      const pct = profit > 0 ? num(c.onWin) : num(c.onLoss)
      cur = pct ? Math.min(MAX_BET, Math.max(MIN_BET, Math.round(cur * (1 + pct / 100)))) : base
      await sleep(650)
    }
    if (alive.current) { setAuto(false); setPlaying(false) }
  }

  const setC = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.value }))
  const canGo = !g.busy && !!g.user && picks.length > 0 && Number(bet) >= MIN_BET && !playing
  const switchTab = (t) => { if (!locked) setTab(t) }

  return (
    <Page game="keno" title="Keno" sub="">
      <div className={shared.layout}>
        <aside className={`${shared.panel} ${styles.panel}`}>
          <div className={styles.tabs} role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'manual'} disabled={locked} className={tab === 'manual' ? styles.on : ''} onClick={() => switchTab('manual')}>Manual</button>
            <button type="button" role="tab" aria-selected={tab === 'auto'} disabled={locked} className={tab === 'auto' ? styles.on : ''} onClick={() => switchTab('auto')}>Auto</button>
          </div>
          <Money label="Bet Amount" value={bet} setValue={setBet} disabled={locked} />
          <RiskSelect value={risk} setValue={(k) => { setRisk(k); setView(null) }} disabled={locked} />

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

          <div className={styles.twoBtn}>
            <button type="button" className={styles.ghost} disabled={locked} onClick={randomPick}>Random</button>
            <button type="button" className={styles.ghost} disabled={locked || !picks.length} onClick={clear}>Clear</button>
          </div>
          <div className={styles.grow} />
          {auto ? (
            <button type="button" className={styles.go} onClick={() => { stop.current = true }}>Stop Autobet</button>
          ) : tab === 'auto' ? (
            <button type="button" className={styles.go} disabled={!canGo} onClick={runAuto}>{g.user ? 'Start Autobet' : 'Log in to play'}</button>
          ) : (
            <button type="button" className={styles.go} disabled={!canGo} onClick={playOnce}>{g.user ? 'Place Bet' : 'Log in to play'}</button>
          )}
          {g.err && <p className={styles.err}>{g.err}</p>}
        </aside>

        <section className={`${styles.stage} ${shaking ? shared.shake : ''}`}>
          <div className={styles.histWrap}><HistoryStrip items={g.history} /></div>
          <div className={styles.board}>
            <div className={styles.grid}>
              {Array.from({ length: KENO.size }, (_, i) => {
                const n = i + 1
                const sel = pickSet.has(n), isDrawn = drawnSet.has(n)
                const hit = sel && isDrawn, miss = !sel && isDrawn
                return (
                  <button key={n} type="button" disabled={locked} onClick={() => toggle(n)} aria-pressed={sel}
                    className={`${styles.tile} ${sel ? styles.tSel : ''} ${hit ? styles.tHit : ''} ${miss ? styles.tMiss : ''}`}>
                    {hit ? <span className={styles.oct}>{n}</span> : n}
                  </button>
                )
              })}
            </div>
            {won && (
              <div className={styles.pop} role="status" key={res.id}>
                <b>{res.mult.toFixed(2)}&times;</b>
                <hr />
                <span><i className={styles.coin} />{fmt(res.payout)}</span>
              </div>
            )}
          </div>

          {picks.length > 0 || res ? (
            <div className={styles.pay} style={{ gridTemplateColumns: `repeat(${table.length || 1}, 1fr)` }} aria-label="Paytable">
              {(res ? kenoTable(res.picks.length, res.risk || risk) : table).map((m, h) => (
                <div key={h} className={h === hitsNow ? styles.cur : ''}>
                  <span className={h <= hitsNow ? styles.live : ''}><i />{h}</span>
                  {xfmt(m || 0)}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.hint}>Select 1-10 numbers to play</div>
          )}
          <Confetti fire={g.fire} colors={['#34d399', '#6ee7b7', '#22d3ee', '#f5c542', '#fff']} />
        </section>
      </div>
    </Page>
  )
}
