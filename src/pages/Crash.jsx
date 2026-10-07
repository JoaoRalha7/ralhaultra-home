import { useCallback, useEffect, useRef, useState } from 'react'
import { BetPanel, Confetti, Page, UserAv, fmt, playSfx, useCasino, useFlag, MIN_BET } from './CasinoShared'
import { workerPost } from '../lib/points'
import styles from './Casino.module.css'

const multAt = (rate, ms) => Math.floor(Math.exp(rate * Math.max(0, ms)) * 100) / 100
const WORKER = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'
const tone = (m) => (m >= 10 ? 'gold' : m >= 5 ? 'violet' : m >= 2 ? 'cyan' : 'white')

function niceStep(max) {
  if (max <= 3) return 0.5
  if (max <= 6) return 1
  if (max <= 12) return 2
  if (max <= 30) return 5
  if (max <= 60) return 10
  if (max <= 150) return 25
  return 100
}

function Graph({ rate, ms, mult, crashed, target }) {
  const W = 640, H = 520, PL = 56, PB = 30, PT = 22, PR = 22
  const tMax = Math.max(8000, ms * 1.12)
  const yMax = Math.max(2.5, mult * 1.2)
  const X = (t) => PL + (t / tMax) * (W - PL - PR)
  const Y = (m) => H - PB - ((m - 1) / (yMax - 1)) * (H - PB - PT)
  const steps = 80
  const pts = []
  for (let i = 0; i <= steps; i++) { const t = (Math.max(ms, 0) * i) / steps; pts.push([X(t), Y(Math.exp(rate * t))]) }
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  const col = crashed ? '#f87171' : '#a78bfa'
  const step = niceStep(yMax)
  const ticks = []
  for (let v = 1; v <= yMax + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100)
  const secs = Math.floor(tMax / 1000)
  const xs = []
  const xStep = secs > 40 ? 10 : secs > 20 ? 4 : 2
  for (let sec = xStep; sec <= secs; sec += xStep) xs.push(sec)
  const label = `${mult.toFixed(2)}x`
  const bw = 22 + label.length * 15
  const bx = Math.min(W - PR - bw / 2, Math.max(PL + bw / 2, lx))
  const by = Math.max(PT + 22, ly - 34)
  return (
    <svg className={styles.graph} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Multiplier curve">
      <defs>
        <linearGradient id="crArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={col} stopOpacity=".32" /><stop offset="1" stopColor={col} stopOpacity="0" /></linearGradient>
      </defs>
      {xs.map((sec) => (
        <g key={`x${sec}`}>
          <line x1={X(sec * 1000)} x2={X(sec * 1000)} y1={PT} y2={H - PB} stroke="#fff" strokeOpacity=".05" />
          <text x={X(sec * 1000)} y={H - 8} textAnchor="middle" className={styles.axis}>{sec}s</text>
        </g>
      ))}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PL} x2={W - PR} y1={Y(v)} y2={Y(v)} stroke="#fff" strokeOpacity=".06" />
          <text x={PL - 8} y={Y(v) + 4} textAnchor="end" className={styles.axis}>{v.toFixed(2)}x</text>
        </g>
      ))}
      {target && target > 1 && target <= yMax && (
        <g>
          <line x1={PL} x2={W - PR} y1={Y(target)} y2={Y(target)} stroke="#34d399" strokeOpacity=".7" strokeDasharray="5 5" />
          <text x={PL + 4} y={Y(target) - 5} className={styles.axis} fill="#34d399">{target.toFixed(2)}x</text>
        </g>
      )}
      <polygon points={`${PL},${H - PB} ${line} ${lx},${H - PB}`} fill="url(#crArea)" />
      <polyline points={line} fill="none" stroke={crashed ? '#f87171' : '#fff'} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {ms > 0 && (
        <g>
          <circle cx={lx} cy={ly} r="5" fill={crashed ? '#f87171' : '#fff'} />
          <rect x={bx - bw / 2} y={by - 22} width={bw} height="44" rx="10" fill="#05060a" fillOpacity=".88" stroke={crashed ? '#f87171' : '#ffffff22'} />
          <text x={bx} y={by + 10} textAnchor="middle" className={styles.tipTxt} fill={crashed ? '#fca5a5' : '#fff'}>{label}</text>
        </g>
      )}
    </svg>
  )
}

