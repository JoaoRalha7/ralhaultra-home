import { useState, useEffect, useRef } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

const CHANNEL     = import.meta.env.VITE_TWITCH_CHANNEL || 'jralha_'
const GIVEAWAY_ID = 'main'
const CHANNEL_ID  = '216681327'
const SL_TOKEN    = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0b2tlbiI6IjVEMzBCQkM4M0NGQTM0NDAyOEJDIiwicmVhZF9vbmx5Ijp0cnVlLCJwcmV2ZW50X21hc3RlciI6dHJ1ZSwidHdpdGNoX2lkIjoiMjE2NjgxMzI3In0.4aN7Ia-OOMRloUXX7HxmZSYm-rqrGdcwn2t2NRtmlpk'

// ─── Helpers ──────────────────────────────────────────────────────────────
function hslFromName(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  // lightness 55% para evitar cores demasiado claras
  return `hsl(${h % 360}, 60%, 55%)`
}
function fmtTimer(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ─── Profile pic cache ────────────────────────────────────────────────────
const profileCache = {}

async function getProfilePic(username) {
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

async function preloadProfilePics(participants) {
  const BATCH = 8
  for (let i = 0; i < participants.length; i += BATCH) {
    await Promise.allSettled(participants.slice(i, i + BATCH).map(p => getProfilePic(p.username)))
  }
}

// ─── Badges ───────────────────────────────────────────────────────────────
const WORKER_URL = 'https://ralha-status.jppralha.workers.dev'
let badgeMap = {}

async function loadBadges() {
  try {
    const res  = await fetch(`${WORKER_URL}/badges`)
    const data = await res.json()
    if (data?.badges) badgeMap = data.badges
  } catch {}
}

function parseBadges(str) {
  if (!str || !Object.keys(badgeMap).length) return []
  return str.split(',').map(b => {
    const [set, ver] = b.split('/')
    const url = badgeMap[`${set}/${ver}`] || badgeMap[`${set}/0`] || badgeMap[`${set}/1`] || null
    return url ? { key: b, url } : null
  }).filter(Boolean)
}

// ─── Emote parser ─────────────────────────────────────────────────────────
// Converte a tag "emotes" do IRC + texto em array de parts: {type:'text',v} | {type:'emote',id,name}
function parseEmotes(text, emotesTag) {
  if (!emotesTag) return [{ type: 'text', v: text }]
  // emotes tag: "id:start-end,start-end/id2:start-end"
  const ranges = []
  for (const entry of emotesTag.split('/')) {
    const [id, positions] = entry.split(':')
    if (!id || !positions) continue
    for (const pos of positions.split(',')) {
      const [s, e] = pos.split('-').map(Number)
      ranges.push({ id, s, e, name: text.slice(s, e + 1) })
    }
  }
  if (!ranges.length) return [{ type: 'text', v: text }]
  ranges.sort((a, b) => a.s - b.s)
  const parts = []
  let cursor = 0
  for (const r of ranges) {
    if (r.s > cursor) parts.push({ type: 'text', v: text.slice(cursor, r.s) })
    parts.push({ type: 'emote', id: r.id, name: r.name })
    cursor = r.e + 1
  }
  if (cursor < text.length) parts.push({ type: 'text', v: text.slice(cursor) })
  return parts
}

// ─── TwitchAvatar ─────────────────────────────────────────────────────────
function TwitchAvatar({ username, color, size = 42 }) {
  const [src, setSrc] = useState(() => profileCache[username] || null)
  useEffect(() => {
    if (profileCache[username]) { setSrc(profileCache[username]); return }
    getProfilePic(username).then(url => { if (url) setSrc(url) })
  }, [username])

  const style = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    border: `2px solid ${color}40`,
  }
  if (src) return <img src={src} alt={username} style={{ ...style, objectFit: 'cover' }} />
  return (
    <div style={{
      ...style,
      background: `${color}25`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: size * 0.4, color,
    }}>
      {username?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

// ─── RouletteAvatar — sem useState para não re-render durante animação ────
function RouletteAvatar({ username, color, size = 52 }) {
  const src = profileCache[username] || null
  const style = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    border: `2px solid ${color}40`,
  }
  if (src) return <img src={src} alt={username} style={{ ...style, objectFit: 'cover' }} />
  return (
    <div style={{
      ...style,
      background: `${color}25`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: size * 0.38, color,
    }}>
      {username?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

// ─── Roulette ─────────────────────────────────────────────────────────────
function Roulette({ participants, onDone }) {
  const [offset, setOffset] = useState(0)
  const [winner, setWinner] = useState(null)
  const [phase,  setPhase]  = useState('loading')
  const [items,  setItems]  = useState([])
  const animRef = useRef(null)
  const ITEM_W  = 160
  const VISIBLE = 5
  const CENTER  = 2

  useEffect(() => {
    preloadProfilePics(participants).then(() => {
      // garante items suficientes para o finalOff não cortar
      const minItems = Math.max(120, participants.length * 10)
      const rep = []
      for (let i = 0; i < minItems; i++) rep.push(participants[i % participants.length])
      setItems(rep)
      setPhase('idle')
      setTimeout(() => doSpin(rep, participants), 600)
    })
  }, [])

  const doSpin = (itemList, parts) => {
    setPhase('spinning')
    const winIdx    = Math.floor(Math.random() * parts.length)
    const anchorIdx = Math.floor(itemList.length * 0.72) - (Math.floor(itemList.length * 0.72) % parts.length) + winIdx
    const finalOff  = anchorIdx * ITEM_W - CENTER * ITEM_W
    const start     = performance.now()
    const ease      = t => 1 - Math.pow(1 - t, 4)
    const step      = now => {
      const p = Math.min((now - start) / 5500, 1)
      setOffset(finalOff * ease(p))
      if (p < 1) {
        animRef.current = requestAnimationFrame(step)
      } else {
        setOffset(finalOff)
        setWinner(parts[winIdx])
        setPhase('done')
        // passa o vencedor diretamente ao onDone — não depende de Supabase
        setTimeout(() => onDone(parts[winIdx]), 7000)
      }
    }
    animRef.current = requestAnimationFrame(step)
  }

  useEffect(() => () => cancelAnimationFrame(animRef.current), [])

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(4,6,12,.97)', borderRadius: 16,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 20, fontFamily: 'Rubik,sans-serif', animation: 'fadeIn .3s ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/>
            <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
          </svg>
          <span style={{
            fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '.07em', textTransform: 'uppercase',
            animation: phase === 'spinning' ? 'textPulse 1s ease-in-out infinite' : 'none',
          }}>
            {phase === 'loading' ? 'Preparing...' : phase === 'done' ? 'Winner!' : 'Drawing...'}
          </span>
        </div>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', fontWeight: 500 }}>
          {participants.length} participants
        </span>
      </div>

      {/* Loading dots */}
      {phase === 'loading' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: '50%', background: '#34d399',
              animation: `dotPulse 1s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      )}

      {/* Track */}
      {phase !== 'loading' && (
        <div style={{
          position: 'relative', width: ITEM_W * VISIBLE, height: 110,
          borderRadius: 12, overflow: 'hidden',
          background: 'rgba(255,255,255,.025)',
          border: '1px solid rgba(255,255,255,.05)',
        }}>
          {/* centro highlight */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: CENTER * ITEM_W, width: ITEM_W,
            background: 'rgba(52,211,153,.06)',
            border: '2px solid rgba(52,211,153,.28)',
            borderRadius: 10, zIndex: 2,
          }} />
          {/* fade lateral */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg,rgba(4,6,12,1) 0%,transparent 20%,transparent 80%,rgba(4,6,12,1) 100%)',
            zIndex: 3, pointerEvents: 'none',
          }} />
          {/* seta cima */}
          <div style={{
            position: 'absolute', top: -1, left: CENTER * ITEM_W + ITEM_W / 2 - 7, zIndex: 4,
            width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '10px solid #34d399',
          }} />
          {/* seta baixo */}
          <div style={{
            position: 'absolute', bottom: -1, left: CENTER * ITEM_W + ITEM_W / 2 - 7, zIndex: 4,
            width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: '10px solid #34d399',
          }} />
          {/* itens */}
          <div style={{
            display: 'flex', alignItems: 'center', height: '100%',
            transform: `translateX(${-offset}px)`, willChange: 'transform',
          }}>
            {items.map((p, i) => (
              <div key={i} style={{
                width: ITEM_W, flexShrink: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                padding: '0 4px',
              }}>
                <RouletteAvatar username={p.username} color={p.color} />
                <span style={{
                  fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.65)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  maxWidth: ITEM_W - 8, textAlign: 'center',
                }}>{p.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Winner card */}
      {winner && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 18,
          padding: '16px 32px', borderRadius: 18,
          background: 'rgba(52,211,153,.08)', border: '1px solid rgba(52,211,153,.25)',
          animation: 'winPop .5s cubic-bezier(.34,1.56,.64,1)',
        }}>
          <TwitchAvatar username={winner.username} color={winner.color} size={64} />
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>
              Vencedor
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginTop: 2 }}>
              {winner.username}
            </div>
          </div>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
      )}
    </div>
  )
}

// ─── CSS ──────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;900&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: transparent !important; overflow: hidden; width: 100%; height: 100%; }

.root-wrap {
  width: 100vw; height: 100vh;
  display: flex; align-items: flex-end; justify-content: flex-start;
}

.root {
  width: 470px; height: 500px;
  transform-origin: bottom left;
  transform: scale(var(--scale, 1));
  position: relative;
  font-family: 'Rubik', sans-serif;
  background: #07090f;
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: geometricPrecision;
}

/* ── MENSAGENS ── */
.msgs {
  flex: 1;
  overflow-y: auto; overflow-x: hidden;
  padding: 8px 0 6px;
  display: flex; flex-direction: column; justify-content: flex-end; gap: 2px;
  scrollbar-width: none;
  will-change: transform;
}
.msgs::-webkit-scrollbar { display: none; }

.msg {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  padding: 3px 16px;
  line-height: 1.75;
  animation: msgIn .15s ease;
  word-wrap: break-word;
  overflow-wrap: break-word;
  text-shadow: 0 1px 2px rgba(0,0,0,.6);
  gap: 0;
}
.msg-badges { display: inline-flex; align-items: center; gap: 3px; margin-right: 5px; flex-shrink: 0; align-self: center; }
.msg-badge {
  width: 17px; height: 17px; border-radius: 2px;
  display: block; flex-shrink: 0;
}
.msg-name  { font-size: 16px; font-weight: 700; flex-shrink: 0; }
.msg-colon { font-size: 16px; color: rgba(255,255,255,.25); margin: 0 4px; flex-shrink: 0; }
.msg-text  { font-size: 16px; color: #e2e4ec; word-break: break-word; min-width: 0; display: inline; line-height: 1.75; }

/* giveaway entry highlight */
.msg.gw-msg {
  border-left: 2px solid rgba(52,211,153,.45);
  padding-left: 14px;
  background: rgba(52,211,153,.04);
}
.msg.gw-msg .msg-text { color: #34d399; font-weight: 600; }

/* winner highlight */
.msg.winner-msg {
  border-left: 2px solid rgba(251,191,36,.55);
  padding-left: 14px;
  background: rgba(251,191,36,.05);
}
.msg.winner-msg .msg-name { text-shadow: 0 0 10px rgba(251,191,36,.4); }

/* ── EVENTOS ── */
.ev-inline {
  margin: 5px 12px;
  border-radius: 11px;
  padding: 9px 14px;
  display: flex; align-items: center; gap: 11px;
  animation: msgIn .2s ease;
}
.ev-inline.follow { background: rgba(52,211,153,.07);  border: 1px solid rgba(52,211,153,.15); }
.ev-inline.sub    { background: rgba(167,139,250,.07); border: 1px solid rgba(167,139,250,.15); }
.ev-inline.raid   { background: rgba(251,191,36,.07);  border: 1px solid rgba(251,191,36,.15); }

.ev-name { font-size: 14px; font-weight: 800; }
.ev-inline.follow .ev-name { color: #34d399; }
.ev-inline.sub    .ev-name { color: #a78bfa; }
.ev-inline.raid   .ev-name { color: #fbbf24; }
.ev-label { font-size: 13px; color: #b0b4c0; margin-top: 1px; }

/* ── GIVEAWAY BAR ── */
.gw {
  position: absolute; top: 0; left: 0; right: 0; z-index: 10;
  background: linear-gradient(90deg, #031a0f 0%, #052b18 50%, #031a0f 100%);
  border-bottom: 1px solid rgba(52,211,153,.15);
  padding: 10px 16px;
}
.gw.entering { animation: gwIn .45s cubic-bezier(.34,1.4,.64,1); }
.gw.leaving  { animation: gwOut .35s ease forwards; }

.gw-inner {
  display: flex; align-items: center; gap: 8px;
}
.gw-text {
  font-size: 13px; color: rgba(255,255,255,.35); font-weight: 500;
}
.gw-keyword {
  background: rgba(52,211,153,.12);
  border: 1px solid rgba(52,211,153,.3);
  border-radius: 8px;
  padding: 3px 10px;
  font-size: 13px; font-weight: 800; color: #34d399; letter-spacing: .04em;
}
.gw-spacer { flex: 1; }
.gw-pill {
  display: flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 20px; padding: 4px 10px;
  flex-shrink: 0;
}
.gw-pill-n { font-size: 14px; font-weight: 800; color: #fff; }
.gw-pill-sep { width: 1px; height: 12px; background: rgba(255,255,255,.15); }
.gw-pill-t { font-size: 14px; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; }
.gw-pill-t.ending { color: #f87171; animation: blink .6s ease-in-out infinite; }
.gw-pill-t.done   { color: rgba(255,255,255,.3); }

/* ── ANIMAÇÕES ── */
@keyframes msgIn     { from { opacity:0; transform:translateY(3px) } to { opacity:1; transform:none } }
@keyframes gwIn      { from { opacity:0; transform:translateY(-110%) } to { opacity:1; transform:translateY(0) } }
@keyframes gwOut     { from { opacity:1; transform:translateY(0) } to { opacity:0; transform:translateY(-110%) } }
@keyframes fadeIn    { from { opacity:0 } to { opacity:1 } }
@keyframes winPop    { from { opacity:0; transform:scale(.88) translateY(8px) } to { opacity:1; transform:none } }
@keyframes blink     { 0%,100%{opacity:1} 50%{opacity:.35} }
@keyframes textPulse { 0%,100%{opacity:.5} 50%{opacity:1} }
@keyframes dotPulse  { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:1;transform:scale(1.2)} }
`

// SVG icons para eventos
const IconFollow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M19 8v6"/><path d="M22 11h-6"/>
  </svg>
)
const IconSub = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)
const IconRaid = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)
const IconGift = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/>
    <path d="M12 22V7"/>
    <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
    <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
  </svg>
)
const IconUsers = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)

// ─── Main ─────────────────────────────────────────────────────────────────
export default function ChatBox() {
  const [items,    setItems]    = useState([])
  const [winnerHL, setWinnerHL] = useState(null)
  const winnerHLRef = useRef(null)

  const [gw,        setGw]        = useState({ active: false, keyword: '', ends_at: null, spinning: false, participants: [] })
  const [gwLeaving, setGwLeaving] = useState(false)
  const [partCount, setPartCount] = useState(0)
  const [countdown, setCountdown] = useState(0)

  const endRef      = useRef(null)
  const partSet     = useRef(new Set())
  const seenIds     = useRef(new Set())
  const gwRef       = useRef(gw)
  const spinDoneRef  = useRef(false)
  const seenEvents   = useRef(new Map())
  gwRef.current     = gw

  useEffect(() => { loadBadges() }, [])

  // ── Supabase polling ──────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('giveaway_state')
        .select('active,keyword,ends_at,spinning,participants,winner')
        .eq('id', GIVEAWAY_ID).single()
      if (!data) return
      // se já terminámos a roleta localmente E o Supabase ainda tem spinning:true
      // E winner ainda não foi gravado (null) — significa novo sorteio, reseta
      if (spinDoneRef.current && data.spinning) {
        if (data.winner === null) {
          // novo sorteio — aceita
          spinDoneRef.current = false
        } else {
          // ainda é o sorteio anterior — ignora
          return
        }
      }
      setGw(prev => {
        if (prev.active && !data.active) {
          setGwLeaving(true)
          setTimeout(() => setGwLeaving(false), 400)
          partSet.current.clear(); setPartCount(0)
          spinDoneRef.current = false
        }
        if (!prev.active && data.active) {
          partSet.current.clear(); setPartCount(0)
          spinDoneRef.current = false
        }
        if (!prev.spinning && data.spinning) {
          spinDoneRef.current = false
        }
        return data
      })
    }
    load()
    const t = setInterval(load, 1500)
    return () => clearInterval(t)
  }, [])

  // ── Countdown ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gw.active || !gw.ends_at) { setCountdown(0); return }
    const tick = () => setCountdown(Math.max(0, Math.floor((new Date(gw.ends_at) - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 500)
    return () => clearInterval(t)
  }, [gw.active, gw.ends_at])

  // ── addItem ────────────────────────────────────────────────────────────
  const addItem = (item) => {
    setItems(prev => {
      if (item.id && prev.some(m => m.id === item.id)) return prev
      const next = [...prev, item]
      return next.length > 80 ? next.slice(-80) : next
    })
  }

  // ── Twitch IRC ─────────────────────────────────────────────────────────
  useEffect(() => {
    let ws, retryTimer
    const connect = () => {
      ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443')
      ws.onopen = () => {
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands')
        ws.send('PASS oauth:ralhaoverlayanon2026')
        ws.send('NICK justinfan12345')
        ws.send(`JOIN #${CHANNEL.toLowerCase()}`)
      }
      ws.onmessage = (e) => {
        const lines = String(e.data).split('\r\n').filter(Boolean)
        for (const line of lines) {
          if (line.includes('PING')) { ws.send('PONG :tmi.twitch.tv'); continue }
          const match = line.match(/^@([^ ]+) :([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.+)/)
          if (!match) continue
          const tags   = Object.fromEntries(match[1].split(';').map(kv => { const [k, ...v] = kv.split('='); return [k, v.join('=')] }))
          const msgId  = tags['id'] || null
          if (msgId) {
            if (seenIds.current.has(msgId)) continue
            seenIds.current.add(msgId)
            // ring buffer: limpa bloco de 100 quando passa de 600
            if (seenIds.current.size > 600) {
              const it = seenIds.current.values()
              for (let i = 0; i < 100; i++) seenIds.current.delete(it.next().value)
            }
          }
          const username = match[2]
          const text     = match[3].trim()
          const color    = (tags['color'] && tags['color'] !== '') ? tags['color'] : hslFromName(username)
          const badges   = parseBadges(tags['badges'] || '')
          const parts    = parseEmotes(text, tags['emotes'] || '')
          const cur      = gwRef.current
          const isGw     = cur.active && text.toLowerCase() === (cur.keyword || '').toLowerCase()
          if (isGw) {
            const key = username.toLowerCase()
            if (!partSet.current.has(key)) { partSet.current.add(key); setPartCount(n => n + 1) }
          }
          let isWinner = false
          const hl = winnerHLRef.current
          if (hl && hl.username === username.toLowerCase() && hl.count > 0) {
            isWinner = true
            const newCount = hl.count - 1
            const newHL = newCount > 0 ? { ...hl, count: newCount } : null
            winnerHLRef.current = newHL
            setWinnerHL(newHL)
          }
          addItem({ kind: 'msg', id: msgId || `${Date.now()}-${Math.random()}`, username, text, parts, color, badges, isGw, isWinner })
        }
      }
      ws.onclose = () => { retryTimer = setTimeout(connect, 3000) }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => { clearTimeout(retryTimer); ws?.close() }
  }, [])

  // ── StreamLabs eventos ─────────────────────────────────────────────────
  useEffect(() => {
    let ws, retryTimer, pingTimer
    // seenEvents é um ref — persiste entre reconexões
    const handleEvent = (evName, data) => {
      if (evName !== 'event') return
      const type = data?.type
      const msg  = data?.message?.[0]
      if (!msg) return
      const username = msg.name || msg.from || '?'
      const key = `${type}-${username.toLowerCase()}`
      const now = Date.now()
      if (now - (seenEvents.current.get(key) || 0) < 120000) return
      seenEvents.current.set(key, now)
      const id = `ev-${Date.now()}-${Math.random()}`
      if (type === 'follow')
        addItem({ kind: 'event', id, evType: 'follow', username })
      if (type === 'subscription' || type === 'resub')
        addItem({ kind: 'event', id, evType: 'sub', username })
      if (type === 'raid')
        addItem({ kind: 'event', id, evType: 'raid', username, viewers: msg.raiders || msg.viewerCount || 0 })
    }
    const connect = () => {
      ws = new WebSocket(`wss://sockets.streamlabs.com/socket.io/?token=${SL_TOKEN}&EIO=3&transport=websocket`)
      ws.onmessage = (e) => {
        const raw = String(e.data)
        if (raw === '2') { ws.send('3'); return }
        if (raw.startsWith('0{')) {
          try {
            const d = JSON.parse(raw.slice(1))
            if (d.pingInterval) pingTimer = setInterval(() => { if (ws.readyState === 1) ws.send('2') }, d.pingInterval)
          } catch {}
          return
        }
        if (raw.startsWith('42')) {
          try { const p = JSON.parse(raw.slice(2)); handleEvent(p[0], p[1]) } catch {}
        }
      }
      ws.onclose = () => { clearInterval(pingTimer); retryTimer = setTimeout(connect, 4000) }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => { clearTimeout(retryTimer); clearInterval(pingTimer); ws?.close() }
  }, [])

  // ── Scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [items])

  // ── Roulette done ──────────────────────────────────────────────────────
  const handleRouletteDone = async (winnerObj) => {
    // highlight no chat
    if (winnerObj?.username) {
      const hl = { username: winnerObj.username.toLowerCase(), count: 3 }
      winnerHLRef.current = hl
      setWinnerHL(hl)
    }
    // grava no Supabase com retry (até 5 tentativas)
    for (let i = 0; i < 5; i++) {
      const { error } = await supabase
        .from('giveaway_state')
        .update({ spinning: false, winner: winnerObj?.username || null })
        .eq('id', GIVEAWAY_ID)
      if (!error) break
      await new Promise(r => setTimeout(r, 500))
    }
    spinDoneRef.current = true
    setGw(prev => ({ ...prev, spinning: false }))
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const isEnding    = countdown > 0 && countdown <= 30
  const isDone      = gw.active && countdown === 0
  const participants = Array.isArray(gw.participants) ? gw.participants : []
  const showGw      = gw.active || gwLeaving
  const GW_H = 46

  useEffect(() => {
    const update = () => {
      const scaleX = window.innerWidth  / 470
      const scaleY = window.innerHeight / 500
      const scale  = Math.min(scaleX, scaleY)
      document.documentElement.style.setProperty('--scale', scale)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <>
      <style>{CSS}</style>
      <div className="root-wrap">
      <div className="root">

        {/* MESSAGES + EVENTS */}
        <div className="msgs" style={{ paddingTop: showGw ? GW_H + 10 : 8 }}>
          {items.map(item => {
            if (item.kind === 'msg') {
              const cls = `msg${item.isGw ? ' gw-msg' : ''}${item.isWinner ? ' winner-msg' : ''}`
              return (
                <div className={cls} key={item.id}>
                  {item.badges?.length > 0 && (
                    <span className="msg-badges">
                      {item.badges.map(b => <img key={b.key} className="msg-badge" src={b.url} alt="" />)}
                    </span>
                  )}
                  <span className="msg-name" style={{ color: item.color }}>{item.username}</span>
                  <span className="msg-colon">:</span>
                  <span className="msg-text">
                    {item.parts.map((p, i) =>
                      p.type === 'emote'
                        ? <img key={i} src={`https://static-cdn.jtvnw.net/emoticons/v2/${p.id}/default/dark/1.0`} alt={p.name} title={p.name} style={{ width: 22, height: 22, display: 'inline', verticalAlign: 'middle', margin: '0 2px' }} />
                        : <span key={i}>{p.v}</span>
                    )}
                  </span>
                </div>
              )
            }

            if (item.kind === 'event') {
              const t = item.evType
              const label =
                t === 'follow' ? 'just followed!' :
                t === 'sub'    ? 'just subscribed!' :
                `raided with ${item.viewers} viewers!`
              return (
                <div className={`ev-inline ${t}`} key={item.id}>
                  <TwitchAvatar
                    username={item.username}
                    color={t==='follow' ? '#34d399' : t==='sub' ? '#a78bfa' : '#fbbf24'}
                    size={38}
                  />
                  <div>
                    <div className="ev-name">{item.username}</div>
                    <div className="ev-label">{label}</div>
                  </div>
                </div>
              )
            }
            return null
          })}
          <div ref={endRef} />
        </div>

        {/* GIVEAWAY BAR */}
        {showGw && (
          <div className={`gw${gwLeaving ? ' leaving' : ' entering'}`}>
            <div className="gw-inner">
              <IconGift />
              <span className="gw-text">type</span>
              <span className="gw-keyword">{gw.keyword}</span>
              <span className="gw-text">to join!</span>
              <div className="gw-spacer" />
              <div className="gw-pill">
                <IconUsers />
                <span className="gw-pill-n">{partCount}</span>
                <div className="gw-pill-sep" />
                <IconClock />
                <span className={`gw-pill-t${isEnding ? ' ending' : isDone ? ' done' : ''}`}>
                  {fmtTimer(countdown)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ROLETA */}
        {gw.spinning && participants.length > 0 && (
          <Roulette participants={participants} onDone={handleRouletteDone} />
        )}

      </div>
      </div>
    </>
  )
}