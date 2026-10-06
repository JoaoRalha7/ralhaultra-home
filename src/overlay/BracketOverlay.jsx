import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

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
function getWorstMulti(comp) {
  const pays = (comp?.payments || []).map(p => parseFloat(p) || 0).filter(v => v > 0)
  const bet  = parseFloat(comp?.bet) || 0
  if (!pays.length || !bet) return null
  return Math.min(...pays) / bet
}
function fmtMulti(n) {
  if (n === null || n === undefined) return null
  return `${parseFloat(n.toFixed(2))}x`
}
function fmtEur(n) {
  if (!n) return '0.00€'
  return n >= 1000 ? Math.floor(n).toLocaleString('en-US') + '€' : n.toFixed(2) + '€'
}
function roundLabel(ri, total) {
  if (!total) return ''
  if (ri === total - 1) return 'Final'
  if (ri === total - 2) return 'Semi Finals'
  if (ri === total - 3) return 'Quarter Finals'
  if (ri === total - 4) return 'Round of 16'
  return `Round ${ri + 1}`
}

const CARD_W   = 240
const ROW_H    = 46
const CARD_H   = ROW_H * 2 + 1
const CARD_GAP = 50
const CONN_W   = 70
const H_CONN   = 50
const LBL_H    = 36
const CHAMP_H  = 140

function colHeight(n) { return n * CARD_H + (n - 1) * CARD_GAP }
function cardCY(i, n, outerH) {
  const h      = colHeight(n)
  const offset = (outerH - h) / 2
  return offset + i * (CARD_H + CARD_GAP) + CARD_H / 2
}
function cardTop(i, n, outerH) { return cardCY(i, n, outerH) - CARD_H / 2 }

// ─── Efeito Ping-Pong Otimizado (Sem Mask para evitar Bug no OBS) ─────────────
function SlideText({ text, className }) {
  const containerRef = useRef(null)
  const textRef = useRef(null)
  const [slideDist, setSlideDist] = useState(0)

  useEffect(() => {
    if (containerRef.current && textRef.current) {
      const cWidth = containerRef.current.clientWidth
      const tWidth = textRef.current.scrollWidth
      if (tWidth > cWidth) {
        setSlideDist(cWidth - tWidth - 6) 
      } else {
        setSlideDist(0)
      }
    }
  }, [text])

  return (
    <div className={`slide-wrap ${className || ''}`} ref={containerRef}>
      <div 
        className={`slide-inner ${slideDist < 0 ? 'anim-ping-pong' : ''}`}
        style={{ '--slide-dist': `${slideDist}px` }}
      >
        <span className="slide-text" ref={textRef}>{text}</span>
      </div>
    </div>
  )
}

// ─── neon connector dash animation ────────────────────────────────────────────
const NEON_GREEN  = '#34d399' 
const NEON_SHADOW = '0 0 6px #34d399, 0 0 14px #059669'