const ERRS = {
  'round closed': 'Betting is closed, wait for the next round.',
  'already bet': 'You already have a bet in this round.',
  'round over': 'Too late, the round already crashed.',
  insufficient: 'Not enough points.',
  'too early': 'The round has not started yet.',
}
const ago = (iso, now) => {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`
}
const sign = (n) => `${n >= 0 ? '+' : '-'}${fmt(Math.abs(n))}`
const Av = ({ name, map }) => <UserAv name={name} src={map?.[String(name).toLowerCase()]} />

export default function Crash() {
  const g = useCasino('crash')
  const [bet, setBet] = useState(100)
  const [auto, setAuto] = useState('')
  const [autoOn, setAutoOn] = useState(false)
  const [data, setData] = useState(null) // last public state from the server
  const [offset, setOffset] = useState(0) // server clock minus local clock
  const [now, setNow] = useState(Date.now())
  const [placed, setPlaced] = useState(null) // my bet right after placing it: { seq, bet, auto }
  const [cashed, setCashed] = useState(null) // { seq, at, payout } after my own cash out
  const [over, setOver] = useState(null) // crash screen: { seq, crashAt, until, lost }
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('global')
  const [personal, setPersonal] = useState([])
  const shaking = useFlag(g.shake)
  const raf = useRef(0)
  const R = useRef({})
  const me = (g.twitchUser || '').toLowerCase()
  const avs = { ...(data?.avatars || {}), ...(me && g.avatar ? { [me]: g.avatar } : {}) }

  const serverNow = now + offset
  const round = data?.round
  const t = round ? serverNow - round.startAt : 0
  const phase = !round ? 'load' : over && over.until > now ? 'over' : t < 0 ? 'betting' : 'flying'
  const rate = data?.rate || 0.00008
  const live = phase === 'flying' ? multAt(rate, t) : null
  const mineSrv = data?.bets.find((b) => b.u === me)
  const mine = mineSrv || (placed && round && placed.seq === round.seq ? { u: me, bet: placed.bet, cashedAt: null, payout: 0 } : null)
  const myCash = mine?.cashedAt ?? (cashed && round && cashed.seq === round.seq ? cashed.at : null)
  const active = !!mine && myCash == null
  R.current = { data, over, mine, active, me }

  // one clock: smooth while flying, coarse otherwise
  useEffect(() => {
    if (phase === 'flying') {
      const tick = () => { setNow(Date.now()); raf.current = requestAnimationFrame(tick) }
      raf.current = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf.current)
    }
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [phase === 'flying']) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMine = useCallback(async () => {
    const { ok, data: d } = await workerPost('/crash/mine')
    if (ok && d.bets) setPersonal(d.bets)
  }, [])

  const pull = useCallback(async () => {
    const sent = Date.now()
    try {
      const res = await fetch(`${WORKER}/crash/state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const d = await res.json()
      if (!d.ok) return
      const recv = Date.now()
      setOffset(d.serverNow - (sent + recv) / 2)
      const prev = R.current.data?.round
      if (prev && d.round.seq > prev.seq) {
        // the round we were watching ended: show how it crashed for a moment
        const crashAt = d.last && d.last.seq === prev.seq ? d.last.crashAt : null
        const was = R.current.active
        if (crashAt && d.round.seq === prev.seq + 1) {
          setOver({ seq: prev.seq, crashAt, until: Date.now() + 3200, lost: was })
          if (was) { g.cheer(-1); setCashed(null) }
        }
        setPlaced(null)
        if (R.current.me) loadMine()
      }
      setData(d)
    } catch { /* keep the last state, try again */ }
  }, [g.cheer, loadMine]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (g.user) loadMine() }, [g.user, loadMine])
  useEffect(() => {
    let off = false, timer
    const loop = async () => {
      if (off) return
      if (document.visibilityState === 'visible') await pull()
      if (off) return
      const d = R.current.data
      const flying = d && Date.now() >= d.round.startAt - 0
      timer = setTimeout(loop, flying || R.current.over ? 800 : 2000)
    }
    loop()
    const vis = () => { if (document.visibilityState === 'visible') pull() }
    document.addEventListener('visibilitychange', vis)
    return () => { off = true; clearTimeout(timer); document.removeEventListener('visibilitychange', vis) }
  }, [pull])

  // when the countdown reaches zero, ask for the state right away so the flight starts in sync
  useEffect(() => {
    if (phase !== 'betting' || !round) return
    const ms = round.startAt - (Date.now() + offset)
    if (ms <= 0) return
    const id = setTimeout(pull, ms + 60)
    return () => clearTimeout(id)
  }, [round?.seq, phase === 'betting', offset]) // eslint-disable-line react-hooks/exhaustive-deps

  const place = async () => {
    if (busy || !round) return
    setBusy(true); setErr('')
    const a = autoOn && auto !== '' ? Number(auto) : null
    const { ok, data: d } = await workerPost('/crash/bet', { bet: Number(bet), auto: a })
    setBusy(false)
    if (!ok) { setErr(ERRS[d.error] || 'Something went wrong. Try again.'); return }
    playSfx('click')
    setPlaced({ seq: d.seq, bet: d.bet, auto: d.auto })
    if (d.newPoints != null) g.setPoints(d.newPoints)
    pull()
  }
  const cash = async () => {
    if (busy || !round || !active) return
    setBusy(true); setErr('')
    const { ok, data: d } = await workerPost('/crash/cashout', { seq: round.seq })
    setBusy(false)
    if (!ok) { setErr(ERRS[d.error] || 'Something went wrong. Try again.'); pull(); return }
    setCashed({ seq: round.seq, at: d.cashedAt, payout: d.payout })
    if (d.newPoints != null) g.setPoints(d.newPoints)
    g.cheer(d.payout - (mine?.bet || 0))
    pull(); loadMine()
  }

  const crashedView = phase === 'over'
  const shown = crashedView ? over.crashAt : (live ?? 1)
  const potential = active && live ? Math.floor(mine.bet * live) : 0
  const left = round ? Math.max(0, Math.ceil((round.startAt - serverNow) / 1000)) : 0
  const bettingOpen = !!round && t < 0
  const closing = bettingOpen && round.startAt - serverNow < 400
  const myCashOver = cashed && over && cashed.seq === over.seq ? cashed.at : null
  const players = data?.bets || []

  let cta
  if (!g.user) cta = <button type="button" className={styles.cta} disabled>Log in to play</button>
  else if (phase === 'flying' && active) cta = <button type="button" className={`${styles.cta} ${styles.pulse}`} disabled={busy} onClick={cash}>{`Cash out ${fmt(potential)}`}</button>
  else if (phase === 'flying' && myCash != null) cta = <button type="button" className={styles.cta} disabled>{`Cashed out ${myCash.toFixed(2)}x`}</button>
  else if (phase === 'flying') cta = <button type="button" className={styles.cta} disabled>Round in progress</button>
  else if (bettingOpen && mine) cta = <button type="button" className={styles.cta} disabled>{`Bet placed, starts in ${left}s`}</button>
  else if (bettingOpen) cta = <button type="button" className={styles.cta} disabled={busy || closing || Number(bet) < MIN_BET} onClick={place}>Place bet</button>
  else cta = <button type="button" className={styles.cta} disabled>Next round soon</button>

  const rowsG = data?.feed || []
  const personalRows = personal.map((b) => {
    const live_ = round && b.seq >= round.seq && b.cashedAt == null
    return { seq: b.seq, bet: b.bet, at: b.at, res: b.cashedAt != null ? b.payout - b.bet : live_ ? null : -b.bet, x: b.cashedAt }
  })

  return (
    <Page game="crash" title="Crash" sub="A new round every few seconds, shared with everyone. Bet before launch and cash out before it crashes.">
      <div className={styles.layout}>
        <BetPanel points={g.points} bet={bet} setBet={setBet} locked={!!mine || !bettingOpen} loggedIn={!!g.user}>
          <div className={styles.crStatus}>
            <span>{phase === 'flying' ? 'Round running' : crashedView ? 'Round over' : bettingOpen ? `Betting open - ${left}s` : 'Next round soon'}</span>
            {(phase === 'flying' || crashedView) && <b className={crashedView ? styles.neg : ''}>{shown.toFixed(2)}x</b>}
          </div>
          <button type="button" className={`${styles.turbo} ${autoOn ? styles.on : ''}`} aria-pressed={autoOn} disabled={!!mine} onClick={() => setAutoOn((v) => !v)}>
            <span>Auto cash out<small>Cash out when the multiplier reaches your target</small></span><i />
          </button>
          {autoOn && (
            <>
              <div className={styles.betRow}>
                <input id="auto" aria-label="Auto cash out target" type="number" step="0.1" min="1.01" placeholder="e.g. 2.00" value={auto} disabled={!!mine} onChange={(e) => setAuto(e.target.value)} />
                <span>x</span>
              </div>
              <div className={styles.quick}>
                {[1.5, 2, 5, 10].map((v) => <button key={v} type="button" disabled={!!mine} className={Number(auto) === v ? styles.on : ''} onClick={() => setAuto(String(v))}>{v}x</button>)}
              </div>
            </>
          )}
          {cta}
          {(err || g.err) && <p className={styles.err}>{err || g.err}</p>}
          <div className={styles.lvHead}><span>This round</span><b>{players.length} {players.length === 1 ? 'player' : 'players'}</b></div>
          <div className={styles.lvPlayers}>
            {!players.length && <p className={styles.lvEmpty}>No bets yet this round</p>}
            {players.map((b) => (
              <div key={b.u} className={`${styles.lvRow} ${b.u === me ? styles.lvMe : ''}`}>
                <span className={styles.lvName}><Av name={b.u} map={avs} />{b.u}</span>
                <span className={styles.lvBet}>{fmt(b.bet)}</span>
                <span className={b.cashedAt != null ? styles.pos : styles.lvDim}>{b.cashedAt != null ? `${b.cashedAt.toFixed(2)}x` : phase === 'flying' ? 'playing' : '-'}</span>
              </div>
            ))}
          </div>
          <p className={styles.note}>One bet per round. Bets close at launch. Set an auto cash out to lock in a target while you are away.</p>
        </BetPanel>

        <section className={`${styles.stage} ${styles.space} ${shaking ? styles.shake : ''}`}>
          <div className={styles.crHist}>
            {(data?.history || []).slice(0, 14).map((v, i) => <span key={i} className={`${styles.crPill} ${v >= 2 ? styles.crHi : ''}`} title={`Crashed at ${v.toFixed(2)}x`}>{v.toFixed(2)}x</span>)}
            {!(data?.history || []).length && <span className={styles.histEmpty}>Finished rounds appear here</span>}
          </div>
          <div className={`${styles.crashBox} ${crashedView ? styles.crashed : ''}`}>
            <div className={styles.stars} aria-hidden="true" />
            <Graph rate={rate} ms={Math.max(0, crashedView ? Math.log(Math.max(1, shown)) / rate : phase === 'flying' ? t : 0)} mult={shown} crashed={crashedView} target={autoOn && auto !== '' ? Number(auto) : (mine?.auto || placed?.auto || null)} />
            {phase === 'betting' || phase === 'load' ? (
              <div className={styles.lvCountBox}>
                <b>{phase === 'load' ? '...' : `${left}s`}</b>
                <span>Betting open</span>
              </div>
            ) : (
              crashedView ? (
                <div className={`${styles.big} ${styles.crOver}`}>
                  <em>Crashed</em>
                  {myCashOver != null && <i className={styles.lvNote}>You cashed out at {myCashOver.toFixed(2)}x</i>}
                </div>
              ) : phase === 'flying' && active && mine ? <i className={`${styles.lvNote} ${styles.crMine}`}>Your bet {fmt(mine.bet)}</i> : null
            )}
          </div>

          <Confetti fire={g.fire} colors={['#60a5fa', '#a78bfa', '#f5c542', '#fff', '#22d3ee']} />
        </section>
          <div className={`${styles.lvCard} ${styles.lvDock}`}>
            <div className={styles.lvTabs} role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'global'} className={tab === 'global' ? styles.on : ''} onClick={() => setTab('global')}>Global</button>
              <button type="button" role="tab" aria-selected={tab === 'personal'} className={tab === 'personal' ? styles.on : ''} onClick={() => { setTab('personal'); if (g.user) loadMine() }}>Personal</button>
            </div>
            <div className={`${styles.lvRow} ${styles.lvTh}`}><span>Player</span><span>Bet</span><span>Result</span></div>
            <div className={styles.lvList}>
              {tab === 'global' ? (
                rowsG.length ? rowsG.map((b, i) => {
                  const res = b.cashedAt != null ? b.payout - b.bet : -b.bet
                  return (
                    <div key={`${b.seq}-${b.u}-${i}`} className={styles.lvRow}>
                      <span className={styles.lvName}><Av name={b.u} map={avs} /><em>{b.u}<small>{ago(b.at, now)}</small></em></span>
                      <span className={styles.lvBet}>{fmt(b.bet)}</span>
                      <span className={res >= 0 ? styles.pos : styles.neg}>{sign(res)}</span>
                    </div>
                  )
                }) : <p className={styles.lvEmpty}>Finished bets appear here</p>
              ) : !g.user ? <p className={styles.lvEmpty}>Log in to see your bets</p>
                : personalRows.length ? personalRows.map((b, i) => (
                  <div key={`${b.seq}-${i}`} className={styles.lvRow}>
                    <span className={styles.lvName}><em>Round {b.seq}<small>{ago(b.at, now)}</small></em></span>
                    <span className={styles.lvBet}>{fmt(b.bet)}</span>
                    <span className={b.res == null ? styles.lvDim : b.res >= 0 ? styles.pos : styles.neg}>{b.res == null ? 'playing' : `${sign(b.res)}${b.x ? ` (${b.x.toFixed(2)}x)` : ''}`}</span>
                  </div>
                )) : <p className={styles.lvEmpty}>You have not played yet</p>}
            </div>
          </div>
      </div>
    </Page>
  )
}
