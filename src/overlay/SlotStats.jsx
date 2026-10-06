import { useState, useEffect, useRef } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

function fmtStat(val, dec = 2) {
  if (!val || isNaN(val)) return '—'
  return Number(val).toFixed(dec)
}
function parseBet(val) {
  if (!val) return 0
  return parseFloat(String(val).replace(',', '.')) || 0
}
function volColor(v) {
  if (!v) return '#f59e0b'
  const l = v.toLowerCase()
  if (l.includes('low'))  return '#22c55e'
  if (l.includes('high')) return '#ef4444'
  return '#f59e0b'
}
function volLabel(v) {
  if (!v) return '—'
  const l = v.toLowerCase()
  if (l === 'low') return 'Low'
  if (l === 'medium' || l === 'mid') return 'Mid'
  if (l === 'high') return 'High'
  if (l.includes('mid') && l.includes('high')) return 'Mid-High'
  return v
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;600;700;800;900&family=Sora:wght@700;800&display=swap');
@keyframes spin         { to { transform: rotate(360deg); } }
@keyframes blink        { 0%,100%{opacity:1} 50%{opacity:.2} }
@keyframes confettiFall { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(500px) rotate(720deg);opacity:0} }
@keyframes recordBadge  { 0%{opacity:0;transform:scale(.75)} 15%{opacity:1;transform:scale(1.05)} 80%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(.95)} }
html, body { background: transparent !important; margin: 0; padding: 0; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
`

function FlipCard({
  frontIcon, frontIconBg, frontBorder,
  frontLbl, frontVal, frontValColor,
  backIcon, backIconBg, backBorder,
  backLbl, backVal,
  flipped,
}) {
  const face = (isBack) => ({
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16,
    padding: '32px 24px',
    backfaceVisibility: 'hidden',
    transform: (isBack ? !flipped : flipped) ? 'rotateY(90deg)' : 'rotateY(0deg)',
    transition: (isBack ? !flipped : flipped)
      ? 'transform .22s ease-in'
      : 'transform .22s ease-out .22s',
  })

  return (
    <div style={{
      position: 'relative',
      background: '#0c0e1c',
      borderRadius: 32,
      overflow: 'hidden',
      perspective: 2400,
      border: `1px solid ${flipped ? (backBorder || 'rgba(255,255,255,0.08)') : (frontBorder || 'rgba(255,255,255,0.12)')}`,
      transition: 'border-color .3s ease',
    }}>
      <div style={face(false)}>
        <div style={{ width: 84, height: 84, borderRadius: 24, background: frontIconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {frontIcon}
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'center', lineHeight: 1 }}>
          {frontLbl}
        </div>
        <div style={{ fontSize: 52, fontWeight: 800, fontFamily: "'Sora',sans-serif", color: frontValColor || '#fff', lineHeight: 1 }}>
          {frontVal}
        </div>
      </div>
      <div style={face(true)}>
        <div style={{ width: 84, height: 84, borderRadius: 24, background: backIconBg || 'rgba(136,144,168,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {backIcon}
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'center', lineHeight: 1 }}>
          {backLbl}
        </div>
        <div style={{ fontSize: 52, fontWeight: 800, fontFamily: "'Sora',sans-serif", color: '#8890a8', lineHeight: 1 }}>
          {backVal}
        </div>
      </div>
      {/* height anchor */}
      <div style={{ visibility: 'hidden', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 84, height: 42 }} />
        <div style={{ fontSize: 26, lineHeight: 1 }}>lbl</div>
        <div style={{ fontSize: 52, lineHeight: 1 }}>val</div>
      </div>
    </div>
  )
}

export default function SlotStats() {
  const [slot,      setSlot]      = useState(null)
  const [stats,     setStats]     = useState(null)
  const [animate,   setAnimate]   = useState(false)
  const [newRecord, setNewRecord] = useState(false)
  const [flipped,   setFlipped]   = useState(false)

  const prevBestWin      = useRef(null)
  const currentSlotIdRef = useRef(null)
  const recordPending    = useRef(false)
  const pendingSlotId    = useRef(null)
  const prevCheckedSlot  = useRef(null)

  async function loadStats(slotId) {
    const { data: slotData } = await supabase.from('slots').select('*').eq('id', slotId).single()
    if (!slotData) return
    const { data: entries } = await supabase.from('bonus_entries').select('*').eq('slot_id', slotId).not('payment', 'is', null)
    const valid    = (entries || []).filter(e => e.payment && parseFloat(e.payment) > 0 && e.bet && parseBet(e.bet) > 0)
    const multis   = valid.map(e => parseFloat(e.payment) / parseBet(e.bet))
    const payments = valid.map(e => parseFloat(e.payment))
    const newBestWin   = payments.length ? Math.max(...payments) : null
    const newBestMulti = multis.length   ? Math.max(...multis)   : null
    const avgWin       = payments.length ? payments.reduce((a,b) => a+b,0) / payments.length : null
    const bestEntry    = valid.find(e => parseFloat(e.payment)/parseBet(e.bet) === newBestMulti)
    const bestBet      = bestEntry ? parseBet(bestEntry.bet) : null
    setAnimate(false)
    setTimeout(() => {
      const isSameSlot = slotId === currentSlotIdRef.current
      const isNewWin   = isSameSlot && newBestWin && prevBestWin.current !== null && newBestWin > prevBestWin.current
      if (isNewWin) {
        recordPending.current = true
        setNewRecord(true)
        setTimeout(() => {
          setNewRecord(false)
          recordPending.current = false
          if (pendingSlotId.current) {
            const nextId = pendingSlotId.current
            pendingSlotId.current = null
            currentSlotIdRef.current = nextId
            loadStats(nextId)
          }
        }, 4000)
      }
      prevBestWin.current      = newBestWin
      currentSlotIdRef.current = slotId
      setSlot(slotData)
      setStats({ bestMulti: newBestMulti, bestWin: newBestWin, avgWin, bestBet, timesPlayed: valid.length })
      setAnimate(true)
    }, 50)
  }

  async function loadCurrentSlot() {
    try {
      const { data: hunts } = await supabase.from('bonus_hunts').select('*').eq('active', true).limit(1)
      if (!hunts?.length) return
      const { data: entries } = await supabase.from('bonus_entries').select('*').eq('hunt_id', hunts[0].id).order('created_at', { ascending: true })
      if (!entries?.length) return
      const lastOpened = [...entries].reverse().find(e => e.opened && e.payment && parseFloat(e.payment) > 0)
      const nextUp     = entries.find(e => !e.opened)
      if (lastOpened && lastOpened.slot_id && lastOpened.slot_id !== prevCheckedSlot.current) {
        const { data: allEntries } = await supabase.from('bonus_entries').select('*').eq('slot_id', lastOpened.slot_id).not('payment', 'is', null)
        const valid    = (allEntries || []).filter(e => e.payment && parseFloat(e.payment) > 0 && e.bet && parseBet(e.bet) > 0)
        const payments = valid.map(e => parseFloat(e.payment))
        const thisPay  = parseFloat(lastOpened.payment)
        const prevBest = payments.filter(p => p !== thisPay).reduce((a,b) => Math.max(a,b), 0)
        if (valid.length >= 1 && thisPay > prevBest) {
          prevCheckedSlot.current = lastOpened.slot_id
          recordPending.current   = true
          const { data: slotData } = await supabase.from('slots').select('*').eq('id', lastOpened.slot_id).single()
          if (slotData) {
            const multis    = valid.map(e => parseFloat(e.payment)/parseBet(e.bet))
            const bestMulti = Math.max(...multis)
            const bestEntry = valid.find(e => parseFloat(e.payment)/parseBet(e.be) === bestMulti)
            const avgWin    = payments.reduce((a,b)=>a+b,0) / payments.length
            setSlot(slotData)
            setStats({ bestWin: Math.max(...payments), bestMulti, avgWin, bestBet: bestEntry ? parseBet(bestEntry.bet) : null, timesPlayed: valid.length })
            setAnimate(true)
            setNewRecord(true)
          }
          setTimeout(() => {
            setNewRecord(false)
            recordPending.current = false
            const next = nextUp || entries[entries.length - 1]
            if (next?.slot_id) { currentSlotIdRef.current = next.slot_id; loadStats(next.slot_id) }
          }, 4000)
          return
        }
        prevCheckedSlot.current = lastOpened.slot_id
      }
      if (recordPending.current) return
      const current = nextUp || entries[entries.length - 1]
      if (!current?.slot_id) return
      currentSlotIdRef.current = current.slot_id
      await loadStats(current.slot_id)
    } catch {}
  }

  useEffect(() => {
    const flipTimer = setInterval(() => setFlipped(f => !f), 4000)
    return () => clearInterval(flipTimer)
  }, [])

  useEffect(() => {
    loadCurrentSlot()
    const ch = supabase.channel('slotstats-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_entries' }, loadCurrentSlot)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_hunts'   }, loadCurrentSlot)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  if (!slot || !stats) return (
    <div style={{ width: 1600, height: 640, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{CSS}</style>
      <div style={{ width: 96, height: 96, borderRadius: '50%', border: '10px solid rgba(255,255,255,.08)', borderTopColor: '#7c6fff', animation: 'spin .8s linear infinite' }} />
    </div>
  )

  const volCol = volColor(slot.volatility)
  const volLbl = volLabel(slot.volatility)

  return (
    <div style={{
      width: 1600,
      fontFamily: "'Rubik', sans-serif",
      background: '#07090f',
      borderRadius: 40,
      overflow: 'hidden',
      border: newRecord ? '1px solid rgba(251,191,36,.45)' : '1px solid rgba(255,255,255,.08)',
      boxShadow: newRecord ? '0 0 32px rgba(251,191,36,.18)' : '0 8px 40px rgba(0,0,0,.6)',
      display: 'flex',
      position: 'relative',
      opacity: animate ? 1 : 0,
      transform: animate ? 'translateY(0)' : 'translateY(10px)',
      transition: 'opacity .4s ease, transform .4s ease, border-color .3s, box-shadow .3s',
    }}>
      <style>{CSS}</style>

      {/* ── ESQUERDA: foto — blur contido, sem vazar ── */}
      <div style={{ width: 420, flexShrink: 0, position: 'relative', overflow: 'hidden', background: '#0a0b18' }}>
        {/* blur bg — contido pelo overflow:hidden do pai */}
        {slot.image_url && (
          <img
            src={slot.image_url} alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(44px)', opacity: .4, transform: 'scale(1.12)' }}
          />
        )}
        {/* imagem principal */}
        {slot.image_url && (
          <img
            src={slot.image_url} alt={slot.name}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }}
            onError={e => { e.target.style.opacity = '.2' }}
          />
        )}
        {/* gradiente lateral direito — suave para não sangrar */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 45%, rgba(7,9,15,.85) 100%)' }} />
        {/* gradiente inferior */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, background: 'linear-gradient(to top, rgba(7,9,15,.98) 0%, transparent 100%)' }} />

        {/* LIVE pill */}
        <div style={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 14,
          background: 'rgba(8,9,26,.92)', border: '1px solid rgba(124,111,255,.4)',
          borderRadius: 200, padding: '10px 32px', whiteSpace: 'nowrap',
        }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#7c6fff', boxShadow: '0 0 16px rgba(124,111,255,.8)', animation: 'blink 1.4s ease-in-out infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 28, fontWeight: 700, color: '#a78bfa', letterSpacing: '.08em' }}>LIVE</span>
        </div>

        {/* confetti */}
        {newRecord && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', overflow: 'hidden' }}>
            {Array.from({ length: 16 }).map((_, i) => {
              const colors = ['#fbbf24', '#22c55e', '#7c6fff', '#ef4444', '#06b6d4', '#fff']
              const left = `${Math.random() * 100}%`
              const delay = `${Math.random() * 1.2}s`
              const dur = `${1.4 + Math.random() * 1.6}s`
              const size = `${6 + Math.random() * 8}px`
              return <div key={i} style={{ position: 'absolute', top: 0, left, width: size, height: size, borderRadius: '50%', background: colors[i % colors.length], animation: `confettiFall ${dur} ${delay} ease-in forwards` }} />
            })}
          </div>
        )}
      </div>

      {/* ── DIREITA ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Nome + provider */}
        <div style={{ padding: '36px 40px 28px' }}>
          <div style={{ fontSize: 52, fontWeight: 800, color: '#eeeef5', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'Sora', sans-serif" }}>
            {slot.name}
          </div>
          <div style={{ fontSize: 28, color: 'rgba(255,255,255,.4)', marginTop: 8, fontWeight: 500, letterSpacing: '.02em' }}>
            {slot.provider || ''}
          </div>
        </div>

        {/* Pills RTP / VOL / MAX */}
        <div style={{ display: 'flex', gap: 12, padding: '0px 40px 32px' }}>

          <div style={{ flex: 1, background: '#0c0e1c', border: '1px solid rgba(6,182,212,.2)', borderRadius: 28, padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5 }}>RTP</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#06b6d4', lineHeight: 1, fontFamily: "'Sora', sans-serif" }}>
              {slot.rtp ? `${slot.rtp}%` : '—'}
            </div>
          </div>

          {/* VOL — fix correto: dot e span separados */}
          <div style={{ flex: 1, background: '#0c0e1c', border: `1px solid ${volCol}33`, borderRadius: 28, padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5 }}>VOL</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: volCol, lineHeight: 1, fontFamily: "'Sora', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: volCol, display: 'block', flexShrink: 0, boxShadow: `0 0 6px ${volCol}` }} />
              <span>{volLbl}</span>
            </div>
          </div>

          <div style={{ flex: 1, background: '#0c0e1c', border: '1px solid rgba(167,139,250,.2)', borderRadius: 28, padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5 }}>MAX</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#a78bfa', lineHeight: 1, fontFamily: "'Sora', sans-serif" }}>
              {slot.max_win ? `x${slot.max_win}` : '—'}
            </div>
          </div>
        </div>

        {/* Divisor Personal Best */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '0px 40px', marginBottom: 12 }}>
          <div style={{ flex: 1, height: 2, background: 'linear-gradient(to right, transparent, rgba(251,191,36,.2))' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(251,191,36,.07)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 200, padding: '10px 28px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/>
              <path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
              <path d="M12 17v4"/><path d="M8 21h8"/>
              <path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/>
            </svg>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '.1em' }}>Personal Best</span>
          </div>
          <div style={{ flex: 1, height: 2, background: 'linear-gradient(to left, transparent, rgba(251,191,36,.2))' }} />
        </div>

        {/* 3 stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, padding: '0px 32px 32px' }}>

          {/* Best Win — estático */}
          <div style={{ background: '#0c0e1c', borderRadius: 32, padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, border: '1px solid rgba(34,197,94,.15)' }}>
            <div style={{ width: 84, height: 84, borderRadius: 24, background: 'rgba(34,197,94,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="9" r="6"/><path d="M8.5 14.5 7 23l5-3 5 3-1.5-8.5"/>
              </svg>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '.06em', lineHeight: 1 }}>Best Win</div>
            <div style={{ fontSize: 52, fontWeight: 800, color: '#22c55e', lineHeight: 1, fontFamily: "'Sora',sans-serif" }}>
              {stats.bestWin ? `${fmtStat(stats.bestWin)}€` : '—'}
            </div>
          </div>

          {/* Best Multi ↔ Bet Size */}
          <FlipCard
            frontIcon={
              <svg width="44" height="44" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            }
            frontIconBg="rgba(251,191,36,.12)"
            frontBorder="rgba(251,191,36,.15)"
            frontLbl="Best Multi"
            frontVal={stats.bestMulti ? `${fmtStat(stats.bestMulti, 1)}x` : '—'}
            frontValColor="#fbbf24"
            backIcon={
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#8890a8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M8 12h8"/>
              </svg>
            }
            backIconBg="rgba(136,144,168,.1)"
            backBorder="rgba(255,255,255,0.08)"
            backLbl="Bet Size"
            backVal={stats.bestBet ? `${fmtStat(stats.bestBet)}€` : '—'}
            flipped={flipped}
          />

          {/* Avg Win ↔ Jogadas */}
          <FlipCard
            frontIcon={
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            }
            frontIconBg="rgba(245,158,11,.12)"
            frontBorder="rgba(245,158,11,.15)"
            frontLbl="Avg Win"
            frontVal={stats.avgWin ? `${fmtStat(stats.avgWin)}€` : '—'}
            frontValColor="#f59e0b"
            backIcon={
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#8890a8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            }
            backIconBg="rgba(136,144,168,.1)"
            backBorder="rgba(255,255,255,0.08)"
            backLbl="Jogadas"
            backVal={stats.timesPlayed ? `${stats.timesPlayed}x` : '—'}
            flipped={flipped}
          />

        </div>

        {/* NEW PERSONAL BEST badge */}
        {newRecord && (
          <div style={{ position: 'absolute', bottom: 24, left: 430, right: 0, display: 'flex', justifyContent: 'center', animation: 'recordBadge 3.5s ease forwards', zIndex: 10, pointerEvents: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(8,9,26,.96)', backdropFilter: 'blur(32px)', border: '1px solid rgba(251,191,36,.5)', borderRadius: 200, padding: '14px 40px', boxShadow: '0 0 24px rgba(251,191,36,.2)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" strokeWidth="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span style={{ fontSize: 32, fontWeight: 700, color: '#fbbf24', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>NEW PERSONAL BEST!</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}