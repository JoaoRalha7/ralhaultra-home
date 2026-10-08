import { useCallback, useEffect, useRef, useState } from 'react'
import { recordStat } from '../lib/liveStats'
import { Confetti, Page, UserAv, fmt, playSfx, useCasino, useFlag, MIN_BET, MAX_BET, useMaxBet, MaxBet } from './CasinoShared'
import { workerPost } from '../lib/points'
import shared from './Casino.module.css'
import styles from './Crash.module.css'

const multAt = (rate, ms) => Math.floor(Math.exp(rate * Math.max(0, ms)) * 100) / 100
const WORKER = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'

function niceStep(max) {
  if (max <= 2.2) return 0.2
  if (max <= 3) return 0.5
  if (max <= 6) return 1
  if (max <= 12) return 2
  if (max <= 30) return 5
  if (max <= 60) return 10
  if (max <= 150) return 25
  return 100
}

function Graph({ rate, ms, mult, crashed, idle }) {
  const W = 900, H = 520, PL = 62, PB = 34, PT = 22, PR = 28
  const tMax = Math.max(2000, ms * 1.12)
  const yMax = Math.max(2, mult * 1.16)
  const X = (t) => PL + (t / tMax) * (W - PL - PR)
  const Y = (m) => H - PB - ((m - 1) / (yMax - 1)) * (H - PB - PT)
  const steps = 90
  const pts = []
  for (let i = 0; i <= steps; i++) { const t = (Math.max(ms, 0) * i) / steps; pts.push([X(t), Y(Math.exp(rate * t))]) }
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  const col = crashed ? '#ef4444' : '#22ff7a'
  const step = niceStep(yMax)
  const ticks = []
  for (let v = 1; v <= yMax + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100)
  const secs = tMax / 1000
  const xStep = secs <= 4 ? 0.5 : secs <= 10 ? 2 : secs <= 20 ? 5 : secs <= 60 ? 10 : 30
  const xs = []
  for (let sec = 0; sec <= secs + 1e-9; sec += xStep) xs.push(sec)
  const fmtY = (v) => (step < 1 ? `${v.toFixed(1)}x` : `${Math.round(v)}x`)
  const fmtX = (sec) => (xStep < 1 ? `${sec.toFixed(1)}s` : `${Math.round(sec)}s`)
  return (
    <svg className={styles.graph} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Multiplier curve">
      <defs>
        <linearGradient id="crA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={col} stopOpacity=".22" /><stop offset="1" stopColor={col} stopOpacity="0" /></linearGradient>
      </defs>
      <line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} stroke="#fff" strokeOpacity=".08" />
      <line x1={PL} x2={PL} y1={PT} y2={H - PB} stroke="#fff" strokeOpacity=".08" />
      {xs.map((sec) => <text key={`x${sec}`} x={X(sec * 1000)} y={H - 10} textAnchor="middle" className={styles.axis}>{fmtX(sec)}</text>)}
      {ticks.map((v) => <text key={v} x={PL - 12} y={Y(v) + 4} textAnchor="end" className={styles.axis}>{fmtY(v)}</text>)}
      {!idle && ms > 0 && (
        <g>
          <polygon points={`${PL},${H - PB} ${line} ${lx},${H - PB}`} fill="url(#crA)" />
          <polyline points={line} fill="none" stroke={col} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 6px ${col}88)` }} />
          <circle cx={lx} cy={ly} r="6" fill={col} stroke="#0d1018" strokeWidth="2" />
        </g>
      )}
      {(idle || ms <= 0) && <circle cx={PL} cy={H - PB} r="6" fill={col} />}
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
  useMaxBet('crash', {}, bet, setBet)
  const [data, setData] = useState(null) // last public state from the server
  const [offset, setOffset] = useState(0) // server clock minus local clock
  const [now, setNow] = useState(Date.now())
  const [placed, setPlaced] = useState(null) // my bet right after placing it: { seq, bet, auto }
  const [cashed, setCashed] = useState(null) // { seq, at, payout } after my own cash out
  const [over, setOver] = useState(null) // crash screen: { seq, crashAt, until, lost }
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('manual')
  const [feedTab, setFeedTab] = useState('global')
  const [personal, setPersonal] = useState([])
  const [cashAt, setCashAt] = useState('2.00')
  const [queued, setQueued] = useState(false)
  const [autoRun, setAutoRun] = useState(false)
  const [nBets, setNBets] = useState(0)
  const [adv, setAdv] = useState(false)
  const [stopWin, setStopWin] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [showSettings, setShowSettings] = useState(true)
  const startPts = useRef(null), autoDone = useRef(0)
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
    if (phase === 'flying' || phase === 'betting') {
      const tick = () => { setNow(Date.now()); raf.current = requestAnimationFrame(tick) }
      raf.current = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf.current)
    }
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [phase === 'flying' || phase === 'betting']) // eslint-disable-line react-hooks/exhaustive-deps

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
          if (was) { g.cheer(-1); recordStat('crash', prev.seq, R.current.mine?.bet, 0); setCashed(null) }
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
    const a = Number(cashAt) >= 1.01 ? Math.round(Number(cashAt) * 100) / 100 : null
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
    recordStat('crash', round.seq, mine?.bet, d.payout)
    g.cheer(d.payout - (mine?.bet || 0))
    pull(); loadMine()
  }

  const crashedView = phase === 'over'
  const shown = crashedView ? over.crashAt : (live ?? 1)
  const potential = active && live ? Math.floor(mine.bet * live) : 0
  const leftMs = round ? Math.max(0, round.startAt - serverNow) : 0
  const bettingOpen = !!round && t < 0
  const closing = bettingOpen && leftMs < 400
  const myCashOver = cashed && over && cashed.seq === over.seq ? cashed.at : null
  const players = data?.bets || []
  const total = players.reduce((a, b) => a + b.bet, 0)
  const target = Number(cashAt) >= 1.01 ? Math.round(Number(cashAt) * 100) / 100 : null
  const profitOnWin = target ? Math.floor(Number(bet) * (target - 1)) : 0

  // queued bet (clicked during a round) and autobet: placed as soon as betting opens
  useEffect(() => {
    if (!round || !bettingOpen || mine || busy || closing || !g.user) return
    if (!(queued || autoRun)) return
    if (Number(bet) < MIN_BET) { setQueued(false); setAutoRun(false); return }
    if (autoRun) {
      const max = Math.floor(Number(nBets)) || 0
      const net = (g.points ?? 0) - (startPts.current ?? g.points ?? 0)
      if ((max && autoDone.current >= max) || (Number(stopWin) && net >= Number(stopWin)) || (Number(stopLoss) && -net >= Number(stopLoss))) { setAutoRun(false); return }
      autoDone.current++
    }
    setQueued(false)
    place()
  }, [round?.seq, bettingOpen, queued, autoRun, !!mine, closing]) // eslint-disable-line react-hooks/exhaustive-deps

  const locked = !!mine || !bettingOpen || autoRun
  let cta
  if (!g.user) cta = <button type="button" className={styles.go} disabled>Log in to play</button>
  else if (phase === 'flying' && active) cta = <button type="button" className={styles.go} disabled={busy} onClick={cash}>Cashout <i className={styles.coin} />{fmt(potential)}</button>
  else if (bettingOpen && mine) cta = <button type="button" className={`${styles.go} ${styles.dim}`} disabled>Bet Placed</button>
  else if (bettingOpen) cta = <button type="button" className={styles.go} disabled={busy || closing || Number(bet) < MIN_BET} onClick={place}>Place Bet</button>
  else if (queued) cta = <button type="button" className={`${styles.go} ${styles.dim}`} onClick={() => setQueued(false)}>Bet Placed</button>
  else cta = <button type="button" className={styles.go} disabled={Number(bet) < MIN_BET} onClick={() => setQueued(true)}>Bet (Next Round)</button>

  const rowsG = data?.feed || []
  const personalRows = personal.map((b) => {
    const live_ = round && b.seq >= round.seq && b.cashedAt == null
    return { seq: b.seq, bet: b.bet, at: b.at, res: b.cashedAt != null ? b.payout - b.bet : live_ ? null : -b.bet, x: b.cashedAt }
  })
  const hist = (data?.history || []).slice(0, 24)
  const stepCash = (d) => setCashAt(String(Math.max(1.01, Math.round(((Number(cashAt) || 2) + d) * 100) / 100).toFixed(2)))

  const playersView = (
    <div className={styles.players}>
      <div className={styles.pHead}>
        <span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.500 2.700-6 6-6s6 2.500 6 6M16 5.500a3 3 0 010 5M18 14c2 .7 3 2.600 3 5" /></svg>{players.length}</span>
        <span><i className={styles.coin} />{fmt(total)}</span>
      </div>
      <div className={styles.pList}>
        {players.map((b) => (
          <div key={b.u} className={`${styles.pRow} ${b.u === me ? styles.pMe : ''}`}>
            <span className={styles.pName}><Av name={b.u} map={avs} />{b.u}</span>
            <span className={styles.pX}>{b.cashedAt != null ? `${b.cashedAt.toFixed(2)}x` : '-'}</span>
            <span className={`${styles.pAmt} ${b.cashedAt != null ? styles.pWin : ''}`}><i className={styles.coin} />{fmt(b.cashedAt != null ? b.payout : b.bet)}</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <Page game="crash" title="Crash" sub="">
      <div className={shared.layout}>
        <aside className={`${shared.panel} ${styles.panel}`}>
          <div className={styles.tabs} role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'manual'} disabled={autoRun} className={tab === 'manual' ? styles.on : ''} onClick={() => setTab('manual')}>Manual</button>
            <button type="button" role="tab" aria-selected={tab === 'auto'} disabled={autoRun} className={tab === 'auto' ? styles.on : ''} onClick={() => setTab('auto')}>Auto</button>
          </div>
          {!(tab === 'auto' && showSettings === false) && (
            <>
              <div className={styles.fld}>
                <span className={styles.lab}>Bet Amount<MaxBet /></span>
                <div className={`${styles.money} ${locked ? styles.off : ''}`}>
                  <i className={styles.coin} />
                  <input type="number" inputMode="numeric" min={MIN_BET} value={bet} disabled={locked}
                    onChange={(e) => setBet(e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value))))}
                    onBlur={() => setBet(Math.max(MIN_BET, Math.min(MAX_BET, Math.floor(Number(bet)) || MIN_BET)))} />
                  <button type="button" disabled={locked} onClick={() => setBet(Math.max(MIN_BET, Math.floor((Number(bet) || MIN_BET) / 2)))}>1/2</button>
                  <button type="button" disabled={locked} onClick={() => setBet(Math.min(MAX_BET, (Number(bet) || MIN_BET) * 2))}>2x</button>
                </div>
              </div>
              <div className={styles.fld}>
                <span className={styles.lab}>Cashout At</span>
                <div className={`${styles.money} ${!!mine || autoRun ? styles.off : ''}`}>
                  <input type="number" step="0.1" min="1.01" value={cashAt} disabled={!!mine || autoRun} onChange={(e) => setCashAt(e.target.value)}
                    onBlur={() => setCashAt(Number(cashAt) >= 1.01 ? Number(cashAt).toFixed(2) : '')} placeholder="Off" />
                  <button type="button" className={styles.sq} disabled={!!mine || autoRun} aria-label="Lower" onClick={() => stepCash(-0.1)}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></button>
                  <button type="button" className={styles.sq} disabled={!!mine || autoRun} aria-label="Raise" onClick={() => stepCash(0.1)}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg></button>
                </div>
              </div>
            </>
          )}
          {tab === 'manual' && (
            <>
              <div className={styles.fld}><span className={styles.lab}>Profit On Win</span><div className={styles.ro}><i className={styles.coin} />{fmt(profitOnWin)}</div></div>
              {cta}
              {(err || g.err) && <p className={styles.err}>{err || g.err}</p>}
              {playersView}
            </>
          )}
          {tab === 'auto' && (
            <>
              {showSettings && (
                <>
                  <div className={styles.fld}>
                    <span className={styles.lab}>Number of Bets</span>
                    <div className={`${styles.money} ${autoRun ? styles.off : ''}`}>
                      <input type="number" inputMode="numeric" min="0" value={nBets} disabled={autoRun} onChange={(e) => setNBets(e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value))))} />
                      <span className={styles.inf} aria-hidden="true">&infin;</span>
                    </div>
                  </div>
                </>
              )}
              <button type="button" className={styles.ghost} onClick={() => setShowSettings((v) => !v)}>{showSettings ? 'Show Players' : 'Show Settings'}</button>
              {showSettings ? (
                <>
                  <button type="button" className={styles.advRow} onClick={() => setAdv((v) => !v)} aria-pressed={adv}><span>Advanced Settings</span><i className={adv ? styles.swOn : ''} /></button>
                  {adv && (
                    <>
                      <div className={styles.fld}><span className={styles.lab}>Stop on Profit</span><div className={styles.money}><i className={styles.coin} /><input type="number" min="0" value={stopWin} disabled={autoRun} onChange={(e) => setStopWin(e.target.value)} placeholder="0" /></div></div>
                      <div className={styles.fld}><span className={styles.lab}>Stop on Loss</span><div className={styles.money}><i className={styles.coin} /><input type="number" min="0" value={stopLoss} disabled={autoRun} onChange={(e) => setStopLoss(e.target.value)} placeholder="0" /></div></div>
                    </>
                  )}
                  <div className={styles.grow} />
                </>
              ) : playersView}
              <div className={styles.pow}><span>Profit On Win</span><i className={styles.coin} /><b>{fmt(profitOnWin)}</b></div>
              {autoRun
                ? <button type="button" className={styles.go} onClick={() => setAutoRun(false)}>Stop Autobet</button>
                : <button type="button" className={styles.go} disabled={!g.user || Number(bet) < MIN_BET} onClick={() => { startPts.current = g.points; autoDone.current = 0; setAutoRun(true) }}>{g.user ? 'Start Autobet' : 'Log in to play'}</button>}
              {(err || g.err) && <p className={styles.err}>{err || g.err}</p>}
            </>
          )}
        </aside>

        <section className={`${styles.stage} ${shaking ? shared.shake : ''}`}>
          <div className={styles.hist}>
            {hist.map((v, i) => <span key={i} className={`${styles.pill} ${i === 0 ? styles.pillNew : ''}`}>{v.toFixed(2)}x</span>)}
          </div>
          <Graph rate={rate} ms={Math.max(0, crashedView ? Math.log(Math.max(1, shown)) / rate : phase === 'flying' ? t : 0)} mult={shown} crashed={crashedView} idle={phase === 'betting' || phase === 'load'} />
          {phase === 'betting' || phase === 'load' ? (
            <div className={styles.center}>
              <p className={styles.starts}>Round starts in <b>{phase === 'load' ? '...' : `${(leftMs / 1000).toFixed(2)}s`}</b></p>
              <span className={styles.sub}>Place your bets</span>
            </div>
          ) : crashedView ? (
            <div className={styles.center}>
              <b className={`${styles.mult} ${styles.red}`}>{shown.toFixed(2)}x</b>
              <span className={styles.chip}>Crashed</span>
            </div>
          ) : (
            <div className={styles.center}>
              <b className={`${styles.mult} ${myCash != null ? styles.green : ''}`}>{shown.toFixed(2)}x</b>
              {myCash != null ? <span className={styles.sub}>Cashed Out at <em>{myCash.toFixed(2)}x</em></span> : <span className={styles.amt}><i className={styles.coin} />{fmt(potential)}</span>}
            </div>
          )}
          {cashed && round && (cashed.seq === round.seq || (over && cashed.seq === over.seq && phase === 'over')) && (
            <div className={styles.pop} role="status" key={cashed.seq}>
              <b>{cashed.at.toFixed(2)}&times;</b>
              <hr />
              <span><i className={styles.coin} />{fmt(cashed.payout)}</span>
            </div>
          )}
          <Confetti fire={g.fire} colors={['#22ff7a', '#6ee7b7', '#22d3ee', '#f5c542', '#fff']} />
        </section>
          <div className={`${shared.lvCard} ${shared.lvDock}`}>
            <div className={shared.lvTabs} role="tablist">
              <button type="button" role="tab" aria-selected={feedTab === 'global'} className={feedTab === 'global' ? shared.on : ''} onClick={() => setFeedTab('global')}>Global</button>
              <button type="button" role="tab" aria-selected={feedTab === 'personal'} className={feedTab === 'personal' ? shared.on : ''} onClick={() => { setFeedTab('personal'); if (g.user) loadMine() }}>Personal</button>
            </div>
            <div className={`${shared.lvRow} ${shared.lvTh}`}><span>Player</span><span>Bet</span><span>Result</span></div>
            <div className={shared.lvList}>
              {feedTab === 'global' ? (
                rowsG.length ? rowsG.map((b, i) => {
                  const res = b.cashedAt != null ? b.payout - b.bet : -b.bet
                  return (
                    <div key={`${b.seq}-${b.u}-${i}`} className={shared.lvRow}>
                      <span className={shared.lvName}><Av name={b.u} map={avs} /><em>{b.u}<small>{ago(b.at, now)}</small></em></span>
                      <span className={shared.lvBet}>{fmt(b.bet)}</span>
                      <span className={res >= 0 ? shared.pos : shared.neg}>{sign(res)}</span>
                    </div>
                  )
                }) : <p className={shared.lvEmpty}>Finished bets appear here</p>
              ) : !g.user ? <p className={shared.lvEmpty}>Log in to see your bets</p>
                : personalRows.length ? personalRows.map((b, i) => (
                  <div key={`${b.seq}-${i}`} className={shared.lvRow}>
                    <span className={shared.lvName}><em>Round {b.seq}<small>{ago(b.at, now)}</small></em></span>
                    <span className={shared.lvBet}>{fmt(b.bet)}</span>
                    <span className={b.res == null ? shared.lvDim : b.res >= 0 ? shared.pos : shared.neg}>{b.res == null ? 'playing' : `${sign(b.res)}${b.x ? ` (${b.x.toFixed(2)}x)` : ''}`}</span>
                  </div>
                )) : <p className={shared.lvEmpty}>You have not played yet</p>}
            </div>
          </div>
      </div>
    </Page>
  )
}
