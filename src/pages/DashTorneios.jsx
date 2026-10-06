import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabaseDash } from '../lib/supabase'
import styles from './DashTorneios.module.css'

const SIZES   = [4, 8, 16, 32]
const ROW_H   = 44
const MATCH_H = ROW_H * 2
const CARD_W  = 200
const GAP     = 20
const CONN_W  = 44
const LBL_H   = 36

// ── Helpers ────────────────────────────────────────────────
function buildEmpty(size) {
  const rounds = []
  let n = size / 2
  while (n >= 1) {
    rounds.push(Array.from({ length: n }, () => ({ a: null, b: null, winner: null })))
    n = Math.floor(n / 2)
  }
  return rounds
}

function hydrate(saved, size) {
  const empty = buildEmpty(size)
  if (!saved || saved.length !== empty.length) return empty
  return empty.map((round, ri) =>
    round.map((match, mi) => ({ ...match, ...(saved[ri]?.[mi] || {}) }))
  )
}

function roundLabel(ri, total) {
  if (ri === total - 1) return 'Final'
  if (ri === total - 2) return 'Meia-Final'
  if (ri === total - 3) return 'Quartos'
  if (ri === total - 4) return 'Oitavos'
  return `Round ${ri + 1}`
}

function getMulti(comp) {
  const bet  = parseFloat(comp?.bet) || 0
  const paid = (comp?.payments || []).reduce((s, p) => s + (parseFloat(p) || 0), 0)
  return bet > 0 && paid > 0 ? paid / bet : null
}

function colH(n)   { return n * MATCH_H + (n - 1) * GAP }
function cardCY(i) { return i * (MATCH_H + GAP) + MATCH_H / 2 }

// deep copy bracket to avoid mutation issues
function cloneBracket(bracket) {
  return bracket.map(r => r.map(m => ({ ...m, a: m.a ? { ...m.a } : null, b: m.b ? { ...m.b } : null })))
}

