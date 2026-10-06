import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useStreamElementsPoints } from '../hooks/useStreamElementsPoints'
import { supabase } from '../lib/supabase'
import styles from './Shop.module.css'

const SE_WORKER_URL = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'

const CATEGORIES = [
  { id: 'all',      label: 'All' },
  { id: 'digital',  label: 'Digital' },
  { id: 'interact', label: 'Interact' },
]

const SORTS = [
  { id: 'default', label: 'Featured' },
  { id: 'low',     label: 'Price: low to high' },
  { id: 'high',    label: 'Price: high to low' },
]

const fmt = (n) => Number(n || 0).toLocaleString('en-GB')

const IconCoin = ({ size = 14 }) => <span className={styles.coin} style={{ width: size, height: size }} aria-hidden="true" />
const IconGift = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </svg>
)

// ── Product card ─────────────────────────────────────────────────────────────
function ShopCard({ product, userPoints, onRedeem }) {
  const unlimited  = product.stock == null
  const outOfStock = product.stock === 0
  const lowStock   = !unlimited && product.stock > 0 && product.stock <= 5
  const loggedIn   = userPoints !== null
  const canAfford  = loggedIn && userPoints >= product.cost
  const missing    = loggedIn ? Math.max(0, product.cost - userPoints) : product.cost
  const pct        = loggedIn ? Math.min(100, (userPoints / product.cost) * 100) : 0
  const disabled   = outOfStock || !canAfford

  return (
    <article
      className={`${styles.card} ${outOfStock ? styles.cardOut : ''} ${canAfford && !outOfStock ? styles.cardReady : ''}`}
      style={{ '--c': product.color || '#3b82f6' }}
    >
      <div className={styles.media}>
        {product.image_url
          ? <img src={product.image_url} alt="" className={styles.photo} loading="lazy" />
          : <span className={styles.initial}>{product.name?.[0]?.toUpperCase() || '?'}</span>}
        <span className={styles.cat}>{product.category}</span>
        {outOfStock && <span className={`${styles.stock} ${styles.stockOut}`}>Sold out</span>}
        {lowStock && <span className={`${styles.stock} ${styles.stockLow}`}>Only {product.stock} left</span>}
      </div>

      <div className={styles.body}>
        <h3 className={styles.name} title={product.name}>{product.name}</h3>
        {product.description && <p className={styles.desc}>{product.description}</p>}

        <div className={styles.foot}>
          <div className={styles.price}>
            <IconCoin size={18} />
            <b>{fmt(product.cost)}</b>
            <span>pts</span>
          </div>

          {!outOfStock && loggedIn && !canAfford && (
            <div className={styles.need}>
              <div className={styles.needBar}><i style={{ width: pct + '%' }} /></div>
              <small>{fmt(missing)} pts to go</small>
            </div>
          )}

          <button className={styles.btn} onClick={() => !disabled && onRedeem(product)} disabled={disabled}>
            {canAfford && !outOfStock && <IconGift />}
            {outOfStock ? 'Sold out' : !loggedIn ? 'Log in to redeem' : canAfford ? 'Redeem' : 'Not enough points'}
          </button>
        </div>
      </div>
    </article>
  )
}

