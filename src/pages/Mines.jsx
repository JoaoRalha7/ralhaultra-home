import { useEffect, useRef, useState } from 'react'
import { Confetti, HistoryStrip, Page, fmt, playSfx, useCasino, useFlag, MIN_BET, MAX_BET, useMaxBet, MaxBet } from './CasinoShared'
import { Gem as GemI, Bomb as BombI } from '../components/MineIcons'
import shared from './Casino.module.css'
import styles from './Mines.module.css'

const Gem = () => <GemI className={styles.gem} />
const Bomb = () => <BombI className={styles.gem} />
const Chev = ({ up }) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{up ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}</svg>

// same maths as the worker
const mult = (k, m) => { let x = 0.99; for (let i = 0; i < k; i++) x *= (25 - i) / (25 - m - i); return Math.floor(x * 100) / 100 }
const clampBet = (v) => Math.max(MIN_BET, Math.min(MAX_BET, Math.floor(Number(v)) || MIN_BET))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function Money({ label, value, setValue, disabled }) {
  return (
    <div className={styles.fld}>
      <span className={styles.lab}>{label}{label === 'Bet Amount' && <MaxBet />}</span>
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

function MinesSelect({ value, setValue, disabled }) {
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
      <span className={styles.lab}>Mines</span>
      <button type="button" className={`${styles.sel} ${disabled ? styles.off : ''}`} disabled={disabled} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <b>{value}</b><Chev up={open} />
      </button>
      {open && (
        <ul className={styles.list} role="listbox">
          {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
            <li key={n} role="option" aria-selected={n === value} className={n === value ? styles.cur : ''} onClick={() => { setValue(n); setOpen(false) }}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Mines() {
  const g = useCasino('mines')
  const [tab, setTab] = useState('manual')
  const [bet, setBet] = useState(100)
  const [mines, setMines] = useState(3)
  useMaxBet('mines', { mines }, bet, setBet)
  const [picks, setPicks] = useState([]) // auto: tiles to reveal, in click order
  const [nBets, setNBets] = useState(0)
  const [adv, setAdv] = useState(false)
  const [stopWin, setStopWin] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [auto, setAuto] = useState(false)
  const stop = useRef(false), alive = useRef(true)
  const r = g.round
  const active = r?.status === 'active'
  const done = r?.status === 'done'
  const won = done && r.payout > 0
  const shaking = useFlag(g.shake)
  const k = r?.revealed?.length || 0
  const m = active || done ? r.mines : mines
  useEffect(() => { alive.current = true; return () => { alive.current = false; stop.current = true } }, [])
  useEffect(() => { setPicks((p) => p.slice(0, 25 - mines)) }, [mines])

  const reveal = (i) => {
    if (!active || g.busy || r.revealed.includes(i)) return
    playSfx('click'); g.act('reveal', { index: i })
  }
  const random = () => {
    const free = Array.from({ length: 25 }, (_, i) => i).filter((i) => !r.revealed.includes(i))
    if (free.length) reveal(free[Math.floor(Math.random() * free.length)])
  }
  const togglePick = (i) => { if (done) g.setRound(null); setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < 25 - mines ? [...p, i] : p)) }

  const [run, setRun] = useState({ n: 0, net: 0, why: '' })
  const runAuto = async () => {
    if (auto || !picks.length) return
    stop.current = false; setAuto(true); g.setErr('')
    setRun({ n: 0, net: 0, why: '' })
    const max = Math.floor(Number(nBets)) || 0, sw = Number(stopWin) || 0, sl = Number(stopLoss) || 0
    let n = 0, net = 0, why = ''
    try {
      while (!stop.current && alive.current && (!max || n < max)) {
        const d = await g.start({ bet: Number(bet), mines })
        if (!d?.state) { why = 'Could not start a round'; break }
        let s = d.state
        for (const i of picks) {
          if (stop.current || !alive.current || s.status !== 'active') break
          await sleep(300)
          const a = await g.act('reveal', { index: i })
          if (!a?.state) { s = null; break }
          s = a.state
        }
        if (!s) { why = 'Round interrupted'; break }
        if (s.status === 'active') { await sleep(300); const c = await g.act('cashout'); if (!c?.state) { why = 'Cash out failed'; break } s = c.state }
        n++; net += s.payout - s.bet
        if (alive.current) setRun({ n, net, why: '' })
        if (sw && net >= sw) { why = 'Stop on profit reached'; break }
        if (sl && -net >= sl) { why = 'Stop on loss reached'; break }
        await sleep(700)
      }
    } catch { why = 'Connection error' }
    if (!why && stop.current) why = 'Stopped'
    if (!why && max && n >= max) why = 'All bets done'
    if (alive.current) { setRun({ n, net, why }); setAuto(false) }
  }

  const profit = active ? Math.floor(r.bet * r.mult) - r.bet : 0
  const nextProfit = active ? Math.floor(r.bet * r.nextMult) - r.bet : 0
  const winProfit = picks.length ? Math.floor(Number(bet) * mult(picks.length, mines)) - Number(bet) : 0
  const lock = active || auto

  return (
    <Page game="mines" title="Mines" sub="">
      <div className={shared.layout}>
        <aside className={`${shared.panel} ${styles.panel}`}>
          <div className={styles.tabs} role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'manual'} disabled={lock} className={tab === 'manual' ? styles.on : ''} onClick={() => { if (done) g.setRound(null); setTab('manual') }}>Manual</button>
            <button type="button" role="tab" aria-selected={tab === 'auto'} disabled={lock} className={tab === 'auto' ? styles.on : ''} onClick={() => { if (done) g.setRound(null); setTab('auto') }}>Auto</button>
          </div>
          <Money label="Bet Amount" value={bet} setValue={setBet} disabled={lock} />
          <MinesSelect value={mines} setValue={setMines} disabled={lock} />

          {tab === 'manual' && active && (
            <>
              <div className={styles.profit}>
                <div><small>Current Profit</small><p><i className={styles.coin} /><b>{fmt(profit)}</b><em>{r.mult.toFixed(2)}x</em></p></div>
                <div><small>Profit on next click</small><p><i className={styles.coin} /><b>{fmt(nextProfit)}</b><em>{r.nextMult.toFixed(2)}x</em></p></div>
              </div>
              <button type="button" className={styles.ghost} disabled={g.busy} onClick={random}>Pick Random Tile</button>
              <button type="button" className={styles.go} disabled={g.busy || !k} onClick={() => { playSfx('cash'); g.act('cashout') }}>Cashout</button>
            </>
          )}
          {tab === 'manual' && !active && (
            <button type="button" className={styles.go} disabled={g.busy || !g.user || Number(bet) < MIN_BET}
              onClick={() => { playSfx('click'); g.start({ bet: Number(bet), mines }) }}>{g.user ? 'Place Bet' : 'Log in to play'}</button>
          )}

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
                  <div className={styles.fld}><span className={styles.lab}>Stop on Profit</span><div className={styles.money}><i className={styles.coin} /><input type="number" min="0" value={stopWin} disabled={auto} onChange={(e) => setStopWin(e.target.value)} placeholder="0" /></div></div>
                  <div className={styles.fld}><span className={styles.lab}>Stop on Loss</span><div className={styles.money}><i className={styles.coin} /><input type="number" min="0" value={stopLoss} disabled={auto} onChange={(e) => setStopLoss(e.target.value)} placeholder="0" /></div></div>
                </>
              )}
              <div className={styles.grow} />
              <button type="button" className={styles.ghost} disabled={auto || !picks.length} onClick={() => setPicks([])}>Clear</button>
              <div className={styles.pow}><span>Profit On Win</span><i className={styles.coin} /><b>{fmt(winProfit)}</b></div>
              {auto
                ? <button type="button" className={styles.go} onClick={() => { stop.current = true }}>Stop Autobet</button>
                : <button type="button" className={styles.go} disabled={!g.user || !picks.length || Number(bet) < MIN_BET} onClick={runAuto}>{g.user ? 'Start Autobet' : 'Log in to play'}</button>}
            </>
          )}
          {tab === 'auto' && (run.n > 0 || run.why) && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9aa3b2', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span>Bets <b style={{ color: '#fff' }}>{run.n}</b></span>
              <span>Net <b style={{ color: run.net >= 0 ? '#34d399' : '#f87171' }}>{run.net >= 0 ? '+' : ''}{fmt(run.net)}</b></span>
              {run.why && !auto && <span>{run.why}</span>}
            </p>
          )}
          {g.err && <p className={styles.err}>{g.err}</p>}
        </aside>

        <section className={`${styles.stage} ${shaking ? shared.shake : ''}`}>
          <div className={styles.histWrap}><HistoryStrip items={g.history} /></div>
          <div className={styles.grid}>
            {Array.from({ length: 25 }, (_, i) => {
              const shown = r?.revealed?.includes(i)
              const isMine = done && r.minePositions?.includes(i)
              const missed = done && !shown && !isMine
              const boom = done && r.hit === i
              const picked = tab === 'auto' && picks.includes(i) && !shown && !isMine && !missed
              return (
                <button key={`${r?.id || 'x'}-${i}`} type="button" aria-label={shown ? 'Gem' : isMine ? 'Mine' : `Tile ${i + 1}`}
                  disabled={tab === 'auto' ? auto : !active || shown || g.busy}
                  onClick={() => (tab === 'auto' ? togglePick(i) : reveal(i))}
                  style={{ '--d': done ? `${(i % 5) * 40 + Math.floor(i / 5) * 30}ms` : '0ms' }}
                  className={`${styles.tile} ${shown ? styles.tGem : ''} ${isMine ? styles.tMine : ''} ${missed ? styles.tMiss : ''} ${boom ? styles.tBoom : ''} ${picked ? styles.tPick : ''} ${active && !shown ? styles.tLive : ''}`}>
                  {shown || missed ? <Gem /> : isMine ? <Bomb /> : null}
                </button>
              )
            })}
            {won && (
              <div className={styles.pop} role="status" key={r.id}>
                <b>{(r.payout / r.bet).toFixed(2)}&times;</b>
                <hr />
                <span><i className={styles.coin} />{fmt(r.payout)}</span>
              </div>
            )}
          </div>
          <Confetti fire={g.fire} colors={['#34d399', '#6ee7b7', '#22d3ee', '#f5c542', '#fff']} />
        </section>
      </div>
    </Page>
  )
}
