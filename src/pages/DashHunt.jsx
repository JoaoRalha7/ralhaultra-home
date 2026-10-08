import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseDash } from '../lib/supabase'
import { adminPoints } from '../lib/points'
import { parseBet, AVG_BUCKETS, getBucket } from '../lib/miniGamesUtils'
import styles from './DashHunt.module.css'

// Deleting a mini-game: give every participant their entry cost back unless the game was already awarded.
// Each entry is deleted only after its refund succeeded, so a retry never double-refunds.
async function refundAndDeleteEntries(table, gameId) {
  const { data: rows } = await supabaseDash.from(table).select('*').eq('game_id', gameId)
  const list = rows || []
  const awarded = list.some(r => r.awarded_at || r.points_awarded > 0)
  let refunded = 0, total = 0
  for (const r of list) {
    const cost = awarded ? 0 : Math.max(0, parseInt(r.cost_paid) || 0)
    if (cost > 0 && r.twitch_username) {
      const res = await adminPoints(r.twitch_username, cost)
      if (!res.ok) return { ok: false, refunded, total, error: `${r.twitch_username}: ${res.data?.error || res.status}` }
      refunded++; total += cost
    }
    await supabaseDash.from(table).delete().eq('id', r.id)
  }
  return { ok: true, refunded, total, awarded }
}
const refundNote = (r) => r.awarded ? 'Game already awarded - no refunds.' : `${r.refunded} participant(s) refunded (${r.total} pts).`

function fmt(n, d = 2) {
  return parseBet(n).toLocaleString('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function multiClass(multi, s) {
  if (multi === null) return s.multiNone
  if (multi >= 100) return s.multiGood
  if (multi >= 40)  return s.multiMid
  return s.multiBad
}

// ── New Hunt Modal ─────────────────────────────────────────
function NewHuntModal({ onClose, onCreated }) {
  const [balance, setBalance] = useState('')
  const [error,   setError]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const inputRef = useRef(null)
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50) }, [])

  const handleCreate = async () => {
    const val = parseFloat(balance)
    if (!val || val <= 0) { setError('Enter a valid starting balance.'); return }
    setSaving(true)
    try {
      const { count } = await supabaseDash.from('bonus_hunts').select('*', { count: 'exact', head: true })
      const today = new Date().toISOString().split('T')[0]
      const { data, error: err } = await supabaseDash
        .from('bonus_hunts')
        .insert([{ title: `Bonus Hunt #${(count || 0) + 1}`, date: today, balance_start: val, active: true, mode: 'hunting' }])
        .select().single()
      if (err || !data) { setError('Error creating hunt.'); return }
      await supabaseDash.from('bonus_hunts').update({ active: false }).neq('id', data.id)
      await supabaseDash.from('bonus_hunts').update({ active: true }).eq('id', data.id)
      onCreated(data)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <button className={styles.modalClose} onClick={onClose}><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/></svg></button>
        <div className={styles.modalTitle}>Novo Bonus Hunt</div>
        {error && <div className={styles.modalError}>{error}</div>}
        <label className={styles.modalLabel}>Starting Balance (€)</label>
        <input ref={inputRef} className={styles.modalInput} type="number" step="0.01" min="0"
          value={balance} onChange={e => { setBalance(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleCreate()} placeholder="ex: 500" />
        <button className={styles.modalBtn} onClick={handleCreate} disabled={saving}>
          {saving ? 'A criar...' : 'Criar Hunt'}
        </button>
      </div>
    </div>
  )
}

// ── Add Slot Modal ─────────────────────────────────────────
function AddSlotModal({ slot, onClose, onAdd }) {
  const [bet,     setBet]     = useState('')
  const [isSuper, setIsSuper] = useState(false)
  const inputRef = useRef(null)
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50) }, [])

  const handleAdd = () => {
    onAdd(slot, bet !== '' ? parseFloat(bet) : null, isSuper)
    onClose()
  }

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} style={{ minWidth: 320, maxWidth: 400 }}>
        <div className={styles.modalTitle}>Adicionar Slot</div>
        <div className={styles.slotPreview}>
          <img src={slot.image_url || ''} alt={slot.name} className={styles.slotPreviewImg}
            onError={e => e.target.style.opacity='.2'} />
          <div>
            <div className={styles.slotPreviewName}>{slot.name}</div>
            <div className={styles.slotPreviewProv}>{slot.provider}</div>
          </div>
        </div>
        <label className={styles.modalLabel}>Bet (€)</label>
        <input ref={inputRef} className={styles.modalInput} type="number" step="0.01" min="0"
          value={bet} onChange={e => setBet(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="ex: 2.00" />
        <button
          className={`${styles.superToggle} ${isSuper ? styles.superToggleOn : ''}`}
          onClick={() => setIsSuper(v => !v)}
        >
          <span className={styles.superToggleIcon}><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg></span>
          <span className={styles.superToggleLabel}>Super Bónus</span>
          <div className={`${styles.superTrack} ${isSuper ? styles.superTrackOn : ''}`}>
            <div className={`${styles.superKnob} ${isSuper ? styles.superKnobOn : ''}`} />
          </div>
        </button>
        <div className={styles.modalActions}>
          <button className={styles.modalBtnGhost} onClick={onClose}>Cancel</button>
          <button className={styles.modalBtn} onClick={handleAdd}>Adicionar</button>
        </div>
      </div>
    </div>
  )
}

// ── Detail Modal ───────────────────────────────────────────
function huntStats(h, entries) {
  const open = entries.filter(e => e.payment != null && parseBet(e.bet) > 0 && (e.opened || parseBet(e.payment) > 0))
  const totalBet = entries.reduce((a, e) => a + parseBet(e.bet), 0)
  const totalPay = open.reduce((a, e) => a + parseBet(e.payment), 0)
  const balStart = parseBet(h.balance_start)
  const hasEnd   = h.balance_end != null && h.balance_end !== ''
  const profit   = hasEnd ? parseFloat(h.balance_end) + totalPay - balStart : totalPay - balStart
  const multis   = open.map(e => parseBet(e.payment) / parseBet(e.bet))
  return {
    n: entries.length, opened: open.length, totalBet, totalPay, profit, hasProfit: balStart > 0 && open.length > 0,
    avg: multis.length ? multis.reduce((a, b) => a + b, 0) / multis.length : 0,
    best: multis.length ? Math.max(...multis) : 0,
  }
}

const HI = {
  back:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  x:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  trash: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>,
  crown: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z"/></svg>,
}
const signed = (n) => (n >= 0 ? '+' : '') + fmt(n) + '€'

