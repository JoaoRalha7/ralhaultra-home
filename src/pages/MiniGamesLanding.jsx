import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseDash } from '../lib/supabase'
import styles from './MiniGamesLanding.module.css'

function GameCard({ title, description, route, icon, status, onClick }) {
  const isLive   = status === 'open'
  const isDone   = status === 'finished'
  const isSoon   = status === 'soon'

  return (
    <button className={`${styles.card} ${isSoon ? styles.cardSoon : ''}`} onClick={() => !isSoon && onClick(route)}>
      <div className={styles.cardIcon}>{icon}</div>
      <div className={styles.cardBody}>
        <div className={styles.cardTitle}>{title}</div>
        <div className={styles.cardDesc}>{description}</div>
      </div>
      <div className={styles.cardRight}>
        {isSoon
          ? <span className={styles.chipSoon}>Coming Soon</span>
          : isLive
            ? <span className={styles.chipLive}><span className={styles.chipDot} />Live</span>
            : isDone
              ? <span className={styles.chipDone}>Finished</span>
              : <span className={styles.chipIdle}>Inactive</span>
        }
        {!isSoon && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{opacity:.3}}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        )}
      </div>
    </button>
  )
}

export default function MiniGamesLanding() {
  const navigate = useNavigate()
  const [statuses, setStatuses] = useState({ pickWin: null, gtb: null, avgMulti: null })

  useEffect(() => {
    const load = async () => {
      const [{ data: pw }, { data: gtb }, { data: avg }] = await Promise.all([
        supabaseDash.from('pick_games').select('status').in('status', ['open','closed','finished']).order('created_at', { ascending: false }).limit(1),
        supabaseDash.from('gtb_games').select('status').in('status', ['open','closed','finished']).order('created_at', { ascending: false }).limit(1),
        supabaseDash.from('avg_multi_games').select('status').in('status', ['open','closed','finished']).order('created_at', { ascending: false }).limit(1),
      ])
      setStatuses({ pickWin: pw?.[0]?.status || null, gtb: gtb?.[0]?.status || null, avgMulti: avg?.[0]?.status || null })
    }
    load()
  }, [])

  const games = [
    {
      title: 'Pick & Win',
      description: 'Pick a slot from the hunt. The closest wins. First come, first served.',
      route: '/mini-games/pick-win',
      status: statuses.pickWin,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ),
    },
    {
      title: 'Guess the Balance',
      description: 'Guess the final balance of the bonus hunt. Closest guess takes the prize.',
      route: '/mini-games/gtb',
      status: statuses.gtb,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
    },
    {
      title: 'Avg Multi',
      description: 'Guess the average multiplier across all bonuses in the hunt.',
      route: '/mini-games/avg-multi',
      status: statuses.avgMulti,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
        </svg>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Mini-Games</h1>
        <p className={styles.sub}>Participate in live games during the stream and win points.</p>
      </div>
      <div className={styles.list}>
        {games.map(g => (
          <GameCard key={g.route} {...g} onClick={(route) => navigate(route)} />
        ))}
      </div>
    </div>
  )
}