function useNeonConnectors(bracket) {
  const [litKeys, setLitKeys]       = useState(new Set())
  const [animKeys, setAnimKeys]     = useState(new Set())
  const prevBracketRef              = useRef(null)

  useEffect(() => {
    if (!bracket?.length) return

    const newLit  = new Set()
    const newAnim = new Set()

    bracket.forEach((round, ri) => {
      round.forEach((match, mi) => {
        if (!match?.winner) return
        const key = `${ri}-${mi}-out`
        const prev = prevBracketRef.current?.[ri]?.[mi]
        if (prev?.winner) {
          newLit.add(key)
        } else {
          newAnim.add(key)
          setTimeout(() => {
            setLitKeys(s => { const n = new Set(s); n.add(key); return n })
            setAnimKeys(s => { const n = new Set(s); n.delete(key); return n })
          }, 900)
        }
      })
    })

    setLitKeys(prev => new Set([...prev, ...newLit]))
    setAnimKeys(prev => new Set([...prev, ...newAnim]))

    prevBracketRef.current = bracket
  }, [bracket])

  return { litKeys, animKeys }
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;900&family=JetBrains+Mono:wght@700;800&family=Sora:wght@700;800;900&display=swap');

:root {
  --bg: #090C15; --surface: rgba(255,255,255,0.02); --surface2: rgba(255,255,255,0.04);
  --border: rgba(255,255,255,0.04); --border2: rgba(255,255,255,0.08);
  --text: #eeeef5; --muted: #64748b; --muted2: #94a3b8;
  --accent: #c084fc; --accent-dim: rgba(192,132,252,0.15);
  --green: #34d399; --green-dim: rgba(52,211,153,0.15);
  --red: #f87171; --red-dim: rgba(248,113,113,0.15);
  --yellow: #fbbf24; --yellow-dim: rgba(251,191,36,0.15);
  --blue: #38bdf8; --blue-dim: rgba(56,189,248,0.15);
}

html, body { background: transparent !important; margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.root-wrap { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background: transparent; }
.root { transform-origin: center; transform: scale(var(--scale,1)); font-family: 'Rubik', sans-serif; -webkit-font-smoothing: antialiased; display: flex; justify-content: center; }

.card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 1500px;
  height: 900px;
  box-shadow: 0 30px 80px rgba(0,0,0,.6);
}

.hd { display: flex; align-items: center; gap: 16px; padding: 18px 30px; background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0; }
.hd-title { font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 900; color: var(--text); flex: 1; letter-spacing: .08em; text-transform: uppercase; overflow: hidden; }
.hd-badge { font-size: 13px; font-weight: 800; color: var(--accent); letter-spacing: .1em; text-transform: uppercase; background: var(--accent-dim); border: 1px solid rgba(192,132,252,0.3); border-radius: 20px; padding: 6px 18px; flex-shrink: 0; }
.app-badge-live { background: rgba(18,20,31,0.7); border: 1px solid var(--border2); border-radius: 100px; padding: 6px 16px; display: flex; align-items: center; gap: 8px; font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 800; color: var(--red); letter-spacing: 0.05em; }
.dot-live { width: 8px; height: 8px; border-radius: 50%; background: var(--red); box-shadow: 0 0 8px var(--red); animation: blink-dot 1.5s infinite; }
.wait-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--surface2); animation: blink-dot 2.2s infinite; }

.stats-bar { display: flex; background: rgba(0,0,0,0.2); border-bottom: 1px solid var(--border); padding: 16px 30px; gap: 20px; flex-shrink: 0; }
.stat-item { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; gap: 14px; flex: 1; }
.stat-item.border-purple { border-left: 3px solid var(--accent); }
.stat-item.border-green  { border-left: 3px solid var(--green); }
.stat-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-icon.purple { background: var(--accent-dim); color: var(--accent); }
.stat-icon.green  { background: var(--green-dim); color: var(--green); }
.stat-icon.gold   { background: var(--yellow-dim); color: var(--yellow); }
.stat-icon.red    { background: var(--red-dim); color: var(--red); }

.stat-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.stat-lbl { font-size: 10px; font-weight: 800; color: var(--muted2); text-transform: uppercase; letter-spacing: 0.1em; line-height: 1; }
.stat-val { font-size: 20px; font-weight: 800; font-family: 'Sora', sans-serif; color: var(--text); line-height: 1; }
.stat-val.green { color: var(--green); }

.flip-stat { flex: 2.2; perspective: 900px; border-radius: 12px; min-height: 72px; }
.flip-stat-inner { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform 0.55s cubic-bezier(0.4,0,0.2,1); }
.flip-stat-inner.flipped { transform: rotateY(180deg); }

.flip-face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 12px; display: flex; align-items: center; gap: 16px; padding: 10px 20px; overflow: hidden; background: var(--surface); border: 1px solid var(--border); }
.flip-face-front { border-left: 3px solid var(--yellow); }
.flip-face-back { border-left: 3px solid var(--red); transform: rotateY(180deg); }

