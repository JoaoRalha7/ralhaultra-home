import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATUS_LABELS = { pending: 'Pendente', done: 'Entregue', rejected: 'Rejeitado' }
const STATUS_COLORS = { pending: '#f5a623', done: '#21d16e', rejected: '#f04f4f' }

function fmtTimeAgo(d) {
  if (!d) return '—'
  const secs = Math.floor((Date.now() - new Date(d)) / 1000)
  if (secs < 60)  return 'agora mesmo'
  if (secs < 3600) return Math.floor(secs / 60) + 'm atrás'
  if (secs < 86400) return Math.floor(secs / 3600) + 'h atrás'
  return Math.floor(secs / 86400) + 'd atrás'
}
import styles from './Dashhome.module.css'

const CARDS = [
  {
    to:     '/dashboard/hunt',
    label:  'Bonus Hunt',
    sub:    'Gerir slots e bónus',
    accent: 'blue',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
    ),
  },
  {
    to:     '/dashboard/slots',
    label:  'Slots',
    sub:    'Biblioteca de slots',
    accent: 'green',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>
      </svg>
    ),
  },
  {
    to:     '/dashboard/torneios',
    label:  'Torneios',
    sub:    'Rankings e resultados',
    accent: 'amber',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
        <path d="M12 17v4"/><path d="M8 21h8"/>
        <path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/>
      </svg>
    ),
  },
  {
    to:     '/dashboard/chill',
    label:  'Chill',
    sub:    'Modo relaxado',
    accent: 'slate',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
        <line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
      </svg>
    ),
  },
  {
    to:     '/dashboard/barra',
    label:  'Barra OBS',
    sub:    'Casino, modo e activity',
    accent: 'purple',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 2H8"/><path d="M12 2v5"/>
      </svg>
    ),
  },
  {
    to:     '/dashboard/overlays',
    label:  'Overlays',
    sub:    'URLs para o OBS',
    accent: 'pink',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>
        <path d="M17 8l-5 5-5-5"/>
      </svg>
    ),
  },
]

export default function DashHome({ state }) {
  const navigate = useNavigate()
  const [redeems, setRedeems] = useState([])

  useEffect(() => {
    const load = () => {
      supabase
        .from('shop_redeems')
        .select('*, shop_products(name, image_url, color)')
        .order('created_at', { ascending: false })
        .limit(8)
        .then(({ data }) => setRedeems(data || []))
    }
    load()
    const ch = supabase
      .channel('dashhome-redeems')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_redeems' }, load)
      .subscribe()
    return () => ch.unsubscribe()
  }, [])

  const casinoName = state?.casinos?.[state?.casino]?.name || state?.casino || '—'
  const casinoLogo = state?.casino_logo || ''
  const modo       = state?.modo?.toUpperCase() || '—'
  const activity   = state?.activity || '—'
  const isLive     = state?.modo && state.modo !== 'demo'

  const activityLabel =
    activity === 'hunting'  ? 'Hunting'  :
    activity === 'opening'  ? 'Opening'  :
    activity === 'chill'    ? 'Chill'    :
    activity === 'torneios' ? 'Torneios' : activity

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* Brand */}
        <div className={styles.brand}>
          <img src="/assets/04.png" alt="RALHA" className={styles.brandLogo} />
          <div className={styles.brandName}>RALHA</div>
          <div className={styles.brandSub}>Dashboard</div>
        </div>

        {/* Status bar */}
        {state && (
          <div className={styles.statusBar}>
            <div className={`${styles.statusDot} ${isLive ? styles.statusDotLive : ''}`} />
            {casinoLogo
              ? <img src={casinoLogo} alt={casinoName} className={styles.statusLogo} onError={e => e.target.style.opacity = '.2'} />
              : <span className={styles.statusVal}>{casinoName}</span>
            }
            <span className={styles.statusSep}>·</span>
            <span className={`${styles.statusBadge} ${styles['badge_' + (state?.modo || '')]}`}>{modo}</span>
            <span className={styles.statusSep}>·</span>
            <span className={styles.statusActivity}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }}>
                {activity === 'hunting'  && <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>}
                {activity === 'opening'  && <><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/></>}
                {activity === 'chill'    && <><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/></>}
                {activity === 'torneios' && <><path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/></>}
              </svg>
              {activityLabel}
            </span>
          </div>
        )}

        {/* Nav cards */}
        <div className={styles.navGrid}>
          {CARDS.map(c => (
            <button
              key={c.to}
              className={`${styles.navCard} ${styles['nav_' + c.accent]}`}
              onClick={() => navigate(c.to)}
            >
              <div className={`${styles.navIcon} ${styles['navIcon_' + c.accent]}`}>
                {c.icon}
              </div>
              <div className={styles.navText}>
                <div className={styles.navLabel}>{c.label}</div>
                <div className={styles.navSub}>{c.sub}</div>
              </div>
              <svg className={styles.navArrow} width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          ))}
        </div>

      </div>

      {/* ── Latest Activity ── */}
      <div className={styles.activity}>
        <div className={styles.activityHeader}>
          <span className={styles.activityTitle}>Latest Activity</span>
          <button className={styles.activityLink} onClick={() => navigate('/dashboard/shop')}>
            Ver todos
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {redeems.length === 0 ? (
          <div className={styles.activityEmpty}>Sem resgates recentes.</div>
        ) : (
          <div className={styles.activityList}>
            {redeems.map(r => (
              <div key={r.id} className={`${styles.activityItem} ${styles['activityItem_' + r.status]}`}>
                <div className={styles.activityThumb} style={{ '--card-color': r.shop_products?.color || '#3b82f6' }}>
                  {r.shop_products?.image_url
                    ? <img src={r.shop_products.image_url} alt="" className={styles.activityThumbImg} />
                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/></svg>
                  }
                </div>
                <div className={styles.activityInfo}>
                  <span className={styles.activityProduct}>{r.shop_products?.name || 'Produto'}</span>
                  <span className={styles.activityUser}>{r.twitch_username}</span>
                </div>
                <div className={styles.activityRight}>
                  <span className={styles.activityTime}>{fmtTimeAgo(r.created_at)}</span>
                  <span className={`${styles.activityBadge} ${styles['activityBadge_' + r.status]}`}>
                    {r.status === 'pending' ? 'Pending' : r.status === 'done' ? 'Completed' : 'Rejeitado'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}