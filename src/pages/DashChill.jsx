import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabaseDash } from '../lib/supabase'
import styles from './DashChill.module.css'

const DASHBOARD_ID = 'aa9660ca-4c53-4d4d-b81b-b3d231660420'
const QUICK_BETS = [0.20, 0.40, 1.00, 2.00, 5.00]

const TYPE_LABEL = {
  bonus_buy:  'Buy',
  spin:       'Spin',
}

function fmt(n, d = 2) {
  return (parseFloat(n) || 0).toLocaleString('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d })
}

// ── SlotImg ────────────────────────────────────────────────
function SlotImg({ slot, size = 36, radius = 16, fullCover = false }) {
  const [err, setErr] = useState(false)
  if (!slot) return <div style={{ width: size, height: size, borderRadius: radius, flexShrink: 0, background: 'rgba(255,255,255,.05)' }} />
  const initials = (slot.name || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
  const st = { 
    width: fullCover ? '100%' : size, 
    height: fullCover ? '100%' : size, 
    borderRadius: radius, 
    flexShrink: 0,
    boxShadow: fullCover ? 'none' : '0 8px 24px rgba(0,0,0,0.5)'
  }
  
  if ((slot.image_url || slot.slot_img) && !err) {
    return <img src={slot.image_url || slot.slot_img} alt={slot.name} style={{ ...st, objectFit: 'cover', display: 'block' }} onError={() => setErr(true)} />
  }
  
  return (
    <div style={{ ...st, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,rgba(59,130,246,.2),rgba(8,10,18,.9))', fontSize: fullCover ? 48 : size * .3, fontWeight: 800, color: 'rgba(255,255,255,.3)' }}>
      {initials}
    </div>
  )
}

// ── SlotPicker Modal ───────────────────────────────────────
function SlotPicker({ onSelect, onClose }) {
  const [q, setQ]             = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const timer    = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60) }, [])

  const search = (term) => {
    setQ(term)
    clearTimeout(timer.current)
    if (!term.trim()) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabaseDash.from('slots')
        .select('id,name,provider,image_url,volatility,rtp')
        .or(`name.ilike.%${term}%,provider.ilike.%${term}%`)
        .order('name').limit(20)
      setResults(data || [])
      setLoading(false)
    }, 250)
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalBox}>
        <div className={styles.modalSearch}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{color: 'rgba(255,255,255,0.4)'}}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input ref={inputRef} className={styles.modalInput} value={q}
            onChange={e => search(e.target.value)} placeholder="Procurar jogo..." />
          {q && <button className={styles.modalClear} onClick={() => { setQ(''); setResults([]) }}>✕</button>}
        </div>
        <div className={styles.pickerList}>
          {!q && <div className={styles.pickerHint}>Escreve o nome da slot ou provider</div>}
          {loading && <div className={styles.pickerHint}>A procurar...</div>}
          {!loading && q && results.length === 0 && <div className={styles.pickerHint}>Sem resultados</div>}
          {results.map(s => (
            <div key={s.id} className={styles.pickerItem} onClick={() => onSelect(s)}>
              <SlotImg slot={s} size={48} radius={12} />
              <div className={styles.pickerItemInfo}>
                <div className={styles.pickerItemName}>{s.name}</div>
                <div className={styles.pickerItemMeta}>
                  <span className={styles.provTag}>{s.provider}</span>
                  {s.volatility && <span className={styles.volTag}>{s.volatility}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────
export default function DashChill() {
  const sessionIds            = useRef(new Set())

  // Gestão de Sessão (Time Marker)
  const [sessionStart,   setSessionStart]   = useState(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  
  const [chillEntries,   setChillEntries]   = useState([])
  const [slotAllEntries, setSlotAllEntries] = useState([])
  const [slot,           setSlot]           = useState(null)
  
  const [type,           setType]           = useState('bonus_buy')
  const [bet,            setBet]            = useState('')
  const [payment,        setPayment]        = useState('')
  const [saveStatus,     setSaveStatus]     = useState('idle') // idle, saving, success, error
  
  const payRef = useRef(null)
  const betRef = useRef(null)

  const [loading,        setLoading]        = useState(true)
  const [pickerOpen,     setPickerOpen]     = useState(false)
  const [activated,      setActivated]      = useState(false)

  const init = useCallback(async () => {
    setLoading(true)
    const { data } = await supabaseDash
      .from('bonus_entries')
      .select('*, slot:slots(id,name,image_url,provider,volatility)')
      .is('hunt_id', null)
      .gte('created_at', sessionStart)
      .order('created_at', { ascending: false })
    const entries = data || []
    setChillEntries(entries)
    entries.forEach(e => sessionIds.current.add(e.id))
    setLoading(false)
  }, [sessionStart])

  useEffect(() => { init() }, [init])

  useEffect(() => {
    if (!slot) { setSlotAllEntries([]); return }
    const load = async () => {
      const { data } = await supabaseDash
        .from('bonus_entries')
        .select('*, slot:slots(id,name,image_url), bonus_hunts(id,title,date,mode)')
        .eq('slot_id', slot.id)
        .order('created_at', { ascending: false })
      setSlotAllEntries(data || [])
    }
    load()
  }, [slot])

  const handleResetSession = () => {
    if (window.confirm('Queres iniciar uma Nova Sessão? O histórico deste painel será limpo (os dados continuam guardados na base de dados).')) {
      setSessionStart(new Date().toISOString())
      setChillEntries([])
      setSlotAllEntries([])
      sessionIds.current.clear()
    }
  }

  const activate = async () => {
    await supabaseDash.from('dashboard_state')
      .update({ activity: 'chill', chill_slot: slot?.name || null })
      .eq('id', DASHBOARD_ID)
    setActivated(true)
    setTimeout(() => setActivated(false), 3000)
  }

  const handleSelectSlot = async (s) => {
    setSlot(s)
    setPickerOpen(false)
    await supabaseDash.from('dashboard_state')
      .update({ activity: 'chill', chill_slot: s.name }).eq('id', DASHBOARD_ID)
    setTimeout(() => betRef.current?.focus(), 100) // Auto-focus na bet
  }

  const handleAdd = async () => {
    if (!slot || !bet) return
    setSaveStatus('saving')
    const betVal = parseFloat(bet)
    const payVal = payment ? parseFloat(payment) : null
    const { data, error } = await supabaseDash
      .from('bonus_entries')
      .insert([{
        hunt_id:   null,
        slot_id:   slot.id,
        bet:       betVal,
        payment:   payVal,
        opened:    payVal !== null,
        paid_at:   payVal !== null ? new Date().toISOString() : null,
        game_type: type,
        is_super:  false,
      }])
      .select('*, slot:slots(id,name,image_url,provider,volatility)')
      .single()

    if (error) {
      console.error(error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
      return
    }

    if (data) {
      sessionIds.current.add(data.id)
      setChillEntries(prev => [data, ...prev])
      setSlotAllEntries(prev => [data, ...prev])
      setPayment('') 
      setSaveStatus('success')
      
      // Volta ao estado normal e faz auto-focus para a próxima jogada
      setTimeout(() => {
        setSaveStatus('idle')
        if (bet) payRef.current?.focus()
        else betRef.current?.focus()
      }, 1500)
    }
  }

  const handleDelete = async (id) => {
    await supabaseDash.from('bonus_entries').delete().eq('id', id)
    sessionIds.current.delete(id)
    setChillEntries(prev => prev.filter(e => e.id !== id))
    setSlotAllEntries(prev => prev.filter(e => e.id !== id))
  }

  const multi = bet && payment && parseFloat(bet) > 0 ? parseFloat(payment) / parseFloat(bet) : null
  
  // Filtramos os displays com base na hora da sessão ativa
  const rawDisplayEntries = slot ? slotAllEntries : chillEntries
  const displayEntries = rawDisplayEntries.filter(e => new Date(e.created_at) >= new Date(sessionStart))

  // ── OTIMIZAÇÃO: useMemo para cálculos pesados ──
  const stats = useMemo(() => {
    const withBet = displayEntries.filter(e => parseFloat(e.bet) > 0)
    const withPay = displayEntries.filter(e => parseFloat(e.payment) > 0)
    const totalBet = withBet.reduce((a, e) => a + parseFloat(e.bet), 0)
    const totalWon = withPay.reduce((a, e) => a + parseFloat(e.payment), 0)
    const pnl = totalWon - totalBet
    const bestMulti = withBet.length ? Math.max(...withBet.map(e => parseFloat(e.payment) / parseFloat(e.bet))) : 0
    const bestWin = withPay.length ? Math.max(...withPay.map(e => parseFloat(e.payment))) : 0
    
    return { totalBet, totalWon, pnl, bestMulti, bestWin }
  }, [displayEntries])

  if (loading) return (
    <div className={styles.loadingPage}><div className={styles.spinner} /> A carregar o estúdio...</div>
  )

  const multiCls = multi >= 100 ? styles.multHigh : multi >= 10 ? styles.multMid : ''
  const del = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
  )

  return (
    <div className={styles.page}>

      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Chill</h1>
          <p className={styles.sub}>Regista cada jogada da sessão. Aparece no OBS em direto.</p>
        </div>
        <div className={styles.headBtns}>
          <button type="button" className={styles.ghost} onClick={handleResetSession}>Nova sessão</button>
          <button type="button" className={`${styles.ghost} ${styles.ghostOn}`} onClick={activate}>
            <span className={styles.dot} />{activated ? 'Sincronizado' : 'Sincronizar OBS'}
          </button>
        </div>
      </div>

      <div className={styles.layout}>

        <div className={styles.panel}>
          <button type="button" className={styles.pick} onClick={() => setPickerOpen(true)}>
            {slot ? (
              <>
                <div className={styles.pickImg}><SlotImg slot={slot} fullCover radius={8} /></div>
                <div className={styles.pickInfo}>
                  <div className={styles.pickName}>{slot.name}</div>
                  <div className={styles.pickProv}>{slot.provider}</div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7b8190" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 16-4 4-4-4M21 20V4M3 8l4-4 4 4M3 4v16" /></svg>
              </>
            ) : (
              <span className={styles.pickEmpty}>Selecionar jogo</span>
            )}
          </button>

          <div className={styles.seg}>
            <button type="button" className={type === 'bonus_buy' ? styles.segOn : ''} onClick={() => setType('bonus_buy')}>Buy</button>
            <button type="button" className={type === 'spin' ? styles.segOn : ''} onClick={() => setType('spin')}>Spin</button>
          </div>

          <div className={styles.lbl}>Aposta</div>
          <label className={styles.field}>
            <span>€</span>
            <input ref={betRef} type="number" min="0" step="0.01" value={bet}
              onChange={e => setBet(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && payRef.current?.focus()}
              placeholder="0.00" />
          </label>
          <div className={styles.quick}>
            {QUICK_BETS.map(val => (
              <button key={val} type="button" className={parseFloat(bet) === val ? styles.qOn : ''} onClick={() => setBet(val.toString())}>{val}</button>
            ))}
          </div>

          <div className={`${styles.lbl} ${styles.lbl2}`}>Prémio</div>
          <label className={`${styles.field} ${styles.fieldWin}`}>
            <span>€</span>
            <input ref={payRef} type="number" min="0" step="0.01" value={payment}
              onChange={e => setPayment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="0.00" />
            <span className={`${styles.mult} ${multiCls}`}>{multi !== null ? `${multi.toFixed(2)}x` : '0.00x'}</span>
          </label>

          <button type="button"
            className={`${styles.cta} ${saveStatus === 'success' ? styles.ctaOk : ''} ${saveStatus === 'error' ? styles.ctaErr : ''}`}
            onClick={handleAdd} disabled={!bet || saveStatus === 'saving' || !slot}>
            {saveStatus === 'saving' && <div className={styles.spinnerSm} style={{ borderTopColor: '#0a0b0e' }} />}
            {saveStatus === 'success' && 'Registado'}
            {saveStatus === 'error' && 'Erro. Tentar de novo'}
            {saveStatus === 'idle' && 'Confirmar registo'}
          </button>
          <p className={styles.note}>Enter na aposta passa ao prémio. Enter no prémio confirma.</p>
        </div>

        <div className={styles.stage}>
          <div className={styles.stats}>
            <div className={styles.stat}><small>Apostado</small><b>{fmt(stats.totalBet)}€</b></div>
            <div className={styles.stat}><small>Lucro</small><b style={{ color: stats.pnl > 0 ? 'var(--c-win)' : stats.pnl < 0 ? '#f87171' : undefined }}>{stats.pnl > 0 ? '+' : ''}{fmt(stats.pnl)}€</b></div>
            <div className={styles.stat}><small>Maior win</small><b>{fmt(stats.bestWin)}€</b></div>
            <div className={styles.stat}><small>Melhor multi</small><b style={{ color: stats.bestMulti >= 100 ? 'var(--c-gold)' : undefined }}>{stats.bestMulti.toFixed(1)}x</b></div>
          </div>

          <div className={styles.listHead}>{slot ? slot.name : 'Sessão'} <span>{displayEntries.length} {displayEntries.length === 1 ? 'jogada' : 'jogadas'}</span></div>

          <div className={styles.list}>
            {displayEntries.length === 0 ? (
              <div className={styles.empty}>Ainda sem jogadas</div>
            ) : displayEntries.map(e => {
              const b = parseFloat(e.bet) || 0
              const p = parseFloat(e.payment) || 0
              const m = b > 0 && p > 0 ? p / b : 0
              const timeStr = new Date(e.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={e.id} className={styles.row}>
                  <div className={styles.rowImg}><SlotImg slot={e.slot} fullCover radius={6} /></div>
                  <div className={styles.rowMain}>
                    <div className={styles.rowName}>{e.slot?.name || 'Sessão'}</div>
                    <div className={styles.rowSub}>{TYPE_LABEL[e.game_type] || 'Buy'} · {timeStr}</div>
                  </div>
                  <div className={styles.rowBet}>{fmt(b)}€</div>
                  <div className={`${styles.rowWin} ${p > b ? styles.rowWinPos : ''}`}>{fmt(p)}€</div>
                  {m >= 2 ? <div className={`${styles.rowMulti} ${m >= 100 ? styles.rowMultiHigh : ''}`}>{m >= 10 ? m.toFixed(0) : m.toFixed(1)}x</div> : <div className={styles.rowMulti} style={{ visibility: 'hidden' }} />}
                  {sessionIds.current.has(e.id)
                    ? <button type="button" className={styles.rowDel} aria-label="Apagar" onClick={() => handleDelete(e.id)}>{del}</button>
                    : <span className={styles.rowDelGap} />}
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {pickerOpen && <SlotPicker onSelect={handleSelectSlot} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}