.bp-layout { display: flex; align-items: center; width: 100%; gap: 18px; overflow: hidden; }
.bp-layout.empty { justify-content: flex-start; }
.bp-left-group { display: flex; align-items: center; gap: 12px; }
.bp-avatar { border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid var(--border2); }
.bp-player-info { display: flex; flex-direction: column; gap: 2px; justify-content: center; min-width: 0; }
.bp-lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted2); }
.bp-name { font-size: 15px; font-weight: 800; color: var(--text); overflow: hidden; }
.bp-slot-info { display: flex; align-items: center; gap: 10px; background: var(--surface2); padding: 6px 14px 6px 6px; border-radius: 10px; border: 1px solid var(--border); margin-left: auto; overflow: hidden; }
.bp-slot-name { font-size: 12px; font-weight: 700; color: var(--muted); overflow: hidden; max-width: 140px; }
.bp-multi-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-left: 10px; flex-shrink: 0; }
.bp-multi { font-size: 28px; font-weight: 900; font-family: 'Sora', sans-serif; line-height: 1; letter-spacing: -1px; }
.bp-multi.gold { color: var(--yellow); }
.bp-multi.red  { color: var(--red); }
.bp-pay { font-size: 11px; font-weight: 800; color: #fff; padding: 2px 8px; border-radius: 6px; font-family: 'Sora', sans-serif; line-height: 1; }
.bp-pay.gold { background: var(--yellow-dim); border: 1px solid rgba(251,191,36,0.3); }
.bp-pay.red  { background: var(--red-dim);  border: 1px solid rgba(239,68,68,0.3); }

/* ── bracket ── */
.bracket-area { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 40px; position: relative; }
.bracket-inner { display: flex; align-items: flex-start; gap: 0; z-index: 2; }

.mc { width: ${CARD_W}px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; transition: all .3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; box-shadow: 0 8px 20px rgba(0,0,0,.4); }
.mc::after { content: 'VS'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--surface2); color: var(--muted); font-size: 10px; font-weight: 900; font-style: italic; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--border); letter-spacing: 1px; }
.mc.live  { border: 2px solid var(--accent); box-shadow: 0 0 20px rgba(192,132,252,.3); z-index: 10; transform: scale(1.02); }
.mc.live::after { background: var(--accent); color: #fff; border-color: #fff; box-shadow: 0 0 10px var(--accent); }
.mc.done  { border-color: rgba(52,211,153,.2); opacity: 0.85; }
.mc.final { border-color: rgba(251,191,36,.5); box-shadow: 0 0 20px rgba(251,191,36,.2); }

@keyframes slotArrive {
  0%   { box-shadow: 0 0 0px rgba(192,132,252,0); border-color: rgba(192,132,252,0); }
  25%  { box-shadow: 0 0 30px rgba(192,132,252,.5); border-color: rgba(192,132,252,.9); }
  100% { box-shadow: 0 8px 20px rgba(0,0,0,.4); border-color: var(--border); }
}
.mc.arrive { animation: slotArrive 0.8s ease forwards; }

.cr { display: flex; align-items: center; gap: 12px; padding: 0 14px; height: ${ROW_H}px; position: relative; overflow: hidden; }
.cr + .cr { border-top: 1px solid var(--border); }
.cr.win  { background: linear-gradient(90deg, var(--green-dim), transparent); }
.cr.loss { opacity: .25; filter: grayscale(100%); }
.cr.fwin { background: linear-gradient(90deg, var(--yellow-dim), transparent); }
.win-bar  { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--green); box-shadow: 2px 0 12px rgba(52,211,153,.6); }
.fwin-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--yellow); box-shadow: 2px 0 12px rgba(251,191,36,.6); }

.slot-img { width: 30px; height: 30px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: var(--surface2); border: 1px solid var(--border2); }
.p-name-wrap { flex: 1; min-width: 0; overflow: hidden; }
.p-name   { font-size: 13px; font-weight: 700; color: var(--text); }
.p-name.tbd { color: var(--muted); font-weight: 500; font-style: italic; }
.p-multi  { font-size: 12px; font-weight: 900; color: var(--accent); flex-shrink: 0; white-space: nowrap; font-family: 'Sora', sans-serif; }
.p-multi.gold { color: var(--yellow); }
.p-multi.dim  { color: var(--muted); font-weight: 500; }

.rlbl { font-size: 11px; font-weight: 800; color: var(--muted2); letter-spacing: .15em; text-transform: uppercase; text-align: center; height: ${LBL_H}px; display: flex; align-items: center; justify-content: center; width: ${CARD_W}px; margin-bottom: 12px; }
.rlbl.blinking { animation: textBlink 1.5s infinite; color: var(--text); }

/* ── CHAMPION CARD (CENTRADINHO E ADAPTÁVEL) ── */
.champ-card {
  width: 240px;
  background: var(--surface);
  border: 1px solid var(--yellow);
  border-radius: 12px; 
  padding: 16px 12px; 
  display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;
  min-height: 150px; /* <--- O segredo está aqui: min-height em vez de height fixo */
  justify-content: center; box-shadow: 0 10px 30px rgba(251,191,36,.15);
  position: relative; z-index: 2;
}

