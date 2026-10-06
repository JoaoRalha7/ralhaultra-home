import { useState } from 'react'
import styles from './CasinoCard.module.css'

const FALLBACK_BANNER = 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=800&q=80'

export default function CasinoCard({ casino: c, methodsBySlug, onInfo, onRedirect, animDelay = 0 }) {
  const [imgError, setImgError] = useState(false)
  const [copied,   setCopied]   = useState(false)

  const features = Array.isArray(c.features) ? c.features : []
  const feat1 = (features[0] ?? '').toString().trim()
  const feat2 = (features[1] ?? '').toString().trim()

  const promo = (c.promo_code ?? '').toString().trim()
  const ci    = c.casino_info || {}

  const bannerUrl = (!imgError && c.banner_url) ? c.banner_url : FALLBACK_BANNER

  const stats = [
    ci.min_deposit ? { icon: 'card',    val: ci.min_deposit, label: 'Min. Deposit'        } : null,
    ci.cashback    ? { icon: 'reload',  val: ci.cashback,    label: 'Cashback'             } : null,
    ci.withdraw    ? { icon: 'clock',   val: ci.withdraw,    label: 'Withdrawal Speed'     } : null,
  ].filter(Boolean)

  function handleCopyPromo(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(promo).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={styles.card} style={{ animationDelay: `${animDelay}ms` }}>

      {/* ── BANNER — tudo sobreposto ── */}
      <div className={styles.banner}>
        <img src={bannerUrl} alt={c.name} className={styles.bannerImg} onError={() => setImgError(true)} loading="lazy" />
        <div className={styles.bannerOverlay} />

        <div className={styles.badgeStack}>
          {(c.is_hot || c.is_new) && (
            <span className={`${styles.badge} ${c.is_hot ? styles.badgeHot : styles.badgeNew}`}>
              <span className={styles.badgeDot} />
              {c.is_hot ? 'HOT' : 'NEW'}
            </span>
          )}
          {c.is_freespins && (
            <span className={`${styles.badge} ${styles.badgeFreespins}`}>
              <span className={styles.badgeDot} />
              FREESPINS
            </span>
          )}
        </div>

        <button className={styles.infoBtn} onClick={() => onInfo(c)}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/>
          </svg>
        </button>

        <div className={styles.logoWrap}>
          {c.logo_url && <img src={c.logo_url} alt={c.name} className={styles.logo} />}
        </div>

        {/* Bonus + stats + promo — sobrepostos no fundo */}
        <div className={styles.bottomOverlay}>
          {feat1 && (
            <div className={styles.bonusMain}>{feat1}</div>
          )}
          {feat2 && (
            <div className={styles.bonusSub}>{feat2}</div>
          )}

          <div className={styles.metaRow}>
            {/* Stats com ícones */}
            {stats.map(({ icon, val, label }) => (
              <div key={icon} className={styles.metaItem}>
                {icon === 'card' && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                )}
                {icon === 'reload' && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                )}
                {icon === 'clock' && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                )}
                <span>{val}</span>
                <span className={styles.metaItemTooltip}>{label}</span>
              </div>
            ))}

            {/* Divider se houver stats e promo */}
            {stats.length > 0 && promo && (
              <div className={styles.metaDivider} />
            )}

            {/* Promo code com copy */}
            {promo ? (
              <button
                className={`${styles.metaPromo} ${copied ? styles.metaPromoCopied : ''}`}
                onClick={handleCopyPromo}
              >
                {/* Tag / ticket SVG */}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                <span>{copied ? 'Copied!' : promo}</span>
                <span className={styles.promoTooltip}>
                  {copied ? 'Copied!' : 'Click to copy'}
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className={styles.footer}>
        <button className={styles.claimBtn} onClick={() => onRedirect?.(c.claim_url, c.promo_code)}>
          CLAIM BONUS
        </button>
      </div>

    </div>
  )
}