function DetailModal({ hunt, onClose }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabaseDash.from('bonus_entries').select('*, slot:slots(*)')
      .eq('hunt_id', hunt.id).order('created_at', { ascending: true })
      .then(({ data }) => { setEntries(data || []); setLoading(false) })
  }, [hunt.id])
  const st = huntStats(hunt, entries)

  return (
    <div className={styles.hxOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.hxModal}>
        <div className={styles.hxModalHead}>
          <div>
            <h2>{hunt.title || `Bonus Hunt #${hunt.id}`}</h2>
            <p>{fmtDate(hunt.date)} · Saldo inicial {hunt.balance_start ? fmt(hunt.balance_start) + '€' : '—'}</p>
          </div>
          <button className={styles.hxX} onClick={onClose} aria-label="Fechar">{HI.x}</button>
        </div>
        {!loading && (
          <div className={styles.hxModalStats}>
            <div><span>Profit</span><b className={!st.hasProfit ? '' : st.profit >= 0 ? styles.green : styles.red}>{st.hasProfit ? signed(st.profit) : '—'}</b></div>
            <div><span>Total pago</span><b>{fmt(st.totalPay)}€</b></div>
            <div><span>AVG multi</span><b>{st.avg ? st.avg.toFixed(2) + 'x' : '—'}</b></div>
            <div><span>Melhor</span><b className={styles.amber}>{st.best ? st.best.toFixed(1) + 'x' : '—'}</b></div>
          </div>
        )}
        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /> A carregar...</div>
        ) : (
          <div className={styles.hxModalList}>
            {entries.map((e, i) => {
              const bet = parseBet(e.bet)
              const multi = bet > 0 && e.payment != null ? parseBet(e.payment) / bet : null
              const mc = multi === null ? '' : multi >= 100 ? styles.hxMGold : multi >= 1 ? styles.hxMGreen : styles.hxMRed
              return (
                <div key={e.id} className={`${styles.hxDRow} ${multi !== null && multi >= 1 ? styles.hxDRowWin : ''}`}>
                  <span className={styles.hxIdx}>#{i + 1}</span>
                  <img src={e.slot?.image_url || ''} alt="" onError={ev => ev.target.style.opacity = '.2'} />
                  <div className={styles.hxDName}>
                    <b>{e.slot?.name || '—'}</b>
                    <small>{e.slot?.provider || ''}</small>
                  </div>
                  {e.is_super && <span className={styles.hxDSuper}>{HI.crown}</span>}
                  <span className={styles.hxDNum}>{bet ? fmt(bet) + '€' : '—'}</span>
                  <span className={styles.hxDNum}>{e.payment != null ? fmt(parseBet(e.payment)) + '€' : '—'}</span>
                  <span className={`${styles.hxMulti} ${mc}`}>{multi !== null ? multi.toFixed(1) + 'x' : '—'}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── History ────────────────────────────────────────────────
function HistoryView({ onBack, onReopen }) {
  const [hunts,   setHunts]   = useState([])
  const [stats,   setStats]   = useState({})
  const [loading, setLoading] = useState(true)
  const [detail,  setDetail]  = useState(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabaseDash.from('bonus_hunts').select('*').order('id', { ascending: false })
      const list = data || []
      setHunts(list)
      // all entries, paged (supabase caps a response at 1000 rows)
      let rows = [], from = 0
      while (true) {
        const { data: es } = await supabaseDash.from('bonus_entries').select('hunt_id,bet,payment,opened').range(from, from + 999)
        if (!es?.length) break
        rows = rows.concat(es)
        if (es.length < 1000) break
        from += 1000
      }
      const by = {}
      rows.forEach(r => { (by[r.hunt_id] = by[r.hunt_id] || []).push(r) })
      const out = {}
      list.forEach(h => { out[h.id] = huntStats(h, by[h.id] || []) })
      setStats(out)
      setLoading(false)
    })()
  }, [])

  const handleDelete = async (hunt) => {
    if (!confirm(`Eliminar "${hunt.title||'Bonus Hunt #'+hunt.id}"? Irreversível.`)) return
    await supabaseDash.from('bonus_entries').delete().eq('hunt_id', hunt.id)
    await supabaseDash.from('bonus_hunts').delete().eq('id', hunt.id)
    setHunts(hs => hs.filter(h => h.id !== hunt.id))
  }

  const all = hunts.map(h => stats[h.id]).filter(Boolean)
  const withP = all.filter(x => x.hasProfit)
  const sumProfit = withP.reduce((a, x) => a + x.profit, 0)
  const bestMulti = all.reduce((m, x) => Math.max(m, x.best), 0)
  const wins = withP.filter(x => x.profit >= 0).length

  return (
    <div className={`${styles.page} ${styles.hxPage}`}>
      <div className={styles.hxHead}>
        <div>
          <div className={styles.hxTitleRow}><h1>Histórico</h1></div>
          <p>Todos os bonus hunts. Reabre um para continuar ou vê o detalhe.</p>
        </div>
        <button className={styles.hxGhost} onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{HI.back}Voltar</button>
      </div>

      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /> A carregar...</div>
      ) : hunts.length === 0 ? (
        <div className={styles.emptyState}><p>Sem hunts.</p></div>
      ) : (
        <>
          <div className={styles.hxHStats}>
            <div className={styles.hxStat}><span>Hunts</span><b>{hunts.length}</b></div>
            <div className={styles.hxStat}><span>Profit total</span><b className={withP.length ? (sumProfit >= 0 ? styles.green : styles.red) : ''}>{withP.length ? signed(sumProfit) : '—'}</b></div>
            <div className={styles.hxStat}><span>Em positivo</span><b>{withP.length ? `${wins} / ${withP.length}` : '—'}</b></div>
            <div className={styles.hxStat}><span>Melhor multi</span><b className={styles.amber}>{bestMulti ? bestMulti.toFixed(1) + 'x' : '—'}</b></div>
          </div>

          <div className={styles.hxHGrid}>
            {hunts.map(h => {
              const x = stats[h.id]
              return (
                <div key={h.id} className={`${styles.hxHCard} ${h.active ? styles.hxHCardOn : ''}`}>
                  <div className={styles.hxHTop}>
                    <div style={{ minWidth: 0 }}>
                      <div className={styles.hxHTitle}>{h.title || `Bonus Hunt #${h.id}`}{h.active && <em><i />Ativo</em>}</div>
                      <div className={styles.hxHDate}>{fmtDate(h.date)}</div>
                    </div>
                    <div className={styles.hxHProfit}>
                      <b className={x?.hasProfit ? (x.profit >= 0 ? styles.green : styles.red) : ''}>{x?.hasProfit ? signed(x.profit) : '—'}</b>
                      <small>profit</small>
                    </div>
                  </div>
                  <div className={styles.hxHFigs}>
                    <div><span>Saldo</span><b>{h.balance_start ? fmt(h.balance_start) + '€' : '—'}</b></div>
                    <div><span>Slots</span><b>{x ? `${x.opened}/${x.n}` : '—'}</b></div>
                    <div><span>AVG</span><b>{x?.avg ? x.avg.toFixed(1) + 'x' : '—'}</b></div>
                    <div><span>Melhor</span><b className={styles.amber}>{x?.best ? x.best.toFixed(1) + 'x' : '—'}</b></div>
                  </div>
                  <div className={styles.hxHActs}>
                    <button className={styles.hxHMain} onClick={() => onReopen(h)}>Reabrir</button>
                    <button className={styles.hxGhost} onClick={() => setDetail(h)}>Detalhes</button>
                    <button className={styles.hxHDel} aria-label="Eliminar" onClick={() => handleDelete(h)}>{HI.trash}</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
      {detail && <DetailModal hunt={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

// ── Stats Panel ────────────────────────────────────────────
// ── Pick Panel ─────────────────────────────────────────────
function PickPanel({ hunt, entries }) {
  const [pickGame,       setPickGame]      = useState(null)
  const [picks,          setPicks]         = useState([])
  const [pickLoading,    setPickLoading]   = useState(false)
  const [pickDuration,   setPickDuration]  = useState(180)
  const [showConfig,     setShowConfig]    = useState(false)
  const [awarding,       setAwarding]      = useState(false)
  const [awardMsg,       setAwardMsg]      = useState(null)
  const [dbError,        setDbError]       = useState(null)
  const [panelReady,     setPanelReady]    = useState(false)
  const [pts1,           setPts1]          = useState(500)
  const [pts2,           setPts2]          = useState(300)
  const [pts3,           setPts3]          = useState(100)
  const [deleting,       setDeleting]      = useState(false)
  const [showAwardPreview, setShowAwardPreview] = useState(false)

  const load = useCallback(async () => {
    if (!hunt?.id) return
    setDbError(null)
    const { data, error } = await supabaseDash
      .from('pick_games').select('*')
      .eq('hunt_id', hunt.id)
      .order('created_at', { ascending: false }).limit(1)
    if (error) {
      setDbError(error.message)
      setPanelReady(true)
      return
    }
    const g = data?.[0] || null
    setPickGame(g)
    if (g) {
      const { data: ps } = await supabaseDash.from('picks').select('*').eq('game_id', g.id)
      setPicks(ps || [])
    }
    setPanelReady(true)
  }, [hunt?.id])

  useEffect(() => { load() }, [load])

  // Auto-close when closes_at expires
  useEffect(() => {
    if (!pickGame || pickGame.status !== 'open' || !pickGame.closes_at) return
    const remaining = new Date(pickGame.closes_at) - Date.now()
    if (remaining <= 0) {
      supabaseDash.from('pick_games').update({ status: 'closed' }).eq('id', pickGame.id).then(() => load())
      return
    }
    const t = setTimeout(async () => {
      await supabaseDash.from('pick_games').update({ status: 'closed' }).eq('id', pickGame.id)
      await load()
    }, remaining)
    return () => clearTimeout(t)
  }, [pickGame?.id, pickGame?.status, pickGame?.closes_at, load])

  // Realtime picks
  useEffect(() => {
    if (!pickGame) return
    const ch = supabaseDash.channel(`dash-picks-${pickGame.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'picks', filter: `game_id=eq.${pickGame.id}` }, () => {
        supabaseDash.from('picks').select('*').eq('game_id', pickGame.id)
          .then(({ data }) => setPicks(data || []))
      })
      .subscribe()
    return () => ch.unsubscribe()
  }, [pickGame])

  const openPick = async () => {
    setPickLoading(true)
    const closesAt = new Date(Date.now() + pickDuration * 1000).toISOString()
    const ptsFields = { points_1st: pts1, points_2nd: pts2, points_3rd: pts3 }
    if (pickGame) {
      await supabaseDash.from('pick_games').update({
        status: 'open', opened_at: new Date().toISOString(),
        closes_at: closesAt, duration_secs: pickDuration,
        ...ptsFields
      }).eq('id', pickGame.id)
    } else {
      await supabaseDash.from('pick_games').insert({
        hunt_id: hunt.id, status: 'open',
        opened_at: new Date().toISOString(),
        closes_at: closesAt, duration_secs: pickDuration,
        ...ptsFields
      })
    }
    await load(); setPickLoading(false); setShowConfig(false)
  }

  const deletePick = async () => {
    if (!pickGame) return
    if (!confirm('Eliminar este Pick & Win e todos os picks? Os participantes recebem o custo de volta (se ainda não houve prémios). Irreversível.')) return
    setDeleting(true)
    const rf = await refundAndDeleteEntries('picks', pickGame.id)
    if (!rf.ok) { alert(`Refund falhou (${rf.error}). Nada mais foi eliminado - tenta de novo.`); setDeleting(false); return }
    alert(refundNote(rf))
    await supabaseDash.from('pick_games').delete().eq('id', pickGame.id)
    setPickGame(null); setPicks([]); setDeleting(false); setPanelReady(true)
  }

  const closePick = async () => {
    if (!pickGame) return
    setPickLoading(true)
    await supabaseDash.from('pick_games').update({ status: 'closed' }).eq('id', pickGame.id)
    await load(); setPickLoading(false)
  }

  const awardPoints = async () => {
    if (!pickGame || !entries.length || !picks.length) return
    setAwarding(true); setAwardMsg(null)

    const opened = entries.filter(e => e.opened && e.payment != null && parseFloat(e.bet) > 0)
    if (!opened.length) { setAwardMsg({ type: 'error', text: 'No opened slots yet. Open at least one slot first.' }); setAwarding(false); return }

    // Verificar pontos configurados
    if (!pickGame.points_1st && !pickGame.points_2nd && !pickGame.points_3rd) {
      setAwardMsg({ type: 'error', text: 'Points not configured. Reopen the pick to set points.' }); setAwarding(false); return
    }

    // 1º lugar — maior win €
    const byWin   = [...opened].sort((a,b) => parseFloat(b.payment) - parseFloat(a.payment))
    // 2º lugar — melhor multiplicador
    const byMulti = [...opened].sort((a,b) =>
      (parseFloat(b.payment)/parseFloat(b.bet)) - (parseFloat(a.payment)/parseFloat(a.bet))
    )

    const rank1Entry = byWin[0]
    const rank2Entry = byMulti.find(e => e.id !== rank1Entry.id) || byMulti[0]
    const rank3Entry = byWin.find(e => e.id !== rank1Entry.id && e.id !== rank2Entry?.id)

    const rankMap = [
      { entry: rank1Entry, rank: 1, pts: pickGame.points_1st || 0, label: '1st' },
      { entry: rank2Entry, rank: 2, pts: pickGame.points_2nd || 0, label: '2nd' },
      { entry: rank3Entry, rank: 3, pts: pickGame.points_3rd || 0, label: '3rd' },
    ].filter(r => r.entry && r.pts > 0)

    const results = []
    for (const { entry, rank, pts, label } of rankMap) {
      const pick = picks.find(p => p.entry_id === entry.id)
      if (!pick) {
        results.push(`${label} — no pick (slot was not chosen)`)
        continue
      }

      // Atualizar pick com rank e pontos no Supabase
      const { error: dbErr } = await supabaseDash.from('picks').update({
        rank, points_awarded: pts,
        win_amount: parseFloat(entry.payment),
        multiplier: parseFloat(entry.payment) / parseFloat(entry.bet),
        awarded_at: new Date().toISOString()
      }).eq('id', pick.id)

      if (dbErr) { results.push(`${label} ${pick.twitch_username}: DB error`); continue }

      // Dar pontos via Worker (admin autenticado)
      try {
        const res = await adminPoints(pick.twitch_username, pts)
        if (res.ok) {
          results.push(`${label} ${pick.twitch_username} +${pts}pts — ok`)
        } else {
          results.push(`${label} ${pick.twitch_username}: worker error — ${res.data?.error || res.status}`)
        }
      } catch (e) {
        results.push(`${label} ${pick.twitch_username}: connection error — ${e.message}`)
      }
    }

    // Marcar jogo como finished
    await supabaseDash.from('pick_games').update({ status: 'finished' }).eq('id', pickGame.id)
    await load()
    const hasError = results.some(r => r.includes('erro') || r.includes('falha') || r.includes('sem pick'))
    setAwardMsg({
      type: hasError ? 'warn' : 'success',
      text: results.join(' · ')
    })
    setAwarding(false)
  }

  const isOpen     = pickGame?.status === 'open'
  const isClosed   = pickGame?.status === 'closed'
  const isFinished = pickGame?.status === 'finished'
  const picked     = picks.length
  const total      = entries.length

  return (
    <div className={styles.pickPanel}>
      <div className={styles.pickPanelTitle}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
        Pick & Win
      </div>

      {/* Erro de DB — tabela não existe */}
      {dbError && (
        <div className={styles.pickMsg} style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', color:'#f87171', fontSize:10 }}>
          Tabela não encontrada. Corre o SQL no Supabase primeiro.<br/>
          <span style={{opacity:.6}}>{dbError}</span>
        </div>
      )}

      {/* Estado */}
      <div className={styles.pickStatusRow}>
        <div className={`${styles.pickBadge} ${isOpen ? styles.pickBadgeOpen : isFinished ? styles.pickBadgeDone : styles.pickBadgeClosed}`}>
          <div className={styles.pickBadgeDot} />
          {isOpen ? 'OPEN' : isFinished ? 'FINISHED' : isClosed ? 'CLOSED' : 'IDLE'}
        </div>
        <span className={styles.pickCounter}>{picked}/{total}</span>
      </div>

      {/* Config duração + pontos */}
      {showConfig && (
        <div className={styles.pickConfigWrap}>
          <div className={styles.pickConfigLabel}>Duração</div>
          <div className={styles.pickDurRow}>
            {[60,120,180,300].map(s => (
              <button key={s}
                className={`${styles.pickDurBtn} ${pickDuration===s ? styles.pickDurActive:''}`}
                onClick={() => setPickDuration(s)}>
                {s<60?`${s}s`:`${s/60}m`}
              </button>
            ))}
          </div>
          <div className={styles.pickConfigLabel} style={{marginTop:6}}>Pontos por lugar</div>
          <div className={styles.pickPtsRow}>
            <div className={styles.pickPtsField}>
              <span className={styles.pickPtsLabel}><svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='#fbbf24' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'><path d='M6 9H4a2 2 0 0 1-2-2V5h4'/><path d='M18 9h2a2 2 0 0 0 2-2V5h-4'/><path d='M12 17v4'/><path d='M8 21h8'/><path d='M6 9a6 6 0 0 0 12 0V3H6v6z'/></svg> 1st</span>
              <input className={styles.pickPtsInput} type="number" min="0" step="50"
                value={pts1} onChange={e => setPts1(Number(e.target.value))} />
            </div>
            <div className={styles.pickPtsField}>
              <span className={styles.pickPtsLabel}><svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='#94a3b8' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'><path d='M6 9H4a2 2 0 0 1-2-2V5h4'/><path d='M18 9h2a2 2 0 0 0 2-2V5h-4'/><path d='M12 17v4'/><path d='M8 21h8'/><path d='M6 9a6 6 0 0 0 12 0V3H6v6z'/></svg> 2nd</span>
              <input className={styles.pickPtsInput} type="number" min="0" step="50"
                value={pts2} onChange={e => setPts2(Number(e.target.value))} />
            </div>
            <div className={styles.pickPtsField}>
              <span className={styles.pickPtsLabel}><svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='#cd7c54' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'><path d='M6 9H4a2 2 0 0 1-2-2V5h4'/><path d='M18 9h2a2 2 0 0 0 2-2V5h-4'/><path d='M12 17v4'/><path d='M8 21h8'/><path d='M6 9a6 6 0 0 0 12 0V3H6v6z'/></svg> 3rd</span>
              <input className={styles.pickPtsInput} type="number" min="0" step="50"
                value={pts3} onChange={e => setPts3(Number(e.target.value))} />
            </div>
          </div>
          <div className={styles.pickConfigBtns}>
            <button className={styles.pickBtnGreen} onClick={openPick} disabled={pickLoading}>
              {pickLoading ? '...' : 'Confirm'}
            </button>
            <button className={styles.pickBtnGhost} onClick={() => setShowConfig(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Botões de ação */}
      {!showConfig && (
        <div className={styles.pickActionRow}>
          {(!pickGame || isClosed || isFinished) && (
            <button className={styles.pickBtnGreen} onClick={() => setShowConfig(true)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Open Pick
            </button>
          )}
          {isOpen && (
            <button className={styles.pickBtnRed} onClick={closePick} disabled={pickLoading}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
              {pickLoading ? '...' : 'Close Pick'}
            </button>
          )}
          {isClosed && (
            <button className={styles.pickBtnAmber} onClick={() => setShowAwardPreview(true)} disabled={awarding}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              Award Points
            </button>
          )}
          {pickGame && (
            <button className={styles.pickBtnDelete} onClick={deletePick} disabled={deleting} title="Eliminar pick">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              {deleting ? '...' : ''}
            </button>
          )}
        </div>
      )}

      {/* Picks lista */}
      {/* Live Ranking — mostra à medida que os payments entram */}
      {picks.length > 0 && (() => {
        // Calcular ranking atual com base nas entries abertas
        const openedEntries = entries.filter(e => e.opened && e.payment != null && parseBet(e.bet) > 0)
        const ranked = picks.map(p => {
          const entry = entries.find(e => e.id === p.entry_id)
          const opened = entry ? openedEntries.find(e => e.id === entry.id) : null
          const payment = opened ? parseBet(opened.payment) : null
          const bet     = opened ? parseBet(opened.bet) : null
          const multi   = payment && bet ? payment / bet : null
          return { p, entry, payment, bet, multi, opened: !!opened }
        })

        // Ordenar por win € (abertos primeiro, depois por valor)
        const byWin   = [...ranked].filter(r => r.payment != null).sort((a,b) => b.payment - a.payment)
        const byMulti = [...ranked].filter(r => r.multi != null).sort((a,b) => b.multi - a.multi)

        // Atribuir posições virtuais
        const rank1 = byWin[0]
        const rank2 = byMulti.find(r => r.p.id !== rank1?.p.id) || byMulti[0]
        const rank3 = byWin.find(r => r.p.id !== rank1?.p.id && r.p.id !== rank2?.p.id)

        const rankIds = {
          [rank1?.p.id]: { pos: 1, reason: 'Biggest Win' },
          [rank2?.p.id]: { pos: 2, reason: 'Best Multi' },
          [rank3?.p.id]: { pos: 3, reason: 'Top 3' },
        }

        const hasAnyOpen = openedEntries.length > 0

        return (
          <div className={styles.liveRanking}>
            <div className={styles.liveRankingTitle}>
              {hasAnyOpen
                ? <><span className={styles.liveRankingDot} />Live Ranking</>
                : <>Picks registered</>}
            </div>
            {ranked.map(({ p, entry, payment, bet, multi, opened: isOpen }) => {
              const rk = rankIds[p.id]
              return (
                <div key={p.id} className={`${styles.liveRow} ${rk ? styles.liveRowRanked : ''} ${!isOpen && hasAnyOpen ? styles.liveRowPending : ''}`}>
                  <div className={styles.liveRowLeft}>
                    {rk
                      ? <span className={styles.liveRowMedal}>
                        <svg width='12' height='12' viewBox='0 0 24 24' fill='none'
                          stroke={rk.pos===1?'#fbbf24':rk.pos===2?'#94a3b8':'#cd7c54'}
                          strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
                          <path d='M6 9H4a2 2 0 0 1-2-2V5h4'/><path d='M18 9h2a2 2 0 0 0 2-2V5h-4'/>
                          <path d='M12 17v4'/><path d='M8 21h8'/>
                          <path d='M6 9a6 6 0 0 0 12 0V3H6v6z'/>
                        </svg>
                      </span>
                      : <span className={styles.liveRowDash}>—</span>}
                    {entry?.slot?.image_url && (
                      <img src={entry.slot.image_url} alt="" className={styles.liveRowImg}
                        onError={e => e.target.style.opacity='.2'} />
                    )}
                    <div className={styles.liveRowInfo}>
                      <div className={styles.liveRowUser}>{p.twitch_username}</div>
                      <div className={styles.liveRowSlot}>{entry?.slot?.name || '—'}</div>
                    </div>
                  </div>
                  <div className={styles.liveRowRight}>
                    {payment != null ? (
                      <>
                        <span className={styles.liveRowMulti}>{multi?.toFixed(1)}×</span>
                        <span className={styles.liveRowWin}>€{payment.toFixed(2)}</span>
                      </>
                    ) : (
                      <span className={styles.liveRowWait}>waiting</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Points collected */}
      {picks.length > 0 && (
        <div className={styles.pickCollected}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
          <span>{picks.length} × {100} pts collected = <strong>{picks.length * 100} pts</strong></span>
          {(isFinished || isClosed) && pickGame && (
            <span className={styles.pickCollectedNet}>
              · distributing {(pickGame.points_1st||0) + (pickGame.points_2nd||0) + (pickGame.points_3rd||0)} pts
            </span>
          )}
        </div>
      )}

      {awardMsg && (
        <div className={`${styles.pickMsg} ${awardMsg.type === 'error' ? styles.pickMsgError : awardMsg.type === 'warn' ? styles.pickMsgWarn : styles.pickMsgOk}`}>
          {awardMsg.text}
        </div>
      )}

      {/* Award preview modal */}
      {showAwardPreview && (() => {
        const opened = entries.filter(e => e.opened && e.payment != null && parseBet(e.bet) > 0)
        if (!opened.length) return (
          <div className={styles.awardModalBackdrop} onClick={() => setShowAwardPreview(false)}>
            <div className={styles.awardModal}>
              <div className={styles.awardModalTitle}>Award Points</div>
              <div className={styles.awardModalError}>No opened slots yet. Open at least one slot first.</div>
              <button className={styles.pickBtnGhost} onClick={() => setShowAwardPreview(false)}>Close</button>
            </div>
          </div>
        )

        const byWin   = [...opened].sort((a,b) => parseBet(b.payment) - parseBet(a.payment))
        const byMulti = [...opened].sort((a,b) => (parseBet(b.payment)/parseBet(b.bet)) - (parseBet(a.payment)/parseBet(a.bet)))
        const r1 = byWin[0]
        const r2 = byMulti.find(e => e.id !== r1.id) || byMulti[0]
        const r3 = byWin.find(e => e.id !== r1?.id && e.id !== r2?.id)

        const preview = [
          { entry: r1, rank: 1, pts: pickGame?.points_1st || 0, label: '1st', color: '#fbbf24', reason: 'Biggest Win' },
          { entry: r2, rank: 2, pts: pickGame?.points_2nd || 0, label: '2nd', color: '#94a3b8', reason: 'Best Multi' },
          { entry: r3, rank: 3, pts: pickGame?.points_3rd || 0, label: '3rd', color: '#cd7c54', reason: 'Top 3' },
        ].filter(r => r.entry)

        return (
          <div className={styles.awardModalBackdrop} onClick={e => { if (e.target === e.currentTarget) setShowAwardPreview(false) }}>
            <div className={styles.awardModal}>
              <div className={styles.awardModalTitle}>Confirm Award</div>
              <p className={styles.awardModalSub}>Review before sending points. This cannot be undone.</p>

              <div className={styles.awardModalRows}>
                {preview.map(({ entry, pts, label, color, reason }) => {
                  const pick = picks.find(p => p.entry_id === entry.id)
                  const multi = parseBet(entry.payment) / parseBet(entry.bet)
                  return (
                    <div key={entry.id} className={styles.awardModalRow}>
                      <div className={styles.awardModalRowLeft}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
                          <path d="M12 17v4"/><path d="M8 21h8"/>
                          <path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/>
                        </svg>
                        <div className={styles.awardModalRowInfo}>
                          <div className={styles.awardModalSlot}>{entry.slot?.name || '—'}</div>
                          <div className={styles.awardModalReason}>{reason} · {multi.toFixed(1)}x · €{parseBet(entry.payment).toFixed(2)}</div>
                        </div>
                      </div>
                      <div className={styles.awardModalRowRight}>
                        {pick
                          ? <><span className={styles.awardModalUser}>{pick.twitch_username}</span><span className={styles.awardModalPts}>+{pts} pts</span></>
                          : <span className={styles.awardModalNoPick}>no pick</span>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className={styles.awardModalActions}>
                <button className={styles.pickBtnGhost} onClick={() => setShowAwardPreview(false)} disabled={awarding}>
                  Cancel
                </button>
                <button className={styles.pickBtnAmber} onClick={async () => { setShowAwardPreview(false); await awardPoints() }} disabled={awarding}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {awarding ? 'Awarding...' : 'Confirm & Award'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function StatsPanel({ hunt, entries, mode, balanceEnd, onBalanceEndChange, onSaveBalanceEnd, saving }) {
  const opened   = entries.filter(e => e.opened && e.payment != null && parseBet(e.bet) > 0)
  const totalBet = entries.reduce((a, e) => a + parseBet(e.bet), 0)
  const totalPay = opened.reduce((a, e) => a + parseBet(e.payment), 0)
  const unopened = entries.filter(e => !e.opened && parseBet(e.bet) > 0)
  const sumUnop  = unopened.reduce((a, e) => a + parseBet(e.bet), 0)
  const avg      = opened.length > 0
    ? opened.reduce((a, e) => a + parseBet(e.payment) / parseBet(e.bet), 0) / opened.length : 0
  const balStart  = parseBet(hunt?.balance_start)
  const balEndN   = parseFloat(balanceEnd)
  const hasBalEnd = !isNaN(balEndN)
  const target    = hasBalEnd ? Math.max(0, balStart - balEndN) : balStart
  const beInit    = totalBet > 0 ? target / totalBet : 0
  const rem       = target - totalPay
  const beAtual   = sumUnop > 0 ? rem / sumUnop : 0
  const profit    = hasBalEnd ? balEndN + totalPay - balStart : totalPay - balStart
  const nOpen     = opened.length
  const total     = entries.length
  const pct       = total > 0 ? Math.round(nOpen / total * 100) : 0

  const sorted = [...opened].sort((a, b) =>
    (parseBet(b.payment) / parseBet(b.bet)) - (parseBet(a.payment) / parseBet(a.bet))
  )
  const best  = sorted[0] || null
  const worst = sorted[sorted.length - 1] || null

  const Stat = ({ label, val, cls, strong }) => (
    <div className={`${styles.hxStat} ${strong ? styles.hxStatStrong : ''}`}>
      <span>{label}</span><b className={cls || ''}>{val}</b>
    </div>
  )
  const BW = ({ kind, e }) => (
    <div className={styles.hxStat}>
      <span className={kind === 'best' ? styles.amber : styles.red}>{kind === 'best' ? 'Best' : 'Worst'}</span>
      <div className={styles.hxBW}>
        <img src={e.slot?.image_url || ''} alt="" onError={ev => ev.target.style.opacity = '.2'} />
        <div>
          <div className={styles.hxBWName}>{e.slot?.name || '—'}</div>
          <div className={styles.hxBWSub}>{fmt(parseBet(e.bet))}€ → {fmt(parseBet(e.payment))}€</div>
        </div>
      </div>
    </div>
  )

  if (mode === 'hunting') {
    return (
      <div className={styles.hxSide}>
        <div className={styles.hxGrid}>
          <Stat label="Saldo inicial" val={balStart > 0 ? fmt(balStart) + '€' : '—'} />
          <Stat label="Total apostado" val={fmt(totalBet) + '€'} />
          <Stat label="BE inicial" val={beInit > 0 ? beInit.toFixed(2) + 'x' : '—'} cls={styles.amber} />
          <Stat label="Slots" val={total} />
        </div>
        <div className={`${styles.hxStat} ${styles.hxBal}`}>
          <span>Saldo final</span>
          <div className={styles.hxBalRow}>
            <input className={styles.hxInput} type="number" step="0.01" min="0"
              value={balanceEnd} onChange={e => onBalanceEndChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSaveBalanceEnd()} placeholder="0.00" />
            <button className={styles.hxSave} onClick={onSaveBalanceEnd} disabled={saving}>{saving ? 'A guardar…' : 'Guardar'}</button>
          </div>
          <small>Saldo depois de comprar todos os bónus. Define o target do opening.</small>
        </div>
        <Stat label="Target do opening" val={target > 0 ? fmt(target) + '€' : '—'} cls={styles.amber} />
      </div>
    )
  }

  return (
    <div className={styles.hxSide}>
      <div className={`${styles.hxStat} ${styles.hxProfit}`}>
        <span>Profit</span>
        <b className={profit >= 0 ? styles.green : styles.red}>{(profit >= 0 ? '+' : '') + fmt(profit) + '€'}</b>
        <div className={styles.hxProg}>
          <div><span>Progresso</span><span><strong>{nOpen}</strong> / {total}</span></div>
          <i><u style={{ width: pct + '%' }} /></i>
        </div>
      </div>
      <div className={styles.hxGrid}>
        <Stat label="Total pago" val={fmt(totalPay) + '€'} cls={styles.green} />
        <Stat label="AVG multi" val={avg > 0 ? avg.toFixed(2) + 'x' : '—'} />
        <Stat label="Saldo final" val={hasBalEnd ? fmt(balEndN) + '€' : '—'} />
        <Stat label="BE inicial" val={beInit > 0 ? beInit.toFixed(2) + 'x' : '—'} cls={styles.amber} />
        <Stat label="BE atual" val={beAtual > 0 ? beAtual.toFixed(2) + 'x' : '—'} cls={styles.amber} strong />
      </div>
      {(best || worst) && (
        <div className={styles.hxGrid}>
          {best && <BW kind="best" e={best} />}
          {worst && worst.id !== best?.id && <BW kind="worst" e={worst} />}
        </div>
      )}
    </div>
  )
}

// ── Slot Row ───────────────────────────────────────────────
function SlotRow({ entry, index, mode, current, onUpdateBet, onUpdatePayment, onToggleSuper, onDelete }) {
  const bet = parseBet(entry.bet)
  const multi = bet > 0 && entry.payment != null && entry.opened ? parseBet(entry.payment) / bet : null
  const won = multi !== null && multi >= 1
  const mc = multi === null ? '' : multi >= 100 ? styles.hxMGold : multi >= 1 ? styles.hxMGreen : styles.hxMRed

  return (
    <div className={`${styles.hxRow} ${won ? styles.hxRowWin : ''} ${current ? styles.hxRowCur : ''} ${mode === 'opening' && !entry.opened && !current ? styles.hxRowWait : ''}`}>
      {current && <span className={styles.hxCurTag}><i />A abrir</span>}
      <div className={styles.hxSlot}>
        <span className={styles.hxIdx}>#{index}</span>
        <img src={entry.slot?.image_url || ''} alt="" className={styles.hxCover} onError={e => e.target.style.opacity = '.2'} />
        <div className={styles.hxNameWrap}>
          <div className={styles.hxName}>{entry.slot?.name || '—'}</div>
          <div className={styles.hxProv}>{entry.slot?.provider || ''}</div>
        </div>
      </div>

      {mode === 'hunting' ? (
        <input className={styles.hxFld} type="number" step="0.01" min="0"
          defaultValue={entry.bet !== null ? entry.bet : ''} placeholder="0.00"
          onBlur={e => onUpdateBet(entry.id, e.target.value)}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
      ) : (
        <span className={`${styles.hxBet} ${!entry.bet ? styles.hxDim : ''}`}>{entry.bet ? fmt(bet) + '€' : '—'}</span>
      )}

      <button
        className={`${styles.hxSuper} ${entry.is_super ? styles.hxSuperOn : ''}`}
        aria-label="Super"
        disabled={mode !== 'hunting'}
        onClick={() => mode === 'hunting' && onToggleSuper(entry.id, !entry.is_super)}
      ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z"/></svg></button>

      <input
        className={`${styles.hxFld} ${mode === 'hunting' ? styles.hxFldLock : ''} ${current ? styles.hxFldCur : ''}`}
        type="number" step="0.01" min="0" disabled={mode === 'hunting'}
        defaultValue={entry.payment !== null ? entry.payment : ''} placeholder={mode === 'hunting' ? '—' : '0.00'}
        onBlur={e => mode === 'opening' && onUpdatePayment(entry.id, e.target.value)}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()} />

      <div className={`${styles.hxMulti} ${mc}`}>{multi !== null ? multi.toFixed(1) + 'x' : '—'}</div>

      {mode === 'hunting' ? (
        <button className={styles.hxDel} aria-label="Remover" onClick={() => onDelete(entry.id)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      ) : <span />}
    </div>
  )
}


// ── GTB Panel ───────────────────────────────────────────────
function GtbPanel({ hunt }) {
  const [game,         setGame]         = useState(null)
  const [entries,      setEntries]      = useState([])
  const [loading,      setLoading]      = useState(false)
  const [showConfig,   setShowConfig]   = useState(false)
  const [awarding,     setAwarding]     = useState(false)
  const [awardMsg,     setAwardMsg]     = useState(null)
  const [deleting,     setDeleting]     = useState(false)
  const [showPreview,  setShowPreview]  = useState(false)
  const [panelReady,   setPanelReady]   = useState(false)
  const [dbError,      setDbError]      = useState(null)
  // config fields
  const [duration,     setDuration]     = useState(180)
  const [pts1,         setPts1]         = useState(500)
  const [pts2,         setPts2]         = useState(300)
  const [pts3,         setPts3]         = useState(100)
  const [cashPrize,    setCashPrize]    = useState(0)
  const [targetBal,    setTargetBal]    = useState('')
  // award
  const [actualBal,    setActualBal]    = useState('')


  const load = useCallback(async () => {
    if (!hunt?.id) { setPanelReady(true); return }
    setDbError(null)
    try {
      const { data, error } = await supabaseDash
        .from('gtb_games').select('*')
        .eq('hunt_id', hunt.id)
        .order('created_at', { ascending: false }).limit(1)
      if (error) { setDbError(error.message); setPanelReady(true); return }
      const g = data?.[0] || null
      setGame(g)
      if (g) {
        const { data: es } = await supabaseDash.from('gtb_entries').select('*').eq('game_id', g.id).order('created_at', { ascending: true })
        setEntries(es || [])
      } else {
        setEntries([])
      }
    } catch(e) {
      setDbError(e.message)
    } finally {
      setPanelReady(true)
    }
  }, [hunt?.id])

  useEffect(() => { load() }, [load])

  // Auto-close when closes_at expires
  useEffect(() => {
    if (!game || game.status !== 'open' || !game.closes_at) return
    const remaining = new Date(game.closes_at) - Date.now()
    if (remaining <= 0) {
      supabaseDash.from('gtb_games').update({ status: 'closed' }).eq('id', game.id).then(() => load())
      return
    }
    const t = setTimeout(async () => {
      await supabaseDash.from('gtb_games').update({ status: 'closed' }).eq('id', game.id)
      await load()
    }, remaining)
    return () => clearTimeout(t)
  }, [game?.id, game?.status, game?.closes_at, load])

  // Realtime
  useEffect(() => {
    if (!game) return
    const ch = supabaseDash.channel(`dash-gtb-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gtb_entries', filter: `game_id=eq.${game.id}` }, () => {
        supabaseDash.from('gtb_entries').select('*').eq('game_id', game.id)
          .order('created_at', { ascending: true })
          .then(({ data }) => setEntries(data || []))
      })
      .subscribe()
    return () => ch.unsubscribe()
  }, [game])

  const openGame = async () => {
    setLoading(true)
    const closesAt = new Date(Date.now() + duration * 1000).toISOString()
    const fields = {
      status: 'open', closes_at: closesAt, duration_secs: duration,
      points_1st: pts1, points_2nd: pts2, points_3rd: pts3,
      prize_cash_1st: parseFloat(cashPrize) || 0,
      target_balance: parseFloat(targetBal) || null,
    }
    if (game) {
      await supabaseDash.from('gtb_games').update(fields).eq('id', game.id)
    } else {
      await supabaseDash.from('gtb_games').insert({ hunt_id: hunt.id, ...fields })
    }
    await load(); setLoading(false); setShowConfig(false)
  }

  const closeGame = async () => {
    if (!game) return
    setLoading(true)
    await supabaseDash.from('gtb_games').update({ status: 'closed' }).eq('id', game.id)
    await load(); setLoading(false)
  }

  const deleteGame = async () => {
    if (!game) return
    if (!confirm('Delete this GTB game and all entries? Participants get their entry cost refunded (if not awarded yet). Irreversible.')) return
    setDeleting(true)
    const rf = await refundAndDeleteEntries('gtb_entries', game.id)
    if (!rf.ok) { alert(`Refund failed (${rf.error}). Nothing else was deleted - try again.`); setDeleting(false); return }
    alert(refundNote(rf))
    await supabaseDash.from('gtb_games').delete().eq('id', game.id)
    setGame(null); setEntries([]); setDeleting(false); setPanelReady(true)
  }

  const awardPoints = async () => {
    if (!game || !entries.length) return
    const bal = parseFloat(actualBal)
    if (!bal || bal <= 0) { setAwardMsg({ type: 'error', text: 'Enter the actual final balance first.' }); return }
    setAwarding(true); setAwardMsg(null)

    // Sort by closest guess
    const ranked = [...entries]
      .map(e => ({ ...e, gap: Math.abs(parseFloat(e.guess) - bal) }))
      .sort((a, b) => a.gap - b.gap)

    const toAward = [
      { entry: ranked[0], rank: 1, pts: game.points_1st || 0, cash: game.prize_cash_1st || 0 },
      { entry: ranked[1], rank: 2, pts: game.points_2nd || 0, cash: 0 },
      { entry: ranked[2], rank: 3, pts: game.points_3rd || 0, cash: 0 },
    ].filter(r => r.entry)

    const results = []
    for (const { entry, rank, pts, cash } of toAward) {
      // Update entry
      await supabaseDash.from('gtb_entries').update({
        rank, points_awarded: pts, gap: Math.abs(parseFloat(entry.guess) - bal), awarded_at: new Date().toISOString()
      }).eq('id', entry.id)

      // Give points
      if (pts > 0) {
        try {
          const res = await adminPoints(entry.twitch_username, pts)
          const cashStr = cash > 0 ? ` + €${cash} cash` : ''
          results.push(res.ok ? `${entry.twitch_username} +${pts}pts${cashStr} — ok` : `${entry.twitch_username}: worker error`)
        } catch { results.push(`${entry.twitch_username}: connection error`) }
      }
    }

    // Save actual balance + finish
    await supabaseDash.from('gtb_games').update({ status: 'finished', target_balance: bal }).eq('id', game.id)
    await load()
    setAwardMsg({ type: 'success', text: results.join(' · ') })
    setAwarding(false); setShowPreview(false)
  }

  const isOpen     = game?.status === 'open'
  const isClosed   = game?.status === 'closed'
  const isFinished = game?.status === 'finished'

  // Preview ranking based on actualBal
  const previewBal = parseFloat(actualBal)
  const previewRanked = !isNaN(previewBal) && previewBal > 0
    ? [...entries].map(e => ({ ...e, gap: Math.abs(parseFloat(e.guess) - previewBal) })).sort((a, b) => a.gap - b.gap)
    : []

  return (
    <div className={styles.pickPanel}>

      {dbError && (
        <div className={styles.pickMsg} style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', color:'#f87171', fontSize:10 }}>
          Table not found. Run the SQL migration first.<br/><span style={{opacity:.6}}>{dbError}</span>
        </div>
      )}

      {/* Status row */}
      <div className={styles.pickStatusRow}>
        <div className={`${styles.pickBadge} ${isOpen ? styles.pickBadgeOpen : isFinished ? styles.pickBadgeDone : styles.pickBadgeClosed}`}>
          <div className={styles.pickBadgeDot} />
          {isOpen ? 'OPEN' : isFinished ? 'FINISHED' : isClosed ? 'CLOSED' : 'IDLE'}
        </div>
        <span className={styles.pickCounter}>{entries.length} entries</span>
      </div>

      {/* Config */}
      {showConfig && (
        <div className={styles.pickConfigWrap}>
          <div className={styles.pickConfigLabel}>Duration</div>
          <div className={styles.pickDurRow}>
            {[60,120,180,300].map(s => (
              <button key={s} className={`${styles.pickDurBtn} ${duration===s ? styles.pickDurActive:''}`} onClick={() => setDuration(s)}>
                {s<60?`${s}s`:`${s/60}m`}
              </button>
            ))}
          </div>

          <div className={styles.pickConfigLabel} style={{marginTop:6}}>Points per place</div>
          <div className={styles.pickPtsRow}>
            {[
              { label: '1st', color: '#fbbf24', val: pts1, set: setPts1 },
              { label: '2nd', color: '#94a3b8', val: pts2, set: setPts2 },
              { label: '3rd', color: '#cd7c54', val: pts3, set: setPts3 },
            ].map(({ label, color, val, set }) => (
              <div key={label} className={styles.pickPtsField}>
                <span className={styles.pickPtsLabel}>
                  <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke={color} strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
                    <path d='M6 9H4a2 2 0 0 1-2-2V5h4'/><path d='M18 9h2a2 2 0 0 0 2-2V5h-4'/>
                    <path d='M12 17v4'/><path d='M8 21h8'/>
                    <path d='M6 9a6 6 0 0 0 12 0V3H6v6z'/>
                  </svg>
                  {label}
                </span>
                <input className={styles.pickPtsInput} type='number' min='0' step='50' value={val} onChange={e => set(Number(e.target.value))} />
              </div>
            ))}
          </div>

          <div className={styles.pickConfigLabel} style={{marginTop:6}}>Cash prize 1st (€)</div>
          <input
            className={styles.pickPtsInput}
            style={{width:'100%', marginBottom:4}}
            type='number' min='0' step='5'
            placeholder='0'
            value={cashPrize}
            onChange={e => setCashPrize(e.target.value)}
          />

          <div className={styles.pickConfigLabel} style={{marginTop:6}}>Target balance hint (€) <span style={{opacity:.5, fontWeight:400}}>optional</span></div>
          <input
            className={styles.pickPtsInput}
            style={{width:'100%', marginBottom:4}}
            type='number' min='0' step='0.01'
            placeholder='leave blank to hide'
            value={targetBal}
            onChange={e => setTargetBal(e.target.value)}
          />

          <div className={styles.pickConfigBtns}>
            <button className={styles.pickBtnGreen} onClick={openGame} disabled={loading}>
              {loading ? '...' : 'Confirm'}
            </button>
            <button className={styles.pickBtnGhost} onClick={() => setShowConfig(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!showConfig && (
        <div className={styles.pickActionRow}>
          {(!game || isClosed || isFinished) && (
            <button className={styles.pickBtnGreen} onClick={() => setShowConfig(true)}>
              <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polygon points='5 3 19 12 5 21 5 3'/></svg>
              Open GTB
            </button>
          )}
          {isOpen && (
            <button className={styles.pickBtnRed} onClick={closeGame} disabled={loading}>
              <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><rect x='3' y='3' width='18' height='18' rx='2'/></svg>
              {loading ? '...' : 'Close GTB'}
            </button>
          )}
          {isClosed && (
            <button className={styles.pickBtnAmber} onClick={() => setShowPreview(true)} disabled={awarding}>
              <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='20 6 9 17 4 12'/></svg>
              Award Points
            </button>
          )}
          {game && (
            <button className={styles.pickBtnDelete} onClick={deleteGame} disabled={deleting} title='Delete GTB'>
              <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='3 6 5 6 21 6'/><path d='M19 6l-1 14H6L5 6'/><path d='M10 11v6M14 11v6'/><path d='M9 6V4h6v2'/></svg>
              {deleting ? '...' : ''}
            </button>
          )}
        </div>
      )}

      {/* Prize pool info */}
      {game && (
        <div className={styles.pickCollected}>
          <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'/></svg>
          <span>{entries.length} × 100 pts = <strong>{entries.length * 100} pts</strong></span>
          {game.prize_cash_1st > 0 && <span className={styles.pickCollectedNet}> · €{game.prize_cash_1st} cash for 1st</span>}
        </div>
      )}

      {/* Entries list */}
      {entries.length > 0 && (
        <div className={styles.liveRanking}>
          <div className={styles.liveRankingTitle}>
            <span className={styles.liveRankingDot} />
            Guesses
          </div>
          {entries.map((e, i) => {
            const rk = e.rank
            const rankColors = ['#fbbf24', '#94a3b8', '#cd7c54']
            return (
              <div key={e.id} className={`${styles.liveRow} ${rk ? styles.liveRowRanked : ''}`}>
                <div className={styles.liveRowLeft}>
                  {rk ? (
                    <span className={styles.liveRowMedal}>
                      <svg width='12' height='12' viewBox='0 0 24 24' fill='none'
                        stroke={rankColors[(rk-1)] || '#cd7c54'}
                        strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
                        <path d='M6 9H4a2 2 0 0 1-2-2V5h4'/><path d='M18 9h2a2 2 0 0 0 2-2V5h-4'/>
                        <path d='M12 17v4'/><path d='M8 21h8'/>
                        <path d='M6 9a6 6 0 0 0 12 0V3H6v6z'/>
                      </svg>
                    </span>
                  ) : (
                    <span className={styles.liveRowDash}>#{i+1}</span>
                  )}
                  <div className={styles.liveRowInfo}>
                    <div className={styles.liveRowUser}>{e.twitch_username}</div>
                  </div>
                </div>
                <div className={styles.liveRowRight}>
                  <span className={styles.liveRowMulti}>€{parseBet(e.guess).toFixed(2)}</span>
                  {e.gap != null && <span className={styles.liveRowWin}>±€{parseBet(e.gap).toFixed(2)}</span>}
                  {rk === 1 && game?.prize_cash_1st > 0 && <span style={{fontSize:10,color:'#21d16e',fontWeight:800}}>+€{game.prize_cash_1st}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {awardMsg && (
        <div className={`${styles.pickMsg} ${awardMsg.type === 'error' ? styles.pickMsgError : styles.pickMsgOk}`}>
          {awardMsg.text}
        </div>
      )}

      {/* Award preview modal */}
      {showPreview && (
        <div className={styles.awardModalBackdrop} onClick={e => { if (e.target === e.currentTarget) setShowPreview(false) }}>
          <div className={styles.awardModal}>
            <div className={styles.awardModalTitle}>Award GTB</div>
            <p className={styles.awardModalSub}>Enter the actual final balance to calculate winners.</p>

            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
              <span style={{fontSize:12, color:'rgba(232,238,252,.45)', flexShrink:0}}>Actual balance €</span>
              <input
                className={styles.pickPtsInput}
                style={{flex:1}}
                type='number' min='0' step='0.01'
                placeholder='e.g. 1450.00'
                value={actualBal}
                onChange={e => setActualBal(e.target.value)}
                autoFocus
              />
            </div>

            {previewRanked.length > 0 && (
              <div className={styles.awardModalRows}>
                {previewRanked.slice(0, 3).map((e, i) => {
                  const pts = [game.points_1st, game.points_2nd, game.points_3rd][i] || 0
                  const cash = i === 0 ? (game.prize_cash_1st || 0) : 0
                  const colors = ['#fbbf24', '#94a3b8', '#cd7c54']
                  return (
                    <div key={e.id} className={styles.awardModalRow}>
                      <div className={styles.awardModalRowLeft}>
                        <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke={colors[i]} strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
                          <path d='M6 9H4a2 2 0 0 1-2-2V5h4'/><path d='M18 9h2a2 2 0 0 0 2-2V5h-4'/>
                          <path d='M12 17v4'/><path d='M8 21h8'/>
                          <path d='M6 9a6 6 0 0 0 12 0V3H6v6z'/>
                        </svg>
                        <div className={styles.awardModalRowInfo}>
                          <div className={styles.awardModalSlot}>{e.twitch_username}</div>
                          <div className={styles.awardModalReason}>Guess €{parseBet(e.guess).toFixed(2)} · gap ±€{e.gap.toFixed(2)}</div>
                        </div>
                      </div>
                      <div className={styles.awardModalRowRight}>
                        <span className={styles.awardModalPts}>+{pts} pts</span>
                        {cash > 0 && <span style={{fontSize:11, color:'#21d16e', fontWeight:800}}>+€{cash} cash</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className={styles.awardModalActions}>
              <button className={styles.pickBtnGhost} onClick={() => setShowPreview(false)} disabled={awarding}>Cancel</button>
              <button className={styles.pickBtnAmber}
                onClick={awardPoints}
                disabled={awarding || !previewBal || previewBal <= 0}>
                <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='20 6 9 17 4 12'/></svg>
                {awarding ? 'Awarding...' : 'Confirm & Award'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ── Avg Multi Panel ──────────────────────────────────────────────────────────
function AvgMultiPanel({ hunt, entries: huntEntries }) {
  const [game,        setGame]        = useState(null)
  const [entries,     setEntries]     = useState([])
  const [loading,     setLoading]     = useState(false)
  const [showConfig,  setShowConfig]  = useState(false)
  const [awarding,    setAwarding]    = useState(false)
  const [awardMsg,    setAwardMsg]    = useState(null)
  const [deleting,    setDeleting]    = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [panelReady,  setPanelReady]  = useState(false)
  const [dbError,     setDbError]     = useState(null)
  const [duration,    setDuration]    = useState(180)
  const [pts1,        setPts1]        = useState(500)
  const [pts2,        setPts2]        = useState(300)
  const [pts3,        setPts3]        = useState(100)
  const [actualAvg,   setActualAvg]   = useState('')


  const load = useCallback(async () => {
    if (!hunt?.id) { setPanelReady(true); return }
    setDbError(null)
    try {
      const { data, error } = await supabaseDash
        .from('avg_multi_games').select('*')
        .eq('hunt_id', hunt.id)
        .order('created_at', { ascending: false }).limit(1)
      if (error) { setDbError(error.message); setPanelReady(true); return }
      const g = data?.[0] || null
      setGame(g)
      if (g) {
        const { data: es } = await supabaseDash.from('avg_multi_entries').select('*').eq('game_id', g.id).order('created_at', { ascending: true })
        setEntries(es || [])
      } else { setEntries([]) }
    } catch(e) {
      setDbError(e.message)
    } finally {
      setPanelReady(true)
    }
  }, [hunt?.id])

  useEffect(() => { load() }, [load])

  // Auto-close when closes_at expires
  useEffect(() => {
    if (!game || game.status !== 'open' || !game.closes_at) return
    const remaining = new Date(game.closes_at) - Date.now()
    if (remaining <= 0) {
      supabaseDash.from('avg_multi_games').update({ status: 'closed' }).eq('id', game.id).then(() => load())
      return
    }
    const t = setTimeout(async () => {
      await supabaseDash.from('avg_multi_games').update({ status: 'closed' }).eq('id', game.id)
      await load()
    }, remaining)
    return () => clearTimeout(t)
  }, [game?.id, game?.status, game?.closes_at, load])

  useEffect(() => {
    if (!game) return
    const ch = supabaseDash.channel(`dash-avg-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avg_multi_entries', filter: `game_id=eq.${game.id}` }, () => {
        supabaseDash.from('avg_multi_entries').select('*').eq('game_id', game.id)
          .order('created_at', { ascending: true })
          .then(({ data }) => setEntries(data || []))
      }).subscribe()
    return () => ch.unsubscribe()
  }, [game])

  const openGame = async () => {
    setLoading(true)
    const closesAt = new Date(Date.now() + duration * 1000).toISOString()
    const fields = { status: 'open', closes_at: closesAt, duration_secs: duration, points_1st: pts1, points_2nd: pts2, points_3rd: pts3 }
    if (game) {
      await supabaseDash.from('avg_multi_games').update(fields).eq('id', game.id)
    } else {
      await supabaseDash.from('avg_multi_games').insert({ hunt_id: hunt.id, ...fields })
    }
    await load(); setLoading(false); setShowConfig(false)
  }

  const closeGame = async () => {
    if (!game) return
    setLoading(true)
    await supabaseDash.from('avg_multi_games').update({ status: 'closed' }).eq('id', game.id)
    await load(); setLoading(false)
  }

  const deleteGame = async () => {
    if (!game) return
    if (!confirm('Delete this Avg Multi game and all entries? Participants get their entry cost refunded (if not awarded yet). Irreversible.')) return
    setDeleting(true)
    const rf = await refundAndDeleteEntries('avg_multi_entries', game.id)
    if (!rf.ok) { alert(`Refund failed (${rf.error}). Nothing else was deleted - try again.`); setDeleting(false); return }
    alert(refundNote(rf))
    await supabaseDash.from('avg_multi_games').delete().eq('id', game.id)
    setGame(null); setEntries([]); setDeleting(false); setPanelReady(true)
  }

  // Calculate avg multi from hunt entries
  const calcAvgFromEntries = () => {
    const opened = (huntEntries || []).filter(e => e.opened && e.payment != null && parseBet(e.bet) > 0)
    if (!opened.length) return null
    const avg = opened.reduce((s, e) => s + parseBet(e.payment) / parseBet(e.bet), 0) / opened.length
    return Math.round(avg * 10) / 10
  }

  const awardPoints = async () => {
    if (!game || !entries.length) return
    const avg = parseFloat(actualAvg)
    if (!avg || avg <= 0) { setAwardMsg({ type: 'error', text: 'Enter the actual avg multi first.' }); return }
    setAwarding(true); setAwardMsg(null)

    const ranked = [...entries]
      .map(e => ({ ...e, gap: Math.abs(parseBet(e.guess) - avg) }))
      .sort((a, b) => a.gap - b.gap)

    const toAward = [
      { entry: ranked[0], rank: 1, pts: game.points_1st || 0 },
      { entry: ranked[1], rank: 2, pts: game.points_2nd || 0 },
      { entry: ranked[2], rank: 3, pts: game.points_3rd || 0 },
    ].filter(r => r.entry)

    const results = []
    for (const { entry, rank, pts } of toAward) {
      await supabaseDash.from('avg_multi_entries').update({
        rank, points_awarded: pts, gap: Math.abs(parseBet(entry.guess) - avg), awarded_at: new Date().toISOString()
      }).eq('id', entry.id)
      if (pts > 0) {
        try {
          const res = await adminPoints(entry.twitch_username, pts)
          results.push(res.ok ? `${entry.twitch_username} +${pts}pts — ok` : `${entry.twitch_username}: worker error`)
        } catch { results.push(`${entry.twitch_username}: connection error`) }
      }
    }

    await supabaseDash.from('avg_multi_games').update({ status: 'finished', result_avg: avg }).eq('id', game.id)
    await load()
    setAwardMsg({ type: 'success', text: results.join(' · ') })
    setAwarding(false); setShowPreview(false)
  }

  const isOpen     = game?.status === 'open'
  const isClosed   = game?.status === 'closed'
  const isFinished = game?.status === 'finished'

  const previewAvg    = parseFloat(actualAvg)
  const previewRanked = !isNaN(previewAvg) && previewAvg > 0
    ? [...entries].map(e => ({ ...e, gap: Math.abs(parseBet(e.guess) - previewAvg) })).sort((a, b) => a.gap - b.gap)
    : []

  const calcedAvg = calcAvgFromEntries()

  // Bucket stats
  const bucketCounts = {}
  for (const e of entries) {
    const key = e.bucket || '—'
    bucketCounts[key] = (bucketCounts[key] || 0) + 1
  }

  return (
    <div className={styles.pickPanel}>

      {dbError && (
        <div className={styles.pickMsg} style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', color:'#f87171', fontSize:10 }}>
          Table not found. Run the SQL migration first.<br/><span style={{opacity:.6}}>{dbError}</span>
        </div>
      )}

      <div className={styles.pickStatusRow}>
        <div className={`${styles.pickBadge} ${isOpen ? styles.pickBadgeOpen : isFinished ? styles.pickBadgeDone : styles.pickBadgeClosed}`}>
          <div className={styles.pickBadgeDot} />
          {isOpen ? 'OPEN' : isFinished ? 'FINISHED' : isClosed ? 'CLOSED' : 'IDLE'}
        </div>
        <span className={styles.pickCounter}>{entries.length} entries</span>
        {calcedAvg && isOpen && (
          <span style={{fontSize:10, color:'rgba(232,238,252,.3)', marginLeft:'auto'}}>
            current avg: {calcedAvg}x
          </span>
        )}
      </div>

      {showConfig && (
        <div className={styles.pickConfigWrap}>
          <div className={styles.pickConfigLabel}>Duration</div>
          <div className={styles.pickDurRow}>
            {[60,120,180,300].map(s => (
              <button key={s} className={`${styles.pickDurBtn} ${duration===s?styles.pickDurActive:''}`} onClick={() => setDuration(s)}>
                {s<60?`${s}s`:`${s/60}m`}
              </button>
            ))}
          </div>
          <div className={styles.pickConfigLabel} style={{marginTop:6}}>Points per place</div>
          <div className={styles.pickPtsRow}>
            {[
              { label: '1st', color: '#fbbf24', val: pts1, set: setPts1 },
              { label: '2nd', color: '#94a3b8', val: pts2, set: setPts2 },
              { label: '3rd', color: '#cd7c54', val: pts3, set: setPts3 },
            ].map(({ label, color, val, set }) => (
              <div key={label} className={styles.pickPtsField}>
                <span className={styles.pickPtsLabel}>
                  <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke={color} strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
                    <path d='M6 9H4a2 2 0 0 1-2-2V5h4'/><path d='M18 9h2a2 2 0 0 0 2-2V5h-4'/>
                    <path d='M12 17v4'/><path d='M8 21h8'/>
                    <path d='M6 9a6 6 0 0 0 12 0V3H6v6z'/>
                  </svg>
                  {label}
                </span>
                <input className={styles.pickPtsInput} type='number' min='0' step='50' value={val} onChange={e => set(Number(e.target.value))} />
              </div>
            ))}
          </div>
          <div className={styles.pickConfigBtns}>
            <button className={styles.pickBtnGreen} onClick={openGame} disabled={loading}>{loading ? '...' : 'Confirm'}</button>
            <button className={styles.pickBtnGhost} onClick={() => setShowConfig(false)}>Cancel</button>
          </div>
        </div>
      )}

      {!showConfig && (
        <div className={styles.pickActionRow}>
          {(!game || isClosed || isFinished) && (
            <button className={styles.pickBtnGreen} onClick={() => setShowConfig(true)}>
              <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polygon points='5 3 19 12 5 21 5 3'/></svg>
              Open Avg Multi
            </button>
          )}
          {isOpen && (
            <button className={styles.pickBtnRed} onClick={closeGame} disabled={loading}>
              <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><rect x='3' y='3' width='18' height='18' rx='2'/></svg>
              {loading ? '...' : 'Close'}
            </button>
          )}
          {isClosed && (
            <button className={styles.pickBtnAmber} onClick={() => setShowPreview(true)} disabled={awarding}>
              <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='20 6 9 17 4 12'/></svg>
              Award Points
            </button>
          )}
          {game && (
            <button className={styles.pickBtnDelete} onClick={deleteGame} disabled={deleting} title='Delete'>
              <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='3 6 5 6 21 6'/><path d='M19 6l-1 14H6L5 6'/><path d='M10 11v6M14 11v6'/><path d='M9 6V4h6v2'/></svg>
            </button>
          )}
        </div>
      )}

      {entries.length > 0 && (
        <div className={styles.pickCollected}>
          <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'/></svg>
          <span>{entries.length} × 100 pts = <strong>{entries.length * 100} pts</strong></span>
          {isFinished && game?.result_avg && <span className={styles.pickCollectedNet}> · result: {game.result_avg}x</span>}
        </div>
      )}

      {/* Bucket breakdown */}
      {entries.length > 0 && (
        <div className={styles.avgBuckets}>
          {AVG_BUCKETS.map(b => {
            const count = bucketCounts[b.id] || 0
            const pct   = entries.length > 0 ? Math.round((count / entries.length) * 100) : 0
            return (
              <div key={b.id} className={styles.avgBucket} style={{'--bcolor': b.color}}>
                <div className={styles.avgBucketLabel}>{b.label}</div>
                <div className={styles.avgBucketBar}>
                  <div className={styles.avgBucketFill} style={{width:`${pct}%`}} />
                </div>
                <div className={styles.avgBucketCount}>{count}</div>
              </div>
            )
          })}
        </div>
      )}

      {entries.length > 0 && (
        <div className={styles.liveRanking}>
          <div className={styles.liveRankingTitle}>
            <span className={styles.liveRankingDot} />
            Entries
          </div>
          {entries.map((e, i) => {
            const rk = e.rank
            const rankColors = ['#fbbf24','#94a3b8','#cd7c54']
            return (
              <div key={e.id} className={`${styles.liveRow} ${rk ? styles.liveRowRanked : ''}`}>
                <div className={styles.liveRowLeft}>
                  {rk ? (
                    <span className={styles.liveRowMedal}>
                      <svg width='12' height='12' viewBox='0 0 24 24' fill='none'
                        stroke={rankColors[(rk-1)] || '#cd7c54'} strokeWidth='2.2'
                        strokeLinecap='round' strokeLinejoin='round'>
                        <path d='M6 9H4a2 2 0 0 1-2-2V5h4'/><path d='M18 9h2a2 2 0 0 0 2-2V5h-4'/>
                        <path d='M12 17v4'/><path d='M8 21h8'/>
                        <path d='M6 9a6 6 0 0 0 12 0V3H6v6z'/>
                      </svg>
                    </span>
                  ) : (
                    <span className={styles.liveRowDash}>#{i+1}</span>
                  )}
                  <div className={styles.liveRowInfo}>
                    <div className={styles.liveRowUser}>{e.twitch_username}</div>
                    {e.bucket && <div style={{fontSize:9, color:'rgba(232,238,252,.3)'}}>{e.bucket}: {AVG_BUCKETS.find(b=>b.id===e.bucket)?.label}</div>}
                  </div>
                </div>
                <div className={styles.liveRowRight}>
                  <span className={styles.liveRowMulti}>{parseBet(e.guess).toFixed(1)}x</span>
                  {e.gap != null && <span className={styles.liveRowWin}>±{e.gap.toFixed(1)}x</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {awardMsg && (
        <div className={`${styles.pickMsg} ${awardMsg.type==='error'?styles.pickMsgError:styles.pickMsgOk}`}>
          {awardMsg.text}
        </div>
      )}

      {showPreview && (
        <div className={styles.awardModalBackdrop} onClick={e => { if (e.target===e.currentTarget) setShowPreview(false) }}>
          <div className={styles.awardModal}>
            <div className={styles.awardModalTitle}>Award Avg Multi</div>
            <p className={styles.awardModalSub}>Enter the actual average multiplier.</p>

            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <span style={{fontSize:12,color:'rgba(232,238,252,.45)',flexShrink:0}}>Actual avg</span>
              <input
                className={styles.pickPtsInput}
                style={{flex:1}}
                type='number' min='0' step='0.1'
                placeholder={calcedAvg ? `calculated: ${calcedAvg}x` : 'e.g. 125.5'}
                value={actualAvg}
                onChange={e => setActualAvg(e.target.value)}
                autoFocus
              />
              <span style={{fontSize:12,color:'rgba(232,238,252,.3)',flexShrink:0}}>x</span>
              {calcedAvg && !actualAvg && (
                <button
                  className={styles.pickBtnGhost}
                  style={{padding:'4px 10px',fontSize:11}}
                  onClick={() => setActualAvg(String(calcedAvg))}
                >
                  Use {calcedAvg}x
                </button>
              )}
            </div>

            {previewRanked.length > 0 && (
              <div className={styles.awardModalRows}>
                {previewRanked.slice(0,3).map((e,i) => {
                  const pts = [game.points_1st,game.points_2nd,game.points_3rd][i]||0
                  const colors = ['#fbbf24','#94a3b8','#cd7c54']
                  return (
                    <div key={e.id} className={styles.awardModalRow}>
                      <div className={styles.awardModalRowLeft}>
                        <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke={colors[i]} strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
                          <path d='M6 9H4a2 2 0 0 1-2-2V5h4'/><path d='M18 9h2a2 2 0 0 0 2-2V5h-4'/>
                          <path d='M12 17v4'/><path d='M8 21h8'/>
                          <path d='M6 9a6 6 0 0 0 12 0V3H6v6z'/>
                        </svg>
                        <div className={styles.awardModalRowInfo}>
                          <div className={styles.awardModalSlot}>{e.twitch_username}</div>
                          <div className={styles.awardModalReason}>Guess {parseBet(e.guess).toFixed(1)}x · gap ±{e.gap.toFixed(1)}x</div>
                        </div>
                      </div>
                      <div className={styles.awardModalRowRight}>
                        <span className={styles.awardModalPts}>+{pts} pts</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className={styles.awardModalActions}>
              <button className={styles.pickBtnGhost} onClick={() => setShowPreview(false)} disabled={awarding}>Cancel</button>
              <button className={styles.pickBtnAmber} onClick={awardPoints} disabled={awarding || !previewAvg || previewAvg<=0}>
                <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='20 6 9 17 4 12'/></svg>
                {awarding ? 'Awarding...' : 'Confirm & Award'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Mini-Games Modal ───────────────────────────────────────


function MiniGamesModal({ hunt, entries, onClose }) {
  return (
    <div className={styles.mgOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.mgModal}>
        {/* Header */}
        <div className={styles.mgHeader}>
          <div className={styles.mgHeaderLeft}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
            <span className={styles.mgTitle}>Mini-Games</span>
            {hunt && <span className={styles.mgHuntBadge}>{hunt.title || `Bonus Hunt #${hunt.id}`}</span>}
          </div>
          <button className={styles.mgClose} onClick={onClose}><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/></svg></button>
        </div>

        {/* Três painéis lado a lado */}
        <div className={styles.mgBody}>
          {/* Pick & Win */}
          <div className={styles.mgCol}>
            <div className={styles.mgColHeader}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
              Pick & Win
            </div>
            <div className={styles.mgColContent}>
              <PickPanel hunt={hunt} entries={entries} />
            </div>
          </div>

          <div className={styles.mgDivider} />

          {/* Guess the Balance */}
          <div className={styles.mgCol}>
            <div className={styles.mgColHeader}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Guess the Balance
            </div>
            <div className={styles.mgColContent}>
              <GtbPanel hunt={hunt} />
            </div>
          </div>

          <div className={styles.mgDivider} />

          {/* Avg Multi */}
          <div className={styles.mgCol}>
            <div className={styles.mgColHeader}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
              </svg>
              Avg Multi
            </div>
            <div className={styles.mgColContent}>
              <AvgMultiPanel hunt={hunt} entries={entries} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────
export default function DashHunt() {
  const navigate = useNavigate()
  const [hunt,          setHunt]          = useState(null)
  const [entries,       setEntries]       = useState([])
  const [allSlots,      setAllSlots]      = useState([])
  const [mode,          setMode]          = useState('hunting')
  const [view,          setView]          = useState('main')
  const [search,        setSearch]        = useState('')
  const [searchRes,     setSearchRes]     = useState([])
  const [balanceEnd,    setBalanceEnd]    = useState('')
  const [savingBal,     setSavingBal]     = useState(false)
  const [newHuntOpen,   setNewHuntOpen]   = useState(false)
  const [addSlot,       setAddSlot]       = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [miniGamesOpen, setMiniGamesOpen] = useState(false)

  // Load all slots
  useEffect(() => {
    const fetch = async () => {
      let all = [], from = 0
      while (true) {
        const { data } = await supabaseDash.from('slots').select('*').order('name').range(from, from+999)
        if (!data?.length) break
        all = [...all, ...data]
        if (data.length < 1000) break
        from += 1000
      }
      setAllSlots(all)
    }
    fetch()
  }, [])

  // Load active hunt
  const loadActiveHunt = useCallback(async () => {
    const { data } = await supabaseDash.from('bonus_hunts').select('*').eq('active', true).limit(1).single()
    if (!data) { setHunt(null); setEntries([]); setLoading(false); return }
    setHunt(data)
    setMode(data.mode || 'hunting')
    if (data.balance_end != null) setBalanceEnd(String(data.balance_end))
    const { data: ents } = await supabaseDash
      .from('bonus_entries').select('*, slot:slots(*)').eq('hunt_id', data.id).order('created_at', { ascending: true })
    setEntries(ents || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadActiveHunt() }, [loadActiveHunt])

  // Realtime
  useEffect(() => {
    const ch = supabaseDash.channel('dashhunt-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_entries' }, async () => {
        if (!hunt?.id) return
        const { data } = await supabaseDash
          .from('bonus_entries').select('*, slot:slots(*)').eq('hunt_id', hunt.id).order('created_at', { ascending: true })
        setEntries(data || [])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_hunts' }, loadActiveHunt)
      .subscribe()
    return () => ch.unsubscribe()
  }, [hunt?.id, loadActiveHunt])

  // Search
  useEffect(() => {
    if (!search.trim()) { setSearchRes([]); return }
    const t = search.toLowerCase()
    const addedIds = new Set(entries.map(e => e.slot_id))
    setSearchRes(
      allSlots
        .filter(s => !addedIds.has(s.id) && (s.name.toLowerCase().includes(t) || (s.provider||'').toLowerCase().includes(t)))
        .sort((a, b) => {
          const ap = (a.provider||'').toLowerCase().startsWith(t)
          const bp = (b.provider||'').toLowerCase().startsWith(t)
          return ap && !bp ? -1 : !ap && bp ? 1 : 0
        })
        .slice(0, 12)
    )
  }, [search, allSlots, entries])

  const handleSetMode = async (m) => {
    setMode(m)
    if (hunt?.id) await supabaseDash.from('bonus_hunts').update({ mode: m }).eq('id', hunt.id)
  }

  const handleMarkActive = async () => {
    if (!hunt?.id) return
    await supabaseDash.from('bonus_hunts').update({ active: false }).neq('id', hunt.id)
    await supabaseDash.from('bonus_hunts').update({ active: true }).eq('id', hunt.id)
  }

  const handleAddSlot = async (slot, bet, isSuper) => {
    if (!hunt?.id) return
    const { data } = await supabaseDash
      .from('bonus_entries')
      .insert([{ hunt_id: hunt.id, slot_id: slot.id, bet, payment: null, is_super: isSuper, opened: false, game_type: 'bonus_hunt' }])
      .select('*, slot:slots(*)').single()
    if (data) setEntries(prev => [...prev, data])
    setSearch('')
  }

  const handleUpdateBet = async (id, val) => {
    const bet = val !== '' ? parseFloat(val) : null
    await supabaseDash.from('bonus_entries').update({ bet }).eq('id', id)
    setEntries(prev => prev.map(e => e.id === id ? { ...e, bet } : e))
  }

  const handleUpdatePayment = async (id, val) => {
    const payment = val !== '' ? parseFloat(val) : null
    const opened  = payment !== null && payment > 0
    const paid_at = opened ? new Date().toISOString() : null
    await supabaseDash.from('bonus_entries').update({ payment, opened, paid_at }).eq('id', id)
    setEntries(prev => prev.map(e => e.id === id ? { ...e, payment, opened, paid_at } : e))
  }

  const handleToggleSuper = async (id, val) => {
    await supabaseDash.from('bonus_entries').update({ is_super: val }).eq('id', id)
    setEntries(prev => prev.map(e => e.id === id ? { ...e, is_super: val } : e))
  }

  const handleDelete = async (id) => {
    if (!confirm('Remover esta slot do hunt?')) return
    await supabaseDash.from('bonus_entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const handleSaveBalanceEnd = async () => {
    if (!hunt?.id) return
    const val = parseFloat(balanceEnd)
    if (isNaN(val)) return
    setSavingBal(true)
    await supabaseDash.from('bonus_hunts').update({ balance_end: val }).eq('id', hunt.id)
    setSavingBal(false)
  }

  const handleReorderByBet = async () => {
    if (!entries.length) return
    const sorted = [...entries].sort((a, b) => {
      const ba = parseBet(a.bet), bb = parseBet(b.bet)
      if (ba !== bb) return ba - bb
      if (a.is_super !== b.is_super) return a.is_super ? 1 : -1
      return 0
    })
    const base = new Date('2020-01-01').getTime()
    await Promise.all(sorted.map((e, i) =>
      supabaseDash.from('bonus_entries').update({ created_at: new Date(base + i * 1000).toISOString() }).eq('id', e.id)
    ))
    setEntries(sorted)
  }

  const handleHuntCreated = (newHunt) => {
    setNewHuntOpen(false)
    setHunt(newHunt)
    setMode('hunting')
    setEntries([])
    setBalanceEnd('')
  }

  const handleReopen = async (h) => {
    await supabaseDash.from('bonus_hunts').update({ active: false }).neq('id', h.id)
    await supabaseDash.from('bonus_hunts').update({ active: true }).eq('id', h.id)
    setView('main')
    await loadActiveHunt()
  }

  const nextEntry = entries.find(e => !e.opened) || null

  if (view === 'history') return <HistoryView onBack={() => setView('main')} onReopen={handleReopen} />

  return (
    <div className={`${styles.page} ${styles.hxPage}`}>
      <div className={styles.hxHead}>
        <div>
          <div className={styles.hxTitleRow}>
            <h1>Bonus Hunt {hunt ? `#${hunt.id}` : ''}</h1>
            {hunt?.active && <span className={styles.hxLive}><i />Ativo</span>}
          </div>
          <p>{mode === 'hunting'
            ? 'Regista a aposta de cada slot antes de começar a abrir.'
            : nextEntry ? `Regista o pagamento de cada bónus por ordem. Vai a seguir: ${nextEntry.slot?.name || '—'}.` : 'Todos os bónus foram abertos.'}</p>
        </div>
        <div className={styles.hxActions}>
          <div className={styles.hxSeg}>
            <button className={mode === 'hunting' ? styles.hxSegOn : ''} onClick={() => handleSetMode('hunting')}><i />Hunting</button>
            <button className={mode === 'opening' ? `${styles.hxSegOn} ${styles.hxSegOpen}` : ''} onClick={() => handleSetMode('opening')}><i />Opening</button>
          </div>
          {hunt && <>
            <button className={styles.hxGhost} onClick={handleReorderByBet}>Ordenar por bet</button>
            <button className={styles.hxGhost} onClick={() => setMiniGamesOpen(true)}>Mini-games</button>
          </>}
          <button className={styles.hxGhost} onClick={() => setView('history')}>Histórico</button>
          <button className={styles.hxPrimary} onClick={() => setNewHuntOpen(true)}>Novo hunt</button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /> A carregar...</div>
      ) : !hunt ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>Nenhum Bonus Hunt ativo</div>
          <div className={styles.emptySub}>Cria um novo hunt para começar</div>
          <button className={styles.hxPrimary} style={{ marginTop: 16 }} onClick={() => setNewHuntOpen(true)}>Novo hunt</button>
        </div>
      ) : (
        <div className={styles.hxLayout}>
          <div className={styles.hxMain}>
            {mode === 'hunting' && (
              <div className={styles.hxSearch}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Adicionar slot…" autoComplete="off" />
                {search && <button onClick={() => setSearch('')} aria-label="Limpar"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>}
                {searchRes.length > 0 && (
                  <ul className={styles.hxResults}>
                    {searchRes.map(slot => (
                      <li key={slot.id} onClick={() => { setAddSlot(slot); setSearch('') }}>
                        <img src={slot.image_url || ''} alt="" onError={e => e.target.style.opacity = '.2'} />
                        <div><b>{slot.name}</b>{slot.provider && <small>{slot.provider}</small>}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className={styles.hxTh}>
              <span>Slot</span><span>Bet</span><span>Super</span><span>Pagamento</span><span>Multi</span><span />
            </div>

            <div className={styles.hxList}>
              {entries.length === 0
                ? <p className={styles.hxEmpty}>Pesquisa uma slot acima para adicionar</p>
                : entries.map((e, i) => (
                    <SlotRow key={e.id} entry={e} index={i + 1} mode={mode} current={mode === 'opening' && nextEntry?.id === e.id}
                      onUpdateBet={handleUpdateBet} onUpdatePayment={handleUpdatePayment}
                      onToggleSuper={handleToggleSuper} onDelete={handleDelete} />
                  ))}
            </div>
          </div>

          <StatsPanel hunt={hunt} entries={entries} mode={mode} balanceEnd={balanceEnd}
            onBalanceEndChange={setBalanceEnd} onSaveBalanceEnd={handleSaveBalanceEnd} saving={savingBal} />
        </div>
      )}

      {newHuntOpen    && <NewHuntModal onClose={() => setNewHuntOpen(false)} onCreated={handleHuntCreated} />}
      {addSlot        && <AddSlotModal slot={addSlot} onClose={() => setAddSlot(null)} onAdd={handleAddSlot} />}
      {miniGamesOpen  && <MiniGamesModal hunt={hunt} entries={entries} onClose={() => setMiniGamesOpen(false)} />}
    </div>
  )
}