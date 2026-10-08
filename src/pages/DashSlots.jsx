import { useState, useEffect, useCallback, useRef } from 'react'
import { supabaseDash } from '../lib/supabase'
import styles from './Dashslots.module.css'

const PAGE_SIZE = 24

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

// ── Icons ──────────────────────────────────────────────────
const sv = (d, s = 14, w = 2.2) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
)
const IPlus  = sv(<path d="M12 5v14M5 12h14" />, 14, 3)
const ISearch = sv(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>, 14, 2)
const IX     = sv(<path d="M6 6l12 12M18 6 6 18" />, 13, 2.6)
const IEdit  = sv(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>, 13)
const ITrash = sv(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />, 14)
const IChev  = (open) => (
  <svg className={`${styles.chev} ${open ? styles.chevOpen : ''}`} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
)

const volKey = (v) => {
  const n = (v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return n === 'alta' ? 'dAlta' : n.includes('dia') ? 'dMedia' : n === 'baixa' ? 'dBaixa' : ''
}
const initialsOf = (name) => (name || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
const fmtMax = (n) => n ? `${n}x` : ''

// ── Slot Modal ─────────────────────────────────────────────
function SlotModal({ slot, onClose, onSaved, onDelete }) {
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
  const [imgOk,   setImgOk]   = useState(true)
  const nameRef = useRef(null)

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 50) }, [])
  useEffect(() => { setImgOk(true) }, [form.image_url])

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

  const volOpts = [
    { v: 'Alta',  c: 'dAlta' },
    { v: 'Média', c: 'dMedia' },
    { v: 'Baixa', c: 'dBaixa' },
  ]

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>{isEdit ? 'Editar slot' : 'Adicionar slot'}</div>
          <button className={styles.modalX} onClick={onClose} aria-label="Fechar">{IX}</button>
        </div>

        {error   && <div className={styles.msgErr}>{error}</div>}
        {success && <div className={styles.msgOk}>{success}</div>}

        <div className={styles.top}>
          <div className={styles.prev}>
            {form.image_url && imgOk
              ? <img src={form.image_url} alt="" onError={() => setImgOk(false)} />
              : initialsOf(form.name) === '?' ? '' : initialsOf(form.name)}
          </div>
          <div className={styles.col}>
            <label className={styles.fld}><span>Nome *</span>
              <input ref={nameRef} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Sweet Bonanza 1000" />
            </label>
            <label className={styles.fld}><span>Provider *</span>
              <input value={form.provider} onChange={e => set('provider', e.target.value)} placeholder="Pragmatic Play" />
            </label>
          </div>
        </div>

        <div className={styles.fld}><span>Volatilidade</span>
          <div className={styles.segs}>
            {volOpts.map(o => (
              <button key={o.v} type="button"
                className={`${styles.seg} ${form.volatility === o.v ? styles.segOn : ''}`}
                onClick={() => set('volatility', form.volatility === o.v ? '' : o.v)}>
                <i className={`${styles.dot} ${styles[o.c]}`} />{o.v}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.two}>
          <label className={styles.fld}><span>RTP (%)</span>
            <input type="number" value={form.rtp} onChange={e => set('rtp', e.target.value)} placeholder="96.5" step="0.1" min="80" max="100" />
          </label>
          <label className={styles.fld}><span>Max win (x)</span>
            <input type="number" value={form.max_win} onChange={e => set('max_win', e.target.value)} placeholder="5000" min="0" />
          </label>
        </div>

        <label className={styles.fld}><span>URL da imagem</span>
          <input value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
        </label>

        <div className={styles.foot}>
          {isEdit && <button type="button" className={styles.delBtn} onClick={() => onDelete(slot)}>{ITrash}Apagar</button>}
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'A guardar…' : isEdit ? 'Guardar alterações' : 'Adicionar slot'}
          </button>
        </div>
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
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} style={{ width: 400 }}>
        <div className={styles.modalTitle}>Apagar slot?</div>
        <p className={styles.deleteMsg}>
          Tens a certeza que queres apagar <strong>"{slot.name}"</strong>? Esta ação é irreversível.
        </p>
        <div className={styles.foot}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.dangerBtn} onClick={handleDelete} disabled={loading}>
            {loading ? 'A apagar…' : 'Apagar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Slot Card ──────────────────────────────────────────────
function SlotCard({ slot, onEdit, onDelete }) {
  const [imgError, setImgError] = useState(false)
  const rtp = slot.rtp ? `${parseFloat(slot.rtp).toFixed(1)}%` : ''

  return (
    <div className={styles.card}>
      <div className={styles.thumb}>
        {slot.image_url && !imgError
          ? <img src={slot.image_url} alt={slot.name} onError={() => setImgError(true)} />
          : initialsOf(slot.name)}
        <div className={styles.acts}>
          <button className={styles.ib} onClick={() => onEdit(slot)} aria-label="Editar">{IEdit}</button>
          <button className={`${styles.ib} ${styles.ibDel}`} onClick={() => onDelete(slot)} aria-label="Apagar">{ITrash}</button>
        </div>
      </div>
      <div className={styles.info}>
        <div className={styles.nm} title={slot.name}>{slot.name}</div>
        <div className={styles.pv}>{slot.provider || '—'}</div>
        <div className={styles.meta}>
          {slot.volatility && <span><i className={`${styles.dot} ${styles[volKey(slot.volatility)] || ''}`} />{slot.volatility}</span>}
          {rtp && <span className={styles.rtp}>{rtp}</span>}
          {slot.max_win && <span className={styles.mw}>{fmtMax(slot.max_win)}</span>}
        </div>
      </div>
    </div>
  )
}

// ── Provider Dropdown ──────────────────────────────────────
function ProviderDropdown({ providers, selected, onChange }) {
  const [open,       setOpen]       = useState(false)
  const [provSearch, setProvSearch] = useState('')
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
        className={`${styles.pill} ${count > 0 ? styles.pillOn : ''}`}
        onClick={() => { setOpen(v => !v); if (!open) setTimeout(() => ref.current?.querySelector('input')?.focus(), 40) }}
      >
        Providers{count > 0 && <i>{count}</i>}{IChev(open)}
      </button>

      {open && (
        <div className={styles.provPanel}>
          <div className={styles.provTop}>
            <span>Providers</span>
            {count > 0 && <button className={styles.provClear} onClick={() => onChange(new Set())}>Limpar</button>}
          </div>
          <div className={styles.provSearch}>
            <input value={provSearch} onChange={e => setProvSearch(e.target.value)} placeholder="Filtrar…" />
          </div>
          <div className={styles.provList}>
            {filtered.length === 0
              ? <div className={styles.provEmpty}>Sem resultados</div>
              : filtered.map(p => (
                <label key={p.name} className={styles.provItem}>
                  <input type="checkbox" checked={selected.has(p.name)} onChange={() => toggle(p.name)} />
                  <span className={`${styles.provCheck} ${selected.has(p.name) ? styles.provCheckOn : ''}`}>
                    {selected.has(p.name) && <svg width="9" height="7" viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4L3.5 6.5L9 1" /></svg>}
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

// ── Sort menu ──────────────────────────────────────────────
function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const cur = SORT_OPTIONS.find(o => o.value === value)
  return (
    <div className={styles.sortWrap} ref={ref}>
      <button className={styles.pill} onClick={() => setOpen(v => !v)}>{cur?.label}{IChev(open)}</button>
      {open && (
        <div className={styles.menu}>
          {SORT_OPTIONS.map(o => (
            <button key={o.value} className={o.value === value ? styles.menuOn : ''}
              onClick={() => { onChange(o.value); setOpen(false) }}>{o.label}</button>
          ))}
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
  const [grand,     setGrand]     = useState(null)
  const [noImg,     setNoImg]     = useState(null)
  const [noData,    setNoData]    = useState(null)
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

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const loadProviders = useCallback(async () => {
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
  }, [])

  const loadStats = useCallback(async () => {
    const head = { count: 'exact', head: true }
    const [a, b, c] = await Promise.all([
      supabaseDash.from('slots').select('id', head),
      supabaseDash.from('slots').select('id', head).or('image_url.is.null,image_url.eq.'),
      supabaseDash.from('slots').select('id', head).or('rtp.is.null,max_win.is.null'),
    ])
    setGrand(a.count ?? 0); setNoImg(b.count ?? 0); setNoData(c.count ?? 0)
  }, [])

  useEffect(() => { loadProviders(); loadStats() }, [loadProviders, loadStats])

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

  const handleSaved = () => { loadPage(page); loadProviders(); loadStats() }
  const handleDeleted = () => { loadPage(page); loadProviders(); loadStats() }

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to   = Math.min((page - 1) * PAGE_SIZE + slots.length, total)

  const getPagesToShow = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages = [1]
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }

  const n = (v) => v == null ? '—' : v.toLocaleString('pt-PT')

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Slots</h1>
          <p className={styles.sub}>A biblioteca usada no Bonus Hunt, nos mini-games e na página pública.</p>
        </div>
        <button className={styles.addBtn} onClick={() => setAddOpen(true)}>{IPlus}Adicionar slot</button>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}><span>Slots</span><b>{n(grand)}</b></div>
        <div className={styles.stat}><span>Providers</span><b>{providers.length || '—'}</b></div>
        <div className={styles.stat}><span>Sem imagem</span><b className={noImg > 0 ? styles.statWarn : ''}>{n(noImg)}</b></div>
        <div className={styles.stat}><span>Sem RTP / Max win</span><b>{n(noData)}</b></div>
      </div>

      <div className={styles.box}>
        <div className={styles.bar}>
          <div className={styles.search}>
            {ISearch}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar nome ou provider" />
            {search && <button className={styles.searchX} onClick={() => setSearch('')} aria-label="Limpar">{IX}</button>}
          </div>

          <ProviderDropdown providers={providers} selected={selProv} onChange={v => { setSelProv(v); setPage(1) }} />

          <div className={styles.sep} />

          {VOL_FILTERS.map(f => (
            <button
              key={f.value}
              className={`${styles.pill} ${volFilter === f.value ? styles.pillOn : ''}`}
              onClick={() => { setVolFilter(f.value); setPage(1) }}
            >{f.label}</button>
          ))}

          <div className={styles.grow} />

          <SortMenu value={sortBy} onChange={v => { setSortBy(v); setPage(1) }} />
        </div>

        {loading && slots.length === 0 ? (
          <div className={styles.loading}><div className={styles.spinner} />A carregar…</div>
        ) : slots.length === 0 ? (
          <div className={styles.empty}><b>Nenhuma slot encontrada</b>Tenta outro termo de pesquisa.</div>
        ) : (
          <div className={styles.grid} style={{ opacity: loading ? .5 : 1 }}>
            {slots.map(s => (
              <SlotCard key={s.id} slot={s} onEdit={setEditSlot} onDelete={setDelSlot} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className={styles.pager}>
            <span className={styles.pagerInfo}>{from}–{to} de {total}</span>
            <button className={`${styles.pill} ${styles.pg}`} disabled={page === 1} onClick={() => loadPage(page - 1)}>←</button>
            {getPagesToShow().map((p, i) =>
              p === '...'
                ? <span key={`e${i}`} className={styles.ell}>…</span>
                : <button key={p} className={`${styles.pill} ${styles.pg} ${page === p ? styles.pillOn : ''}`} onClick={() => loadPage(p)}>{p}</button>
            )}
            <button className={`${styles.pill} ${styles.pg}`} disabled={page === totalPages} onClick={() => loadPage(page + 1)}>→</button>
          </div>
        )}
      </div>

      {addOpen  && <SlotModal slot={null}     onClose={() => setAddOpen(false)}  onSaved={handleSaved} />}
      {editSlot && <SlotModal slot={editSlot} onClose={() => setEditSlot(null)}  onSaved={handleSaved}
                    onDelete={s => { setEditSlot(null); setDelSlot(s) }} />}
      {delSlot  && <DeleteModal slot={delSlot} onClose={() => setDelSlot(null)}  onDeleted={handleDeleted} />}
    </div>
  )
}
