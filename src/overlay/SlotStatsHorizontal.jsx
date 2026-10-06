import { useState, useEffect, useRef } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

const DASHBOARD_ID = 'aa9660ca-4c53-4d4d-b81b-b3d231660420'

function fmtStat(val, dec = 2) {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '—'
  return Number(val).toFixed(dec)
}
function parseBet(val) {
  if (!val) return 0
  return parseFloat(String(val).replace(',', '.')) || 0
}
function volLabel(v) {
  if (!v) return '—'
  const l = v.toLowerCase()
  if (l === 'low') return 'Low'
  if (l === 'medium' || l === 'mid') return 'Medium'
  if (l === 'high') return 'High'
  if (l.includes('mid') && l.includes('high')) return 'Mid-High'
  return v
}
// Formata uma data ISO para dd/mm/aa
function fmtDate(isoStr) {
  if (!isoStr) return null
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const IconTarget     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
const IconPercent    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
const IconFlame      = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
const IconTrendingUp = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
const IconGift       = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>

const IconCalendar = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const IconTrophy   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
const IconStar     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
const IconDollar   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>

export default function AppSlotStatsHorizontal() {
  const [slot,             setSlot]             = useState(null)
  const [stats,            setStats]            = useState(null)
  const [animate,          setAnimate]          = useState(false)
  
  // States do Best Win
  const [showNewChip,      setShowNewChip]      = useState(false)
  const [winAnimKey,       setWinAnimKey]       = useState(0)
  
  // States do Best Multi
  const [showNewMultiChip, setShowNewMultiChip] = useState(false)
  const [multiAnimKey,     setMultiAnimKey]     = useState(0)
  
  const [sessionTime, setSessionTime] = useState(0)

  const prevBestWin      = useRef(null)
  const prevBestMulti    = useRef(null)
  
  const currentSlotIdRef = useRef(null)
  const recordPending    = useRef(false)
  const pendingSlotId    = useRef(null)
  const prevCheckedSlot  = useRef(null)
  const chipTimer        = useRef(null)
  const multiChipTimer   = useRef(null)
  
  const slotStartedAt    = useRef(null)
  const timerInterval    = useRef(null)

  function startSlotTimer() {
    slotStartedAt.current = Date.now()
    setSessionTime(0)
    clearInterval(timerInterval.current)
    timerInterval.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - slotStartedAt.current) / 60000)
      setSessionTime(elapsed)
    }, 10000)
  }

  useEffect(() => {
    startSlotTimer()
    return () => clearInterval(timerInterval.current)
  }, [])

  function triggerWinAnim() {
    setWinAnimKey(k => k + 1)
    clearTimeout(chipTimer.current)
    setShowNewChip(true)
    chipTimer.current = setTimeout(() => setShowNewChip(false), 3500)
  }

  function triggerMultiAnim() {
    setMultiAnimKey(k => k + 1)
    clearTimeout(multiChipTimer.current)
    setShowNewMultiChip(true)
    multiChipTimer.current = setTimeout(() => setShowNewMultiChip(false), 3500)
  }

  async function loadStats(slotId) {
    const { data: slotData } = await supabase.from('slots').select('*').eq('id', slotId).single()
    if (!slotData) return
    const { data: entries } = await supabase.from('bonus_entries').select('*').eq('slot_id', slotId).not('payment', 'is', null)

    const valid    = (entries || []).filter(e => e.payment && parseFloat(e.payment) > 0 && e.bet && parseBet(e.bet) > 0)
    const payments = valid.map(e => parseFloat(e.payment))
    const multis   = valid.map(e => parseFloat(e.payment) / parseBet(e.bet))

    const newBestWin   = payments.length ? Math.max(...payments) : null
    const bestWinEntry = valid.find(e => parseFloat(e.payment) === newBestWin)
    const bestWinBet   = bestWinEntry ? parseBet(bestWinEntry.bet)   : null
    const bestWinDate  = bestWinEntry ? bestWinEntry.created_at      : null

    const newBestMulti  = multis.length ? Math.max(...multis) : null
    const bestMultiEntry = valid.find(e => parseFloat(e.payment) / parseBet(e.bet) === newBestMulti)
    const bestMultiBet   = bestMultiEntry ? parseBet(bestMultiEntry.bet) : null

    setAnimate(false)
    setTimeout(() => {
      const isSameSlot = slotId === currentSlotIdRef.current

      if (!isSameSlot) {
        startSlotTimer()
        prevBestWin.current = null
        prevBestMulti.current = null
      }

      const isNewWin   = isSameSlot && newBestWin && prevBestWin.current !== null && newBestWin > prevBestWin.current
      const isNewMulti = isSameSlot && newBestMulti && prevBestMulti.current !== null && newBestMulti > prevBestMulti.current

      if (isNewWin || isNewMulti) {
        recordPending.current = true
        
        if (isNewWin) triggerWinAnim()
        if (isNewMulti) triggerMultiAnim()

        setTimeout(() => {
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
      prevBestMulti.current    = newBestMulti
      currentSlotIdRef.current = slotId
      
      setSlot(slotData)
      setStats({
        bestWin:      newBestWin,
        bestWinBet,
        bestWinDate,
        bestMulti:    newBestMulti,
        bestMultiBet,
        timesPlayed:  valid.length,
        avgMulti:     valid.length ? multis.reduce((a, b) => a + b, 0) / valid.length : 0
      })
      setAnimate(true)
    }, 50)
  }

  async function loadCurrentSlot() {
    try {
      // 1. Master Switch: Verificar o estado global primeiro
      const { data: dashState } = await supabase.from('dashboard_state').select('*').eq('id', DASHBOARD_ID).single()

      if (dashState?.activity === 'chill' && dashState?.chill_slot) {
        const { data: chillSlotData } = await supabase.from('slots').select('id').eq('name', dashState.chill_slot).limit(1)
        
        if (chillSlotData?.length) {
          const chillSlotId = chillSlotData[0].id
          if (recordPending.current) return // Evita conflitos com animações ativas
          
          if (chillSlotId !== currentSlotIdRef.current) {
            startSlotTimer()
          }
          
          currentSlotIdRef.current = chillSlotId
          prevCheckedSlot.current = chillSlotId // Mantém sincronia para ignorar falsos positivos de hunts antigas
          await loadStats(chillSlotId)
          return // Impede a execução da lógica de Bonus Hunts
        }
      }

      // 2. Comportamento Original (Hunts) - Só executa se não estiver em "chill"
      const { data: hunts } = await supabase.from('bonus_hunts').select('*').eq('active', true).limit(1)
      if (!hunts?.length) return
      const { data: entries } = await supabase.from('bonus_entries').select('*').eq('hunt_id', hunts[0].id).order('created_at', { ascending: true })
      if (!entries?.length) return

      const lastOpened = [...entries].reverse().find(e => e.opened && e.payment && parseFloat(e.payment) > 0 && e.bet && parseBet(e.bet) > 0)
      const nextUp     = entries.find(e => !e.opened)

      if (lastOpened && lastOpened.slot_id && lastOpened.slot_id !== prevCheckedSlot.current) {
        const { data: allEntries } = await supabase.from('bonus_entries').select('*').eq('slot_id', lastOpened.slot_id).not('payment', 'is', null)
        
        let valid = (allEntries || []).filter(e => e.payment && parseFloat(e.payment) > 0 && e.bet && parseBet(e.bet) > 0)

        const existIdx = valid.findIndex(e => e.id === lastOpened.id)
        if (existIdx >= 0) {
          valid[existIdx] = lastOpened
        } else {
          valid.push(lastOpened)
        }

        const payments = valid.map(e => parseFloat(e.payment))
        const multis   = valid.map(e => parseFloat(e.payment) / parseBet(e.bet))
        
        const thisPay   = parseFloat(lastOpened.payment)
        const thisBet   = parseBet(lastOpened.bet)
        const thisMulti = thisBet > 0 ? thisPay / thisBet : 0
        
        const others = valid.filter(e => e.id !== lastOpened.id)
        const prevBestWinVal = others.reduce((max, e) => Math.max(max, parseFloat(e.payment)), 0)
        const prevBestMultiVal = others.reduce((max, e) => {
          const b = parseBet(e.bet)
          return Math.max(max, b > 0 ? parseFloat(e.payment) / b : 0)
        }, 0)

        const isNewWin   = valid.length >= 1 && thisPay > prevBestWinVal
        const isNewMulti = valid.length >= 1 && thisMulti > prevBestMultiVal

        if (isNewWin || isNewMulti) {
          prevCheckedSlot.current = lastOpened.slot_id
          recordPending.current   = true
          const { data: slotData } = await supabase.from('slots').select('*').eq('id', lastOpened.slot_id).single()
          
          if (slotData) {
            const newBestMulti   = Math.max(...multis)
            const bestMultiEntry = valid.find(e => parseFloat(e.payment) / parseBet(e.bet) === newBestMulti)
            const newBestWin     = Math.max(...payments)
            const bestWinEntry   = valid.find(e => parseFloat(e.payment) === newBestWin)
            const avgMultiVal    = valid.length ? multis.reduce((a, b) => a + b, 0) / valid.length : 0
            
            setSlot(slotData)
            setStats({
              bestWin:      newBestWin,
              bestWinBet:   bestWinEntry   ? parseBet(bestWinEntry.bet)   : null,
              bestWinDate:  bestWinEntry   ? bestWinEntry.created_at      : null,
              bestMulti:    newBestMulti,
              bestMultiBet: bestMultiEntry ? parseBet(bestMultiEntry.bet) : null,
              timesPlayed:  valid.length,
              avgMulti:     avgMultiVal
            })
            
            setAnimate(true)
            
            if (isNewWin) triggerWinAnim()
            if (isNewMulti) triggerMultiAnim()
          }
          setTimeout(() => {
            recordPending.current = false
            const next = nextUp || entries[entries.length - 1]
            if (next?.slot_id) {
              startSlotTimer()
              currentSlotIdRef.current = next.slot_id
              loadStats(next.slot_id)
            }
          }, 4000)
          return
        }
        prevCheckedSlot.current = lastOpened.slot_id
      }
      if (recordPending.current) return
      const current = nextUp || entries[entries.length - 1]
      if (!current?.slot_id) return

      if (current.slot_id !== currentSlotIdRef.current) {
        startSlotTimer()
      }
      currentSlotIdRef.current = current.slot_id
      await loadStats(current.slot_id)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadCurrentSlot()
    const ch = supabase.channel('slotstats-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_entries' }, loadCurrentSlot)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_hunts'   }, loadCurrentSlot)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_state' }, loadCurrentSlot)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  if (!slot || !stats) return (
    <div className="app-slot-card-h">
      <style>{CSS}</style>
      <div className="loader" />
      <span style={{ color: '#64748b', fontSize: 12, marginLeft: 16, fontWeight: 600 }}>A carregar...</span>
    </div>
  )

  return (
    <>
      <style>{CSS}</style>
      <div className="app-slot-card-h" style={{ opacity: animate ? 1 : 0, transform: animate ? 'scale(1)' : 'scale(0.98)' }}>

        {/* ── HERO (ESQUERDA) ── */}
        <div className="app-hero-h">
          {slot.image_url && <img src={slot.image_url} alt={slot.name} className="app-hero-img-h" />}
          <div className="app-hero-gradient-h" />
          
          <div className="app-badges-h">
            <div className="app-badge-live"><div className="dot-live" /> LIVE</div>
            <div className="app-badge-time">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {sessionTime}m
            </div>
          </div>

          <div className="app-title-container-h">
            <div className="app-title-watermark-h">{slot.name}</div>
            <div className="app-slot-name-h">{slot.name}</div>
            <div className="app-slot-provider-h">{slot.provider || 'PRAGMATIC PLAY'}</div>
          </div>
        </div>

        {/* ── CONTENT (CENTRO - DIVIDIDO EM 2 COLUNAS) ── */}
        <div className="app-content-h">
          
          {/* Coluna 1: Info da Slot (AGORA COM 5 ITENS) */}
          <div className="app-section-h">
            <div className="app-divider-h">
              <div className="app-line-h" />
              <span className="app-divider-text-h">SLOT INFO</span>
              <div className="app-line-h" />
            </div>

            <div className="app-info-grid-h">
              <div className="app-info-col-h">
                <IconTarget />
                <div className="app-info-val-h">{slot.max_win ? `${slot.max_win}X` : '—'}</div>
                <div className="app-info-lbl-h">MAX WIN</div>
              </div>
              <div className="app-info-col-h">
                <IconPercent />
                <div className="app-info-val-h">{slot.rtp ? `${slot.rtp}%` : '—'}</div>
                <div className="app-info-lbl-h">RTP</div>
              </div>
              <div className="app-info-col-h">
                <IconFlame />
                <div className="app-info-val-h">{volLabel(slot.volatility)}</div>
                <div className="app-info-lbl-h">VOLATILITY</div>
              </div>
              {/* NOVOS ITENS AQUI */}
              <div className="app-info-col-h">
                <IconTrendingUp />
                <div className="app-info-val-h">{stats.avgMulti ? `${stats.avgMulti.toFixed(1)}X` : '—'}</div>
                <div className="app-info-lbl-h">AVG MULTI</div>
              </div>
              <div className="app-info-col-h">
                <IconGift />
                <div className="app-info-val-h">{stats.timesPlayed || 0}</div>
                <div className="app-info-lbl-h">PLAYED</div>
              </div>
            </div>
          </div>

          {/* Coluna 2: Recordes */}
          <div className="app-section-h">
            {stats.bestWinDate ? (
              <div className="app-divider-h">
                <span className="app-divider-text-h" style={{ color: '#fbbf24', marginLeft: 0 }}>PERSONAL BEST</span>
                <div className="app-line-h" style={{ flex: 1, margin: '0 12px' }} />
                <div className="app-date-h"><IconCalendar /> {fmtDate(stats.bestWinDate)}</div>
              </div>
            ) : (
              <div className="app-divider-h">
                <div className="app-line-h" />
                <span className="app-divider-text-h" style={{ color: '#fbbf24' }}>PERSONAL BEST</span>
                <div className="app-line-h" />
              </div>
            )}

            <div className="app-records-grid-h">
              {/* BEST WIN */}
              <div className="app-record-group-h">
                <div className="app-record-row-h">
                  <div className="app-record-lbl-h">
                    <span className="app-icon-wrap icon-yellow"><IconTrophy /></span>
                    BEST WIN
                  </div>
                  <div className="app-record-val-wrap">
                    <span key={winAnimKey} className={`app-record-val val-yellow${winAnimKey > 0 ? ' val-animating' : ''}`}>
                      {stats.bestWin ? `${fmtStat(stats.bestWin)}€` : '—'}
                    </span>
                    <span className={`rec-new-chip${showNewChip ? ' visible' : ''}`}>New</span>
                  </div>
                </div>
                <div className="app-record-row-sub-h">
                  <div className="app-record-lbl-sub-h">
                    <span className="app-icon-wrap icon-green"><IconDollar /></span> BET (WIN)
                  </div>
                  <div className="app-record-val val-green" style={{ fontSize: 13 }}>
                    {stats.bestWinBet ? `${fmtStat(stats.bestWinBet)}€` : '—'}
                  </div>
                </div>
              </div>

              {/* BEST MULTI */}
              <div className="app-record-group-h">
                <div className="app-record-row-h">
                  <div className="app-record-lbl-h">
                    <span className="app-icon-wrap icon-purple"><IconStar /></span>
                    BEST MULTI
                  </div>
                  <div className="app-record-val-wrap">
                    <span key={multiAnimKey} className={`app-record-val val-purple${multiAnimKey > 0 ? ' val-animating' : ''}`}>
                      {stats.bestMulti ? `${fmtStat(stats.bestMulti, 1)}x` : '—'}
                    </span>
                    <span className={`rec-new-chip${showNewMultiChip ? ' visible' : ''}`}>New</span>
                  </div>
                </div>
                <div className="app-record-row-sub-h">
                  <div className="app-record-lbl-sub-h">
                    <span className="app-icon-wrap icon-green"><IconDollar /></span> BET (MULTI)
                  </div>
                  <div className="app-record-val val-green" style={{ fontSize: 13 }}>
                    {stats.bestMultiBet ? `${fmtStat(stats.bestMultiBet)}€` : '—'}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800;900&family=Sora:wght@800;900&display=swap');

/* Main Container (Horizontal) */
.app-slot-card-h {
  width: 1150px;
  height: 220px;
  background: #090C15;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.03);
  box-shadow: 0 20px 40px rgba(0,0,0,0.6);
  font-family: 'Rubik', sans-serif;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4,0,0.2,1);
}
.app-slot-card-h .loader {
  margin: auto;
}

/* Hero Section */
.app-hero-h {
  width: 320px;
  height: 100%;
  position: relative;
  background: #000;
  flex-shrink: 0;
}
.app-hero-img-h {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; object-position: center 20%;
}
.app-hero-gradient-h {
  position: absolute; inset: 0;
  background: linear-gradient(to right, rgba(9,12,21,0) 40%, #090C15 100%),
              linear-gradient(to bottom, rgba(9,12,21,0) 0%, rgba(9,12,21,0.6) 60%, rgba(9,12,21,0.95) 100%);
}
.app-badges-h {
  position: absolute; top: 16px; left: 16px;
  display: flex; gap: 8px; z-index: 10;
}
.app-badge-live, .app-badge-time {
  background: rgba(20,22,35,0.6);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px; padding: 4px 10px;
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 800; color: #fff;
  letter-spacing: 0.05em; backdrop-filter: blur(8px);
}
.app-badge-live { color: #f87171; border-color: rgba(248,113,113,0.3); }
.dot-live {
  width: 6px; height: 6px; border-radius: 50%; background: #ef4444;
  box-shadow: 0 0 6px #ef4444; animation: blink 1.5s infinite;
}
.app-badge-time { color: #cbd5e1; }

.app-title-container-h {
  position: absolute; bottom: 16px; left: 16px; right: 16px;
  text-align: left; z-index: 10;
}
.app-title-watermark-h {
  position: absolute; bottom: -4px; left: -4px; right: 0;
  font-family: 'Sora', sans-serif; font-size: 40px; font-weight: 900;
  color: rgba(255,255,255,0.06); white-space: nowrap; overflow: hidden;
  text-transform: uppercase; z-index: -1; pointer-events: none;
}
.app-slot-name-h {
  font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 900; color: #fff;
  text-transform: uppercase; line-height: 1.1; padding: 0;
  text-shadow: 0 2px 10px rgba(0,0,0,0.8);
}
.app-slot-provider-h {
  font-size: 10px; font-weight: 800; color: #94a3b8;
  margin-top: 4px; text-transform: uppercase; letter-spacing: 0.2em;
  text-shadow: 0 1px 4px rgba(0,0,0,0.8);
}

/* Content Area */
.app-content-h {
  flex: 1;
  display: flex;
  flex-direction: row;
  padding: 20px 24px;
  gap: 32px;
  align-items: center;
}
.app-section-h {
  display: flex;
  flex-direction: column;
}

/* Distribuição do espaço adaptada para os novos elementos (1. Info com 5 itens | 2. Records com 2 itens) */
.app-section-h:nth-child(1) {
  flex: 1.3;
}
.app-section-h:nth-child(2) {
  flex: 0.9;
}

.app-divider-h {
  display: flex; align-items: center; margin-bottom: 16px;
}
.app-divider-text-h {
  font-size: 10px; font-weight: 800; color: #1e3a8a;
  letter-spacing: 0.15em; margin: 0 12px;
}
.app-line-h { flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
.app-date-h {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 700; color: #fbbf24;
}

/* Info Grid (agora com espaço para 5 itens) */
.app-info-grid-h {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 10px;
}
.app-info-col-h { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.app-info-val-h { font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 800; color: #fff; }
.app-info-lbl-h { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }

/* Records Grid (2 columns) */
.app-records-grid-h {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px; /* Maior separação entre Win e Multi */
}
.app-record-group-h {
  display: flex; flex-direction: column; gap: 4px;
}
.app-record-row-h { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  gap: 12px; /* Espaço para impedir o valor de colar no texto */
}
.app-record-row-sub-h { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  opacity: 0.7; 
  gap: 12px; 
}
.app-record-lbl-h {
  display: flex; align-items: center; gap: 10px;
  font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.6);
  letter-spacing: 0.1em; text-transform: uppercase;
}
.app-record-lbl-sub-h {
  display: flex; align-items: center; gap: 8px;
  font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.6);
  padding-left: 4px;
}
.app-icon-wrap { display: flex; align-items: center; justify-content: center; }
.icon-yellow svg { stroke: #fbbf24; }
.icon-purple svg { stroke: #c084fc; }
.icon-green  svg { stroke: #34d399; }

/* O flex-shrink: 0 impede o número grande de ser esmagado pela grid */
.app-record-val-wrap { display: flex; align-items: center; gap: 0; flex-shrink: 0; }
.app-record-val { font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 900; }
.val-yellow { color: #fbbf24; }
.val-purple { color: #c084fc; }
.val-green  { color: #34d399; }

/* Animações e Pills */
.rec-new-chip {
  font-size: 9px; font-weight: 800; letter-spacing: .06em;
  border-radius: 999px; text-transform: uppercase;
  background: rgba(251,191,36,.15); color: #fbbf24;
  border: 1px solid rgba(251,191,36,.35);
  white-space: nowrap; overflow: hidden;
  max-width: 0; padding: 0; border-width: 0;
  opacity: 0;
  transition: max-width .3s ease, opacity .3s ease, padding .3s ease, border-width .3s ease, margin-left .3s ease;
  margin-left: 0;
}
.rec-new-chip.visible {
  max-width: 60px; padding: 2px 7px; border-width: 1px;
  opacity: 1; margin-left: 6px;
}

@keyframes recFlash {
  0%   { opacity:1; transform:scale(1); }
  15%  { opacity:0; transform:scale(1.5); }
  30%  { opacity:1; transform:scale(0.88); }
  55%  { transform:scale(1.18); }
  75%  { transform:scale(0.97); }
  100% { transform:scale(1); opacity:1; }
}
@keyframes recShine {
  0%   { text-shadow: 0 0 0px #fbbf24; }
  35%  { text-shadow: 0 0 20px #fbbf24, 0 0 36px rgba(251,191,36,.55); }
  100% { text-shadow: 0 0 0px #fbbf24; }
}
.val-animating {
  animation: recFlash .55s cubic-bezier(.34,1.4,.64,1), recShine 1.6s ease;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

.loader {
  width: 32px; height: 32px; border-radius: 50%;
  border: 3px solid rgba(56,189,248,0.2); border-top-color: #38bdf8;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
`