.champ-lbl  { font-size: 11px; font-weight: 900; color: var(--yellow); letter-spacing: .12em; text-transform: uppercase; flex-shrink: 0; }
.champ-slot { width: 44px; height: 44px; border-radius: 10px; object-fit: cover; border: 2px solid rgba(251,191,36,.5); background: var(--surface2); flex-shrink: 0; }

.champ-prow { display: flex; align-items: center; gap: 8px; margin-top: 2px; width: 100%; justify-content: center; flex-shrink: 0; }
.champ-av   { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(251,191,36,.4); flex-shrink: 0; }

.champ-name { font-size: 14px; font-weight: 900; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; line-height: 1.2; }
.champ-slot-name { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; text-align: center; flex-shrink: 0; }
.champ-pending   { font-size: 13px; color: var(--muted); font-weight: 500; }

.waiting { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px; gap: 16px; height: 100%; }
.waiting-title { font-size: 20px; font-weight: 900; color: var(--muted2); text-transform: uppercase; letter-spacing: 2px; }
.waiting-sub   { font-size: 15px; color: var(--muted); }

/* ── PING PONG ANIMATION (SEM MASK IMAGE!) ── */
.slide-wrap { width: 100%; overflow: hidden; white-space: nowrap; }
.slide-inner { display: inline-flex; align-items: center; width: fit-content; }
.anim-ping-pong { animation: text-ping-pong 4s ease-in-out infinite alternate; }
.slide-text { line-height: 1.2; }
@keyframes text-ping-pong { 0%, 20% { transform: translateX(0); } 80%, 100% { transform: translateX(var(--slide-dist)); } }

/* ── neon connector animation ── */
@keyframes neonDraw {
  from { stroke-dashoffset: var(--path-len, 200); opacity: 0.4; }
  to   { stroke-dashoffset: 0; opacity: 1; }
}

@keyframes blink-dot  { 0%,100%{opacity:1} 50%{opacity:.2} }
@keyframes waitBlink { 0%,100%{opacity:.15} 50%{opacity:.5} }
@keyframes textBlink { 0%,100%{opacity:1;} 50%{opacity:.3;} }
`

// ─── slot-img ─────────────────────────────────────────────────────────────────
function SlotImg({ url, size = 30, radius = 8, className = 'slot-img' }) {
  const [err, setErr] = useState(false)
  if (url && !err) return <img src={url} alt="" className={className} style={{ width: size, height: size, borderRadius: radius }} onError={() => setErr(true)} />
  return <div className={className} style={{ width: size, height: size, borderRadius: radius }} />
}

function TwitchAv({ username, src, size = 26, className = 'champ-av' }) {
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

// ─── flip card best/worst ──────────────────────────────────────────────────────
function BestWorstFlip({ stats, pics }) {
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    if (!stats.bestPlay || !stats.worstPlay) return
    const id = setInterval(() => setFlipped(f => !f), 6000)
    return () => clearInterval(id)
  }, [stats.bestPlay, stats.worstPlay])

  const renderSide = (play, payAmount, multi, accent, label) => {
    if (!play) return (
      <div className="bp-layout empty">
        <div className={`stat-icon ${accent}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <div className="bp-player-info">
          <span className={`bp-lbl ${accent}`}>{label}</span>
          <span className="stat-val dim">—</span>
        </div>
      </div>
    )
    return (
      <div className="bp-layout">
        <div className="bp-left-group">
          <div className={`stat-icon ${accent}`}>
            {accent === 'gold'
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            }
          </div>
          <TwitchAv username={play.player} src={pics[play.player?.toLowerCase()]} size={42} className={`bp-avatar ${accent}`} />
        </div>
        <div className="bp-player-info">
          <span className={`bp-lbl ${accent}`}>{label}</span>
          <SlideText text={play.player} className="bp-name" />
        </div>
        <div className="bp-slot-info">
          <SlotImg url={play.slot?.image_url} size={36} radius={8} />
          <SlideText text={play.slot?.name} className="bp-slot-name" />
        </div>
        <div className="bp-multi-wrap">
          <span className={`bp-multi ${accent}`}>{fmtMulti(multi)}</span>
          <span className={`bp-pay ${accent}`}>{fmtEur(payAmount)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flip-stat">
      <div className={`flip-stat-inner ${flipped ? 'flipped' : ''}`}>
        <div className="flip-face flip-face-front">
          {renderSide(stats.bestPlay, stats.bestPayAmount, stats.highestX, 'gold', 'Best Payment')}
        </div>
        <div className="flip-face flip-face-back">
          {renderSide(stats.worstPlay, stats.worstPayAmount, stats.lowestX, 'red', 'Worst Payment')}
        </div>
      </div>
    </div>
  )
}

