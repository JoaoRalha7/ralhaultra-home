import { useState, useEffect, useMemo } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

// ─── Profile pic cache ────────────────────────────────────────────────────
const profileCache = {}
async function getProfilePic(username) {
  if (!username) return null
  if (profileCache[username]) return profileCache[username]
  try {
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), 4000)
    const res  = await fetch(`https://api.ivr.fi/v2/twitch/user?login=${username.toLowerCase()}`, { signal: c.signal })
    clearTimeout(t)
    const data = await res.json()
    const url  = data?.[0]?.logo || null
    if (url) profileCache[username] = url
    return url
  } catch { return null }
}

function hslFromName(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return `hsl(${h % 360}, 55%, 58%)`
}

function getBestMulti(comp) {
  const pays = (comp?.payments || []).map(p => parseFloat(p) || 0).filter(v => v > 0)
  const bet  = parseFloat(comp?.bet) || 0
  if (!pays.length || !bet) return null
  return Math.max(...pays) / bet
}
function fmtMulti(n) {
  if (n === null || n === undefined) return null
  return `${parseFloat(n.toFixed(2))}x`
}
function roundLabel(ri, total) {
  if (!total) return ''
  if (ri === total - 1) return 'Final'
  if (ri === total - 2) return 'Semi Finals'
  if (ri === total - 3) return 'Quarter Finals'
  if (ri === total - 4) return 'Round of 16'
  return `Round ${ri + 1}`
}

// ─── Layout constants ──────────────────────────────────────────────────────
const CARD_W  = 168  // card width
const ROW_H   = 34   // each competitor row
const CARD_H  = ROW_H * 2 + 1  // +1 for divider
const CARD_GAP = 14  // vertical gap between cards in same column
const CONN_W  = 40   // connector width
const H_CONN  = 24   // final↔semi horizontal connector width
const LBL_H   = 24   // round label height above cards
const CHAMP_H = 90   // champion card height
const CHAMP_GAP = 8  // gap between final card and champ card

// colHeight: total pixel height of a column with n cards
function colHeight(n) { return n * CARD_H + (n - 1) * CARD_GAP }

// cardCY: Y centre of card i in a column of n cards, centred within outerH
function cardCY(i, n, outerH) {
  const h      = colHeight(n)
  const offset = (outerH - h) / 2
  return offset + i * (CARD_H + CARD_GAP) + CARD_H / 2
}

// cardTop: top Y of card i
function cardTop(i, n, outerH) {
  return cardCY(i, n, outerH) - CARD_H / 2
}