// ── SlotImg ────────────────────────────────────────────────
function SlotImg({ slot, size = 40, radius = 0 }) {
  const [err, setErr] = useState(false)
  if (!slot) return null
  const initials = (slot.name || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
  const st = { width: size, height: size, borderRadius: radius, flexShrink: 0 }
  if (slot.image_url && !err)
    return <img src={slot.image_url} alt={slot.name} style={{ ...st, objectFit: 'cover', display: 'block' }} onError={() => setErr(true)} />
  return (
    <div style={{ ...st, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,rgba(59,130,246,.25),rgba(8,10,18,.9))', fontSize: size * .28, fontWeight: 800, color: 'rgba(255,255,255,.45)' }}>
      {initials}
    </div>
  )
}

// ── SlotPicker ─────────────────────────────────────────────
function SlotPicker({ selected, onSelect }) {
  const [q, setQ]             = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const timer = useRef(null)

  const search = useCallback((term) => {
    setQ(term)
    clearTimeout(timer.current)
    if (!term.trim()) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabaseDash.from('slots')
        .select('id,name,provider,image_url')
        .or(`name.ilike.%${term}%,provider.ilike.%${term}%`)
        .order('name').limit(20)
      setResults(data || [])
      setLoading(false)
    }, 280)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div className={styles.slotPicker}>
      <div className={styles.slotPickerSearch}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input className={styles.slotPickerInput} value={q} autoFocus
          onChange={e => search(e.target.value)} placeholder="Pesquisar slot..." />
        {q && <button className={styles.slotPickerClear} onClick={() => { setQ(''); setResults([]) }}>✕</button>}
      </div>
      {q && (
        <div className={styles.slotPickerList}>
          {loading
            ? <div className={styles.slotPickerEmpty}>A pesquisar...</div>
            : results.length === 0
              ? <div className={styles.slotPickerEmpty}>Sem resultados</div>
              : results.map(s => (
                  <div key={s.id}
                    className={`${styles.slotPickerItem} ${selected?.id === s.id ? styles.slotPickerItemActive : ''}`}
                    onClick={() => onSelect(s)}>
                    <SlotImg slot={s} size={28} radius={5} />
                    <div>
                      <div className={styles.slotPickerName}>{s.name}</div>
                      <div className={styles.slotPickerProv}>{s.provider}</div>
                    </div>
                  </div>
                ))
          }
        </div>
      )}
    </div>
  )
}

// ── CompEditor ─────────────────────────────────────────────
function CompEditor({ data, isWinner, bonusBuys, onSave, onClear }) {
  const slots = bonusBuys || 1

  const [slot,     setSlot]     = useState(data?.slot   || null)
  const [player,   setPlayer]   = useState(data?.player || '')
  const [bet,      setBet]      = useState(data?.bet    || '')
  const [payments, setPayments] = useState(() => {
    const p = [...(data?.payments || [])]
    while (p.length < slots) p.push('')
    return p.slice(0, slots)
  })
  const [picking, setPicking] = useState(false)

  // sync when data changes externally
  useEffect(() => {
    setSlot(data?.slot || null)
    setPlayer(data?.player || '')
    setBet(data?.bet || '')
    setPicking(false)
    const p = [...(data?.payments || [])]
    while (p.length < slots) p.push('')
    setPayments(p.slice(0, slots))
  }, [data, slots])

  const save = useCallback((overrides = {}) => {
    const next = { slot, player, bet, payments, ...overrides }
    if (next.slot || next.player.trim()) onSave(next)
  }, [slot, player, bet, payments, onSave])

  const setPayment = (i, v) => {
    const a = [...payments]
    a[i] = v
    setPayments(a)
  }

  const betVal    = parseFloat(bet) || 0
  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p) || 0), 0)
  const multi     = betVal > 0 && totalPaid > 0 ? totalPaid / betVal : null
  const hasContent = !!(slot || player.trim())

  // check if all buys are filled to prevent premature winner
  const allBuysFilled = payments.every(p => parseFloat(p) > 0)

  return (
    <div className={`${styles.compEditor} ${isWinner ? styles.compEditorWinner : ''}`}>
      <div className={styles.compEditorTop}>
        <div className={styles.compEditorSlotArea}>
          {slot && !picking ? (
            <>
              <SlotImg slot={slot} size={32} radius={6} />
              <div className={styles.compEditorSlotInfo}>
                <div className={styles.compEditorSlotName}>{slot.name}</div>
                <div className={styles.compEditorSlotSub}>{player || <span style={{opacity:.4}}>—</span>}</div>
              </div>
              <button className={styles.changeSlotBtn} onClick={() => setPicking(true)}>Trocar</button>
            </>
          ) : picking ? null : (
            <button className={styles.pickSlotBtn} onClick={() => setPicking(true)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              Escolher slot
            </button>
          )}
        </div>
        <div className={styles.compEditorBadges}>
          {multi !== null && (
            <span className={`${styles.multiDisplay} ${isWinner ? styles.multiWin : ''}`}>
              {multi.toFixed(2)}x
            </span>
          )}
          {isWinner && <span className={styles.autoWinBadge}>✓</span>}
          {!allBuysFilled && hasContent && (
            <span title="Nem todos os buys preenchidos" style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>...</span>
          )}
          {hasContent && <button className={styles.clearBtnSm} onClick={onClear}>✕</button>}
        </div>
      </div>

      {picking && (
        <SlotPicker selected={slot} onSelect={s => { setSlot(s); setPicking(false); save({ slot: s }) }} />
      )}

      {slot && !picking && (
        <input className={styles.fieldInput} value={player}
          onChange={e => setPlayer(e.target.value)} onBlur={() => save()}
          placeholder="Jogador..." />
      )}

      <div className={styles.compEditorInputRow}>
        <div className={styles.compEditorInputGroup}>
          <span className={styles.compEditorInputLabel}>Bet</span>
          <input className={styles.betInput} type="number" min="0" step="0.01"
            value={bet} onChange={e => setBet(e.target.value)} onBlur={() => save()}
            placeholder="0.00" />
        </div>
        {payments.map((p, i) => (
          <div key={i} className={styles.compEditorInputGroup}>
            <span className={styles.compEditorInputLabel}>{slots > 1 ? `Buy ${i+1}` : 'Result'}</span>
            <input className={styles.resultInput} type="number" min="0" step="0.01"
              value={p} onChange={e => setPayment(i, e.target.value)} onBlur={() => save()}
              placeholder="0.00" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SidePanel ──────────────────────────────────────────────
function SidePanel({ selection, bracket, bonusBuys, onSave, onSetWinner, onClose }) {
  const { ri, mi } = selection
  const match = bracket[ri][mi]
  const mA = getMulti(match.a), mB = getMulti(match.b)

  // only auto-determine winner if both sides have all buys filled
  const bothComplete = match.a?.payments?.every(p => parseFloat(p) > 0) &&
                       match.b?.payments?.every(p => parseFloat(p) > 0)

  return (
    <div className={styles.sidePanel}>
      <div className={styles.sidePanelHeader}>
        <div className={styles.sidePanelTitle}>
          <span className={styles.sidePanelRound}>{roundLabel(ri, bracket.length)}</span>
          <span className={styles.sidePanelMatch}>Match {mi + 1}</span>
        </div>
        {mA !== null && mB !== null && (
          <div className={styles.sidePanelScore}>
            <span style={{ color: mA >= mB ? '#4ade80' : 'rgba(255,255,255,.4)' }}>{mA.toFixed(2)}</span>
            <span className={styles.sidePanelVs}>vs</span>
            <span style={{ color: mB > mA ? '#4ade80' : 'rgba(255,255,255,.4)' }}>{mB.toFixed(2)}</span>
          </div>
        )}
        {/* Manual winner override */}
        {mA !== null && mB !== null && !bothComplete && (
          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>Buys incompletos</div>
        )}
        <button className={styles.closePanelBtn} onClick={onClose}>✕</button>
      </div>
      <div className={styles.sidePanelBody}>
        <CompEditor data={match.a} isWinner={match.winner === 'a'} bonusBuys={bonusBuys}
          onSave={d => onSave(ri, mi, 'a', d)}
          onClear={() => { onSave(ri, mi, 'a', null); onSetWinner(ri, mi, null) }} />
        <div className={styles.vsDivider}>
          <div className={styles.vsDividerLine} />
          <span className={styles.vsDividerText}>VS</span>
          <div className={styles.vsDividerLine} />
        </div>
        <CompEditor data={match.b} isWinner={match.winner === 'b'} bonusBuys={bonusBuys}
          onSave={d => onSave(ri, mi, 'b', d)}
          onClear={() => { onSave(ri, mi, 'b', null); onSetWinner(ri, mi, null) }} />

        {/* Manual winner buttons when buys incomplete */}
        {mA !== null && mB !== null && !bothComplete && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button
              onClick={() => onSetWinner(ri, mi, 'a')}
              style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid rgba(34,197,94,.3)', background: match.winner === 'a' ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.04)', color: '#4ade80', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              {match.a?.player || 'A'} vence
            </button>
            <button
              onClick={() => onSetWinner(ri, mi, 'b')}
              style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid rgba(34,197,94,.3)', background: match.winner === 'b' ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.04)', color: '#4ade80', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              {match.b?.player || 'B'} vence
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── NewTournamentModal ─────────────────────────────────────
function NewTournamentModal({ onClose, onCreate, nextNum }) {
  const [title,     setTitle]     = useState(`Tournament #${nextNum}`)
  const [size,      setSize]      = useState(8)
  const [balance,   setBalance]   = useState('')
  const [prizePool, setPrizePool] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const inputRef = useRef(null)
  useEffect(() => { setTimeout(() => inputRef.current?.select(), 60) }, [])

  const handleCreate = async () => {
    if (!title.trim()) { setError('Nome obrigatório'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await supabaseDash.from('tournaments')
      .insert([{
        title:         title.trim(),
        size,
        bracket:       buildEmpty(size),
        status:        'active',
        balance_start: parseFloat(balance) || null,
        prize_pool:    parseFloat(prizePool) || null,
      }])
      .select().single()
    if (err) { setError(err.message); setSaving(false); return }
    if (data) onCreate(data)
    setSaving(false)
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <button className={styles.modalClose} onClick={onClose}>✕</button>
        <div className={styles.modalTitle}>Novo Torneio</div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Nome do torneio</label>
          <input ref={inputRef} className={styles.fieldInput} value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()} />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Nº de slots</label>
          <div className={styles.sizeGroup}>
            {SIZES.map(s => (
              <button key={s} onClick={() => setSize(s)}
                className={`${styles.sizeBtn} ${size === s ? styles.sizeBtnActive : ''}`}>
                {s} slots
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.fieldLabel}>Balance inicial (€)</label>
            <div className={styles.prefixInput}>
              <span className={styles.prefixLabel}>€</span>
              <input className={styles.prefixField} type="number" min="0" step="0.01"
                value={balance} onChange={e => setBalance(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="500.00" />
            </div>
          </div>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.fieldLabel}>Prize Pool (€)</label>
            <div className={styles.prefixInput}>
              <span className={styles.prefixLabel}>€</span>
              <input className={styles.prefixField} type="number" min="0" step="0.01"
                value={prizePool} onChange={e => setPrizePool(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="100.00" />
            </div>
            <div className={styles.fieldHint}>Aparece na overlay OBS.</div>
          </div>
        </div>

        {error && <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 7, padding: '7px 10px' }}>{error}</div>}

        <button className={styles.createBtn} onClick={handleCreate} disabled={!title.trim() || saving}>
          {saving ? 'A criar...' : 'Criar Torneio'}
        </button>
      </div>
    </div>
  )
}

// ── EditTournamentModal ────────────────────────────────────
function EditTournamentModal({ tournament, bracket, onClose, onSave }) {
  const [title,     setTitle]     = useState(tournament.title || '')
  const [size,      setSize]      = useState(tournament.size)
  const [bonus,     setBonus]     = useState(tournament.bonus_buys || 1)
  const [prizePool, setPrizePool] = useState(tournament.prize_pool || '')
  const [balance,   setBalance]   = useState(tournament.balance_start || '')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const BONUS_OPTIONS = [1, 2, 3]

  const handleSave = async () => {
    if (!title.trim()) { setError('Nome obrigatório'); return }
    setSaving(true)
    setError('')

    let newBracket
    if (size === tournament.size) {
      newBracket = bracket
    } else if (size > tournament.size) {
      const grown = buildEmpty(size)
      const oldRounds = bracket.length
      grown.forEach((round, ri) => {
        if (ri < oldRounds) {
          round.forEach((match, mi) => {
            if (bracket[ri]?.[mi]) grown[ri][mi] = { ...grown[ri][mi], ...bracket[ri][mi] }
          })
        }
      })
      newBracket = grown
    } else {
      const target = buildEmpty(size)
      newBracket = target.map((round, ri) =>
        round.map((match, mi) => ({ ...match, ...(bracket[ri]?.[mi] || {}) }))
      )
    }

    const { error: err } = await supabaseDash.from('tournaments')
      .update({
        title:         title.trim(),
        size,
        bonus_buys:    bonus,
        bracket:       newBracket,
        prize_pool:    parseFloat(prizePool) || null,
        balance_start: parseFloat(balance) || null,
      })
      .eq('id', tournament.id)

    if (err) { setError(err.message); setSaving(false); return }
    onSave({ ...tournament, title: title.trim(), size, bonus_buys: bonus, prize_pool: parseFloat(prizePool) || null, balance_start: parseFloat(balance) || null }, newBracket)
    setSaving(false)
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <button className={styles.modalClose} onClick={onClose}>✕</button>
        <div className={styles.modalTitle}>Editar Torneio</div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Nome do torneio</label>
          <input className={styles.fieldInput} value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()} />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Nº de slots</label>
          <div className={styles.sizeGroup}>
            {SIZES.map(s => (
              <button key={s} onClick={() => setSize(s)}
                className={`${styles.sizeBtn} ${size === s ? styles.sizeBtnActive : ''}`}>
                {s}
              </button>
            ))}
          </div>
          {size !== tournament.size && (
            <div className={styles.fieldHint}>
              {size > tournament.size
                ? `Aumentar de ${tournament.size} → ${size} slots`
                : `Reduzir de ${tournament.size} → ${size} slots (slots a mais serão removidos)`}
            </div>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Bonus Buys por slot</label>
          <div className={styles.sizeGroup}>
            {BONUS_OPTIONS.map(b => (
              <button key={b} onClick={() => setBonus(b)}
                className={`${styles.sizeBtn} ${bonus === b ? styles.sizeBtnActive : ''}`}>
                {b}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.fieldLabel}>Balance inicial (€)</label>
            <div className={styles.prefixInput}>
              <span className={styles.prefixLabel}>€</span>
              <input className={styles.prefixField} type="number" min="0" step="0.01"
                value={balance} onChange={e => setBalance(e.target.value)} placeholder="500.00" />
            </div>
          </div>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.fieldLabel}>Prize Pool (€)</label>
            <div className={styles.prefixInput}>
              <span className={styles.prefixLabel}>€</span>
              <input className={styles.prefixField} type="number" min="0" step="0.01"
                value={prizePool} onChange={e => setPrizePool(e.target.value)} placeholder="100.00" />
            </div>
          </div>
        </div>

        {error && <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 7, padding: '7px 10px' }}>{error}</div>}

        <button className={styles.createBtn} onClick={handleSave} disabled={!title.trim() || saving}>
          {saving ? 'A guardar...' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ── HistoryView ────────────────────────────────────────────
function HistoryView({ onBack, onOpen }) {
  const [list,    setList]    = useState([])
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(0)
  const PAGE_SIZE = 20

  useEffect(() => {
    supabaseDash.from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .then(({ data }) => { setList(data || []); setLoading(false) })
  }, [page])

  const handleDelete = async (t) => {
    if (!confirm(`Eliminar "${t.title}"?`)) return
    await supabaseDash.from('tournaments').delete().eq('id', t.id)
    setList(l => l.filter(x => x.id !== t.id))
  }

  const handleFinish = async (t) => {
    if (!confirm(`Marcar "${t.title}" como concluído?`)) return
    await supabaseDash.from('tournaments').update({ status: 'finished' }).eq('id', t.id)
    setList(l => l.map(x => x.id === t.id ? { ...x, status: 'finished' } : x))
  }

  return (
    <div className={styles.historyWrap}>
      <div className={styles.historyTop}>
        <h2 className={styles.historyTitle}>Histórico de Torneios</h2>
        <button className={styles.ghostBtn} onClick={onBack}>← Voltar</button>
      </div>
      {loading ? (
        <div className={styles.loadingWrap}><div className={styles.spinner} /> A carregar...</div>
      ) : list.length === 0 ? (
        <div className={styles.emptyState}><p>Nenhum torneio ainda.</p></div>
      ) : (
        <div className={styles.historyList}>
          {list.map(t => {
            // hydrate only for champion display — memoized per item
            const b      = hydrate(t.bracket, t.size)
            const fin    = b[b.length - 1]?.[0]
            const champ  = fin?.winner ? fin[fin.winner] : null
            const date   = new Date(t.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
            return (
              <div key={t.id} className={styles.historyItem}>
                <div className={styles.historyItemLeft}>
                  <div className={styles.historyItemThumb}>
                    {champ?.slot ? <SlotImg slot={champ.slot} size={44} radius={8} /> : null}
                  </div>
                  <div>
                    <div className={styles.historyItemTitle}>{t.title}</div>
                    <div className={styles.historyItemMeta}>
                      {date} · {t.size} slots
                      {t.balance_start ? ` · ${parseFloat(t.balance_start).toFixed(2)}€` : ''}
                      {t.prize_pool ? ` · Prize: ${parseFloat(t.prize_pool).toFixed(2)}€` : ''}
                      {' · '}
                      <span className={t.status === 'finished' ? styles.statusDone : styles.statusActive}>
                        {t.status === 'finished' ? 'Concluído' : 'Ativo'}
                      </span>
                    </div>
                    {champ?.slot && (
                      <div className={styles.historyItemChamp}>
                        {champ.slot.name}
                        {champ.player && ` · ${champ.player}`}
                        {getMulti(champ) !== null && ` · ${getMulti(champ).toFixed(2)}x`}
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.historyItemActions}>
                  <button className={styles.hBtn} onClick={() => onOpen(t)}>Abrir</button>
                  {t.status === 'active' && (
                    <button className={`${styles.hBtn} ${styles.hBtnFinish}`} onClick={() => handleFinish(t)}>Concluir</button>
                  )}
                  <button className={`${styles.hBtn} ${styles.hBtnDanger}`} onClick={() => handleDelete(t)}>Eliminar</button>
                </div>
              </div>
            )
          })}
          {list.length === PAGE_SIZE && (
            <button className={styles.ghostBtn} style={{ alignSelf: 'center' }} onClick={() => setPage(p => p + 1)}>
              Carregar mais
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Bracket connectors ─────────────────────────────────────
function ConnLR({ fromN, toN, outerH }) {
  const padFrom = (outerH - colH(fromN)) / 2
  const padTo   = (outerH - colH(toN))   / 2
  const S = 'rgba(255,255,255,.2)'
  const els = []
  for (let i = 0; i < toN; i++) {
    const yA = padFrom + cardCY(i * 2), yB = padFrom + cardCY(i * 2 + 1)
    const yMid = (yA + yB) / 2, yOut = padTo + cardCY(i)
    els.push(<g key={i}>
      <line x1={0}        y1={yA}   x2={CONN_W/2} y2={yA}   stroke={S} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1={0}        y1={yB}   x2={CONN_W/2} y2={yB}   stroke={S} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1={CONN_W/2} y1={yA}   x2={CONN_W/2} y2={yB}   stroke={S} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1={CONN_W/2} y1={yMid} x2={CONN_W}   y2={yOut} stroke={S} strokeWidth="1.5" strokeLinecap="round"/>
    </g>)
  }
  return (
    <div style={{ flexShrink:0, marginTop: LBL_H }}>
      <svg width={CONN_W} height={outerH} style={{ display:'block', overflow:'visible' }}>{els}</svg>
    </div>
  )
}

function ConnRL({ fromN, toN, outerH }) {
  const padFrom = (outerH - colH(fromN)) / 2
  const padTo   = (outerH - colH(toN))   / 2
  const S = 'rgba(255,255,255,.2)'
  const els = []
  for (let i = 0; i < fromN; i++) {
    const yIn = padFrom + cardCY(i), yA = padTo + cardCY(i * 2), yB = padTo + cardCY(i * 2 + 1)
    const yMid = (yA + yB) / 2
    els.push(<g key={i}>
      <line x1={0}        y1={yIn}  x2={CONN_W/2} y2={yMid} stroke={S} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1={CONN_W/2} y1={yA}   x2={CONN_W/2} y2={yB}   stroke={S} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1={CONN_W/2} y1={yA}   x2={CONN_W}   y2={yA}   stroke={S} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1={CONN_W/2} y1={yB}   x2={CONN_W}   y2={yB}   stroke={S} strokeWidth="1.5" strokeLinecap="round"/>
    </g>)
  }
  return (
    <div style={{ flexShrink:0, marginTop: LBL_H }}>
      <svg width={CONN_W} height={outerH} style={{ display:'block', overflow:'visible' }}>{els}</svg>
    </div>
  )
}

function ConnH({ outerH }) {
  const y = outerH / 2
  return (
    <div style={{ flexShrink:0, marginTop: LBL_H }}>
      <svg width={CONN_W} height={outerH} style={{ display:'block', overflow:'visible' }}>
        <line x1={0} y1={y} x2={CONN_W} y2={y} stroke="rgba(255,255,255,.2)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

function RCol({ matches, ri, totalRounds, outerH, seedOffset = 0, label, selection, onSelect }) {
  const topPad = Math.round((outerH - colH(matches.length)) / 2)

  return (
    <div style={{ flexShrink:0, display:'flex', flexDirection:'column' }}>
      <div style={{ height: LBL_H, display:'flex', alignItems:'center', justifyContent:'center', width: CARD_W }}>
        <span style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.12em' }}>
          {label ?? roundLabel(ri, totalRounds)}
        </span>
      </div>
      <div style={{ height: outerH, position:'relative', width: CARD_W }}>
        {matches.map((match, idx) => {
          const { a, b, winner } = match
          const mi    = idx + seedOffset
          const isSel = selection?.ri === ri && selection?.mi === mi
          const top   = topPad + idx * (MATCH_H + GAP)
          const sA    = ri === 0 ? String.fromCharCode(65 + mi * 2)     : null
          const sB    = ri === 0 ? String.fromCharCode(65 + mi * 2 + 1) : null
          return (
            <div key={idx}
              style={{ position:'absolute', top, left:0, width: CARD_W, height: MATCH_H }}
              className={`${styles.matchCard} ${isSel ? styles.matchCardSelected : ''}`}
              onClick={() => onSelect(isSel ? null : { ri, mi })}>
              <div style={{ height: ROW_H, display:'flex', alignItems:'center', position:'relative', overflow:'hidden' }}
                className={`${styles.compRow} ${winner==='a' ? styles.compRowWinner : ''} ${winner==='b' && a ? styles.compRowLoser : ''}`}>
                {winner==='a' && <div className={styles.winnerBar}/>}
                {sA && <div className={styles.seedBadge}>{sA}</div>}
                {a?.slot ? <SlotImg slot={a.slot} size={ROW_H}/> : <div style={{ width:ROW_H, height:ROW_H, flexShrink:0, background:'rgba(255,255,255,.025)' }}/>}
                <div className={styles.compInfo}>
                  {a?.slot
                    ? <><div className={styles.compName}>{a.slot.name}</div>{a.player && <div className={styles.compPlayer}>{a.player}</div>}</>
                    : <span className={styles.compAdd}>+ Adicionar</span>}
                </div>
                {getMulti(a) !== null && <div className={`${styles.compResult} ${winner==='a' ? styles.compResultWin:''}`}>{getMulti(a).toFixed(2)}x</div>}
              </div>
              <div style={{ height:1, background:'rgba(255,255,255,.07)' }}/>
              <div style={{ height: ROW_H, display:'flex', alignItems:'center', position:'relative', overflow:'hidden' }}
                className={`${styles.compRow} ${winner==='b' ? styles.compRowWinner : ''} ${winner==='a' && b ? styles.compRowLoser : ''}`}>
                {winner==='b' && <div className={styles.winnerBar}/>}
                {sB && <div className={styles.seedBadge}>{sB}</div>}
                {b?.slot ? <SlotImg slot={b.slot} size={ROW_H}/> : <div style={{ width:ROW_H, height:ROW_H, flexShrink:0, background:'rgba(255,255,255,.025)' }}/>}
                <div className={styles.compInfo}>
                  {b?.slot
                    ? <><div className={styles.compName}>{b.slot.name}</div>{b.player && <div className={styles.compPlayer}>{b.player}</div>}</>
                    : <span className={styles.compAdd}>+ Adicionar</span>}
                </div>
                {getMulti(b) !== null && <div className={`${styles.compResult} ${winner==='b' ? styles.compResultWin:''}`}>{getMulti(b).toFixed(2)}x</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MirrorBracket({ bracket, selection, onSelect }) {
  const totalRounds = bracket.length
  const finalRi     = totalRounds - 1

  const leftHalf  = (ri) => bracket[ri].slice(0, Math.ceil(bracket[ri].length / 2))
  const rightHalf = (ri) => bracket[ri].slice(Math.ceil(bracket[ri].length / 2))

  const leftCols  = Array.from({ length: finalRi }, (_, i) => ({ ri: i, matches: leftHalf(i) }))
  const rightCols = Array.from({ length: finalRi }, (_, i) => ({
    ri: finalRi - 1 - i,
    matches: rightHalf(finalRi - 1 - i),
    seedOffset: Math.ceil(bracket[finalRi - 1 - i].length / 2),
  }))

  const outerN = leftCols[0]?.matches.length || 1
  const outerH = colH(outerN)

  const fin      = bracket[finalRi]?.[0]
  const champion = fin?.winner ? fin[fin.winner] : null

  return (
    <div style={{ display:'inline-flex', alignItems:'flex-start', padding:'20px 24px', gap:0 }}>
      {leftCols.map(({ ri, matches }, colIdx) => (
        <div key={`L${ri}`} style={{ display:'contents' }}>
          <RCol matches={matches} ri={ri} totalRounds={totalRounds} outerH={outerH}
            seedOffset={0} label={roundLabel(ri, totalRounds)} selection={selection} onSelect={onSelect} />
          {colIdx < leftCols.length - 1
            ? <ConnLR fromN={matches.length} toN={leftCols[colIdx + 1].matches.length} outerH={outerH} />
            : <ConnH outerH={outerH} />
          }
        </div>
      ))}

      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
        <RCol
          matches={[bracket[finalRi][0]]}
          ri={finalRi} totalRounds={totalRounds} outerH={outerH}
          label="Final" selection={selection} onSelect={onSelect}
        />
        <div style={{ marginTop:16, width: CARD_W }} className={styles.champCard}>
          <svg width="26" height="22" viewBox="0 0 26 22" fill="none">
            <path d="M3 2L13 8L23 2L20 17H6L3 2Z" fill="rgba(245,158,11,.85)" stroke="rgba(245,158,11,1)" strokeWidth="1.2" strokeLinejoin="round"/>
            <rect x="6" y="18" width="14" height="3" rx="1.5" fill="rgba(245,158,11,.6)"/>
          </svg>
          <div className={styles.champLabel}>Campeão</div>
          {champion?.slot
            ? <>
                <SlotImg slot={champion.slot} size={48} radius={8} />
                <div className={styles.champName}>{champion.slot.name}</div>
                {champion.player && <div className={styles.champPlayer}>{champion.player}</div>}
                {getMulti(champion) !== null && <div className={styles.champMulti}>{getMulti(champion).toFixed(2)}x</div>}
              </>
            : <div className={styles.champEmpty}>A decidir…</div>
          }
        </div>
      </div>

      {rightCols.map(({ ri, matches, seedOffset }, colIdx) => (
        <div key={`R${ri}`} style={{ display:'contents' }}>
          {colIdx === 0
            ? <ConnH outerH={outerH} />
            : <ConnRL fromN={rightCols[colIdx - 1].matches.length} toN={matches.length} outerH={outerH} />
          }
          <RCol matches={matches} ri={ri} totalRounds={totalRounds} outerH={outerH}
            seedOffset={seedOffset} label={roundLabel(ri, totalRounds)} selection={selection} onSelect={onSelect} />
        </div>
      ))}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────
export default function DashTorneios() {
  const [tournament, setTournament] = useState(null)
  const [bracket,    setBracket]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState('main')
  const [selection,  setSelection]  = useState(null)
  const [newOpen,    setNewOpen]    = useState(false)
  const [editOpen,   setEditOpen]   = useState(false)
  const [activated,  setActivated]  = useState(false)
  const [nextNum,    setNextNum]    = useState(1)
  const persistTimer = useRef(null)

  useEffect(() => {
    supabaseDash.from('tournaments').select('*')
      .eq('status', 'active').order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (data?.[0]) { setTournament(data[0]); setBracket(hydrate(data[0].bracket, data[0].size)) }
        setLoading(false)
      })
    supabaseDash.from('tournaments').select('id', { count: 'exact', head: true })
      .then(({ count }) => setNextNum((count || 0) + 1))
  }, [])

  // debounced persist — avoids spamming supabase on rapid changes
  const persist = useCallback((nb, t = tournament) => {
    if (!t?.id) return
    clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(async () => {
      const fin    = nb[nb.length - 1]?.[0]
      const winner = fin?.winner ? fin[fin.winner] : null
      const { error } = await supabaseDash.from('tournaments').update({ bracket: nb, winner }).eq('id', t.id)
      if (error) console.error('[torneios] persist error:', error.message)
    }, 300)
  }, [tournament])

  // memoized stats — only recalculate when bracket changes
  const stats = useMemo(() => {
    const seen = new Set(), comps = []
    bracket.forEach(r => r.forEach(m => {
      ;[m.a, m.b].forEach(c => {
        if (!c) return
        const k = `${c.slot?.id}__${c.player}`
        if (seen.has(k)) return
        seen.add(k); comps.push(c)
      })
    }))
    const totalPay  = comps.reduce((s, c) => s + (parseFloat(c.bet) || 0), 0)
    const totalWon  = comps.reduce((s, c) => s + (c.payments || []).reduce((a, p) => a + (parseFloat(p) || 0), 0), 0)
    const withMulti = comps.map(c => ({ name: c.slot?.name || c.player || '?', slot: c.slot || null, player: c.player || null, multi: getMulti(c) })).filter(x => x.multi !== null)
    const best  = withMulti.length ? withMulti.reduce((a, b) => b.multi > a.multi ? b : a) : null
    const worst = withMulti.length ? withMulti.reduce((a, b) => b.multi < a.multi ? b : a) : null
    return { totalPay, totalWon, best, worst, balanceStart: parseFloat(tournament?.balance_start) || 0 }
  }, [bracket, tournament?.balance_start])

  const propagateClear = useCallback((nb, ri, mi) => {
    let cRi = ri + 1, cMi = Math.floor(mi / 2), cSlot = mi % 2 === 0 ? 'a' : 'b'
    while (nb[cRi]) {
      nb[cRi][cMi] = { ...nb[cRi][cMi], [cSlot]: null, winner: null }
      const nMi = Math.floor(cMi / 2); cSlot = cMi % 2 === 0 ? 'a' : 'b'; cMi = nMi; cRi++
    }
  }, [])

 const applyWinner = useCallback((nb, ri, mi, winner) => {
    nb[ri][mi] = { ...nb[ri][mi], winner }
    const nextRi = ri + 1
    const nextMi = Math.floor(mi / 2)
    const nextSlot = mi % 2 === 0 ? 'a' : 'b'
    
    if (nb[nextRi]) {
      // Se houver um vencedor, clonamos os dados mas FORÇAMOS os pagamentos a vazio []
      let winnerData = null
      if (winner && nb[ri][mi][winner]) {
        winnerData = { 
          ...nb[ri][mi][winner], 
          payments: [] // <-- Aqui está a magia que dá o reset aos resultados!
        }
      }

      nb[nextRi][nextMi] = { ...nb[nextRi][nextMi], [nextSlot]: winnerData, winner: null }
      if (!winnerData) propagateClear(nb, nextRi, nextMi)
    }
  }, [propagateClear])

  const syncEntries = useCallback(async (data) => {
    if (!tournament?.id) return
    const slotId = data?.slot?.id
    if (!slotId) return
    try {
      await supabaseDash.from('bonus_entries').delete()
        .eq('tournament_id', tournament.id).eq('slot_id', slotId)
      if (!parseFloat(data?.bet)) return
      const betVal = parseFloat(data.bet)
      const inserts = (data.payments || [])
        .map(p => {
          const payVal = parseFloat(p) || null
          return payVal !== null ? {
            tournament_id: tournament.id, hunt_id: null, slot_id: slotId,
            bet: betVal, payment: payVal, opened: true,
            paid_at: new Date().toISOString(), game_type: 'tournament', is_super: false,
          } : null
        })
        .filter(Boolean)
      if (inserts.length > 0) await supabaseDash.from('bonus_entries').insert(inserts)
    } catch (err) {
      console.error('[torneios] syncEntries error:', err.message)
    }
  }, [tournament?.id])

  const handleSave = useCallback((ri, mi, side, data) => {
    // fire-and-forget sync in background
    syncEntries(data)

    setBracket(prev => {
      const nb = cloneBracket(prev)
      nb[ri][mi] = { ...nb[ri][mi], [side]: data }

      if (!data) {
        if (nb[ri][mi].winner === side) { nb[ri][mi].winner = null; propagateClear(nb, ri, mi) }
      } else {
        const u = nb[ri][mi], mA = getMulti(u.a), mB = getMulti(u.b)
        // only auto-winner if BOTH sides have all buys filled
        const aFilled = (u.a?.payments || []).every(p => parseFloat(p) > 0) && (u.a?.payments?.length || 0) > 0
        const bFilled = (u.b?.payments || []).every(p => parseFloat(p) > 0) && (u.b?.payments?.length || 0) > 0
        if (mA !== null && mB !== null && aFilled && bFilled) {
          applyWinner(nb, ri, mi, mA >= mB ? 'a' : 'b')
        }
      }
      persist(nb)
      return nb
    })
  }, [syncEntries, propagateClear, applyWinner, persist])

  const handleSetWinner = useCallback((ri, mi, winner) => {
    setBracket(prev => {
      const nb = cloneBracket(prev)
      applyWinner(nb, ri, mi, winner)
      persist(nb)
      return nb
    })
  }, [applyWinner, persist])

  const activate = async () => {
    const DASHBOARD_ID = 'aa9660ca-4c53-4d4d-b81b-b3d231660420'
    await supabaseDash.from('dashboard_state').update({ activity: 'torneios' }).eq('id', DASHBOARD_ID)
    setActivated(true); setTimeout(() => setActivated(false), 3000)
  }

  const handleCreate = (t) => {
    setTournament(t); setBracket(hydrate(t.bracket, t.size))
    setNewOpen(false); setSelection(null); setView('main'); setNextNum(n => n + 1)
  }

  const handleEditSave = (t, nb) => {
    setTournament(t); setBracket(nb); setEditOpen(false); setSelection(null)
  }

  const handleOpenFromHistory = (t) => {
    setTournament(t); setBracket(hydrate(t.bracket, t.size)); setView('main'); setSelection(null)
  }

  if (view === 'history') return <HistoryView onBack={() => setView('main')} onOpen={handleOpenFromHistory} />
  if (loading) return <div className={styles.loadingWrap}><div className={styles.spinner} /> A carregar...</div>

  if (!tournament) return (
    <div className={styles.emptyPage}>
      <svg width="52" height="46" viewBox="0 0 26 22" fill="none">
        <path d="M3 2L13 8L23 2L20 17H6L3 2Z" fill="rgba(245,158,11,.7)" stroke="rgba(245,158,11,.9)" strokeWidth="1.2" strokeLinejoin="round"/>
        <rect x="6" y="18" width="14" height="3" rx="1.5" fill="rgba(245,158,11,.5)"/>
      </svg>
      <h2 className={styles.emptyTitle}>Nenhum torneio ativo</h2>
      <p className={styles.emptySub}>Cria um novo torneio para começar</p>
      <div className={styles.emptyActions}>
        <button className={styles.createBtn} onClick={() => setNewOpen(true)}>+ Novo Torneio</button>
        <button className={styles.ghostBtn}  onClick={() => setView('history')}>Ver Histórico</button>
      </div>
      {newOpen && <NewTournamentModal onClose={() => setNewOpen(false)} onCreate={handleCreate} nextNum={nextNum} />}
    </div>
  )

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <svg width="15" height="14" viewBox="0 0 26 22" fill="none">
            <path d="M3 2L13 8L23 2L20 17H6L3 2Z" fill="rgba(245,158,11,.85)" stroke="rgba(245,158,11,1)" strokeWidth="1.2" strokeLinejoin="round"/>
            <rect x="6" y="18" width="14" height="3" rx="1.5" fill="rgba(245,158,11,.6)"/>
          </svg>
          <span className={styles.tournamentTitle}>{tournament.title}</span>
          <button className={styles.editTitleBtn} onClick={() => setEditOpen(true)} title="Editar torneio">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <span className={`${styles.statusBadge} ${tournament.status === 'finished' ? styles.statusBadgeDone : styles.statusBadgeActive}`}>
            {tournament.status === 'finished' ? 'Concluído' : 'Ativo'}
          </span>
          <span className={styles.sizeLabel}>{tournament.size} slots · {tournament.bonus_buys || 1} buy{(tournament.bonus_buys || 1) > 1 ? 's' : ''}</span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.ghostBtn} onClick={() => setView('history')}>Histórico</button>
          <button className={styles.ghostBtn} onClick={() => setNewOpen(true)}>+ Novo</button>
          <button className={`${styles.activateBtn} ${activated ? styles.activateBtnDone : ''}`} onClick={activate}>
            {activated ? '✓ Ativado' : 'Barra OBS'}
          </button>
        </div>
      </div>

      <div className={styles.statsBar}>
        <div className={styles.statBox}>
          <div className={styles.statLabelRow}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2.2" strokeLinecap="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
            </svg>
            <span className={styles.statLabel}>Balance start</span>
          </div>
          <div className={styles.statVal}>{stats.balanceStart > 0 ? `${stats.balanceStart.toFixed(2)}€` : '—'}</div>
        </div>
        <div className={styles.statDivider} />

        <div className={styles.statBox}>
          <div className={styles.statLabelRow}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            <span className={styles.statLabel}>Total apostado</span>
          </div>
          <div className={`${styles.statVal} ${stats.totalPay > 0 ? styles.statAmber : ''}`}>
            {stats.totalPay > 0 ? `${stats.totalPay.toFixed(2)}€` : '—'}
          </div>
        </div>
        <div className={styles.statDivider} />

        <div className={styles.statBox}>
          <div className={styles.statLabelRow}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2.2" strokeLinecap="round">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <span className={styles.statLabel}>Total ganho</span>
          </div>
          <div className={`${styles.statVal} ${stats.totalWon > 0 ? styles.statGreen : ''}`}>
            {stats.totalWon > 0 ? `${stats.totalWon.toFixed(2)}€` : '—'}
          </div>
        </div>
        <div className={styles.statDivider} />

        {/* Prize pool — defined in tournament settings */}
        <div className={styles.statBox}>
          <div className={styles.statLabelRow}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(124,111,255,.5)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
              <path d="M12 17v4"/><path d="M8 21h8"/>
              <path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/>
            </svg>
            <span className={styles.statLabel}>Prize Pool</span>
          </div>
          <div className={`${styles.statVal} ${tournament.prize_pool ? styles.statAmber : ''}`}>
            {tournament.prize_pool ? `${parseFloat(tournament.prize_pool).toFixed(2)}€` : '—'}
          </div>
        </div>
        <div className={styles.statDivider} />

        <div className={styles.statBox}>
          <div className={styles.statLabelRow}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(74,222,128,.5)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
            </svg>
            <span className={styles.statLabel}>Melhor slot</span>
          </div>
          {stats.best ? (
            <div className={styles.statSlotRow}>
              <SlotImg slot={stats.best.slot} size={32} radius={6} />
              <div className={styles.statSlotInfo}>
                <div className={`${styles.statVal} ${styles.statGreen}`}>{stats.best.multi.toFixed(2)}x</div>
                <div className={styles.statSub}>{stats.best.name}</div>
                {stats.best.player && <div className={styles.statPlayer}>{stats.best.player}</div>}
              </div>
            </div>
          ) : <div className={styles.statVal}>—</div>}
        </div>
        <div className={styles.statDivider} />

        <div className={styles.statBox}>
          <div className={styles.statLabelRow}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(248,113,113,.5)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
            </svg>
            <span className={styles.statLabel}>Pior slot</span>
          </div>
          {stats.worst ? (
            <div className={styles.statSlotRow}>
              <SlotImg slot={stats.worst.slot} size={32} radius={6} />
              <div className={styles.statSlotInfo}>
                <div className={`${styles.statVal} ${styles.statRed}`}>{stats.worst.multi.toFixed(2)}x</div>
                <div className={styles.statSub}>{stats.worst.name}</div>
                {stats.worst.player && <div className={styles.statPlayer}>{stats.worst.player}</div>}
              </div>
            </div>
          ) : <div className={styles.statVal}>—</div>}
        </div>
      </div>

      <div className={styles.mainArea}>
        <div className={styles.bracketScroll}>
          <MirrorBracket bracket={bracket} selection={selection} onSelect={setSelection} />
        </div>
        {selection && (
          <SidePanel
            selection={selection} bracket={bracket}
            bonusBuys={tournament?.bonus_buys || 1}
            onSave={handleSave} onSetWinner={handleSetWinner}
            onClose={() => setSelection(null)} />
        )}
      </div>

      {newOpen  && <NewTournamentModal  onClose={() => setNewOpen(false)}  onCreate={handleCreate}  nextNum={nextNum} />}
      {editOpen && <EditTournamentModal tournament={tournament} bracket={bracket} onClose={() => setEditOpen(false)} onSave={handleEditSave} />}
    </div>
  )
}