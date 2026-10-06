import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

function parseBet(val) {
  if (!val) return 0
  return parseFloat(String(val).replace(',', '.')) || 0
}
function fmt(n, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;900&family=Sora:wght@700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
html, body { background: transparent !important; margin: 0; padding: 0; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0d0f18; --surface: #12141f; --surface2: #1a1d2e; --surface3: #22253a;
  --border: rgba(255,255,255,0.07); --border2: rgba(255,255,255,0.12);
  --text: #eeeef5; --muted: #6b7280; --muted2: #9090b0;
  --accent: #7c6fff; --accent-dim: rgba(124,111,255,0.15);
  --green: #22c55e; --red: #ef4444; --amber: #f59e0b; --gold: #fbbf24;
  --font: 'Rubik', system-ui, sans-serif; --mono: 'JetBrains Mono', monospace; --display: 'Sora', sans-serif;
}

/* ── OVERLAY: 380 × 800 ── */
.hunt-root {
  width: 760px; height: 1600px;
  background: #07090f;
  border-radius: 24px;
  border: 1px solid var(--border2);
  display: flex; flex-direction: column; gap: 8px;
  padding: 8px;
  overflow: hidden;
  margin: 0 auto;
  font-family: var(--font);
  animation: fadeUp .4s ease;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: geometricPrecision;
}
.hunt-root *, .hunt-root *::before, .hunt-root *::after { -webkit-font-smoothing: antialiased; }
@keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }

/* ── Header ── */
.hunt-header {
  height: 76px;
  background: var(--surface);
  border-radius: 18px;
  border: 1px solid var(--border);
  display: flex; align-items: center;
  padding: 0 24px; gap: 16px;
  flex-shrink: 0;
}
.hunt-pill {
  background: var(--accent-dim);
  border: 1px solid rgba(124,111,255,.45);
  border-radius: 100px;
  padding: 4px 20px;
  font-size: 26px; font-weight: 800;
  color: #a78bfa;
  font-family: var(--display);
  letter-spacing: -.01em;
}
.hunt-title { font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: .06em; }
.live-dot {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--red);
  box-shadow: 0 0 5px rgba(239,68,68,.7);
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

