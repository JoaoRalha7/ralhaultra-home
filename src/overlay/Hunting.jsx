import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

// ─── utilitários ──────────────────────────────────────────────────────────────
function parseBet(val) {
  if (!val) return 0
  return parseFloat(String(val).replace(',', '.')) || 0
}
function fmt(n, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3) }

// ─── hooks ────────────────────────────────────────────────────────────────────
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

// Hook de Scroll Otimizado por GPU (Igual ao do Opening)
function useListScroll(wrapRef, listRef) {
  useEffect(() => {
    const wrap = wrapRef.current
    const list = listRef.current
    if (!wrap || !list) return

    const observer = new ResizeObserver(() => {
      const wrapHeight = wrap.clientHeight
      const singleListHeight = list.scrollHeight / 2 

      if (singleListHeight > wrapHeight && singleListHeight > 0) {
        const speed = 30 
        const duration = singleListHeight / speed
        list.style.setProperty('--scroll-duration', `${duration}s`)
        list.classList.add('is-scrolling')
      } else {
        list.classList.remove('is-scrolling')
        list.style.removeProperty('--scroll-duration')
      }
    })

    observer.observe(list)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])
}

// ─── Ícones SVG (Clean Style) ────────────────────────────────────────────────
const IconMoney    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
const IconScale    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 4-1 7-1s5 1 7 1h2"/></svg>
const IconGift     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
const IconStar     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
const IconBar      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>

// ─── COMPONENTES UI ──────────────────────────────────────────────────────────

// Efeito Ping-Pong
function SlideText({ text }) {
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
        <span className="slide-text" ref={textRef}>{text}</span>
      </div>
    </div>
  )
}

function StatBoxStatic({ icon, colorClass, label, val }) {
  return (
    <div className="app-info-box">
      <div className={`app-info-icon ${colorClass}`}>{icon}</div>
      <div className="app-info-body">
        <div className="app-info-lbl">{label}</div>
        <div className={`app-info-val val-${colorClass}`}>{val}</div>
      </div>
    </div>
  )
}

function AnimStatVal({ value, format, className = '' }) {
  const v = useAnimatedValue(value)
  return <span className={className}>{format(v)}</span>
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
    <div className="flip-stat-container">
      <div className={`flip-stat-inner${flipped ? ' flipped' : ''}`}>
        <div className="flip-stat-face">
          <div className="app-info-box">
            <div className="app-info-icon purple"><IconGift /></div>
            <div className="app-info-body">
              <div className="app-info-lbl">Bonus</div>
              <div className="app-info-val val-purple">
                <AnimStatVal value={bonus} format={v => Math.round(v)} />
              </div>
            </div>
          </div>
        </div>
        <div className="flip-stat-face flip-stat-back">
          <div className="app-info-box">
            <div className="app-info-icon yellow"><IconStar /></div>
            <div className="app-info-body">
              <div className="app-info-lbl">Supers</div>
              <div className="app-info-val val-yellow">
                <AnimStatVal value={supers} format={v => Math.round(v)} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {hasSupers && (
        <div className="flip-stat-dots">
          <div className={`flip-stat-dot${!flipped ? ' active' : ''}`} />
          <div className={`flip-stat-dot${flipped ? ' active' : ''}`} />
        </div>
      )}
    </div>
  )
}

