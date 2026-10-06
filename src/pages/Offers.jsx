import { useState, useEffect, useCallback, useRef } from 'react'
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
    ? <img src={c.logo_url} alt={c.name} className={styles.logoImg} style={{ width: size, height: size }} onError={() => setBad(true)} />
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

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Offers() {
  const [casinos, setCasinos]               = useState([])
  const [methodsBySlug, setMethodsBySlug]   = useState({})
  const [loading, setLoading]               = useState(true)
  const [selectedCasino, setSelectedCasino] = useState(null)
  const [redirect, setRedirect]             = useState(null)
  const [filter, setFilter]                 = useState('all')
  const [idx, setIdx]                       = useState(0)
  const [auto, setAuto]                     = useState(true)
  const [tick, setTick]                     = useState(0)   // restarts the progress bar
  const hover = useRef(false)

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
  const n = list.length
  const cur = list[Math.min(idx, Math.max(0, n - 1))]

  useEffect(() => { setIdx(0); setTick(t => t + 1) }, [filter])

  // auto-rotate (paused on hover, stopped after a manual pick)
  useEffect(() => {
    if (!auto || n < 2) return
    const t = setTimeout(() => { if (!hover.current) { setIdx(i => (i + 1) % n); setTick(x => x + 1) } else setTick(x => x + 1) }, ROTATE_MS)
    return () => clearTimeout(t)
  }, [auto, n, tick])

  const pick = i => { setIdx(i); setAuto(false); setTick(t => t + 1) }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Loading offers...</span>
      </div>
    )
  }

  const ci = cur?.casino_info || {}
  const feats = Array.isArray(cur?.features) ? cur.features : []
  const bonus = txt(feats[0]), bonus2 = txt(feats[1])
  const stats = cur ? [
    ci.min_deposit && [Ico.card, 'Min. deposit', ci.min_deposit],
    ci.cashback    && [Ico.loop, 'Cashback', ci.cashback],
    ci.withdraw    && [Ico.clock, 'Withdrawal', ci.withdraw],
    ci.license     && [Ico.shield, 'License', ci.license],
  ].filter(Boolean) : []
  const pays = Array.isArray(cur?.payments) ? cur.payments.slice(0, 6) : []

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

      {!cur ? (
        <div className={styles.empty}>
          <p>No offers available{filter !== 'all' ? ' for this filter' : ' at the moment'}.</p>
          {filter !== 'all' && <button type="button" className={styles.linkBtn} onClick={() => setFilter('all')}>Show all offers</button>}
        </div>
      ) : (
        <>
          <section className={styles.show} onMouseEnter={() => { hover.current = true }} onMouseLeave={() => { hover.current = false }}>
            <article className={styles.hero} key={cur.id}>
              <div className={styles.heroBg} style={cur.banner_url ? { backgroundImage: `url(${cur.banner_url})` } : bannerBg(cur)} />
              <div className={styles.heroShade} />
              <div className={styles.heroTop}>
                <div className={styles.brand}>
                  <Logo c={cur} size={52} />
                  <div><strong>{cur.name}</strong><small>{String(idx + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</small></div>
                </div>
                <div className={styles.tags}>
                  <Tag c={cur} />
                  {cur.is_freespins && <span className={`${styles.tag} ${styles.tagFs}`}>FREE SPINS</span>}
                </div>
              </div>

              <div className={styles.heroBody}>
                <small className={styles.kicker}>Exclusive welcome offer</small>
                <h2 className={styles.bonus}>{bonus || cur.name}</h2>
                {bonus2 && <p className={styles.bonus2}>{bonus2}</p>}

                {stats.length > 0 && (
                  <div className={styles.stats}>
                    {stats.map(([icon, label, val]) => (
                      <div key={label} className={styles.stat}>{icon}<div><small>{label}</small><b>{val}</b></div></div>
                    ))}
                  </div>
                )}

                <div className={styles.actions}>
                  <button type="button" className={styles.claim} onClick={() => handleRedirect(cur.claim_url, cur.promo_code)}>
                    Claim bonus {Ico.right}
                  </button>
                  <button type="button" className={styles.more} onClick={() => setSelectedCasino(cur)}>{Ico.info} Full details</button>
                  <PromoChip code={txt(cur.promo_code)} big />
                </div>

                {pays.length > 0 && (
                  <div className={styles.pays} aria-label="Payment methods">
                    {pays.map(slug => {
                      const m = methodsBySlug[slug]
                      return (
                        <span key={slug} className={styles.pay} title={m?.name || slug}>
                          {m?.icon_url ? <img src={m.icon_url} alt={m?.name || slug} /> : (m?.name || slug).slice(0, 2).toUpperCase()}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
              {auto && n > 1 && <span key={tick} className={styles.progress} style={{ animationDuration: `${ROTATE_MS}ms` }} />}
            </article>

            <ol className={styles.rail} aria-label="All offers">
              {list.map((c, i) => {
                const f = Array.isArray(c.features) ? txt(c.features[0]) : ''
                return (
                  <li key={c.id}>
                    <button type="button" className={`${styles.railItem} ${i === idx ? styles.railOn : ''}`} onClick={() => pick(i)} aria-current={i === idx}>
                      <Logo c={c} size={42} />
                      <span className={styles.railTxt}>
                        <b>{c.name}</b>
                        <small>{f || 'Exclusive offer'}</small>
                      </span>
                      <Tag c={c} />
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>

          {n > 1 && (
            <section className={styles.cmp} aria-label="Compare offers">
              <h2 className={styles.h2}>Compare offers</h2>
              <div className={styles.cmpWrap}>
                <table className={styles.cmpTable}>
                  <thead>
                    <tr><th>Casino</th><th>Bonus</th><th>Min. deposit</th><th>Cashback</th><th>Withdrawal</th><th>Code</th><th /></tr>
                  </thead>
                  <tbody>
                    {list.map((c, i) => {
                      const k = c.casino_info || {}
                      const f = Array.isArray(c.features) ? txt(c.features[0]) : ''
                      return (
                        <tr key={c.id} className={i === idx ? styles.cmpOn : ''}>
                          <td><button type="button" className={styles.cmpName} onClick={() => { pick(i); window.scrollTo?.({ top: 0, behavior: 'smooth' }); document.querySelector('main')?.scrollTo?.({ top: 0, behavior: 'smooth' }) }}><Logo c={c} size={32} />{c.name}<Tag c={c} /></button></td>
                          <td className={styles.cmpBonus}>{f || '-'}</td>
                          <td>{k.min_deposit || '-'}</td>
                          <td>{k.cashback || '-'}</td>
                          <td>{k.withdraw || '-'}</td>
                          <td><PromoChip code={txt(c.promo_code)} /></td>
                          <td><button type="button" className={styles.cmpClaim} onClick={() => handleRedirect(c.claim_url, c.promo_code)}>Claim</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
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
