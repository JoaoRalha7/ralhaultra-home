import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { adminPoints } from '../lib/points'
import ProductMedia from '../components/ProductMedia'
import styles from './DashShop.module.css'

const CATS = [['digital', 'Digital'], ['interact', 'Interact'], ['merch', 'Merch']]
const COSTS = [1000, 5000, 25000, 100000]
const STATUS_LABELS = { pending: 'Pendente', done: 'Entregue', rejected: 'Rejeitado' }
const EMPTY = { id: null, name: '', description: '', category: 'digital', cost: '', stock: '', image_url: '', active: true, color: '#3b82f6' }

const fmt = (n) => String(Math.round(Number(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')

function ago(d) {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  const dt = new Date(d)
  return dt.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) + ' ' +
    dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

const I = {
  edit:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>,
  check: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7"/></svg>,
  up:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>,
}

function Thumb({ url, name, cls }) {
  return (
    <div className={cls}>
      {url ? <ProductMedia src={url} /> : <span>{name?.[0]?.toUpperCase() || '?'}</span>}
    </div>
  )
}

// ── Painel: criar / editar produto ────────────────────────────────────────────
function ProductForm({ product, onSaved, onCancel }) {
  const [f, setF] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [upl, setUpl] = useState(false)
  const fileRef = useRef(null)
  const isEdit = !!f.id
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  useEffect(() => { setF(product ? { ...EMPTY, ...product, cost: String(product.cost ?? ''), stock: String(product.stock ?? ''), image_url: product.image_url || '', description: product.description || '' } : EMPTY) }, [product])

  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUpl(true)
    const ext = file.name.split('.').pop()
    const { data, error } = await supabase.storage.from('shop-images')
      .upload(`product-${Date.now()}.${ext}`, file, { upsert: true, contentType: file.type })
    setUpl(false)
    if (fileRef.current) fileRef.current.value = ''
    if (error) { console.error('Upload error:', error); return }
    set('image_url', supabase.storage.from('shop-images').getPublicUrl(data.path).data.publicUrl)
  }

  const ok = f.name.trim() && f.cost !== '' && f.stock !== ''

  const save = async () => {
    if (!ok) return
    setSaving(true)
    const payload = {
      name: f.name.trim(), description: f.description, category: f.category,
      cost: Number(f.cost), stock: Number(f.stock),
      color: f.color || '#3b82f6', active: f.active, image_url: f.image_url || null,
    }
    const { error } = isEdit
      ? await supabase.from('shop_products').update(payload).eq('id', f.id)
      : await supabase.from('shop_products').insert(payload)
    setSaving(false)
    if (!error) { setF(EMPTY); onSaved() }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>{isEdit ? 'Editar produto' : 'Novo produto'}</div>

      <label className={styles.fld}><span>Nome</span>
        <input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Cargo VIP Discord" />
      </label>

      <div className={styles.fld}><span>Categoria</span>
        <div className={styles.seg3}>
          {CATS.map(([k, l]) => (
            <button key={k} type="button" className={f.category === k ? styles.segOn : ''} onClick={() => set('category', k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className={styles.fld}><span>Custo (pontos)</span>
        <div className={styles.chips}>
          {COSTS.map(c => (
            <button key={c} type="button" className={Number(f.cost) === c ? styles.chipOn : ''} onClick={() => set('cost', String(c))}>{fmt(c)}</button>
          ))}
        </div>
        <input type="number" min="0" value={f.cost} onChange={e => set('cost', e.target.value)} placeholder="Outro valor" />
      </div>

      <div className={styles.two}>
        <label className={styles.fld}><span>Stock</span>
          <input type="number" min="0" value={f.stock} onChange={e => set('stock', e.target.value)} placeholder="Ex: 10" />
        </label>
        <div className={styles.fld}><span>Imagem</span>
          <div className={styles.imgRow}>
            <input value={f.image_url} onChange={e => set('image_url', e.target.value)} placeholder="URL" />
            <button type="button" className={styles.upBtn} onClick={() => fileRef.current?.click()} disabled={upl} aria-label="Fazer upload">{I.up}</button>
            <input ref={fileRef} type="file" accept="image/*,video/webm,video/mp4" hidden onChange={upload} />
          </div>
        </div>
      </div>

      <label className={styles.fld}><span>Descrição</span>
        <input value={f.description} onChange={e => set('description', e.target.value)} placeholder="Opcional" />
      </label>

      <button className={styles.cta} onClick={save} disabled={!ok || saving}>
        {saving ? 'A guardar…' : isEdit ? 'Guardar alterações' : 'Criar produto'}
      </button>
      {isEdit && <button className={styles.ghost} type="button" onClick={() => { setF(EMPTY); onCancel() }}>Cancelar edição</button>}
    </div>
  )
}

// ── Lista de produtos ─────────────────────────────────────────────────────────
function ProductList({ products, loading, onEdit, onToggle, onDelete, editingId }) {
  if (loading) return <p className={styles.empty}>A carregar…</p>
  if (!products.length) return <p className={styles.empty}>Ainda não há produtos. Cria o primeiro à esquerda.</p>
  return products.map(p => {
    const out = Number(p.stock) === 0
    return (
      <div key={p.id} className={`${styles.item} ${!p.active ? styles.itemOff : ''} ${editingId === p.id ? styles.itemEdit : ''}`}>
        <Thumb url={p.image_url} name={p.name} cls={styles.thumb} />
        <div className={styles.itemMain}>
          <div className={styles.itemName}><span>{p.name}</span><em className={styles.tag}>{p.category}</em></div>
          {p.description && <div className={styles.itemSub}>{p.description}</div>}
        </div>
        <div className={styles.val}><b className={styles.gold}>{fmt(p.cost)}</b><small>pontos</small></div>
        <div className={styles.val}>
          {out ? <b className={styles.red}>Esgotado</b> : <b>{fmt(p.stock)} un.</b>}
          <small>{out ? '0 un.' : 'stock'}</small>
        </div>
        <button className={`${styles.tg} ${p.active ? styles.tgOn : ''}`} onClick={() => onToggle(p)} aria-label={p.active ? 'Desativar' : 'Ativar'} aria-pressed={p.active} />
        <button className={styles.ib} onClick={() => onEdit(p)} aria-label="Editar">{I.edit}</button>
        <button className={`${styles.ib} ${styles.ibDel}`} onClick={() => onDelete(p)} aria-label="Apagar">{I.trash}</button>
      </div>
    )
  })
}

// ── Lista de resgates ─────────────────────────────────────────────────────────
function RedeemList({ redeems, loading, filter, onStatus, busy }) {
  const [notes, setNotes] = useState({})
  const rows = redeems.filter(r => filter === 'all' || r.status === filter)
  if (loading) return <p className={styles.empty}>A carregar…</p>
  if (!rows.length) return <p className={styles.empty}>Nenhum resgate aqui.</p>

  const pend = rows.filter(r => r.status === 'pending')
  const rest = rows.filter(r => r.status !== 'pending')

  const one = (r) => {
    const p = r.status === 'pending'
    return (
      <div key={r.id} className={`${styles.item} ${!p ? styles.itemDim : ''}`}>
        <Thumb url={r.shop_products?.image_url} name={r.shop_products?.name} cls={styles.thumb} />
        <div className={styles.itemMain}>
          <div className={styles.itemName}><span>{r.shop_products?.name || `Produto #${r.product_id}`}</span></div>
          <div className={styles.itemSub}>
            <b>{r.twitch_username}</b> · {ago(r.created_at)}
            {(r.points_refunded || r.stock_refunded) && ' · devolvido'}
            {!p && r.admin_notes ? ` · ${r.admin_notes}` : ''}
          </div>
        </div>
        {p && (
          <input className={styles.note} placeholder="Notas (opcional)" value={notes[r.id] ?? r.admin_notes ?? ''}
            onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} />
        )}
        <div className={styles.val}><b className={styles.gold}>{fmt(r.cost_at_redeem)}</b><small>pontos</small></div>
        <span className={`${styles.st} ${styles['st_' + r.status]}`}>{STATUS_LABELS[r.status]}</span>
        {p && (
          <>
            <button className={styles.ghostSm} disabled={busy[r.id]} onClick={() => onStatus(r, 'rejected', notes[r.id])}>Rejeitar</button>
            <button className={styles.primary} disabled={busy[r.id]} onClick={() => onStatus(r, 'done', notes[r.id])}>{I.check}Entregar</button>
          </>
        )}
        {r.status === 'done' && (
          <button className={styles.ghostSm} disabled={busy[r.id]} onClick={() => onStatus(r, 'rejected', r.admin_notes)}>Rejeitar</button>
        )}
      </div>
    )
  }

  return (
    <>
      {pend.map(one)}
      {pend.length > 0 && rest.length > 0 && <div className={styles.divLbl}>Anteriores</div>}
      {rest.map(one)}
    </>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function DashShop() {
  const [tab, setTab]           = useState('produtos')
  const [filter, setFilter]     = useState('pending')
  const [products, setProducts] = useState([])
  const [redeems, setRedeems]   = useState([])
  const [loadP, setLoadP]       = useState(true)
  const [loadR, setLoadR]       = useState(true)
  const [editing, setEditing]   = useState(null)
  const [busy, setBusy]         = useState({})
  const [toast, setToast]       = useState(null)

  const flash = (msg, err) => { setToast({ msg, err }); setTimeout(() => setToast(null), 3500) }

  const loadProducts = useCallback(() => {
    supabase.from('shop_products').select('*').order('id')
      .then(({ data }) => { setProducts(data || []); setLoadP(false) })
  }, [])
  const loadRedeems = useCallback(() => {
    supabase.from('shop_redeems').select('*, shop_products(name, image_url, color)')
      .order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => { setRedeems(data || []); setLoadR(false) })
  }, [])
  useEffect(() => { loadProducts(); loadRedeems() }, [loadProducts, loadRedeems])

  const stats = useMemo(() => {
    const m = new Date(); m.setDate(1); m.setHours(0, 0, 0, 0)
    const month = redeems.filter(r => new Date(r.created_at) >= m)
    return {
      pending: redeems.filter(r => r.status === 'pending').length,
      month: month.length,
      spent: month.filter(r => r.status !== 'rejected').reduce((s, r) => s + Number(r.cost_at_redeem || 0), 0),
      counts: {
        all: redeems.length,
        pending: redeems.filter(r => r.status === 'pending').length,
        done: redeems.filter(r => r.status === 'done').length,
        rejected: redeems.filter(r => r.status === 'rejected').length,
      },
    }
  }, [redeems])

  const toggle = async (p) => {
    await supabase.from('shop_products').update({ active: !p.active }).eq('id', p.id)
    loadProducts()
  }
  const del = async (p) => {
    if (!confirm(`Apagar "${p.name}"?`)) return
    await supabase.from('shop_products').delete().eq('id', p.id)
    if (editing?.id === p.id) setEditing(null)
    loadProducts()
  }

  const handleStatus = async (redeem, newStatus, noteVal) => {
    setBusy(s => ({ ...s, [redeem.id]: true }))
    const refundPts   = newStatus === 'rejected' && !redeem.points_refunded
    const refundStock = newStatus === 'rejected' && !redeem.stock_refunded

    if (refundPts) {
      try {
        const res = await adminPoints(redeem.twitch_username, redeem.cost_at_redeem)
        if (!res.ok) { flash(`Erro ao devolver pontos: ${res.data?.error || ''}`, true); setBusy(s => ({ ...s, [redeem.id]: false })); return }
      } catch {
        flash('Erro de ligação ao devolver pontos.', true); setBusy(s => ({ ...s, [redeem.id]: false })); return
      }
    }
    if (refundStock && redeem.product_id) {
      const { data: prod } = await supabase.from('shop_products').select('stock').eq('id', redeem.product_id).single()
      if (prod) await supabase.from('shop_products').update({ stock: prod.stock + 1 }).eq('id', redeem.product_id)
    }
    await supabase.from('shop_redeems').update({
      status: newStatus,
      admin_notes: noteVal ?? redeem.admin_notes ?? '',
      confirmed_at: newStatus === 'done' ? new Date().toISOString() : null,
      points_refunded: refundPts ? true : redeem.points_refunded,
      stock_refunded: refundStock ? true : redeem.stock_refunded,
    }).eq('id', redeem.id)

    if (refundPts || refundStock) {
      const parts = []
      if (refundPts) parts.push(`${fmt(redeem.cost_at_redeem)} pts`)
      if (refundStock) parts.push('stock')
      flash(`Rejeitado · ${parts.join(' e ')} devolvidos`)
    }
    setBusy(s => ({ ...s, [redeem.id]: false }))
    loadRedeems(); loadProducts()
  }

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Loja</h1>
        <p className={styles.sub}>Cria produtos e gere os resgates dos viewers. Os produtos são pagos com pontos.</p>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}><small>Pendentes</small><b className={stats.pending ? styles.gold : ''}>{stats.pending}</b></div>
        <div className={styles.stat}><small>Resgates (mês)</small><b>{stats.month}</b></div>
        <div className={styles.stat}><small>Pontos gastos</small><b>{fmt(stats.spent)}</b></div>
        <div className={styles.stat}><small>Produtos</small><b>{products.length}</b></div>
      </div>

      <div className={styles.layout}>
        {tab === 'produtos' && (
          <ProductForm product={editing} onSaved={() => { setEditing(null); loadProducts() }} onCancel={() => setEditing(null)} />
        )}

        <div className={styles.stage}>
          <div className={styles.tabs}>
            <button className={tab === 'produtos' ? styles.tabOn : ''} onClick={() => setTab('produtos')}>Produtos<i>{products.length}</i></button>
            <button className={tab === 'resgates' ? styles.tabOn : ''} onClick={() => setTab('resgates')}>
              Resgates<i className={stats.pending && tab !== 'resgates' ? styles.gold : ''} style={stats.pending && tab !== 'resgates' ? { opacity: 1 } : undefined}>{stats.pending}</i>
            </button>
            {tab === 'resgates' && (
              <>
                <span className={styles.vsep} />
                {[['pending', 'Pendentes'], ['done', 'Entregues'], ['rejected', 'Rejeitados'], ['all', 'Todos']].map(([k, l]) => (
                  <button key={k} className={filter === k ? styles.subOn : ''} onClick={() => setFilter(k)}>{l}<i>{stats.counts[k]}</i></button>
                ))}
              </>
            )}
          </div>

          {tab === 'produtos'
            ? <ProductList products={products} loading={loadP} editingId={editing?.id} onEdit={setEditing} onToggle={toggle} onDelete={del} />
            : <RedeemList redeems={redeems} loading={loadR} filter={filter} onStatus={handleStatus} busy={busy} />}
        </div>
      </div>

      {toast && <div className={`${styles.toast} ${toast.err ? styles.err : ''}`}>{toast.msg}</div>}
    </div>
  )
}
