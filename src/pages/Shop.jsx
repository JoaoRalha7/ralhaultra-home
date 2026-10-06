import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useStreamElementsPoints } from '../hooks/useStreamElementsPoints'
import { supabase } from '../lib/supabase'
import styles from './Shop.module.css'

const SE_WORKER_URL = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'

const CATEGORIES = [
  { id: 'all',      label: 'ALL' },
  { id: 'digital',  label: 'DIGITAL' },
  { id: 'interact', label: 'INTERACT' },
]

const IconCoin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/>
  </svg>
)
const IconBox = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
  </svg>
)

// ── Efeito Ping-Pong ─────────────────────────────────────────────────────────
function SlideText({ text, className }) {
  const containerRef = useRef(null)
  const textRef = useRef(null)
  const [slideDist, setSlideDist] = useState(0)

  useEffect(() => {
    if (containerRef.current && textRef.current) {
      const cWidth = containerRef.current.clientWidth
      const tWidth = textRef.current.scrollWidth
      if (tWidth > cWidth) {
        setSlideDist(cWidth - tWidth - 6) 
      } else {
        setSlideDist(0)
      }
    }
  }, [text])

  return (
    <div className={`${styles.slideWrap} ${className || ''}`} ref={containerRef}>
      <div 
        className={`${styles.slideInner} ${slideDist < 0 ? styles.animPingPong : ''}`}
        style={{ '--slide-dist': `${slideDist}px` }}
      >
        <span className={styles.slideText} ref={textRef}>{text}</span>
      </div>
    </div>
  )
}

