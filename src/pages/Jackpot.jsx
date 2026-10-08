import { recordStat } from '../lib/liveStats'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Coin, Confetti, Page, UserAv, fmt, playSfx, useCasino, MIN_BET, MAX_BET, useMaxBet, MaxBet } from './CasinoShared'
import { holdPointsPulls } from '../hooks/useStreamElementsPoints'
import { workerPost } from '../lib/points'
import styles from './Casino.module.css'
import J from './Jackpot.module.css'

const clampBet = (v) => Math.max(MIN_BET, Math.min(MAX_BET, Math.floor(Number(v)) || MIN_BET))

const WORKER = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'
const ERRS = {
  'round closed': 'This pot is closing, wait for the next one.',
  'pot full': 'This pot is full, wait for the next one.',
  'stake limit': 'You reached the stake limit for this pot.',
  insufficient: 'Not enough points.',
}
const COLORS = ['#f97316', '#38bdf8', '#a78bfa', '#34d399', '#f472b6', '#facc15', '#fb7185', '#2dd4bf', '#818cf8', '#a3e635', '#e879f9', '#60a5fa']
const colorOf = (i) => COLORS[i % COLORS.length]
const C = 150, RO = 140, RI = 92, RR = 148
const CIRC = 2 * Math.PI * RR
const pt = (deg, r) => { const a = ((deg - 90) * Math.PI) / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)] }
function arc(a0, a1) {
  if (a1 - a0 >= 359.99) a1 = a0 + 359.99
  const [x0, y0] = pt(a0, RO), [x1, y1] = pt(a1, RO), [x2, y2] = pt(a1, RI), [x3, y3] = pt(a0, RI)
  const big = a1 - a0 > 180 ? 1 : 0
  return `M${x0} ${y0} A${RO} ${RO} 0 ${big} 1 ${x1} ${y1} L${x2} ${y2} A${RI} ${RI} 0 ${big} 0 ${x3} ${y3}Z`
}
const mix = (hex, t) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.round(v + (255 - v) * t); return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})` }
const pctOf = (a, pot) => (pot ? (a / pot) * 100 : 0)
const fmtPct = (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1)) + '%'
const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const BULBS = Array.from({ length: 32 }, (_, i) => i)
const TICKS = Array.from({ length: 60 }, (_, i) => i)

function Wheel({ players, pot, rot, ms, avatars, progress, mode, winIdx, children }) {
  let acc = 0
  return (
    <div className={`${styles.jpWheelWrap} ${styles['jpm_' + mode]}`}>
      <svg viewBox="-20 -20 340 340" className={styles.jpWheel} role="img" aria-label="Jackpot wheel">
        <defs>
          <clipPath id="jpClip"><circle r="14" /></clipPath>
          <radialGradient id="jpHub" cx="50%" cy="40%" r="75%"><stop offset="0" stopColor="#1b2332" /><stop offset="1" stopColor="#080b12" /></radialGradient>
          <linearGradient id="jpSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".2" /><stop offset=".5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".25" /></linearGradient>
          <linearGradient id="jpGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff3c4" /><stop offset=".55" stopColor="#f5c542" /><stop offset="1" stopColor="#b45309" /></linearGradient>
          {players.map((p, i) => (
            <radialGradient key={p.u} id={`jpg${i}`} cx="50%" cy="50%" r="60%"><stop offset="0" stopColor={mix(colorOf(i), 0.38)} /><stop offset="1" stopColor={colorOf(i)} /></radialGradient>
          ))}
        </defs>

        <circle cx={C} cy={C} r="166" className={styles.jpBezel} />
        {BULBS.map((i) => { const [x, y] = pt(i * (360 / BULBS.length), 158); return <circle key={i} cx={x} cy={y} r="2.800" className={styles.jpBulb} style={{ animationDelay: `${(i / BULBS.length) * -1.6}s` }} /> })}

        <circle cx={C} cy={C} r={RR} className={styles.jpTrack} />
        {mode === 'counting' && <circle cx={C} cy={C} r={RR} className={styles.jpProg} strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - Math.max(0, Math.min(1, progress)))} transform={`rotate(-90 ${C} ${C})`} />}
        {mode === 'waiting' && <circle cx={C} cy={C} r={RR} className={styles.jpIdle} />}

        <g style={{ transformOrigin: `${C}px ${C}px`, transform: `rotate(${rot}deg)`, transition: ms ? `transform ${ms}ms cubic-bezier(.1,.6,.08,1)` : 'none' }}>
          {players.length ? players.map((p, i) => {
            const a0 = (acc / pot) * 360; acc += p.amount; const a1 = (acc / pot) * 360
            const mid = (a0 + a1) / 2, [x, y] = pt(mid, 116), url = avatars?.[p.u.toLowerCase()]
            const dim = winIdx >= 0 && i !== winIdx
            return (
              <g key={p.u} className={`${styles.jpSegG} ${dim ? styles.jpDim : ''} ${i === winIdx ? styles.jpWin : ''}`}>
                <path d={arc(a0, a1)} fill={`url(#jpg${i})`} className={styles.jpSeg} />
                {a1 - a0 >= 20 && (
                  <g transform={`translate(${x} ${y}) rotate(${mid})`}>
                    <circle r="17" fill={colorOf(i)} stroke="#fff" strokeOpacity=".9" strokeWidth="1.600" />
                    {url ? <image href={url} x="-14" y="-14" width="28" height="28" clipPath="url(#jpClip)" preserveAspectRatio="xMidYMid slice" /> : <text textAnchor="middle" dominantBaseline="central" className={styles.jpInit}>{p.u.slice(0, 1).toUpperCase()}</text>}
                  </g>
                )}
              </g>
            )
          }) : <circle cx={C} cy={C} r={(RO + RI) / 2} fill="none" stroke="#161d2b" strokeWidth={RO - RI} />}
        </g>

        {TICKS.map((i) => { const [x0, y0] = pt(i * 6, RO + 1), [x1, y1] = pt(i * 6, RO + (i % 5 ? 3 : 6)); return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className={i % 5 ? styles.jpTick : styles.jpTickBig} /> })}
        <circle cx={C} cy={C} r={RO} className={styles.jpOuterEdge} />
        <circle cx={C} cy={C} r={RI} className={styles.jpInnerEdge} />
        <circle cx={C} cy={C} r={RI - 1} fill="url(#jpHub)" />
        <circle cx={C} cy={C} r={RO} fill="url(#jpSheen)" pointerEvents="none" />
        <path d={`M${C} ${C - RR + 22} l12 -26 q-12 -9 -24 0z`} className={styles.jpPointer} />
        <circle cx={C} cy={C - RR + 2} r="3" fill="#fff7d6" />
      </svg>
      <div className={styles.jpCenter}>{children}</div>
    </div>
  )
}

