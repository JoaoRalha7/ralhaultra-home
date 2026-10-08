import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useStreamElementsPoints } from '../hooks/useStreamElementsPoints'
import { supabase } from '../lib/supabase'
import { workerPost } from '../lib/points'
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

// rarity comes from the price, so it works without any new column
const rarityOf = (cost) =>
  cost >= 500000 ? { id: 'legendary', label: 'Legendary' }
  : cost >= 100000 ? { id: 'epic', label: 'Epic' }
  : cost >= 20000 ? { id: 'rare', label: 'Rare' }
  : { id: 'common', label: 'Common' }

const ago = (d) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(d)) / 60000))
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

const fmt = (n) => Number(n || 0).toLocaleString('en-GB')

const IconCoin = ({ size = 14 }) => <span className={styles.coin} style={{ width: size, height: size }} aria-hidden="true" />

// ── Product card ─────────────────────────────────────────────────────────────
// The product picture keeps turning around its vertical axis like the VIP badges (a thin stack of layers gives it
// thickness). With the mouse over the card it eases back to face front; when the mouse leaves it starts turning again.
const SPIN_Z = [-5, -4, -3, -2, -1]
function ProductSpin({ src, seed }) {
  const box = useRef(null)
  useEffect(() => {
    const el = box.current
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const card = el.closest('article') || el.parentElement
    let angle = ([...String(seed || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 36) * 10, hover = false, raf = 0, last = performance.now(), visible = true
    const enter = () => { hover = true }
    const leave = () => { hover = false }
    card.addEventListener('mouseenter', enter); card.addEventListener('mouseleave', leave)
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([e]) => { visible = e.isIntersecting }) : null
    io?.observe(el)
    const loop = (now) => {
      const dt = Math.min(64, now - last); last = now
      if (visible) {
        if (hover) { const d = -(((angle + 180) % 360 + 360) % 360 - 180); angle = Math.abs(d) < 0.05 ? angle + d : angle + d * (1 - Math.exp(-dt / 140)) }
        else angle = (angle + dt * 0.06) % 360 // one turn every 6 s
        el.style.transform = `rotateY(${angle}deg)`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); card.removeEventListener('mouseenter', enter); card.removeEventListener('mouseleave', leave); io?.disconnect() }
  }, [seed])
  return (
    <div className={styles.spinStage}>
      <div className={styles.spin} ref={box}>
        {SPIN_Z.map((z) => <img key={z} src={src} alt="" className={styles.layer} loading="lazy" style={{ transform: `translateZ(${z * 1.4}px)`, filter: `brightness(${0.55 + (z + 5) * 0.06})` }} />)}
        <img src={src} alt="" className={`${styles.layer} ${styles.layerFront}`} loading="lazy" style={{ transform: 'translateZ(1px)' }} />
      </div>
    </div>
  )
}

function ShopCard({ product, userPoints, onRedeem }) {
  const unlimited  = product.stock == null
  const outOfStock = product.stock === 0
  const lowStock   = !unlimited && product.stock > 0 && product.stock <= 5
  const loggedIn   = userPoints !== null
  const canAfford  = loggedIn && userPoints >= product.cost
  const missing    = loggedIn ? Math.max(0, product.cost - userPoints) : product.cost
  const pct        = loggedIn ? Math.min(100, (userPoints / product.cost) * 100) : 0
  const disabled   = outOfStock || !canAfford
  const locked     = outOfStock || (loggedIn && !canAfford)
  const rar        = rarityOf(product.cost)

  return (
    <article
      className={`${styles.card} ${styles['r_' + rar.id]} ${outOfStock ? styles.cardOut : ''} ${canAfford && !outOfStock ? styles.cardReady : ''} ${locked ? styles.cardLocked : ''}`}
      style={{ '--c': product.color || '#3b82f6' }}
    >
      <div className={styles.media}>
        {product.image_url
          ? <ProductSpin src={product.image_url} seed={product.id} />
          : <span className={styles.initial}>{product.name?.[0]?.toUpperCase() || '?'}</span>}
        <span className={styles.tags}>
          <span className={`${styles.rar} ${styles['rar_' + rar.id]}`}>{rar.label}</span>
        </span>
        {outOfStock && <span className={`${styles.stock} ${styles.stockOut}`}>Gone</span>}
        {lowStock && <span className={`${styles.stock} ${styles.stockLow}`}>Only {product.stock} left</span>}
      </div>

      <div className={styles.body}>
        <h3 className={styles.name} title={product.name}>{product.name}</h3>
        {product.description && <p className={styles.desc}>{product.description}</p>}

        <div className={styles.foot}>
          <div className={styles.priceRow}>
            <div className={styles.price}>
              <IconCoin size={18} />
              <b>{fmt(product.cost)}</b>
              <span>pts</span>
            </div>
            {!outOfStock && loggedIn && <small className={styles.note2}>{canAfford ? 'You can afford this' : `${fmt(missing)} pts to go`}</small>}
          </div>

          {!outOfStock && loggedIn && (
            <div className={styles.needBar}><i className={canAfford ? styles.full : ''} style={{ width: (canAfford ? 100 : pct) + '%' }} /></div>
          )}

          <button className={styles.btn} onClick={() => !disabled && onRedeem(product)} disabled={disabled}>
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
  const [board,          setBoard]          = useState([])
  const [recent,         setRecent]         = useState([])
  const [confirmProduct, setConfirmProduct] = useState(null)
  const [redeeming,      setRedeeming]      = useState(false)
  const [toast,          setToast]          = useState(null)

  useEffect(() => {
    const load = () => supabase.from('shop_products').select('*').eq('active', true).order('id')
      .then(({ data, error }) => { if (!error) setProducts(data || []); setLoadingProds(false) })
    load()
    // live stock: refresh while the tab is visible
    const id = setInterval(() => { if (!document.hidden) load() }, 15000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    fetch(`${SE_WORKER_URL}/leaderboard?limit=200`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.users) setBoard(d.users) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const load = () => supabase.from('shop_redeems').select('id, twitch_username, created_at, shop_products(name, image_url)')
      .order('created_at', { ascending: false }).limit(5)
      .then(({ data, error }) => { if (!error && data) setRecent(data) })
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, 15000)
    return () => clearInterval(id)
  }, [])

  let filtered = activeCategory === 'all' ? products : products.filter(p => p.category === activeCategory)
  if (onlyAfford && points !== null) filtered = filtered.filter(p => p.cost <= points && p.stock !== 0)
  if (sort === 'low')  filtered = [...filtered].sort((a, b) => a.cost - b.cost)
  if (sort === 'high') filtered = [...filtered].sort((a, b) => b.cost - a.cost)

  const affordableCount = points === null ? 0 : products.filter(p => p.stock !== 0 && p.cost <= points).length
  // top prize = most expensive item still in stock
  const me = twitchUsername ? twitchUsername.toLowerCase() : null
  const myRank = me ? board.findIndex(u => u.username?.toLowerCase() === me) : -1
  const featured = [...products].filter(p => p.stock !== 0).sort((a, b) => b.cost - a.cost)[0] || null

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const handleRedeem = (product) => {
    if (!user) return showToast('Login to redeem.', 'error')
    setConfirmProduct(product)
  }

  const handleConfirm = async () => {
    if (!confirmProduct || redeeming) return
    setRedeeming(true)
    try {
      const res = await workerPost('/redeem', { productId: confirmProduct.id })
      const data = res.data
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
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Rewards Shop</h1>
          <p className={styles.sub}>Spend the points you earn watching the stream.</p>
        </div>
        <div className={styles.wallet}>
          <IconCoin size={28} />
          {points !== null ? (
            <div>
              <b>{fmt(points)}</b>
              <small>{affordableCount > 0 ? `${affordableCount} ${affordableCount === 1 ? 'prize' : 'prizes'} ready to redeem` : 'Keep watching to unlock a prize'}</small>
            </div>
          ) : (
            <div><b>Log in</b><small>to see your points and redeem</small></div>
          )}
        </div>
      </header>

      {featured && (
        <article className={styles.top} style={{ '--c': featured.color || '#f5c542' }}>
          <div className={styles.topArt}>
            {featured.image_url ? <ProductSpin src={featured.image_url} seed={featured.id} /> : <span className={styles.initial}>{featured.name?.[0]}</span>}
          </div>
          <div className={styles.topText}>
            <div className={styles.topTags}>
              <span className={`${styles.rar} ${styles['rar_' + rarityOf(featured.cost).id]}`}>Top prize</span>
              {featured.stock != null && featured.stock <= 5 && <span className={styles.limited}>Only {featured.stock} left</span>}
            </div>
            <h2>{featured.name}</h2>
            {featured.description && <p>{featured.description}</p>}
          </div>
          <div className={styles.topBuy}>
            <div className={styles.topPrice}><IconCoin size={22} /><b>{fmt(featured.cost)}</b><span>pts</span></div>
            {points !== null && points < featured.cost && (
              <div className={styles.need}>
                <div className={styles.needBar}><i style={{ width: Math.min(100, (points / featured.cost) * 100) + '%' }} /></div>
                <small>{fmt(featured.cost - points)} pts to go</small>
              </div>
            )}
            <button className={styles.topBtn} disabled={points === null || points < featured.cost} onClick={() => handleRedeem(featured)}>
              {points === null ? 'Log in to redeem' : points >= featured.cost ? 'Redeem' : 'Locked'}
            </button>
          </div>
        </article>
      )}

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

      <section className={styles.info}>
        <div className={styles.panel}>
          <div className={styles.rHead}><span>Top points</span><Link className={styles.all} to="/leaderboard">View all</Link></div>
          {board.length === 0 ? <p className={styles.walletNote}>Leaderboard unavailable right now.</p> : (
            <ol className={styles.rows}>
              {board.slice(0, 5).map((u, i) => (
                <li key={u.username} className={`${styles.bRow} ${me && u.username?.toLowerCase() === me ? styles.bMe : ''}`}>
                  <span className={`${styles.rank} ${i < 3 ? styles['rank' + (i + 1)] : ''}`}>{i + 1}</span>
                  <b>{u.username}</b>
                  <span className={styles.bPts}><IconCoin size={12} />{fmt(u.points)}</span>
                </li>
              ))}
              {myRank >= 5 && (
                <li className={`${styles.bRow} ${styles.bMe}`}>
                  <span className={styles.rank}>{myRank + 1}</span>
                  <b>{board[myRank].username} <em>you</em></b>
                  <span className={styles.bPts}><IconCoin size={12} />{fmt(board[myRank].points)}</span>
                </li>
              )}
            </ol>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.rHead}><span>Just redeemed</span><span className={styles.live}><i />Live</span></div>
          {recent.length === 0 ? <p className={styles.walletNote}>No redeems yet. Be the first.</p> : (
            <ul className={styles.rows}>
              {recent.slice(0, 5).map(r => (
                <li key={r.id} className={styles.bRow}>
                  <span className={styles.rThumb}>{r.shop_products?.image_url ? <img src={r.shop_products.image_url} alt="" /> : (r.shop_products?.name?.[0] || '?')}</span>
                  <b>{r.shop_products?.name || 'Prize'}</b>
                  <span className={styles.rWho}>{r.twitch_username} · {ago(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

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