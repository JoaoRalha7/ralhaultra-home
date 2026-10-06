import { useState, useEffect, useRef, useCallback } from 'react'
import { supabaseDash as supabase, supabase as supabasePublic } from '../lib/supabase.js'

// ── utils ──────────────────────────────────────────────────────────────────────
function parseBet(v) { return parseFloat(String(v || 0).replace(',', '.')) || 0 }
function fmtEur(v) {
  if (v == null) return '—'
  const n = parseFloat(v)
  return n >= 1000
    ? n.toLocaleString('pt-PT', { maximumFractionDigits: 0 }) + '€'
    : n.toFixed(2) + '€'
}

const BUCKETS = [
  { id: 'F', label: '+106x',   color: '#3b82f6' },
  { id: 'E', label: '96-105x', color: '#10b981' },
  { id: 'D', label: '86-95x',  color: '#f59e0b' },
  { id: 'C', label: '76-85x',  color: '#ec4899' },
  { id: 'B', label: '66-75x',  color: '#8b5cf6' },
  { id: 'A', label: '0-65x',   color: '#6366f1' },
]

function useCountdown(closesAt) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!closesAt) { setSecs(0); return }
    const tick = () => setSecs(Math.max(0, Math.floor((new Date(closesAt) - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [closesAt])
  return secs
}
function fmtTime(s) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@700;800&display=swap');

html, body { background: transparent !important; margin: 0; padding: 0; overflow: hidden; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }

:root {
  --bg:     #07090f;
  --s1:     #0c0e18;
  --s2:     #10121e;
  --s3:     #14172a;
  --border: rgba(255,255,255,.06);
  --b2:     rgba(255,255,255,.11);
  --text:   #e8ecf5;
  --muted:  #6b7280;
  --muted2: #8892b0;
  --gold:   #fbbf24;
  --silver: #94a3c0;
  --bronze: #c07a4a;
  --blue:   #3b82f6;
  --green:  #22c55e;
  --red:    #ef4444;
  --accent: #7c6fff;
  --ff: 'Rubik', system-ui, sans-serif;
  --mono: 'JetBrains Mono', monospace;
  --r: 16px;
}

.wrap {
  width: 100vw; height: 100vh;
  display: flex; align-items: center; justify-content: center;
  background: transparent;
}
.root {
  transform-origin: center;
  transform: scale(var(--scale, 1));
  width: 1500px; height: 900px;
  font-family: var(--ff);
  display: flex; flex-direction: column;
  background: radial-gradient(ellipse at 50% 0%, #111827 0%, var(--bg) 70%);
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid var(--b2);
  box-shadow: 0 40px 100px rgba(0,0,0,.9);
}

/* ── HEADER ── */
.hd {
  height: 64px; flex-shrink: 0;
  background: linear-gradient(90deg, #090614 0%, #130c28 50%, #090614 100%);
  border-bottom: 1px solid rgba(124,111,255,.2);
  display: flex; align-items: center;
  padding: 0 28px; gap: 16px;
}
.hd-dot {
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--red);
  box-shadow: 0 0 10px rgba(239,68,68,.9);
  animation: blink 1.4s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
.hd-sep { width: 1px; height: 24px; background: rgba(255,255,255,.1); flex-shrink: 0; }
.hd-title {
  font-size: 15px; font-weight: 900; color: var(--text);
  letter-spacing: .12em; text-transform: uppercase;
}
.hd-timer {
  font-family: var(--mono); font-size: 22px; font-weight: 800;
  color: var(--gold); letter-spacing: .04em;
}
.hd-timer.urgent { color: var(--red); animation: urgPulse .7s ease-in-out infinite; }
@keyframes urgPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
.hd-entries {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; color: var(--muted2);
}
.hd-entries-n { font-family: var(--mono); font-size: 18px; font-weight: 800; color: var(--text); }
.hd-spacer { flex: 1; }
.hd-site {
  font-size: 13px; font-weight: 800; letter-spacing: .14em;
  text-transform: uppercase; color: rgba(255,255,255,.15);
}

/* ── COLUMNS ── */
.cols {
  flex: 1; display: grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 0; overflow: hidden;
  padding: 16px 20px; gap: 12px;
}

/* ── COLUMN CARD ── */
.col {
  background: var(--s1);
  border: 1px solid var(--border);
  border-radius: var(--r);
  display: flex; flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* col accent top line */
.col::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  border-radius: var(--r) var(--r) 0 0;
}
.col-pick::before  { background: linear-gradient(90deg, var(--gold), transparent); }
.col-gtb::before   { background: linear-gradient(90deg, var(--green), transparent); }
.col-avg::before   { background: linear-gradient(90deg, var(--blue), transparent); }

/* ── COL HEADER ── */
.col-hd {
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0;
}
.col-hd-left { display: flex; align-items: center; gap: 8px; }
.col-name {
  font-size: 12px; font-weight: 900; letter-spacing: .12em;
  text-transform: uppercase; color: rgba(255,255,255,.5);
}
.col-stat-val {
  font-family: var(--mono); font-size: 18px; font-weight: 800;
  line-height: 1;
}
.col-count {
  font-family: var(--mono); font-size: 22px; font-weight: 900; color: var(--text);
  background: var(--s2); border: 1px solid var(--b2);
  border-radius: 10px; padding: 4px 12px; line-height: 1;
}
.col-count-lbl {
  font-size: 9px; font-weight: 700; color: var(--muted2);
  letter-spacing: .1em; text-transform: uppercase;
  display: block; text-align: center; margin-top: 2px;
}

/* ── PRIZE BAR ── */
.prizes {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.prize {
  display: flex; flex-direction: column;
  align-items: center; padding: 7px 4px; gap: 1px;
  border-right: 1px solid var(--border);
  position: relative;
}
.prize:last-child { border-right: none; }
.prize-gold { background: rgba(251,191,36,.04); }
.p-rank {
  font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
}
.p-rank.gold   { color: var(--gold); }
.p-rank.silver { color: var(--silver); }
.p-rank.bronze { color: var(--bronze); }
.p-pts {
  font-family: var(--mono); font-size: 13px; font-weight: 800;
  color: var(--text); display: flex; align-items: center; gap: 3px;
}
.p-cash { font-size: 10px; font-weight: 700; color: var(--green); }

/* ── WINNER CARD ── */
.winner-card {
  margin: 10px 12px 0;
  border-radius: 10px; padding: 10px 14px;
  border: 1px solid rgba(251,191,36,.3);
  background: rgba(251,191,36,.05);
  flex-shrink: 0;
  animation: winPulse 2.4s ease-in-out infinite;
}
@keyframes winPulse {
  0%,100% { border-color: rgba(251,191,36,.3); }
  50%     { border-color: rgba(251,191,36,.65); box-shadow: 0 0 18px rgba(251,191,36,.1); }
}
.wc-row { display: flex; align-items: center; gap: 9px; }
.wc-crown { font-size: 20px; flex-shrink: 0; animation: crownFloat 2s ease-in-out infinite; }
@keyframes crownFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
.wc-name {
  font-size: 16px; font-weight: 900; color: var(--gold);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wc-detail { font-size: 11px; color: var(--muted2); margin-top: 2px; }

/* ── COL SUBHEAD ── */
.col-subhd {
  padding: 8px 16px 6px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0;
}
.col-subhd-name {
  font-size: 11px; font-weight: 800; letter-spacing: .06em;
  text-transform: uppercase; color: rgba(255,255,255,.3);
  display: flex; align-items: center; gap: 6px;
}

/* ── SCROLL ENTRIES ── */
.entries { flex: 1; overflow: hidden; position: relative; }
.entries-inner { display: flex; flex-direction: column; }

/* ── ENTRY ROW ── */
.entry {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 16px;
  border-bottom: 1px solid rgba(255,255,255,.03);
  position: relative;
}
.entry:last-child { border-bottom: none; }
.entry-new { animation: eSlide .35s cubic-bezier(.34,1.56,.64,1) both; }
@keyframes eSlide {
  from { opacity: 0; transform: translateX(-14px); }
  to   { opacity: 1; transform: none; }
}
.entry.winner {
  background: linear-gradient(90deg, rgba(251,191,36,.07) 0%, transparent 70%);
}
.entry.winner::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--gold); box-shadow: 0 0 8px rgba(251,191,36,.6);
}

.e-rank {
  font-family: var(--mono); font-size: 13px; font-weight: 800;
  color: var(--muted); min-width: 24px; text-align: center; flex-shrink: 0;
}
.e-rank.r1 { color: var(--gold); }
.e-rank.r2 { color: var(--silver); }
.e-rank.r3 { color: var(--bronze); }

.e-av {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 12px; overflow: hidden;
  border: 1.5px solid transparent;
}
.e-info { flex: 1; min-width: 0; }
.e-user {
  font-size: 14px; font-weight: 600; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.e-sub { font-size: 11px; color: var(--muted2); margin-top: 1px; }
.e-val {
  font-family: var(--mono); font-size: 16px; font-weight: 800;
  color: var(--text); flex-shrink: 0;
}
.e-val.r1 { color: var(--gold); }
.e-val.r2 { color: var(--silver); }
.e-val.r3 { color: var(--bronze); }

/* NEW badge */
.new-badge {
  font-size: 9px; font-weight: 800; letter-spacing: .1em;
  background: var(--blue); color: #fff;
  border-radius: 4px; padding: 1px 5px; margin-left: 5px;
  vertical-align: middle; display: inline-block;
  animation: badgePop .4s cubic-bezier(.34,1.56,.64,1);
}
@keyframes badgePop {
  from { opacity: 0; transform: scale(.4); }
  to   { opacity: 1; transform: scale(1); }
}

/* ── PICK SLOT ROW ── */
.pick-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 16px;
  border-bottom: 1px solid rgba(255,255,255,.03);
  position: relative;
}
.pick-row:last-child { border-bottom: none; }
.pick-row.entry-new { animation: eSlide .35s cubic-bezier(.34,1.56,.64,1) both; }
.pick-row.winner {
  background: linear-gradient(90deg, rgba(251,191,36,.07) 0%, transparent 70%);
}
.pick-row.winner::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--gold); box-shadow: 0 0 8px rgba(251,191,36,.6);
}
.pick-n {
  font-family: var(--mono); font-size: 13px; font-weight: 800;
  color: var(--muted); min-width: 24px; text-align: center; flex-shrink: 0;
}
.pick-img {
  width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
  background: var(--s3); border: 1px solid var(--b2);
  overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.pick-img img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; }
.pick-info { flex: 1; min-width: 0; }
.pick-slot-name {
  font-size: 13px; font-weight: 700; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pick-provider { font-size: 11px; color: var(--muted); margin-top: 1px; }
.pick-user-row { display: flex; align-items: center; gap: 5px; margin-top: 3px; }
.pick-user-name {
  font-size: 12px; font-weight: 700; color: #60a5fa;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ── BUCKETS ── */
.buckets {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 6px; padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.bucket {
  border-radius: 9px; padding: 8px 11px;
  display: flex; align-items: center; justify-content: space-between;
  border: 1px solid transparent;
}
.b-left { display: flex; flex-direction: column; gap: 1px; }
.b-id    { font-size: 14px; font-weight: 900; }
.b-lbl   { font-size: 10px; font-weight: 600; color: rgba(255,255,255,.45); }
.b-pct   { font-family: var(--mono); font-size: 16px; font-weight: 900; }

/* ── PROGRESS BAR ── */
.prog-wrap {
  padding: 8px 16px 6px; border-bottom: 1px solid var(--border); flex-shrink: 0;
  display: flex; align-items: center; gap: 8px;
}
.prog-track {
  flex: 1; height: 3px; background: rgba(255,255,255,.07);
  border-radius: 3px; overflow: hidden;
}
.prog-fill {
  height: 100%; background: var(--gold); border-radius: 3px;
  transition: width .6s cubic-bezier(.2,.9,.2,1);
}
.prog-lbl { font-size: 10px; font-weight: 700; color: var(--muted2); white-space: nowrap; }

/* ── LIVE RANKING TABLE ── */
.rank-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,.03);
  position: relative; transition: background .3s;
}
.rank-row:last-child { border-bottom: none; }
.rank-row.leader {
  background: linear-gradient(90deg, rgba(251,191,36,.09) 0%, transparent 75%);
}
.rank-row.leader::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--gold); box-shadow: 0 0 8px rgba(251,191,36,.7);
}
.rank-row.opened { }
.rank-row.unopened { opacity: .55; }
.rank-row.new-flash { animation: rowFlash .6s ease both; }
@keyframes rowFlash {
  0%   { background: rgba(59,130,246,.25); }
  100% { background: transparent; }
}

.rank-pos {
  font-family: var(--mono); font-size: 13px; font-weight: 800;
  min-width: 22px; text-align: center; flex-shrink: 0;
  color: var(--muted);
}
.rank-pos.p1 { color: var(--gold); }
.rank-pos.p2 { color: var(--silver); }
.rank-pos.p3 { color: var(--bronze); }

.rank-slot-img {
  width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
  background: var(--s3); border: 1px solid var(--b2);
  overflow: hidden; display: flex; align-items: center; justify-content: center;
  position: relative;
}
.rank-slot-img img { width: 100%; height: 100%; object-fit: cover; }
.rank-slot-img .unopened-icon {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,.5);
}

