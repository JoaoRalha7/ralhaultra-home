import { useCallback, useEffect, useRef, useState } from 'react'
import { BetPanel, Confetti, Page, UserAv, fmt, playSfx, useCasino, MIN_BET } from './CasinoShared'
import { holdPointsPulls } from '../hooks/useStreamElementsPoints'
import { workerPost } from '../lib/points'
import styles from './Casino.module.css'

const WORKER = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'
const ERRS = {
  'round closed': 'This pot is closing, wait for the next one.',
  'pot full': 'This pot is full, wait for the next one.',
  'stake limit': 'You reached the stake limit for this pot.',
  insufficient: 'Not enough points.',
  'invalid bet': `Add between ${MIN_BET} and 10,000 points at a time.`,
}
const COLORS = ['#f97316', '#38bdf8', '#a78bfa', '#34d399', '#f472b6', '#facc15', '#fb7185', '#2dd4bf', '#818cf8', '#a3e635', '#e879f9', '#60a5fa']
const colorOf = (i) => COLORS[i % COLORS.length]
const C = 150, RO = 140, RI = 92
const pt = (deg, r) => { const a = ((deg - 90) * Math.PI) / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)] }
function arc(a0, a1) {
  if (a1 - a0 >= 359.99) a1 = a0 + 359.99
  const [x0, y0] = pt(a0, RO), [x1, y1] = pt(a1, RO), [x2, y2] = pt(a1, RI), [x3, y3] = pt(a0, RI)
  const big = a1 - a0 > 180 ? 1 : 0
  return `M${x0} ${y0} A${RO} ${RO} 0 ${big} 1 ${x1} ${y1} L${x2} ${y2} A${RI} ${RI} 0 ${big} 0 ${x3} ${y3}Z`
}
const pctOf = (a, pot) => (pot ? (a / pot) * 100 : 0)
const fmtPct = (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1)) + '%'
const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

function Wheel({ players, pot, rot, ms, avatars, children }) {
  let acc = 0
  return (
    <div className={styles.jpWheelWrap}>
      <svg viewBox="0 0 300 300" className={styles.jpWheel} role="img" aria-label="Jackpot wheel">
        <defs><clipPath id="jpClip"><circle r="13" /></clipPath></defs>
        <circle cx={C} cy={C} r="148" className={styles.jpRim} />
        <g style={{ transformOrigin: `${C}px ${C}px`, transform: `rotate(${rot}deg)`, transition: ms ? `transform ${ms}ms cubic-bezier(.1,.6,.08,1)` : 'none' }}>
          {players.length ? players.map((p, i) => {
            const a0 = (acc / pot) * 360; acc += p.amount; const a1 = (acc / pot) * 360
            const mid = (a0 + a1) / 2, [x, y] = pt(mid, 116), url = avatars?.[p.u.toLowerCase()]
            return (
              <g key={p.u}>
                <path d={arc(a0, a1)} fill={colorOf(i)} className={styles.jpSeg} />
                {a1 - a0 >= 22 && (
                  <g transform={`translate(${x} ${y}) rotate(${mid})`}>
                    <circle r="15" fill="#0b0f16" stroke="#fff" strokeOpacity=".85" strokeWidth="1.5" />
                    {url ? <image href={url} x="-13" y="-13" width="26" height="26" clipPath="url(#jpClip)" preserveAspectRatio="xMidYMid slice" /> : <text textAnchor="middle" dominantBaseline="central" className={styles.jpInit}>{p.u.slice(0, 1).toUpperCase()}</text>}
                  </g>
                )}
              </g>
            )
          }) : <circle cx={C} cy={C} r={(RO + RI) / 2} fill="none" stroke="#1d2433" strokeWidth={RO - RI} />}
        </g>
        <circle cx={C} cy={C} r={RI - 2} className={styles.jpHub} />
        <path d={`M${C} 24 l10 -20 h-20z`} className={styles.jpPointer} />
      </svg>
      <div className={styles.jpCenter}>{children}</div>
    </div>
  )
}