const SlotRow = memo(function SlotRow({ entry, index }) {
  const slot = entry.slot || {}, bet = parseBet(entry.bet)
  
  return (
    <div className="list-row">
      <div className="list-num">#{index + 1}</div>
      <img className="list-img" src={slot.image_url || ''} alt={slot.name || ''} onError={e => { e.target.style.opacity = '.3' }} />
      <div className="list-info">
        
        <div className="list-name-row">
          <SlideText text={slot.name || '—'} />
          {entry.is_super && <span className="list-super-tag" style={{ flexShrink: 0 }}>SUPER</span>}
        </div>

        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden', marginTop: '2px' }}>
          <div className="list-provider" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {slot.provider || ''}
          </div>
        </div>
        
      </div>
      <div className="list-cols">
        {bet > 0 && (
          <div className="list-col-row" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
            <span className="list-col-lbl">BET</span>
            <span className="list-col-val val-muted">{fmt(bet)}€</span>
          </div>
        )}
      </div>
    </div>
  )
})

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function Hunting() {
  const [entries, setEntries] = useState([])
  const [hunt,    setHunt]    = useState(null)
  
  const wrapRef = useRef(null), listRef = useRef(null)
  useListScroll(wrapRef, listRef)

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_hunts'   }, loadData)
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

  // anim values
  const beIVal   = useAnimatedValue(be)
  const startVal = useAnimatedValue(balStart)
  const avgVal   = useAnimatedValue(avgBet)

  return (
    <div className="overlay-container">
      <style>{CSS}</style>

      {/* HEADER */}
      <div className="app-header-row">
        <div className="app-badge-hunt">{huntNum}</div>
        <div className="app-header-title">BONUS HUNT</div>
        <div style={{ flex: 1 }} />
        <div className="app-badge-live"><div className="dot-live" /> LIVE</div>
      </div>

      {/* STATS GRID */}
      <div className="app-stats-grid">
        <StatBoxStatic 
          icon={<IconMoney />} 
          colorClass="blue" 
          label="Target" 
          val={startVal > 0 ? Math.round(startVal) + '€' : '—'} 
        />
        <StatBoxStatic 
          icon={<IconScale />} 
          colorClass="yellow" 
          label="Breakeven" 
          val={beIVal > 0 ? beIVal.toFixed(1) + 'x' : '—'} 
        />
        <FlipStat 
          bonus={entries.length} 
          supers={supers} 
        />
        <StatBoxStatic 
          icon={<IconBar />} 
          colorClass="green" 
          label="Avg Bet" 
          val={avgVal > 0 ? avgVal.toFixed(2) + '€' : '—'} 
        />
      </div>

      {/* DIVIDER */}
      <div className="app-divider" style={{ margin: '4px 0', flexShrink: 0 }}>
        <div className="app-line" />
        <span className="app-divider-text">BONUS LIST</span>
        <div className="app-line" />
      </div>

      {/* LISTA INFINITA */}
      <div className="slots-list-wrap" ref={wrapRef}>
        <div className="slots-list" ref={listRef}>
          {/* Se houver itens suficientes, duplicamos a lista para o scroll contínuo */}
          {entries.length > 5 
            ? [...entries, ...entries].map((entry, idx) => {
                const isClone = idx >= entries.length;
                const originalIdx = idx % entries.length;
                return <SlotRow key={isClone ? `clone-${entry.id}-${idx}` : entry.id} entry={entry} index={originalIdx} />
              })
            : entries.map((entry, idx) => (
                <SlotRow key={entry.id} entry={entry} index={idx} />
              ))
          }
        </div>
      </div>

    </div>
  )
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800;900&family=Sora:wght@700;800;900&display=swap');

:root {
  --bg: #090C15; --surface: rgba(255,255,255,0.02); --surface2: rgba(255,255,255,0.04);
  --border: rgba(255,255,255,0.04); --border2: rgba(255,255,255,0.08);
  --text: #eeeef5; --muted: #64748b; --muted2: #94a3b8;
  --accent: #c084fc; --accent-dim: rgba(192,132,252,0.15);
  --green: #34d399; --green-dim: rgba(52,211,153,0.15);
  --red: #f87171; --red-dim: rgba(248,113,113,0.15);
  --yellow: #fbbf24; --yellow-dim: rgba(251,191,36,0.15);
  --blue: #38bdf8; --blue-dim: rgba(56,189,248,0.15);
  --font: 'Rubik', system-ui, sans-serif; --display: 'Sora', sans-serif;
}

html, body { background: transparent !important; margin: 0; padding: 0; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.overlay-container {
  width: 290px; height: 750px; background: var(--bg);
  border-radius: 20px; border: 1px solid var(--border);
  box-shadow: 0 20px 40px rgba(0,0,0,0.6);
  display: flex; flex-direction: column; gap: 8px; padding: 12px;
  overflow: hidden; margin: 0 auto; font-family: var(--font);
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
}

/* ── HEADER ── */
.app-header-row {
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
  padding-bottom: 8px; border-bottom: 1px solid var(--border);
}
.app-header-title { font-family: var(--display); font-size: 13px; font-weight: 800; color: var(--text); letter-spacing: 0.05em; }
.app-badge-hunt {
  background: var(--accent-dim); border: 1px solid rgba(192,132,252,0.3);
  border-radius: 100px; padding: 2px 8px; font-size: 11px; font-weight: 800; color: var(--accent);
  font-family: var(--display);
}
.app-badge-live {
  background: rgba(18,20,31,0.7); border: 1px solid var(--border2);
  border-radius: 100px; padding: 4px 8px; display: flex; align-items: center; gap: 6px;
  font-size: 9px; font-weight: 800; color: var(--red); letter-spacing: 0.05em;
}
.dot-live {
  width: 6px; height: 6px; border-radius: 50%; background: var(--red);
  box-shadow: 0 0 6px var(--red); animation: blink-dot 1.5s infinite;
}
@keyframes blink-dot { 0%,100%{opacity:1} 50%{opacity:.2} }

/* ── STATS GRID ── */
.app-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; flex-shrink: 0; }
.app-info-box {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; padding: 8px 10px; display: flex; align-items: center; gap: 10px; height: 48px;
}
.app-info-box.border-green { border-left: 3px solid var(--green); }
.app-info-box.border-red   { border-left: 3px solid var(--red); }
.app-info-icon { width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.app-info-icon.blue   { background: var(--blue-dim); color: var(--blue); }
.app-info-icon.yellow { background: var(--yellow-dim); color: var(--yellow); }
.app-info-icon.purple { background: var(--accent-dim); color: var(--accent); }
.app-info-icon.green  { background: var(--green-dim); color: var(--green); }
.app-info-icon.red    { background: var(--red-dim); color: var(--red); }
.app-info-icon.muted  { background: var(--surface2); color: var(--muted); }

.app-info-body { display: flex; flex-direction: column; gap: 2px; }
.app-info-lbl { font-size: 8px; font-weight: 800; color: var(--muted2); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1; }
.app-info-val { font-family: var(--display); font-size: 13px; font-weight: 800; line-height: 1; }

.val-blue, .val-yellow, .val-purple, .val-muted { color: var(--text); }
.val-green  { color: var(--green); }
.val-red    { color: var(--red); }
.white      { color: var(--text); }

/* FLIP STAT BOX + DOTS */
.flip-stat-container { perspective: 1000px; height: 48px; position: relative; }
.flip-stat-inner {
  width: 100%; height: 100%; position: relative; transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
.flip-stat-inner.flipped { transform: rotateY(180deg); }
.flip-stat-face { position: absolute; inset: 0; backface-visibility: hidden; width: 100%; }
.flip-stat-back { transform: rotateY(180deg); }
.flip-stat-dots {
  position: absolute; bottom: 3px; left: 0; right: 0;
  display: flex; justify-content: center; gap: 3px; pointer-events: none;
}
.flip-stat-dot { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,.1); transition: background .3s; }
.flip-stat-dot.active { background: rgba(255,255,255,.5); }

/* ── DIVIDER ── */
.app-divider { display: flex; align-items: center; }
.app-divider-text { font-size: 9px; font-weight: 800; color: var(--muted); letter-spacing: 0.15em; margin: 0 10px; }
.app-line { flex: 1; height: 1px; background: var(--border2); }

/* ── LISTA E SCROLL (GPU ACCELERATED) ── */
.slots-list-wrap { 
  flex: 1; overflow: hidden; position: relative; scrollbar-width: none; min-height: 0; 
  mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 85%, rgba(0,0,0,0) 100%); 
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 85%, rgba(0,0,0,0) 100%); 
}
.slots-list-wrap::-webkit-scrollbar { display: none; }
.slots-list { display: flex; flex-direction: column; gap: 6px; }
.slots-list.is-scrolling { animation: cssInfiniteScroll var(--scroll-duration, 20s) linear infinite; }

