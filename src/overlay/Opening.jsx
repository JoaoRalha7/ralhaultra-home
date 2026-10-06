import { useState, useEffect, useRef, useCallback } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

// ─── utilitários ──────────────────────────────────────────────────────────────
function parseBet(val) {
  if (!val) return 0
  return parseFloat(String(val).replace(',', '.')) || 0
}
function fmtPay(v) {
  if (v === null || v === undefined) return '—'
  return v >= 100 ? Math.floor(v).toLocaleString('pt-PT') + '€' : v.toFixed(2) + '€'
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3) }

function getPos(idx, currentIndex) {
  const d = idx - currentIndex
  if (d === 0)  return 'pos-center'
  if (d === -1) return 'pos-prev1'
  if (d === 1)  return 'pos-next1'
  if (d === -2) return 'pos-prev2'
  if (d === 2)  return 'pos-next2'
  if (d === -3) return 'pos-prev3'
  if (d === 3)  return 'pos-next3'
  return d < 0 ? 'pos-hidden-left' : 'pos-hidden-right'
}

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
const IconTarget   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
const IconMoney    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
const IconScale    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 4-1 7-1s5 1 7 1h2"/></svg>
const IconGift     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
const IconStar     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
const IconBar      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
const IconTrendUp  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>

// ─── COMPONENTES UI ──────────────────────────────────────────────────────────

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

function FlipStatBox({ faces }) {
  const [flipped, setFlipped] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setFlipped(f => !f), 3500)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flip-stat-container">
      <div className={`flip-stat-inner${flipped ? ' flipped' : ''}`}>
        <div className="flip-stat-face">
          <div className="app-info-box">
            <div className={`app-info-icon ${faces[0].colorClass}`}>{faces[0].icon}</div>
            <div className="app-info-body">
              <div className="app-info-lbl">{faces[0].label}</div>
              <div className={`app-info-val val-${faces[0].colorClass}`}>{faces[0].val}</div>
            </div>
          </div>
        </div>
        <div className="flip-stat-face flip-stat-back">
          <div className="app-info-box">
            <div className={`app-info-icon ${faces[1].colorClass}`}>{faces[1].icon}</div>
            <div className="app-info-body">
              <div className="app-info-lbl">{faces[1].label}</div>
              <div className={`app-info-val val-${faces[1].colorClass}`}>{faces[1].val}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="flip-stat-dots">
        <div className={`flip-stat-dot${!flipped ? ' active' : ''}`} />
        <div className={`flip-stat-dot${flipped ? ' active' : ''}`} />
      </div>
    </div>
  )
}

function CarouselItem({ entry, index, currentIndex, bestId, worstId, isAnimatingIdx, onPaymentDone }) {
  const slot = entry.slot || {}, bet = parseBet(entry.bet)
  const pay = entry.payment ? parseFloat(entry.payment) : null
  const multi = pay && bet ? pay / bet : null
  const position = getPos(index, currentIndex)
  const isCenter = position === 'pos-center'
  const payRef = useRef(null), didAnim = useRef(false)

  useEffect(() => {
    if (!isCenter || !pay || !isAnimatingIdx || didAnim.current) return
    didAnim.current = true
    const el = payRef.current; if (!el) return
    const dur = Math.min(3500, Math.max(1200, pay * 2.5))
    const t0 = performance.now()
    el.textContent = '0.00€'; el.style.color = '#fff'; el.classList.add('visible')
    function tick(now) {
      const p = Math.min((now - t0) / dur, 1), v = easeOut(p) * pay
      el.textContent = pay >= 100 ? Math.floor(v).toLocaleString('pt-PT') + '€' : v.toFixed(2) + '€'
      if (p < 1) { requestAnimationFrame(tick); return }
      el.textContent = fmtPay(pay)
      
      el.classList.remove('blink'); 
      void el.offsetWidth; 
      el.classList.add('blink')
      
      el.style.color = multi >= 100 ? 'var(--green)' : 'var(--red)'
      setTimeout(onPaymentDone, 2000)
    }
    requestAnimationFrame(tick)
  }, [isCenter, isAnimatingIdx])

  useEffect(() => { didAnim.current = false }, [entry.id, entry.payment])

  const classes = ['slot-item', position, entry.opened ? 'opened' : '', entry.is_super ? 'super' : '', entry.id === bestId ? 'best-slot' : '', entry.id === worstId ? 'worst-slot' : ''].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <div className="slot-img-wrap">
        <img className="slot-img" src={slot.image_url || ''} alt={slot.name || ''} onError={e => { e.target.style.opacity = '.3' }} />
        <div className="slot-overlay-top">
          <span className="slot-num">#{index + 1}</span>
          {entry.is_super && <span className="slot-super-tag">SUPER</span>}
        </div>
        <div className="slot-overlay-bottom">
          <div className={`slot-bottom-row${entry.opened && pay ? ' has-pay' : ''}`}>
            {entry.opened && pay && (
              <div className="slot-bottom-col">
                <span ref={payRef} className={`slot-payment-val${(!isAnimatingIdx || !isCenter) ? ' visible' : ''}`} style={{ color: multi >= 100 ? 'var(--green)' : 'var(--red)' }}>
                  {fmtPay(pay)}
                </span>
              </div>
            )}
            <div className="slot-bottom-col">
              <span className="slot-bet-val">{bet > 0 ? bet.toFixed(2) + '€' : '—'}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="slot-label">{slot.name || '—'}</div>
    </div>
  )
}

