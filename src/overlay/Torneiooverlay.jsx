import { useState, useEffect, useRef, useMemo } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

// ─── Profile pic cache ────────────────────────────────────────────────────
const profileCache = {}

async function getProfilePic(username) {
  if (!username) return null
  if (profileCache[username]) return profileCache[username]
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res  = await fetch(`https://api.ivr.fi/v2/twitch/user?login=${username.toLowerCase()}`, { signal: controller.signal })
    clearTimeout(timeout)
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

// ─── TwitchAvatar ─────────────────────────────────────────────────────────
function TwitchAvatar({ username, src, size = 26 }) {
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

  const base = { width: size, height: size, borderRadius: '50%', flexShrink: 0, border: '2px solid rgba(255,255,255,.3)' }
  if (imgSrc) return <img src={imgSrc} alt={username} style={{ ...base, objectFit: 'cover' }} />
  return (
    <div style={{ ...base, background: `${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: size * 0.38, color }}>
      {username?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

// ─── ScrollText ───────────────────────────────────────────────────────────
function ScrollText({ text, className = '', style = {} }) {
  const outerRef = useRef(null)
  const innerRef = useRef(null)
  const animRef  = useRef(null)

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    cancelAnimationFrame(animRef.current)
    inner.style.transform = 'translateX(0)'

    const raf = requestAnimationFrame(() => {
      const overflow = inner.scrollWidth - outer.clientWidth
      if (overflow <= 4) return
      const duration = Math.max(2500, overflow * 30)
      const pause    = 2000
      let start      = null
      const step = ts => {
        if (!start) start = ts
        const elapsed = ts - start
        if (elapsed < pause) {
          inner.style.transform = 'translateX(0)'
        } else if (elapsed < pause + duration) {
          inner.style.transform = `translateX(-${overflow * (elapsed - pause) / duration}px)`
        } else if (elapsed < pause + duration + pause) {
          inner.style.transform = `translateX(-${overflow}px)`
        } else {
          inner.style.transform = 'translateX(0)'
          start = null
        }
        animRef.current = requestAnimationFrame(step)
      }
      animRef.current = requestAnimationFrame(step)
    })
    return () => { cancelAnimationFrame(raf); cancelAnimationFrame(animRef.current) }
  }, [text])

  return (
    <div ref={outerRef} style={{ overflow: 'hidden', ...style }}>
      <div ref={innerRef} className={className} style={{ whiteSpace: 'nowrap', display: 'inline-block', willChange: 'transform' }}>
        {text}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function parseComp(comp) {
  const pays  = (comp?.payments || []).map(p => parseFloat(p) || 0).filter(v => v > 0)
  const bet   = parseFloat(comp?.bet) || 0
  const total = pays.reduce((s, v) => s + v, 0)
  const best  = pays.length && bet ? Math.max(...pays) / bet : null
  const avg   = pays.length && bet ? total / pays.length / bet : null
  return { pays, bet, total, best, avg }
}

function fmtEur(n) {
  if (n === null || n === undefined) return '—'
  return n % 1 === 0 ? `${n}€` : `${parseFloat(n.toFixed(2))}€`
}
function fmtMulti(n) {
  if (n === null || n === undefined) return '—'
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

// ─── Icons ────────────────────────────────────────────────────────────────
const IcoCoins = ({ color = '#22c55e' }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/>
    <path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>
  </svg>
)
const IcoTrend = ({ color = '#f59e0b' }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
  </svg>
)
const IcoBar = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)
const IcoTrophy = ({ stroke = '#a78bfa' }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
    <path d="M12 17v4"/><path d="M8 21h8"/>
    <path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/>
  </svg>
)

// ─── Champion screen ───────────────────────────────────────────────────────
function ChampionScreen({ comp, pic }) {
  const [slotImgErr, setSlotImgErr] = useState(false)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', gap: 0 }}>

      {/* rotating rays */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: .055 }}>
        <svg viewBox="0 0 400 400" fill="none" style={{ width: 600, height: 600, animation: 'spin 20s linear infinite' }}>
          <g transform="translate(200,200)">
            {[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5].map((deg, i) => (
              <line key={i}
                x1={Math.cos(deg * Math.PI / 180) * -200} y1={Math.sin(deg * Math.PI / 180) * -200}
                x2={Math.cos(deg * Math.PI / 180) * 200}  y2={Math.sin(deg * Math.PI / 180) * 200}
                stroke="#fbbf24" strokeWidth={i % 2 === 0 ? 55 : 35}
              />
            ))}
          </g>
        </svg>
      </div>

      {/* floating dots */}
      {[
        { top: '18%', left: '14%', color: '#fbbf24', delay: '0s'  },
        { top: '28%', right: '16%', color: '#a78bfa', delay: '.6s' },
        { bottom: '24%', left: '18%', color: '#22c55e', delay: '1.2s' },
        { bottom: '18%', right: '14%', color: '#fbbf24', delay: '.3s' },
        { top: '16%', left: '42%', color: '#fff', delay: '.9s', size: 4 },
        { top: '22%', right: '38%', color: '#fbbf24', delay: '1.5s', size: 4 },
      ].map((d, i) => (
        <div key={i} style={{
          position: 'absolute', width: d.size || 6, height: d.size || 6, borderRadius: '50%',
          background: d.color, top: d.top, left: d.left, right: d.right, bottom: d.bottom,
          animation: `floatDot 3s ease-in-out ${d.delay} infinite`
        }} />
      ))}

      {/* trophy */}
      <svg width="52" height="46" viewBox="0 0 52 46" fill="none" style={{ position: 'relative', zIndex: 2, marginBottom: 4 }}>
        <path d="M7 4L26 14L45 4L39 34H13L7 4Z" fill="rgba(251,191,36,.88)" stroke="#fbbf24" strokeWidth="1.5" strokeLinejoin="round"/>
        <rect x="13" y="36" width="26" height="5" rx="2.5" fill="rgba(251,191,36,.55)"/>
        <path d="M20 18 L26 24 L32 18" stroke="rgba(255,255,255,.3)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>

      {/* campeão label */}
      <div style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', letterSpacing: '.14em', textTransform: 'uppercase', position: 'relative', zIndex: 2, marginBottom: 12 }}>
        Campeão
      </div>

      {/* slot thumbnail */}
      {comp?.slot?.image_url && !slotImgErr
        ? <img src={comp.slot.image_url} alt={comp.slot.name}
            onError={() => setSlotImgErr(true)}
            style={{ width: 72, height: 72, borderRadius: 14, objectFit: 'cover', border: '2px solid rgba(251,191,36,.5)', boxShadow: '0 0 32px rgba(251,191,36,.2)', position: 'relative', zIndex: 2 }} />
        : <div style={{ width: 72, height: 72, borderRadius: 14, background: 'linear-gradient(135deg,#1a1d3a,#12102a)', border: '2px solid rgba(251,191,36,.25)', position: 'relative', zIndex: 2 }} />
      }

      {/* player row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 2, marginTop: 12, marginBottom: 4 }}>
        <TwitchAvatar username={comp?.player || '?'} src={pic} size={30} />
        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{comp?.player || '—'}</div>
      </div>

      {/* slot name */}
      <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.5)', position: 'relative', zIndex: 2, marginBottom: 14 }}>
        {comp?.slot?.name || '—'}
      </div>

      {/* glow line */}
      <div style={{ width: 180, height: 1, background: 'linear-gradient(90deg,transparent,rgba(251,191,36,.4),transparent)', position: 'relative', zIndex: 2 }} />

    </div>
  )
}

// ─── CSS ──────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;900&display=swap');
html, body { background: transparent !important; margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.root-wrap { width: 100vw; height: 100vh; display: flex; align-items: flex-start; justify-content: flex-start; }
.root { width: 460px; height: 480px; transform-origin: top left; transform: scale(var(--scale,1)); font-family: 'Rubik', sans-serif; -webkit-font-smoothing: antialiased; }
.card { background: #07090f; border: 1px solid rgba(255,255,255,.07); border-radius: 16px; overflow: hidden; height: 100%; display: flex; flex-direction: column; }

/* HEADER */
.hd { display: flex; align-items: center; gap: 10px; padding: 9px 14px; background: linear-gradient(90deg,#0d0b1a,#130b1a,#0d0b1a); border-bottom: 1px solid rgba(124,111,255,.15); flex-shrink: 0; transition: border-color .5s; }
.hd.champ-mode { border-bottom-color: rgba(251,191,36,.25); }
.hd-title { font-size: 14px; font-weight: 900; color: #fff; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hd-round { font-size: 10px; font-weight: 800; color: #a78bfa; letter-spacing: .07em; text-transform: uppercase; background: rgba(124,111,255,.12); border: 1px solid rgba(124,111,255,.25); border-radius: 20px; padding: 4px 12px; flex-shrink: 0; transition: all .5s; }
.hd-round.champ { color: #fbbf24; background: rgba(251,191,36,.1); border-color: rgba(251,191,36,.25); }
.live-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; animation: pulse 1.4s ease-in-out infinite; flex-shrink: 0; }
.wait-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.2); animation: blink 2s ease-in-out infinite; flex-shrink: 0; }

/* TOURNAMENT STATS */
.t-stats { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; border-bottom: 1px solid rgba(255,255,255,.06); flex-shrink: 0; }
.t-stat { display: flex; align-items: center; gap: 7px; padding: 7px 10px; }
.t-stat + .t-stat { border-left: 1px solid rgba(255,255,255,.05); }
.t-ico { width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.t-right { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.t-lbl { font-size: 9px; font-weight: 700; color: rgba(255,255,255,.4); letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
.t-val { font-size: 12px; font-weight: 900; color: #fff; white-space: nowrap; }
.t-val.green  { color: #22c55e; }
.t-val.amber  { color: #f59e0b; }
.t-val.purple { color: #a78bfa; }

/* SECTION */
.section-lbl { display: flex; align-items: center; gap: 8px; padding: 7px 14px 4px; flex-shrink: 0; }
.section-txt  { font-size: 10px; font-weight: 700; color: #fff; letter-spacing: .1em; text-transform: uppercase; }
.live-badge   { font-size: 9px; font-weight: 800; background: rgba(34,197,94,.1); border: 1px solid rgba(34,197,94,.25); border-radius: 4px; color: #22c55e; padding: 2px 8px; transition: all .4s; }
.live-badge.winner { background: rgba(251,191,36,.12); border-color: rgba(251,191,36,.25); color: #fbbf24; }

/* MATCH */
.match { margin: 0 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,.1); overflow: hidden; flex-shrink: 0; transition: border-color .5s ease, box-shadow .5s ease; }
.match.winner-mode { border-color: rgba(251,191,36,.35); box-shadow: 0 0 32px rgba(251,191,36,.07); }

/* Lead bar */
.lead-bar { height: 4px; display: flex; }
.lead-a { background: linear-gradient(90deg,#7c6fff,#a78bfa); transition: flex .8s cubic-bezier(.4,0,.2,1); }
.lead-b { background: linear-gradient(90deg,#22c55e,#34d399); transition: flex .8s cubic-bezier(.4,0,.2,1); }
.lead-c { width: 2px; background: #07090f; flex-shrink: 0; }

/* SPLIT TOP */
.split-top { display: flex; height: 120px; position: relative; }
.side { flex: 1; position: relative; overflow: hidden; }
.side-ph  { position: absolute; inset: 0; }
.side-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .6; will-change: transform, opacity; backface-visibility: hidden; transform: translateZ(0); }
.side.L .side-fade { position: absolute; inset: 0; background: linear-gradient(to right, transparent 20%, #07090f 100%); }
.side.R .side-fade { position: absolute; inset: 0; background: linear-gradient(to left,  transparent 20%, #07090f 100%); }
.side-fade-b { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 30%, rgba(7,9,15,.88) 100%); }
.side-content { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 9px 12px; }
.side.R .side-content { align-items: flex-end; }
.av-row { display: flex; align-items: center; gap: 6px; }
.side.R .av-row { flex-direction: row-reverse; }
.pname   { font-size: 14px; font-weight: 900; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.slot-nm { font-size: 10px; font-weight: 600; color: rgba(255,255,255,.7); }

/* winner/loser overlay styles — no resize, just overlay */
.loser-overlay {
  position: absolute; inset: 0; z-index: 3;
  background: rgba(7,9,15,.72);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  transition: opacity .5s ease;
}
.winner-glow {
  position: absolute; inset: 0; z-index: 4;
  border: 2px solid rgba(251,191,36,.5);
  pointer-events: none;
  box-shadow: inset 0 0 20px rgba(251,191,36,.08);
}

/* score badge */
.score-badge { position: absolute; top: 10px; font-size: 15px; font-weight: 900; border-radius: 9px; padding: 4px 10px; transition: all .45s ease; }
.score-badge.L { right: 10px; color: #22c55e; background: rgba(9,19,15,.82); border: 1px solid rgba(34,197,94,.3); }
.score-badge.R { left: 10px;  color: rgba(255,255,255,.3); background: rgba(7,9,15,.82); border: 1px solid rgba(255,255,255,.1); }
.score-badge.leading { color: #22c55e; }
.score-badge.gold { color: #fbbf24 !important; background: rgba(15,10,0,.88) !important; border-color: rgba(251,191,36,.45) !important; animation: scorePop .55s cubic-bezier(.34,1.5,.64,1) both; }

.vs-badge { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 30px; height: 30px; border-radius: 50%; background: #07090f; border: 1px solid rgba(255,255,255,.18); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; color: rgba(255,255,255,.4); z-index: 5; }

/* BUYS */
.buys-row { display: flex; border-top: 1px solid rgba(255,255,255,.07); }
.player-buys { flex: 1; padding: 8px 11px; display: flex; flex-direction: column; gap: 5px; }
.player-buys + .player-buys { border-left: 1px solid rgba(255,255,255,.07); }
.buy { display: flex; align-items: center; }
.buy-lbl   { font-size: 10px; font-weight: 700; color: #fff; margin-right: 6px; white-space: nowrap; flex-shrink: 0; }
.buy-bet   { font-size: 11px; font-weight: 700; color: #f59e0b; flex-shrink: 0; }
.buy-arrow { font-size: 11px; color: rgba(255,255,255,.2); margin: 0 5px; flex-shrink: 0; }
.buy-pay   { font-size: 15px; font-weight: 900; color: #fff; flex: 1; line-height: 1; }
.buy-pay.dim { color: rgba(255,255,255,.2); font-size: 13px; }
.buy-sep   { width: 1px; height: 13px; background: rgba(255,255,255,.12); margin: 0 6px; flex-shrink: 0; }
.buy-multi { font-size: 13px; font-weight: 900; color: #a78bfa; flex-shrink: 0; }
.buy-multi.gold { color: #fbbf24; }
.buy-multi.dim  { color: rgba(255,255,255,.15); }
.buy-bar  { height: 3px; background: rgba(255,255,255,.07); border-radius: 2px; margin-top: 2px; }
.buy-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg,#7c6fff,#a78bfa); transition: width .6s ease; }
.buy-fill.gold { background: linear-gradient(90deg,#f59e0b,#fbbf24); }

/* STATS */
.stats-row { display: flex; border-top: 1px solid rgba(255,255,255,.07); }
.stat { flex: 1; display: flex; align-items: center; gap: 6px; padding: 7px 8px; }
.stat + .stat { border-left: 1px solid rgba(255,255,255,.07); }
.stat-ico { width: 24px; height: 24px; border-radius: 7px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-txt { display: flex; flex-direction: column; gap: 1px; }
.stat-lbl { font-size: 9px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: .05em; }
.stat-val { font-size: 12px; font-weight: 900; color: #fff; line-height: 1; }
.stat-val.g { color: #22c55e; }
.stat-val.a { color: #f59e0b; }
.stat-val.m { color: rgba(255,255,255,.25); }

/* NEXT */
.next-lbl { display: flex; align-items: center; padding: 7px 14px 4px; flex-shrink: 0; }
.next-lbl-txt { font-size: 10px; font-weight: 700; color: rgba(255,255,255,.35); letter-spacing: .1em; text-transform: uppercase; }
.match-next { margin: 0 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,.07); overflow: hidden; opacity: .55; flex-shrink: 0; }
.next-inner { display: flex; align-items: center; }
.next-player { flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 11px; min-width: 0; }
.next-img { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(255,255,255,.1); }
.next-ph  { width: 36px; height: 36px; border-radius: 8px; background: #1a1d2e; border: 1px solid rgba(255,255,255,.07); flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.next-info { flex: 1; min-width: 0; }
.next-pname { font-size: 12px; font-weight: 800; color: rgba(255,255,255,.65); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.next-slot  { font-size: 10px; color: rgba(255,255,255,.3); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.next-vs { width: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; color: rgba(255,255,255,.2); background: rgba(255,255,255,.02); border-left: 1px solid rgba(255,255,255,.05); border-right: 1px solid rgba(255,255,255,.05); align-self: stretch; }

/* WAITING */
.waiting { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 8px; }
.waiting-title { font-size: 13px; font-weight: 700; color: rgba(255,255,255,.3); }
.waiting-sub   { font-size: 11px; color: rgba(255,255,255,.15); }

/* TABS */
.tabs { display: flex; border-top: 1px solid rgba(255,255,255,.06); margin-top: auto; }
.tab  { flex: 1; text-align: center; padding: 8px 0; font-size: 10px; font-weight: 700; color: rgba(255,255,255,.25); letter-spacing: .06em; text-transform: uppercase; }
.tab.on  { color: #a78bfa; border-top: 2px solid #a78bfa; margin-top: -1px; background: rgba(124,111,255,.04); }
.tab.won { color: #fbbf24; border-top: 2px solid #fbbf24; margin-top: -1px; background: rgba(251,191,36,.03); }

/* ENTER animation */
.match-enter { animation: slideUp .4s cubic-bezier(.34,1.2,.64,1); }

/* KEYFRAMES */
@keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.4} }
@keyframes blink    { 0%,100%{opacity:.15} 50%{opacity:.5} }
@keyframes slideUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
@keyframes scorePop { 0%{transform:scale(1)} 50%{transform:scale(1.18)} 75%{transform:scale(.96)} 100%{transform:scale(1)} }
@keyframes spin     { to{transform:rotate(360deg)} }
@keyframes floatDot { 0%,100%{transform:translateY(0) scale(1);opacity:.7} 50%{transform:translateY(-8px) scale(1.1);opacity:1} }
@keyframes champIn  { from{opacity:0;transform:scale(.96) translateY(8px)} to{opacity:1;transform:none} }
`

// ─── BuysList ─────────────────────────────────────────────────────────────
function BuysList({ comp, matchMaxPay, matchBestMulti }) {
  const { pays, bet } = useMemo(() => parseComp(comp), [comp])
  const count = Math.max(pays.length, 1)
  return (
    <div className="player-buys">
      {Array.from({ length: count }, (_, i) => {
        const val    = pays[i] || 0
        const multi  = bet > 0 && val > 0 ? val / bet : null
        const isGold = multi !== null && Math.abs(multi - matchBestMulti) < 0.001 && matchBestMulti > 0
        const pct    = matchMaxPay > 0 && val > 0 ? Math.min((val / matchMaxPay) * 100, 100) : 0
        return (
          <div key={i}>
            <div className="buy">
              <span className="buy-lbl">BUY {i + 1}</span>
              {bet > 0 && <span className="buy-bet">{fmtEur(bet)}</span>}
              <span className="buy-arrow">→</span>
              {val > 0 ? <span className="buy-pay">{fmtEur(val)}</span> : <span className="buy-pay dim">—</span>}
              <div className="buy-sep" style={{ opacity: val > 0 ? 1 : .2 }} />
              {multi !== null ? <span className={`buy-multi${isGold ? ' gold' : ''}`}>{fmtMulti(multi)}</span> : <span className="buy-multi dim">—</span>}
            </div>
            <div className="buy-bar">
              <div className={`buy-fill${isGold ? ' gold' : ''}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── PlayerSide ───────────────────────────────────────────────────────────
function PlayerSide({ comp, isRight, pic, isLeading, winnerAnim }) {
  const { best: bestMulti } = useMemo(() => parseComp(comp), [comp])
  const fadeStyle = isRight
    ? 'linear-gradient(to left, transparent 20%, #07090f 100%)'
    : 'linear-gradient(to right, transparent 20%, #07090f 100%)'
  const isWinner = winnerAnim === 'winner'
  const isLoser  = winnerAnim === 'loser'

  return (
    <div className={`side ${isRight ? 'R' : 'L'}`}>
      {comp?.slot?.image_url
        ? <img className="side-img" src={comp.slot.image_url} alt="" onError={e => { e.target.style.opacity = '.1' }} />
        : <div className="side-ph" style={{ background: 'linear-gradient(135deg,#1a1d3a,#12102a)' }} />
      }
      <div className="side-fade" style={{ background: fadeStyle, position: 'absolute', inset: 0 }} />
      <div className="side-fade-b" />

      {/* loser dark overlay */}
      {isLoser && <div className="loser-overlay" />}

      {/* winner border glow */}
      {isWinner && <div className="winner-glow" />}

      <div className="side-content">
        <div className="av-row">
          <TwitchAvatar username={comp?.player || '?'} src={pic} size={26} />
          <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <div className="pname">{comp?.player || '—'}</div>
            <ScrollText text={comp?.slot?.name || '—'} className="slot-nm" style={{ marginTop: 2 }} />
          </div>
        </div>
      </div>

      <div
        className={`score-badge ${isRight ? 'R' : 'L'}${isLeading && !winnerAnim ? ' leading' : ''}${isWinner ? ' gold' : ''}`}
        style={bestMulti === null ? { color: 'rgba(255,255,255,.2)' } : {}}
      >
        {bestMulti !== null ? fmtMulti(bestMulti) : '—'}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────
export default function TorneioOverlay() {
  const [tournament, setTournament] = useState(undefined)
  const [pics, setPics]             = useState({})
  const [displayMatch, setDisplayMatch] = useState(null)
  const [winnerState,  setWinnerState]  = useState(null)
  const [entering,     setEntering]     = useState(false)
  const [champion,     setChampion]     = useState(null) // { comp, pic }

  const HOLD_MS = 4000

  const prevLiveMatchKey  = useRef(null)
  const holdTimer         = useRef(null)
  const enterTimer        = useRef(null)
  const pendingLiveMatch  = useRef(null)   // what to show after hold ends
  const isHolding         = useRef(false)  // true while winner animation is active

  // ─── Fetch ─────────────────────────────────────────────────────────────
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
        if (toFetch.length > 0) {
          const newPics = {}
          await Promise.allSettled(toFetch.map(async u => {
            const pic = await getProfilePic(u)
            if (pic) newPics[u] = pic
          }))
          if (Object.keys(newPics).length > 0) setPics(prev => ({ ...prev, ...newPics }))
        }
      }
    }

    load()
    const ch = supabase.channel('torneio-final')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // ─── Scale OBS ─────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const scale = Math.min(window.innerWidth / 460, window.innerHeight / 480)
      document.documentElement.style.setProperty('--scale', scale)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // ─── Derived ───────────────────────────────────────────────────────────
  const bracket = tournament?.bracket || []
  const title   = tournament?.title || 'Tournament'

  const playableMatches = useMemo(() => {
    const result = []
    bracket.forEach((round, ri) => {
      round.forEach((match, mi) => {
        if (!match.winner && (match.a?.player || match.b?.player)) {
          result.push({ ...match, ri, mi })
        }
      })
    })
    return result
  }, [bracket])

  const liveMatch = playableMatches[0] || null
  const nextMatch = playableMatches[1] || null

  // detect champion — final match has a winner and no more playable matches
  useEffect(() => {
    if (!bracket.length) return
    const finalMatch = bracket[bracket.length - 1]?.[0]
    if (finalMatch?.winner && playableMatches.length === 0) {
      const champComp = finalMatch[finalMatch.winner]
      const champPic  = pics[champComp?.player?.toLowerCase()] || null
      setChampion({ comp: champComp, pic: champPic })
    } else {
      setChampion(null)
    }
  }, [bracket, playableMatches, pics])

  // ─── Winner hold system ─────────────────────────────────────────────────
  // When a match changes (new ri/mi), we:
  // 1. Capture the finished match data + winner from the bracket
  // 2. Keep displayMatch on the finished match for HOLD_MS with winner anim
  // 3. After HOLD_MS, show the new liveMatch with slide-in
  //
  // Key insight: pendingLiveMatch ref holds what comes next so the
  // setTimeout closure is never stale, even if liveMatch changes again.

  useEffect(() => {
    const key = liveMatch ? `${liveMatch.ri}-${liveMatch.mi}` : null

    // first load
    if (prevLiveMatchKey.current === null) {
      prevLiveMatchKey.current = key
      setDisplayMatch(liveMatch)
      return
    }

    // same match key — just update content (new buy registered)
    // but only if we're not in the middle of a hold animation
    if (key === prevLiveMatchKey.current) {
      if (!isHolding.current) setDisplayMatch(liveMatch)
      return
    }

    // match changed — find winner of the match that just finished
    const oldKey = prevLiveMatchKey.current
    prevLiveMatchKey.current = key
    pendingLiveMatch.current = liveMatch  // store for use in setTimeout

    if (oldKey) {
      const [oldRi, oldMi] = oldKey.split('-').map(Number)
      const finishedMatch  = bracket[oldRi]?.[oldMi]
      const winner         = finishedMatch?.winner || null

      clearTimeout(holdTimer.current)
      clearTimeout(enterTimer.current)

      if (winner) {
        isHolding.current = true
        setWinnerState(winner)
        // keep showing the finished match with winner/loser animation
        setDisplayMatch({ ...finishedMatch, ri: oldRi, mi: oldMi })

        holdTimer.current = setTimeout(() => {
          isHolding.current = false
          setWinnerState(null)
          // use the ref, not the closure value — guaranteed fresh
          setDisplayMatch(pendingLiveMatch.current)
          setEntering(true)
          enterTimer.current = setTimeout(() => setEntering(false), 500)
        }, HOLD_MS)
      } else {
        // no winner yet (manual override scenario) — switch immediately
        setDisplayMatch(liveMatch)
      }
    }
  }, [liveMatch?.ri, liveMatch?.mi])

  // when bracket updates mid-match (new buy) and we're not holding,
  // silently update the displayed match data
  useEffect(() => {
    if (isHolding.current) return
    if (!liveMatch) return
    setDisplayMatch(liveMatch)
  }, [bracket])

  // ─── Stats (memoized) ──────────────────────────────────────────────────
  const { totalMatches, doneMatches, globalTotalPay, globalBestM, prizePool } = useMemo(() => {
    const allComps = []
    bracket.forEach(r => r.forEach(m => {
      if (m.a?.player) allComps.push(m.a)
      if (m.b?.player) allComps.push(m.b)
    }))
    const parsed = allComps.map(c => parseComp(c))
    return {
      totalMatches:   bracket[0]?.length || 0,
      doneMatches:    bracket[0]?.filter(m => m.winner).length || 0,
      globalTotalPay: parsed.reduce((s, p) => s + p.total, 0),
      globalBestM:    parsed.reduce((best, p) => p.best !== null && p.best > best ? p.best : best, 0),
      prizePool:      parseFloat(tournament?.prize_pool) || allComps.reduce((s, c) => s + (parseFloat(c?.bet) || 0), 0),
    }
  }, [bracket, tournament?.prize_pool])

  const matchCalcs = useMemo(() => {
    const a = parseComp(displayMatch?.a)
    const b = parseComp(displayMatch?.b)
    const allPays = [...a.pays, ...b.pays]
    return {
      a, b,
      maxPay:      allPays.length ? Math.max(...allPays) : 1,
      bestMulti:   Math.max(a.best || 0, b.best || 0),
      leadSum:     a.total + b.total,
    }
  }, [displayMatch])

  const { a: compA, b: compB, maxPay, bestMulti: matchBestMulti, leadSum } = matchCalcs

  const showingWinner = !!winnerState
  const currentRi    = displayMatch?.ri ?? Math.max(0, bracket.length - 1)
  const isChampMode  = !!champion

  if (tournament === undefined) return <><style>{CSS}</style><div className="root-wrap"><div className="root" /></div></>

  return (
    <>
      <style>{CSS}</style>
      <div className="root-wrap">
        <div className="root">
          <div className="card">

            {/* HEADER */}
            <div className={`hd${isChampMode ? ' champ-mode' : ''}`}>
              {tournament ? <div className="live-dot" /> : <div className="wait-dot" />}
              <div className="hd-title">{title}</div>
              <div className={`hd-round${isChampMode ? ' champ' : ''}`}>
                {isChampMode ? 'Torneio Concluído' : roundLabel(currentRi, bracket.length)}
              </div>
            </div>

            {/* TOURNAMENT STATS */}
            <div className="t-stats">
              <div className="t-stat">
                <div className="t-ico" style={{ background: 'rgba(255,255,255,.07)' }}><IcoBar /></div>
                <div className="t-right"><div className="t-lbl">Matches</div><div className="t-val">{doneMatches}/{totalMatches}</div></div>
              </div>
              <div className="t-stat">
                <div className="t-ico" style={{ background: 'rgba(34,197,94,.12)' }}><IcoCoins color="#22c55e" /></div>
                <div className="t-right"><div className="t-lbl">Total Pay</div><div className={`t-val${globalTotalPay > 0 ? ' green' : ''}`}>{globalTotalPay > 0 ? fmtEur(globalTotalPay) : '—'}</div></div>
              </div>
              <div className="t-stat">
                <div className="t-ico" style={{ background: 'rgba(245,158,11,.12)' }}><IcoTrend color="#f59e0b" /></div>
                <div className="t-right"><div className="t-lbl">Best Multi</div><div className={`t-val${globalBestM > 0 ? ' amber' : ''}`}>{globalBestM > 0 ? fmtMulti(globalBestM) : '—'}</div></div>
              </div>
              <div className="t-stat">
                <div className="t-ico" style={{ background: 'rgba(124,111,255,.12)' }}><IcoTrophy /></div>
                <div className="t-right"><div className="t-lbl">Prize Pool</div><div className={`t-val${prizePool > 0 ? ' purple' : ''}`}>{prizePool > 0 ? fmtEur(prizePool) : '—'}</div></div>
              </div>
            </div>

            {/* ── CHAMPION SCREEN ── */}
            {isChampMode ? (
              <ChampionScreen comp={champion.comp} pic={champion.pic || pics[champion.comp?.player?.toLowerCase()] || null} />
            ) : !displayMatch ? (
              <div className="waiting">
                <div className="waiting-title">No active tournament</div>
                <div className="waiting-sub">Start a tournament in the dashboard</div>
              </div>
            ) : (
              <>
                <div className="section-lbl">
                  <div className="section-txt">{showingWinner ? 'Winner' : 'Current match'}</div>
                  <div className={`live-badge${showingWinner ? ' winner' : ''}`}>
                    {showingWinner ? 'WINNER' : '● Live'}
                  </div>
                </div>

                <div className={`match${showingWinner ? ' winner-mode' : ''}${entering ? ' match-enter' : ''}`}>
                  <div className="lead-bar">
                    <div className="lead-a" style={{ flex: leadSum > 0 ? compA.total || 0.01 : 1 }} />
                    <div className="lead-c" />
                    <div className="lead-b" style={{ flex: leadSum > 0 ? compB.total || 0.01 : 1 }} />
                  </div>

                  <div className="split-top">
                    <PlayerSide
                      comp={displayMatch.a}
                      isRight={false}
                      pic={pics[displayMatch.a?.player?.toLowerCase()] || null}
                      isLeading={compA.total >= compB.total}
                      winnerAnim={winnerState === 'a' ? 'winner' : winnerState === 'b' ? 'loser' : null}
                    />
                    <div className="vs-badge">VS</div>
                    <PlayerSide
                      comp={displayMatch.b}
                      isRight={true}
                      pic={pics[displayMatch.b?.player?.toLowerCase()] || null}
                      isLeading={compB.total > compA.total}
                      winnerAnim={winnerState === 'b' ? 'winner' : winnerState === 'a' ? 'loser' : null}
                    />
                  </div>

                  <div className="buys-row">
                    <BuysList comp={displayMatch.a} matchMaxPay={maxPay} matchBestMulti={matchBestMulti} />
                    <BuysList comp={displayMatch.b} matchMaxPay={maxPay} matchBestMulti={matchBestMulti} />
                  </div>

                  <div className="stats-row">
                    <div className="stat">
                      <div className="stat-ico" style={{ background: 'rgba(34,197,94,.1)' }}><IcoCoins color="#22c55e" /></div>
                      <div className="stat-txt"><div className="stat-lbl">Total A</div><div className={`stat-val${compA.total > 0 ? ' g' : ' m'}`}>{compA.total > 0 ? fmtEur(compA.total) : '—'}</div></div>
                    </div>
                    <div className="stat">
                      <div className="stat-ico" style={{ background: 'rgba(245,158,11,.1)' }}><IcoTrend color="#f59e0b" /></div>
                      <div className="stat-txt"><div className="stat-lbl">Avg A</div><div className={`stat-val${compA.avg !== null ? ' a' : ' m'}`}>{fmtMulti(compA.avg)}</div></div>
                    </div>
                    <div className="stat">
                      <div className="stat-ico" style={{ background: 'rgba(245,158,11,.1)' }}><IcoTrend color="#f59e0b" /></div>
                      <div className="stat-txt"><div className="stat-lbl">Avg B</div><div className={`stat-val${compB.avg !== null ? ' a' : ' m'}`}>{fmtMulti(compB.avg)}</div></div>
                    </div>
                    <div className="stat">
                      <div className="stat-ico" style={{ background: 'rgba(34,197,94,.1)' }}><IcoCoins color="#22c55e" /></div>
                      <div className="stat-txt"><div className="stat-lbl">Total B</div><div className={`stat-val${compB.total > 0 ? ' g' : ' m'}`}>{compB.total > 0 ? fmtEur(compB.total) : '—'}</div></div>
                    </div>
                  </div>
                </div>

                {nextMatch && !showingWinner && (
                  <>
                    <div className="next-lbl"><div className="next-lbl-txt">Next up</div></div>
                    <div className="match-next">
                      <div className="next-inner">
                        <div className="next-player">
                          {nextMatch.a?.slot?.image_url
                            ? <img className="next-img" src={nextMatch.a.slot.image_url} alt="" />
                            : <div className="next-ph"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/></svg></div>
                          }
                          <div className="next-info">
                            <div className="next-pname">{nextMatch.a?.player || '—'}</div>
                            <div className="next-slot">{nextMatch.a?.slot?.name || '—'}</div>
                          </div>
                        </div>
                        <div className="next-vs">VS</div>
                        <div className="next-player" style={{ flexDirection: 'row-reverse' }}>
                          {nextMatch.b?.slot?.image_url
                            ? <img className="next-img" src={nextMatch.b.slot.image_url} alt="" />
                            : <div className="next-ph"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/></svg></div>
                          }
                          <div className="next-info" style={{ textAlign: 'right' }}>
                            <div className="next-pname">{nextMatch.b?.player || '—'}</div>
                            <div className="next-slot">{nextMatch.b?.slot?.name || '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* TABS */}
            <div className="tabs">
              {bracket.map((_, i) => (
                <div key={i} className={`tab${isChampMode && i === bracket.length - 1 ? ' won' : currentRi === i && !isChampMode ? ' on' : ''}`}>
                  {roundLabel(i, bracket.length)}
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </>
  )
}