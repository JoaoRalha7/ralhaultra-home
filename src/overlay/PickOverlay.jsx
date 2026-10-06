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
  { id: 'B', label: '66-75x',  color: '#8b5cf6' },
  { id: 'C', label: '76-85x',  color: '#ec4899' },
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
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');

html, body { background: transparent !important; margin: 0; padding: 0; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }

:root {
  --bg:      #07090f;
  --s1:      #0d1017;
  --s2:      #131622;
  --s3:      #181c2a;
  --border:  rgba(255,255,255,.07);
  --border2: rgba(255,255,255,.13);
  --text:    #e8ecf5;
  --muted:   #6b7280;
  --muted2:  #9099b8;
  --gold:    #f5c842;
  --silver:  #94a3c0;
  --bronze:  #c07a4a;
  --blue:    #3b82f6;
  --green:   #22c55e;
  --red:     #ef4444;
  --ff: 'Barlow', system-ui, sans-serif;
  --fd: 'Barlow Condensed', system-ui, sans-serif;
}

.root {
  width: 1500px; height: 1500px;
  background: var(--bg);
  display: flex; flex-direction: column;
  font-family: var(--ff);
  overflow: hidden;
}

/* TOP BAR */
.topbar {
  height: 72px;
  background: var(--s1);
  border-bottom: 1px solid var(--border2);
  display: flex; align-items: center;
  padding: 0 32px; gap: 20px;
  flex-shrink: 0;
  position: relative; overflow: hidden;
}
.topbar::before {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(59,130,246,.07) 0%, transparent 55%);
  pointer-events: none;
}
.tb-live { display: flex; align-items: center; gap: 9px; }
.tb-dot {
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--red);
  box-shadow: 0 0 10px rgba(239,68,68,.9);
  animation: blink 1.4s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
.tb-live-label {
  font-family: var(--fd); font-size: 13px; font-weight: 700;
  letter-spacing: .14em; text-transform: uppercase;
  color: rgba(255,255,255,.35);
}
.tb-sep { width: 1px; height: 26px; background: var(--border2); }
.tb-title {
  font-family: var(--fd); font-size: 26px; font-weight: 900;
  letter-spacing: .05em; text-transform: uppercase; color: var(--text);
}
.tb-timer-wrap { display: flex; align-items: center; gap: 8px; }
.tb-timer {
  font-family: var(--fd); font-size: 30px; font-weight: 900;
  color: var(--gold); letter-spacing: .06em; min-width: 88px;
}
.tb-timer.urgent { color: var(--red); animation: urgentPulse .7s ease-in-out infinite; }
@keyframes urgentPulse { 0%,100%{opacity:1} 50%{opacity:.55} }
.tb-entries {
  font-size: 15px; font-weight: 600; color: var(--muted2);
  display: flex; align-items: center; gap: 7px; margin-left: 4px;
}
.tb-entries-count {
  font-family: var(--fd); font-size: 20px; font-weight: 800; color: var(--text);
}
.tb-spacer { flex: 1; }
.tb-site {
  font-family: var(--fd); font-size: 17px; font-weight: 800;
  letter-spacing: .12em; text-transform: uppercase;
  color: rgba(255,255,255,.2);
}

/* STAT BANNERS (average + entries count like the screenshot) */
.col-stat {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  background: var(--s2);
  border-bottom: 1px solid var(--border2);
  flex-shrink: 0;
}
.col-stat-left { display: flex; flex-direction: column; gap: 1px; }
.col-stat-label {
  font-family: var(--fd); font-size: 11px; font-weight: 700;
  letter-spacing: .12em; text-transform: uppercase; color: var(--muted2);
  display: flex; align-items: center; gap: 6px;
}
.col-stat-value {
  font-family: var(--fd); font-size: 28px; font-weight: 900;
  color: var(--text); letter-spacing: .02em; line-height: 1;
}
.col-stat-right {
  display: flex; flex-direction: column; align-items: center;
  background: rgba(255,255,255,.05);
  border: 1px solid var(--border2);
  border-radius: 10px;
  padding: 8px 16px;
  gap: 0;
}
.col-stat-count {
  font-family: var(--fd); font-size: 28px; font-weight: 900;
  color: var(--text); line-height: 1;
}
.col-stat-entries-label {
  font-size: 10px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: var(--muted2);
}