// ── Card (Layout Original) ───────────────────────────────────────────────────
function ShopCard({ product, userPoints, onRedeem }) {
  const canAfford  = userPoints !== null && userPoints >= product.cost
  const outOfStock = product.stock === 0
  const disabled   = outOfStock || !canAfford

  const btnLabel = outOfStock
    ? 'OUT OF STOCK'
    : userPoints === null
      ? 'LOGIN TO REDEEM'
      : !canAfford
        ? 'NOT ENOUGH POINTS'
        : 'REDEEM'

  return (
    <div className={`${styles.card} ${outOfStock ? styles.cardSoldOut : ''} ${disabled && !outOfStock ? styles.cardCantAfford : ''}`}>

      {/* ── Imagem ── */}
      <div className={styles.cardImg} style={{ '--card-color': product.color || 'var(--accent)' }}>
        {product.image_url
          ? <img src={product.image_url} alt={product.name} className={styles.cardPhoto} loading="lazy" />
          : <div className={styles.cardImgFallback}>{product.name?.[0]?.toUpperCase() || '?'}</div>
        }
        {outOfStock && (
          <div className={styles.soldOut}>
            <span>SOLD OUT</span>
          </div>
        )}
        <div className={styles.cardCategoryPill}>{product.category}</div>
      </div>

      {/* ── Info ── */}
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          {/* Nome com Ping-Pong */}
          <SlideText text={product.name} className={styles.cardName} />
          {product.description && (
            <p className={styles.cardDesc}>{product.description}</p>
          )}
        </div>

        <div className={styles.cardBottom}>
          <div className={styles.cardMeta}>
            <div className={styles.metaCost}>
              <span className={styles.metaCostLabel}>Cost</span>
              <div className={styles.metaCostValue}>
                <span className={styles.iconYellow}><IconCoin /></span>
                <span>{product.cost.toLocaleString('en-GB')}</span>
                <span className={styles.metaPts}>pts</span>
              </div>
            </div>
            <div className={styles.metaDivider} />
            <div className={`${styles.metaStockBlock} ${outOfStock ? styles.metaStockEmpty : ''}`}>
              <span className={styles.metaStockLabel}>Stock</span>
              <div className={styles.metaStockValue}>
                <IconBox />
                <span>{outOfStock ? '0' : product.stock}</span>
                <span className={styles.metaStockUnit}>pcs.</span>
              </div>
            </div>
          </div>

          <button
            className={`${styles.redeemBtn} ${disabled ? styles.redeemBtnDisabled : ''}`}
            onClick={() => !disabled && onRedeem(product)}
            disabled={disabled}
          >
            {!disabled && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/>
                <path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
              </svg>
            )}
            {btnLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de confirmação ──────────────────────────────────────────────────────
function ConfirmModal({ product, loading, onConfirm, onCancel }) {
  return (
    <div className={styles.modalOverlay} onClick={!loading ? onCancel : undefined}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalImg} style={{ '--card-color': product.color || 'var(--accent)' }}>
          {product.image_url
            ? <img src={product.image_url} alt={product.name} className={styles.modalPhoto} />
            : <div className={styles.modalImgFallback}>{product.name?.[0]?.toUpperCase()}</div>
          }
        </div>
        <div className={styles.modalInfo}>
          <h2 className={styles.modalTitle}>{product.name}</h2>
          <p className={styles.modalDesc}>{product.description}</p>
          <div className={styles.modalCost}>
            <span className={styles.iconYellow}><IconCoin /></span>
            <span>{product.cost.toLocaleString('en-GB')} points</span>
          </div>
          <p className={styles.modalNote}>
            After redeeming, open a ticket on Discord to receive your prize.
          </p>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onCancel} disabled={loading}>Cancel</button>
          <button className={styles.confirmBtn} onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing…' : `Confirm — ${product.cost.toLocaleString('en-GB')} pts`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Shop() {
  const { user, profile } = useAuth()
  const twitchUsername = profile?.twitch_username || user?.user_metadata?.full_name || null
  const { points, setPoints } = useStreamElementsPoints(twitchUsername)

  const [products,       setProducts]       = useState([])
  const [loadingProds,   setLoadingProds]   = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [confirmProduct, setConfirmProduct] = useState(null)
  const [redeeming,      setRedeeming]      = useState(false)
  const [toast,          setToast]          = useState(null)

  useEffect(() => {
    supabase.from('shop_products').select('*').eq('active', true).order('id')
      .then(({ data, error }) => { if (!error) setProducts(data || []); setLoadingProds(false) })
  }, [])

  const filtered = activeCategory === 'all'
    ? products
    : products.filter(p => p.category === activeCategory)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const handleRedeem = (product) => {
    if (!user) return showToast('Login to redeem.', 'error')
    setConfirmProduct(product)
  }

  const handleConfirm = async () => {
    if (!confirmProduct || redeeming) return
    setRedeeming(true)
    try {
      const res = await fetch(`${SE_WORKER_URL}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: twitchUsername, userId: user.id, productId: confirmProduct.id, cost: confirmProduct.cost }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Error processing redeem.', 'error'); return }
      if (data.newPoints != null) setPoints(data.newPoints)
      setProducts(prev => prev.map(p => p.id === confirmProduct.id ? { ...p, stock: Math.max(0, p.stock - 1) } : p))
      showToast(`${confirmProduct.name} redeemed! Open a ticket on Discord.`, 'success')
      setConfirmProduct(null)
    } catch { showToast('Connection error. Please try again.', 'error') }
    finally { setRedeeming(false) }
  }

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Rewards Shop
          </h1>
          <p className={styles.sub}>Redeem your points for exclusive prizes</p>
        </div>
        {points !== null && (
          <div className={styles.pointsPill}>
            <span className={styles.iconYellow}><IconCoin /></span>
            <span>{points.toLocaleString('en-GB')} pts available</span>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className={styles.filters}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`${styles.filterBtn} ${activeCategory === cat.id ? styles.filterBtnActive : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
            {cat.id !== 'all' && (
              <span className={styles.filterCount}>{products.filter(p => p.category === cat.id).length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loadingProds ? (
        <div className={styles.loading}>
          <svg className={styles.spin} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <span>Loading products…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: .2 }}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <p>No products in this category.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map(product => (
            <ShopCard key={product.id} product={product} userPoints={points} onRedeem={handleRedeem} />
          ))}
        </div>
      )}

      {confirmProduct && (
        <ConfirmModal product={confirmProduct} loading={redeeming} onConfirm={handleConfirm} onCancel={() => !redeeming && setConfirmProduct(null)} />
      )}

      {toast && (
        <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>
          {toast.type === 'success'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          }
          {toast.msg}
        </div>
      )}
    </div>
  )
}