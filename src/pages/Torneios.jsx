import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabaseDash } from '../lib/supabase'
import styles from './Torneios.module.css'

// ── Hook: window width ───────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(window.innerWidth)
  useEffect(() => {
    const handler = () => setW(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return w
}

// ── Helpers ─────────────────────────────────────────────────
function buildEmpty(size) {
  const rounds = []
  let n = size / 2
  while (n >= 1) {
    rounds.push(Array.from({ length: n }, () => ({ a: null, b: null, winner: null })))
    n = Math.floor(n / 2)
  }
  return rounds
}
function hydrate(saved, size) {
  const empty = buildEmpty(size)
  if (!saved || saved.length !== empty.length) return empty
  return empty.map((round, ri) =>
    round.map((match, mi) => ({ ...match, ...(saved[ri]?.[mi] || {}) }))
  )
}
function roundLabel(ri, total) {
  if (ri === total - 1) return 'Final'
  if (ri === total - 2) return 'Semi-Final'
  if (ri === total - 3) return 'Quarter-Finals'
  if (ri === total - 4) return 'Round of 16'
  return `Round ${ri + 1}`
}
function getScore(comp) {
  const bet  = parseFloat(comp?.bet) || 0
  const paid = (comp?.payments || []).reduce((s, p) => s + (parseFloat(p) || 0), 0)
  return bet > 0 && paid > 0 ? paid / bet : null
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function calcStats(bracket, balanceStart) {
  const seen = new Set(), comps = []
  bracket.forEach(r => r.forEach(m => {
    ;[m.a, m.b].forEach(c => {
      if (!c) return
      const k = `${c.slot?.id}__${c.player}`
      if (seen.has(k)) return
      seen.add(k); comps.push(c)
    })
  }))
  const totalBet = comps.reduce((s, c) => s + (parseFloat(c.bet) || 0), 0)
  const totalWon = comps.reduce((s, c) => s + (c.payments || []).reduce((a, p) => a + (parseFloat(p) || 0), 0), 0)
  const pnl = totalWon - totalBet
  const withScore = comps.map(c => ({ name: c.slot?.name || c.player || '?', slot: c.slot || null, player: c.player || null, score: getScore(c) })).filter(x => x.score !== null)
  const best  = withScore.length ? withScore.reduce((a, b) => b.score > a.score ? b : a) : null
  const worst = withScore.length ? withScore.reduce((a, b) => b.score < a.score ? b : a) : null
  return { totalBet, totalWon, pnl, best, worst, balanceStart: parseFloat(balanceStart) || 0 }
}

// ── Bracket layout constants ─────────────────────────────────
const ROW_H  = 40
const MATCH_H = ROW_H * 2
const GAP     = 20
const CONN_W  = 36
const LBL_H   = 32

// CARD_W is now dynamic — passed as prop from MirrorBracket
function colH(n)   { return n * MATCH_H + (n - 1) * GAP }
function cardCY(i) { return i * (MATCH_H + GAP) + MATCH_H / 2 }

// ── SlotImg ─────────────────────────────────────────────────
function SlotImg({ slot, size = 32, radius = 5 }) {
  const [err, setErr] = useState(false)
  if (!slot) return <div style={{ width: size, height: size, borderRadius: radius, flexShrink: 0, background: 'rgba(255,255,255,.05)' }} />
  const initials = (slot.name || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
  const st = { width: size, height: size, borderRadius: radius, flexShrink: 0 }
  if (slot.image_url && !err)
    return <img src={slot.image_url} alt={slot.name} style={{ ...st, objectFit: 'cover', display: 'block' }} onError={() => setErr(true)} />
  return (
    <div style={{ ...st, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,rgba(59,130,246,.2),rgba(8,10,18,.9))', fontSize: size * .3, fontWeight: 800, color: 'rgba(255,255,255,.4)' }}>
      {initials}
    </div>
  )
}

// ── UserIcon ─────────────────────────────────────────────────
function UserIcon({ size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: .7 }}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

// ── Connectors ───────────────────────────────────────────────
const S = 'rgba(167,139,250,.38)'
function ConnLR({ fromN, toN, outerH }) {
  const pF = (outerH - colH(fromN)) / 2, pT = (outerH - colH(toN)) / 2
  const els = []
  for (let i = 0; i < toN; i++) {
    const yA = pF + cardCY(i*2), yB = pF + cardCY(i*2+1), yM = (yA+yB)/2, yO = pT + cardCY(i)
    els.push(<g key={i}>
      <line x1={0} y1={yA} x2={CONN_W/2} y2={yA} stroke={S} strokeWidth="1" strokeLinecap="round"/>
      <line x1={0} y1={yB} x2={CONN_W/2} y2={yB} stroke={S} strokeWidth="1" strokeLinecap="round"/>
      <line x1={CONN_W/2} y1={yA} x2={CONN_W/2} y2={yB} stroke={S} strokeWidth="1" strokeLinecap="round"/>
      <line x1={CONN_W/2} y1={yM} x2={CONN_W} y2={yO} stroke={S} strokeWidth="1" strokeLinecap="round"/>
    </g>)
  }
  return <div style={{ flexShrink:0, marginTop:LBL_H }}><svg width={CONN_W} height={outerH} style={{ display:'block', overflow:'visible' }}>{els}</svg></div>
}
function ConnRL({ fromN, toN, outerH }) {
  const pF = (outerH - colH(fromN)) / 2, pT = (outerH - colH(toN)) / 2
  const els = []
  for (let i = 0; i < fromN; i++) {
    const yIn = pF + cardCY(i), yA = pT + cardCY(i*2), yB = pT + cardCY(i*2+1), yM = (yA+yB)/2
    els.push(<g key={i}>
      <line x1={0} y1={yIn} x2={CONN_W/2} y2={yM} stroke={S} strokeWidth="1" strokeLinecap="round"/>
      <line x1={CONN_W/2} y1={yA} x2={CONN_W/2} y2={yB} stroke={S} strokeWidth="1" strokeLinecap="round"/>
      <line x1={CONN_W/2} y1={yA} x2={CONN_W} y2={yA} stroke={S} strokeWidth="1" strokeLinecap="round"/>
      <line x1={CONN_W/2} y1={yB} x2={CONN_W} y2={yB} stroke={S} strokeWidth="1" strokeLinecap="round"/>
    </g>)
  }
  return <div style={{ flexShrink:0, marginTop:LBL_H }}><svg width={CONN_W} height={outerH} style={{ display:'block', overflow:'visible' }}>{els}</svg></div>
}
function ConnH({ outerH }) {
  return <div style={{ flexShrink:0, marginTop:LBL_H }}><svg width={CONN_W} height={outerH} style={{ display:'block', overflow:'visible' }}><line x1={0} y1={outerH/2} x2={CONN_W} y2={outerH/2} stroke={S} strokeWidth="1" strokeLinecap="round"/></svg></div>
}

// ── RCol ─────────────────────────────────────────────────────
function RCol({ matches, ri, totalRounds, outerH, seedOffset = 0, label, onSelect, selected, cardW }) {
  const topPad = Math.round((outerH - colH(matches.length)) / 2)
  return (
    <div style={{ flexShrink:0, display:'flex', flexDirection:'column' }}>
      <div style={{ height:LBL_H, display:'flex', alignItems:'center', justifyContent:'center', width:cardW }}>
        <span className={`${styles.colLabel} ${ri === totalRounds - 1 ? styles.colFinal : ''}`}>{ri === totalRounds - 1 && <svg width="12" height="10" viewBox="0 0 26 22" fill="currentColor"><path d="M3 2L13 8L23 2L20 17H6L3 2Z"/><rect x="6" y="18" width="14" height="3" rx="1.5"/></svg>}{label ?? roundLabel(ri, totalRounds)}</span>
      </div>
      <div style={{ height:outerH, position:'relative', width:cardW }}>
        {matches.map((match, idx) => {
          const { a, b, winner } = match
          const mi = idx + seedOffset
          const top = topPad + idx * (MATCH_H + GAP)
          const sA = ri === 0 ? String.fromCharCode(65 + mi * 2) : null
          const sB = ri === 0 ? String.fromCharCode(65 + mi * 2 + 1) : null
          const scA = getScore(a), scB = getScore(b)
          const hasData = a?.slot || b?.slot
          const isSel = selected?.match === match
          return (
            <div key={idx} style={{ position:'absolute', top, left:0, width:cardW, height:MATCH_H }}
              className={`${styles.matchCard} ${ri === totalRounds - 1 ? styles.matchFinal : ''} ${hasData ? styles.matchCardClickable : ''} ${isSel ? styles.matchCardSelected : ''}`}
              onClick={() => hasData && onSelect?.({ match, label: label ?? roundLabel(ri, totalRounds) })}>
              {/* Row A */}
              <div className={`${styles.compRow} ${winner==='a' ? styles.compRowWin : ''} ${winner==='b' && a ? styles.compRowLose : ''}`}>
                {winner==='a' && <div className={styles.winBar}/>}
                {sA && <div className={styles.seed}>{sA}</div>}
                <SlotImg slot={a?.slot} size={ROW_H} radius={0} />
                <div className={styles.compInfo}>
                  {a?.slot ? <><div className={styles.compName}>{a.slot.name}</div>{a.player && <div className={styles.compPlayer}><UserIcon size={9} />{a.player}</div>}</>
                    : <span className={styles.compTbd}>TBD</span>}
                </div>
                {scA !== null && <div className={`${styles.compScore} ${winner==='a' ? styles.compScoreWin : ''}`}>{scA.toFixed(2)}</div>}
              </div>
              <div className={styles.rowDivider}/>
              {/* Row B */}
              <div className={`${styles.compRow} ${winner==='b' ? styles.compRowWin : ''} ${winner==='a' && b ? styles.compRowLose : ''}`}>
                {winner==='b' && <div className={styles.winBar}/>}
                {sB && <div className={styles.seed}>{sB}</div>}
                <SlotImg slot={b?.slot} size={ROW_H} radius={0} />
                <div className={styles.compInfo}>
                  {b?.slot ? <><div className={styles.compName}>{b.slot.name}</div>{b.player && <div className={styles.compPlayer}><UserIcon size={9} />{b.player}</div>}</>
                    : <span className={styles.compTbd}>TBD</span>}
                </div>
                {scB !== null && <div className={`${styles.compScore} ${winner==='b' ? styles.compScoreWin : ''}`}>{scB.toFixed(2)}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── MirrorBracket ────────────────────────────────────────────
function MirrorBracket({ bracket, onSelect, selected }) {
  const winW = useWindowWidth()
  // Escalar card em mobile: 200px no desktop, 150px em tablet, 130px em mobile pequeno
  const cardW = winW < 480 ? 130 : winW < 768 ? 155 : 200

  const totalRounds = bracket.length
  const finalRi     = totalRounds - 1
  const leftHalf    = (ri) => bracket[ri].slice(0, Math.ceil(bracket[ri].length / 2))
  const rightHalf   = (ri) => bracket[ri].slice(Math.ceil(bracket[ri].length / 2))
  const leftCols    = Array.from({ length: finalRi }, (_, i) => ({ ri: i, matches: leftHalf(i) }))
  const rightCols   = Array.from({ length: finalRi }, (_, i) => ({
    ri: finalRi - 1 - i,
    matches: rightHalf(finalRi - 1 - i),
    seedOffset: Math.ceil(bracket[finalRi - 1 - i].length / 2),
  }))
  const outerN   = leftCols[0]?.matches.length || 1
  const outerH   = colH(outerN)

  return (
    <div style={{ position:'relative', display:'inline-block', padding:'0 16px 16px', minWidth:'max-content' }}>
      {/* Main bracket row */}
      <div style={{ display:'inline-flex', alignItems:'flex-start', gap:0 }}>
        {leftCols.map(({ ri, matches }, ci) => (
          <div key={`L${ri}`} style={{ display:'contents' }}>
            <RCol matches={matches} ri={ri} totalRounds={totalRounds} outerH={outerH} seedOffset={0} label={roundLabel(ri, totalRounds)} onSelect={onSelect} selected={selected} cardW={cardW} />
            {ci < leftCols.length - 1
              ? <ConnLR fromN={matches.length} toN={leftCols[ci+1].matches.length} outerH={outerH} />
              : <ConnH outerH={outerH} />}
          </div>
        ))}

        {/* Final column */}
        <RCol matches={[bracket[finalRi][0]]} ri={finalRi} totalRounds={totalRounds} outerH={outerH} label="Final" onSelect={onSelect} selected={selected} cardW={cardW} />

        {rightCols.map(({ ri, matches, seedOffset }, ci) => (
          <div key={`R${ri}`} style={{ display:'contents' }}>
            {ci === 0 ? <ConnH outerH={outerH} /> : <ConnRL fromN={rightCols[ci-1].matches.length} toN={matches.length} outerH={outerH} />}
            <RCol matches={matches} ri={ri} totalRounds={totalRounds} outerH={outerH} seedOffset={seedOffset} label={roundLabel(ri, totalRounds)} onSelect={onSelect} selected={selected} cardW={cardW} />
          </div>
        ))}
      </div>

    </div>
  )
}

// ── BottomPanel (fixed below bracket on match click) ─────────
function BottomPanel({ selected, onClose }) {
  if (!selected) return null
  const { match, label } = selected
  const { a, b, winner } = match

  const totalBet = (parseFloat(a?.bet) || 0) + (parseFloat(b?.bet) || 0)
  const totalWon =
    (a?.payments || []).reduce((s, p) => s + (parseFloat(p) || 0), 0) +
    (b?.payments || []).reduce((s, p) => s + (parseFloat(p) || 0), 0)
  const pnl = totalWon - totalBet
  const pnlPos = pnl >= 0

  const Fighter = ({ comp, side }) => {
    const isWinner = winner === side
    const isLoser  = winner && winner !== side
    const payments = (comp?.payments || []).filter(p => parseFloat(p) > 0)
    const bet      = parseFloat(comp?.bet) || 0
    const score    = getScore(comp)

    if (!comp?.slot && !comp?.player) return (
      <div className={styles.bpEmpty}>TBD</div>
    )

    return (
      <div className={`${styles.bpFighter} ${isWinner ? styles.bpFighterWin : ''} ${isLoser ? styles.bpFighterLose : ''}`}>
        {isWinner && <div className={styles.bpWinStripe} />}
        <div className={styles.bpSlotArt}>
          <SlotImg slot={comp.slot} size={72} radius={0} />
        </div>
        <div className={styles.bpFb}>
          <div className={styles.bpFt}>
            <div className={styles.bpFnRow}>
              {isWinner && (
                <div className={styles.bpWchip}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  Winner
                </div>
              )}
              <div className={styles.bpFn}>{comp.slot?.name || '—'}</div>
            </div>
            {score !== null && (
              <div className={`${styles.bpFs} ${isWinner ? styles.bpFsWin : ''}`}>{score.toFixed(2)}x</div>
            )}
          </div>
          {comp.player && (
            <div className={styles.bpFp}><UserIcon size={9} />{comp.player}</div>
          )}
          <div className={styles.bpFstats}>
            {bet > 0 && (
              <div className={styles.bpFsc}>
                <span className={styles.bpFsl}>Bet</span>
                <span className={`${styles.bpFsv} ${styles.bpAmber}`}>{bet.toFixed(2)}€</span>
              </div>
            )}
            {payments.map((p, i) => (
              <div key={i} className={styles.bpFsc}>
                <span className={styles.bpFsl}>{payments.length > 1 ? `Buy ${i+1}` : 'Result'}</span>
                <span className={`${styles.bpFsv} ${isWinner ? styles.bpGreen : styles.bpRed}`}>{parseFloat(p).toFixed(2)}€</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.bottomPanel}>
      <div className={styles.bpHeader}>
        <div className={styles.bpHeaderLeft}>
          <span className={styles.bpRoundBadge}>{label}</span>
          <span className={styles.bpTitle}>Match details</span>
        </div>
        <button className={styles.bpClose} onClick={onClose} aria-label="Close"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      </div>

      <div className={styles.bpBody}>
        <Fighter comp={a} side="a" />
        <div className={styles.bpMid}><div className={styles.bpVs}>VS</div></div>
        <Fighter comp={b} side="b" />
      </div>


    </div>
  )
}

// ── HistoryList ──────────────────────────────────────────────
function HistoryList({ list, onOpen, activeTournamentId }) {
  return (
    <div className={styles.histGrid}>
      {list.map(t => {
        const b      = hydrate(t.bracket, t.size)
        const fin    = b[b.length-1]?.[0]
        const champ  = fin?.winner ? fin[fin.winner] : null
        const st     = calcStats(b, t.balance_start)
        const pnlPos = st.pnl >= 0
        const isAct  = t.id === activeTournamentId
        return (
          <div key={t.id} className={`${styles.histCard} ${isAct ? styles.histCardAct : ''}`} onClick={() => onOpen(t)}>
            {/* Head — igual ao BH: id + date + pill */}
            <div className={styles.histCardHead}>
              <div style={{ flex:1, minWidth:0 }}>
                <div className={styles.histTitle}>{t.title}</div>
                <div className={styles.histMeta}>{fmtDate(t.created_at)}</div>
              </div>
              <span className={`${styles.histPill} ${t.status==='active' ? styles.histPillAct : styles.histPillDone}`}>
                {t.status==='active'
                  ? <><span className={styles.actDot}/> Active</>
                  : 'Completed'}
              </span>
            </div>

            {/* Stats 3-col grid — igual ao BH */}
            <div className={styles.histStats}>
              {[
                { lbl:'Total Bet', val: st.totalBet > 0 ? `${st.totalBet.toFixed(2)}€` : '—', cls: st.totalBet > 0 ? styles.csAmber : '' },
                { lbl:'Total Won',    val: st.totalWon > 0 ? `${st.totalWon.toFixed(2)}€` : '—', cls: st.totalWon > 0 ? styles.csBlue : '' },
                { lbl:'P&L',      val: st.totalBet > 0 ? `${pnlPos?'+':''}${st.pnl.toFixed(2)}€` : '—', cls: st.totalBet > 0 ? (pnlPos ? styles.csPos : styles.csNeg) : '' },
              ].map(({ lbl, val, cls }) => (
                <div key={lbl} className={styles.histStat}>
                  <span className={styles.histStatLbl}>{lbl}</span>
                  <span className={`${styles.histStatVal} ${cls}`}>{val}</span>
                </div>
              ))}
            </div>

            {/* Best slot row — igual ao BH cardBest */}
            {champ?.slot ? (
              <div className={styles.histBest}>
                <SlotImg slot={champ.slot} size={28} radius={5} />
                <span className={styles.histBestName}>{champ.slot.name}{champ.player ? <><UserIcon size={10} />{champ.player}</> : ''}</span>
                {getScore(champ) !== null && <span className={styles.histBestScore}>{getScore(champ).toFixed(2)}</span>}
              </div>
            ) : (
              <div className={styles.histBestEmpty}>—</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────
export default function Torneios() {
  const location = useLocation()
  const [tournaments, setTournaments] = useState([])
  const [active,      setActive]      = useState(null)
  const [bracket,     setBracket]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState('bracket')
  const [selected,    setSelected]    = useState(null)

  useEffect(() => {
    supabaseDash.from('tournaments').select('*').order('created_at', { ascending: false })
      .then(({ data }) => {
        const all = data || []
        setTournaments(all)
        const targetId = location.state?.tournamentId
        const target = targetId ? all.find(t => t.id === targetId) : null
        const act = target || all.find(t => t.status === 'active') || all[0] || null
        if (act) { setActive(act); setBracket(hydrate(act.bracket, act.size)) }
        setLoading(false)
      })
  }, [])

  const handleOpen = (t) => {
    setActive(t); setBracket(hydrate(t.bracket, t.size)); setTab('bracket')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <div className={styles.loading}><div className={styles.spinner}/> Loading...</div>
  if (!active) return (
    <div className={styles.emptyWrap}>
      <svg width="48" height="42" viewBox="0 0 26 22" fill="none"><path d="M3 2L13 8L23 2L20 17H6L3 2Z" fill="rgba(245,158,11,.5)" stroke="rgba(245,158,11,.7)" strokeWidth="1.2" strokeLinejoin="round"/><rect x="6" y="18" width="14" height="3" rx="1.5" fill="rgba(245,158,11,.3)"/></svg>
      <h2 className={styles.emptyTitle}>No tournaments yet</h2>
      <p className={styles.emptySub}>Coming soon…</p>
    </div>
  )

  const activeIdx  = tournaments.findIndex(t => t.id === active?.id)
  const prevT      = tournaments[activeIdx + 1] || null
  const nextT      = tournaments[activeIdx - 1] || null

  const stats   = calcStats(bracket, active.balance_start)
  const pnlPos  = stats.pnl >= 0

  const fin      = bracket[bracket.length - 1]?.[0]
  const champion = fin?.winner ? fin[fin.winner] : null
  const champScore = champion ? getScore(champion) : null
  const isActive = active.status === 'active' && !champion
  const totalMatches = bracket.reduce((n, r) => n + r.length, 0)
  const decided = bracket.reduce((n, r) => n + r.filter(m => m.winner).length, 0)
  const bal = parseFloat(active.balance_start) || 0

  const tiles = [
    { lbl: 'Profit', val: stats.totalBet > 0 ? `${pnlPos ? '+' : ''}${stats.pnl.toFixed(2)}€` : '—', cls: stats.totalBet > 0 ? (pnlPos ? styles.tPos : styles.tNeg) : '', big: true },
    ...(bal ? [{ lbl: 'Start', val: `${bal.toFixed(2)}€` }] : []),
    { lbl: 'Bet', val: stats.totalBet > 0 ? `${stats.totalBet.toFixed(2)}€` : '—', cls: styles.tAmber },
    { lbl: 'Won', val: stats.totalWon > 0 ? `${stats.totalWon.toFixed(2)}€` : '—', cls: styles.tViolet },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.switcher}>
            <button className={styles.swBtn} onClick={() => prevT && handleOpen(prevT)} disabled={!prevT} title={prevT?.title} aria-label="Previous tournament">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button className={styles.swBtn} onClick={() => nextT && handleOpen(nextT)} disabled={!nextT} title={nextT?.title} aria-label="Next tournament">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
          <h1 className={styles.title}>{active.title}</h1>
          <div className={styles.heroMeta}>
            {isActive
              ? <span className={styles.pillAct}><span className={styles.actDot}/>Live</span>
              : <span className={styles.pillDone}>Finished</span>}
            <span>{fmtDate(active.created_at)}</span>
          </div>
          <div className={styles.prog}>
            <div className={styles.progBar}><i style={{ width: (totalMatches ? (decided / totalMatches) * 100 : 0) + '%' }} /></div>
            <b className={styles.progNum}>{decided}<small>/{totalMatches}</small></b>
          </div>
        </div>

        <div className={`${styles.spot} ${champion ? styles.spotWon : ''}`}>
          {champion?.slot ? (
            <>
              <div className={styles.spotArt}><SlotImg slot={champion.slot} size={96} radius={14} /></div>
              <div className={styles.spotBody}>
                <span className={styles.spotLbl} aria-label="Champion">
                  <svg width="18" height="15" viewBox="0 0 26 22" fill="currentColor"><path d="M3 2L13 8L23 2L20 17H6L3 2Z"/><rect x="6" y="18" width="14" height="3" rx="1.5"/></svg>
                </span>
                <b className={styles.spotName}>{champion.slot.name}</b>
                {champion.player && <span className={styles.spotPlayer}><UserIcon size={11} />{champion.player}</span>}
                {champScore !== null && <span className={styles.spotScore}>{champScore.toFixed(2)}<small>x</small></span>}
              </div>
            </>
          ) : (
            <div className={styles.spotBody}>
              <span className={styles.spotLbl} aria-label="Champion">
                <svg width="18" height="15" viewBox="0 0 26 22" fill="currentColor"><path d="M3 2L13 8L23 2L20 17H6L3 2Z"/><rect x="6" y="18" width="14" height="3" rx="1.5"/></svg>
              </span>
              <b className={styles.spotName}>TBD</b>
            </div>
          )}
        </div>
      </header>

      <div className={styles.board}>
        {tiles.map((t) => (
          <div key={t.lbl} className={`${styles.tile} ${t.big ? styles.tileBig : ''}`}>
            <span className={styles.tileLbl}>{t.lbl}</span>
            <b className={`${styles.tileVal} ${t.cls || ''}`}>{t.val}</b>
          </div>
        ))}
        {[['best', stats.best, styles.tPos], ['worst', stats.worst, styles.tNeg]].map(([lbl, x, cls]) => x && (
          <div key={lbl} className={`${styles.tile} ${styles.tileSlot}`}>
            <SlotImg slot={x.slot} size={40} radius={10} />
            <div className={styles.tileTxt}>
              <b className={styles.tileName}>
                {lbl === 'best'
                  ? <svg className={styles.tIcoPos} width="13" height="11" viewBox="0 0 26 22" fill="currentColor"><path d="M3 2L13 8L23 2L20 17H6L3 2Z"/><rect x="6" y="18" width="14" height="3" rx="1.5"/></svg>
                  : <svg className={styles.tIcoNeg} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>}
                {x.name}
              </b>
              {x.player && <span className={styles.tilePlayer}><UserIcon size={9} />{x.player}</span>}
            </div>
            <b className={`${styles.tileX} ${cls}`}>{x.score.toFixed(2)}x</b>
          </div>
        ))}
      </div>

      <div className={styles.tabs} role="tablist">
        <button role="tab" aria-selected={tab==='bracket'} className={`${styles.tab} ${tab==='bracket' ? styles.tabActive : ''}`} onClick={() => setTab('bracket')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 5h5v5H3zM3 14h5v5H3zM16 9.5h5v5h-5zM8 7.5h4v9M12 12h4"/></svg>
          Bracket
        </button>
        <button role="tab" aria-selected={tab==='history'} className={`${styles.tab} ${tab==='history' ? styles.tabActive : ''}`} onClick={() => setTab('history')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          History
        </button>
      </div>

      {tab === 'bracket' && (
        <div className={styles.bracketPanel}>
          <div className={styles.bracketScroll}>
            <MirrorBracket bracket={bracket} onSelect={setSelected} selected={selected} />
          </div>
          {selected && (
            <div className={styles.bottomPanelWrap}>
              <BottomPanel selected={selected} onClose={() => setSelected(null)} />
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <HistoryList list={tournaments} onOpen={handleOpen} activeTournamentId={active?.id} />
      )}
    </div>
  )
}