// ─── CSS ──────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;900&display=swap');
html, body { background: transparent !important; margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
.root-wrap { width: 100vw; height: 100vh; display: flex; align-items: flex-start; justify-content: flex-start; }
.root { width: 900px; height: 480px; transform-origin: top left; transform: scale(var(--scale,1)); font-family: 'Rubik', sans-serif; -webkit-font-smoothing: antialiased; }
.card { background: #07090f; border: 1px solid rgba(255,255,255,.07); border-radius: 16px; overflow: hidden; height: 100%; display: flex; flex-direction: column; }

/* HEADER */
.hd { display: flex; align-items: center; gap: 12px; padding: 10px 20px; background: linear-gradient(90deg,#0d0b1a,#130b1a,#0d0b1a); border-bottom: 1px solid rgba(124,111,255,.15); flex-shrink: 0; }
.hd-title { font-size: 15px; font-weight: 900; color: #fff; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hd-badge { font-size: 10px; font-weight: 800; color: #a78bfa; letter-spacing: .07em; text-transform: uppercase; background: rgba(124,111,255,.12); border: 1px solid rgba(124,111,255,.25); border-radius: 20px; padding: 4px 14px; flex-shrink: 0; }
.live-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; animation: pulse 1.4s ease-in-out infinite; flex-shrink: 0; }
.wait-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.2); animation: blink 2s ease-in-out infinite; flex-shrink: 0; }

/* BRACKET */
.bracket-area { flex: 1; display: flex; align-items: center; justify-content: center; padding: 0 16px; overflow: hidden; }
.bracket-inner { display: flex; align-items: flex-start; gap: 0; }

/* MATCH CARD */
.mc { width: ${CARD_W}px; background: #0f1120; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; overflow: hidden; transition: border-color .3s, box-shadow .3s; }
.mc.live   { border-color: rgba(124,111,255,.55); box-shadow: 0 0 12px rgba(124,111,255,.1); }
.mc.done   { border-color: rgba(34,197,94,.22); }
.mc.final  { border-color: rgba(251,191,36,.28); }

/* COMP ROW */
.cr { display: flex; align-items: center; gap: 6px; padding: 0 8px; height: ${ROW_H}px; position: relative; overflow: hidden; }
.cr + .cr { border-top: 1px solid rgba(255,255,255,.06); }
.cr.win  { background: rgba(34,197,94,.07); }
.cr.loss { opacity: .32; }
.cr.fwin { background: rgba(251,191,36,.07); }
.win-bar  { position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: #22c55e; }
.fwin-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: #fbbf24; }

.slot-img { width: 22px; height: 22px; border-radius: 5px; object-fit: cover; flex-shrink: 0; background: linear-gradient(135deg,#1a1d3a,#12102a); }
.p-name   { font-size: 11px; font-weight: 700; color: #fff; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.p-name.tbd { color: rgba(255,255,255,.2); font-weight: 400; font-style: italic; }
.p-multi  { font-size: 10px; font-weight: 800; color: #a78bfa; flex-shrink: 0; white-space: nowrap; }
.p-multi.gold { color: #fbbf24; }
.p-multi.dim  { color: rgba(255,255,255,.18); }

/* CHAMPION CARD */
.champ-card { width: ${CARD_W}px; background: rgba(251,191,36,.05); border: 1px solid rgba(251,191,36,.22); border-radius: 10px; padding: 8px; display: flex; flex-direction: column; align-items: center; gap: 5px; text-align: center; height: ${CHAMP_H}px; justify-content: center; }
.champ-lbl  { font-size: 9px; font-weight: 800; color: #fbbf24; letter-spacing: .1em; text-transform: uppercase; }
.champ-slot { width: 36px; height: 36px; border-radius: 9px; object-fit: cover; border: 2px solid rgba(251,191,36,.4); background: linear-gradient(135deg,#1a1d3a,#12102a); }
.champ-prow { display: flex; align-items: center; gap: 5px; }
.champ-av   { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(251,191,36,.3); flex-shrink: 0; }
.champ-name { font-size: 12px; font-weight: 900; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; }
.champ-slot-name { font-size: 9px; color: rgba(255,255,255,.4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
.champ-pending   { font-size: 11px; color: rgba(255,255,255,.22); }

/* ROUND LABEL */
.rlbl { font-size: 9px; font-weight: 700; color: rgba(255,255,255,.28); letter-spacing: .1em; text-transform: uppercase; text-align: center; height: ${LBL_H}px; display: flex; align-items: center; justify-content: center; width: ${CARD_W}px; }

/* WAITING */
.waiting { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 8px; }
.waiting-title { font-size: 13px; font-weight: 700; color: rgba(255,255,255,.3); }
.waiting-sub   { font-size: 11px; color: rgba(255,255,255,.15); }

@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
@keyframes blink { 0%,100%{opacity:.15} 50%{opacity:.5} }
`

// ─── SlotImg ──────────────────────────────────────────────────────────────
function SlotImg({ url, size = 22, radius = 5, className = 'slot-img' }) {
  const [err, setErr] = useState(false)
  if (url && !err) return <img src={url} alt="" className={className} style={{ width: size, height: size, borderRadius: radius }} onError={() => setErr(true)} />
  return <div className={className} style={{ width: size, height: size, borderRadius: radius }} />
}

// ─── TwitchAv ─────────────────────────────────────────────────────────────
function TwitchAv({ username, src, size = 18, className = 'champ-av' }) {
  const color = hslFromName(username || '?')
  const [imgSrc, setImgSrc] = useState(src || profileCache[username] || null)
  useEffect(() => {
    if (!username) return
    if (src) { setImgSrc(src); return }
    if (profileCache[username]) { setImgSrc(profileCache[username]); return }
    let mounted = true
    getProfilePic(username).then(url => { if (mounted && url) setImgSrc(url) })
    return () => { mounted = false }
  }, [username, src])
  if (imgSrc) return <img src={imgSrc} alt={username} className={className} style={{ width: size, height: size }} />
  return <div className={className} style={{ width: size, height: size, background: `${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 900, color }}>{username?.[0]?.toUpperCase() || '?'}</div>
}

// ─── CompRow ──────────────────────────────────────────────────────────────
function CompRow({ comp, winner, side, isFinal }) {
  const isWinner = winner === side
  const isLoser  = winner && winner !== side && !!comp?.player
  const multi    = getBestMulti(comp)

  const rowClass = [
    'cr',
    isFinal && isWinner ? 'fwin' : isWinner ? 'win' : '',
    isLoser  ? 'loss' : '',
  ].filter(Boolean).join(' ')

  if (!comp?.player && !comp?.slot) {
    return <div className="cr"><span className="p-name tbd">TBD</span></div>
  }

  return (
    <div className={rowClass}>
      {isWinner && !isFinal && <div className="win-bar" />}
      {isWinner &&  isFinal && <div className="fwin-bar" />}
      <SlotImg url={comp?.slot?.image_url} size={22} radius={5} />
      <span className="p-name">{comp?.player || '—'}</span>
      {multi !== null
        ? <span className={`p-multi${isWinner ? ' gold' : ''}`}>{fmtMulti(multi)}</span>
        : <span className="p-multi dim">—</span>
      }
    </div>
  )
}

// ─── MatchCard ────────────────────────────────────────────────────────────
function MatchCard({ match, isLive, isFinal = false }) {
  const winner = match?.winner
  const cardClass = [
    'mc',
    isLive          ? 'live'  : '',
    winner && !isFinal ? 'done'  : '',
    isFinal         ? 'final' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cardClass}>
      <CompRow comp={match?.a} winner={winner} side="a" isFinal={isFinal} />
      <CompRow comp={match?.b} winner={winner} side="b" isFinal={isFinal} />
    </div>
  )
}

// ─── ChampionCard ─────────────────────────────────────────────────────────
function ChampionCard({ comp, pic }) {
  const [slotErr, setSlotErr] = useState(false)
  return (
    <div className="champ-card">
      <svg width="20" height="18" viewBox="0 0 22 20" fill="none">
        <path d="M2 2L11 7L20 2L17 15H5L2 2Z" fill={comp?.player ? 'rgba(251,191,36,.88)' : 'rgba(251,191,36,.35)'} stroke={comp?.player ? '#fbbf24' : 'rgba(251,191,36,.4)'} strokeWidth="1.2" strokeLinejoin="round"/>
        <rect x="5" y="16" width="12" height="3" rx="1.5" fill={comp?.player ? 'rgba(251,191,36,.55)' : 'rgba(251,191,36,.2)'}/>
      </svg>
      <div className="champ-lbl">Campeão</div>
      {comp?.player
        ? <>
            {comp?.slot?.image_url && !slotErr
              ? <img src={comp.slot.image_url} alt="" className="champ-slot" onError={() => setSlotErr(true)} />
              : <div className="champ-slot" />
            }
            <div className="champ-prow">
              <TwitchAv username={comp.player} src={pic} size={18} />
              <div className="champ-name">{comp.player}</div>
            </div>
            {comp?.slot?.name && <div className="champ-slot-name">{comp.slot.name}</div>}
          </>
        : <div className="champ-pending">A decidir…</div>
      }
    </div>
  )
}

// ─── SVG Connectors ───────────────────────────────────────────────────────
// Fan-in: multiple cards on left → one card on right
// All Y coords are relative to the svg element (which starts at y=LBL_H of the column area)
function FanInConn({ outerH, fromN, toN }) {
  const w   = CONN_W
  const mid = w / 2
  const S   = 'rgba(255,255,255,.2)'
  const SW  = 1.5
  const els = []

  for (let i = 0; i < toN; i++) {
    const yA  = cardCY(i * 2,     fromN, outerH)
    const yB  = cardCY(i * 2 + 1, fromN, outerH)
    const yMid = (yA + yB) / 2
    const yOut = cardCY(i, toN, outerH)
    els.push(
      <g key={i}>
        <line x1={0}   y1={yA}   x2={mid} y2={yA}   stroke={S} strokeWidth={SW} strokeLinecap="round"/>
        <line x1={0}   y1={yB}   x2={mid} y2={yB}   stroke={S} strokeWidth={SW} strokeLinecap="round"/>
        <line x1={mid} y1={yA}   x2={mid} y2={yB}   stroke={S} strokeWidth={SW} strokeLinecap="round"/>
        <line x1={mid} y1={yMid} x2={w}   y2={yOut} stroke={S} strokeWidth={SW} strokeLinecap="round"/>
      </g>
    )
  }
  return (
    <svg width={w} height={outerH} style={{ display: 'block', flexShrink: 0, marginTop: LBL_H, overflow: 'visible' }}>
      {els}
    </svg>
  )
}

// Fan-out: one card on left → multiple cards on right (mirror of FanIn)
function FanOutConn({ outerH, fromN, toN }) {
  const w   = CONN_W
  const mid = w / 2
  const S   = 'rgba(255,255,255,.2)'
  const SW  = 1.5
  const els = []

  for (let i = 0; i < fromN; i++) {
    const yIn  = cardCY(i, fromN, outerH)
    const yA   = cardCY(i * 2,     toN, outerH)
    const yB   = cardCY(i * 2 + 1, toN, outerH)
    const yMid = (yA + yB) / 2
    els.push(
      <g key={i}>
        <line x1={0}   y1={yIn}  x2={mid} y2={yMid} stroke={S} strokeWidth={SW} strokeLinecap="round"/>
        <line x1={mid} y1={yA}   x2={mid} y2={yB}   stroke={S} strokeWidth={SW} strokeLinecap="round"/>
        <line x1={mid} y1={yA}   x2={w}   y2={yA}   stroke={S} strokeWidth={SW} strokeLinecap="round"/>
        <line x1={mid} y1={yB}   x2={w}   y2={yB}   stroke={S} strokeWidth={SW} strokeLinecap="round"/>
      </g>
    )
  }
  return (
    <svg width={w} height={outerH} style={{ display: 'block', flexShrink: 0, marginTop: LBL_H, overflow: 'visible' }}>
      {els}
    </svg>
  )
}

// Simple horizontal line (SF → Final)
function HConn({ outerH }) {
  const y = outerH / 2
  return (
    <svg width={H_CONN} height={outerH} style={{ display: 'block', flexShrink: 0, marginTop: LBL_H, overflow: 'visible' }}>
      <line x1={0} y1={y} x2={H_CONN} y2={y} stroke="rgba(255,255,255,.2)" strokeWidth={1.5} strokeLinecap="round"/>
    </svg>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────
// Renders a vertical stack of match cards, all centred within outerH.
function Column({ label, matches, outerH, liveKey, ri, miOffset = 0, isFinal = false }) {
  const n = matches.length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, alignItems: 'center' }}>
      <div className="rlbl">{label}</div>
      {/* fixed-height container so connectors align */}
      <div style={{ height: outerH, position: 'relative', width: CARD_W }}>
        {matches.map((match, idx) => {
          const mi    = miOffset + idx
          const isLive = `${ri}-${mi}` === liveKey
          const top   = cardTop(idx, n, outerH)
          return (
            <div key={idx} style={{ position: 'absolute', top, left: 0, width: CARD_W }}>
              <MatchCard match={match} isLive={isLive} isFinal={isFinal} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────
export default function BracketOverlay() {
  const [tournament, setTournament] = useState(undefined)
  const [pics, setPics]             = useState({})

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1).single()
      setTournament(data || null)
      if (data?.bracket) {
        const usernames = new Set()
        data.bracket.forEach(r => r.forEach(m => {
          if (m.a?.player) usernames.add(m.a.player.toLowerCase())
          if (m.b?.player) usernames.add(m.b.player.toLowerCase())
        }))
        const toFetch = [...usernames].filter(u => !profileCache[u])
        if (toFetch.length) {
          const newPics = {}
          await Promise.allSettled(toFetch.map(async u => {
            const pic = await getProfilePic(u)
            if (pic) newPics[u] = pic
          }))
          if (Object.keys(newPics).length) setPics(prev => ({ ...prev, ...newPics }))
        }
      }
    }
    load()
    const ch = supabase.channel('bracket-v2')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  useEffect(() => {
    const update = () => {
      const scale = Math.min(window.innerWidth / 900, window.innerHeight / 480)
      document.documentElement.style.setProperty('--scale', scale)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const bracket = tournament?.bracket || []
  const title   = tournament?.title   || 'Tournament'
  const nRounds = bracket.length

  const liveKey = useMemo(() => {
    for (let ri = 0; ri < bracket.length; ri++) {
      for (let mi = 0; mi < bracket[ri].length; mi++) {
        const m = bracket[ri][mi]
        if (!m.winner && (m.a?.player || m.b?.player)) return `${ri}-${mi}`
      }
    }
    return null
  }, [bracket])

  const finalRi    = nRounds - 1
  const finalMatch = bracket[finalRi]?.[0] || {}
  const champSide  = finalMatch?.winner
  const champComp  = champSide ? finalMatch[champSide] : null
  const champPic   = champComp ? (pics[champComp.player?.toLowerCase()] || null) : null
  const currentRi  = liveKey ? parseInt(liveKey.split('-')[0]) : finalRi
  const headerBadge = nRounds > 0 ? roundLabel(currentRi, nRounds) : 'Bracket'

  if (tournament === undefined) return <><style>{CSS}</style><div className="root-wrap"><div className="root" /></div></>

  // ── Split bracket into left/right halves ──────────────────────────────
  // For an 8-player bracket (3 rounds):
  //   Round 0 (QF): 4 matches → left half [0,1], right half [2,3]
  //   Round 1 (SF): 2 matches → left half [0],   right half [1]
  //   Round 2 (Final): 1 match → centre
  //
  // Left columns: rounds 0..finalRi-1, first half of matches
  // Right columns: rounds finalRi-1..0, second half of matches (mirrored order)

  // outermost round is round 0
  const outerRound = bracket[0] || []
  const outerN     = Math.ceil(outerRound.length / 2)  // matches per side in round 0
  const outerH     = colHeight(outerN)  // pixel height of tallest column

  // left side: rounds 0, 1, ..., finalRi-1
  const leftCols = []
  for (let ri = 0; ri < finalRi; ri++) {
    const round   = bracket[ri] || []
    const half    = Math.ceil(round.length / 2)
    leftCols.push({ ri, matches: round.slice(0, half), miOffset: 0 })
  }

  // right side: rounds finalRi-1, finalRi-2, ..., 0 (innermost first, outermost last)
  const rightCols = []
  for (let i = 0; i < finalRi; i++) {
    const ri      = finalRi - 1 - i
    const round   = bracket[ri] || []
    const half    = Math.ceil(round.length / 2)
    rightCols.push({ ri, matches: round.slice(half), miOffset: half })
  }

  // ── Final column: match + champion stacked ───────────────────────────
  // centre the final match + champ card vertically within outerH
  const finalColH   = CARD_H + CHAMP_GAP + CHAMP_H
  const finalTopPad = (outerH - finalColH) / 2

  return (
    <>
      <style>{CSS}</style>
      <div className="root-wrap">
        <div className="root">
          <div className="card">

            {/* HEADER */}
            <div className="hd">
              {tournament ? <div className="live-dot" /> : <div className="wait-dot" />}
              <div className="hd-title">{title} — Full Bracket</div>
              <div className="hd-badge">{headerBadge}</div>
            </div>

            {!tournament ? (
              <div className="waiting">
                <div className="waiting-title">No active tournament</div>
                <div className="waiting-sub">Start a tournament in the dashboard</div>
              </div>
            ) : (
              <div className="bracket-area">
                <div className="bracket-inner" style={{ alignItems: 'flex-start' }}>

                  {/* ── LEFT COLUMNS ── */}
                  {leftCols.map((col, colIdx) => {
                    const nextN = colIdx < leftCols.length - 1
                      ? leftCols[colIdx + 1].matches.length
                      : 1 // connects to final (1 match)
                    const isLast = colIdx === leftCols.length - 1
                    return (
                      <div key={`L${col.ri}`} style={{ display: 'contents' }}>
                        <Column
                          label={roundLabel(col.ri, nRounds)}
                          matches={col.matches}
                          outerH={outerH}
                          liveKey={liveKey}
                          ri={col.ri}
                          miOffset={col.miOffset}
                        />
                        {isLast
                          ? <HConn outerH={outerH} />
                          : <FanInConn outerH={outerH} fromN={col.matches.length} toN={nextN} />
                        }
                      </div>
                    )
                  })}

                  {/* ── FINAL + CHAMPION ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, alignItems: 'center' }}>
                    <div className="rlbl">Final</div>
                    <div style={{ height: outerH, position: 'relative', width: CARD_W }}>
                      <div style={{ position: 'absolute', top: finalTopPad, left: 0, width: CARD_W }}>
                        <MatchCard match={finalMatch} isLive={liveKey === `${finalRi}-0`} isFinal />
                        <div style={{ height: CHAMP_GAP }} />
                        <ChampionCard comp={champComp} pic={champPic} />
                      </div>
                    </div>
                  </div>

                  {/* ── RIGHT COLUMNS ── */}
                  {rightCols.map((col, colIdx) => {
                    const prevN = colIdx > 0
                      ? rightCols[colIdx - 1].matches.length
                      : 1 // connects from final
                    const isFirst = colIdx === 0
                    return (
                      <div key={`R${col.ri}`} style={{ display: 'contents' }}>
                        {isFirst
                          ? <HConn outerH={outerH} />
                          : <FanOutConn outerH={outerH} fromN={prevN} toN={col.matches.length} />
                        }
                        <Column
                          label={roundLabel(col.ri, nRounds)}
                          matches={col.matches}
                          outerH={outerH}
                          liveKey={liveKey}
                          ri={col.ri}
                          miOffset={col.miOffset}
                        />
                      </div>
                    )
                  })}

                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
