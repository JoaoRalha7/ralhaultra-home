import { useState, useEffect, useRef } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

function fmt(n) {
  if (!n && n !== 0) return '—'
  return n >= 1000
    ? n.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '€'
    : n.toFixed(2) + '€'
}

function hslFromName(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return `hsl(${h % 360}, 55%, 58%)`
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

// ─── Efeito Ping-Pong (Clean Style) ───────────────────────────────────────
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
    <div className="slide-wrap" ref={containerRef}>
      <div 
        className={`slide-inner ${slideDist < 0 ? 'anim-ping-pong' : ''}`}
        style={{ '--slide-dist': `${slideDist}px` }}
      >
        <span className={className} ref={textRef}>{text}</span>
      </div>
    </div>
  )
}

// ─── TwitchAvatar ─────────────────────────────────────────────────────────
function TwitchAvatar({ username, src, size = 44, borderColor = 'var(--border2)' }) {
  const color  = hslFromName(username)
  const [imgSrc, setImgSrc] = useState(src || profileCache[username] || null)

  useEffect(() => {
    if (src) { setImgSrc(src); return }
    if (profileCache[username]) { setImgSrc(profileCache[username]); return }
    getProfilePic(username).then(url => { if (url) setImgSrc(url) })
  }, [username, src])

  const base = { width: size, height: size, borderRadius: '50%', flexShrink: 0, border: `2px solid ${borderColor}` }
  if (imgSrc) return <img src={imgSrc} alt={username} style={{ ...base, objectFit: 'cover' }} />
  return (
    <div style={{ ...base, background: `${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: size * 0.38, color }}>
      {username?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

// ─── useAutoScroll ────────────────────────────────────────────────────────
function useAutoScroll({ count, visible, rowH, gap, interval = 6000 }) {
  const [step, setStep] = useState(0)
  const innerRef = useRef(null)
  const maxStep  = Math.max(0, count - visible)

  useEffect(() => { if (count > visible) setStep(maxStep) }, [count])

  useEffect(() => {
    if (count <= visible) { setStep(0); return }
    const id = setInterval(() => setStep(prev => prev >= maxStep ? 0 : prev + 1), interval)
    return () => clearInterval(id)
  }, [count, maxStep, interval])

  useEffect(() => {
    if (!innerRef.current) return
    innerRef.current.style.transform = `translateY(-${step * (rowH + gap)}px)`
  }, [step, rowH, gap])

  return { innerRef, fadeTop: step > 0, fadeBottom: step < maxStep }
}

// ─── AnimatedSection ──────────────────────────────────────────────────────
function AnimatedSection({ show, children }) {
  const ref     = useRef(null)
  const prevRef = useRef(show)
  const timerRef = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || show === prevRef.current) return
    prevRef.current = show
    clearTimeout(timerRef.current)

    if (show) {
      el.style.overflow   = 'hidden'
      el.style.height     = '0px'
      el.style.opacity    = '0'
      el.offsetHeight
      const target = el.scrollHeight
      el.style.transition = 'height .45s cubic-bezier(.4,0,.2,1), opacity .35s ease'
      el.style.height     = `${target}px`
      el.style.opacity    = '1'
      timerRef.current = setTimeout(() => {
        el.style.height   = 'auto'
        el.style.overflow = 'visible'
        el.style.transition = ''
      }, 460)
    } else {
      el.style.overflow   = 'hidden'
      el.style.height     = `${el.scrollHeight}px`
      el.style.opacity    = '1'
      el.offsetHeight
      el.style.transition = 'height .4s cubic-bezier(.4,0,.2,1), opacity .3s ease'
      el.style.height     = '0px'
      el.style.opacity    = '0'
    }
  }, [show])

  return (
    <div ref={ref} style={{ overflow: show ? 'visible' : 'hidden' }}>
      {children}
    </div>
  )
}

// ─── Constantes ───────────────────────────────────────────────────────────
const PAY_ROW_H   = 38
const PAY_GAP     = 6
const PAY_VISIBLE = 2
const RK_ROW_H    = 46
const RK_GAP      = 0
const RK_VISIBLE  = 4

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;900&family=Sora:wght@700;800&display=swap');

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

.root-wrap { width: 100vw; height: 100vh; display: flex; align-items: flex-start; justify-content: flex-start; }
.root { width: 460px; height: 480px; transform-origin: top left; transform: scale(var(--scale, 1)); font-family: 'Rubik', sans-serif; -webkit-font-smoothing: antialiased; }

/* ── ESTILO APP PREMIUM ── */
.card { background: var(--bg); border: 1px solid var(--border); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }

.hd { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--surface); }
.hd-info { flex: 1; min-width: 0; overflow: hidden; }
.hd-tag  { font-size: 10px; font-weight: 800; color: var(--muted2); letter-spacing: .12em; text-transform: uppercase; }
.hd-user { font-size: 18px; font-weight: 900; color: var(--text); }
.hd-user.dim { font-size: 14px; color: var(--muted); font-weight: 500; }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--red); flex-shrink: 0; animation: blink-dot 1.5s infinite; box-shadow: 0 0 6px var(--red); }
.wait-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--surface2); flex-shrink: 0; animation: blink-dot 2.2s infinite; }

.slot-row { display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
.slot-img    { width: 54px; height: 54px; border-radius: 12px; object-fit: cover; background: var(--surface2); border: 1px solid var(--border2); flex-shrink: 0; }
.slot-img-ph { width: 54px; height: 54px; border-radius: 12px; background: var(--surface2); border: 1px solid var(--border2); flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.slot-info-wrap { flex: 1; min-width: 0; overflow: hidden; display: flex; flex-direction: column; }
.slot-name { font-size: 14px; font-weight: 800; color: var(--text); }
.slot-sub  { font-size: 11px; color: var(--muted2); font-weight: 600; margin-top: 2px; text-transform: uppercase; letter-spacing: .05em; }
.slot-bet  { font-size: 11px; font-weight: 800; color: var(--muted); margin-top: 4px; text-transform: uppercase; }
.slot-bet b { color: var(--text); font-family: 'Sora', sans-serif; font-size: 13px; }
.total-wrap { margin-left: auto; text-align: right; flex-shrink: 0; background: var(--green-dim); border: 1px solid rgba(52,211,153,0.3); padding: 6px 12px; border-radius: 12px; }
.total-lbl  { font-size: 9px; color: var(--green); font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.total-val  { font-size: 20px; font-weight: 900; font-family: 'Sora', sans-serif; color: var(--green); line-height: 1; margin-top: 2px; }

.pays-outer { padding: 8px 12px; }
.pays-inner { display: flex; flex-direction: column; gap: ${PAY_GAP}px; transition: transform .6s cubic-bezier(.4,0,.2,1); }
.pay-row { display: flex; align-items: center; gap: 12px; padding: 0 12px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border); flex-shrink: 0; height: ${PAY_ROW_H}px; }
.pay-ico { width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pay-ico.bonus { background: var(--yellow-dim); color: var(--yellow); }
.pay-ico.win   { background: var(--accent-dim); color: var(--accent); }
.pay-type { font-size: 12px; font-weight: 800; flex: 1; text-transform: uppercase; letter-spacing: .05em; }
.pay-type.bonus { color: var(--yellow); }
.pay-type.win   { color: var(--accent); }
.pay-multi { font-size: 10px; color: var(--muted2); margin-left: 6px; }
.pay-val { font-size: 14px; font-weight: 900; font-family: 'Sora', sans-serif; color: var(--text); }

.divider { border-top: 1px solid var(--border); }

.rk-hd { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--surface); }
.rk-title { font-size: 10px; font-weight: 800; color: var(--muted2); letter-spacing: .15em; text-transform: uppercase; }
.rk-date  { margin-left: auto; font-size: 9px; color: var(--muted); font-weight: 700; }
.rk-inner { display: flex; flex-direction: column; transition: transform .6s cubic-bezier(.4,0,.2,1); }
.rk-row { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-bottom: 1px solid var(--border); height: ${RK_ROW_H}px; flex-shrink: 0; }
.rk-row.r0 { background: var(--yellow-dim); }
.rk-row.r1 { background: rgba(255,255,255,.03); }
.rk-row.r2 { background: rgba(205,124,77,.05); }
.rk-pos { width: 24px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rk-pos-num { font-size: 11px; font-weight: 800; font-family: 'Sora', sans-serif; color: var(--muted); }
.rk-slot { width: 30px; height: 30px; border-radius: 8px; background: var(--surface2); border: 1px solid var(--border); flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.rk-slot img { width: 100%; height: 100%; object-fit: cover; }
.rk-name-wrap { flex: 1; min-width: 0; overflow: hidden; }
.rk-name { font-size: 13px; font-weight: 800; color: var(--text); }
.rk-amt { font-size: 14px; font-weight: 900; font-family: 'Sora', sans-serif; white-space: nowrap; flex-shrink: 0; }
.rk-amt.r0 { color: var(--yellow); }
.rk-amt.r1 { color: #cbd5e1; }
.rk-amt.r2 { color: #cd7c4d; }
.rk-amt.rn { color: var(--text); }

.waiting-body { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; gap: 8px; }
.waiting-title { font-size: 13px; font-weight: 800; color: var(--muted2); text-transform: uppercase; letter-spacing: .05em; }
.waiting-sub   { font-size: 11px; color: var(--muted); font-weight: 600; }

/* ── PING PONG ANIMATION ── */
.slide-wrap { width: 100%; overflow: hidden; white-space: nowrap; mask-image: linear-gradient(to right, black 90%, transparent 100%); -webkit-mask-image: linear-gradient(to right, black 90%, transparent 100%); }
.slide-inner { display: inline-flex; align-items: center; width: fit-content; }
.anim-ping-pong { animation: text-ping-pong 4s ease-in-out infinite alternate; }
@keyframes text-ping-pong { 
  0%, 20% { transform: translateX(0); } 
  80%, 100% { transform: translateX(var(--slide-dist)); } 
}

@keyframes blink-dot  { 0%,100%{opacity:1} 50%{opacity:.2} }
@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
`

const TrophyIcon = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
    <path d="M12 17v4"/><path d="M8 21h8"/>
    <path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/>
  </svg>
)
const trophyColors = ['var(--yellow)', '#cbd5e1', '#cd7c4d']

export default function MinigamePlaying() {
  const [session,    setSession]    = useState(undefined)
  const [ranking,    setRanking]    = useState([])
  const [slots,      setSlots]      = useState({})
  const [sessionPic, setSessionPic] = useState(null) 
  const [rankPics,   setRankPics]   = useState({})   

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const load = async () => {
      const { data: sess } = await supabase.from('minigame_sessions')
        .select('*, slot:slots(*)')
        .eq('status', 'playing').eq('stream_date', today)
        .order('created_at', { ascending: false }).limit(1).single()

      if (sess?.username) {
        const pic = await getProfilePic(sess.username)
        setSessionPic(pic)
      } else {
        setSessionPic(null)
      }
      setSession(sess || null)

      const { data: rk } = await supabase.from('minigame_ranking')
        .select('*').eq('stream_date', today)
        .order('total_won', { ascending: false }).limit(20)
      setRanking(rk || [])

      if (rk?.length) {
        const pics = {}
        await Promise.allSettled(rk.map(async r => {
          const pic = await getProfilePic(r.username)
          if (pic) pics[r.username] = pic
        }))
        setRankPics(prev => ({ ...prev, ...pics }))

        const { data: done } = await supabase.from('minigame_sessions')
          .select('username, slot:slots(image_url, name)')
          .eq('stream_date', today).eq('status', 'done')
          .order('created_at', { ascending: false })
        if (done) {
          const map = {}
          for (const s of done) { if (!map[s.username]) map[s.username] = s.slot }
          setSlots(map)
        }
      }
    }
    load()
    const ch = supabase.channel('mg-playing-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'minigame_sessions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'minigame_ranking'  }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  useEffect(() => {
    const update = () => {
      const scale = Math.min(window.innerWidth / 460, window.innerHeight / 480)
      document.documentElement.style.setProperty('--scale', scale)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const payments = [...(session?.payments || [])].reverse()
  const payScroll = useAutoScroll({ count: payments.length, visible: PAY_VISIBLE, rowH: PAY_ROW_H, gap: PAY_GAP, interval: 5000 })
  const rkScroll  = useAutoScroll({ count: ranking.length,  visible: RK_VISIBLE,  rowH: RK_ROW_H,  gap: RK_GAP,  interval: 6000 })

  const today      = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
  const hasSession = session !== null && session !== undefined
  const hasRanking = ranking.length > 0

  if (session === undefined) return <><style>{CSS}</style><div className="root-wrap"><div className="root" /></div></>

  return (
    <>
      <style>{CSS}</style>
      <div className="root-wrap">
        <div className="root">
          <div className="card">

            {/* HEADER */}
            <div className="hd" key={session?.id || 'waiting'} style={{ animation: 'fadeIn .35s ease' }}>
              {hasSession ? (
                <TwitchAvatar username={session.username} src={sessionPic} size={44} borderColor="var(--accent)" />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
              )}
              <div className="hd-info">
                <div className="hd-tag">{hasSession ? 'Now Playing' : 'Minigame'}</div>
                <div className={`hd-user${hasSession ? '' : ' dim'}`}>
                  {/* Ping pong adaptado também ao username caso o viewer tenha um nome abusado */}
                  <SlideText text={hasSession ? session.username : 'Waiting for player…'} className={`hd-user${hasSession ? '' : ' dim'}`} />
                </div>
              </div>
              {hasSession ? <div className="live-dot" /> : <div className="wait-dot" />}
            </div>

            {/* SLOT + TOTAL */}
            <AnimatedSection show={hasSession}>
              {hasSession && (
                <div className="slot-row">
                  {session.slot?.image_url
                    ? <img className="slot-img" src={session.slot.image_url} alt="" onError={e => e.target.style.opacity = '.3'} />
                    : <div className="slot-img-ph"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg></div>
                  }
                  <div className="slot-info-wrap">
                    <SlideText text={session.slot?.name || '—'} className="slot-name" />
                    <div className="slot-sub">{session.slot?.provider}</div>
                    <div className="slot-bet">BET: <b>{session.bet}€</b></div>
                  </div>
                  <div className="total-wrap">
                    <div className="total-lbl">Total</div>
                    <div className="total-val">{fmt(session.total_won)}</div>
                  </div>
                </div>
              )}
            </AnimatedSection>

            {/* PAYMENTS */}
            <AnimatedSection show={hasSession && payments.length > 0}>
              {hasSession && payments.length > 0 && (
                <div className="pays-outer">
                  <div style={{ position: 'relative', height: PAY_VISIBLE * PAY_ROW_H + (PAY_VISIBLE - 1) * PAY_GAP, overflow: 'hidden' }}>
                    {payScroll.fadeTop    && <div style={{ position: 'absolute', top: 0,    left: 0, right: 0, height: 18, background: 'linear-gradient(to bottom, var(--bg), transparent)', zIndex: 1, pointerEvents: 'none' }} />}
                    {payScroll.fadeBottom && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 18, background: 'linear-gradient(to top,    var(--bg), transparent)', zIndex: 1, pointerEvents: 'none' }} />}
                    <div className="pays-inner" ref={payScroll.innerRef}>
                      {payments.map((p, i) => (
                        <div key={i} className="pay-row">
                          <div className={`pay-ico ${p.type}`}>
                            {p.type === 'bonus'
                              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>
                            }
                          </div>
                          <div className={`pay-type ${p.type}`}>
                            {p.type === 'bonus' ? 'Bonus' : '+50x Win'}
                            <span className="pay-multi">{p.multiplier}x</span>
                          </div>
                          <div className="pay-val">{fmt(p.value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </AnimatedSection>

            {/* RANKING */}
            <AnimatedSection show={hasRanking}>
              {hasRanking && (
                <>
                  <div className="divider" />
                  <div className="rk-hd">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                    </svg>
                    <div className="rk-title">Ranking</div>
                    <div className="rk-date">{today}</div>
                  </div>
                  <div style={{ position: 'relative', height: RK_VISIBLE * RK_ROW_H, overflow: 'hidden' }}>
                    {rkScroll.fadeTop    && <div style={{ position: 'absolute', top: 0,    left: 0, right: 0, height: 20, background: 'linear-gradient(to bottom, var(--bg), transparent)', zIndex: 1, pointerEvents: 'none' }} />}
                    {rkScroll.fadeBottom && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 20, background: 'linear-gradient(to top,    var(--bg), transparent)', zIndex: 1, pointerEvents: 'none' }} />}
                    <div className="rk-inner" ref={rkScroll.innerRef}>
                      {ranking.map((r, i) => {
                        const slot = slots[r.username]
                        const rc   = i < 3 ? `r${i}` : ''
                        const ac   = i < 3 ? `r${i}` : 'rn'
                        return (
                          <div key={r.id} className={`rk-row ${rc}`}>
                            <div className="rk-pos">
                              {i < 3
                                ? <TrophyIcon color={trophyColors[i]} />
                                : <div className="rk-pos-num">#{i + 1}</div>}
                            </div>
                            <div className="rk-slot">
                              {slot?.image_url
                                ? <img src={slot.image_url} alt="" onError={e => e.target.style.opacity = '.3'} />
                                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/></svg>
                              }
                            </div>
                            <TwitchAvatar username={r.username} src={rankPics[r.username] || null} size={30} borderColor={i < 3 ? `${trophyColors[i]}50` : 'var(--border2)'} />
                            
                            {/* Nome do jogador no ranking também com ping pong */}
                            <div className="rk-name-wrap">
                              <SlideText text={r.username} className="rk-name" />
                            </div>

                            <div className={`rk-amt ${ac}`}>{fmt(r.total_won)}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </AnimatedSection>

            {/* Waiting */}
            <AnimatedSection show={!hasSession && !hasRanking}>
              {!hasSession && !hasRanking && (
                <div className="waiting-body">
                  <div className="waiting-title">No active session</div>
                  <div className="waiting-sub">Next player will appear here</div>
                </div>
              )}
            </AnimatedSection>

          </div>
        </div>
      </div>
    </>
  )
}