/* ── Stat cards 2x2 ── */
.hunt-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; flex-shrink: 0; }
.hunt-stat {
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: 18px; padding: 14px 20px;
  display: flex; align-items: center; gap: 16px;
}
.hunt-stat-icon {
  width: 56px; height: 56px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.hunt-stat-icon.amber { background: rgba(245,158,11,.15); color: var(--amber); }
.hunt-stat-icon.green { background: rgba(34,197,94,.15);  color: var(--green); }
.hunt-stat-icon.blue  { background: rgba(59,130,246,.15); color: #60a5fa; }
.hunt-stat-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.hunt-stat-lbl  { font-size: 18px; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: .06em; line-height: 1; white-space: nowrap; }
.hunt-stat-val  { font-size: 28px; font-weight: 800; font-family: var(--display); color: var(--text); line-height: 1.1; letter-spacing: -.02em; }
.hunt-stat-val.amber { color: var(--amber); }
.hunt-stat-val.green { color: var(--green); }
.hunt-stat-val.blue  { color: #60a5fa; }

/* ── Flip card (bonus/supers) ── */
.hunt-flip-box {
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: 18px; perspective: 1800px;
  position: relative; overflow: hidden;
}
.hunt-flip-inner {
  width: 100%; height: 100%; min-height: 92px;
  position: relative; transform-style: preserve-3d;
  transition: transform .7s cubic-bezier(.4,0,.2,1);
}
.hunt-flip-inner.flipped { transform: rotateY(180deg); }
.hunt-flip-face {
  position: absolute; inset: 0;
  backface-visibility: hidden; -webkit-backface-visibility: hidden;
  display: flex; align-items: center; gap: 8px;
  padding: 14px 20px 32px;
}
.hunt-flip-back { transform: rotateY(180deg); }
.hunt-flip-icon {
  width: 56px; height: 56px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.hunt-flip-icon.purple { background: rgba(124,111,255,.15); color: var(--accent); }
.hunt-flip-icon.gold   { background: rgba(251,191,36,.15);  color: var(--gold); }
.hunt-flip-dots {
  position: absolute; bottom: 8px; left: 0; right: 0;
  display: flex; justify-content: center; gap: 5px; pointer-events: none;
}
.hunt-flip-dot { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,.2); transition: background .3s, transform .3s; }
.hunt-flip-dot.active { background: rgba(255,255,255,.7); transform: scale(1.2); }

/* ── Divider ── */
.hunt-divider {
  height: 52px; flex-shrink: 0;
  border-radius: 18px; border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  gap: 8px; background: var(--surface2);
}
.hunt-divider::before, .hunt-divider::after { content: ''; flex: 1; height: 1px; background: var(--border2); margin: 0 8px; }
.hunt-divider span { font-size: 20px; font-weight: 700; color: var(--muted2); letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; }

/* ── Scroll list ── */
.hunt-scroll-wrap {
  flex: 1; overflow: hidden;
  background: var(--bg); border-radius: 18px;
  border: 1px solid var(--border);
  min-height: 0; padding: 10px; position: relative;
}
.hunt-track  { display: flex; flex-direction: column; gap: 8px; will-change: transform; }
.hunt-slots  { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
.hunt-scroll-wrap::-webkit-scrollbar { display: none; }

/* ── Slot row ── */
.hunt-slot-row {
  display: flex; align-items: center; gap: 18px;
  padding: 14px 22px;
  background: var(--surface); border-radius: 18px;
  flex-shrink: 0; position: relative; overflow: hidden;
  transition: background .2s;
}
.hunt-slot-row.is-super { background: linear-gradient(90deg, rgba(251,191,36,.08) 0%, var(--surface) 60%); }
.hunt-slot-bar { position: absolute; left: 0; top: 14px; bottom: 14px; width: 6px; border-radius: 0 6px 6px 0; background: var(--accent); }
.hunt-slot-row.is-super .hunt-slot-bar { background: var(--gold); }
.hunt-slot-num { font-size: 24px; font-weight: 800; font-family: var(--mono); color: var(--muted2); min-width: 52px; text-align: center; flex-shrink: 0; }
.hunt-slot-row.is-super .hunt-slot-num { color: var(--gold); }
.hunt-slot-img { width: 92px; height: 92px; border-radius: 16px; object-fit: cover; background: var(--surface3); flex-shrink: 0; }
.hunt-slot-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.hunt-slot-name-row { display: flex; align-items: center; min-width: 0; overflow: hidden; }
.hunt-slot-name-wrap { overflow: hidden; flex: 1; min-width: 0; position: relative; }
.hunt-slot-name {
  font-size: 24px; font-weight: 700; color: var(--text);
  white-space: nowrap; display: inline-flex; align-items: center; gap: 6px;
}
.hunt-slot-name.scrolling { animation: marquee-lr 7s ease-in-out infinite; }
@keyframes marquee-lr { 0%{transform:translateX(0)} 20%{transform:translateX(0)} 45%{transform:translateX(var(--marquee-dist))} 55%{transform:translateX(var(--marquee-dist))} 80%{transform:translateX(0)} 100%{transform:translateX(0)} }
.hunt-super-tag { font-size: 16px; font-weight: 700; letter-spacing: .5px; padding: 4px 10px; border-radius: 8px; flex-shrink: 0; background: rgba(251,191,36,.15); color: var(--gold); border: 1px solid rgba(251,191,36,.3); text-transform: uppercase; }
.hunt-slot-provider { font-size: 20px; color: var(--muted2); }
.hunt-loop-divider { display: flex; align-items: center; gap: 6px; padding: 2px 0; flex-shrink: 0; }
.hunt-loop-divider::before, .hunt-loop-divider::after { content: ''; flex: 1; height: 1px; background: linear-gradient(to right, transparent, rgba(124,111,255,.4), transparent); }
.hunt-loop-divider span { font-size: 20px; font-weight: 700; color: rgba(124,111,255,.5); letter-spacing: .12em; text-transform: uppercase; white-space: nowrap; }
.hunt-slot-bet-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; flex-shrink: 0; }
.hunt-slot-bet-lbl { font-size: 18px; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: .06em; line-height: 1; }
.hunt-slot-bet { font-size: 24px; font-weight: 800; font-family: var(--display); color: var(--text); line-height: 1; }
`

function useVerticalScroll(wrapRef, trackRef, halfRef, deps) {
  const posRef = useRef(0), rafRef = useRef(null)
  useEffect(() => {
    const wrap = wrapRef.current, track = trackRef.current, half = halfRef.current
    if (!wrap || !track || !half) return
    track.style.willChange = 'transform'
    track.style.backfaceVisibility = 'hidden'
    track.style.transform = 'translate3d(0,0,0)'
    let loopH = 0, active = false
    const measure = () => {
      const gap = parseFloat(getComputedStyle(track).rowGap) || 0
      loopH = half.getBoundingClientRect().height + gap
      active = loopH > wrap.clientHeight
      if (!active) { posRef.current = 0; track.style.transform = 'translate3d(0,0,0)' }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(half); ro.observe(wrap)
    let lastTs = 0
    function tick(ts) {
      const dt = lastTs ? Math.min(ts - lastTs, 50) : 16.7
      lastTs = ts
      if (active && loopH > 0) {
        posRef.current += 0.5 * (dt / 16.7)
        if (posRef.current >= loopH) posRef.current -= loopH
        track.style.transform = `translate3d(0, ${-posRef.current}px, 0)`
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { ro.disconnect(); cancelAnimationFrame(rafRef.current) }
  }, deps)
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3) }

function useAnimatedValue(target, duration = 800) {
  const [val, setVal] = useState(target)
  const prev = useRef(target), raf = useRef(null)
  useEffect(() => {
    if (prev.current === target) return
    const from = prev.current; prev.current = target
    const t0 = performance.now(); cancelAnimationFrame(raf.current)
    function tick(now) {
      const p = Math.min((now - t0) / duration, 1)
      setVal(from + (target - from) * easeOut(p))
      if (p < 1) raf.current = requestAnimationFrame(tick); else setVal(target)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return val
}

function AnimStatVal({ value, format, className = '', style }) {
  const v = useAnimatedValue(value)
  return <div className={`hunt-stat-val${className ? ' ' + className : ''}`} style={style}>{format(v)}</div>
}

function FlipStat({ bonus, supers }) {
  const [flipped, setFlipped] = useState(false)
  const hasSupers = supers > 0
  useEffect(() => {
    if (!hasSupers) { setFlipped(false); return }
    const t = setInterval(() => setFlipped(f => !f), 3500)
    return () => clearInterval(t)
  }, [hasSupers])
  return (
    <div className="hunt-flip-box">
      <div className={`hunt-flip-inner${flipped ? ' flipped' : ''}`}>
        <div className="hunt-flip-face">
          <div className="hunt-flip-icon purple">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/>
              <path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
            </svg>
          </div>
          <div className="hunt-stat-body">
            <div className="hunt-stat-lbl">Bonus</div>
            <AnimStatVal value={bonus} format={v => Math.round(v)} style={{ color: 'var(--accent)' }} />
          </div>
        </div>
        <div className="hunt-flip-face hunt-flip-back">
          <div className="hunt-flip-icon gold">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <div className="hunt-stat-body">
            <div className="hunt-stat-lbl">Supers</div>
            <AnimStatVal value={supers} format={v => Math.round(v)} style={{ color: 'var(--gold)' }} />
          </div>
        </div>
      </div>
      {hasSupers && (
        <div className="hunt-flip-dots">
          <div className={`hunt-flip-dot${!flipped ? ' active' : ''}`} />
          <div className={`hunt-flip-dot${flipped ? ' active' : ''}`} />
        </div>
      )}
    </div>
  )
}

const SlotRow = memo(function SlotRow({ entry, index }) {
  const slot = entry.slot || {}, bet = parseBet(entry.bet)
  const nameRef = useRef(null), wrapRef = useRef(null)
  useEffect(() => {
    const name = nameRef.current, wrap = wrapRef.current
    if (!name || !wrap) return
    const t = setTimeout(() => {
      const nameW = name.scrollWidth, wrapW = wrap.clientWidth
      if (nameW > wrapW) { name.style.setProperty('--marquee-dist', `${-(nameW - wrapW)}px`); name.classList.add('scrolling') }
      else { name.classList.remove('scrolling'); name.style.removeProperty('--marquee-dist') }
    }, 100)
    return () => clearTimeout(t)
  }, [slot.name, entry.is_super])
  return (
    <div className={`hunt-slot-row${entry.is_super ? ' is-super' : ''}`}>
      <div className="hunt-slot-bar" />
      <div className="hunt-slot-num">#{index + 1}</div>
      <img className="hunt-slot-img" src={slot.image_url || ''} alt={slot.name || ''} onError={e => { e.target.style.opacity = '.3' }} />
      <div className="hunt-slot-info">
        <div className="hunt-slot-name-row">
          <div className="hunt-slot-name-wrap" ref={wrapRef}>
            <span className="hunt-slot-name" ref={nameRef}>
              {slot.name || '—'}
              {entry.is_super && <span className="hunt-super-tag">SUPER</span>}
            </span>
          </div>
        </div>
        <div className="hunt-slot-provider">{slot.provider || ''}</div>
      </div>
      {bet > 0 && (
        <div className="hunt-slot-bet-wrap">
          <div className="hunt-slot-bet-lbl">BET</div>
          <div className="hunt-slot-bet">{fmt(bet)}€</div>
        </div>
      )}
    </div>
  )
})

export default function Hunting() {
  const [entries, setEntries] = useState([])
  const [hunt, setHunt] = useState(null)
  const wrapRef = useRef(null), trackRef = useRef(null), halfRef = useRef(null)
  useVerticalScroll(wrapRef, trackRef, halfRef, [entries.length])

  const loadData = useCallback(async () => {
    const { data: h } = await supabase.from('bonus_hunts').select('*').eq('active', true).limit(1).single()
    if (!h) return
    setHunt(h)
    const { data } = await supabase.from('bonus_entries').select('*, slot:slots(*)').eq('hunt_id', h.id).order('created_at', { ascending: true })
    if (data) setEntries(data)
  }, [])

  useEffect(() => {
    loadData()
    const ch = supabase.channel('hunting-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_entries' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_hunts' }, loadData)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadData])

  const balStart  = parseFloat(hunt?.balance_start) || 0
  const balEnd    = parseFloat(hunt?.balance_end)
  const hasBalEnd = !isNaN(balEnd) && hunt?.balance_end != null
  const target    = hasBalEnd ? Math.max(0, balStart - balEnd) : balStart
  const supers    = entries.filter(e => e.is_super).length
  const totalBet  = entries.reduce((a, e) => a + parseBet(e.bet), 0)
  const be        = totalBet > 0 ? target / totalBet : 0
  const avgBet    = entries.length > 0 ? totalBet / entries.length : 0
  const match     = (hunt?.title || '').match(/#?(\d+)/)
  const huntNum   = match ? `#${match[1]}` : '#—'

  return (
    <div className="hunt-root">
      <style>{CSS}</style>

      {/* Header */}
      <div className="hunt-header">
        <div className="hunt-pill">{huntNum}</div>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
        </svg>
        <div className="hunt-title">BONUS HUNT</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="live-dot" />
          <span style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,.35)', letterSpacing: '.08em', textTransform: 'uppercase' }}>live</span>
        </div>
      </div>

      {/* Stats 2x2 */}
      <div className="hunt-stats">
        <div className="hunt-stat">
          <div className="hunt-stat-icon blue">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          </div>
          <div className="hunt-stat-body">
            <div className="hunt-stat-lbl">Target</div>
            <AnimStatVal value={balStart} format={v => v > 0 ? fmt(v, 0) + '€' : '—'} className="blue" />
          </div>
        </div>
        <div className="hunt-stat">
          <div className="hunt-stat-icon amber">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 4-1 7-1s5 1 7 1h2"/></svg>
          </div>
          <div className="hunt-stat-body">
            <div className="hunt-stat-lbl">Breakeven</div>
            <AnimStatVal value={be} format={v => v > 0 ? v.toFixed(1) + 'x' : '—'} className="amber" />
          </div>
        </div>
        <FlipStat bonus={entries.length} supers={supers} />
        <div className="hunt-stat">
          <div className="hunt-stat-icon green">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
          <div className="hunt-stat-body">
            <div className="hunt-stat-lbl">Avg Bet</div>
            <AnimStatVal value={avgBet} format={v => v > 0 ? fmt(v) + '€' : '—'} className="green" />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="hunt-divider"><span>BONUS LIST</span></div>

      {/* Scroll list */}
      <div className="hunt-scroll-wrap" ref={wrapRef}>
        <div className="hunt-track" ref={trackRef}>
          <div className="hunt-slots" ref={halfRef}>
            {entries.map((entry, idx) => <SlotRow key={entry.id} entry={entry} index={idx} />)}
            {entries.length >= 8 && <div className="hunt-loop-divider"><span>· · ·</span></div>}
          </div>
          <div className="hunt-slots" aria-hidden="true">
            {entries.map((entry, idx) => <SlotRow key={`c-${entry.id}`} entry={entry} index={idx} />)}
            {entries.length >= 8 && <div className="hunt-loop-divider"><span>· · ·</span></div>}
          </div>
        </div>
      </div>
    </div>
  )
}