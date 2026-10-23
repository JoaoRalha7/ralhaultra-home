import { useState, useEffect, useRef } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

const CHANNEL     = import.meta.env.VITE_TWITCH_CHANNEL || 'jralha_'
const SL_TOKEN    = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0b2tlbiI6IjVEMzBCQkM4M0NGQTM0NDAyOEJDIiwicmVhZF9vbmx5Ijp0cnVlLCJwcmV2ZW50X21hc3RlciI6dHJ1ZSwidHdpdGNoX2lkIjoiMjE2NjgxMzI3In0.4aN7Ia-OOMRloUXX7HxmZSYm-rqrGdcwn2t2NRtmlpk'
const WORKER_URL  = 'https://ralha-status.jppralha.workers.dev'
const GIVEAWAY_ID = 'main'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hslFromName(name) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return `hsl(${h % 360}, 60%, 65%)`
}
function fmtTimer(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

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

function parseEmotes(text, emotesTag) {
  if (!emotesTag) return [{ type: 'text', v: text }]
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
  const parts = []; let cursor = 0
  for (const r of ranges) {
    if (r.s > cursor) parts.push({ type: 'text', v: text.slice(cursor, r.s) })
    parts.push({ type: 'emote', id: r.id, name: r.name })
    cursor = r.e + 1
  }
  if (cursor < text.length) parts.push({ type: 'text', v: text.slice(cursor) })
  return parts
}

// ─── Profile pic cache (para roleta) ─────────────────────────────────────────
const profileCache = {}
async function getProfilePic(username) {
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
async function preloadProfilePics(participants) {
  const BATCH = 8
  for (let i = 0; i < participants.length; i += BATCH)
    await Promise.allSettled(participants.slice(i, i + BATCH).map(p => getProfilePic(p.username)))
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IconChat    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
const IconAddUser = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
const IconGift    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
const IconUsers   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const IconClock   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>

// ─── Promo Banners (Imagens) ──────────────────────────────────────────────────
const BANNERS = [
  { id: 'marca1', src: 'https://exemplo.com/banner-marca1.jpg', alt: 'Promoção Marca 1' },
  { id: 'lab',    src: '/lab-visuals-banner.png',               alt: 'The L.A.B. Visuals' },
  { id: 'foto',   src: '/minha-foto-promo.jpg',                 alt: 'Redes Sociais' }
]

// ─── Promo Banners Dinâmicos (Supabase) ───────────────────────────────────────
function PromoBanners() {
  const [banners, setBanners] = useState([])
  const [current, setCurrent] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  // Vai buscar os banners ativos ao Supabase
  useEffect(() => {
    const fetchBanners = async () => {
      const { data } = await supabase
        .from('promo_banners')
        .select('*')
        .eq('active', true)
        .order('order', { ascending: true })

      if (data) setBanners(data)
    }

    fetchBanners()
    // Atualiza a lista a cada 30 segundos (sem precisares de mexer no OBS)
    const poll = setInterval(fetchBanners, 30000)
    return () => clearInterval(poll)
  }, [])

  // Controla a rotação respeitando os segundos de duração de cada banner
  useEffect(() => {
    if (banners.length <= 1) return

    const currentBanner = banners[current]
    // Se o banner não tiver duração definida, assume 10s por defeito
    const durationMs = (currentBanner?.duration || 10) * 1000

    const id = setTimeout(() => {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrent(p => (p + 1) % banners.length)
        setIsAnimating(false)
      }, 400) // Tempo da transição (fade)
    }, durationMs)

    return () => clearTimeout(id)
  }, [current, banners])

  // Se não houver banners ativos, não mostra nada
  if (banners.length === 0) return null

  // Garante que o index não rebenta se apagares banners a meio
  const safeCurrent = current >= banners.length ? 0 : current
  const banner = banners[safeCurrent]
  const isVideo = banner.media_type === 'video'

  return (
    <div className="promo-container">
      <div className={`banner-card ${isAnimating ? 'fade-out' : 'fade-in'}`}>
        
        {isVideo ? (
          <video src={banner.media_url} autoPlay loop muted playsInline className="banner-image" />
        ) : (
          <img src={banner.media_url} alt="Promo" className="banner-image" />
        )}
        
        {/* Barra de progresso dinâmica */}
        {banners.length > 1 && (
          <div className="promo-progress-bar">
            <div 
              className="promo-progress-fill" 
              key={banner.id + safeCurrent} 
              style={{ animationDuration: `${banner.duration || 10}s` }} 
            />
          </div>
        )}
      </div>
    </div>
  )
}
// ─── TwitchAvatar ─────────────────────────────────────────────────────────────
function TwitchAvatar({ username, color, size = 42 }) {
  const [src, setSrc] = useState(() => profileCache[username] || null)
  useEffect(() => {
    if (profileCache[username]) { setSrc(profileCache[username]); return }
    getProfilePic(username).then(url => { if (url) setSrc(url) })
  }, [username])
  const style = { width: size, height: size, borderRadius: '50%', flexShrink: 0, border: `2px solid ${color}40` }
  if (src) return <img src={src} alt={username} style={{ ...style, objectFit: 'cover' }} />
  return <div style={{ ...style, background: `${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: size * 0.4, color }}>{username?.[0]?.toUpperCase() || '?'}</div>
}

// ─── RouletteAvatar (sem useState para não re-render durante animação) ─────────
function RouletteAvatar({ username, color, size = 52 }) {
  const src = profileCache[username] || null
  const style = { width: size, height: size, borderRadius: '50%', flexShrink: 0, border: `2px solid ${color}40` }
  if (src) return <img src={src} alt={username} style={{ ...style, objectFit: 'cover' }} />
  return <div style={{ ...style, background: `${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: size * 0.38, color }}>{username?.[0]?.toUpperCase() || '?'}</div>
}

// ─── Prize card (image or auto-fit text) ─────────────────────────────────────
function PrizeCard({ prize, image, size = 92 }) {
  const txt = String(prize || '').trim()
  const fs = txt.length <= 6 ? 0.24 : txt.length <= 10 ? 0.19 : txt.length <= 16 ? 0.15 : 0.12
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.26, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,.45)', overflow: 'hidden', flexShrink: 0, position: 'relative', zIndex: 2 }}>
      {image
        ? <img src={image} alt="" style={{ width: '82%', height: '82%', objectFit: 'contain' }} />
        : txt
          ? <div style={{ padding: 6, textAlign: 'center', fontWeight: 900, fontSize: size * fs, lineHeight: 1.08, color: '#052e1c', textTransform: 'uppercase', wordBreak: 'break-word' }}>{txt}</div>
          : <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>}
    </div>
  )
}