.rank-info { flex: 1; min-width: 0; }
.rank-slot-name {
  font-size: 13px; font-weight: 700; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rank-user-row { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
.rank-username {
  font-size: 11px; font-weight: 700; color: #60a5fa;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rank-username.leader-name { color: var(--gold); }

.rank-result { flex-shrink: 0; text-align: right; }
.rank-multi {
  font-family: var(--mono); font-size: 16px; font-weight: 900; color: var(--text);
  line-height: 1;
}
.rank-multi.leader-multi { color: var(--gold); }
.rank-payment { font-size: 11px; font-weight: 700; color: #4ade80; margin-top: 1px; }
.rank-waiting {
  font-size: 11px; font-weight: 600; color: rgba(255,255,255,.2);
  font-style: italic;
}
.rank-pts {
  font-size: 10px; font-weight: 800; color: #a78bfa; margin-top: 1px;
}

/* ── EMPTY ── */
.empty {
  flex: 1; display: flex; align-items: center; justify-content: center;
  flex-direction: column; gap: 10px; opacity: .3; padding: 24px;
}
.empty-txt {
  font-size: 13px; font-weight: 700; letter-spacing: .07em;
  text-transform: uppercase; color: var(--muted2);
}

/* ── TICKER ── */
.ticker {
  height: 40px; background: var(--s1);
  border-top: 1px solid var(--b2);
  display: flex; align-items: center;
  overflow: hidden; flex-shrink: 0;
}
.ticker-track {
  display: flex; align-items: center; gap: 64px; white-space: nowrap;
  animation: tickRun 35s linear infinite;
}
@keyframes tickRun {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.tick-item {
  font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
  color: rgba(255,255,255,.25); display: flex; align-items: center; gap: 10px;
}
.tick-item span { color: var(--blue); }
.tick-dot {
  width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,.15);
}
`

// ── Avatar ─────────────────────────────────────────────────────────────────────
// Uses Supabase profile pic first, falls back to unavatar.io (Twitch CDN proxy)
function Avatar({ username, size = 32, avatarUrl }) {
  const colors = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ec4899','#8b5cf6','#ef4444','#14b8a6']
  const color  = colors[(username || '').charCodeAt(0) % colors.length]
  const init   = (username || '?').slice(0, 2).toUpperCase()
  // Try profile pic → unavatar fallback → initials
  const twitchFallback = username
    ? `https://unavatar.io/twitch/${encodeURIComponent(username.toLowerCase())}?fallback=false`
    : null
  const [src, setSrc] = useState(avatarUrl || twitchFallback)
  const [failed, setFailed] = useState(false)

  // Update src when avatarUrl arrives later
  useEffect(() => {
    if (avatarUrl) setSrc(avatarUrl)
  }, [avatarUrl])

  // Try next source on error
  const handleErr = () => {
    if (src === avatarUrl && twitchFallback) {
      setSrc(twitchFallback)
    } else {
      setFailed(true)
    }
  }

  return (
    <div className="e-av" style={{
      width: size, height: size,
      background: (!src || failed) ? color + '22' : 'transparent',
      borderColor: color + '50',
      color, fontSize: size * 0.36,
      overflow: 'hidden',
    }}>
      {src && !failed
        ? <img src={src} alt={username} onError={handleErr}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }} />
        : init
      }
    </div>
  )
}

function PtsIcon({ size = 11, color = '#fbbf24' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
}

// ── ScrollList ─────────────────────────────────────────────────────────────────
function ScrollList({ children, count }) {
  const wrapRef  = useRef(null)
  const innerRef = useRef(null)
  const posRef   = useRef(0)
  const rafRef   = useRef(null)
  const cloneRef = useRef(null)

  useEffect(() => {
    const wrap  = wrapRef.current
    const inner = innerRef.current
    if (!wrap || !inner) return
    if (cloneRef.current) { cloneRef.current.remove(); cloneRef.current = null }
    posRef.current = 0
    inner.style.transform = 'translateY(0)'

    const t = setTimeout(() => {
      if (inner.scrollHeight <= wrap.clientHeight) return
      const clone = inner.cloneNode(true)
      clone.setAttribute('aria-hidden', 'true')
      wrap.appendChild(clone)
      cloneRef.current = clone

      let lastTs = 0
      function tick(ts) {
        const dt = lastTs ? Math.min(ts - lastTs, 33) : 16.7
        lastTs = ts
        posRef.current += 0.55 * (dt / 16.7)
        const h = inner.scrollHeight
        if (posRef.current >= h) posRef.current -= h
        const y = posRef.current
        inner.style.transform = `translateY(${-y}px)`
        if (cloneRef.current) cloneRef.current.style.transform = `translateY(${-y}px)`
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }, 300)

    return () => {
      clearTimeout(t)
      cancelAnimationFrame(rafRef.current)
      if (cloneRef.current) { cloneRef.current.remove(); cloneRef.current = null }
    }
  }, [count])

  return (
    <div className="entries" ref={wrapRef}>
      <div className="entries-inner" ref={innerRef}>{children}</div>
    </div>
  )
}

// ── PrizeBar ───────────────────────────────────────────────────────────────────
function PrizeBar({ game }) {
  const pts1 = game?.points_1st || 0
  const pts2 = game?.points_2nd || 0
  const pts3 = game?.points_3rd || 0
  const cash = game?.prize_cash_1st || 0
  return (
    <div className="prizes">
      {[
        { rank: '1ST', cls: 'gold',   pts: pts1, cash },
        { rank: '2ND', cls: 'silver', pts: pts2 },
        { rank: '3RD', cls: 'bronze', pts: pts3 },
      ].map(({ rank, cls, pts, cash: c }) => (
        <div key={rank} className={`prize${cls === 'gold' ? ' prize-gold' : ''}`}>
          <div className={`p-rank ${cls}`}>{rank}</div>
          <div className="p-pts">
            <PtsIcon color={cls === 'gold' ? '#fbbf24' : cls === 'silver' ? '#94a3c0' : '#c07a4a'} size={10} />
            {pts.toLocaleString('en-GB')}
          </div>
          {c > 0 && <div className="p-cash">+€{c}</div>}
        </div>
      ))}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function PickOverlay() {
  const [pickGame,    setPickGame]    = useState(null)
  const [picks,       setPicks]       = useState([])
  const [entriesMap,  setEntriesMap]  = useState({})   // id → { slot, payment, bet, opened }
  const [bonusEntries,setBonusEntries]= useState([])   // full list for live ranking

  const [gtbGame,    setGtbGame]    = useState(null)
  const [gtbEntries, setGtbEntries] = useState([])

  const [avgGame,    setAvgGame]    = useState(null)
  const [avgEntries, setAvgEntries] = useState([])

  const [avatarMap,  setAvatarMap]  = useState({})
  const [newPickIds, setNewPickIds] = useState(new Set())
  const prevPickIds = useRef(new Set())

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    // All 3 games independent — no dependency on active bonus hunt
    const [
      { data: pgData },
      { data: gtbData },
      { data: avgData },
    ] = await Promise.all([
      supabase.from('pick_games')
        .select('*')
        .in('status', ['open', 'closed', 'finished'])
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('gtb_games')
        .select('*')
        .in('status', ['open', 'closed', 'finished'])
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('avg_multi_games')
        .select('*')
        .in('status', ['open', 'closed', 'finished'])
        .order('created_at', { ascending: false }).limit(1),
    ])

    // ── Pick & Win ──
    const pg = pgData?.[0] || null
    setPickGame(pg)

    if (pg) {
      // Load picks
      const { data: ps } = await supabase
        .from('picks').select('*').eq('game_id', pg.id)
        .order('picked_at', { ascending: false })
      const incoming = ps || []
      const newIds = new Set(incoming.filter(p => !prevPickIds.current.has(p.id)).map(p => p.id))
      prevPickIds.current = new Set(incoming.map(p => p.id))
      if (newIds.size) {
        setNewPickIds(newIds)
        setTimeout(() => setNewPickIds(new Set()), 3500)
      }
      setPicks(incoming)

      // Load bonus_entries + slots separately (avoids FK join issues in OBS CEF)
      if (pg.hunt_id) {
        const { data: bes } = await supabase
          .from('bonus_entries')
          .select('id, slot_id, payment, bet, opened')
          .eq('hunt_id', pg.hunt_id)
        const beList = bes || []
        setBonusEntries(beList)

        const slotIds = [...new Set(beList.map(e => e.slot_id).filter(Boolean))]
        let slotMap = {}
        if (slotIds.length) {
          const { data: slots } = await supabase
            .from('slots').select('id, name, image_url, provider').in('id', slotIds)
          for (const s of (slots || [])) slotMap[s.id] = s
        }
        const eMap = {}
        for (const e of beList)
          eMap[e.id] = { ...e, slot: slotMap[e.slot_id] || null }
        setEntriesMap(eMap)
      }
    } else {
      setPicks([])
    }

    // ── GTB ──
    const gg = gtbData?.[0] || null
    setGtbGame(gg)
    if (gg) {
      const { data: ge } = await supabase
        .from('gtb_entries').select('*').eq('game_id', gg.id)
        .order('guess', { ascending: false })
      setGtbEntries(ge || [])
    } else { setGtbEntries([]) }

    // ── Avg Multi ──
    const ag = avgData?.[0] || null
    setAvgGame(ag)
    if (ag) {
      const { data: ae } = await supabase
        .from('avg_multi_entries').select('*').eq('game_id', ag.id)
        .order('created_at', { ascending: false })
      setAvgEntries(ae || [])
    } else { setAvgEntries([]) }
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('pick-overlay-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'picks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_games' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bonus_entries' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gtb_entries' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gtb_games' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avg_multi_entries' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avg_multi_games' }, load)
      .subscribe()
    return () => ch.unsubscribe()
  }, [load])

  // ── Avatars ────────────────────────────────────────────────────────────────
  const fetchAvatars = useCallback(async (usernames) => {
    if (!usernames.length) return
    const lower = usernames.map(u => u.toLowerCase())
    const { data } = await supabasePublic
      .from('profiles').select('twitch_username, avatar_url').in('twitch_username', lower)
    if (!data) return
    const map = {}
    for (const row of data)
      if (row.twitch_username && row.avatar_url)
        map[row.twitch_username.toLowerCase()] = row.avatar_url
    setAvatarMap(prev => ({ ...prev, ...map }))
  }, [])

  useEffect(() => {
    const names = [
      ...picks.map(p => p.twitch_username),
      ...gtbEntries.map(e => e.twitch_username),
      ...avgEntries.map(e => e.twitch_username),
    ].filter(Boolean)
    const unique  = [...new Set(names.map(n => n.toLowerCase()))]
    const missing = unique.filter(n => !avatarMap[n])
    if (missing.length) fetchAvatars(missing)
  }, [picks, gtbEntries, avgEntries]) // eslint-disable-line

  // ── Scale ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const scale = Math.min(window.innerWidth / 1500, window.innerHeight / 900, 1)
      document.documentElement.style.setProperty('--scale', scale)
    }
    setTimeout(update, 50)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────
  const openGames = [pickGame, gtbGame, avgGame].filter(g => g?.status === 'open')
  const closesAt  = openGames.reduce((a, g) => (!a || g.closes_at < a ? g.closes_at : a), null)
  const secs      = useCountdown(closesAt)
  const isLive    = openGames.length > 0

  const totalEntries = picks.length + gtbEntries.length + avgEntries.length

  const bucketCounts = {}
  for (const e of avgEntries) {
    const k = e.bucket || 'A'
    bucketCounts[k] = (bucketCounts[k] || 0) + 1
  }

  const gtbAvg = gtbEntries.length > 0
    ? gtbEntries.reduce((s, e) => s + parseBet(e.guess), 0) / gtbEntries.length
    : null

  const avgResult = avgGame?.result_avg

  // ── Live ranking for Pick & Win ──────────────────────────────────────────
  // For each pick, join with bonusEntries to get payment/bet/multi live
  const liveRanking = picks.map(p => {
    const entry   = entriesMap[p.entry_id]
    const payment = entry?.payment != null ? parseBet(entry.payment) : null
    const bet     = entry?.bet     != null ? parseBet(entry.bet)     : null
    const multi   = payment != null && bet > 0 ? payment / bet : null
    const opened  = entry?.opened ?? false
    return { pick: p, entry, payment, bet, multi, opened }
  }).sort((a, b) => {
    // Sort: opened with payment first (by payment desc), then unopened
    if (a.payment != null && b.payment == null) return -1
    if (a.payment == null && b.payment != null) return 1
    if (a.payment != null && b.payment != null) return b.payment - a.payment
    return 0
  })

  // Current leader (highest payment, opened)
  const liveLeader = liveRanking.find(r => r.payment != null)

  // Progress: how many slots opened out of total picks
  const openedCount = liveRanking.filter(r => r.opened).length

  const gtbWinner  = gtbGame?.status  === 'finished'
    ? [...gtbEntries].sort((a,b) => parseBet(a.gap ?? 999999) - parseBet(b.gap ?? 999999))[0]
    : null
  const avgWinner  = avgGame?.status  === 'finished'
    ? [...avgEntries].sort((a,b) => parseBet(a.gap ?? 999999) - parseBet(b.gap ?? 999999))[0]
    : null
  const pickWinner = pickGame?.status === 'finished'
    ? picks.find(p => p.rank === 1)
    : null

  // ── Ticker items ──────────────────────────────────────────────────────────
  const tickerItems = [
    ['JOIN AT', 'JRALHA.COM'],
    ['PICK & WIN', '100 PTS ENTRY'],
    ['GUESS THE BALANCE', '100 PTS ENTRY'],
    ['AVG MULTI', '100 PTS ENTRY'],
    ['BONUS HUNT', 'AO VIVO'],
  ]

  return (
    <div className="wrap">
      <style>{CSS}</style>
      <div className="root">

        {/* ── HEADER ── */}
        <div className="hd">
          <div className="hd-dot" />
          <div className="hd-sep" />
          <div className="hd-title">Mini-Games</div>
          <div className="hd-sep" />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" style={{ opacity:.6 }}>
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <div className={`hd-timer${isLive && secs < 30 ? ' urgent' : ''}`}>
            {isLive ? fmtTime(secs) : '—:——'}
          </div>
          <div className="hd-sep" />
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'rgba(255,255,255,.4)' }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <div className="hd-entries">
            <span className="hd-entries-n">{totalEntries}</span>
            entradas
          </div>
          <div className="hd-spacer" />
          <div className="hd-site">jralha.com</div>
        </div>

        {/* ── COLUMNS ── */}
        <div className="cols">

          {/* ── PICK & WIN ── */}
          <div className="col col-pick">
            <div className="col-hd">
              <div className="col-hd-left">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span className="col-name">Pick &amp; Win</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="col-count" style={{ color: '#fbbf24' }}>{picks.length}</div>
                <span className="col-count-lbl">picks</span>
              </div>
            </div>

            <PrizeBar game={pickGame} />

            {/* Winner card (only when finished) */}
            {pickWinner && (() => {
              const slot = entriesMap[pickWinner.entry_id]?.slot
              const av   = avatarMap[pickWinner.twitch_username?.toLowerCase()]
              return (
                <div className="winner-card">
                  <div className="wc-row">
                    <div className="wc-crown">👑</div>
                    <Avatar username={pickWinner.twitch_username} size={36} avatarUrl={av}/>
                    <div>
                      <div className="wc-name">{pickWinner.twitch_username}</div>
                      {slot && <div className="wc-detail">{slot.name}</div>}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Progress bar — slots abertos */}
            {picks.length > 0 && (
              <div className="prog-wrap">
                <div className="prog-track">
                  <div className="prog-fill" style={{ width: `${picks.length > 0 ? Math.round((openedCount / picks.length) * 100) : 0}%` }}/>
                </div>
                <span className="prog-lbl">{openedCount}/{picks.length} abertos</span>
              </div>
            )}

            <div className="col-subhd">
              <div className="col-subhd-name">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                {openedCount > 0 ? 'Live Ranking' : 'Picks'}
              </div>
            </div>

            <ScrollList count={picks.length + openedCount}>
              {liveRanking.length === 0 ? (
                <div className="empty">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  <div className="empty-txt">Sem picks ainda</div>
                </div>
              ) : liveRanking.map((r, i) => {
                const { pick: p, entry, payment, bet, multi, opened } = r
                const slot       = entry?.slot
                const av         = avatarMap[p.twitch_username?.toLowerCase()]
                const isLeader   = liveLeader?.pick.id === p.id
                const isNew      = newPickIds.has(p.id)
                const isFinished = pickGame?.status === 'finished'
                const posClass   = i === 0 ? 'p1' : i === 1 ? 'p2' : i === 2 ? 'p3' : ''
                const awarded    = p.points_awarded > 0

                return (
                  <div key={p.id}
                    className={[
                      'rank-row',
                      isLeader && !isFinished ? 'leader' : '',
                      opened ? 'opened' : 'unopened',
                      isNew ? 'new-flash' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {/* Position */}
                    <div className={`rank-pos ${posClass}`}>
                      {isFinished && p.rank === 1 ? '👑' : `#${i+1}`}
                    </div>

                    {/* Slot image */}
                    <div className="rank-slot-img">
                      {slot?.image_url
                        ? <img src={slot.image_url} alt={slot.name} onError={e => e.target.style.opacity='.2'}/>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/></svg>
                      }
                      {!opened && (
                        <div className="unopened-icon">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" strokeLinecap="round">
                            <rect x="3" y="11" width="18" height="11" rx="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="rank-info">
                      <div className="rank-slot-name">
                        {slot?.name || `Slot #${p.entry_id}`}
                        {isNew && <span className="new-badge">NEW</span>}
                      </div>
                      <div className="rank-user-row">
                        <Avatar username={p.twitch_username} size={16} avatarUrl={av}/>
                        <div className={`rank-username${isLeader && !isFinished ? ' leader-name' : ''}`}>
                          {p.twitch_username}
                        </div>
                      </div>
                    </div>

                    {/* Result */}
                    <div className="rank-result">
                      {payment != null ? (
                        <>
                          <div className={`rank-multi${isLeader && !isFinished ? ' leader-multi' : ''}`}>
                            {multi != null ? `${multi.toFixed(1)}x` : '—'}
                          </div>
                          <div className="rank-payment">{fmtEur(payment)}</div>
                          {awarded && <div className="rank-pts">+{p.points_awarded.toLocaleString('en-GB')} PTS</div>}
                        </>
                      ) : (
                        <div className="rank-waiting">aguarda</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </ScrollList>
          </div>

          {/* ── GUESS THE BALANCE ── */}
          <div className="col col-gtb">
            <div className="col-hd">
              <div className="col-hd-left">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                <span className="col-name">Guess the Balance</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="col-count" style={{ color: '#22c55e' }}>{gtbEntries.length}</div>
                <span className="col-count-lbl">guesses</span>
              </div>
            </div>

            {/* GTB average stat */}
            <div style={{
              padding: '8px 16px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Avg guess</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 900, color: '#22c55e' }}>
                {gtbAvg ? `€${gtbAvg.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}` : '—'}
              </span>
            </div>

            <PrizeBar game={gtbGame} />

            {gtbWinner && (
              <div className="winner-card">
                <div className="wc-row">
                  <div className="wc-crown">👑</div>
                  <div>
                    <div className="wc-name">{gtbWinner.twitch_username}</div>
                    <div className="wc-detail">
                      Guess: {fmtEur(gtbWinner.guess)} · ±€{parseBet(gtbWinner.gap).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="col-subhd">
              <div className="col-subhd-name">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                Guesses (maior → menor)
              </div>
            </div>

            <ScrollList count={gtbEntries.length}>
              {gtbEntries.length === 0 ? (
                <div className="empty">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                    <line x1="12" y1="1" x2="12" y2="23"/>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                  <div className="empty-txt">Sem guesses ainda</div>
                </div>
              ) : [...gtbEntries].sort((a,b) => parseBet(b.guess) - parseBet(a.guess)).map((e, i) => {
                const rc    = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : ''
                const isWin = e.rank === 1 && gtbGame?.status === 'finished'
                const av    = avatarMap[e.twitch_username?.toLowerCase()]
                return (
                  <div key={e.id} className={`entry entry-new${isWin ? ' winner' : ''}`}
                    style={{ animationDelay: `${i * 0.04}s` }}>
                    <div className={`e-rank ${rc}`}>{isWin ? '👑' : `#${i+1}`}</div>
                    <Avatar username={e.twitch_username} avatarUrl={av}/>
                    <div className="e-info">
                      <div className="e-user">{e.twitch_username}</div>
                      {e.gap != null && <div className="e-sub">±€{parseBet(e.gap).toFixed(2)}</div>}
                    </div>
                    <div className={`e-val ${rc}`}>{fmtEur(e.guess)}</div>
                  </div>
                )
              })}
            </ScrollList>
          </div>

          {/* ── AVG MULTI ── */}
          <div className="col col-avg">
            <div className="col-hd">
              <div className="col-hd-left">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                  <polyline points="17 6 23 6 23 12"/>
                </svg>
                <span className="col-name">Avg Multi</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="col-count" style={{ color: '#3b82f6' }}>{avgEntries.length}</div>
                <span className="col-count-lbl">entries</span>
              </div>
            </div>

            {/* Result stat */}
            <div style={{
              padding: '8px 16px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Resultado</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 900, color: '#3b82f6' }}>
                {avgResult ? `${avgResult}x` : '—'}
              </span>
            </div>

            <PrizeBar game={avgGame} />

            {avgWinner && (
              <div className="winner-card">
                <div className="wc-row">
                  <div className="wc-crown">👑</div>
                  <div>
                    <div className="wc-name">{avgWinner.twitch_username}</div>
                    <div className="wc-detail">
                      Guess: {parseBet(avgWinner.guess).toFixed(1)}x · ±{parseBet(avgWinner.gap).toFixed(1)}x
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="col-subhd">
              <div className="col-subhd-name">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                  <polyline points="17 6 23 6 23 12"/>
                </svg>
                Grupos
              </div>
            </div>

            <div className="buckets">
              {BUCKETS.map(b => {
                const count = bucketCounts[b.id] || 0
                const pct   = avgEntries.length > 0 ? Math.round((count / avgEntries.length) * 100) : 0
                return (
                  <div key={b.id} className="bucket" style={{
                    background:  b.color + '12',
                    borderColor: count > 0 ? b.color + '50' : 'transparent',
                  }}>
                    <div className="b-left">
                      <div className="b-id" style={{ color: b.color }}>{b.id}</div>
                      <div className="b-lbl">{b.label}</div>
                    </div>
                    <div className="b-pct" style={{ color: count > 0 ? b.color : 'rgba(255,255,255,.15)' }}>
                      {pct}%
                    </div>
                  </div>
                )
              })}
            </div>

            <ScrollList count={avgEntries.length}>
              {avgEntries.length === 0 ? (
                <div className="empty">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                    <polyline points="17 6 23 6 23 12"/>
                  </svg>
                  <div className="empty-txt">Sem entradas ainda</div>
                </div>
              ) : avgEntries.map((e, i) => {
                const bucket = BUCKETS.find(b => b.id === e.bucket)
                const isWin  = e.rank === 1 && avgGame?.status === 'finished'
                const av     = avatarMap[e.twitch_username?.toLowerCase()]
                return (
                  <div key={e.id} className={`entry entry-new${isWin ? ' winner' : ''}`}
                    style={{ animationDelay: `${i * 0.04}s` }}>
                    <div className={`e-rank ${i < 3 ? 'r'+(i+1) : ''}`}>{isWin ? '👑' : `#${i+1}`}</div>
                    <Avatar username={e.twitch_username} avatarUrl={av}/>
                    <div className="e-info">
                      <div className="e-user">{e.twitch_username}</div>
                      {e.gap != null && <div className="e-sub">±{parseBet(e.gap).toFixed(1)}x</div>}
                    </div>
                    {bucket && (
                      <div style={{
                        fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 800,
                        color: bucket.color,
                        background: bucket.color + '18',
                        border: `1px solid ${bucket.color}44`,
                        borderRadius: 6, padding: '2px 8px', flexShrink: 0,
                      }}>
                        {bucket.id}
                      </div>
                    )}
                  </div>
                )
              })}
            </ScrollList>
          </div>

        </div>

        {/* ── TICKER ── */}
        <div className="ticker">
          <div className="ticker-track">
            {[0, 1].map(ri => (
              <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 64 }}>
                {tickerItems.map(([lbl, val], ti) => (
                  <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: 64 }}>
                    <div className="tick-item">{lbl} <span>{val}</span></div>
                    <div className="tick-dot" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}