@keyframes cssInfiniteScroll { 
  0% { transform: translateY(0); } 
  100% { transform: translateY(-50%); } 
}

/* Altura fixa nas caixas */
.list-row { 
  display: flex; align-items: center; gap: 10px; padding: 8px 10px; 
  background: var(--surface); border: 1px solid var(--border); 
  border-radius: 10px; transition: all 0.3s; 
  height: 56px; 
  overflow: hidden; 
}

.list-num { font-size: 11px; font-weight: 800; font-family: var(--display); color: var(--muted); min-width: 20px; text-align: center; }
.list-img { width: 34px; height: 34px; border-radius: 8px; object-fit: cover; background: var(--surface2); flex-shrink: 0; }
.list-info { display: flex; flex-direction: column; flex: 1; min-width: 0; justify-content: center; overflow: hidden; }

/* Slide Animation CSS - PING PONG */
.list-name-row { display: flex; align-items: center; width: 100%; overflow: hidden; gap: 6px; }
.slide-wrap { flex: 1; overflow: hidden; white-space: nowrap; -webkit-mask-image: linear-gradient(to right, black 90%, transparent 100%); mask-image: linear-gradient(to right, black 90%, transparent 100%); }
.slide-inner { display: inline-flex; align-items: center; width: fit-content; }
.anim-ping-pong { animation: text-ping-pong 4s ease-in-out infinite alternate; }
.slide-text { font-size: 11px; font-weight: 700; color: var(--text); }
@keyframes text-ping-pong { 
  0%, 20% { transform: translateX(0); } 
  80%, 100% { transform: translateX(var(--slide-dist)); } 
}

.list-super-tag { font-size: 7px; font-weight: 800; padding: 2px 4px; border-radius: 4px; background: var(--yellow-dim); color: var(--yellow); border: 1px solid rgba(251,191,36,.4); letter-spacing: 0.05em; }
.list-provider { font-size: 8px; font-weight: 600; color: var(--muted2); text-transform: uppercase; letter-spacing: 0.05em; }

.list-cols { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.list-col-row { display: flex; align-items: center; gap: 6px; }
.list-col-lbl { font-size: 8px; font-weight: 800; color: var(--muted); text-transform: uppercase; }
.list-col-val { font-size: 10px; font-weight: 800; font-family: var(--display); color: var(--text); min-width: 36px; text-align: right; }
`