import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

// ─── utils ───────────────────────────────────────────────────────────────────
function parseBet(val) {
  if (!val) return 0
  return parseFloat(String(val).replace(',', '.')) || 0
}
function fmt(n, decimals = 2) {
  return n.toLocaleString('pt-PT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// ─── icons ───────────────────────────────────────────────────────────────────
const IconGift = () => (
  <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/>
    <path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </svg>
)
const IconStar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)
const IconScale = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
    <path d="M7 21h10"/><path d="M12 3v18"/>
    <path d="M3 7h2c2 0 4-1 7-1s5 1 7 1h2"/>
  </svg>
)
const IconTarget = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
)

// ─── skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={S.root}>
      <style>{GLOBAL_CSS}</style>
      <div style={S.header}>
        <div style={{ ...S.pill, background: 'rgba(255,255,255,.06)', width: 157, height: 52, borderRadius: 100 }} className="shimmer" />
        <div style={{ background: 'rgba(255,255,255,.04)', width: 210, height: 31, borderRadius: 10 }} className="shimmer" />
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', gap: 21, padding: '16px 31px' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ width: CARD_W, borderRadius: 37, background: 'rgba(255,255,255,.05)', flexShrink: 0 }} className="shimmer" />
          ))}
        </div>
        <div style={{ width: 459, borderLeft: '1px solid rgba(255,255,255,.06)', background: '#080a10', padding: 21, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: 73, borderRadius: 18, background: 'rgba(255,255,255,.05)' }} className="shimmer" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── slot card ────────────────────────────────────────────────────────────────
const CARD_W = 289

const SlotCard = memo(function SlotCard({ entry, index }) {
  const slot    = entry.slot
  const bet     = parseBet(entry.bet)
  const isSuper = entry.is_super

  const borderCol = isSuper ? '#fbbf24' : 'rgba(255,255,255,.15)'
  const glow      = isSuper
    ? '0 0 18px rgba(251,191,36,.45), 0 7px 28px rgba(0,0,0,.5)'
    : '0 7px 28px rgba(0,0,0,.5)'

  return (
    <div className="slot-card" style={{ flexShrink: 0, width: CARD_W, display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ position: 'relative', width: CARD_W, flex: 1, minHeight: 0, borderRadius: 25, overflow: 'hidden', boxShadow: glow }}>
        <img
          src={slot?.image_url || ''}
          alt={slot?.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block', border: `4px solid ${borderCol}`, borderRadius: 25, transition: 'border-color .3s' }}
          onError={e => { e.target.style.opacity = '.2' }}
          loading="lazy"
        />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 115, background: 'linear-gradient(to bottom, rgba(0,0,0,.55) 0%, transparent 100%)', borderRadius: '25px 25px 0 0', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 136, background: 'linear-gradient(to top, rgba(0,0,0,.72) 0%, transparent 100%)', borderRadius: '0 0 25px 25px', pointerEvents: 'none' }} />
        {bet > 0 && (
          <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Sora', sans-serif", color: '#fff', background: 'rgba(0,0,0,.55)', padding: '6px 24px', borderRadius: 52, WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)', lineHeight: 1.5 }}>
              {fmt(bet)}€
            </span>
          </div>
        )}
        <div style={{ position: 'absolute', top: 12, left: 12 }}>
          <span style={{ fontSize: 27, fontWeight: 800, fontFamily: "'Sora', sans-serif", color: '#fff', background: 'rgba(0,0,0,.6)', padding: '6px 18px', borderRadius: 52, lineHeight: 1.5, WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)' }}>
            #{index + 1}
          </span>
        </div>
        {isSuper && (
          <div style={{ position: 'absolute', top: 12, right: 12 }}>
            <span style={{ fontSize: 27, fontWeight: 800, letterSpacing: '.5px', padding: '6px 16px', borderRadius: 10, background: 'rgba(251,191,36,.2)', color: '#fbbf24', border: '1px solid rgba(251,191,36,.55)', textTransform: 'uppercase', lineHeight: 1.5 }}>
              SUPER
            </span>
          </div>
        )}
      </div>
     
    </div>
  )
})

