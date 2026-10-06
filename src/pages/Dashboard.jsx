import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase, supabaseDash } from '../lib/supabase'
import styles from './Dashboard.module.css'

// Sub-pages
import DashHunt     from './DashHunt'
import DashSlots    from './DashSlots'
import DashBarra    from './DashBarra'
import DashChill    from './DashChill'
import DashTorneios from './DashTorneios'
import DashHome     from './Dashhome'
import DashOverlays from './DashOverlays'
import DashShop     from './DashShop'
import DashGiveaway from './DashGiveaway'
import DashMinigame from './Dashminigame'

const DASHBOARD_ID = 'aa9660ca-4c53-4d4d-b81b-b3d231660420'

const ACTIVITY_LABELS = {
  hunting:  'Hunting',
  opening:  'Opening',
  chill:    'Chill',
  torneios: 'Torneios',
}

const NAV = [
  {
    to: '/dashboard', accent: 'slate', label: 'Home',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    to: '/dashboard/hunt', accent: 'blue', label: 'Bonus Hunt',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  },
  {
    to: '/dashboard/slots', accent: 'green', label: 'Slots',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>,
  },
  {
    to: '/dashboard/torneios', accent: 'amber', label: 'Torneios',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M12 17v4"/><path d="M8 21h8"/><path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/></svg>,
  },
  {
    to: '/dashboard/chill', accent: 'slate', label: 'Chill',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>,
  },
  {
    to: '/dashboard/minigame', accent: 'violet', label: 'Minigame',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  },
  {
    to: '/dashboard/barra', accent: 'purple', label: 'Barra OBS',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 2H8"/><path d="M12 2v5"/></svg>,
  },
  {
    to: '/dashboard/overlays', accent: 'pink', label: 'Overlays',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  },
  {
    to: '/dashboard/giveaway', accent: 'amber', label: 'Giveaway',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>,
  },
  {
    to: '/dashboard/shop', accent: 'green', label: 'Loja',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  },
]

export default function Dashboard() {
  const { user, isAdmin, loading } = useAuth()
  const navigate = useNavigate()

  const [state,    setState]    = useState(null)
  const [pending,  setPending]  = useState(0)   // resgates pendentes

  useEffect(() => {
    if (!loading && (!user || !isAdmin())) {
      navigate('/', { replace: true })
    }
  }, [user, loading, isAdmin, navigate])

  useEffect(() => {
    if (!user || !isAdmin()) return

    // Dashboard state (supabaseDash)
    supabaseDash
      .from('dashboard_state')
      .select('casino, modo, activity, casinos, casino_logo, main_logo')
      .eq('id', DASHBOARD_ID)
      .single()
      .then(({ data }) => { if (data) setState(data) })

    const ch = supabaseDash
      .channel('dash-state-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_state' },
        ({ new: d }) => { if (d) setState(d) })
      .subscribe()

    return () => ch.unsubscribe()
  }, [user])

  // ── Resgates pendentes em tempo real ───────────────────────────────────────
  useEffect(() => {
    if (!user || !isAdmin()) return

    // Contagem inicial
    supabase
      .from('shop_redeems')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) => setPending(count ?? 0))

    // Tempo real — qualquer INSERT ou UPDATE na shop_redeems
    const ch = supabase
      .channel('pending-redeems')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'shop_redeems' },
        () => {
          supabase
            .from('shop_redeems')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending')
            .then(({ count }) => setPending(count ?? 0))
        }
      )
      .subscribe()

    return () => ch.unsubscribe()
  }, [user])

  if (loading || !user || !isAdmin()) return null

  const casinoName = state?.casinos?.[state?.casino]?.name || state?.casino || '—'
  const casinoLogo = state?.casino_logo || ''
  const modo       = state?.modo?.toUpperCase() || '—'
  const activity   = ACTIVITY_LABELS[state?.activity] || state?.activity || '—'
  const isLive     = state?.modo && state.modo !== 'demo'

  return (
    <div className={styles.root}>

      {/* ── SIDEBAR ── */}
      <aside className={styles.sidebar}>

        {/* Brand */}
        <div className={styles.brand}>
          <img src="/assets/04.png" alt="RALHA" className={styles.brandLogo} />
          <div>
            <div className={styles.brandName}>RALHA</div>
            <div className={styles.brandSub}>Dashboard</div>
          </div>
        </div>

        {/* Status pill */}
        <div className={styles.statusBar}>
          <div className={`${styles.statusDot} ${isLive ? styles.statusDotLive : ''}`} />
          <div className={styles.statusInfo}>
            {casinoLogo
              ? <img src={casinoLogo} alt={casinoName} className={styles.statusCasinoLogo} />
              : <span className={styles.statusCasinoName}>{casinoName}</span>
            }
            <span className={styles.statusSep}>·</span>
            <span className={`${styles.statusModo} ${styles['modo_' + (state?.modo || '')]}`}>{modo}</span>
            <span className={styles.statusSep}>·</span>
            <span className={styles.statusActivity}>{activity}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''} ${styles['nav_' + item.accent]}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
              {item.to === '/dashboard/shop' && pending > 0 && (
                <span className={styles.navBadge}>{pending}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Back to site */}
        <NavLink to="/" className={styles.backBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Voltar ao site
        </NavLink>

      </aside>

      {/* ── CONTENT ── */}
      <main className={styles.content}>
        <Routes>
          <Route path="hunt"     element={<DashHunt />} />
          <Route path="slots"    element={<DashSlots />} />
          <Route path="torneios" element={<DashTorneios />} />
          <Route path="chill"    element={<DashChill />} />
          <Route path="barra"    element={<DashBarra state={state} onStateChange={setState} />} />
          <Route path="overlays" element={<DashOverlays />} />
          <Route path="giveaway" element={<DashGiveaway />} />
          <Route path="minigame" element={<DashMinigame />} />
          <Route path="shop"     element={<DashShop />} />
          <Route index          element={<DashHome state={state} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

    </div>
  )
}