/* 3 COLS */
.cols {
  flex: 1;
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  overflow: hidden;
}
.col {
  display: flex; flex-direction: column;
  border-right: 1px solid var(--border);
  overflow: hidden;
}
.col:last-child { border-right: none; }

/* PRIZE BAR */
.prizes {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.prize {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 10px 4px; gap: 2px;
  border-right: 1px solid var(--border);
  position: relative; overflow: hidden;
}
.prize:last-child { border-right: none; }
.prize.p-gold::before {
  content: '';
  position: absolute; inset: 0;
  background: rgba(245,200,66,.055);
  pointer-events: none;
}
.p-rank {
  font-family: var(--fd); font-size: 11px; font-weight: 700;
  letter-spacing: .12em; text-transform: uppercase;
}
.p-rank.gold   { color: var(--gold); }
.p-rank.silver { color: var(--silver); }
.p-rank.bronze { color: var(--bronze); }
.p-pts {
  font-family: var(--fd); font-size: 20px; font-weight: 900;
  color: #fff; display: flex; align-items: center; gap: 4px;
}
.p-cash { font-size: 11px; font-weight: 700; color: var(--green); }

/* COL HEADER */
.col-head {
  padding: 11px 18px 9px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0;
}
.col-name {
  font-family: var(--fd); font-size: 15px; font-weight: 900;
  letter-spacing: .07em; text-transform: uppercase;
  color: var(--text); display: flex; align-items: center; gap: 7px;
}
.col-sub { font-size: 11px; color: var(--muted); }

/* ENTRIES SCROLL */
.entries { flex: 1; overflow: hidden; position: relative; }
.entries-inner { display: flex; flex-direction: column; }

/* ENTRY ROW */
.entry {
  display: flex; align-items: center; gap: 11px;
  padding: 10px 18px;
  border-bottom: 1px solid rgba(255,255,255,.035);
  position: relative;
}
.entry:last-child { border-bottom: none; }
.entry-new { animation: entrySlide .38s cubic-bezier(.34,1.56,.64,1) both; }
@keyframes entrySlide {
  from { opacity: 0; transform: translateX(-16px) scale(.97); }
  to   { opacity: 1; transform: none; }
}

/* winner glow */
.entry.is-winner {
  background: linear-gradient(90deg, rgba(245,200,66,.08) 0%, transparent 70%);
}
.entry.is-winner::before {
  content: '';
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--gold);
  box-shadow: 0 0 10px rgba(245,200,66,.7);
}

.e-rank {
  font-family: var(--fd); font-size: 15px; font-weight: 800;
  color: var(--muted); min-width: 26px; text-align: center; flex-shrink: 0;
}
.e-rank.r1 { color: var(--gold); }
.e-rank.r2 { color: var(--silver); }
.e-rank.r3 { color: var(--bronze); }