export default function Jackpot() {
  const g = useCasino('jackpot')
  const [amount, setAmount] = useState(100)
  useMaxBet('jackpot', {}, amount, setAmount)
  const [data, setData] = useState(null)
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [wheel, setWheel] = useState({ seq: 0, rot: 0, ms: 0 })
  const [shown, setShown] = useState(null) // seq whose result banner is visible
  const R = useRef({})
  const spun = useRef(0)
  const me = (g.twitchUser || '').toLowerCase()
  const avs = { ...(data?.avatars || {}), ...(me && g.avatar ? { [me]: g.avatar } : {}) }

  const r = data?.round
  const cfg = data?.cfg
  const serverNow = now + offset
  const players = r?.players || []
  const pot = r?.pot || 0
  const mine = players.find((p) => p.u === me)
  const myPct = mine ? pctOf(mine.amount, pot) : 0
  const left = r?.endAt ? r.endAt - serverNow : null
  const spinEnd = r?.done && r.endAt ? r.endAt + cfg.spinMs : null
  let phase = 'waiting'
  if (r) {
    if (r.done && serverNow >= spinEnd) phase = 'result'
    else if (r.done) phase = 'spinning'
    else if (r.endAt && serverNow >= r.endAt) phase = 'drawing'
    else if (r.endAt) phase = 'counting'
  }
  R.current = { data, phase, me, mine }

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(id) }, [])

  const pull = useCallback(async () => {
    const sent = Date.now()
    try {
      const res = await fetch(`${WORKER}/jackpot/state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const d = await res.json()
      if (!d.ok) return
      setOffset(d.serverNow - (sent + Date.now()) / 2)
      setData(d)
    } catch { /* keep the last state */ }
  }, [])

  useEffect(() => {
    let off = false, timer
    const loop = async () => {
      if (off) return
      if (document.visibilityState === 'visible') await pull()
      if (off) return
      const d = R.current.data, ph = R.current.phase
      const toEnd = d?.round?.endAt ? d.round.endAt - (Date.now() + (d.serverNow - Date.now())) : 99999
      timer = setTimeout(loop, ph === 'drawing' || (ph === 'counting' && toEnd < 2500) ? 450 : ph === 'counting' ? 1500 : ph === 'spinning' ? 2500 : 2200)
    }
    loop()
    const vis = () => { if (document.visibilityState === 'visible') pull() }
    document.addEventListener('visibilitychange', vis)
    return () => { off = true; clearTimeout(timer); document.removeEventListener('visibilitychange', vis); holdPointsPulls(false) }
  }, [pull])

  // wheel: reset for a new pot, spin to the drawn ticket when the winner is known
  useEffect(() => {
    if (!r) return
    const turns = 360 * 7
    if (!r.done) {
      setWheel((w) => (w.seq === r.seq && w.rot === 0 ? w : { seq: r.seq, rot: 0, ms: 0 }))
      return
    }
    if (spun.current === r.seq) return
    spun.current = r.seq
    const final = turns - r.winner.ticket * 360
    const elapsed = Date.now() + offset - r.endAt
    if (elapsed > 1200) { setWheel({ seq: r.seq, rot: final % 360, ms: 0 }); return }
    if (R.current.mine) holdPointsPulls(true)
    playSfx('card')
    setWheel({ seq: r.seq, rot: 0, ms: 0 })
    requestAnimationFrame(() => requestAnimationFrame(() => setWheel({ seq: r.seq, rot: final, ms: Math.max(1500, cfg.spinMs - elapsed) })))
  }, [r?.seq, r?.done]) // eslint-disable-line react-hooks/exhaustive-deps

  // result banner once the spin is over: sound, confetti, balance
  useEffect(() => {
    if (phase !== 'result' || !r?.winner || shown === r.seq) return
    setShown(r.seq)
    holdPointsPulls(false)
    const m = R.current.mine
    if (m) {
      const won = r.winner.u === me
      recordStat('jackpot', r.seq, m.amount, won ? r.winner.payout : 0)
      g.cheer(won ? r.winner.payout - m.amount : -1)
      g.refresh()
    }
  }, [phase, r?.seq]) // eslint-disable-line react-hooks/exhaustive-deps

  const join = async () => {
    if (busy || !r) return
    setBusy(true); setErr('')
    const { ok, data: d } = await workerPost('/jackpot/deposit', { amount: Number(amount) })
    setBusy(false)
    if (!ok) { setErr(d.error === 'invalid bet' ? `Add between ${MIN_BET} and ${fmt(d.max ?? MAX_BET)} points at a time.` : ERRS[d.error] || 'Something went wrong. Try again.'); pull(); return }
    playSfx('click')
    if (d.newPoints != null) g.setPoints(d.newPoints)
    pull()
  }

  const open = r && !r.done && (!r.endAt || left > 800)
  const capped = mine && cfg && mine.amount + Number(amount) > cfg.total
  const winner = phase === 'result' ? r.winner : null
  const winIdx = winner ? players.findIndex((p) => p.u === winner.u) : -1

  const hot = phase === 'counting' && left < 10000
  let center = null
  if (!r) center = <small>Loading</small>
  else if (phase === 'waiting') center = <><small>Current pot</small><b className={styles.jpPot}><Coin s={22} />{fmt(pot)}</b><span>{players.length < 2 ? 'The timer starts when a second player joins' : ''}</span></>
  else if (phase === 'counting') center = <><small>Drawing in</small><b className={`${styles.jpClock} ${hot ? styles.jpHotNum : ''}`}>{clock(left)}</b><span className={styles.jpPotLine}><Coin s={14} />{fmt(pot)}</span></>
  else if (phase === 'drawing') center = <><small>Drawing</small><b className={styles.jpClock}>...</b></>
  else if (phase === 'spinning') center = <><small>Good luck</small><b className={styles.jpPot}><Coin s={22} />{fmt(pot)}</b></>
  else center = <><span className={styles.jpWinAv}><UserAv name={winner.u} src={avs?.[winner.u.toLowerCase()]} size={46} ring="#fde68a" /></span><b className={styles.jpWinName}>{winner.u}</b><span className={styles.jpPotLine}>wins <Coin s={14} />{fmt(winner.payout)}</span></>

  const add = Number(amount) || 0
  const after = mine || add ? pctOf((mine?.amount || 0) + add, pot + add) : 0
  const sorted = players.map((p, i) => ({ ...p, i })).sort((a, b) => b.amount - a.amount)

  return (
    <Page game="jackpot" title="Jackpot" sub="">
      <div className={styles.layout}>
        <aside className={`${styles.panel} ${J.panel}`}>
          <div className={J.fld}>
            <span className={J.lab}>Bet Amount<MaxBet /></span>
            <div className={J.money}>
              <i className={J.coin} aria-hidden="true" />
              <input type="number" inputMode="numeric" min={MIN_BET} value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value))))}
                onBlur={() => setAmount(clampBet(amount))} />
              <button type="button" onClick={() => setAmount(clampBet((Number(amount) || MIN_BET) / 2))}>1/2</button>
              <button type="button" onClick={() => setAmount(clampBet((Number(amount) || MIN_BET) * 2))}>2x</button>
            </div>
          </div>
          <div className={J.chance}>
            <div><small>{mine ? 'Your Chance' : 'Chance'}</small><b>{mine ? fmtPct(myPct) : '-'}</b></div>
            <i aria-hidden="true">&rarr;</i>
            <div><small>After</small><b className={J.up}>{add >= MIN_BET && open ? fmtPct(after) : '-'}</b></div>
          </div>
          <div className={J.grow} />
          <button type="button" className={J.go} disabled={!g.user || busy || !open || Number(amount) < MIN_BET || capped} onClick={join}>
            {!g.user ? 'Log in to play' : !r ? 'Loading...' : !open ? 'Pot Closed' : mine ? 'Add to Pot' : 'Join Pot'}
          </button>
          {(err || g.err) && <p className={J.err}>{err || g.err}</p>}
        </aside>

        <section className={`${styles.stage} ${styles.jpStage}`}>
          <Wheel players={players} pot={pot} avatars={avs} progress={left != null && cfg ? left / cfg.roundMs : 0} mode={phase === 'result' ? 'result' : phase} winIdx={winIdx} rot={wheel.seq === r?.seq ? wheel.rot : 0} ms={wheel.seq === r?.seq ? wheel.ms : 0}>{center}</Wheel>

          {winner && winner.u === me && mine && (
            <div className={J.pop} role="status" key={r.seq}>
              <b>{(winner.payout / mine.amount).toFixed(2)}&times;</b>
              <hr />
              <span><i className={J.coin} />{fmt(winner.payout)}</span>
            </div>
          )}
          <Confetti fire={g.fire} colors={['#f97316', '#fdba74', '#f5c542', '#fff', '#34d399']} />
        </section>
        <div className={`${styles.lvDock} ${styles.jpDock}`}>
          <div className={styles.lvCard}>
            <div className={styles.lvHead}><span>This pot</span><b>{players.length} {players.length === 1 ? 'player' : 'players'}</b></div>
            <div className={styles.lvList}>
              {!players.length && <p className={styles.lvEmpty}>Nobody has joined yet. Be the first.</p>}
              {sorted.map((p, k) => (
                <div key={p.u} className={`${styles.jpRow} ${p.u === me ? styles.lvMe : ''} ${p.i === winIdx ? styles.jpWon : ''}`} style={{ '--c': colorOf(p.i) }}>
                  <span className={styles.lvName}>
                    <UserAv name={p.u} src={avs?.[p.u.toLowerCase()]} size={32} ring={colorOf(p.i)} />
                    <em>{p.u}{k === 0 && sorted.length > 1 && <b className={styles.jpTag}>Leader</b>}<small>{fmt(p.amount)} pts</small></em>
                  </span>
                  <span className={styles.jpPct}><i style={{ width: `${pctOf(p.amount, pot)}%` }} /><b>{fmtPct(pctOf(p.amount, pot))}</b></span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.lvCard}>
            <div className={styles.lvHead}><span>Recent winners</span></div>
            <div className={styles.lvList}>
              {!(data?.history || []).length && <p className={styles.lvEmpty}>Finished pots appear here</p>}
              {(data?.history || []).map((h) => (
                <div key={h.seq} className={styles.lvRow}>
                  <span className={styles.lvName}><UserAv name={h.u} src={avs?.[String(h.u).toLowerCase()]} /><em>{h.u}<small>Pot {fmt(h.pot)}</small></em></span>
                  <span className={styles.lvBet}>{fmt(h.amount)}</span>
                  <span className={styles.pos}>+{fmt(h.payout)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Page>
  )
}
