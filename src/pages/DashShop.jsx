import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { adminPoints } from '../lib/points'
import styles from './DashShop.module.css'


function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABELS = { pending: 'Pendente', done: 'Entregue', rejected: 'Rejeitado' }
const STATUS_COLORS = { pending: '#f5a623', done: '#21d16e', rejected: '#f04f4f' }

const EMPTY_PRODUCT = { name: '', description: '', category: 'digital', cost: '', stock: '', color: '#3b82f6', active: true, image_url: '' }

// ── Upload de imagem ──────────────────────────────────────────────────────────
function ImageUpload({ currentUrl, onUpload, onRemove }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview]     = useState(currentUrl || '')

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setUploading(true)
    const ext      = file.name.split('.').pop()
    const filename = `product-${Date.now()}.${ext}`
    const { data, error } = await supabase.storage
      .from('shop-images')
      .upload(filename, file, { upsert: true, contentType: file.type })
    setUploading(false)
    if (error) { console.error('Upload error:', error); setPreview(currentUrl || ''); return }
    const { data: { publicUrl } } = supabase.storage.from('shop-images').getPublicUrl(data.path)
    setPreview(publicUrl)
    onUpload(publicUrl)
  }

  const handleRemove = () => {
    setPreview('')
    onRemove()
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className={styles.imageUpload}>
      {preview ? (
        <div className={styles.imagePreview}>
          <img src={preview} alt="Preview" className={styles.imagePreviewImg} />
          <button className={styles.imageRemoveBtn} onClick={handleRemove} type="button" title="Remover imagem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      ) : (
        <button className={styles.imagePickBtn} onClick={() => inputRef.current?.click()} type="button" disabled={uploading}>
          {uploading ? (
            <><svg className={styles.spin} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>A carregar…</>
          ) : (
            <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Fazer upload</>
          )}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}

// ── Modal de produto ──────────────────────────────────────────────────────────
function ProductModal({ product, onSave, onClose }) {
  const [form,   setForm]   = useState(product || EMPTY_PRODUCT)
  const [saving, setSaving] = useState(false)
  const isNew = !product?.id
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name || !form.cost || form.stock === '') return
    setSaving(true)
    const payload = {
      name: form.name, description: form.description, category: form.category,
      cost: Number(form.cost), stock: Number(form.stock),
      color: form.color || '#3b82f6', active: form.active,
      image_url: form.image_url || null,
    }
    let error
    if (isNew) { ({ error } = await supabase.from('shop_products').insert(payload)) }
    else { ({ error } = await supabase.from('shop_products').update(payload).eq('id', form.id)) }
    setSaving(false)
    if (!error) onSave()
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{isNew ? 'Novo produto' : 'Editar produto'}</h2>
        <div className={styles.formGrid}>
          <label className={styles.formLabel}>
            Nome
            <input className={styles.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nome do produto" />
          </label>
          <label className={styles.formLabel}>
            Categoria
            <select className={styles.input} value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="digital">Digital</option>
              <option value="interact">Interact</option>
              <option value="merch">Merch</option>
            </select>
          </label>
          <label className={styles.formLabel}>
            Custo (pts)
            <input className={styles.input} type="number" min="0" value={form.cost} onChange={e => set('cost', e.target.value)} placeholder="Ex: 15000" />
          </label>
          <label className={styles.formLabel}>
            Stock
            <input className={styles.input} type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="Ex: 5" />
          </label>
          <label className={styles.formLabel}>
            Cor de fundo (sem imagem)
            <div className={styles.colorRow}>
              <input className={styles.colorPicker} type="color" value={form.color} onChange={e => set('color', e.target.value)} />
              <input className={styles.input} value={form.color} onChange={e => set('color', e.target.value)} placeholder="#3b82f6" />
            </div>
          </label>
          <label className={styles.formLabel}>
            Imagem do produto
            <ImageUpload currentUrl={form.image_url} onUpload={url => set('image_url', url)} onRemove={() => set('image_url', '')} />
          </label>
          <label className={`${styles.formLabel} ${styles.formLabelFull}`}>
            Descrição
            <textarea className={styles.textarea} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Descrição do produto…" rows={3} />
          </label>
          <label className={`${styles.formLabel} ${styles.formLabelFull} ${styles.toggleRow}`}>
            <span>Produto activo</span>
            <button className={`${styles.toggle} ${form.active ? styles.toggleOn : ''}`} onClick={() => set('active', !form.active)} type="button">
              <span className={styles.toggleThumb} />
            </button>
          </label>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className={styles.confirmBtn} onClick={handleSave} disabled={saving}>{saving ? 'A guardar…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Tab Produtos ──────────────────────────────────────────────────────────────
function TabProdutos() {
  const [products, setProducts] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null)

  const load = () => {
    setLoading(true)
    supabase.from('shop_products').select('*').order('id')
      .then(({ data }) => { setProducts(data || []); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Apagar este produto?')) return
    await supabase.from('shop_products').delete().eq('id', id)
    load()
  }

  const handleToggleActive = async (product) => {
    await supabase.from('shop_products').update({ active: !product.active }).eq('id', product.id)
    load()
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <span className={styles.tabCount}>{products.length} produtos</span>
        <button className={styles.addBtn} onClick={() => setModal('new')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo produto
        </button>
      </div>
      {loading ? (
        <div className={styles.loading}><svg className={styles.spin} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
      ) : (
        <div className={styles.prodTable}>
          <div className={styles.prodTableHead}>
            <span>Produto</span><span>Categoria</span><span>Custo</span><span>Stock</span><span>Estado</span><span>Ações</span>
          </div>
          {products.map(p => (
            <div key={p.id} className={styles.prodRow}>
              <div className={styles.prodName}>
                <div className={styles.prodThumb} style={{ '--card-color': p.color }}>
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className={styles.prodThumbImg} />
                    : <span className={styles.prodThumbPlaceholder}>{p.name?.[0]?.toUpperCase() || '?'}</span>
                  }
                </div>
                <span>{p.name}</span>
              </div>
              <span className={styles.pill}>{p.category}</span>
              <span className={styles.cost}>{Number(p.cost).toLocaleString('pt-PT')} pts</span>
              <span className={`${styles.stock} ${p.stock === 0 ? styles.stockEmpty : ''}`}>
                {p.stock === 0 ? 'Esgotado' : `${p.stock} un.`}
              </span>
              <button className={`${styles.statusToggle} ${p.active ? styles.statusActive : styles.statusInactive}`} onClick={() => handleToggleActive(p)}>
                {p.active ? 'Activo' : 'Inactivo'}
              </button>
              <div className={styles.actions}>
                <button className={styles.actionBtn} onClick={() => setModal(p)} title="Editar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => handleDelete(p.id)} title="Apagar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && (
        <ProductModal product={modal === 'new' ? null : modal} onSave={() => { setModal(null); load() }} onClose={() => setModal(null)} />
      )}
    </div>
  )
}

// ── Tab Resgates ──────────────────────────────────────────────────────────────
function TabResgates() {
  const [redeems, setRedeems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('pending')
  const [notes,   setNotes]   = useState({})
  const [saving,  setSaving]  = useState({})
  const [toast,   setToast]   = useState(null)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const load = () => {
    setLoading(true)
    let q = supabase.from('shop_redeems').select('*, shop_products(name, image_url, color)').order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    q.then(({ data }) => { setRedeems(data || []); setLoading(false) })
  }
  useEffect(() => { load() }, [filter])

  const handleStatus = async (redeem, newStatus) => {
    setSaving(s => ({ ...s, [redeem.id]: true }))

    const shouldRefundPoints = newStatus === 'rejected' && !redeem.points_refunded
    const shouldRefundStock  = newStatus === 'rejected' && !redeem.stock_refunded

    // 1. Devolver pontos (só 1 vez)
    if (shouldRefundPoints) {
      try {
        const res = await adminPoints(redeem.twitch_username, redeem.cost_at_redeem)
        const data = res.data
        if (!res.ok) {
          showToast(`Erro ao devolver pontos: ${data.error}`, 'error')
          setSaving(s => ({ ...s, [redeem.id]: false }))
          return
        }
      } catch {
        showToast('Erro de ligação ao devolver pontos.', 'error')
        setSaving(s => ({ ...s, [redeem.id]: false }))
        return
      }
    }

    // 2. Devolver stock (só 1 vez)
    if (shouldRefundStock && redeem.product_id) {
      const { data: prod } = await supabase
        .from('shop_products')
        .select('stock')
        .eq('id', redeem.product_id)
        .single()

      if (prod) {
        await supabase
          .from('shop_products')
          .update({ stock: prod.stock + 1 })
          .eq('id', redeem.product_id)
      }
    }

    // 3. Atualizar status do resgate
    await supabase.from('shop_redeems').update({
      status:          newStatus,
      admin_notes:     notes[redeem.id] ?? redeem.admin_notes ?? '',
      confirmed_at:    newStatus === 'done' ? new Date().toISOString() : null,
      points_refunded: shouldRefundPoints ? true : redeem.points_refunded,
      stock_refunded:  shouldRefundStock  ? true : redeem.stock_refunded,
    }).eq('id', redeem.id)

    if (shouldRefundPoints || shouldRefundStock) {
      const parts = []
      if (shouldRefundPoints) parts.push(`${redeem.cost_at_redeem.toLocaleString('pt-PT')} pts`)
      if (shouldRefundStock)  parts.push('stock')
      showToast(`Rejeitado · ${parts.join(' e ')} devolvidos`, 'success')
    }

    setSaving(s => ({ ...s, [redeem.id]: false }))
    load()
  }

  const pending = redeems.filter(r => r.status === 'pending').length

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <div className={styles.filterTabs}>
          {['all', 'pending', 'done', 'rejected'].map(s => (
            <button key={s} className={`${styles.filterTab} ${filter === s ? styles.filterTabActive : ''}`} onClick={() => setFilter(s)}>
              {s === 'all' ? 'Todos' : STATUS_LABELS[s]}
              {s === 'pending' && pending > 0 && <span className={styles.badge}>{pending}</span>}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className={styles.loading}><svg className={styles.spin} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
      ) : redeems.length === 0 ? (
        <div className={styles.empty}>Nenhum resgate encontrado.</div>
      ) : (
        <div className={styles.redeemList}>
          {redeems.map(r => (
            <div key={r.id} className={`${styles.redeemCard} ${styles['redeemCard_' + r.status]}`}>
              <div className={styles.redeemTop}>
                <div className={styles.redeemInfo}>
                  <div className={styles.redeemThumb} style={{ '--card-color': r.shop_products?.color || '#3b82f6' }}>
                    {r.shop_products?.image_url
                      ? <img src={r.shop_products.image_url} alt="" className={styles.redeemThumbImg} />
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                    }
                  </div>
                  <div>
                    <div className={styles.redeemProduct}>{r.shop_products?.name || `Produto #${r.product_id}`}</div>
                    <div className={styles.redeemMeta}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                      <span>{r.twitch_username}</span>
                      <span className={styles.sep}>·</span>
                      <span>{Number(r.cost_at_redeem).toLocaleString('pt-PT')} pts</span>
                      <span className={styles.sep}>·</span>
                      <span>{fmtDate(r.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.badgeGroup}>
                  <span className={styles.statusBadge} style={{ background: STATUS_COLORS[r.status] + '22', color: STATUS_COLORS[r.status], borderColor: STATUS_COLORS[r.status] + '44' }}>
                    {STATUS_LABELS[r.status]}
                  </span>
                  {(r.points_refunded || r.stock_refunded) && (
                    <span className={styles.refundedBadge}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                      {r.points_refunded && r.stock_refunded ? 'pts + stock devolvidos' : r.points_refunded ? 'pts devolvidos' : 'stock devolvido'}
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.redeemBottom}>
                <input className={styles.notesInput} placeholder="Notas admin (opcional)…" value={notes[r.id] ?? r.admin_notes ?? ''} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} />
                <div className={styles.redeemActions}>
                  {r.status === 'pending' && (
                    <button className={styles.doneBtn} onClick={() => handleStatus(r, 'done')} disabled={saving[r.id]}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Entregar
                    </button>
                  )}
                  {r.status === 'pending' && (
                    <button className={styles.rejectBtn} onClick={() => handleStatus(r, 'rejected')} disabled={saving[r.id]}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Rejeitar + devolver pts e stock
                    </button>
                  )}
                  {r.status === 'done' && (
                    <button className={styles.rejectBtn} onClick={() => handleStatus(r, 'rejected')} disabled={saving[r.id]}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      {r.points_refunded && r.stock_refunded
                        ? 'Rejeitar'
                        : r.points_refunded
                          ? 'Rejeitar + devolver stock'
                          : r.stock_refunded
                            ? 'Rejeitar + devolver pts'
                            : 'Rejeitar + devolver pts e stock'
                      }
                    </button>
                  )}

                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {toast && (
        <div className={`${styles.toast} ${styles['toast_' + toast.type]}`}>
          {toast.type === 'success'
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          }
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ── DashShop principal ────────────────────────────────────────────────────────
export default function DashShop() {
  const [tab, setTab] = useState('produtos')
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Loja
          </h1>
          <p className={styles.sub}>Gerir produtos e resgates</p>
        </div>
      </div>
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'produtos' ? styles.tabActive : ''}`} onClick={() => setTab('produtos')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          Produtos
        </button>
        <button className={`${styles.tab} ${tab === 'resgates' ? styles.tabActive : ''}`} onClick={() => setTab('resgates')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
          Resgates
        </button>
      </div>
      {tab === 'produtos' ? <TabProdutos /> : <TabResgates />}
    </div>
  )
}