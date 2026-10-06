import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './InfoModal.module.css'

function safeText(x) { return (x ?? '').toString() }

function highlightCode(input) {
  const raw = safeText(input).trim()
  return raw.replace(
    /\b(promo\s*code|code)\b(\s*[:=]?\s*)([A-Z0-9_-]+)/i,
    (_, k, sep, code) =>
      `${k}${sep}<span class="${styles.inlineCode}">${code}</span>`
  )
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }
  }
  return (
    <button className={styles.promoCopy} onClick={copy} title="Copiar">
      <i className={`bx ${copied ? 'bx-check' : 'bx-copy'}`} />
    </button>
  )
}

/* ─── Payment Carousel ─────────────────────────────────── */
const ITEMS_PER_PAGE = 3

function PayCarousel({ payments, methodsBySlug, paymentMins, minDeposit }) {
  const pages = []
  for (let i = 0; i < payments.length; i += ITEMS_PER_PAGE) {
    pages.push(payments.slice(i, i + ITEMS_PER_PAGE))
  }
  const totalPages = pages.length

  const [page, setPage] = useState(0)
  const trackRef  = useRef(null)
  const startXRef = useRef(null)
  const dragDXRef = useRef(0)
  const isDragging = useRef(false)

  /* go to a page */
  const goTo = useCallback((p) => {
    setPage(Math.max(0, Math.min(p, totalPages - 1)))
  }, [totalPages])

  /* pointer events — mouse + touch */
  const onPointerDown = (e) => {
    startXRef.current = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX
    dragDXRef.current = 0
    isDragging.current = true
    if (trackRef.current) trackRef.current.classList.add(styles.dragging)
  }

  const onPointerMove = (e) => {
    if (!isDragging.current) return
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX
    dragDXRef.current = clientX - startXRef.current
    if (trackRef.current) {
      const base = -page * 100
      trackRef.current.style.transform = `translateX(calc(${base}% + ${dragDXRef.current}px))`
    }
  }

  const onPointerUp = () => {
    if (!isDragging.current) return
    isDragging.current = false
    if (trackRef.current) {
      trackRef.current.classList.remove(styles.dragging)
      trackRef.current.style.transform = ''
    }
    const dx = dragDXRef.current
    if (dx < -40) goTo(page + 1)
    else if (dx > 40) goTo(page - 1)
  }

  /* sync translate when page changes */
  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(-${page * 100}%)`
    }
  }, [page])

  if (totalPages === 0) return <div className={styles.empty}>No payment methods.</div>

  return (
    <div className={styles.payCarouselWrap}>
      <div
        className={styles.payCarousel}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      >
        <div ref={trackRef} className={styles.payTrack}>
          {pages.map((pageItems, pi) => (
            <div key={pi} className={styles.payPage}>
              {pageItems.map((slug, i) => {
                const m      = methodsBySlug?.[slug]
                const name   = m?.name || slug
                const minDep = safeText(paymentMins?.[slug] || minDeposit).trim()
                return (
                  <div key={i} className={styles.payCard}>
                    <div className={styles.payRowTop}>
                      <div className={styles.payIco}>
                        {m?.icon_url
                          ? <img src={m.icon_url} alt={name} loading="lazy" />
                          : <span className={styles.payFallback}>{(slug || '').slice(0,2).toUpperCase()}</span>
                        }
                      </div>
                      <span className={styles.payName}>{name}</span>
                    </div>
                    <div className={styles.payDivider} />
                    <div className={styles.payRowBottom}>
                      <span className={styles.payMin}>Min:</span>
                      <span className={styles.payVal}>{minDep || '—'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Dots — only show if more than 1 page */}
      {totalPages > 1 && (
        <div className={styles.payDots}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              className={`${styles.payDot} ${i === page ? styles.active : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Page ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Main Modal ───────────────────────────────────────── */
export default function InfoModal({ casino: c, methodsBySlug, onClose, onRedirect }) {
  const overlayRef = useRef()
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    setFlipped(false)
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.documentElement.classList.add('modal-open')
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('modal-open')
      document.body.classList.remove('modal-open')
    }
  }, [onClose, c?.id])

  if (!c) return null

  const ci       = c.casino_info || {}
  const bonus    = Array.isArray(c.welcome_bonus) ? c.welcome_bonus : []
  const vip      = Array.isArray(c.vip_benefits)  ? c.vip_benefits  : []
  const how      = Array.isArray(c.how_to_claim)  ? c.how_to_claim  : []
  const payments = Array.isArray(c.payments)       ? c.payments       : []
  const promo    = safeText(c.promo_code).trim()

  const heroStats = [
    { label: 'GAMES',        val: ci.games,        accent: null,     icon: 'bx-joystick' },
    { label: 'MIN. DEPOSIT', val: ci.min_deposit,   accent: 'green',  icon: 'bx-coin-stack' },
    { label: 'CASHBACK',     val: ci.cashback,      accent: 'yellow', icon: 'bx-refresh' },
    { label: 'WITHDRAWAL',   val: ci.withdraw,      accent: 'green',  icon: 'bx-wallet' },
  ].filter(s => safeText(s.val).trim())

  return (
    <div
      className={`${styles.overlay} ${styles.isOpen}`}
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true">

        {/* HERO */}
        <div className={styles.hero}>
          <div className={styles.heroAccent} />
          <div className={styles.heroAccent2} />

          <div className={styles.heroTop}>
            <div className={styles.heroBrand}>
              <div className={styles.logoWrap}>
                <img src={c.logo_url} alt={c.name} className={styles.logo} />
              </div>
              <div className={styles.heroInfo}>
                <div className={styles.heroNameRow}>
                  <div className={styles.heroName}>{c.name}</div>
                  {(c.is_hot || c.is_new) && (
                    <span className={`${styles.tag} ${c.is_hot ? styles.tagHot : styles.tagNew}`}>
                      <span className={styles.tagDot} />
                      {c.is_hot ? 'HOT' : 'NEW'}
                    </span>
                  )}
                </div>
                {(ci.established || ci.license) && (
                  <div className={styles.heroMeta}>
                    {[ci.established && `Est. ${ci.established}`, ci.license].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
          </div>

          {heroStats.length > 0 && (
            <div className={styles.heroStats}>
              {heroStats.map(({ label, val, accent, icon }) => (
                <div key={label} className={styles.hStat}>
                  <div className={styles.hStatLabel}>
                    <i className={`bx ${icon}`} />
                    {label}
                  </div>
                  <div className={`${styles.hStatVal} ${accent ? styles[accent] : ''}`}>{val}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.heroDivider} />

        {/* BODY */}
        <div className={styles.body}>

          {/* COLUNA ESQUERDA */}
          <div className={styles.colLeft}>

            <div className={styles.secLabel}><i className="bx bx-gift" />WELCOME BONUS</div>
            <div className={styles.bonusGrid}>
              {bonus.length > 0
                ? bonus.slice(0, 6).map((s, i) => {
                    const pct      = safeText(s?.pct).trim()
                    const upTo     = safeText(s?.up_to).trim()
                    const fs       = safeText(s?.fs).trim()
                    const headline = `${pct} ${upTo}`.trim() || '—'
                    return (
                      <div key={i} className={styles.bonusCard}>
                        <span className={styles.bonusBadge}>{i + 1}</span>
                        <div className={styles.bonusText}>
                          <div className={styles.bonusMain}>{headline}</div>
                          {fs && <div className={styles.bonusSub}>{fs}</div>}
                        </div>
                      </div>
                    )
                  })
                : <div className={styles.empty}>No welcome bonus yet.</div>
              }
            </div>

            {/* Flip card */}
            <div className={`${styles.flipCard} ${flipped ? styles.flipped : ''}`}>
              <div className={styles.flipInner}>

                {/* FRONT — How to Claim */}
                <div className={styles.flipFront}>
                  <div className={styles.flipHeader}>
                    <div className={styles.flipHeaderLabel}>
                      <i className="bx bx-list-check" />
                      HOW TO CLAIM
                    </div>
                    <button
                      className={styles.flipBtn}
                      onClick={() => setFlipped(true)}
                      title="VIP Benefits"
                    >
                      <i className="bx bx-transfer" />
                    </button>
                  </div>
                  <div className={styles.howList}>
                    {how.length > 0
                      ? how.slice(0, 8).map((t, i) => {
                          const isCode = /\bcode\b/i.test(t) || /\bpromo\b/i.test(t)
                          return (
                            <div key={i} className={`${styles.howItem} ${isCode ? styles.howCode : ''}`}>
                              <div className={styles.howStep}>{i + 1}</div>
                              <span dangerouslySetInnerHTML={{ __html: highlightCode(t) }} />
                            </div>
                          )
                        })
                      : <div className={styles.empty}>No steps yet.</div>
                    }
                  </div>
                </div>

                {/* BACK — VIP Benefits */}
                <div className={styles.flipBack}>
                  <div className={styles.flipHeader}>
                    <div className={styles.flipHeaderLabel}>
                      <i className="bx bx-crown" />
                      VIP BENEFITS
                    </div>
                    <button
                      className={styles.flipBtn}
                      onClick={() => setFlipped(false)}
                      title="How to Claim"
                    >
                      <i className="bx bx-transfer" />
                    </button>
                  </div>
                  <div className={styles.vipList}>
                    {vip.length > 0
                      ? vip.map((x, i) => (
                          <div key={i} className={styles.vipItem}>
                            <i className="bx bx-crown" />
                            <span>{x}</span>
                          </div>
                        ))
                      : <div className={styles.empty}>No VIP benefits yet.</div>
                    }
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* COLUNA DIREITA */}
          <div className={styles.colRight}>

            <div className={styles.secLabel}><i className="bx bx-credit-card" />PAYMENT METHODS</div>
            <PayCarousel
              payments={payments}
              methodsBySlug={methodsBySlug}
              paymentMins={c?.payment_mins}
              minDeposit={ci.min_deposit}
            />

            <div className={styles.secLabel}><i className="bx bx-user" />PLAYER INFO</div>
            <div className={styles.playerGrid}>
              {[
                ['KYC',     c.kyc_required ? 'Required' : 'Not required', 'bx-badge-check'],
                ['VPN',     c.vpn_allowed  ? 'Allowed'  : 'Not allowed',  'bx-shield'],
                ['SUPPORT', safeText(c.support).trim() || '—',            'bx-headphone'],
              ].map(([k, v, ico]) => (
                <div key={k} className={styles.playerItem}>
                  <div className={styles.playerKey}>
                    <i className={`bx ${ico}`} />
                    {k}
                  </div>
                  <div className={styles.playerVal}>{v}</div>
                </div>
              ))}
            </div>

            <div className={styles.secLabel}><i className="bx bx-purchase-tag" />PROMO CODE</div>
            {promo ? (
              <div className={styles.promo}>
                <div className={styles.promoHead}>
                  <div className={styles.promoTitle}>
                    <i className="bx bx-purchase-tag" />
                    <span>PROMO CODE</span>
                  </div>
                  {c.promo_required && (
                    <span className={styles.promoBadge}>REQUIRED</span>
                  )}
                </div>
                <div className={styles.promoBox}>
                  <span className={styles.promoCode}>{promo}</span>
                  <CopyBtn text={promo} />
                </div>
                <div className={styles.promoSub}>USE THIS CODE ON SIGNUP</div>
              </div>
            ) : (
              <div className={styles.promoEmpty}>
                <div className={styles.promoEmptyTitle}>No promo code required</div>
                <div className={styles.promoEmptySub}>Just claim and deposit.</div>
              </div>
            )}

          </div>
        </div>

        {/* CTA */}
        <div className={styles.foot}>
          <button
            className={styles.ctaBtn}
            onClick={() => onRedirect?.(c.claim_url, c.promo_code)}
          >
            <i className="bx bx-gift" />
            CLAIM BONUS NOW
          </button>
        </div>

      </div>
    </div>
  )
}