// ─── match card ───────────────────────────────────────────────────────────────
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
      <SlotImg url={comp?.slot?.image_url} size={30} radius={8} />
      <div className="p-name-wrap">
        <SlideText text={comp?.player || '—'} className="p-name" />
      </div>
      {multi !== null
        ? <span className={`p-multi${isWinner ? ' gold' : ''}`}>{fmtMulti(multi)}</span>
        : <span className="p-multi dim">—</span>
      }
    </div>
  )
}

function MatchCard({ match, isLive, isFinal = false, arriving = false }) {
  const winner = match?.winner
  const [showArrive, setShowArrive] = useState(false)

  useEffect(() => {
    if (!arriving) return
    setShowArrive(true)
    const t = setTimeout(() => setShowArrive(false), 900)
    return () => clearTimeout(t)
  }, [arriving])

  const cardClass = [
    'mc',
    isLive               ? 'live'   : '',
    winner && !isFinal   ? 'done'   : '',
    isFinal              ? 'final'  : '',
    showArrive           ? 'arrive' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cardClass}>
      <CompRow comp={match?.a} winner={winner} side="a" isFinal={isFinal} />
      <CompRow comp={match?.b} winner={winner} side="b" isFinal={isFinal} />
    </div>
  )
}

// ─── Champion Card (Sem SlideText, Fixo e Centrado) ───────────────────────────
// ─── Champion Card (Fixo e Centrado) ───────────────────────────
function ChampionCard({ comp, pic }) {
  const [slotErr, setSlotErr] = useState(false)
  
  return (
    <div className="champ-card">
      <svg width="24" height="22" viewBox="0 0 22 20" fill="none">
        <path d="M2 2L11 7L20 2L17 15H5L2 2Z" fill={comp?.player ? 'rgba(251,191,36,.88)' : 'rgba(251,191,36,.35)'} stroke={comp?.player ? 'var(--yellow)' : 'rgba(251,191,36,.4)'} strokeWidth="1.5" strokeLinejoin="round"/>
        <rect x="5" y="16" width="12" height="3" rx="1.5" fill={comp?.player ? 'rgba(251,191,36,.55)' : 'rgba(251,191,36,.2)'}/>
      </svg>
      <div className="champ-lbl">Champion</div>
      
      {comp?.player ? (
        <>
          {/* FOTO DA SLOT */}
          {comp?.slot?.image_url && !slotErr ? (
            <img src={comp.slot.image_url} alt={comp.slot.name} className="champ-slot" onError={() => setSlotErr(true)} />
          ) : (
            <div className="champ-slot" />
          )}
          
          {/* AVATAR + NOME DO JOGADOR */}
          <div className="champ-prow">
            <TwitchAv username={comp.player} src={pic} size={24} />
            <div className="champ-name">{comp.player}</div>
          </div>
          
          {/* NOME DA SLOT */}
          {comp?.slot?.name && (
            <div className="champ-slot-name">{comp.slot.name}</div>
          )}
        </>
      ) : (
        <div className="champ-pending">TBD…</div>
      )}
    </div>
  )
}

// ─── connector SVGs with neon support ─────────────────────────────────────────
function connStyle(neon) {
  if (!neon) return { stroke: 'var(--border2)', strokeWidth: 2, filter: 'none', transition: 'stroke 0.4s, filter 0.4s' }
  return {
    stroke: NEON_GREEN,
    strokeWidth: 2.5,
    filter: `drop-shadow(0 0 4px ${NEON_GREEN}) drop-shadow(0 0 10px #059669)`,
    transition: 'stroke 0.4s, filter 0.4s',
  }
}

function animProps(neon, pathLen) {
  if (neon !== 'anim') return {}
  return {
    strokeDasharray: pathLen,
    strokeDashoffset: 0,
    style: {
      strokeDasharray: pathLen,
      strokeDashoffset: pathLen,
      animation: `neonDraw 0.65s ease forwards`,
    }
  }
}

