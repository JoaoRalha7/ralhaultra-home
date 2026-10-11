import { Fragment, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Medal } from '../components/Medal'
import { useRanks } from '../lib/ranks'
import { useAvatars } from '../lib/avatars'
import TwitchAvatar from '../components/TwitchAvatar'
import { openPlayer } from '../components/PlayerModal'
import styles from './WagerRace.module.css'

// Prizes in points by position. Edit here: the page and the prize ladder follow.
const PRIZES = {
  daily:   { label: 'Daily',   reset: 'Resets every day at 00:00', ladder: [10000, 5000, 2000, 1000, 500], rest: 300, restFrom: 6, restTo: 10 },
  weekly:  { label: 'Weekly',  reset: 'Resets every Monday at 00:00', ladder: [50000, 25000, 10000, 5000, 2500], rest: 1500, restFrom: 6, restTo: 10 },
  monthly: { label: 'Monthly', reset: 'Resets on the 1st at 00:00', ladder: [125000, 62500, 25000, 12500, 6250], rest: 3750, restFrom: 6, restTo: 10 },
}
const PERIODS = ['daily', 'weekly', 'monthly']
const PAGE_SIZE = 20, MAX_ROWS = 100 // the ranking shows the top 100, 20 per page
const RANK_COLOR = ['#f5c542', '#cfd6e6', '#d98a5a']
const fmt = (n) => Number(n || 0).toLocaleString('en-GB')
const prizeFor = (period, rank) => {
  const p = PRIZES[period]
  if (rank <= p.ladder.length) return p.ladder[rank - 1]
  if (rank >= p.restFrom && rank <= p.restTo) return p.rest
  return 0
}
const short = (n) => (n >= 1000000 ? `${n / 1000000}M` : n >= 1000 ? `${n / 1000}K` : String(n))
const parts = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
}