export default function Jackpot() {
  const g = useCasino('jackpot')
  const [amount, setAmount] = useState(100)
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
      g.cheer(won ? r.winner.payout - m.amount : -1)
      g.refresh()
    }
  }, [phase, r?.seq]) // eslint-disable-line react-hooks/exhaustive-deps

  const join = async () => {
    if (busy || !r) return
    setBusy(true); setErr('')
    const { ok, data: d } = await workerPost('/jackpot/deposit', { amount: Number(amount) })
    setBusy(false)
    if (!ok) { setErr(ERRS[d.error] || 'Something went wrong. Try again.'); pull(); return }
    playSfx('click')
    if (d.newPoints != null) g.setPoints(d.newPoints)
    pull()
  }

  const open = r && !r.done && (!r.endAt || left > 800)
  const capped = mine && cfg && mine.amount + Number(amount) > cfg.total
  const winner = phase === 'result' ? r.winner : null
  const winIdx = winner ? players.findIndex((p) => p.u === winner.u) : -1

  let center = null
  if (!r) center = <small>Loading</small>
  else if (phase === 'waiting') center = <><small>Waiting for players</small><b>{fmt(pot)}</b><span>{players.length < 2 ? 'The timer starts when a second player joins' : ''}</span></>
  else if (phase === 'counting') center = <><small>Drawing in</small><b>{clock(left)}</b><span>Pot {fmt(pot)}</span></>
  else if (phase === 'drawing') center = <><small>Drawing</small><b>...</b></>
  else if (phase === 'spinning') center = <><small>Pot</small><b>{fmt(pot)}</b></>
  else center = <><span className={styles.jpWinAv}><UserAv name={winner.u} src={avs?.[winner.u.toLowerCase()]} size={44} ring="#fde68a" /></span><b className={styles.jpWinName}>{winner.u}</b><span>{fmt(winner.payout)} pts</span></>

  return (
    <Page game="jackpot" title="Jackpot" sub="Everyone adds points to one pot. When the timer ends a wheel picks the winner, and the more you add the better your chance.">
      <div className={styles.layout}>
        <BetPanel points={g.points} bet={amount} setBet={setAmount} locked={false} loggedIn={!!g.user}>
          <button type="button" className={styles.cta} disabled={!g.user || busy || !open || Number(amount) < MIN_BET || capped} onClick={join}>
            {!g.user ? 'Log in to play' : !r ? 'Loading...' : !open ? 'Pot closed' : mine ? `Add ${fmt(Number(amount) || 0)} to the pot` : `Join the pot with ${fmt(Number(amount) || 0)}`}
          </button>
          {err && <p className={styles.err}>{err}</p>}
          {g.err && <p className={styles.err}>{g.err}</p>}
          {mine && (
            <div className={styles.autoStat}><span>Your stake</span><span>{fmt(mine.amount)} pts ({fmtPct(myPct)})</span></div>
          )}
          <p className={styles.note}>
            The timer ({cfg ? cfg.roundMs / 1000 : 60}s) starts when a second player joins. Add as often as you like until it ends. The winner takes the pot minus a {cfg ? Math.round(cfg.fee * 100) : 5}% fee. Your chance is your share of the pot.
          </p>
        </BetPanel>

        <section className={`${styles.stage} ${styles.jpStage}`}>
          <div className={styles.ribbon}>
            <div><small>Pot</small><b>{fmt(pot)}</b></div>
            <div><small>Players</small><b>{players.length}</b></div>
            <div><small>Your chance</small><b>{mine ? fmtPct(myPct) : '-'}</b></div>
            <div className={phase === 'counting' && left < 10000 ? styles.ribGold : ''}><small>Time left</small><b>{phase === 'counting' ? clock(left) : phase === 'waiting' ? '--' : '0:00'}</b></div>
          </div>

          <Wheel players={players} pot={pot} avatars={avs} rot={wheel.seq === r?.seq ? wheel.rot : 0} ms={wheel.seq === r?.seq ? wheel.ms : 0}>{center}</Wheel>

          {winner && (
            <div className={`${styles.result} ${winner.u === me ? styles.resWin : styles.resPush}`} role="status">
              <div className={styles.resMain}>
                <b>{winner.u === me ? 'You won the pot' : `${winner.u} won the pot`}</b>
                <span>{fmt(winner.payout)} pts with a {fmtPct(pctOf(winner.amount, pot))} chance</span>
              </div>
            </div>
          )}

          <Confetti fire={g.fire} colors={['#f97316', '#fdba74', '#f5c542', '#fff', '#34d399']} />
        </section>
        <div className={`${styles.lvDock} ${styles.jpDock}`}>
          <div className={styles.lvCard}>
            <div className={styles.lvHead}><span>This pot</span><b>{players.length} {players.length === 1 ? 'player' : 'players'}</b></div>
            <div className={styles.lvList}>
              {!players.length && <p className={styles.lvEmpty}>Nobody has joined yet. Be the first.</p>}
              {players.map((p, i) => (
                <div key={p.u} className={`${styles.jpRow} ${p.u === me ? styles.lvMe : ''} ${i === winIdx ? styles.jpWon : ''}`}>
                  <span className={styles.lvName}><UserAv name={p.u} src={avs?.[p.u.toLowerCase()]} ring={colorOf(i)} />{p.u}</span>
                  <span className={styles.lvBet}>{fmt(p.amount)}</span>
                  <span className={styles.jpPct}><i style={{ width: `${pctOf(p.amount, pot)}%`, background: colorOf(i) }} /><b>{fmtPct(pctOf(p.amount, pot))}</b></span>
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
