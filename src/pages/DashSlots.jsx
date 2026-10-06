import { useState, useEffect, useCallback, useRef } from 'react'
import { supabaseDash } from '../lib/supabase'
import styles from './Dashslots.module.css'

const PAGE_SIZE = 30

const SORT_OPTIONS = [
  { value: 'name',      label: 'Nome A–Z' },
  { value: 'name-desc', label: 'Nome Z–A' },
  { value: 'rtp',       label: 'RTP ↑' },
  { value: 'max_win',   label: 'Max Win ↑' },
]

const VOL_FILTERS = [
  { value: 'all',    label: 'Todos' },
  { value: 'Alta',   label: 'Alta' },
  { value: 'Média',  label: 'Média' },
  { value: 'Baixa',  label: 'Baixa' },
]

// ── Slot Modal ─────────────────────────────────────────────
function SlotModal({ slot, onClose, onSaved }) {
  const isEdit = !!slot?.id
  const [form,    setForm]    = useState({
    name:       slot?.name       || '',
    provider:   slot?.provider   || '',
    volatility: slot?.volatility || '',
    rtp:        slot?.rtp        || '',
    max_win:    slot?.max_win    || '',
    image_url:  slot?.image_url  || '',
  })
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [saving,  setSaving]  = useState(false)
  const nameRef = useRef(null)

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 50) }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim() || !form.provider.trim()) {
      setError('Nome e Provider são obrigatórios.'); return
    }
    setSaving(true); setError('')
    const payload = {
      name:       form.name.trim(),
      provider:   form.provider.trim(),
      volatility: form.volatility.trim() || null,
      rtp:        form.rtp     ? parseFloat(form.rtp)      : null,
      max_win:    form.max_win ? parseInt(form.max_win, 10) : null,
      image_url:  form.image_url.trim() || null,
    }
    const q = isEdit
      ? supabaseDash.from('slots').update(payload).eq('id', slot.id)
      : supabaseDash.from('slots').insert([payload])
    const { error: err } = await q
    setSaving(false)
    if (err) { setError('Erro: ' + err.message); return }
    setSuccess(isEdit ? 'Slot atualizada!' : 'Slot adicionada!')
    setTimeout(() => { onSaved(); onClose() }, 600)
  }

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <button className={styles.modalClose} onClick={onClose}>✕</button>
        <div className={styles.modalTitle}>{isEdit ? 'Editar Slot' : 'Adicionar Slot'}</div>

        {error   && <div className={styles.modalError}>{error}</div>}
        {success && <div className={styles.modalSuccess}>{success}</div>}

        <div className={styles.formGrid}>
          <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
            <label className={styles.formLabel}>Nome *</label>
            <input ref={nameRef} className={styles.formInput} value={form.name}
              onChange={e => set('name', e.target.value)} placeholder="Sweet Bonanza 1000" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Provider *</label>
            <input className={styles.formInput} value={form.provider}
              onChange={e => set('provider', e.target.value)} placeholder="Pragmatic Play" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Volatilidade</label>
            <select className={styles.formInput} value={form.volatility} onChange={e => set('volatility', e.target.value)}>
              <option value="">—</option>
              <option value="Alta">Alta</option>
              <option value="Média">Média</option>
              <option value="Baixa">Baixa</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>RTP (%)</label>
            <input className={styles.formInput} type="number" value={form.rtp}
              onChange={e => set('rtp', e.target.value)} placeholder="96.5" step="0.1" min="80" max="100" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Max Win (x)</label>
            <input className={styles.formInput} type="number" value={form.max_win}
              onChange={e => set('max_win', e.target.value)} placeholder="5000" min="0" />
          </div>
          <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
            <label className={styles.formLabel}>URL da Imagem</label>
            <input className={styles.formInput} value={form.image_url}
              onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
            {form.image_url && (
              <img src={form.image_url} alt="preview" className={styles.imgPreview}
                onError={e => e.target.style.display='none'}
                onLoad={e => e.target.style.display='block'} />
            )}
          </div>
        </div>

        <button className={styles.modalBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'A guardar...' : isEdit ? 'Guardar Alterações' : 'Adicionar Slot'}
        </button>
      </div>
    </div>
  )
}

