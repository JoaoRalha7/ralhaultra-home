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
const trim = (x, d) => String(Number(x.toFixed(d)))
const short = (n) => (n >= 1000000 ? `${trim(n / 1000000, 2)}M` : n >= 1000 ? `${trim(n / 1000, 1)}K` : String(n))
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
  const [act, setAct] = useState(null)
  const [ago, setAgo] = useState(0) // 0 = live race, n = n periods back
  const [past, setPast] = useState(null)
  const [hasPrev, setHasPrev] = useState(false)

  useEffect(() => {
    let off = false
    setData(null); setError(false); setPage(1); setAct(null); setAgo(0); setPast(null); setHasPrev(false)
    const load = async () => {
      const { data: d, error: e } = await supabase.rpc('wager_race', { p_period: period, p_limit: MAX_ROWS, p_user: me })
      if (off) return
      if (e || !d) { setError(true); return }
      setError(false); setData(d)
      const { data: a } = await supabase.rpc('wager_race_activity', { p_period: period })
      if (!off && a && Array.isArray(a.values)) setAct(a)
    }
    load()
    const id = setInterval(load, 60000)
    return () => { off = true; clearInterval(id) }
  }, [period, me])

  // history: is there a previous period, and load the one being viewed
  useEffect(() => {
    let off = false
    const n = ago === 0 ? 1 : ago
    supabase.rpc('wager_race_past', { p_period: period, p_offset: n }).then(({ data: d }) => {
      if (off || !d) return
      if (ago === 0) { setHasPrev(Array.isArray(d.rows) && d.rows.length > 0) } else { setPast(d); setHasPrev(!!d.has_older) }
    })
    return () => { off = true }
  }, [period, ago])

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])

  const live = ago === 0
  const view = live ? data : past
  const rows = view?.rows || []
  const mine = live ? data?.me : null
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const avmap = useAvatars(pageRows.map((r) => r.username).concat(mine ? [mine.username] : []))
  const top = Number(rows[0]?.wagered) || 1
  const rankOf = useRanks(pageRows.map((r) => r.username).concat(mine ? [mine.username] : []))
  const badge = (name, size) => { const l = rankOf(name); return l == null || !rankOf.isMember(name) ? null : <Medal level={l} size={size} /> }
  const inList = mine && pageRows.some((r) => r.username === mine.username)
  const ahead = mine && mine.rank > 1 ? rows.find((r) => r.rank === mine.rank - 1) : null
  const t = data ? parts(new Date(data.ends_at).getTime() - now) : null
  const cfg = PRIZES[period]
  const dfmt = (iso, o) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Europe/Lisbon', ...o })
  const periodLabel = view ? (period === 'daily' ? dfmt(view.starts_at, { day: 'numeric', month: 'short' })
    : period === 'weekly' ? `${dfmt(view.starts_at, { day: 'numeric', month: 'short' })} - ${dfmt(new Date(new Date(view.ends_at).getTime() - 3600000).toISOString(), { day: 'numeric', month: 'short' })}`
    : dfmt(view.starts_at, { month: 'long', year: 'numeric' })) : '...'

  const Row = ({ r }) => {
    const isMe = r.username === me
    return (
      <div role="button" tabIndex={0} className={`${styles.row} ${isMe ? styles.me : ''} ${r.rank <= 3 ? styles.topr : ''}`} style={{ '--p': `${Math.max(2, (Number(r.wagered) / top) * 100)}%` }}
        onClick={() => openPlayer(r.username)} onKeyDown={(e) => { if (e.key === 'Enter') openPlayer(r.username) }}>
        <span className={styles.rk}><span className={styles.md} style={{ '--c': RANK_COLOR[r.rank - 1] || '#6b7794' }}>{r.rank}</span></span>
        <span className={styles.pl}><TwitchAvatar name={r.username} map={avmap} size={30} className={styles.av} />{badge(r.username, 22)}<span className={styles.nm}>{r.username}</span>{isMe && <span className={styles.you}>YOU</span>}</span>
        <span className={`${styles.amt} ${styles.r}`}><i className={styles.coin} />{fmt(r.wagered)}</span>
        <span className={`${styles.rw} ${styles.r}`}>{(r.prize ?? prizeFor(period, r.rank)) > 0 ? <>{fmt(r.prize ?? prizeFor(period, r.rank))}<i className={styles.coin} /></> : <em>-</em>}</span>
      </div>
    )
  }

  const pool = cfg.ladder.reduce((a, b) => a + b, 0) + cfg.rest * (cfg.restTo - cfg.restFrom + 1)
  const cdBox = (v, l) => <div className={styles.cb}><b>{String(v).padStart(2, '0')}</b><small>{l}</small></div>
  const myPrize = mine ? prizeFor(period, mine.rank) : 0
  const chart = (() => {
    if (!act || !act.values?.length) return null
    let c = 0
    const cum = act.values.map((v) => (c += Number(v) || 0))
    const W = 220, H = 56, n = Math.max(2, act.buckets - 1), mx = Math.max(1, c)
    const pts = cum.map((v, i) => [(i / n) * W, H - 3 - (v / mx) * (H - 8)])
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
    const last = pts[pts.length - 1]
    const recent = Number(act.values[act.values.length - 1]) || 0
    return { W, H, line, area: `${line} L${last[0].toFixed(1)} ${H} L0 ${H} Z`, last, recent }
  })()

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.hl}>
          <div className={styles.ttl}><em>{short(pool)}</em><span>{cfg.label.toUpperCase()} RACE</span></div>
          <div className={styles.ul} />
          <div className={styles.tabRow}>
            <div className={styles.tabs} role="tablist">
              {PERIODS.map((p) => <button key={p} type="button" role="tab" aria-selected={period === p} className={period === p ? styles.on : ''} onClick={() => setPeriod(p)}>{PRIZES[p].label}</button>)}
            </div>
            <button type="button" className={`${styles.howBtn} ${how ? styles.howOn : ''}`} onClick={() => setHow((v) => !v)}>How it works</button>
            <div className={styles.nav}>
              <button type="button" aria-label="Previous period" disabled={!hasPrev} onClick={() => setAgo((n) => n + 1)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg></button>
              <span><small>{live ? 'CURRENT' : 'PERIOD'}</small><b>{live ? 'Live' : periodLabel}</b></span>
              <button type="button" aria-label="Next period" disabled={live} onClick={() => setAgo((n) => Math.max(0, n - 1))}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg></button>
            </div>
          </div>
        </div>
        {live && <div className={styles.hr}>
          <small>RACE ENDS IN</small>
          <div className={styles.cds}>
            {cdBox(t ? t.d : 0, 'DAYS')}{cdBox(t ? t.h : 0, 'HOUR')}{cdBox(t ? t.m : 0, 'MIN')}{cdBox(t ? t.s : 0, 'SEC')}
          </div>
        </div>}
        {live && <div className={styles.rside}>
          <div className={styles.act}>
            <small>TOTAL WAGERED</small>
            <b><i className={styles.coin} />{fmt(data?.total)}</b>
            <em>{data ? `${fmt(data.players)} players${chart && chart.recent > 0 ? ` · +${short(chart.recent)} last ${period === 'daily' ? 'hour' : period === 'weekly' ? '6h' : 'day'}` : ''}` : ' '}</em>
            {chart && (
              <svg viewBox={`0 0 ${chart.W} ${chart.H}`} width="100%" height={chart.H} preserveAspectRatio="none" aria-hidden="true">
                <defs><linearGradient id="wrsg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity=".5" /><stop offset="1" stopColor="#3b82f6" stopOpacity="0" /></linearGradient></defs>
                <path d={chart.area} fill="url(#wrsg)" />
                <path d={chart.line} fill="none" stroke="#6ea3ff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
            )}
          </div>
        </div>}
      </div>

      {how && (
        <div className={styles.howBox}>
          <p>Wager points on Originals (Mines, Blackjack, Keno, Plinko, Roulette, Crash and Jackpot), win or lose, to climb the ranking. {cfg.reset}. The top 10 are paid automatically in points when the period ends.</p>
          <div className={styles.howPz}>{cfg.ladder.map((pz, i) => <span key={i}>#{i + 1} <b><i className={styles.coin} />{fmt(pz)}</b></span>)}<span>#{cfg.restFrom}-{cfg.restTo} <b><i className={styles.coin} />{fmt(cfg.rest)}</b></span></div>
        </div>
      )}

      {!live && <div className={styles.fin}><span>FINISHED</span>Final results for {periodLabel}. Prizes were paid in points.</div>}
      {live && <div className={styles.strip}>
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
      </div>}

      <div className={styles.th}><span>#</span><span>PLAYER</span><span className={styles.r}>WAGERED</span><span className={styles.r}>REWARD</span></div>
      {error && <div className={styles.empty}>Could not load the ranking. Try again in a moment.</div>}
      {!error && !view && <div className={styles.empty}>Loading...</div>}
      {view && !rows.length && <div className={styles.empty}>{live ? 'No bets yet in this period. Be the first to wager!' : 'No results for this period.'}</div>}
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