function ListRow({ entry, index, isCurrent, picker }) {
  const slot = entry.slot || {}, bet = parseBet(entry.bet)
  const pay = entry.payment ? parseFloat(entry.payment) : null
  const multi = pay && bet ? pay / bet : null
  const mc = multi === null ? 'empty' : multi >= 100 ? 'val-green' : 'val-red'
  
  const winRef = useRef(null), prevPay = useRef(null)

  useEffect(() => {
    if (!pay) { prevPay.current = null; return }
    if (pay === prevPay.current || !winRef.current) return
    const el = winRef.current, old = prevPay.current; prevPay.current = pay
    if (old !== null) return
    const dur = Math.min(2500, Math.max(800, pay * 2)), t0 = performance.now()
    el.textContent = '0.00€'
    function tick(now) {
      const p = Math.min((now - t0) / dur, 1), v = easeOut(p) * pay
      el.textContent = pay >= 100 ? Math.floor(v).toLocaleString('pt-PT') + '€' : v.toFixed(2) + '€'
      if (p < 1) { requestAnimationFrame(tick); return }
      el.textContent = fmtPay(pay)
    }
    requestAnimationFrame(tick)
  }, [pay])

  const cls = 'list-row ' + (isCurrent ? 'current' : entry.opened ? 'opened' : 'unopened')
  return (
    <div className={cls}>
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
        
        {picker && (
          <div className="list-picker">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            {picker}
          </div>
        )}
      </div>
      <div className="list-cols">
        {pay ? <>
          <div className="list-col-row">
            <span className="list-col-lbl">BET</span>
            <span className="list-col-val">{bet ? bet.toFixed(2) + '€' : '—'}</span>
          </div>
          <div className="list-col-row">
            <span className="list-col-lbl">X</span>
            <span className={`list-col-val ${mc}`}>{multi ? multi.toFixed(1) + 'x' : '—'}</span>
          </div>
          <div className="list-col-row">
            <span className="list-col-lbl">WIN</span>
            <span className="list-col-val white" ref={winRef}>{fmtPay(pay)}</span>
          </div>
        </> : <>
          <div className="list-col-row">
            <span className="list-col-lbl">BET</span>
            <span className="list-col-val">{bet ? bet.toFixed(2) + '€' : '—'}</span>
          </div>
        </>}
      </div>
    </div>
  )
}