// ── Delete Confirm ─────────────────────────────────────────
function DeleteModal({ slot, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    await supabaseDash.from('slots').delete().eq('id', slot.id)
    setLoading(false)
    onDeleted()
    onClose()
  }

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} style={{ maxWidth: 360 }}>
        <div className={styles.modalTitle}>Apagar slot?</div>
        <p className={styles.deleteMsg}>
          Tens a certeza que queres apagar <strong>"{slot.name}"</strong>? Esta ação é irreversível.
        </p>
        <div className={styles.deleteActions}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.dangerBtn} onClick={handleDelete} disabled={loading}>
            {loading ? 'A apagar...' : 'Apagar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Slot Card ──────────────────────────────────────────────
function SlotCard({ slot, onEdit, onDelete }) {
  const [imgError, setImgError] = useState(false)
  const initials = (slot.name || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
  const vol = (slot.volatility || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const volCls = vol === 'alta' ? styles.volAlta : vol.includes('dia') ? styles.volMedia : vol === 'baixa' ? styles.volBaixa : ''

  return (
    <div className={styles.slotCard}>
      {slot.image_url && !imgError
        ? <img src={slot.image_url} alt={slot.name} className={styles.slotCardImg} onError={() => setImgError(true)} />
        : <div className={styles.slotCardFallback}>{initials}</div>
      }
      <div className={styles.slotCardInfo}>
        <div className={styles.slotCardName}>{slot.name}</div>
        <div className={styles.slotCardProv}>{slot.provider || '—'}</div>
        <div className={styles.slotCardTags}>
          {slot.volatility && <span className={`${styles.tag} ${volCls}`}>{slot.volatility}</span>}
          {slot.rtp        && <span className={`${styles.tag} ${styles.tagRtp}`}>RTP {parseFloat(slot.rtp).toFixed(1)}%</span>}
          {slot.max_win    && <span className={`${styles.tag} ${styles.tagMaxwin}`}>{slot.max_win}x</span>}
        </div>
      </div>
      <div className={styles.slotCardActions}>
        <button className={`${styles.actionBtn} ${styles.actionBtnEdit}`} onClick={() => onEdit(slot)} title="Editar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <button className={`${styles.actionBtn} ${styles.actionBtnDel}`} onClick={() => onDelete(slot)} title="Apagar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>
    </div>
  )
}

// ── Provider Dropdown ──────────────────────────────────────
function ProviderDropdown({ providers, selected, onChange }) {
  const [open,        setOpen]        = useState(false)
  const [provSearch,  setProvSearch]  = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = providers.filter(p => p.name.toLowerCase().includes(provSearch.toLowerCase()))
  const count = selected.size

  const toggle = (name) => {
    const next = new Set(selected)
    next.has(name) ? next.delete(name) : next.add(name)
    onChange(next)
  }

  return (
    <div className={styles.provWrap} ref={ref}>
      <button
        className={`${styles.provBtn} ${open ? styles.provBtnOpen : ''} ${count > 0 ? styles.provBtnActive : ''}`}
        onClick={() => { setOpen(v => !v); if (!open) setTimeout(() => ref.current?.querySelector('input')?.focus(), 40) }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" stroke="currentColor" strokeWidth="2"/></svg>
        Providers
        {count > 0 && <span className={styles.provBadge}>{count}</span>}
        <svg className={`${styles.provChevron} ${open ? styles.provChevronOpen : ''}`} width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
      </button>

      {open && (
        <div className={styles.provPanel}>
          <div className={styles.provPanelTop}>
            <span className={styles.provPanelTitle}>Providers</span>
            {count > 0 && <button className={styles.provClear} onClick={() => { onChange(new Set()); }}>Limpar</button>}
          </div>
          <div className={styles.provSearch}>
            <input value={provSearch} onChange={e => setProvSearch(e.target.value)} placeholder="Filtrar..." className={styles.provSearchInput} />
          </div>
          <div className={styles.provList}>
            {filtered.length === 0
              ? <div className={styles.provEmpty}>Sem resultados</div>
              : filtered.map(p => (
                <label key={p.name} className={styles.provItem}>
                  <input type="checkbox" checked={selected.has(p.name)} onChange={() => toggle(p.name)} style={{ display: 'none' }} />
                  <span className={`${styles.provCheck} ${selected.has(p.name) ? styles.provCheckOn : ''}`}>
                    {selected.has(p.name) && <svg width="9" height="7" viewBox="0 0 10 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4L3.5 6.5L9 1"/></svg>}
                  </span>
                  <span className={styles.provName}>{p.name}</span>
                  <span className={styles.provCount}>{p.count}</span>
                </label>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────
export default function DashSlots() {
  const [slots,     setSlots]     = useState([])
  const [providers, setProviders] = useState([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [loading,   setLoading]   = useState(false)
  const [search,    setSearch]    = useState('')
  const [volFilter, setVolFilter] = useState('all')
  const [sortBy,    setSortBy]    = useState('name')
  const [selProv,   setSelProv]   = useState(new Set())
  const [addOpen,   setAddOpen]   = useState(false)
  const [editSlot,  setEditSlot]  = useState(null)
  const [delSlot,   setDelSlot]   = useState(null)

  const searchTimer = useRef(null)
  const totalPages  = Math.ceil(total / PAGE_SIZE)

  // Load providers
  useEffect(() => {
    const fetch = async () => {
      let all = [], from = 0
      while (true) {
        const { data } = await supabaseDash.from('slots').select('provider').not('provider', 'is', null).range(from, from + 999)
        if (!data?.length) break
        all = [...all, ...data]
        if (data.length < 1000) break
        from += 1000
      }
      const counts = {}
      all.forEach(r => { if (r.provider) counts[r.provider] = (counts[r.provider] || 0) + 1 })
      setProviders(Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)))
    }
    fetch()
  }, [])

  const loadPage = useCallback(async (p) => {
    setLoading(true)
    let query = supabaseDash.from('slots').select('*', { count: 'exact' })
    if (search)           query = query.or(`name.ilike.%${search}%,provider.ilike.%${search}%`)
    if (volFilter !== 'all') query = query.ilike('volatility', volFilter)
    if (selProv.size > 0) query = query.in('provider', [...selProv])
    switch (sortBy) {
      case 'name':      query = query.order('name',    { ascending: true });  break
      case 'name-desc': query = query.order('name',    { ascending: false }); break
      case 'rtp':       query = query.order('rtp',     { ascending: false, nullsLast: true }); break
      case 'max_win':   query = query.order('max_win', { ascending: false, nullsLast: true }); break
    }
    const from = (p - 1) * PAGE_SIZE
    query = query.range(from, from + PAGE_SIZE - 1)
    const { data, count } = await query
    setSlots(data || [])
    setTotal(count || 0)
    setPage(p)
    setLoading(false)
  }, [search, volFilter, sortBy, selProv])

  useEffect(() => { loadPage(1) }, [volFilter, sortBy, selProv])

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => loadPage(1), 300)
    return () => clearTimeout(searchTimer.current)
  }, [search])

  const handleSaved = () => {
    loadPage(page)
    // Reload providers count
    supabaseDash.from('slots').select('provider').not('provider', 'is', null).then(({ data }) => {
      if (!data) return
      const counts = {}
      data.forEach(r => { if (r.provider) counts[r.provider] = (counts[r.provider] || 0) + 1 })
      setProviders(Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)))
    })
  }

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to   = Math.min((page - 1) * PAGE_SIZE + slots.length, total)
  const hasFilter = search || volFilter !== 'all' || selProv.size > 0

  // Pagination
  const getPagesToShow = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages = [1]
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            Slots
            <span className={styles.counter}>
              {hasFilter ? `${total} resultado${total !== 1 ? 's' : ''}` : total}
            </span>
          </h2>
        </div>
        <button className={styles.addBtn} onClick={() => setAddOpen(true)}>+ Adicionar Slot</button>
      </div>

      {/* Filterbar */}
      <div className={styles.filterbar}>
        <div className={styles.searchBox}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className={styles.searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar nome ou provider..." />
          {search && <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>}
        </div>

        <ProviderDropdown providers={providers} selected={selProv} onChange={v => { setSelProv(v); setPage(1) }} />

        <div className={styles.volPills}>
          {VOL_FILTERS.map(f => (
            <button
              key={f.value}
              className={`${styles.pill} ${volFilter === f.value ? styles.pillActive : ''}`}
              onClick={() => { setVolFilter(f.value); setPage(1) }}
            >{f.label}</button>
          ))}
        </div>

        <select className={styles.sortSelect} value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1) }}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Grid */}
      <div className={styles.gridWrap}>
        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /> A carregar...</div>
        ) : slots.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🎰</div>
            <div className={styles.emptyTitle}>Nenhuma slot encontrada</div>
            <div className={styles.emptySub}>Tenta outro termo de pesquisa</div>
          </div>
        ) : (
          <div className={styles.grid} style={{ opacity: loading ? .4 : 1 }}>
            {slots.map(s => (
              <SlotCard key={s.id} slot={s}
                onEdit={s => setEditSlot(s)}
                onDelete={s => setDelSlot(s)} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>{from}–{to} de {total}</span>
          <button className={styles.pgBtn} disabled={page === 1} onClick={() => loadPage(page - 1)}>←</button>
          {getPagesToShow().map((p, i) =>
            p === '...'
              ? <span key={`e${i}`} className={styles.pgEllipsis}>…</span>
              : <button key={p} className={`${styles.pgBtn} ${page === p ? styles.pgActive : ''}`} onClick={() => loadPage(p)}>{p}</button>
          )}
          <button className={styles.pgBtn} disabled={page === totalPages} onClick={() => loadPage(page + 1)}>→</button>
        </div>
      )}

      {/* Modals */}
      {addOpen   && <SlotModal slot={null}    onClose={() => setAddOpen(false)}  onSaved={handleSaved} />}
      {editSlot  && <SlotModal slot={editSlot} onClose={() => setEditSlot(null)} onSaved={handleSaved} />}
      {delSlot   && <DeleteModal slot={delSlot} onClose={() => setDelSlot(null)} onDeleted={() => loadPage(page)} />}
    </div>
  )
}