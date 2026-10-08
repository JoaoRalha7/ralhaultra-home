import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Medal, RANK_NAMES, RANK_COLORS } from '../components/Medal'
import { workerGet } from '../lib/vip'
import { workerPost, WORKER } from '../lib/points'
import styles from './Profile.module.css'

const fmt = (n) => Number(n || 0).toLocaleString('en-US')
const FILTERS = [['all', 'All'], ['games', 'Games'], ['shop', 'Shop'], ['rewards', 'Rewards']]
const VOUCHER_ERR = {
  invalid_code: 'That code does not exist.',
  expired: 'This code has expired.',
  used_up: 'This code has no uses left.',
  already_redeemed: 'You already redeemed this code.',
  unauthorized: 'Log in to redeem a code.',
}

function Activity() {
  const [kind, setKind] = useState('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const load = useCallback(async () => setData(await workerGet(`/profile?kind=${kind}&page=${page}`)), [kind, page])
  useEffect(() => { load() }, [load])
  const pages = data ? Math.max(1, Math.ceil(data.total / 8)) : 1
  return (
    <div className={styles.panel}>
      <div className={styles.chips}>
        {FILTERS.map(([k, label]) => (
          <button key={k} className={kind === k ? styles.chipOn : ''} onClick={() => { setKind(k); setPage(1) }}>
            {label} <span>{data?.counts?.[k] ?? ''}</span>
          </button>
        ))}
      </div>
      <div className={styles.thead}><span>Activity</span><span>Date</span><span className={styles.r}>Value</span><span className={styles.r}>Status</span></div>
      <div className={styles.rows}>
        {!data && <div className={styles.empty}>Loading</div>}
        {data && data.items.length === 0 && <div className={styles.empty}>Nothing here yet.</div>}
        {data?.items.map((a, i) => (
          <div key={i} className={styles.row}>
            <b>{a.title}</b>
            <span className={styles.date}>{new Date(a.at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
            <b className={`${styles.r} ${styles.num}`}>{a.value > 0 ? '+ ' : a.value < 0 ? '- ' : ''}{fmt(Math.abs(a.value))}</b>
            <span className={styles.r}><i className={`${styles.st} ${styles['st' + a.status] || ''}`}>{a.status}</i></span>
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div className={styles.pager}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous">&lsaquo;</button>
          <span>{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next">&rsaquo;</button>
        </div>
      )}
    </div>
  )
}

function Voucher() {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true); setMsg(null)
    const r = await workerPost('/voucher/redeem', { code })
    setBusy(false)
    if (r.ok && r.data?.ok) { setMsg({ ok: true, text: `+${fmt(r.data.points)} points added to your balance.` }); setCode('') }
    else setMsg({ ok: false, text: VOUCHER_ERR[r.data?.error] || 'Could not redeem this code. Try again.' })
  }
  return (
    <div className={styles.panel}>
      <h2 className={styles.h2}>Redeem a voucher</h2>
      <p className={styles.muted}>Got a code from the stream or the community? Paste it here to get your points.</p>
      <form className={styles.voucher} onSubmit={submit}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ENTER CODE" maxLength={40} aria-label="Voucher code" />
        <button type="submit" disabled={busy || !code.trim()}>{busy ? 'Checking' : 'Redeem'}</button>
      </form>
      {msg && <p className={msg.ok ? styles.ok : styles.bad}>{msg.text}</p>}
    </div>
  )
}

export default function Profile() {
  const { user, profile, signInWithTwitch } = useAuth()
  const [tab, setTab] = useState('profile')
  const [vip, setVip] = useState(null)
  const [stats, setStats] = useState(null)
  const [followed, setFollowed] = useState(null)
  const uname = profile?.twitch_username

  useEffect(() => {
    if (!uname) return
    let off = false
    fetch(`${WORKER}/player?u=${encodeURIComponent(uname.toLowerCase())}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (!off && d?.followedAt) setFollowed(d.followedAt) }).catch(() => {})
    return () => { off = true }
  }, [uname])

  useEffect(() => {
    if (!user) return
    workerGet('/vip').then(setVip)
    workerGet('/profile?page=1').then((d) => d && setStats(d.stats))
  }, [user])

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.panel} style={{ textAlign: 'center', padding: 48 }}>
          <h2 className={styles.h2}>My Profile</h2>
          <p className={styles.muted}>Log in with Twitch to see your profile.</p>
          <button className={styles.cta} onClick={signInWithTwitch}>Log in with Twitch</button>
        </div>
      </div>
    )
  }

  const name = profile?.twitch_username || user.user_metadata?.full_name || user.user_metadata?.name || 'Account'
  const avatar = profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture
  const me = vip?.me
  const levels = vip?.levels || []
  const lvl = me?.level || 0
  const next = levels.find((l) => l.level === lvl + 1)
  const hours = me ? me.minutes / 60 : 0
  const pct = next ? Math.round(((Math.min(1, me.wagered / next.min_wagered) + Math.min(1, hours / next.min_watch_hours)) / 2) * 100) : 100
  const since = user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

  return (
    <div className={styles.page}>
      <aside className={styles.side}>
        <div className={styles.panel + ' ' + styles.idCard}>
          <div className={styles.avBig}>
            {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <span>{name[0].toUpperCase()}</span>}
            <i><Medal level={lvl} size={40} /></i>
          </div>
          <h1>@{name}</h1>
          <em style={{ color: RANK_COLORS[lvl], background: RANK_COLORS[lvl] + '2e' }}>{RANK_NAMES[lvl]}</em>
          {since && <small>Joined {since}</small>}
          {followed && <small>Following since {new Date(followed).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</small>}
        </div>
        <nav className={styles.panel + ' ' + styles.nav}>
          <button className={tab === 'profile' ? styles.navOn : ''} onClick={() => setTab('profile')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" /></svg>Profile
          </button>
          <button className={tab === 'voucher' ? styles.navOn : ''} onClick={() => setTab('voucher')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4z" /><path d="M13 7v10" strokeDasharray="2 2" /></svg>Voucher redeem
          </button>
        </nav>
      </aside>

      <div className={styles.main}>
        {tab === 'voucher' ? <Voucher /> : (
          <>
            <div className={styles.rank}>
              <Medal level={lvl} size={64} />
              <div className={styles.rankMid}>
                <div className={styles.rankTop}>
                  <b>{RANK_NAMES[lvl]} {next && <small>to {next.name}</small>}</b>
                  <b className={styles.pct}>{me ? `${pct}%` : ''}</b>
                </div>
                <div className={styles.track}><i style={{ width: `${me ? pct : 0}%` }} /></div>
                {me && next && <div className={styles.rankSub}>
                  <span>Wagered <b>{fmt(me.wagered)}</b> / {fmt(next.min_wagered)}</span>
                  <span>Watched <b>{Math.floor(hours)}h</b> / {next.min_watch_hours}h</span>
                </div>}
              </div>
              <Link to="/vip" className={styles.cta}>View VIP</Link>
            </div>

            <div className={styles.stats}>
              <div><small>Watchtime</small><b>{me ? `${Math.floor(me.minutes / 60)}h ${String(me.minutes % 60).padStart(2, '0')}m` : '-'}</b></div>
              <div><small>Total bets</small><b>{stats ? fmt(stats.bets) : '-'}</b></div>
              <div><small>Wins / Losses</small><b>{stats ? <><span className={styles.win}>{fmt(stats.wins)}</span> <span className={styles.dim}>/</span> <span className={styles.loss}>{fmt(stats.losses)}</span></> : '-'}</b></div>
              <div><small>Points</small><b>{me ? fmt(me.balance) : '-'}</b></div>
            </div>

            <Activity />
          </>
        )}
      </div>
    </div>
  )
}
