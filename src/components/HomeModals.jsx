import { useEffect, useRef, useState } from 'react';
import styles from '../legacy/Home.module.css';

const TWITCH_CHANNEL = 'jralha_';

export function RedirectModal({ url, promo, onClose }) {
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
            <p className={styles.redirectPromoCode}>{promo}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function TwitchPlayerModal({ type, id, title, meta, onClose }) {
  const iframeRef = useRef(null)
  const PARENT = window.location.hostname === 'localhost'
    ? 'localhost'
    : window.location.hostname.includes('vercel.app')
      ? 'ralha-react-ultra-bwxl.vercel.app'
      : 'jralha.com'

  const src = type === 'clip'
    ? `https://clips.twitch.tv/embed?clip=${id}&parent=${PARENT}&autoplay=true`
    : `https://player.twitch.tv/?video=${id}&parent=${PARENT}&autoplay=true`

  const handleFullscreen = () => {
    const el = iframeRef.current
    if (!el) return
    if (el.requestFullscreen) el.requestFullscreen()
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
  }

  // Fechar com ESC
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.playerOverlay} onClick={onClose}>
      <div className={styles.playerBox} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.playerHeader}>
          <div className={styles.playerMeta}>
            <i className="bx bxl-twitch" style={{ color: '#9147ff', fontSize: 18 }} />
            <span className={styles.playerTitle}>{title}</span>
            {meta && <span className={styles.playerMetaText}>{meta}</span>}
          </div>
          <div className={styles.playerActions}>
            <button className={styles.playerBtn} onClick={handleFullscreen} title="Fullscreen">
              <i className="bx bx-fullscreen" />
            </button>
            <button className={styles.playerBtn} onClick={onClose} title="Fechar">
              <i className="bx bx-x" />
            </button>
          </div>
        </div>

        {/* Player */}
        <div className={styles.playerWrap}>
          <iframe
            ref={iframeRef}
            src={src}
            className={styles.playerIframe}
            allowFullScreen
            allow="autoplay; fullscreen"
            frameBorder="0"
            scrolling="no"
          />
        </div>
      </div>
    </div>
  )
}

export function FeaturedOfferModal({ casino: c, onClose, onRedirect }) {
  const accent = c.featured_accent_color || '#3b82f6'

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleClaim = () => {
    onRedirect(c.claim_url, c.promo_code)
    onClose()
  }

  return (
    <div className={styles.featuredOverlay} onClick={onClose}>
      <div
        className={styles.featuredBox}
        onClick={e => e.stopPropagation()}
        style={{ '--accent': accent }}
      >
        <div className={styles.featuredGlow} />
        <div className={styles.featuredTopBar}>
          <i className="bx bxs-star" /> EXCLUSIVE OFFER <i className="bx bxs-star" />
        </div>
        <button className={styles.featuredClose} onClick={onClose}>
          <i className="bx bx-x" />
        </button>

        <div className={styles.featuredBody}>
          <img src={c.logo_url} alt={c.name} className={styles.featuredLogo} />

          <div className={styles.featuredOfferBox}>
            <span className={styles.featuredOfferTag}>
              <i className="bx bx-gift" /> {c.featured_offer_title || 'Exclusive Bonus'}
            </span>
            <p className={styles.featuredOfferAmount}>{c.featured_offer_amount}</p>
            {c.featured_offer_details && (
              <p className={styles.featuredOfferDetails}>{c.featured_offer_details}</p>
            )}

            {c.promo_code && (
              <div className={styles.featuredPromoWrap}>
                <span className={styles.featuredPromoLabel}>Promo Code</span>
                <span className={styles.featuredPromoCode}>{c.promo_code}</span>
              </div>
            )}
          </div>

          <button className={styles.featuredCta} onClick={handleClaim}>
            Claim {c.featured_offer_amount || 'Bonus'} Now <i className="bx bx-chevron-right" />
          </button>
        </div>
      </div>
    </div>
  )
}
