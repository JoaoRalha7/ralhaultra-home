import { useNavigate } from 'react-router-dom'
import styles from './Dashhome.module.css'

const GROUPS = [
  { title: 'Stream', items: [
    { to: '/dashboard/hunt', label: 'Bonus Hunt', sub: 'Gerir slots e bónus', icon: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>) },
    { to: '/dashboard/slots', label: 'Slots', sub: 'Biblioteca de slots', icon: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>) },
    { to: '/dashboard/torneios', label: 'Torneios', sub: 'Rankings e resultados', icon: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5h4M18 9h2a2 2 0 0 0 2-2V5h-4M6 9a6 6 0 0 0 12 0V3H6v6ZM12 17v4M8 21h8"/></svg>) },
    { to: '/dashboard/chill', label: 'Chill', sub: 'Modo relaxado', icon: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4ZM6 2v2M10 2v2M14 2v2"/></svg>) },
    { to: '/dashboard/minigame', label: 'Minigame', sub: 'Jogos dos viewers', icon: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/></svg>) },
  ] },
  { title: 'Comunidade', items: [
    { to: '/dashboard/giveaways', label: 'Giveaways', sub: 'Sorteios e prémios', icon: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1.5S10 8 12 8Zm0 0c2-4 6-4 6-1.5S14 8 12 8Z"/></svg>) },
    { to: '/dashboard/giveaway', label: 'Sorteio chat', sub: 'Escolher do chat', icon: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg>) },
    { to: '/dashboard/shop', label: 'Loja', sub: 'Produtos e resgates', icon: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14l-1 13H6L5 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>) },
  ] },
  { title: 'OBS', items: [
    { to: '/dashboard/barra', label: 'Barra OBS', sub: 'Casino, modo e activity', icon: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 2H8M12 2v5"/></svg>) },
    { to: '/dashboard/overlays', label: 'Overlays', sub: 'URLs para o OBS', icon: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>) },
  ] },
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

        {/* Modules */}
        {GROUPS.map(g => (
          <div key={g.title} className={styles.group}>
            <div className={styles.sectionLabel}>{g.title}</div>
            <div className={styles.navGrid}>
              {g.items.map(c => (
                <button key={c.to} className={styles.navCard} onClick={() => navigate(c.to)}>
                  <div className={styles.navIcon}>{c.icon}</div>
                  <div className={styles.navText}>
                    <div className={styles.navLabel}>{c.label}</div>
                    <div className={styles.navSub}>{c.sub}</div>
                  </div>
                  <span className={styles.navArrow}><ChevronRight /></span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}