export default function WagerRace() {
  const { user } = useAuth()
  const me = (user?.user_metadata?.full_name || user?.user_metadata?.name || '').toLowerCase() || null
  const [period, setPeriod] = useState('weekly')
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [page, setPage] = useState(1)
  const [how, setHow] = useState(false)

  useEffect(() => {
    let off = false
    setData(null); setError(false); setPage(1)
    const load = async () => {
      const { data: d, error: e } = await supabase.rpc('wager_race', { p_period: period, p_limit: MAX_ROWS, p_user: me })
      if (off) return
      if (e || !d) { setError(true); return }
      setError(false); setData(d)
    }
    load()
    const id = setInterval(load, 60000)
    return () => { off = true; clearInterval(id) }
  }, [period, me])

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])

  const rows = data?.rows || []
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const avmap = useAvatars(pageRows.map((r) => r.username).concat(data?.me ? [data.me.username] : []))
  const top = Number(rows[0]?.wagered) || 1
  const mine = data?.me
  const rankOf = useRanks(pageRows.map((r) => r.username).concat(data?.me ? [data.me.username] : []))
  const badge = (name, size) => { const l = rankOf(name); return l == null || !rankOf.isMember(name) ? null : <Medal level={l} size={size} /> }
  const inList = mine && pageRows.some((r) => r.username === mine.username)
  const ahead = mine && mine.rank > 1 ? rows.find((r) => r.rank === mine.rank - 1) : null
  const t = data ? parts(new Date(data.ends_at).getTime() - now) : null
  const cfg = PRIZES[period]

  const Row = ({ r }) => {
    const isMe = r.username === me
    return (
      <div role="button" tabIndex={0} className={`${styles.row} ${isMe ? styles.me : ''} ${r.rank <= 3 ? styles.topr : ''}`} style={{ '--p': `${Math.max(2, (Number(r.wagered) / top) * 100)}%` }}
        onClick={() => openPlayer(r.username)} onKeyDown={(e) => { if (e.key === 'Enter') openPlayer(r.username) }}>
        <span className={styles.rk}><span className={styles.md} style={{ '--c': RANK_COLOR[r.rank - 1] || '#6b7794' }}>{r.rank}</span></span>
        <span className={styles.pl}><TwitchAvatar name={r.username} map={avmap} size={30} className={styles.av} />{badge(r.username, 22)}<span className={styles.nm}>{r.username}</span>{isMe && <span className={styles.you}>YOU</span>}</span>
        <span className={`${styles.amt} ${styles.r}`}><i className={styles.coin} />{fmt(r.wagered)}</span>
        <span className={`${styles.rw} ${styles.r}`}>{prizeFor(period, r.rank) > 0 ? <>{fmt(prizeFor(period, r.rank))}<i className={styles.coin} /></> : <em>-</em>}</span>
      </div>
    )
  }

  const pool = cfg.ladder.reduce((a, b) => a + b, 0) + cfg.rest * (cfg.restTo - cfg.restFrom + 1)
  const cdBox = (v, l) => <div className={styles.cb}><b>{String(v).padStart(2, '0')}</b><small>{l}</small></div>
  const myPrize = mine ? prizeFor(period, mine.rank) : 0

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.hl}>
          <div className={styles.ttl}><em>{short(pool)}</em><span>{cfg.label.toUpperCase()} RACE</span></div>
          <div className={styles.ul} />
          <div className={styles.tabs} role="tablist">
            {PERIODS.map((p) => <button key={p} type="button" role="tab" aria-selected={period === p} className={period === p ? styles.on : ''} onClick={() => setPeriod(p)}>{PRIZES[p].label}</button>)}
            <button type="button" className={`${styles.howBtn} ${how ? styles.howOn : ''}`} onClick={() => setHow((v) => !v)}>How it works</button>
          </div>
        </div>
        <div className={styles.hr}>
          <small>RACE ENDS IN</small>
          <div className={styles.cds}>
            {cdBox(t ? t.d : 0, 'DAYS')}{cdBox(t ? t.h : 0, 'HOUR')}{cdBox(t ? t.m : 0, 'MIN')}{cdBox(t ? t.s : 0, 'SEC')}
          </div>
        </div>
        <svg className={styles.flag} viewBox="0 0 120 120" aria-hidden="true">
          <defs><pattern id="wrck" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#fff" /><rect x="12" y="12" width="12" height="12" fill="#fff" /><rect x="12" width="12" height="12" fill="#3b82f6" /><rect y="12" width="12" height="12" fill="#3b82f6" /></pattern></defs>
          <rect x="14" y="6" width="3.5" height="112" rx="2" fill="#9aa6c0" />
          <path d="M17 12 Q50 0 70 14 T112 12 V70 Q92 82 70 70 T17 72 Z" fill="url(#wrck)" opacity=".95" />
        </svg>
      </div>

      {how && (
        <div className={styles.howBox}>
          <p>Wager points on Originals (Mines, Blackjack, Keno, Plinko, Roulette, Crash and Jackpot), win or lose, to climb the ranking. {cfg.reset}. The top 10 are paid automatically in points when the period ends.</p>
          <div className={styles.howPz}>{cfg.ladder.map((pz, i) => <span key={i}>#{i + 1} <b><i className={styles.coin} />{fmt(pz)}</b></span>)}<span>#{cfg.restFrom}-{cfg.restTo} <b><i className={styles.coin} />{fmt(cfg.rest)}</b></span></div>
        </div>
      )}

      <div className={styles.strip}>
        <div className={`${styles.sc} ${styles.scMe} ${mine && mine.rank === 1 ? styles.lead : ''}`}>
          <small>YOUR RANK{mine && mine.rank === 1 ? ' - LEADING' : ''}</small>
          <b>{!user ? 'Log in' : mine ? `#${mine.rank}` : '-'}</b>
        </div>
        <div className={styles.sc}><small>WAGERED</small><b>{mine ? <><i className={styles.coin} />{fmt(mine.wagered)}</> : <>-</>}</b></div>
        <div className={styles.sc}>
          <small>{mine && mine.rank === 1 ? 'LEAD OVER #2' : 'NEXT RANK'}</small>
          <b>{!mine ? '-' : mine.rank === 1 ? (rows[1] ? <><i className={styles.coin} />{fmt(Number(mine.wagered) - Number(rows[1].wagered))}</> : '-') : ahead ? <><i className={styles.coin} />{fmt(Number(ahead.wagered) - Number(mine.wagered) + 1)}<em>to pass #{ahead.rank}</em></> : '-'}</b>
        </div>
        <div className={styles.sc}><small>PRIZE NOW</small><b className={myPrize > 0 ? styles.gold : ''}>{myPrize > 0 ? <><i className={styles.coin} />{fmt(myPrize)}</> : '-'}</b></div>
      </div>

      <div className={styles.th}><span>#</span><span>PLAYER</span><span className={styles.r}>WAGERED</span><span className={styles.r}>REWARD</span></div>
      {error && <div className={styles.empty}>Could not load the ranking. Try again in a moment.</div>}
      {!error && !data && <div className={styles.empty}>Loading...</div>}
      {data && !rows.length && <div className={styles.empty}>No bets yet in this period. Be the first to wager!</div>}
      {pageRows.map((r) => {
        const prev = rows[rows.indexOf(r) - 1]
        return (
          <Fragment key={r.username}>
            {prev && prev.rank <= 10 && r.rank > 10 && <div className={styles.cut}><span>Prize zone ends here, top 10 win points</span></div>}
            <Row r={r} />
          </Fragment>
        )
      })}
      {data && mine && !inList && (<><div className={styles.gap}>...</div><Row r={mine} /></>)}
      {pages > 1 && (
        <div className={styles.pagination}>
          <button type="button" className={styles.pageBtn} onClick={() => setPage((x) => Math.max(1, x - 1))} disabled={page === 1} aria-label="Previous"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg></button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => <button key={n} type="button" className={`${styles.pageBtn} ${n === page ? styles.pageBtnActive : ''}`} onClick={() => setPage(n)}>{n}</button>)}
          <button type="button" className={styles.pageBtn} onClick={() => setPage((x) => Math.min(pages, x + 1))} disabled={page === pages} aria-label="Next"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg></button>
        </div>
      )}
      <p className={styles.note}>Counts every point wagered on Originals, win or lose. Top 10 prizes are paid automatically in points when each period ends. Updated every minute.</p>
    </div>
  )
}
