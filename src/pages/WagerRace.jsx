import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useAvatars } from '../lib/avatars'
import TwitchAvatar from '../components/TwitchAvatar'
import { openPlayer } from '../components/PlayerModal'
import styles from './WagerRace.module.css'

// Prizes in points by position. Edit here: the page and the prize ladder follow.
const PRIZES = {
  daily:   { label: 'Daily',   reset: 'Resets every day at 00:00', ladder: [5000, 2500, 1000, 500, 250], rest: 100, restFrom: 6, restTo: 10 },
  weekly:  { label: 'Weekly',  reset: 'Resets every Monday at 00:00', ladder: [50000, 25000, 10000, 5000, 2500], rest: 750, restFrom: 6, restTo: 10 },
  monthly: { label: 'Monthly', reset: 'Resets on the 1st at 00:00', ladder: [250000, 125000, 50000, 25000, 12500], rest: 3750, restFrom: 6, restTo: 10 },
}
const PERIODS = ['daily', 'weekly', 'monthly']
const RANK_COLOR = ['#f5c542', '#b8c0d0', '#cd7f4f']
const fmt = (n) => Number(n || 0).toLocaleString('en-GB')
const prizeFor = (period, rank) => {
  const p = PRIZES[period]
  if (rank <= p.ladder.length) return p.ladder[rank - 1]
  if (rank >= p.restFrom && rank <= p.restTo) return p.rest
  return 0
}
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

  useEffect(() => {
    let off = false
    setData(null); setError(false)
    const load = async () => {
      const { data: d, error: e } = await supabase.rpc('wager_race', { p_period: period, p_limit: 20, p_user: me })
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
  const avmap = useAvatars(rows.map((r) => r.username).concat(data?.me ? [data.me.username] : []))
  const top = Number(rows[0]?.wagered) || 1
  const mine = data?.me
  const inList = mine && rows.some((r) => r.username === mine.username)
  const ahead = mine && mine.rank > 1 ? rows.find((r) => r.rank === mine.rank - 1) : null
  const t = data ? parts(new Date(data.ends_at).getTime() - now) : null
  const cfg = PRIZES[period]

  const Row = ({ r }) => {
    const isMe = r.username === me
    return (
      <div role="button" tabIndex={0} className={`${styles.row} ${isMe ? styles.me : ''}`} style={{ '--p': `${Math.max(2, (Number(r.wagered) / top) * 100)}%` }}
        onClick={() => openPlayer(r.username)} onKeyDown={(e) => { if (e.key === 'Enter') openPlayer(r.username) }}>
        <span className={styles.rk} style={{ color: RANK_COLOR[r.rank - 1] || undefined }}>{r.rank}</span>
        <span className={styles.pl}><TwitchAvatar name={r.username} map={avmap} size={30} className={styles.av} /><span className={styles.nm}>{r.username}</span>{isMe && <span className={styles.you}>YOU</span>}</span>
        <span className={`${styles.amt} ${styles.r}`}><i className={styles.coin} />{fmt(r.wagered)}</span>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Wager Race</h1>
          <p className={styles.sub}>Wager points on Originals to climb the ranking and win points. {cfg.reset}.</p>
        </div>
        <div className={styles.tabs} role="tablist">
          {PERIODS.map((p) => <button key={p} type="button" role="tab" aria-selected={period === p} className={period === p ? styles.on : ''} onClick={() => setPeriod(p)}>{PRIZES[p].label}</button>)}
        </div>
      </div>

      <div className={styles.grid}>
        <div>
          <div className={styles.th}><span>#</span><span>PLAYER</span><span className={styles.r}>WAGERED</span></div>
          {error && <div className={styles.empty}>Could not load the ranking. Try again in a moment.</div>}
          {!error && !data && <div className={styles.empty}>Loading...</div>}
          {data && !rows.length && <div className={styles.empty}>No bets yet in this period. Be the first to wager!</div>}
          {rows.map((r) => <Row key={r.username} r={r} />)}
          {data && mine && !inList && (<><div className={styles.gap}>...</div><Row r={mine} /></>)}
          <p className={styles.note}>Counts every point wagered on Originals (Mines, Blackjack, Keno, Plinko, Roulette, Crash and Jackpot), win or lose. Prizes are paid in points after each period ends. Updated every minute.</p>
        </div>

        <aside className={styles.side}>
          <div className={styles.box}>
            <small>ENDS IN</small>
            {t ? <div className={styles.cd}>{t.d}<s>d</s>{String(t.h).padStart(2, '0')}<s>h</s>{String(t.m).padStart(2, '0')}<s>m</s>{String(t.s).padStart(2, '0')}<s>s</s></div> : <div className={styles.cd}>--</div>}
          </div>
          <div className={styles.box}>
            <small>PRIZES</small>
            {cfg.ladder.map((p, i) => <div key={i} className={styles.lad}><span style={{ color: RANK_COLOR[i] }}>#{i + 1}</span><b><i className={styles.coin} />{fmt(p)}</b></div>)}
            <div className={styles.lad}><span>#{cfg.restFrom}-{cfg.restTo}</span><b><i className={styles.coin} />{fmt(cfg.rest)}</b></div>
            <div className={styles.pool}><span>Total pool</span><b>{fmt(cfg.ladder.reduce((a, b) => a + b, 0) + cfg.rest * (cfg.restTo - cfg.restFrom + 1))}</b></div>
          </div>
          <div className={`${styles.box} ${styles.mebox}`}>
            <small>YOU</small>
            {!user ? <em>Log in to join the race.</em> : mine ? (
              <>
                <b>#{mine.rank}</b>
                <em>Wagered {fmt(mine.wagered)}{ahead ? ` · ${fmt(Number(ahead.wagered) - Number(mine.wagered) + 1)} more to pass #${ahead.rank}` : ' · you are leading!'}</em>
                {prizeFor(period, mine.rank) > 0 && <em>Current prize: {fmt(prizeFor(period, mine.rank))} pts</em>}
              </>
            ) : <em>No bets yet in this period.</em>}
          </div>
        </aside>
      </div>
    </div>
  )
}
