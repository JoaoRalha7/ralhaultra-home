import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useAuth } from '../hooks/useAuth'
import { WORKER, workerPost } from '../lib/points'
import RankName from './RankName'
import { useRanks } from '../lib/ranks'
import BetModal from './BetModal'
import { openPlayer } from './PlayerModal'
import styles from './OriginalsBets.module.css'

const TABS = [
  { id: 'mine', label: 'My Bets' },
  { id: 'all', label: 'All Bets' },
  { id: 'top', label: 'Biggest Winners' },
]

const GAMES = {
  mines: ['Mines', 'mines'], blackjack: ['Blackjack', 'cards'], crash: ['Crash', 'crash'], keno: ['Keno', 'keno'],
  plinko: ['Plinko', 'plinko'], roulette: ['Roulette', 'roulette'], jackpot: ['Jackpot', 'jackpot'],
}

const fmt = (n) => Number(n || 0).toLocaleString('pt-PT')
const when = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
const rowKey = (b) => b.id || `${b.game}|${b.username}|${b.updated_at}|${b.bet}`
const mult = (bet, payout) => (bet > 0 ? `${+(payout / bet).toFixed(2)}x` : '-')

export default function OriginalsBets() {
  const { user } = useAuth()
  const [tab, setTab] = useState('all')
  const [rows, setRows] = useState(null)
  const alive = useRef(true)
  const [detail, setDetail] = useState(null)
  const [fresh, setFresh] = useState(() => new Set())   // rows that just arrived (slide-in animation)
  const seen = useRef(null)   // keys (top tab) or newest timestamp (feeds) of the previous list
  const reqSeq = useRef(0)
  const openRound = async (b) => {
    if (!b.id) return
    try {
      const r = await fetch(`${WORKER}/casino-round?id=${encodeURIComponent(b.id)}`)
      const d = r.ok ? await r.json() : null
      if (d?.round) setDetail({ game: b.game, round: d.round, by: d.username || b.username, at: d.at || b.updated_at })
    } catch { /* detail is optional */ }
  }

  const load = useCallback(async () => {
    const mySeq = ++reqSeq.current
    try {
      let list = []
      if (tab === 'mine') {
        if (!user) { setRows([]); return }
        const { data } = await workerPost('/bets/mine')
        list = data?.rounds || []
      } else {
        const r = await fetch(`${WORKER}/casino-feed?limit=10${tab === 'top' ? '&sort=top' : ''}`)
        list = r.ok ? (await r.json()).rounds || [] : []
      }
      if (alive.current && mySeq === reqSeq.current) {   // ignore answers that arrive out of order
        const next = list.slice(0, 10)
        let add = []
        if (tab === 'top') {
          const keys = next.map(rowKey)
          if (seen.current) add = keys.filter((k) => !seen.current.has(k))
          seen.current = new Set(keys)
        } else {
          // new = strictly newer than the newest row we already showed (never re-flags rows that were already there)
          const newest = next.reduce((m, b) => (b.updated_at > m ? b.updated_at : m), '')
          if (seen.current) add = next.filter((b) => b.updated_at > seen.current).map(rowKey)
          if (!seen.current || newest > seen.current) seen.current = newest
        }
        if (add.length) { setFresh(new Set(add)); setTimeout(() => { if (alive.current) setFresh(new Set()) }, 1400) }
        setRows(next)
      }
    } catch {
      if (alive.current) setRows([])
    }
  }, [tab, user])

  useEffect(() => {
    alive.current = true
    setRows(null); seen.current = null
    load()
    const id = setInterval(load, tab === 'top' ? 20000 : 4000)
    return () => { alive.current = false; clearInterval(id) }
  }, [load, tab])

  const rankOf = useRanks((rows || []).map((b) => b.username))
  const empty = tab === 'mine' && !user ? 'Log in to see your bets.' : tab === 'mine' ? 'You have no finished bets yet.' : 'No bets yet.'

  return (
    <section className={styles.wrap}>
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`${styles.tab}${tab === t.id ? ` ${styles.on}` : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className={styles.table} role="table">
        <div className={`${styles.row} ${styles.head}`} role="row">
          <span>Game</span><span>Username</span><span className={styles.date}>Date</span><span className={styles.r}>Bet value</span><span className={`${styles.r} ${styles.mul}`}>Multiplier</span><span className={styles.r}>Payment</span>
        </div>
        {rows === null && <div className={styles.empty}>Loading...</div>}
        {rows && rows.length === 0 && <div className={styles.empty}>{empty}</div>}
        {rows && rows.map((b, i) => {
          const g = GAMES[b.game] || [b.game, 'originals']
          const profit = (b.payout || 0) - (b.bet || 0)
          return (
            <div key={rowKey(b)} className={`${styles.row}${fresh.has(rowKey(b)) ? ` ${styles.fresh}` : ''}`} role="row" onClick={b.id ? () => openRound(b) : undefined} style={b.id ? { cursor: 'pointer' } : undefined}>
              <span className={styles.game}><Icon name={g[1]} size={16} />{g[0]}</span>
              <span className={styles.userLink} onClick={(e) => { e.stopPropagation(); openPlayer(b.username) }}><RankName className={styles.user} name={b.username} level={rankOf(b.username)} /></span>
              <span className={`${styles.date} ${styles.mute}`}>{when(b.updated_at)}</span>
              <span className={styles.r}>{fmt(b.bet)} <i className="coin" /></span>
              <span className={`${styles.r} ${styles.mul} ${styles.mute}`}>{mult(b.bet, b.payout)}</span>
              <span className={`${styles.r} ${profit > 0 ? styles.win : profit < 0 ? styles.loss : ''}`}>{profit > 0 ? '+' : ''}{fmt(profit)} <i className="coin" /></span>
            </div>
          )
        })}
      </div>
      {detail && <BetModal item={detail} onClose={() => setDetail(null)} />}
    </section>
  )
}