function Rays({ size = 220, style }) {
  return (
    <svg className="gw-rays" width={size} height={size} viewBox="-100 -100 200 200" style={style}>
      <g fill="#34d399" fillOpacity=".16">{Array.from({ length: 12 }, (_, i) => <path key={i} transform={`rotate(${i * 30})`} d="M0 0L-13 -100L13 -100z" />)}</g>
    </svg>
  )
}

function Confetti() {
  const cols = ['#fbbf24', '#34d399', '#f472b6', '#60a5fa', '#fff']
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
      {Array.from({ length: 26 }, (_, i) => (
        <i key={i} style={{ position: 'absolute', top: -16, left: `${(i * 37) % 100}%`, width: 7, height: 12, borderRadius: 2, background: cols[i % 5], animation: `confFall 3s linear ${-(i % 9) * 0.35}s infinite` }} />
      ))}
    </div>
  )
}

// ─── Roulette (vertical reel, fits the narrow sidebar) ───────────────────────
function Roulette({ participants, prize, prizeImage, replySecs, onDone, onClose, lastMsgOf }) {
  const [phase, setPhase]   = useState('loading')   // loading | spinning | picked | winner
  const [winner, setWinner] = useState(null)
  const [items, setItems]   = useState([])
  const [left, setLeft]     = useState(replySecs)
  const [replied, setReplied] = useState(false)
  const listRef = useRef(null)
  const rafRef  = useRef(null)
  const ROW_H = 58, VISIBLE = 3, CENTER = 1

  useEffect(() => {
    let dead = false
    Promise.race([preloadProfilePics(participants), new Promise(r => setTimeout(r, 3000))]).then(() => {
      if (dead) return
      const n = participants.length
      const len = Math.max(60, n * 8)
      const rep = []
      for (let i = 0; i < len; i++) rep.push(participants[i % n])
      setItems(rep); setPhase('spinning')
      setTimeout(() => !dead && doSpin(rep, participants), 700)
    })
    return () => { dead = true; cancelAnimationFrame(rafRef.current) }
  }, [])

  const doSpin = (list, parts) => {
    const rnd = new Uint32Array(1); crypto.getRandomValues(rnd)
    const winIdx = rnd[0] % parts.length
    const base = Math.floor(list.length * 0.75)
    const anchor = base - (base % parts.length) + winIdx
    const finalY = -(anchor - CENTER) * ROW_H
    const start = performance.now(), D = 5500
    const step = now => {
      const p = Math.min((now - start) / D, 1)
      const e = 1 - Math.pow(1 - p, 4)
      const el = listRef.current
      if (el) { el.style.transform = `translateY(${finalY * e}px)`; el.style.filter = p < 0.8 ? `blur(${(1 - e) * 1.8}px)` : 'none' }
      if (p < 1) { rafRef.current = requestAnimationFrame(step); return }
      setWinner(parts[winIdx]); setPhase('picked')
      onDone(parts[winIdx])
      setTimeout(() => setPhase('winner'), 2200)
    }
    rafRef.current = requestAnimationFrame(step)
  }

  // winner screen: waits for the winner to reply in chat
  useEffect(() => {
    if (phase !== 'winner' || !winner) return
    const t0 = Date.now()
    let closeT
    const tick = setInterval(() => {
      if (replySecs > 0) {
        const r = Math.max(0, replySecs - Math.floor((Date.now() - t0) / 1000))
        setLeft(r)
        if (lastMsgOf(winner.username) > t0 && !replied) { setReplied(true); clearInterval(tick); closeT = setTimeout(onClose, 7000) }
        else if (r === 0) { clearInterval(tick); closeT = setTimeout(onClose, 9000) }
      }
    }, 400)
    const hard = replySecs > 0 ? null : setTimeout(onClose, 12000)
    return () => { clearInterval(tick); clearTimeout(closeT); if (hard) clearTimeout(hard) }
  }, [phase])

  const noReply = phase === 'winner' && replySecs > 0 && left === 0 && !replied
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const pic = winner ? profileCache[winner.username] : null

  return (
    <div className="gw-draw">
      <Rays size={420} style={{ position: 'absolute', left: '50%', top: -40, marginLeft: -210, opacity: 0.55 }} />
      {phase === 'winner' && <Confetti />}

      {phase !== 'winner' && (
        <>
          <div className="gw-toprow">
            <div className={`gw-state${phase === 'picked' ? ' gold' : ''}`}>{phase === 'picked' ? 'WINNER!' : phase === 'loading' ? 'PREPARING' : 'DRAWING'}</div>
            <div className="gw-count"><IconUsers /> {participants.length}</div>
          </div>
          {prize && <div className="gw-prizetxt">{prize}</div>}
          <div className="gw-reel" style={{ height: ROW_H * VISIBLE }}>
            <div className={`gw-frame${phase === 'picked' ? ' win' : ''}`} style={{ top: CENTER * ROW_H + 4, height: ROW_H - 8 }} />
            <div className="gw-fade" />
            <div ref={listRef} style={{ willChange: 'transform' }}>
              {items.map((p, i) => (
                <div key={i} className="gw-row" style={{ height: ROW_H }}>
                  <RouletteAvatar username={p.username} color={p.color} size={38} />
                  <span style={{ color: p.color }} className="gw-rname">{p.username}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {phase === 'winner' && winner && (
        <div className="gw-win">
          <div className="gw-avatar">
            {pic ? <img src={pic} alt="" /> : <div className="gw-initial">{winner.username[0]?.toUpperCase()}</div>}
          </div>
          <div className="gw-wname">{winner.username}</div>
          {replySecs > 0 && (
            <div className={`gw-wait${replied ? ' ok' : noReply ? ' late' : ''}`}>
              {replied ? 'REPLIED' : noReply ? 'NO REPLY' : 'REPLY'}
              {!replied && !noReply && <b>{fmt(left)}</b>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const WIDE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('layout') === 'wide'
const BASE_W = WIDE ? 600 : 290

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800;900&family=Sora:wght@700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: transparent !important; overflow: hidden; width: 100%; height: 100%; }

.root-wrap { width: 100vw; height: 100vh; display: flex; align-items: flex-start; justify-content: flex-start; }

.sidebar {
  width: 290px; height: 750px;
  transform-origin: top left;
  transform: scale(var(--scale, 1));
  font-family: 'Rubik', sans-serif;
  background: #090b14;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.03);
  overflow: hidden;
  display: flex; flex-direction: column;
  color: #fff;
  box-shadow: 0 20px 40px rgba(0,0,0,0.6);
  position: relative;
}

.section-header {
  font-size: 12px; font-weight: 800; letter-spacing: 0.05em;
  padding: 12px 16px;
  display: flex; align-items: center; gap: 8px;
  color: #94a3b8;
}
.chat-header { background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05); color: #fff; }
.line-cyan   { width: 3px; height: 14px; background: #34d399; border-radius: 2px; }
.line-yellow { width: 3px; height: 14px; background: #fbbf24; border-radius: 2px; }

/* ── wide variant (?layout=wide) ── */
.sidebar.wide { width: 600px; height: var(--h, 750px); }
.sidebar.wide .chat-header, .sidebar.wide .events-section { display: none; }
.sidebar.wide .chat-msgs { padding: 14px 0; }
.sidebar.wide .msg { padding: 6px 24px; font-size: 22px; line-height: 1.45; }
.sidebar.wide .msg-badge { width: 26px; height: 26px; }
.sidebar.wide .emote { height: 32px; width: auto; }

/* ── chat ── */
.chat-section { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
.chat-msgs { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 8px 0; display: flex; flex-direction: column-reverse; scrollbar-width: none; }
.chat-msgs::-webkit-scrollbar { display: none; }
.msg { padding: 3px 16px; font-size: 13px; line-height: 1.5; word-break: break-word; animation: msgIn .2s ease; }
.msg-badge { width: 16px; height: 16px; border-radius: 2px; vertical-align: middle; display: inline-block; margin-right: 4px; transform: translateY(-1px); }
.msg-name  { font-weight: 700; vertical-align: baseline; }
.msg-colon { font-weight: 700; color: rgba(255,255,255,.3); margin: 0 4px; }
.msg-text  { color: #e2e8f0; font-weight: 500; }
.emote     { width: 20px; height: 20px; display: inline; vertical-align: middle; margin: 0 2px; }

/* ── giveaway banner ── */
.gw { position: absolute; top: 8px; left: 8px; right: 8px; z-index: 10; padding: 9px 12px 10px; border-radius: 16px; text-align: center; background: linear-gradient(160deg, #0b1f17, #0d2e20); border: 1px solid rgba(52,211,153,.35); box-shadow: 0 6px 20px rgba(0,0,0,.4); }
.gw.entering { animation: gwIn .45s cubic-bezier(.34,1.4,.64,1); }
.gw.leaving  { animation: gwOut .35s ease forwards; }
.gw-top { display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 17px; font-weight: 900; color: #fff; }
.gw-n, .gw-t { display: inline-flex; align-items: center; gap: 6px; }
.gw-t { color: #fbbf24; }
.gw-t.ending { color: #f87171; animation: blink .6s ease-in-out infinite; }
.gw-t.done { color: rgba(255,255,255,.45); }
.gw-type { margin-top: 5px; font-size: 12px; font-weight: 700; color: #d1fae5; }
.gw-keyword { display: inline-block; padding: 0 8px; border-radius: 8px; font-weight: 900; color: #fbbf24; background: rgba(251,191,36,.14); border: 1px solid rgba(251,191,36,.5); animation: kwGlow 2s ease-in-out infinite; }
@keyframes kwGlow { 50% { box-shadow: 0 0 14px rgba(251,191,36,.45); } }
.gw-prize { margin-top: 4px; font-size: 22px; font-weight: 900; color: #fff; text-transform: uppercase; line-height: 1.1; text-shadow: 0 2px 10px rgba(52,211,153,.4); word-break: break-word; }

/* ── draw panel (top of the sidebar, chat stays visible below) ── */
@keyframes raySpin { to { transform: rotate(360deg); } }
.gw-draw { position: absolute; top: 8px; left: 8px; right: 8px; height: 322px; z-index: 50; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; padding: 12px; border-radius: 18px; background: radial-gradient(120% 90% at 50% 0%, #0b3a26 0%, #04120c 75%); border: 1px solid rgba(52,211,153,.4); box-shadow: 0 10px 30px rgba(0,0,0,.5); animation: fadeIn .3s ease; font-family: 'Rubik', sans-serif; }
.gw-rays { animation: raySpin 18s linear infinite; pointer-events: none; }
.gw-toprow { position: relative; z-index: 3; display: flex; align-items: center; gap: 12px; }
.gw-state { position: relative; z-index: 3; padding: 3px 12px; border-radius: 99px; font-size: 10px; font-weight: 900; letter-spacing: .18em; color: #fff; background: rgba(0,0,0,.45); border: 1px solid rgba(255,255,255,.25); }
.gw-state.gold { background: linear-gradient(90deg, #fbbf24, #f59e0b); color: #2a1a00; border-color: #fde68a; }
.gw-count { display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 800; color: #d1fae5; }
.gw-prizetxt { position: relative; z-index: 3; font-size: 22px; font-weight: 900; color: #fff; text-transform: uppercase; text-align: center; line-height: 1.1; }
.gw-reel { position: relative; z-index: 3; width: 100%; border-radius: 14px; overflow: hidden; background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.08); }
.gw-fade { position: absolute; inset: 0; z-index: 3; pointer-events: none; background: linear-gradient(180deg, rgba(4,18,12,.92) 0%, transparent 30%, transparent 70%, rgba(4,18,12,.92) 100%); }
.gw-frame { position: absolute; left: 5px; right: 5px; z-index: 4; border-radius: 12px; border: 2.5px solid #fbbf24; box-shadow: 0 0 16px rgba(251,191,36,.55), inset 0 0 10px rgba(251,191,36,.15); transition: .3s; }
.gw-frame.win { border-color: #fff; box-shadow: 0 0 22px rgba(255,255,255,.65); }
.gw-row { display: flex; align-items: center; gap: 11px; padding: 0 16px; }
.gw-rname { font-size: 18px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gw-win { position: relative; z-index: 3; display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; animation: winPop .5s cubic-bezier(.34,1.56,.64,1); }
.gw-avatar { width: 150px; height: 150px; border-radius: 50%; overflow: hidden; border: 4px solid #fbbf24; box-shadow: 0 0 30px rgba(251,191,36,.5), 0 10px 26px rgba(0,0,0,.55); }
.gw-avatar img, .gw-initial { width: 100%; height: 100%; object-fit: cover; display: block; }
.gw-initial { background: linear-gradient(135deg, #14b8a6, #0ea5a0); display: grid; place-items: center; font-size: 64px; font-weight: 900; color: #052e2b; }
.gw-stamp { position: absolute; left: -6px; right: -6px; top: 44px; text-align: center; font-size: 17px; font-weight: 900; letter-spacing: .14em; color: #ef4444; border: 2.5px solid #ef4444; border-radius: 5px; transform: rotate(-14deg); background: rgba(255,255,255,.22); }
.gw-winfo { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 7px; }
.gw-wname { font-size: 26px; text-align: center; font-weight: 900; line-height: 1.1; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #fff; }
.gw-prizepill { padding: 3px 11px; border-radius: 99px; background: #fbbf24; color: #2a1a00; font-size: 12px; font-weight: 900; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gw-wait { display: inline-flex; align-items: center; gap: 7px; height: 26px; padding: 0 11px; border-radius: 99px; background: rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,.18); font-size: 10px; font-weight: 800; letter-spacing: .12em; color: #fff; }
.gw-wait b { font-size: 15px; color: #34d399; font-variant-numeric: tabular-nums; letter-spacing: 0; }
.gw-wait.ok { border-color: rgba(52,211,153,.6); color: #34d399; }
.gw-wait.late { border-color: rgba(248,113,113,.6); color: #f87171; }
@keyframes confFall { to { transform: translateY(340px) rotate(540deg); opacity: .25; } }

/* ── events ── */
.events-section { height: 180px; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,.15); display: flex; flex-direction: column; }
.events-list    { padding: 0 16px; display: flex; flex-direction: column; gap: 8px; }
.placeholder    { font-size: 12px; color: #64748b; font-weight: 500; }
.event-card     { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.04); border-radius: 8px; padding: 8px 10px; animation: msgIn .2s ease; }
.event-icon     { width: 24px; height: 24px; background: rgba(52,211,153,.1); border-radius: 6px; display: flex; align-items: center; justify-content: center; }
.event-info     { display: flex; flex-direction: column; justify-content: center; }
.event-label    { font-size: 9px; font-weight: 800; color: #94a3b8; letter-spacing: .05em; text-transform: uppercase; }
.event-username { font-size: 12px; font-weight: 700; color: #fff; margin-top: 1px; }

/* ── promos (removed) ── */

@keyframes msgIn        { from { opacity:0; transform:translateX(-5px) } to { opacity:1; transform:none } }
@keyframes float        { 0%{transform:translateY(0)} 50%{transform:translateY(-4px)} 100%{transform:translateY(0)} }
@keyframes fadeInPromo  { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
@keyframes fadeOutPromo { from{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(1.05)} }
@keyframes progressFill { from{width:0%} to{width:100%} }
@keyframes gwIn  { from{opacity:0;transform:translateY(-110%)} to{opacity:1;transform:translateY(0)} }
@keyframes gwOut { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-110%)} }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.35} }
@keyframes fadeIn    { from{opacity:0} to{opacity:1} }
@keyframes winPop    { from{opacity:0;transform:scale(.88) translateY(8px)} to{opacity:1;transform:none} }
@keyframes textPulse { 0%,100%{opacity:.5} 50%{opacity:1} }
@keyframes dotPulse  { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:1;transform:scale(1.2)} }
`

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const [chatMsgs, setChatMsgs] = useState([])
  const [events,   setEvents]   = useState([])

  // ── giveaway state (igual ao ChatBox.jsx) ─────────────────────────────────
  const [gw,        setGw]        = useState({ active: false, keyword: '', ends_at: null, spinning: false, participants: [] })
  const [gwLeaving, setGwLeaving] = useState(false)
  const [drawing,   setDrawing]   = useState(false)
  const [drawKey,   setDrawKey]   = useState(0)
  const [drawParts, setDrawParts] = useState([])
  const prevSpin    = useRef(false)
  const lastMsgRef  = useRef(new Map())
  const maxCd       = useRef(0)
  const [partCount, setPartCount] = useState(0)
  const [countdown, setCountdown] = useState(0)

  const endRef       = useRef(null)
  const seenIds      = useRef(new Set())
  const seenEvents   = useRef(new Map())
  const partSet      = useRef(new Set())
  const gwRef        = useRef(gw)
  const spinDoneRef  = useRef(false)
  const winnerHLRef  = useRef(null)
  gwRef.current = gw

  useEffect(() => { loadBadges() }, [])

  // ── Supabase polling giveaway ─────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('giveaway_state')
        .select('*')
        .eq('id', GIVEAWAY_ID).single()
      if (!data) return

      if (spinDoneRef.current && data.spinning) {
        if (data.winner === null) spinDoneRef.current = false
        else return
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
        if (!prev.spinning && data.spinning) spinDoneRef.current = false
        return data
      })
    }
    load()
    const t = setInterval(load, 1500)
    return () => clearInterval(t)
  }, [])

  // ── start of a draw: freeze the participants and mount a fresh roulette ──
  useEffect(() => {
    const list = Array.isArray(gw.participants) ? gw.participants : []
    if (gw.spinning && !prevSpin.current && list.length > 0) {
      setDrawParts(list); setDrawKey(k => k + 1); setDrawing(true)
    }
    prevSpin.current = !!gw.spinning
  }, [gw.spinning])

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gw.active || !gw.ends_at) { setCountdown(0); return }
    const tick = () => setCountdown(Math.max(0, Math.floor((new Date(gw.ends_at) - Date.now()) / 1000)))
    tick(); const t = setInterval(tick, 500)
    return () => clearInterval(t)
  }, [gw.active, gw.ends_at])
  useEffect(() => { if (countdown > maxCd.current) maxCd.current = countdown; if (!gw.active) maxCd.current = 0 }, [countdown, gw.active])

  // ── Roulette done ─────────────────────────────────────────────────────────
  const handleRouletteDone = async (winnerObj) => {
    if (winnerObj?.username) {
      const hl = { username: winnerObj.username.toLowerCase(), count: 3 }
      winnerHLRef.current = hl
    }
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

  // ── Twitch IRC ─────────────────────────────────────────────────────────────
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
          // ── mensagem apagada / timeout / ban / clear chat ──
          if (line.includes(' CLEARMSG ')) {
            const t = line.match(/target-msg-id=([^;\s]+)/)
            if (t) { seenIds.current.add(t[1]); setChatMsgs(prev => prev.filter(m => m.id !== t[1])) }
            continue
          }
          if (line.includes(' CLEARCHAT ')) {
            const who = line.match(/ CLEARCHAT #[^ ]+ :(\S+)/)
            if (who) {
              const u = who[1].toLowerCase()
              setChatMsgs(prev => prev.filter(m => (m.username || '').toLowerCase() !== u))
            } else {
              setChatMsgs([])
            }
            continue
          }
          const match = line.match(/^@([^ ]+) :([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.+)/)
          if (!match) continue
          const tags     = Object.fromEntries(match[1].split(';').map(kv => { const [k, ...v] = kv.split('='); return [k, v.join('=')] }))
          const msgId    = tags['id'] || null
          const username = match[2]
          const text     = match[3].trim()
          lastMsgRef.current.set(username.toLowerCase(), Date.now())

          // ── contagem de participantes do giveaway ──
          const cur = gwRef.current
          const isGw = cur.active && text.toLowerCase() === (cur.keyword || '').toLowerCase()
          if (isGw) {
            const key = username.toLowerCase()
            if (!partSet.current.has(key)) { partSet.current.add(key); setPartCount(n => n + 1) }
          }

          if (msgId) {
            if (seenIds.current.has(msgId)) continue
            seenIds.current.add(msgId)
            if (seenIds.current.size > 600) {
              const it = seenIds.current.values()
              for (let i = 0; i < 100; i++) seenIds.current.delete(it.next().value)
            }
          }

          const color  = (tags['color'] && tags['color'] !== '') ? tags['color'] : hslFromName(username)
          const badges = parseBadges(tags['badges'] || '')
          const parts  = parseEmotes(text, tags['emotes'] || '')

          setChatMsgs(prev => {
            const next = [...prev, { id: msgId || `${Date.now()}-${Math.random()}`, username, parts, color, badges }]
            return next.length > 50 ? next.slice(-50) : next
          })
        }
      }
      ws.onclose = () => { retryTimer = setTimeout(connect, 3000) }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => { clearTimeout(retryTimer); ws?.close() }
  }, [])

  // ── StreamLabs events ─────────────────────────────────────────────────────
  useEffect(() => {
    let ws, retryTimer, pingTimer
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
      let evLabel = ''
      if (type === 'follow') evLabel = 'NEW FOLLOWER'
      else if (type === 'subscription' || type === 'resub') evLabel = 'NEW SUBSCRIBER'
      else if (type === 'raid') evLabel = 'RAID'
      else return
      setEvents(prev => [{ id: `ev-${now}`, type, label: evLabel, username }, ...prev].slice(0, 3))
    }
    const connect = () => {
      ws = new WebSocket(`wss://sockets.streamlabs.com/socket.io/?token=${SL_TOKEN}&EIO=3&transport=websocket`)
      ws.onmessage = (e) => {
        const raw = String(e.data)
        if (raw === '2') { ws.send('3'); return }
        if (raw.startsWith('0{')) {
          try { const d = JSON.parse(raw.slice(1)); if (d.pingInterval) pingTimer = setInterval(() => { if (ws.readyState === 1) ws.send('2') }, d.pingInterval) } catch {}
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

  // column-reverse handles auto-scroll to latest messages

  useEffect(() => {
    const update = () => {
      const scale = WIDE ? window.innerWidth / BASE_W : Math.min(window.innerWidth / BASE_W, window.innerHeight / 750)
      document.documentElement.style.setProperty('--scale', scale)
      document.documentElement.style.setProperty('--h', WIDE ? (window.innerHeight / scale) + 'px' : '750px')
    }
    update(); window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // ── derived ───────────────────────────────────────────────────────────────
  const isEnding    = countdown > 0 && countdown <= 30
  const isDone      = gw.active && countdown === 0
  const participants = Array.isArray(gw.participants) ? gw.participants : []
  const showGw      = gw.active || gwLeaving
  const GW_H        = 104 // altura da barra para o paddingTop do chat

  return (
    <>
      <style>{CSS}</style>
      <div className="root-wrap">
        <div className={'sidebar' + (WIDE ? ' wide' : '')}>

          {/* ── CHAT ── */}
          <div className="chat-section">
            <div className="section-header chat-header">
              <IconChat /> CHAT
            </div>
            <div className="chat-msgs" style={{ paddingTop: drawing ? 338 : showGw ? GW_H + 8 : 8 }}>
              {[...chatMsgs].reverse().map(item => (
                <div className="msg" key={item.id}>
                  {item.badges?.map(b => <img key={b.key} className="msg-badge" src={b.url} alt="" />)}
                  <span className="msg-name" style={{ color: item.color }}>{item.username}</span>
                  <span className="msg-colon">:</span>
                  <span className="msg-text">
                    {item.parts.map((p, i) =>
                      p.type === 'emote'
                        ? <img key={i} src={`https://static-cdn.jtvnw.net/emoticons/v2/${p.id}/default/dark/1.0`} alt={p.name} title={p.name} className="emote" />
                        : <span key={i}>{p.v}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── GIVEAWAY BANNER ── */}
          {showGw && (
            <div className={`gw${gwLeaving ? ' leaving' : ' entering'}`}>
              <div className="gw-top">
                <span className="gw-n"><IconUsers /> {participants.length}</span>
                <span className={`gw-t${isEnding ? ' ending' : isDone ? ' done' : ''}`}>
                  <svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="8.5" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3"/><circle cx="11" cy="11" r="8.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="53.4" strokeDashoffset={53.4 * (maxCd.current > 0 ? 1 - Math.min(1, countdown / maxCd.current) : 1)} transform="rotate(-90 11 11)" style={{ transition: 'stroke-dashoffset .6s linear' }}/></svg>
                  {isDone ? 'CLOSED' : fmtTimer(countdown)}
                </span>
              </div>
              <div className="gw-type">Type <span className="gw-keyword">{gw.keyword}</span> in chat to win!</div>
              {gw.prize && <div className="gw-prize">{gw.prize}</div>}
            </div>
          )}

          {/* ── ROLETA ── */}
          {drawing && drawParts.length > 0 && (
            <Roulette key={drawKey} participants={drawParts} prize={gw.prize} prizeImage={gw.prize_image}
              replySecs={Number.isFinite(Number(gw.reply_secs)) ? Number(gw.reply_secs) : 45}
              onDone={handleRouletteDone} onClose={() => setDrawing(false)}
              lastMsgOf={(u) => lastMsgRef.current.get(String(u).toLowerCase()) || 0} />
          )}

          {/* ── EVENTS ── */}
          <div className="events-section">
            <div className="section-header">
              <div className="line-cyan" />
              RECENT EVENTS
            </div>
            <div className="events-list">
              {events.length === 0 && <div className="placeholder"></div>}
              {events.map(ev => (
                <div className="event-card" key={ev.id}>
                  <div className="event-icon"><IconAddUser /></div>
                  <div className="event-info">
                    <span className="event-label">{ev.label}</span>
                    <span className="event-username">{ev.username}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>



        </div>
      </div>
    </>
  )
}