function FlipCard({ best, worst }) {
  const [flipped, setFlipped] = useState(false)
  const hasData = !!(best && worst)
  useEffect(() => {
    if (!hasData) return
    const t = setInterval(() => setFlipped(f => !f), 4000)
    return () => clearInterval(t)
  }, [hasData])
  
  const Face = ({ entry, type }) => {
    const slot = entry.slot || {}, bet = parseBet(entry.bet), pay = parseFloat(entry.payment), multi = pay / bet
    const isBest = type === 'best'
    return (
      <div className={`flip-face ${isBest ? 'flip-front' : 'flip-back'}`}>
        <div className={`app-record-box border-${isBest ? 'green' : 'red'}`} style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
             <img className="flip-img" src={slot.image_url || ''} alt={slot.name || ''} onError={e => { e.target.style.opacity = '.3' }} />
             <div className="flip-details">
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
                  <div className={`flip-badge ${type}`}>{isBest ? 'BEST' : 'WORST'}</div>
                  <div className="flip-name">{slot.name || '—'}</div>
                </div>
                <div className="flip-bets">
                  <div className="flip-bet-block"><span className="flip-bet-lbl">BET</span><span className="flip-bet-val val-muted">{bet.toFixed(2)}€</span></div>
                  <div className="flip-arrow">→</div>
                  <div className="flip-bet-block"><span className="flip-bet-lbl">WIN</span><span className={`flip-bet-val val-${isBest ? 'green' : 'red'}`}>{pay.toFixed(2)}€</span></div>
                </div>
             </div>
          </div>
          <div className={`flip-multi val-${isBest ? 'green' : 'red'}`}>{multi.toFixed(1)}x</div>
        </div>
      </div>
    )
  }
  return (
    <div className={`flip-container${hasData ? ' visible' : ''}`}>
      <div className={`flip-inner${flipped ? ' flipped' : ''}`}>
        {best  && <Face entry={best}  type="best"  />}
        {worst && <Face entry={worst} type="worst" />}
      </div>
    </div>
  )
}