function FanInConn({ outerH, fromN, toN, litKeys, animKeys, riFrom, matchOffset }) {
  const w   = CONN_W
  const mid = w / 2
  const els = []

  for (let i = 0; i < toN; i++) {
    const yA   = cardCY(i * 2,     fromN, outerH)
    const yB   = cardCY(i * 2 + 1, fromN, outerH)
    const yMid = (yA + yB) / 2
    const yOut = cardCY(i, toN, outerH)

    const miA = matchOffset + i * 2
    const miB = matchOffset + i * 2 + 1
    const keyA = `${riFrom}-${miA}-out`
    const keyB = `${riFrom}-${miB}-out`
    const nA   = animKeys.has(keyA) ? 'anim' : litKeys.has(keyA)
    const nB   = animKeys.has(keyB) ? 'anim' : litKeys.has(keyB)

    const sA = connStyle(nA)
    const sB = connStyle(nB)
    const nBoth = (litKeys.has(keyA) || animKeys.has(keyA)) && (litKeys.has(keyB) || animKeys.has(keyB))
    const sOut  = connStyle(nBoth)

    els.push(
      <g key={i}>
        <line x1={0}   y1={yA}   x2={mid} y2={yA}   style={sA} strokeLinecap="round" />
        <line x1={0}   y1={yB}   x2={mid} y2={yB}   style={sB} strokeLinecap="round" />
        <line x1={mid} y1={yA}   x2={mid} y2={yB}   style={nA || nB ? connStyle(true) : connStyle(false)} strokeLinecap="round" />
        <line x1={mid} y1={yMid} x2={w}   y2={yOut} style={sOut} strokeLinecap="round" />
      </g>
    )
  }

  return (
    <svg width={w} height={outerH} style={{ display: 'block', flexShrink: 0, marginTop: LBL_H + 12, overflow: 'visible' }}>
      {els}
    </svg>
  )
}

function FanOutConn({ outerH, fromN, toN, litKeys, animKeys, riFrom, matchOffset }) {
  const w   = CONN_W
  const mid = w / 2
  const els = []

  for (let i = 0; i < fromN; i++) {
    const yIn  = cardCY(i, fromN, outerH)
    const yA   = cardCY(i * 2,     toN, outerH)
    const yB   = cardCY(i * 2 + 1, toN, outerH)
    const yMid = (yA + yB) / 2
    const mi   = matchOffset + i
    const key  = `${riFrom}-${mi}-out`
    const n    = animKeys.has(key) ? 'anim' : litKeys.has(key)
    const s    = connStyle(n)

    els.push(
      <g key={i}>
        <line x1={0}   y1={yIn}  x2={mid} y2={yMid} style={s} strokeLinecap="round" />
        <line x1={mid} y1={yA}   x2={mid} y2={yB}   style={s} strokeLinecap="round" />
        <line x1={mid} y1={yA}   x2={w}   y2={yA}   style={s} strokeLinecap="round" />
        <line x1={mid} y1={yB}   x2={w}   y2={yB}   style={s} strokeLinecap="round" />
      </g>
    )
  }

  return (
    <svg width={w} height={outerH} style={{ display: 'block', flexShrink: 0, marginTop: LBL_H + 12, overflow: 'visible' }}>
      {els}
    </svg>
  )
}

function HConn({ outerH, litKeys, animKeys, riFrom, mi }) {
  const y   = outerH / 2
  const key = `${riFrom}-${mi}-out`
  const n   = animKeys.has(key) ? 'anim' : litKeys.has(key)
  const s   = connStyle(n)

  return (
    <svg width={H_CONN} height={outerH} style={{ display: 'block', flexShrink: 0, marginTop: LBL_H + 12, overflow: 'visible' }}>
      <line x1={0} y1={y} x2={H_CONN} y2={y} style={s} strokeLinecap="round" />
    </svg>
  )
}