// ─── ticker vertical ──────────────────────────────────────────────────────────
const TickerVertical = memo(function TickerVertical({ entries }) {
  const slots        = entries.filter(e => e.slot)
  const containerRef = useRef(null)
  const firstHalfRef = useRef(null)
  const wrapRef      = useRef(null)
  const posRef       = useRef(0)
  const rafRef       = useRef(null)
  const loopRef      = useRef(0)
  const [needsScroll, setNeedsScroll] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      const first = firstHalfRef.current
      const wrap  = wrapRef.current
      if (!first || !wrap) return
      setNeedsScroll(first.scrollHeight > wrap.clientHeight)
    }, 100)
    return () => clearTimeout(t)
  }, [slots.length])

  useEffect(() => {
    const el = firstHalfRef.current
    if (!el) return
    const measure = () => { loopRef.current = el.getBoundingClientRect().height }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [slots.length])

  useEffect(() => {
    if (!needsScroll) return
    const el = containerRef.current
    if (!el) return
    posRef.current = 0
    el.style.willChange = 'transform'
    el.style.backfaceVisibility = 'hidden'
    let lastTs = 0
    function tick(ts) {
      const dt = lastTs ? Math.min(ts - lastTs, 33) : 16.7
      lastTs = ts
      posRef.current += 0.5 * (dt / 16.7)
      const lp = loopRef.current
      if (lp > 0 && posRef.current >= lp) posRef.current -= lp
      const y = posRef.current
      el.style.transform = `translate3d(0, ${-y}px, 0)`
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [needsScroll])

  const Item = ({ e, i }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 0', flexShrink: 0 }}>
      <span style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Sora', sans-serif", color: e.is_super ? '#fbbf24' : '#fff', flexShrink: 0, minWidth: 52 }}>#{i + 1}</span>
      <span style={{ fontSize: 27, fontWeight: 600, fontFamily: "'Rubik', sans-serif", color: e.is_super ? '#fbbf24' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{e.slot.name}</span>
      {e.is_super && (
        <span style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24', border: '1px solid rgba(251,191,36,.4)', borderRadius: 10, padding: '1px 7px', letterSpacing: '.04em', flexShrink: 0 }}>S</span>
      )}
    </div>
  )

  const Divider = () => (
    <div style={{ height: 1, background: 'linear-gradient(to right, transparent, rgba(124,111,255,.4), transparent)', margin: '7px 0', flexShrink: 0 }} />
  )

  return (
    <div ref={wrapRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
      <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', willChange: 'transform' }}>
        <div ref={firstHalfRef} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '5px 0' }}>
            {slots.map((e, i) => <Item key={`a-${e.id}`} e={e} i={i} />)}
          </div>
          {needsScroll && <Divider />}
        </div>
        {needsScroll && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', padding: '5px 0' }}>
              {slots.map((e, i) => <Item key={`b-${e.id}`} e={e} i={i} />)}
            </div>
            <Divider />
          </div>
        )}
      </div>
    </div>
  )
})

// ─── stat box ─────────────────────────────────────────────────────────────────
const StatBox = memo(function StatBox({ icon, label, value, color, borderColor, iconBg }) {
  return (
    <div style={{ background: '#0c0e1a', border: `1px solid ${borderColor}`, borderRadius: 18, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 13, transition: 'border-color .3s', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ width: 42, height: 42, borderRadius: 13, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
        {icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1, overflow: 'hidden' }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '.07em', lineHeight: 1 }}>{label}</span>
        <span style={{ fontSize: String(value).length > 8 ? 21 : 28, fontWeight: 800, fontFamily: "'Sora', sans-serif", color, lineHeight: 1, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{value}</span>
      </div>
    </div>
  )
})

// ─── card divider ─────────────────────────────────────────────────────────────
const CardDivider = () => (
  <div style={{
    width: 1, alignSelf: 'stretch', margin: '27px 0', flexShrink: 0,
    background: 'linear-gradient(to bottom, transparent, rgba(124,111,255,.5), transparent)',
  }} />
)

// ─── horizontal scroll ────────────────────────────────────────────────────────
function HorizontalScroller({ slots, shouldScroll }) {
  const trackRef     = useRef(null)
  const firstHalfRef = useRef(null)
  const posRef       = useRef(0)
  const rafRef       = useRef(null)
  const loopRef      = useRef(0)
  const pauseRef     = useRef(false)

  useEffect(() => {
    const el = firstHalfRef.current
    if (!el || !shouldScroll) return
    const measure = () => { loopRef.current = el.getBoundingClientRect().width }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [shouldScroll, slots.length])

  useEffect(() => {
    if (!shouldScroll) return
    const el = trackRef.current
    if (!el) return
    el.style.willChange = 'transform'
    el.style.backfaceVisibility = 'hidden'
    let lastTs = 0
    function tick(ts) {
      const dt = lastTs ? Math.min(ts - lastTs, 33) : 16.7
      lastTs = ts
      if (!pauseRef.current) {
        posRef.current += 1.0 * (dt / 16.7)
        const lp = loopRef.current
        if (lp > 0 && posRef.current >= lp) posRef.current -= lp
        const x = posRef.current
        el.style.transform = `translate3d(${-x}px, 0, 0)`
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [shouldScroll])

  const Cards = ({ prefix }) =>
    slots.map((entry, i) => (
      <SlotCard key={`${prefix}-${entry.id}`} entry={entry} index={i} />
    ))

  if (!shouldScroll) {
    return (
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 21, padding: '16px 31px', height: '100%' }}>
        {slots.map((entry, i) => (
          <SlotCard key={`s-${entry.id}`} entry={entry} index={i} />
        ))}
      </div>
    )
  }

  return (
    <div
      style={{ overflow: 'hidden', height: '100%', display: 'flex', alignItems: 'stretch', cursor: 'default' }}
      onMouseEnter={() => { pauseRef.current = true }}
      onMouseLeave={() => { pauseRef.current = false }}
    >
      <div ref={trackRef} style={{ display: 'flex', alignItems: 'stretch', willChange: 'transform', userSelect: 'none', WebkitUserSelect: 'none' }}>
        <div ref={firstHalfRef} style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 21, padding: '11px 21px' }}>
            <Cards prefix="a" />
          </div>
          <CardDivider />
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 14, padding: '11px 21px' }}>
            <Cards prefix="b" />
          </div>
          <CardDivider />
        </div>
      </div>
    </div>
  )
}

// ─── styles ───────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;600;700;900&family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700;800&display=swap');
  html, body { background: transparent !important; margin: 0; padding: 0; }
  html, body, * {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: geometricPrecision;
  }
  /* Elements that move via transform must stay on their own compositor layer
     to prevent 2K sub-pixel shimmer in OBS Browser Source */
  [style*="translate3d"], [style*="translateX"], [style*="translateY"] {
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    transform-style: preserve-3d;
  }

  .slot-card { -webkit-transition: -webkit-transform .2s ease; transition: transform .2s ease; }
  .slot-card:hover { -webkit-transform: translateY(-4px); transform: translateY(-4px); }

  @-webkit-keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .shimmer {
    background: -webkit-linear-gradient(left, rgba(255,255,255,.04) 25%, rgba(255,255,255,.09) 50%, rgba(255,255,255,.04) 75%);
    background: linear-gradient(90deg, rgba(255,255,255,.04) 25%, rgba(255,255,255,.09) 50%, rgba(255,255,255,.04) 75%);
    background-size: 800px 100%;
    -webkit-animation: shimmer 1.6s infinite linear;
    animation: shimmer 1.6s infinite linear;
  }

  @-webkit-keyframes fadeIn {
    from { opacity: 0; -webkit-transform: translateY(4px); transform: translateY(4px); }
    to   { opacity: 1; -webkit-transform: translateY(0); transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .overlay-root { -webkit-animation: fadeIn .4s ease both; animation: fadeIn .4s ease both; }

  @-webkit-keyframes pulse-border {
    0%, 100% { opacity: 1; }
    50%       { opacity: .5; }
  }
  @keyframes pulse-border {
    0%, 100% { opacity: 1; }
    50%       { opacity: .5; }
  }
  .live-dot {
    width: 16px; height: 16px; border-radius: 50%;
    background: #ef4444;
    -webkit-animation: pulse-border 1.4s ease-in-out infinite;
    animation: pulse-border 1.4s ease-in-out infinite;
    box-shadow: 0 0 11px rgba(239,68,68,.7);
  }
`

const S = {
  root: {
    width: 1950,
    height: 567,
    background: '#0b0d16',
    borderRadius: 48,
    border: '1px solid rgba(255,255,255,.1)',
    display: '-webkit-flex',
    display: 'flex',
    flexDirection: 'column',
    WebkitFlexDirection: 'column',
    overflow: 'hidden',
    fontFamily: '"Sora", system-ui, sans-serif',
    boxShadow: '0 4px 40px rgba(0,0,0,.6)',
  },
  header: {
    background: '#070910',
    borderBottom: '1px solid rgba(255,255,255,.06)',
    height: 84,
    display: '-webkit-flex',
    display: 'flex',
    alignItems: 'center',
    WebkitAlignItems: 'center',
    padding: '0 31px',
    gap: 14,
    flexShrink: 0,
    WebkitFlexShrink: 0,
  },
  pill: {
    background: 'rgba(124,111,255,.18)',
    border: '1px solid rgba(124,111,255,.45)',
    borderRadius: 100,
    padding: '6px 27px',
    fontSize: 18,
    fontWeight: 700,
    color: '#a78bfa',
    fontFamily: '"JetBrains Mono", monospace',
    letterSpacing: '.04em',
  },
  badge: (color, bg) => ({
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: '.6px',
    padding: '3px 10px',
    borderRadius: 7,
    background: bg,
    color,
    border: `1px solid ${color}55`,
    textTransform: 'uppercase',
    lineHeight: 1.4,
  }),
}

// ─── main ─────────────────────────────────────────────────────────────────────
export default function Overlay() {
  const [entries, setEntries] = useState([])
  const [hunt,    setHunt]    = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const { data: h } = await supabase
      .from('bonus_hunts').select('*').eq('active', true).limit(1).single()
    if (!h) { setLoading(false); return }
    setHunt(h)
    const { data } = await supabase
      .from('bonus_entries')
      .select('*, slot:slots(*)')
      .eq('hunt_id', h.id)
      .order('created_at', { ascending: true })
    if (data) setEntries(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const ch = supabase.channel('overlay-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_entries' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_hunts'   }, loadData)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadData])

  const slots        = entries.filter(e => e.slot)
  const shouldScroll = slots.length >= 5
  const supers       = entries.filter(e => e.is_super).length
  const totalBet     = entries.reduce((a, e) => a + parseBet(e.bet), 0)
  const balStart     = parseFloat(hunt?.balance_start) || 0
  const balEnd       = parseFloat(hunt?.balance_end)
  const hasBalEnd    = !isNaN(balEnd) && hunt?.balance_end != null
  const target       = hasBalEnd ? Math.max(0, balStart - balEnd) : balStart
  const be           = totalBet > 0 ? target / totalBet : 0

  const match   = (hunt?.title || '').match(/#?(\d+)/)
  const huntNum = match ? `#${match[1]}` : '#—'

  if (loading) return <Skeleton />

  return (
    <div style={S.root} className="overlay-root">
      <style>{GLOBAL_CSS}</style>

      {/* HEADER */}
      <div style={S.header}>
        <div style={S.pill}>{huntNum}</div>
        <svg width="31" height="31" viewBox="0 0 24 24" fill="none" stroke="#7c6fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
        </svg>
        <span style={{ fontSize: 27, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '.09em' }}>Bonus Hunt</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: '-webkit-flex', display: 'flex', alignItems: 'center', WebkitAlignItems: 'center', gap: 13 }}>
          <div className="live-dot" />
          <span style={{ fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,.3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>live</span>
        </div>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, WebkitFlex: 1, display: '-webkit-flex', display: 'flex', overflow: 'hidden' }}>

        {/* SLOTS CAROUSEL */}
        <div style={{ flex: 1, WebkitFlex: 1, overflow: 'hidden' }}>
          <HorizontalScroller slots={slots} shouldScroll={shouldScroll} />
        </div>

        {/* RIGHT PANEL */}
        <div style={{ width: 459, borderLeft: '1px solid rgba(255,255,255,.06)', background: '#070910', display: '-webkit-flex', display: 'flex', flexDirection: 'column', WebkitFlexDirection: 'column', flexShrink: 0, WebkitFlexShrink: 0 }}>

          {/* Stats 2x2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, padding: '13px 13px 0' }}>
            <StatBox icon={<IconTarget />} label="TARGET"    value={balStart ? fmt(balStart, 0) + '€' : '—'}    color="#22c55e" borderColor="rgba(34,197,94,.25)"    iconBg="rgba(34,197,94,.15)"   />
            <StatBox icon={<IconScale />}  label="BREAKEVEN" value={be > 0 ? be.toFixed(1) + 'x' : '—'}        color="#f59e0b" borderColor="rgba(245,158,11,.25)"   iconBg="rgba(245,158,11,.15)"  />
            <StatBox icon={<IconGift />}   label="BONUS"     value={entries.length}                              color="#a78bfa" borderColor="rgba(167,139,250,.25)" iconBg="rgba(167,139,250,.15)" />
            <StatBox icon={<IconStar />}   label="SUPERS"    value={supers}                                      color="#fbbf24" borderColor="rgba(251,191,36,.25)"   iconBg="rgba(251,191,36,.15)"  />
          </div>

          {/* Ticker */}
          <div style={{ flex: 1, WebkitFlex: 1, borderTop: '1px solid rgba(255,255,255,.06)', padding: '10px 21px', overflow: 'hidden', display: '-webkit-flex', display: 'flex', flexDirection: 'column', WebkitFlexDirection: 'column', marginTop: 7 }}>
            <TickerVertical entries={entries} />
          </div>

        </div>
      </div>
    </div>
  )
}