import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import CasinoCard from '../components/CasinoCard'
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

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Offers() {
  const [casinos, setCasinos]               = useState([])
  const [methodsBySlug, setMethodsBySlug]   = useState({})
  const [loading, setLoading]               = useState(true)
  const [selectedCasino, setSelectedCasino] = useState(null)
  const [redirect, setRedirect]             = useState(null)

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
        <h1 className={styles.title}>CASINO OFFERS</h1>
        <p className={styles.sub}>Best offers and bonuses exclusive for you</p>
      </div>

      {casinos.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🎰</div>
          <p>No offers available at the moment.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {casinos.map((casino, i) => (
            <CasinoCard
              key={casino.id}
              casino={casino}
              methodsBySlug={methodsBySlug}
              onInfo={setSelectedCasino}
              onRedirect={handleRedirect}
              animDelay={i * 90}
            />
          ))}
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