.e-avatar {
  border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--fd); font-weight: 800;
  border: 1.5px solid transparent;
  overflow: hidden;
}
.e-info { flex: 1; min-width: 0; }
.e-user {
  font-size: 15px; font-weight: 600; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.e-sub { font-size: 11px; color: var(--muted2); margin-top: 1px; }
.e-val {
  font-family: var(--fd); font-size: 18px; font-weight: 900;
  color: var(--text); flex-shrink: 0;
}
.e-val.r1 { color: var(--gold); }
.e-val.r2 { color: var(--silver); }
.e-val.r3 { color: var(--bronze); }

/* NEW badge */
.new-badge {
  font-family: var(--fd); font-size: 10px; font-weight: 800;
  letter-spacing: .1em; background: var(--blue); color: #fff;
  border-radius: 4px; padding: 1px 6px; margin-left: 6px;
  animation: badgePop .4s cubic-bezier(.34,1.56,.64,1);
  vertical-align: middle; display: inline-block;
}
@keyframes badgePop {
  from { opacity: 0; transform: scale(.4); }
  to   { opacity: 1; transform: scale(1); }
}

/* WINNER CARD */
.winner-card {
  margin: 12px 18px 4px;
  border-radius: 10px; padding: 12px 16px;
  border: 1px solid rgba(245,200,66,.3);
  background: rgba(245,200,66,.05);
  position: relative; overflow: hidden;
  animation: winnerGlow 2.4s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes winnerGlow {
  0%,100% { border-color: rgba(245,200,66,.3); box-shadow: none; }
  50%      { border-color: rgba(245,200,66,.7); box-shadow: 0 0 20px rgba(245,200,66,.12); }
}
.winner-card::after {
  content: 'WINNER';
  position: absolute; top: 8px; right: 12px;
  font-family: var(--fd); font-size: 10px; font-weight: 800;
  letter-spacing: .14em; color: var(--gold); opacity: .5;
}
.wc-row { display: flex; align-items: center; gap: 9px; }
.wc-crown { font-size: 24px; flex-shrink: 0; animation: crownFloat 2s ease-in-out infinite; }
@keyframes crownFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
.wc-name {
  font-family: var(--fd); font-size: 22px; font-weight: 900; color: var(--gold);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wc-detail { font-size: 11px; color: var(--muted2); margin-top: 3px; }

/* PICK SLOT ROW */
.pick-slot {
  display: flex; align-items: center; gap: 11px;
  padding: 10px 18px;
  border-bottom: 1px solid rgba(255,255,255,.035);
  position: relative;
}
.pick-slot:last-child { border-bottom: none; }
.pick-slot.entry-new { animation: entrySlide .38s cubic-bezier(.34,1.56,.64,1) both; }
.pick-slot.is-winner {
  background: linear-gradient(90deg, rgba(245,200,66,.08) 0%, transparent 70%);
}
.pick-slot.is-winner::before {
  content: '';
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--gold); box-shadow: 0 0 10px rgba(245,200,66,.7);
}

.pick-num {
  font-family: var(--fd); font-size: 15px; font-weight: 800;
  color: var(--muted); min-width: 26px; text-align: center; flex-shrink: 0;
}
.pick-img-wrap {
  width: 42px; height: 42px; border-radius: 9px;
  background: var(--s3); flex-shrink: 0;
  border: 1px solid var(--border2);
  overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.pick-img-wrap img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; }
.pick-info { flex: 1; min-width: 0; }
.pick-name {
  font-size: 14px; font-weight: 600; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pick-provider { font-size: 11px; color: var(--muted); margin-top: 1px; }
.pick-user { display: flex; align-items: center; gap: 5px; margin-top: 3px; }
.pick-user-name {
  font-size: 12px; font-weight: 700; color: #60a5fa;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* BUCKETS */
.buckets-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 7px; padding: 12px 18px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.bucket-btn {
  border-radius: 9px; padding: 9px 12px;
  display: flex; align-items: center; justify-content: space-between;
  border: 1.5px solid transparent;
}
.b-id   { font-family: var(--fd); font-size: 15px; font-weight: 900; }
.b-label { font-size: 11px; font-weight: 600; color: rgba(255,255,255,.55); }
.b-pct  { font-family: var(--fd); font-size: 18px; font-weight: 900; }

/* EMPTY STATE */
.empty {
  flex: 1; display: flex; align-items: center; justify-content: center;
  flex-direction: column; gap: 12px; padding: 32px; opacity: .3;
}
.empty-text {
  font-family: var(--fd); font-size: 15px; font-weight: 700;
  color: var(--muted2); letter-spacing: .07em; text-transform: uppercase;
}

/* TICKER */
.ticker {
  height: 48px; background: var(--s1);
  border-top: 1px solid var(--border2);
  display: flex; align-items: center;
  overflow: hidden; flex-shrink: 0;
}
.ticker-track {
  display: flex; align-items: center; gap: 72px;
  white-space: nowrap;
  animation: tickerRun 32s linear infinite;
}
@keyframes tickerRun {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.ticker-item {
  font-family: var(--fd); font-size: 14px; font-weight: 700;
  color: rgba(255,255,255,.3); letter-spacing: .1em;
  text-transform: uppercase;
  display: flex; align-items: center; gap: 12px;
}
.ticker-item span { color: var(--blue); }
.ticker-dot {
  width: 4px; height: 4px; border-radius: 50%;
  background: rgba(255,255,255,.18); flex-shrink: 0;
}
`

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ username, size = 38, avatarUrl }) {
  const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444']
  const color  = colors[(username || '').charCodeAt(0) % colors.length]
  const init   = (username || '?').slice(0, 2).toUpperCase()
  const [imgErr, setImgErr] = useState(false)
  const showImg = avatarUrl && !imgErr
  return (
    <div className="e-avatar" style={{
      width: size, height: size,
      background: showImg ? 'transparent' : color + '20',
      borderColor: color + '50',
      color, fontSize: size * 0.37,
    }}>
      {showImg
        ? <img src={avatarUrl} alt={username} onError={() => setImgErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }} />
        : init
      }
    </div>
  )
}

function PtsIcon({ size = 11, color = '#f5c842' }) {
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
        { rank: '2ND', cls: 'silver', pts: pts2, cash: 0 },
        { rank: '3RD', cls: 'bronze', pts: pts3, cash: 0 },
      ].map(({ rank, cls, pts, cash: c }) => (
        <div key={rank} className={`prize${cls === 'gold' ? ' p-gold' : ''}`}>
          <div className={`p-rank ${cls}`}>{rank}</div>
          <div className="p-pts">
            <PtsIcon color={cls === 'gold' ? '#f5c842' : cls === 'silver' ? '#94a3c0' : '#c07a4a'} />
            {pts.toLocaleString('en-GB')}
          </div>
          {c > 0 && <div className="p-cash">+ €{c} cash</div>}
        </div>
      ))}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function PickOverlay() {
  const [pickGame,   setPickGame]   = useState(null)
  const [picks,      setPicks]      = useState([])
  const [entriesMap, setEntriesMap] = useState({})

  const [gtbGame,    setGtbGame]    = useState(null)
  const [gtbEntries, setGtbEntries] = useState([])

  const [avgGame,    setAvgGame]    = useState(null)
  const [avgEntries, setAvgEntries] = useState([])

  const [avatarMap,  setAvatarMap]  = useState({})
  const [newPickIds, setNewPickIds] = useState(new Set())
  const prevPickIds = useRef(new Set())

  const load = useCallback(async () => {
    const { data: h } = await supabase
      .from('bonus_hunts').select('*').eq('active', true).limit(1).single()
    if (!h) return

    const [
      { data: pgData },
      { data: gtbData },
      { data: avgData },
      { data: bonusEntries },
    ] = await Promise.all([
      supabase.from('pick_games').select('*').eq('hunt_id', h.id)
        .in('status', ['open', 'closed', 'finished'])
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('gtb_games').select('*').eq('hunt_id', h.id)
        .in('status', ['open', 'closed', 'finished'])
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('avg_multi_games').select('*').eq('hunt_id', h.id)
        .in('status', ['open', 'closed', 'finished'])
        .order('created_at', { ascending: false }).limit(1),
      // ✅ FIX: buscar bonus_entries separadamente (sem join problemático)
      supabase.from('bonus_entries')
        .select('id, slot:slots(name, image_url, provider)')
        .eq('hunt_id', h.id),
    ])

    const eMap = {}
    for (const e of (bonusEntries || [])) eMap[e.id] = e
    setEntriesMap(eMap)

    // Pick & Win — ✅ FIX: .select('*') simples, sem join
    const pg = pgData?.[0] || null
    setPickGame(pg)
    if (pg) {
      const { data: ps } = await supabase
        .from('picks')
        .select('*')
        .eq('game_id', pg.id)
        .order('created_at', { ascending: false })
      const incoming = ps || []
      const newIds = new Set(
        incoming.filter(p => !prevPickIds.current.has(p.id)).map(p => p.id)
      )
      prevPickIds.current = new Set(incoming.map(p => p.id))
      if (newIds.size) {
        setNewPickIds(newIds)
        setTimeout(() => setNewPickIds(new Set()), 3500)
      }
      setPicks(incoming)
    } else { setPicks([]) }

    // GTB
    const gg = gtbData?.[0] || null
    setGtbGame(gg)
    if (gg) {
      const { data: ge } = await supabase
        .from('gtb_entries').select('*').eq('game_id', gg.id)
        .order('guess', { ascending: false })
      setGtbEntries(ge || [])
    } else { setGtbEntries([]) }

    // Avg Multi
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
    const ch = supabase.channel('ranking-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'picks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_games' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gtb_entries' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gtb_games' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avg_multi_entries' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avg_multi_games' }, load)
      .subscribe()
    return () => ch.unsubscribe()
  }, [load])

  // ✅ FIX: buscar avatares do Supabase público (supabasePublic, não supabase)
  const fetchAvatars = useCallback(async (usernames) => {
    if (!usernames.length) return
    const lower = usernames.map(u => u.toLowerCase())
    const { data } = await supabasePublic
      .from('profiles')
      .select('twitch_username, avatar_url')
      .in('twitch_username', lower)
    if (!data) return
    const map = {}
    for (const row of data) {
      if (row.twitch_username && row.avatar_url)
        map[row.twitch_username.toLowerCase()] = row.avatar_url
    }
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

  const openGames = [pickGame, gtbGame, avgGame].filter(g => g?.status === 'open')
  const closesAt  = openGames.length > 0
    ? openGames.reduce((a, g) => !a || g.closes_at < a ? g.closes_at : a, null)
    : null
  const secs   = useCountdown(closesAt)
  const isLive = openGames.length > 0

  const totalEntries = picks.length + gtbEntries.length + avgEntries.length

  // Bucket counts
  const bucketCounts = {}
  for (const e of avgEntries) {
    const k = e.bucket || 'exact'
    bucketCounts[k] = (bucketCounts[k] || 0) + 1
  }

  // GTB average of guesses (like the screenshot)
  const gtbAvg = gtbEntries.length > 0
    ? gtbEntries.reduce((s, e) => s + parseBet(e.guess), 0) / gtbEntries.length
    : null

  // Avg multi result or fallback label
  const avgResult = avgGame?.result_avg

  // Winners
  const gtbWinner = gtbGame?.status === 'finished'
    ? [...gtbEntries].sort((a, b) => parseBet(a.gap ?? 999999) - parseBet(b.gap ?? 999999))[0]
    : null
  const avgWinner = avgGame?.status === 'finished'
    ? [...avgEntries].sort((a, b) => parseBet(a.gap ?? 999999) - parseBet(b.gap ?? 999999))[0]
    : null
  const pickWinner = pickGame?.status === 'finished'
    ? picks.find(p => p.rank === 1)
    : null

  return (
    <div className="root">
      <style>{CSS}</style>

      {/* TOP BAR */}
      <div className="topbar">
        <div className="tb-live">
          <div className="tb-dot" />
          <div className="tb-live-label">ao vivo</div>
        </div>
        <div className="tb-sep" />
        <div className="tb-title">Mini-Games</div>
        <div className="tb-sep" />
        <div className="tb-timer-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5c842" strokeWidth="2" strokeLinecap="round" style={{ opacity: .6 }}>
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <div className={`tb-timer${isLive && secs < 30 ? ' urgent' : ''}`}>
            {isLive ? fmtTime(secs) : '—:——'}
          </div>
        </div>
        <div className="tb-entries">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="tb-entries-count">{totalEntries}</span>&nbsp;entradas
        </div>
        <div className="tb-spacer" />
        <div className="tb-site">jralha.com</div>
      </div>

      {/* COLUMNS */}
      <div className="cols">

        {/* ── PICK & WIN ── */}
        <div className="col">
          {/* Stat banner */}
          <div className="col-stat">
            <div className="col-stat-left">
              <div className="col-stat-label">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#f5c842"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
                Pick &amp; Win
              </div>
              <div className="col-stat-value" style={{ color: '#f5c842', fontSize: 22 }}>
                Escolhe um slot
              </div>
            </div>
            <div className="col-stat-right">
              <div className="col-stat-count" style={{ color: '#f5c842' }}>{picks.length}</div>
              <div className="col-stat-entries-label">entries</div>
            </div>
          </div>

          <PrizeBar game={pickGame} />

          {/* Winner card */}
          {pickWinner && (() => {
            const slot = entriesMap[pickWinner.entry_id]?.slot
            return (
              <div className="winner-card">
                <div className="wc-row">
                  <div className="wc-crown">👑</div>
                  <div>
                    <div className="wc-name">{pickWinner.twitch_username}</div>
                    {slot && <div className="wc-detail">{slot.name}</div>}
                  </div>
                </div>
              </div>
            )
          })()}

          <div className="col-head">
            <div className="col-name">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f5c842" strokeWidth="2.5" strokeLinecap="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Slots escolhidos
            </div>
          </div>

          <ScrollList count={picks.length}>
            {picks.length === 0 ? (
              <div className="empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <div className="empty-text">Sem picks ainda</div>
              </div>
            ) : picks.map((p, i) => {
              // ✅ usa entriesMap (sem join problemático)
              const slot    = entriesMap[p.entry_id]?.slot
              const isNew   = newPickIds.has(p.id)
              const isWin   = p.rank === 1 && pickGame?.status === 'finished'
              const avatar  = avatarMap[p.twitch_username?.toLowerCase()]
              return (
                <div key={p.id} className={`pick-slot entry-new${isWin ? ' is-winner' : ''}`} style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="pick-num" style={{ color: isWin ? 'var(--gold)' : undefined }}>
                    {isWin ? '👑' : `#${i + 1}`}
                  </div>
                  <div className="pick-img-wrap">
                    {slot?.image_url
                      ? <img src={slot.image_url} alt={slot.name} onError={e => e.target.style.opacity = '.3'} />
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/></svg>
                    }
                  </div>
                  <div className="pick-info">
                    <div className="pick-name">
                      {slot?.name || `Slot #${p.entry_id}`}
                      {isNew && <span className="new-badge">NEW</span>}
                    </div>
                    <div className="pick-provider">{slot?.provider || ''}</div>
                    <div className="pick-user">
                      <Avatar username={p.twitch_username} size={20} avatarUrl={avatar} />
                      <div className="pick-user-name" style={{ color: isWin ? 'var(--gold)' : undefined }}>
                        {p.twitch_username}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </ScrollList>
        </div>

        {/* ── GUESS THE BALANCE ── */}
        <div className="col">
          {/* Stat banner — GTB average like screenshot */}
          <div className="col-stat">
            <div className="col-stat-left">
              <div className="col-stat-label">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                GTB Average
              </div>
              <div className="col-stat-value" style={{ color: '#4ade80' }}>
                {gtbAvg ? `€${gtbAvg.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}` : '—'}
              </div>
            </div>
            <div className="col-stat-right">
              <div className="col-stat-count" style={{ color: '#4ade80' }}>{gtbEntries.length}</div>
              <div className="col-stat-entries-label">entries</div>
            </div>
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

          <div className="col-head">
            <div className="col-name">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Guesses
            </div>
          </div>

          <ScrollList count={gtbEntries.length}>
            {gtbEntries.length === 0 ? (
              <div className="empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                <div className="empty-text">Sem guesses ainda</div>
              </div>
            ) : [...gtbEntries].sort((a, b) => parseBet(b.guess) - parseBet(a.guess)).map((e, i) => {
              const rc    = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : ''
              const isWin = e.rank === 1 && gtbGame?.status === 'finished'
              return (
                <div key={e.id} className={`entry entry-new${isWin ? ' is-winner' : ''}`} style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className={`e-rank ${rc}`}>{isWin ? '👑' : `#${i + 1}`}</div>
                  <Avatar username={e.twitch_username} avatarUrl={avatarMap[e.twitch_username?.toLowerCase()]} />
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
        <div className="col">
          {/* Stat banner */}
          <div className="col-stat">
            <div className="col-stat-left">
              <div className="col-stat-label">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                AVG Average
              </div>
              <div className="col-stat-value" style={{ color: '#38bdf8' }}>
                {avgResult ? `${avgResult}x` : '—'}
              </div>
            </div>
            <div className="col-stat-right">
              <div className="col-stat-count" style={{ color: '#38bdf8' }}>{avgEntries.length}</div>
              <div className="col-stat-entries-label">entries</div>
            </div>
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

          <div className="col-head">
            <div className="col-name">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              Grupos
            </div>
          </div>

          {/* Buckets grid */}
          <div className="buckets-grid">
            {BUCKETS.map(b => {
              const count = bucketCounts[b.id] || 0
              const pct   = avgEntries.length > 0
                ? Math.round((count / avgEntries.length) * 100) : 0
              return (
                <div key={b.id} className="bucket-btn" style={{
                  background:  b.color + '15',
                  borderColor: count > 0 ? b.color + '55' : 'transparent',
                }}>
                  <div>
                    <div className="b-id" style={{ color: b.color }}>{b.id}</div>
                    <div className="b-label">{b.label}</div>
                  </div>
                  <div className="b-pct" style={{ color: count > 0 ? b.color : 'rgba(255,255,255,.18)' }}>
                    {pct}%
                  </div>
                </div>
              )
            })}
          </div>

          <ScrollList count={avgEntries.length}>
            {avgEntries.length === 0 ? (
              <div className="empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                <div className="empty-text">Sem entradas ainda</div>
              </div>
            ) : avgEntries.map((e, i) => {
              const bucket = BUCKETS.find(b => b.id === e.bucket)
              const rc     = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : ''
              const isWin  = e.rank === 1 && avgGame?.status === 'finished'
              return (
                <div key={e.id} className={`entry entry-new${isWin ? ' is-winner' : ''}`} style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className={`e-rank ${rc}`}>{isWin ? '👑' : `#${i + 1}`}</div>
                  <Avatar username={e.twitch_username} avatarUrl={avatarMap[e.twitch_username?.toLowerCase()]} />
                  <div className="e-info">
                    <div className="e-user">{e.twitch_username}</div>
                    {e.gap != null && <div className="e-sub">±{parseBet(e.gap).toFixed(1)}x</div>}
                  </div>
                  {bucket && (
                    <div style={{
                      fontFamily: 'var(--fd)', fontSize: 12, fontWeight: 800,
                      color: bucket.color, background: bucket.color + '18',
                      border: `1px solid ${bucket.color}44`,
                      borderRadius: 6, padding: '3px 10px', flexShrink: 0,
                    }}>
                      {bucket.id}: {bucket.label}
                    </div>
                  )}
                </div>
              )
            })}
          </ScrollList>
        </div>

      </div>

      {/* TICKER */}
      <div className="ticker">
        <div className="ticker-track">
          {[...Array(2)].map((_, ri) => (
            <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 72 }}>
              <div className="ticker-item">JOIN AT <span>JRALHA.COM</span></div>
              <div className="ticker-dot" />
              <div className="ticker-item">PICK &amp; WIN <span>100 PTS ENTRY</span></div>
              <div className="ticker-dot" />
              <div className="ticker-item">GUESS THE BALANCE <span>100 PTS ENTRY</span></div>
              <div className="ticker-dot" />
              <div className="ticker-item">AVG MULTI <span>100 PTS ENTRY</span></div>
              <div className="ticker-dot" />
              <div className="ticker-item">BONUS HUNT AO VIVO <span>AGORA</span></div>
              <div className="ticker-dot" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}