// ── Confirm modal ────────────────────────────────────────────────────────────
function ConfirmModal({ product, balance, loading, onConfirm, onCancel }) {
  const after = (balance ?? 0) - product.cost
  return (
    <div className={styles.overlay} onClick={!loading ? onCancel : undefined}>
      <div className={styles.modal} style={{ '--c': product.color || '#3b82f6' }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.mMedia}>
          {product.image_url
            ? <img src={product.image_url} alt="" />
            : <span className={styles.initial}>{product.name?.[0]?.toUpperCase()}</span>}
        </div>
        <div className={styles.mBody}>
          <h2>{product.name}</h2>
          {product.description && <p>{product.description}</p>}
          <div className={styles.sum}>
            <div><small>Your balance</small><b>{fmt(balance)}</b></div>
            <div><small>Cost</small><b className={styles.neg}>−{fmt(product.cost)}</b></div>
            <div><small>After redeeming</small><b>{fmt(after)}</b></div>
          </div>
          <p className={styles.note}>After redeeming, open a ticket on Discord to receive your prize.</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.ghost} onClick={onCancel} disabled={loading}>Cancel</button>
          <button className={styles.confirm} onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing…' : `Confirm and spend ${fmt(product.cost)} pts`}
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
  const [sort,           setSort]           = useState('default')
  const [onlyAfford,     setOnlyAfford]     = useState(false)
  const [confirmProduct, setConfirmProduct] = useState(null)
  const [redeeming,      setRedeeming]      = useState(false)
  const [toast,          setToast]          = useState(null)

  useEffect(() => {
    supabase.from('shop_products').select('*').eq('active', true).order('id')
      .then(({ data, error }) => { if (!error) setProducts(data || []); setLoadingProds(false) })
  }, [])

  let filtered = activeCategory === 'all' ? products : products.filter(p => p.category === activeCategory)
  if (onlyAfford && points !== null) filtered = filtered.filter(p => p.cost <= points && p.stock !== 0)
  if (sort === 'low')  filtered = [...filtered].sort((a, b) => a.cost - b.cost)
  if (sort === 'high') filtered = [...filtered].sort((a, b) => b.cost - a.cost)

  // cheapest item the user can't afford yet = the "next goal"
  const goal = points === null ? null
    : [...products].filter(p => p.stock !== 0 && p.cost > points).sort((a, b) => a.cost - b.cost)[0] || null
  const affordableCount = points === null ? 0 : products.filter(p => p.stock !== 0 && p.cost <= points).length

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
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <h1 className={styles.title}>Rewards Shop</h1>
          <p className={styles.sub}>Spend the points you earn watching the stream. New prizes land here regularly.</p>
          <div className={styles.heroMeta}>
            <span><b>{products.length}</b> prizes</span>
            {points !== null && <span><b>{affordableCount}</b> you can redeem now</span>}
          </div>
        </div>

        <div className={styles.wallet}>
          <span className={styles.wLbl}>Your points</span>
          {points !== null ? (
            <>
              <div className={styles.wVal}><IconCoin size={26} /><b>{fmt(points)}</b></div>
              {goal ? (
                <div className={styles.goal}>
                  <div className={styles.goalTop}><span>Next prize: <b>{goal.name}</b></span><span>{fmt(goal.cost - points)} to go</span></div>
                  <div className={styles.needBar}><i style={{ width: Math.min(100, (points / goal.cost) * 100) + '%' }} /></div>
                </div>
              ) : (
                <p className={styles.walletNote}>{products.length ? 'You can afford everything in stock.' : 'No prizes yet.'}</p>
              )}
            </>
          ) : (
            <p className={styles.walletNote}>Log in with Twitch to see your points and redeem prizes.</p>
          )}
        </div>
      </header>

      <div className={styles.bar}>
        <div className={styles.seg} role="tablist">
          {CATEGORIES.map(cat => (
            <button key={cat.id} role="tab" aria-selected={activeCategory === cat.id}
              className={`${styles.segBtn} ${activeCategory === cat.id ? styles.segOn : ''}`}
              onClick={() => setActiveCategory(cat.id)}>
              {cat.label}
              <span>{cat.id === 'all' ? products.length : products.filter(p => p.category === cat.id).length}</span>
            </button>
          ))}
        </div>
        <div className={styles.barRight}>
          {points !== null && (
            <button className={`${styles.chip} ${onlyAfford ? styles.chipOn : ''}`} onClick={() => setOnlyAfford(v => !v)} aria-pressed={onlyAfford}>
              I can afford
            </button>
          )}
          <select className={styles.select} value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort prizes">
            {SORTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {loadingProds ? (
        <div className={styles.grid}>{[0, 1, 2, 3].map(i => <div key={i} className={styles.skel} />)}</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <p>{onlyAfford ? 'Nothing you can afford yet. Keep watching to earn more points.' : 'No prizes in this category yet.'}</p>
          {onlyAfford && <button className={styles.chip} onClick={() => setOnlyAfford(false)}>Show all prizes</button>}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map(product => (
            <ShopCard key={product.id} product={product} userPoints={points} onRedeem={handleRedeem} />
          ))}
        </div>
      )}

      {confirmProduct && (
        <ConfirmModal product={confirmProduct} balance={points} loading={redeeming} onConfirm={handleConfirm} onCancel={() => !redeeming && setConfirmProduct(null)} />
      )}

      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastErr : styles.toastOk}`}>
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