function AnimTotalVal({ value, format, className = '' }) {
  const v = useAnimatedValue(value)
  return <div className={`app-info-val ${className}`}>{format(v)}</div>
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function Opening() {
  const [entries,      setEntries]      = useState([])
  const [hunt,         setHunt]         = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [animatingIdx, setAnimatingIdx] = useState(null)
  const [picksMap,     setPicksMap]     = useState({})

  const isAnimating = useRef(false), firstLoad = useRef(true), prevEntries = useRef([])
  const wrapRef = useRef(null), listRef = useRef(null)

  useListScroll(wrapRef, listRef)

  // Variável que nos diz se já acabámos a hunt toda
  const allOpened = entries.length > 0 && entries.every(e => e.opened)

  // EFEITO AUTOPLAY (SHOWCASE)
  useEffect(() => {
    // Só arranca se tudo estiver aberto e não houver nenhuma animação a decorrer
    if (!allOpened || animatingIdx !== null) return

    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % entries.length)
    }, 3500) // Muda de slot a cada 3.5 segundos

    return () => clearInterval(timer)
  }, [allOpened, animatingIdx, entries.length])

  const loadData = useCallback(async () => {
    const { data: h } = await supabase.from('bonus_hunts').select('*').eq('active', true).limit(1).single()
    if (!h) return
    setHunt(h)
    const [{ data }, { data: pgData }] = await Promise.all([
      supabase.from('bonus_entries').select('*, slot:slots(*)').eq('hunt_id', h.id).order('created_at', { ascending: true }),
      supabase.from('pick_games').select('id, status').eq('hunt_id', h.id).in('status', ['open','closed','finished']).order('created_at', { ascending: false }).limit(1),
    ])
    if (!data) return
    if (pgData?.[0]) {
      const { data: ps } = await supabase.from('picks').select('entry_id, twitch_username').eq('game_id', pgData[0].id)
      const map = {}; for (const p of (ps || [])) map[p.entry_id] = p.twitch_username
      setPicksMap(map)
    }
    if (firstLoad.current) {
      firstLoad.current = false
      const idx = data.findIndex(e => !e.opened)
      // Se for a primeira vez e já estiver tudo aberto (idx === -1), começamos no 0 para arrancar o Showcase
      setCurrentIndex(idx >= 0 ? idx : 0)
      setEntries(data); prevEntries.current = data; return
    }
    const prevMap = new Map(prevEntries.current.map(e => [e.id, e]))
    const paymentRemoved = data.find(e => prevMap.get(e.id)?.payment && !e.payment)
    if (paymentRemoved) {
      const idx = data.findIndex(e => e.id === paymentRemoved.id)
      isAnimating.current = false; setAnimatingIdx(null)
      setCurrentIndex(idx); setEntries(data); prevEntries.current = data; return
    }
    if (!isAnimating.current) {
      const newlyOpened = data.find(e => { const prev = prevMap.get(e.id); return e.opened && e.payment && (!prev || !prev.payment) })
      if (newlyOpened) {
        const idx = data.findIndex(e => e.id === newlyOpened.id)
        isAnimating.current = true; setAnimatingIdx(idx)
        setCurrentIndex(idx); setEntries(data); prevEntries.current = data
      } else { setEntries(data); prevEntries.current = data }
    }
  }, [])

  function handlePaymentDone() {
    isAnimating.current = false; setAnimatingIdx(null)
    setEntries(prev => { 
      const idx = prev.findIndex(e => !e.opened); 
      setCurrentIndex(idx >= 0 ? idx : prev.length - 1); 
      return prev 
    })
  }

  useEffect(() => {
    loadData()
    const ch = supabase.channel('opening-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_entries' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_hunts'   }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'picks'         }, loadData)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadData])

  // computed
  const balStart  = parseFloat(hunt?.balance_start) || 0
  const balEnd    = parseFloat(hunt?.balance_end)
  const hasBalEnd = !isNaN(balEnd) && hunt?.balance_end != null
  const target    = hasBalEnd ? Math.max(0, balStart - balEnd) : balStart
  const allWithBet = entries.filter(e => parseBet(e.bet) > 0)
  const totalBets  = allWithBet.reduce((a, e) => a + parseBet(e.bet), 0)
  const opened     = entries.filter(e => e.opened && e.payment != null && !isNaN(parseFloat(e.payment)) && parseBet(e.bet) > 0 && e.slot)
  const unopened   = entries.filter(e => !e.opened && parseBet(e.bet) > 0)
  const totalPay   = opened.reduce((a, e) => a + parseFloat(e.payment), 0)
  const sumUnop    = unopened.reduce((a, e) => a + parseBet(e.bet), 0)
  const supers     = entries.filter(e => e.is_super).length
  const nOpened    = entries.filter(e => e.opened).length
  const beInicial  = totalBets > 0 ? target / totalBets : 0
  const beAtual    = sumUnop   > 0 ? (target - totalPay) / sumUnop : 0
  const avg        = opened.length > 0 ? opened.reduce((a, e) => a + parseFloat(e.payment) / parseBet(e.bet), 0) / opened.length : 0
  const profit     = hasBalEnd ? balEnd + totalPay - balStart : totalPay - balStart
  const pct        = entries.length > 0 ? (nOpened / entries.length * 100) : 0
  const withMulti  = opened.map(e => ({ ...e, multi: parseFloat(e.payment) / parseBet(e.bet) }))
  const sorted     = [...withMulti].sort((a, b) => b.multi - a.multi)
  const best       = sorted[0] || null
  const worst      = sorted[sorted.length - 1] || null
  const match      = (hunt?.title || '').match(/#?(\d+)/)
  const huntNum    = match ? '#' + match[1] : '#—'
  const profColor  = opened.length > 0 ? (profit >= 0 ? 'green' : 'red') : 'muted'

  // anim values
  const beVal    = useAnimatedValue(beAtual)
  const beIVal   = useAnimatedValue(beInicial)
  const startVal = useAnimatedValue(balStart)

  return (
    <div className="overlay-container">
      <style>{CSS}</style>

      {/* HEADER */}
      <div className="app-header-row">
        <div className="app-badge-hunt">{huntNum}</div>
        <div className="app-header-title">BONUS OPENING</div>
        <div style={{ flex: 1 }} />
        <div className="app-badge-live"><div className="dot-live" /> LIVE</div>
      </div>

      {/* STATS GRID */}
      <div className="app-stats-grid">
        <StatBoxStatic icon={<IconMoney />} colorClass="blue" label="Start" val={startVal > 0 ? Math.round(startVal) + '€' : '—'} />
        <FlipStatBox
          faces={[
            { icon: <IconScale />, colorClass: 'yellow', label: 'BE Init',   val: beIVal > 0 ? beIVal.toFixed(1) + 'x' : '—' },
            { icon: <IconScale />, colorClass: 'yellow', label: 'Breakeven', val: beVal  > 0 ? beVal.toFixed(1)  + 'x' : '—' },
          ]}
        />
        <FlipStatBox
          faces={[
            { icon: <IconGift />, colorClass: 'purple', label: 'Bonus',  val: String(entries.length) },
            { icon: <IconStar />, colorClass: 'yellow', label: 'Supers', val: String(supers) },
          ]}
        />
        <StatBoxStatic icon={<IconBar />} colorClass="purple" label="Average" val={avg > 0 ? avg.toFixed(1) + 'x' : '—'} />
      </div>

      {/* PROGRESS BAR */}
      <div className="prog-wrap">
        <div className="prog-fill" style={{ width: pct + '%' }} />
        <div className="prog-label">{nOpened} / {entries.length}</div>
      </div>

      {/* CAROUSEL */}
      <div className="carousel-wrap">
        <div className="carousel">
          {entries.map((entry, idx) => (
            <CarouselItem
              key={entry.id} entry={entry} index={idx}
              currentIndex={currentIndex} bestId={best?.id} worstId={worst?.id}
              isAnimatingIdx={animatingIdx === idx} onPaymentDone={handlePaymentDone}
            />
          ))}
        </div>
      </div>

      {/* DIVIDER */}
      <div className="app-divider" style={{ margin: '4px 0' }}>
        <div className="app-line" />
        <span className="app-divider-text">BONUS LIST</span>
        <div className="app-line" />
      </div>

      {/* LISTA INFINITA */}
      <div className="slots-list-wrap" ref={wrapRef}>
        <div className="slots-list" ref={listRef}>
          {[...entries, ...entries].map((entry, idx) => {
            const isClone = idx >= entries.length;
            const originalIdx = idx % entries.length;
            
            return (
              <ListRow
                key={isClone ? `clone-${entry.id}-${idx}` : entry.id}
                entry={entry} 
                index={originalIdx}
                // Adicionada a lógica 'allOpened' aqui para acompanhar o Autoplay!
                isCurrent={originalIdx === currentIndex && (!entry.opened || allOpened)}
                picker={picksMap[entry.id] || null}
              />
            )
          })}
        </div>
      </div>

      {/* FOOTER */}
      <div className="footer-wrap">
        <FlipCard best={best} worst={worst} />
        
        <div className="app-stats-grid" style={{ marginTop: '8px' }}>
          <div className="app-info-box border-green">
            <div className="app-info-icon green"><IconMoney /></div>
            <div className="app-info-body">
              <div className="app-info-lbl">TOTAL WON</div>
              <AnimTotalVal value={totalPay} format={v => fmtPay(v)} className="val-green" />
            </div>
          </div>
          <div className={`app-info-box border-${profColor}`}>
            <div className={`app-info-icon ${profColor}`}><IconTrendUp /></div>
            <div className="app-info-body">
              <div className="app-info-lbl">PROFIT</div>
              <AnimTotalVal
                value={opened.length > 0 ? profit : 0}
                format={v => opened.length > 0 ? (v >= 0 ? '+' : '') + v.toFixed(2) + '€' : '—'}
                className={`val-${profColor}`}
              />
            </div>
          </div>
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
.flip-stat-face { position: absolute; inset: 0; backface-visibility: hidden; }
.flip-stat-back { transform: rotateY(180deg); }
.flip-stat-dots {
  position: absolute; bottom: 3px; left: 0; right: 0;
  display: flex; justify-content: center; gap: 3px; pointer-events: none;
}
.flip-stat-dot { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,.1); transition: background .3s; }
.flip-stat-dot.active { background: rgba(255,255,255,.5); }

/* ── PROGRESS BAR ── */
.prog-wrap {
  height: 20px; background: var(--surface); border: 1px solid var(--border);
  border-radius: 100px; position: relative; display: flex; align-items: center; overflow: hidden;
}
.prog-fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--accent); transition: width .5s cubic-bezier(.4,0,.2,1); border-radius: 100px; }
.prog-label { position: relative; z-index: 1; width: 100%; text-align: center; font-size: 10px; font-weight: 800; font-family: var(--display); color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }

/* ── CAROUSEL ── */
.carousel-wrap { height: 190px; overflow: hidden; display: flex; align-items: center; position: relative; perspective: 1800px; }
.carousel { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; position: relative; transform-style: preserve-3d; }
.slot-item { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 6px; transition: all .55s cubic-bezier(.34,1.3,.64,1); transform-origin: center; transform-style: preserve-3d; }

.slot-item.pos-center  { transform: translateX(0) translateZ(0) rotateY(0deg) scale(1); opacity:1; z-index:5; }
.slot-item.pos-prev1   { transform: translateX(-108px) translateZ(-70px) rotateY(18deg) scale(0.72); opacity:.4; z-index:4; }
.slot-item.pos-next1   { transform: translateX(108px) translateZ(-70px) rotateY(-18deg) scale(0.72); opacity:.4; z-index:4; }
.slot-item.pos-prev2   { transform: translateX(-188px) translateZ(-140px) rotateY(32deg) scale(0.5); opacity:.1; z-index:3; }
.slot-item.pos-next2   { transform: translateX(188px) translateZ(-140px) rotateY(-32deg) scale(0.5); opacity:.1; z-index:3; }
.slot-item.pos-prev3, .slot-item.pos-next3 { opacity:0; pointer-events:none; }
.slot-item.pos-hidden-left, .slot-item.pos-hidden-right { opacity:0; pointer-events:none; }

.slot-img-wrap { position: relative; border-radius: 12px; overflow: hidden; }
.slot-img { width: 110px; height: 154px; border-radius: 12px; object-fit: cover; background: var(--surface2); display: block; border: 1px solid var(--border); transition: border-color .3s; }
.slot-item.pos-center .slot-img { border-color: var(--accent); border-width: 2px; }
.slot-item.pos-center.opened .slot-img { border-color: var(--green); }
.slot-item.pos-center.worst-slot .slot-img { border-color: var(--red); }

/* BORDA SUPER MELHORADA */
.slot-item.super .slot-img { 
  border-color: var(--yellow) !important;
  border-width: 2px;
  box-shadow: 0 4px 16px rgba(251,191,36,0.25) !important;
}

.slot-overlay-top { position: absolute; top: 6px; left: 6px; right: 6px; display: flex; align-items: center; justify-content: space-between; }

/* Número da Slot - Formato Pílula (Sempre neutro) */
.slot-num { 
  font-size: 10px; font-weight: 900; font-family: var(--display); color: #fff; 
  background: rgba(0,0,0,.8); padding: 0 8px; border-radius: 100px; 
  border: 1px solid var(--border2);
  height: 22px; display: flex; align-items: center; justify-content: center;
}

/* Tag SUPER - Formato Pílula */
.slot-super-tag { 
  font-size: 8px; font-weight: 800; padding: 0 6px; border-radius: 100px; 
  background: var(--yellow-dim); color: var(--yellow); border: 1px solid rgba(251,191,36,.4); 
  height: 22px; display: flex; align-items: center; justify-content: center;
}

.slot-overlay-bottom { position: absolute; bottom: 8px; left: 2px; right: 2px; display: flex; justify-content: center; }
.slot-bottom-row { display: flex; justify-content: center; width: 100%; gap: 4px; }
.slot-bottom-row.has-pay { justify-content: center; } /* Mantido no centro para caber na slot */

/* Bet e Pay com altura fixa (Pílula) e padding ajustado */
.slot-bet-val, .slot-payment-val { 
  font-size: 10px; font-weight: 900; font-family: var(--display); color: #fff; 
  background: rgba(9,12,21,0.9); padding: 0 6px; border-radius: 100px; 
  border: 1px solid rgba(255,255,255,0.08); 
  height: 22px; display: flex; align-items: center; justify-content: center;
  white-space: nowrap;
}
.slot-payment-val { display: none; }
.slot-payment-val.visible { display: flex; } /* Mantém a estrutura Flex sem crescer */

.slot-label { font-size: 11px; font-weight: 700; color: var(--muted); text-align: center; max-width: 110px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.slot-item.pos-center .slot-label { color: var(--text); font-size: 12px; }

/* BLINK ANIMATION CSS */
@keyframes colorBlink { 0%{opacity:1} 20%{opacity:0} 40%{opacity:1} 60%{opacity:0} 80%{opacity:1} 100%{opacity:1} }
.slot-payment-val.blink { animation: colorBlink .5s ease; }

/* ── DIVIDER ── */
.app-divider { display: flex; align-items: center; }
.app-divider-text { font-size: 9px; font-weight: 800; color: var(--muted); letter-spacing: 0.15em; margin: 0 10px; }
.app-line { flex: 1; height: 1px; background: var(--border2); }

/* ── LISTA ── */
.slots-list-wrap { flex: 1; overflow: hidden; position: relative; scrollbar-width: none; min-height: 0; mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 85%, rgba(0,0,0,0) 100%); -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 85%, rgba(0,0,0,0) 100%); }
.slots-list-wrap::-webkit-scrollbar { display: none; }
.slots-list { display: flex; flex-direction: column; gap: 6px; }
.slots-list.is-scrolling { animation: cssInfiniteScroll var(--scroll-duration, 20s) linear infinite; }
@keyframes cssInfiniteScroll { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }

/* Altura fixa nas caixas */
.list-row { 
  display: flex; align-items: center; gap: 10px; padding: 8px 10px; 
  background: var(--surface); border: 1px solid var(--border); 
  border-radius: 10px; transition: all 0.3s; 
  height: 56px; 
  overflow: hidden; 
}
.list-row.current { background: var(--accent-dim); border: 1px solid rgba(192,132,252,0.4); box-shadow: 0 0 12px rgba(192,132,252,0.15); }
.list-row.unopened { opacity: 0.7; }

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
.list-picker { display: inline-flex; align-items: center; gap: 3px; font-size: 8px; font-weight: 800; color: var(--blue); background: var(--blue-dim); border: 1px solid rgba(56,189,248,.3); border-radius: 100px; padding: 2px 6px; margin-top: 2px; width: fit-content; text-transform: uppercase; }
.list-provider { font-size: 8px; font-weight: 600; color: var(--muted2); text-transform: uppercase; letter-spacing: 0.05em; }

.list-cols { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.list-col-row { display: flex; align-items: center; gap: 6px; }
.list-col-lbl { font-size: 8px; font-weight: 800; color: var(--muted); text-transform: uppercase; }
.list-col-val { font-size: 10px; font-weight: 800; font-family: var(--display); color: var(--text); min-width: 42px; text-align: right; }
.list-col-val.val-green { color: var(--green); }
.list-col-val.val-red { color: var(--red); }
.list-col-val.empty { color: var(--muted); }

/* ── FOOTER & FLIP CARD ── */
.footer-wrap { flex-shrink: 0; display: flex; flex-direction: column; }
.flip-container { width: 100%; height: 0; overflow: hidden; perspective: 1000px; transition: height .5s ease, opacity .4s; opacity: 0; }
.flip-container.visible { height: 56px; opacity: 1; }
.flip-inner { width: 100%; height: 100%; position: relative; transform-style: preserve-3d; transition: transform .7s cubic-bezier(.4,0,.2,1); }
.flip-inner.flipped { transform: rotateY(180deg); }
.flip-face { position: absolute; inset: 0; backface-visibility: hidden; display: flex; align-items: center; }
.flip-back { transform: rotateY(180deg); }

.app-record-box {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px; border-radius: 10px;
  background: var(--surface); border: 1px solid var(--border);
}
.flip-img { width: 32px; height: 32px; border-radius: 6px; object-fit: cover; border: 1px solid var(--border2); }
.flip-details { display: flex; flex-direction: column; overflow: hidden; }
.flip-name { font-size: 11px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px; }

.flip-badge { font-size: 8px; font-weight: 800; letter-spacing: .05em; padding: 2px 6px; border-radius: 4px; background: rgba(0,0,0,0.4); }
.flip-badge.best { color: var(--green); border: 1px solid var(--green); }
.flip-badge.worst { color: var(--red); border: 1px solid var(--red); }

.flip-bets { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.flip-bet-block { display: flex; flex-direction: column; }
.flip-bet-lbl { font-size: 7px; font-weight: 800; color: var(--muted); }
.flip-bet-val { font-size: 10px; font-weight: 800; font-family: var(--display); }
.flip-arrow { font-size: 9px; color: var(--muted); margin-top: 4px; }
.flip-multi { font-size: 14px; font-weight: 900; font-family: var(--display); }
`