import { useNavigate } from 'react-router-dom'
import styles from './Dashhome.module.css'

const CARDS = [
  {
    to:     '/dashboard/hunt',
    label:  'Bonus Hunt',
    sub:    'Gerir slots e bónus',
    accent: 'blue',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    wide:   true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 2H8"/><path d="M12 2v5"/>
      </svg>
    ),
  },
  {
    to:     '/dashboard/overlays',
    label:  'Overlays',
    sub:    'URLs para o OBS',
    accent: 'pink',
    wide:   true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>
        <path d="M17 8l-5 5-5-5"/>
      </svg>
    ),
  },
]

const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
)

function ActivityIcon({ activity }) {
  if (activity === 'hunting') return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  )
  if (activity === 'opening') return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/>
    </svg>
  )
  if (activity === 'chill') return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
    </svg>
  )
  if (activity === 'torneios') return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
      <path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/>
    </svg>
  )
  return null
}

export default function DashHome({ state }) {
  const navigate = useNavigate()

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
          <div className={styles.brandText}>
            <div className={styles.brandName}>RALHA</div>
            <div className={styles.brandSub}>Dashboard</div>
          </div>
          <div className={`${styles.brandLive} ${isLive ? styles.brandLiveOn : ''}`}>
            <span className={styles.brandDot} />
            {isLive ? 'Online' : 'Offline'}
          </div>
        </div>

        {/* Status bar */}
        {state && (
          <div className={styles.statusBar}>
            <span className={`${styles.statusDot} ${isLive ? styles.statusDotLive : ''}`} />

            {casinoLogo
              ? <img src={casinoLogo} alt={casinoName} className={styles.statusLogo} onError={e => e.target.style.opacity = '.2'} />
              : <span className={styles.statusCasino}>{casinoName}</span>
            }

            <span className={styles.statusSep}>·</span>
            <span className={`${styles.statusBadge} ${styles['badge_' + (state?.modo || '')]}`}>{modo}</span>
            <span className={styles.statusSep}>·</span>

            <span className={styles.statusActivity}>
              <ActivityIcon activity={activity} />
              {activityLabel}
            </span>
          </div>
        )}

        {/* Nav grid */}
        <div className={styles.sectionLabel}>Modules</div>
        <div className={styles.navGrid}>
          {CARDS.map(c => (
            <button
              key={c.to}
              className={`${styles.navCard} ${styles['nav_' + c.accent]} ${c.wide ? styles.navCardWide : ''}`}
              onClick={() => navigate(c.to)}
            >
              <div className={`${styles.navIcon} ${styles['navIcon_' + c.accent]}`}>
                {c.icon}
              </div>
              <div className={styles.navText}>
                <div className={styles.navLabel}>{c.label}</div>
                <div className={styles.navSub}>{c.sub}</div>
              </div>
              <span className={styles.navArrow}><ChevronRight /></span>
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}