import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { casinoToOffer } from '../data/casinoToOffer'
import { Icon } from '../components/Icon'
import InfoModal from '../components/InfoModal'
import styles from './Offers.module.css'

// ── Redirect Modal ─────────────────────────────────────────────────────────────
function RedirectModal({ url, promo, onClose }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(promo) } catch {
      const ta = document.createElement('textarea')
      ta.value = promo; document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleContinue = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <div className={styles.redirectOverlay} onClick={onClose}>
      <div className={styles.redirectBox} onClick={e => e.stopPropagation()}>
        <button className={styles.redirectClose} onClick={onClose}>
          <i className="bx bx-x" />
        </button>
        <h2 className={styles.redirectTitle}>You're being redirected</h2>
        <p className={styles.redirectSub}>
          You are now leaving <strong>jralha.com</strong>, please click the button below to continue
        </p>
        <button className={styles.redirectCta} onClick={handleContinue}>
          CONTINUE
        </button>
        {promo && (
          <div className={styles.redirectPromo}>
            <p className={styles.redirectPromoLabel}>Remember to use the code:</p>
            <div className={styles.redirectPromoRow}>
              <span className={styles.redirectPromoCode}>{promo}</span>
              <button
                className={`${styles.redirectCopyBtn} ${copied ? styles.redirectCopyDone : ''}`}
                onClick={handleCopy}
                title="Copy code"
              >
                <i className={`bx ${copied ? 'bx-check' : 'bx-copy'}`} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const FILTERS = [
  ['all',  'All offers'],
  ['hot',  'Hot'],
  ['new',  'New'],
  ['fs',   'Free spins'],
]
const ROTATE_MS = 9000

const txt = v => (v ?? '').toString().trim()
function hue(str) { let h = 0; for (const ch of str || '') h = (h * 31 + ch.charCodeAt(0)) % 360; return h }
function bannerBg(c) {
  const h = hue(c.name)
  return { background: `radial-gradient(90% 120% at 80% 0%, hsl(${h} 70% 38% / .75), transparent 60%), linear-gradient(135deg, hsl(${h} 45% 14%), #0b0e14)` }
}
function Logo({ c, size = 44 }) {
  const [bad, setBad] = useState(false)
  return c.logo_url && !bad
    ? <img src={c.logo_url} alt={c.name} className={styles.logoImg} onError={() => setBad(true)} />
    : <span className={styles.logoFb} style={{ width: size, height: size }}>{(c.name || '?').slice(0, 2).toUpperCase()}</span>
}
function Tag({ c }) {
  if (c.is_hot) return <span className={`${styles.tag} ${styles.tagHot}`}>HOT</span>
  if (c.is_new) return <span className={`${styles.tag} ${styles.tagNew}`}>NEW</span>
  return null
}
const Ico = {
  card:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  loop:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg>,
  clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  shield:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  tag:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1"/></svg>,
  info:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  right: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>,
}

function PromoChip({ code, big }) {
  const [copied, setCopied] = useState(false)
  if (!code) return null
  const copy = async e => {
    e.stopPropagation()
    try { await navigator.clipboard.writeText(code) } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button type="button" className={`${styles.promo} ${big ? styles.promoBig : ''} ${copied ? styles.promoOk : ''}`} onClick={copy} title="Click to copy">
      {Ico.tag}<span>{copied ? 'Copied!' : code}</span>
    </button>
  )
}

// ── Offer card (vertical, clean) ──────────────────────────────────────────────
function OfferCard({ c, i, onInfo, onClaim }) {
  const o = casinoToOffer(c, i)
  const code = txt(c.promo_code)
  const style = { '--ac': o.accent, '--c1': o.c1, '--c2': o.c2 }
  const hasBig = !!o.big
  return (
    <article className={styles.oc} style={style}>
      <div className={styles.ocBanner}>
        {c.banner_url && <div className={styles.ocBg} style={{ backgroundImage: `url(${c.banner_url})` }} />}
        <div className={styles.ocTags}>
          {!!c.is_hot && <span className={styles.ocTag}><i />HOT</span>}
          {!!c.is_new && <span className={styles.ocTag}><i />NEW</span>}
        </div>
        {c.logo_url ? <Logo c={c} /> : <strong className={styles.ocBrand}>{c.name}</strong>}
      </div>
      <div className={styles.ocBody}>
        <div className={styles.ocOffer}>
          <small>{hasBig ? (o.rest || 'Exclusive offer') : 'Exclusive offer'}</small>
          <b>{hasBig ? o.big : o.headline}</b>
          {o.sub && <span>{o.sub}</span>}
        </div>
        {o.stats.length > 0 && (
          <div className={styles.ocRows}>
            {o.stats.slice(0, 3).map((st) => (
              <div key={st.key} className={styles.ocRow}><span><Icon name={st.icon} />{st.label}</span><b>{st.value}</b></div>
            ))}
          </div>
        )}
        {code && <div className={styles.ocCodeRow}><small>Code</small><PromoChip code={code} /></div>}
        <div className={styles.ocBtns}>
          <button type="button" className={styles.ocClaim} onClick={() => onClaim(c)}>Claim offer{Ico.right}</button>
          <button type="button" className={styles.ocPlus} aria-label={`More about ${c.name}`} title="More info" onClick={() => onInfo({ ...c, _accent: o.accent })}>{Ico.info}</button>
        </div>
      </div>
    </article>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Offers() {
  const [casinos, setCasinos]               = useState([])
  const [methodsBySlug, setMethodsBySlug]   = useState({})
  const [loading, setLoading]               = useState(true)
  const [selectedCasino, setSelectedCasino] = useState(null)
  const [redirect, setRedirect]             = useState(null)
  const [filter, setFilter]                 = useState('all')

  const handleRedirect = (url, promo) =>
    setRedirect({ url, promo: (promo ?? '').toString().trim() })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: methods } = await supabase
        .from('deposit_methods')
        .select('slug,name,icon_url')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      const bySlug = {}
      ;(methods || []).forEach(m => { bySlug[m.slug] = { name: m.name, icon_url: m.icon_url } })
      setMethodsBySlug(bySlug)

      const { data, error } = await supabase
        .from('casinos')
        .select('*')
        .eq('is_active', true)
        .order('is_hot', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      setCasinos(data || [])
    } catch (err) {
      console.error('Error loading casinos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const list = casinos.filter(c =>
    filter === 'all' || (filter === 'hot' && c.is_hot) || (filter === 'new' && c.is_new) || (filter === 'fs' && c.is_freespins))

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Loading offers...</span>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Casinos &amp; Offers</h1>
          <p className={styles.sub}>Hand-picked casinos with exclusive bonuses for the community.</p>
        </div>
        <div className={styles.chips} role="tablist" aria-label="Filter offers">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id}
              className={`${styles.chip} ${filter === id ? styles.chipOn : ''}`} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className={styles.empty}>
          <p>No offers available{filter !== 'all' ? ' for this filter' : ' at the moment'}.</p>
          {filter !== 'all' && <button type="button" className={styles.linkBtn} onClick={() => setFilter('all')}>Show all offers</button>}
        </div>
      ) : (
        <div className={styles.carWrap}>
          <div className={styles.track}>
            {list.map((c, i) => (
              <OfferCard key={c.id} c={c} i={i} onInfo={setSelectedCasino} onClaim={x => handleRedirect(x.claim_url, x.promo_code)} />
            ))}
          </div>
        </div>
      )}

      {selectedCasino && (
        <InfoModal
          casino={selectedCasino}
          methodsBySlug={methodsBySlug}
          onClose={() => setSelectedCasino(null)}
          onRedirect={handleRedirect}
        />
      )}

      {redirect && (
        <RedirectModal
          url={redirect.url}
          promo={redirect.promo}
          onClose={() => setRedirect(null)}
        />
      )}
    </div>
  )
}
