import { useEffect, useState, Suspense, lazy } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabaseDash } from '../lib/supabase'
import { Spinner } from '../lib/miniGamesUtils'
import styles from './MiniGamesLanding.module.css'

const MiniGame         = lazy(() => import('./MiniGame'))
const MiniGameGtb      = lazy(() => import('./MiniGameGtb'))
const MiniGameAvgMulti = lazy(() => import('./MiniGameAvgMulti'))

export default function MiniGamesHub() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'pickWin'

  const [statuses, setStatuses] = useState({ pickWin: null, gtb: null, avgMulti: null })

  useEffect(() => {
    const loadStatuses = async () => {
      const [{ data: pw }, { data: gtb }, { data: avg }] = await Promise.all([
        supabaseDash.from('pick_games').select('status').in('status', ['open','closed','finished']).order('created_at', { ascending: false }).limit(1),
        supabaseDash.from('gtb_games').select('status').in('status', ['open','closed','finished']).order('created_at', { ascending: false }).limit(1),
        supabaseDash.from('avg_multi_games').select('status').in('status', ['open','closed','finished']).order('created_at', { ascending: false }).limit(1),
      ])
      setStatuses({ 
        pickWin: pw?.[0]?.status || null, 
        gtb: gtb?.[0]?.status || null, 
        avgMulti: avg?.[0]?.status || null 
      })
    }
    loadStatuses()
    
    const ch = supabaseDash.channel('hub-statuses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_games' }, loadStatuses)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gtb_games' }, loadStatuses)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avg_multi_games' }, loadStatuses)
      .subscribe()

    return () => ch.unsubscribe()
  }, [])

  const tabs = [
    {
      id: 'pickWin', title: 'Pick & Win', status: statuses.pickWin,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    },
    {
      id: 'gtb', title: 'GTB', status: statuses.gtb,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.5 6.5A7 7 0 0 0 7 12a7 7 0 0 0 10.5 5.5M4 10h10M4 14h10"/></svg>
    },
    {
      id: 'avgMulti', title: 'Avg Multi', status: statuses.avgMulti,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
    }
  ]

  const handleTabChange = (id) => {
    setSearchParams({ tab: id })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Mini-Games Hub</h1>
        <p className={styles.sub}>Participa nos jogos, testa a tua sorte e acumula pontos.</p>
      </div>

      <div className={styles.tabsWrapper}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const isLive = tab.status === 'open'
          return (
            <button key={tab.id} className={`${styles.tabBtn} ${isActive ? styles.tabActive : ''}`} onClick={() => handleTabChange(tab.id)}>
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabText}>{tab.title}</span>
              {isLive && <span className={styles.liveDot} title="Jogo ao vivo agora!" />}
            </button>
          )
        })}
      </div>

      <div className={styles.gameContainer} key={activeTab}>
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}><Spinner size={32} /></div>}>
          {activeTab === 'pickWin' && <MiniGame />}
          {activeTab === 'gtb' && <MiniGameGtb />}
          {activeTab === 'avgMulti' && <MiniGameAvgMulti />}
        </Suspense>
      </div>
    </div>
  )
}