// ─── column ───────────────────────────────────────────────────────────────────
function Column({ label, matches, outerH, liveKey, ri, currentRi, miOffset = 0, isFinal = false, arrivingKeys }) {
  const n = matches.length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, alignItems: 'center' }}>
      <div className={`rlbl ${ri === currentRi ? 'blinking' : ''}`}>{label}</div>
      <div style={{ height: outerH, position: 'relative', width: CARD_W }}>
        {matches.map((match, idx) => {
          const mi     = miOffset + idx
          const isLive = `${ri}-${mi}` === liveKey
          const top    = cardTop(idx, n, outerH)
          const arriving = arrivingKeys?.has(`${ri}-${mi}-arrive`) ?? false
          return (
            <div key={idx} style={{ position: 'absolute', top, left: 0, width: CARD_W }}>
              <MatchCard match={match} isLive={isLive} isFinal={isFinal} arriving={arriving} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────
export default function BracketOverlay() {
  const [tournament, setTournament] = useState(undefined)
  const [pics, setPics]             = useState({})
  const rootRef                     = useRef(null)

  const [arrivingKeys, setArrivingKeys] = useState(new Set())
  const prevBracketRef2                 = useRef(null)

  const [bracket, setBracket] = useState([])

  const { litKeys, animKeys } = useNeonConnectors(bracket)

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
        setBracket(data.bracket)

        const prev = prevBracketRef2.current
        if (prev) {
          const arriving = new Set()
          data.bracket.forEach((round, ri) => {
            round.forEach((match, mi) => {
              const prevMatch = prev[ri]?.[mi]
              const aNew = match.a?.player && !prevMatch?.a?.player
              const bNew = match.b?.player && !prevMatch?.b?.player
              if (aNew || bNew) arriving.add(`${ri}-${mi}-arrive`)
            })
          })
          if (arriving.size) {
            setArrivingKeys(arriving)
            setTimeout(() => setArrivingKeys(new Set()), 1000)
          }
        }
        prevBracketRef2.current = data.bracket

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
      if (!rootRef.current) return
      const reqW  = 1500
      const reqH  = 900
      const scale = Math.min(window.innerWidth / reqW, window.innerHeight / reqH, 1)
      document.documentElement.style.setProperty('--scale', scale)
    }
    setTimeout(update, 50)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [tournament])

  const title   = tournament?.title   || 'Tournament'
  const nRounds = bracket.length

  const stats = useMemo(() => {
    let totalPlayers = new Set()
    let highestX = 0, lowestX = Infinity
    let bestPlay = null, worstPlay = null
    let matchesPlayed = 0, totalMatches = 0, totalWon = 0

    bracket.forEach(round => {
      round.forEach(m => {
        totalMatches++
        if (m.winner) matchesPlayed++
        ;[m.a, m.b].forEach(comp => {
          if (!comp?.player) return
          totalPlayers.add(comp.player)
          const best  = getBestMulti(comp)  ?? 0
          const worst = getWorstMulti(comp) ?? Infinity
          if (best  > highestX) { highestX = best;   bestPlay  = comp }
          if (worst < lowestX)  { lowestX  = worst;  worstPlay = comp }
          if (comp.payments) totalWon += comp.payments.reduce((a, v) => a + (parseFloat(v) || 0), 0)
        })
      })
    })

    const bestPayAmount  = bestPlay
      ? Math.max(...(bestPlay.payments  || []).map(p => parseFloat(p) || 0)) : 0
    const worstPayAmount = worstPlay
      ? Math.min(...(worstPlay.payments || []).map(p => parseFloat(p) || 0).filter(v => v > 0)) : 0

    return {
      players: totalPlayers.size,
      highestX: highestX || null,
      lowestX:  lowestX === Infinity ? null : lowestX,
      bestPlay,  bestPayAmount,
      worstPlay, worstPayAmount,
      matchesPlayed, totalMatches, totalWon,
    }
  }, [bracket])

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

  if (tournament === undefined) return <><style>{CSS}</style><div className="root-wrap"><div className="root" /></div></>

  const outerRound = bracket[0] || []
  const outerN     = Math.ceil(outerRound.length / 2)
  const outerH     = colHeight(outerN)

  const leftCols = []
  for (let ri = 0; ri < finalRi; ri++) {
    const round = bracket[ri] || []
    const half  = Math.ceil(round.length / 2)
    leftCols.push({ ri, matches: round.slice(0, half), miOffset: 0 })
  }

  const rightCols = []
  for (let i = 0; i < finalRi; i++) {
    const ri    = finalRi - 1 - i
    const round = bracket[ri] || []
    const half  = Math.ceil(round.length / 2)
    rightCols.push({ ri, matches: round.slice(half), miOffset: half })
  }

  const finalColH   = CARD_H
  const finalTopPad = (outerH - finalColH) / 2

  return (
    <>
      <style>{CSS}</style>
      <div className="root-wrap">
        <div className="root">
          <div className="card" ref={rootRef}>

            <div className="hd">
              {tournament ? <div className="app-badge-live"><div className="dot-live" /> LIVE</div> : <div className="wait-dot" />}
              <SlideText text={title} className="hd-title" />
            </div>

            {!tournament ? (
              <div className="waiting">
                <div className="waiting-title">No Active Tournament</div>
                <div className="waiting-sub">Start a tournament in the dashboard to begin</div>
              </div>
            ) : (
              <>
                <div className="stats-bar">
                  {/* participants */}
                  <div className="stat-item">
                    <div className="stat-icon purple">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div className="stat-info">
                      <span className="stat-lbl">Participants</span>
                      <span className="stat-val">{stats.players}</span>
                    </div>
                  </div>

                  {/* matches played */}
                  <div className="stat-item border-purple">
                    <div className="stat-icon purple">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    </div>
                    <div className="stat-info">
                      <span className="stat-lbl">Matches Played</span>
                      <span className="stat-val">{stats.matchesPlayed} / {stats.totalMatches}</span>
                    </div>
                  </div>

                  {/* total won */}
                  <div className="stat-item border-green">
                    <div className="stat-icon green">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                    <div className="stat-info">
                      <span className="stat-lbl">Total Won</span>
                      <span className="stat-val green">{fmtEur(stats.totalWon)}</span>
                    </div>
                  </div>

                  {/* ── FLIP CARD best/worst ── */}
                  <BestWorstFlip stats={stats} pics={pics} />
                </div>

                <div className="bracket-area">
                  <div className="bracket-inner">

                    {leftCols.map((col, colIdx) => {
                      const nextN  = colIdx < leftCols.length - 1 ? leftCols[colIdx + 1].matches.length : 1
                      const isLast = colIdx === leftCols.length - 1
                      return (
                        <div key={`L${col.ri}`} style={{ display: 'contents' }}>
                          <Column
                            label={roundLabel(col.ri, nRounds)}
                            matches={col.matches}
                            outerH={outerH}
                            liveKey={liveKey}
                            ri={col.ri}
                            currentRi={currentRi}
                            miOffset={col.miOffset}
                            arrivingKeys={arrivingKeys}
                          />
                          {isLast
                            ? <HConn outerH={outerH} litKeys={litKeys} animKeys={animKeys} riFrom={col.ri} mi={col.miOffset} />
                            : <FanInConn outerH={outerH} fromN={col.matches.length} toN={nextN} litKeys={litKeys} animKeys={animKeys} riFrom={col.ri} matchOffset={col.miOffset} />
                          }
                        </div>
                      )
                    })}

                    {/* final column */}
                    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, alignItems: 'center' }}>
                      <div className={`rlbl ${finalRi === currentRi ? 'blinking' : ''}`}>Final</div>
                      <div style={{ height: outerH, position: 'relative', width: CARD_W }}>
                        <div style={{ position: 'absolute', top: finalTopPad, left: 0, width: CARD_W }}>
                          <MatchCard
                            match={finalMatch}
                            isLive={liveKey === `${finalRi}-0`}
                            isFinal
                            arriving={arrivingKeys.has(`${finalRi}-0-arrive`)}
                          />
                        </div>
                      </div>
                    </div>

                    {rightCols.map((col, colIdx) => {
                      const prevN    = colIdx > 0 ? rightCols[colIdx - 1].matches.length : 1
                      const isFirst  = colIdx === 0
                      return (
                        <div key={`R${col.ri}`} style={{ display: 'contents' }}>
                          {isFirst
                            ? <HConn outerH={outerH} litKeys={litKeys} animKeys={animKeys} riFrom={col.ri} mi={col.miOffset} />
                            : <FanOutConn outerH={outerH} fromN={prevN} toN={col.matches.length} litKeys={litKeys} animKeys={animKeys} riFrom={col.ri} matchOffset={col.miOffset} />
                          }
                          <Column
                            label={roundLabel(col.ri, nRounds)}
                            matches={col.matches}
                            outerH={outerH}
                            liveKey={liveKey}
                            ri={col.ri}
                            currentRi={currentRi}
                            miOffset={col.miOffset}
                            arrivingKeys={arrivingKeys}
                          />
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 16 }}>
                    <svg width="2" height="24" style={{ marginBottom: 6 }}>
                      <line x1="1" y1="0" x2="1" y2="24" stroke="var(--yellow)" strokeWidth="2" strokeDasharray="4 4" opacity="0.4" />
                    </svg>
                    {/* Componente Champion Card Centrado */}
                    <ChampionCard comp={champComp} pic={champPic} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
