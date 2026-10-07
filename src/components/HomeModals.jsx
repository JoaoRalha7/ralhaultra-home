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
  const [copied, setCopied] = useState(false)
  const amount = String(c.featured_offer_amount || '').trim()
  const chips = String(c.featured_offer_details || '').split(/[·|•]/).map(x => x.trim()).filter(Boolean)
  const size = amount.length <= 6 ? 'xl' : amount.length <= 14 ? 'lg' : 'md'

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleClaim = () => {
    onRedirect(c.claim_url, c.promo_code)
    onClose()
  }
  const copy = () => {
    try { navigator.clipboard.writeText(String(c.promo_code)) } catch { /* clipboard unavailable */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fmOverlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Exclusive offer">
      <div className="fmCard" onClick={e => e.stopPropagation()} style={{ '--ac': accent }}>
        <div className="fmSparks" aria-hidden="true">
          {[10, 25, 40, 58, 72, 88].map((l, i) => <i key={l} style={{ left: `${l}%`, animationDelay: `${(i * 1.1) % 5}s`, animationDuration: `${5 + (i % 3) * 2}s` }} />)}
        </div>
        <span className="fmTag">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7 7 .6-5.3 4.7 1.7 7.2L12 17.8 5.6 21.5l1.7-7.2L2 9.6 9 9z" /></svg>
          Exclusive offer
        </span>
        <button className="fmClose" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>

        <div className="fmLogo">
          {c.logo_url ? <img src={c.logo_url} alt={c.name} /> : <span>{c.name}</span>}
        </div>

        <span className="fmPill">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="8" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1.5S10 8 12 8zm0 0c2-4 6-4 6-1.5S14 8 12 8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
          {c.featured_offer_title || 'Exclusive bonus'}
        </span>

        <div className="fmHero">
          {amount.length <= 8 && <span className="fmGhost" aria-hidden="true">{amount}</span>}
          <div className={`fmAmount ${size}`}>{amount || 'Bonus'}</div>
        </div>

        {chips.length > 0 && (
          <div className="fmChips">{chips.map(t => <span key={t}>{t}</span>)}</div>
        )}

        <div className="fmTear" aria-hidden="true"><i /><i /></div>

        {c.promo_code && (
          <button type="button" className={`fmCode${copied ? ' done' : ''}`} onClick={copy}>
            <span><small>Promo code</small><b>{c.promo_code}</b></span>
            <i>{copied ? 'Copied' : 'Copy'}</i>
          </button>
        )}

        <button type="button" className="fmCta" onClick={handleClaim}>
          Claim offer
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" className="fmLater" onClick={onClose}>Maybe later</button>
      </div>
    </div>
  )
}
