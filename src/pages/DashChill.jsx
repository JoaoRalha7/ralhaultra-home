import { useState, useEffect, useRef, useCallback } from 'react'
import { supabaseDash } from '../lib/supabase'
import styles from './DashChill.module.css'

const DASHBOARD_ID = 'aa9660ca-4c53-4d4d-b81b-b3d231660420'

const TYPE_LABEL = {
  bonus_buy:  'Bonus Buy',
  spin:       'Spin',
}

function fmt(n, d = 2) {
  return (parseFloat(n) || 0).toLocaleString('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d })
}

// ── SlotImg ────────────────────────────────────────────────
function SlotImg({ slot, size = 36, radius = 8 }) {
  const [err, setErr] = useState(false)
  if (!slot) return <div style={{ width: size, height: size, borderRadius: radius, flexShrink: 0, background: 'rgba(255,255,255,.05)' }} />
  const initials = (slot.name || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
  const st = { width: size, height: size, borderRadius: radius, flexShrink: 0 }
  if ((slot.image_url || slot.slot_img) && !err)
    return <img src={slot.image_url || slot.slot_img} alt={slot.name} style={{ ...st, objectFit: 'cover', display: 'block' }} onError={() => setErr(true)} />
  return (
    <div style={{ ...st, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,rgba(59,130,246,.25),rgba(8,10,18,.9))', fontSize: size * .28, fontWeight: 800, color: 'rgba(255,255,255,.45)' }}>
      {initials}
    </div>
  )
}

// ── SlotPicker ─────────────────────────────────────────────
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
    <div className={styles.pickerOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.pickerBox}>
        <div className={styles.pickerHeader}>
          <span className={styles.pickerTitle}>Escolher Slot</span>
          <button className={styles.pickerClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.pickerSearch}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input ref={inputRef} className={styles.pickerInput} value={q}
            onChange={e => search(e.target.value)} placeholder="Pesquisar slot ou provider..." />
          {q && <button className={styles.pickerClear} onClick={() => { setQ(''); setResults([]) }}>✕</button>}
        </div>
        <div className={styles.pickerList}>
          {!q && <div className={styles.pickerHint}>Começa a escrever para pesquisar...</div>}
          {loading && <div className={styles.pickerHint}>A pesquisar...</div>}
          {!loading && q && results.length === 0 && <div className={styles.pickerHint}>Sem resultados</div>}
          {results.map(s => (
            <div key={s.id} className={styles.pickerItem} onClick={() => onSelect(s)}>
              <SlotImg slot={s} size={36} radius={7} />
              <div className={styles.pickerItemInfo}>
                <div className={styles.pickerItemName}>{s.name}</div>
                <div className={styles.pickerItemMeta}>
                  {s.provider && <span>{s.provider}</span>}
                  {s.volatility && <span className={styles.pickerVol}>{s.volatility}</span>}
                  {s.rtp && <span>RTP {parseFloat(s.rtp).toFixed(1)}%</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── StatsGrid ──────────────────────────────────────────────
function StatsGrid({ entries }) {
  if (!entries.length) return null
  const withBet = entries.filter(e => parseFloat(e.bet) > 0)
  const withPay = entries.filter(e => parseFloat(e.payment) > 0)
  const totalBet = withBet.reduce((a, e) => a + parseFloat(e.bet), 0)
  const totalWon = withPay.reduce((a, e) => a + parseFloat(e.payment), 0)
  const pnl = totalWon - totalBet
  const rtp = totalBet > 0 ? (totalWon / totalBet) * 100 : null
  const multis = withBet.filter(e => parseFloat(e.payment) > 0)
    .map(e => parseFloat(e.payment) / parseFloat(e.bet))
  const best = multis.length ? Math.max(...multis) : null

  return (
    <div className={styles.statsGrid}>
      <div className={styles.statCell}>
        <div className={styles.statLbl}>Jogadas</div>
        <div className={styles.statVal}>{entries.length}</div>
      </div>
      <div className={styles.statCell}>
        <div className={styles.statLbl}>Apostado</div>
        <div className={styles.statVal} style={{ color:'#fbbf24' }}>{fmt(totalBet)}€</div>
      </div>
      <div className={styles.statCell}>
        <div className={styles.statLbl}>Ganho</div>
        <div className={styles.statVal} style={{ color:'#60a5fa' }}>{fmt(totalWon)}€</div>
      </div>
      <div className={styles.statCell}>
        <div className={styles.statLbl}>P&L</div>
        <div className={styles.statVal} style={{ color: pnl >= 0 ? '#4ade80' : '#f87171' }}>
          {pnl >= 0 ? '+' : ''}{fmt(pnl)}€
        </div>
      </div>
      {rtp !== null && (
        <div className={styles.statCell}>
          <div className={styles.statLbl}>RTP</div>
          <div className={styles.statVal} style={{ color: rtp >= 100 ? '#4ade80' : rtp >= 80 ? '#fbbf24' : '#f87171' }}>
            {fmt(rtp, 1)}%
          </div>
        </div>
      )}
      {best !== null && (
        <div className={styles.statCell}>
          <div className={styles.statLbl}>Melhor</div>
          <div className={styles.statVal} style={{ color:'#4ade80' }}>{best.toFixed(2)}x</div>
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────
export default function DashChill() {
  // IDs das entradas adicionadas nesta sessão (para saber quais são deletáveis)
  const sessionIds            = useRef(new Set())

  const [chillEntries,   setChillEntries]   = useState([])  // entradas da sessão atual
  const [slotAllEntries, setSlotAllEntries] = useState([])  // histórico completo da slot selecionada
  const [slot,           setSlot]           = useState(null)
  const [type,           setType]           = useState('bonus_buy')
  const [bet,            setBet]            = useState('')
  const [payment,        setPayment]        = useState('')
  const [loading,        setLoading]        = useState(true)
  const [slotLoading,    setSlotLoading]    = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [pickerOpen,     setPickerOpen]     = useState(false)
  const [activated,      setActivated]      = useState(false)
  const payRef = useRef(null)

  // Init: carregar entradas chill recentes (hunt_id IS NULL, das últimas 24h) para mostrar sessão
  const init = useCallback(async () => {
    setLoading(true)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabaseDash
      .from('bonus_entries')
      .select('*, slot:slots(id,name,image_url,provider,volatility)')
      .is('hunt_id', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    const entries = data || []
    setChillEntries(entries)
    // Registar os IDs como pertencentes à sessão atual
    entries.forEach(e => sessionIds.current.add(e.id))
    setLoading(false)
  }, [])

  useEffect(() => { init() }, [init])

  // Quando a slot muda, carregar TODO o histórico dessa slot (hunts, torneios, chill, tudo)
  useEffect(() => {
    if (!slot) { setSlotAllEntries([]); return }
    const load = async () => {
      setSlotLoading(true)
      const { data } = await supabaseDash
        .from('bonus_entries')
        .select('*, slot:slots(id,name,image_url), bonus_hunts(id,title,date,mode)')
        .eq('slot_id', slot.id)
        .order('created_at', { ascending: false })
      setSlotAllEntries(data || [])
      setSlotLoading(false)
    }
    load()
  }, [slot])

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
      .update({ chill_slot: s.name }).eq('id', DASHBOARD_ID)
  }

  const handleAdd = async () => {
    if (!slot || !bet) return
    setSaving(true)
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

    if (data && !error) {
      sessionIds.current.add(data.id)
      setChillEntries(prev => [data, ...prev])
      setSlotAllEntries(prev => [data, ...prev])
      setBet('')
      setPayment('')
      payRef.current?.focus()
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    await supabaseDash.from('bonus_entries').delete().eq('id', id)
    sessionIds.current.delete(id)
    setChillEntries(prev => prev.filter(e => e.id !== id))
    setSlotAllEntries(prev => prev.filter(e => e.id !== id))
  }

  const multi = bet && payment && parseFloat(bet) > 0
    ? parseFloat(payment) / parseFloat(bet) : null

  // Painel direito: se slot selecionada → histórico da slot; senão → sessão atual
  const displayEntries = slot ? slotAllEntries : chillEntries

  if (loading) return (
    <div className={styles.loadingPage}><div className={styles.spinner} /> A iniciar...</div>
  )

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>☕</span>
          <span className={styles.headerTitle}>Chill</span>
          <div className={styles.headerDivider} />
          <span className={styles.headerSub}>{chillEntries.length} entradas nesta sessão</span>
        </div>
        <button className={`${styles.activateBtn} ${activated ? styles.activateBtnDone : ''}`} onClick={activate}>
          {activated ? '✓ Ativado' : 'Barra OBS'}
        </button>
      </div>

      <div className={styles.body}>

        {/* ── Left panel ── */}
        <div className={styles.leftPanel}>

          {/* Slot selector */}
          <div className={styles.card}>
            <div className={styles.cardLabel}>Slot ativa</div>
            {slot ? (
              <div className={styles.slotSelected}>
                <SlotImg slot={slot} size={72} radius={12} />
                <div className={styles.slotInfo}>
                  <div className={styles.slotName}>{slot.name}</div>
                  <div className={styles.slotProv}>{slot.provider}</div>
                  {slot.volatility && <div className={styles.slotVol}>{slot.volatility}</div>}
                </div>
                <button className={styles.changeBtn} onClick={() => setPickerOpen(true)}>Trocar</button>
              </div>
            ) : (
              <button className={styles.pickBtn} onClick={() => setPickerOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                Escolher Slot
              </button>
            )}
          </div>

          {slot && (
            <>
              {/* Registo */}
              <div className={styles.card}>
                <div className={styles.cardLabel}>Registo</div>
                <div className={styles.typeToggle}>
                  <button className={`${styles.typeBtn} ${type === 'bonus_buy' ? styles.typeBtnBonus : ''}`} onClick={() => setType('bonus_buy')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/></svg>
                    Bonus Buy
                  </button>
                  <button className={`${styles.typeBtn} ${type === 'spin' ? styles.typeBtnSpin : ''}`} onClick={() => setType('spin')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M22 13a10 10 0 0 1-18.26 3.37M2 11a10 10 0 0 1 18.26-3.37"/></svg>
                    Spin
                  </button>
                </div>

                <div className={styles.inputGroup}>
                  <span className={styles.inputLbl}>Bet (€)</span>
                  <input className={styles.inputBet} type="number" min="0" step="0.01"
                    value={bet} onChange={e => setBet(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && payRef.current?.focus()}
                    placeholder="0.00" />
                </div>

                <div className={styles.inputGroup}>
                  <span className={styles.inputLbl}>Pagamento (€)</span>
                  <input ref={payRef} className={styles.inputResult} type="number" min="0" step="0.01"
                    value={payment} onChange={e => setPayment(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="0.00" />
                </div>

                {multi !== null && (
                  <div className={styles.multiPreview}>
                    <span className={multi >= 100 ? styles.multiHigh : multi >= 20 ? styles.multiMid : styles.multiLow}>
                      {multi.toFixed(2)}x
                    </span>
                  </div>
                )}

                <button className={styles.addBtn} onClick={handleAdd} disabled={!bet || saving}>
                  {saving ? 'A guardar...' : '+ Adicionar'}
                </button>
              </div>

              {/* Stats da slot */}
              {slotAllEntries.length > 0 && (
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Stats — {slot.name}</div>
                  <StatsGrid entries={slotAllEntries} />
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right panel ── */}
        <div className={styles.rightPanel}>
          <div className={styles.listHead}>
            <span className={styles.listTitle}>
              {slot ? `${slot.name} — histórico` : 'Sessão atual'}
            </span>
            <span className={styles.listCount}>
              {slotLoading ? '...' : `${displayEntries.length} entradas`}
            </span>
          </div>

          {slotLoading ? (
            <div className={styles.loadingInline}><div className={styles.spinner} /> A carregar histórico...</div>
          ) : displayEntries.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>☕</div>
              <div className={styles.emptyTitle}>{slot ? 'Sem histórico para esta slot' : 'Sessão vazia'}</div>
              <div className={styles.emptySub}>{slot ? 'Adiciona a primeira entrada acima' : 'Escolhe um slot para começar'}</div>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Slot</th>
                    <th>Bet</th>
                    <th>Pagamento</th>
                    <th>Multi</th>
                    <th>Origem</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {displayEntries.map(e => {
                    const b  = parseFloat(e.bet) || 0
                    const p  = parseFloat(e.payment) || 0
                    const m  = b > 0 && p > 0 ? p / b : null
                    const gt = e.game_type || 'bonus_buy'
                    const isSessionEntry = sessionIds.current.has(e.id)
                    // Origem: nome do hunt/torneio, ou "Chill" se sem hunt
                    const origem = e.bonus_hunts
                      ? (e.bonus_hunts.title || e.bonus_hunts.date || 'Hunt')
                      : 'Chill'
                    return (
                      <tr key={e.id} className={styles.tableRow}>
                        <td>
                          <span className={`${styles.typePill} ${styles['pill_' + gt.replace('_', '')]}`}>
                            {TYPE_LABEL[gt] || gt}
                          </span>
                        </td>
                        <td className={styles.cellOrigin}>
                          {e.slot?.name || slot?.name || '—'}
                        </td>
                        <td className={styles.cellBet}>{fmt(b)}€</td>
                        <td className={`${styles.cellPay} ${p > b ? styles.payPos : p > 0 ? styles.payNeu : styles.payNone}`}>
                          {p > 0 ? `${fmt(p)}€` : '—'}
                        </td>
                        <td className={`${styles.cellMulti} ${m >= 100 ? styles.multiHigh : m >= 20 ? styles.multiMid : ''}`}>
                          {m !== null ? `${m.toFixed(2)}x` : '—'}
                        </td>
                        <td className={styles.cellOrigin}>{origem}</td>
                        <td>
                          {isSessionEntry && (
                            <button className={styles.rowDel} onClick={() => handleDelete(e.id)}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {pickerOpen && <SlotPicker onSelect={handleSelectSlot} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}