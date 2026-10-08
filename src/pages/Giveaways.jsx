import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { useAuth } from '../hooks/useAuth'
import { useStreamElementsPoints } from '../hooks/useStreamElementsPoints'
import { supabase } from '../lib/supabase'
import { workerPost } from '../lib/points'
import styles from './Giveaways.module.css'

const fmt = (n) => Number(n || 0).toLocaleString('en-GB')
const Coin = ({ s = 16 }) => <span className={styles.coin} style={{ width: s, height: s }} aria-hidden="true" />
const capOf = (g) => (g.ticket_cost > 0 ? g.max_tickets || null : 1)
const KINDS = { giveaway: 'Giveaway', raffle: 'Raffle' }

function left(ms) {
  if (ms <= 0) return null
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60
  const p = (n) => String(n).padStart(2, '0')
  return d > 0 ? `${d}d ${p(h)}h ${p(m)}m` : `${p(h)}:${p(m)}:${p(x)}`
}

const parts = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const p = (n) => String(n).padStart(2, '0')
  return [['Days', p(Math.floor(s / 86400))], ['Hours', p(Math.floor((s % 86400) / 3600))], ['Min', p(Math.floor((s % 3600) / 60))], ['Sec', p(s % 60)]]
}
const ago = (d) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(d)) / 60000))
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}
const chanceOf = (mine, total) => (mine > 0 && total > 0 ? `${Math.min(100, (mine / total) * 100).toFixed(1)}% chance` : 'Not entered')

const pick = (n) => {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0] % n
}

function Card({ g, tickets, mine, now, onEnter, loggedIn, people }) {
  const ended = g.status === 'ended' || new Date(g.ends_at) <= now
  const t = left(new Date(g.ends_at) - now)
  const cap = capOf(g)
  const full = cap != null && mine >= cap
  const soon = !ended && new Date(g.ends_at) - now < 3600000
  return (
    <article className={`${styles.card} ${ended ? styles.over : ''}`}>
      <div className={styles.art}>
        {g.image_url ? <img src={g.image_url} alt="" loading="lazy" /> : <span className={styles.gift}><Icon name="gift" size={40} /></span>}
        <span className={styles.kind}>{KINDS[g.kind] || 'Giveaway'}</span>
        <span className={`${styles.time} ${soon ? styles.soon : ''}`}>{ended ? (g.winner ? 'Drawn' : 'Ended') : t}</span>
      </div>
      <div className={styles.body}>
        <h3>{g.prize}</h3>
        <p className={styles.desc}>{g.description || g.title}</p>
        <div className={styles.meta}>
          <span>{fmt(tickets)} {tickets === 1 ? 'ticket' : 'tickets'}</span>
          {people > 0 && <span>{fmt(people)} {people === 1 ? 'player' : 'players'}</span>}
          <span>{cap == null ? 'Unlimited' : cap === 1 ? '1 per person' : `Up to ${cap} each`}</span>
        </div>
        {ended ? (
          <div className={styles.winner}>
            <Icon name="trophy" size={16} />
            {g.winner ? <span>Winner <b>{g.winner}</b></span> : <span>Waiting for the draw</span>}
          </div>
        ) : (
          <>
            {loggedIn && (
              <div className={styles.mine}>
                <div><span>Your tickets {mine}{cap != null ? ` / ${cap}` : ''}</span><b>{chanceOf(mine, tickets)}</b></div>
                {cap != null && <div className={styles.bar}><i style={{ width: Math.min(100, (mine / cap) * 100) + '%' }} /></div>}
              </div>
            )}
            <button type="button" className={styles.enter} disabled={full} onClick={() => onEnter(g)}>
              {full ? 'You are in' : !loggedIn ? 'Log in to enter' : g.ticket_cost > 0 ? <>{fmt(g.ticket_cost)} PTS per ticket <Coin s={15} /></> : 'Enter for free'}
            </button>
          </>
        )}
      </div>
    </article>
  )
}

function TicketModal({ g, balance, mine, busy, onClose, onConfirm }) {
  const cap = capOf(g)
  const room = cap == null ? 99 : Math.max(0, cap - mine)
  const afford = g.ticket_cost > 0 && balance != null ? Math.floor(balance / g.ticket_cost) : room
  const max = Math.max(1, Math.min(room, afford || 1))
  const [q, setQ] = useState(1)
  const total = q * g.ticket_cost
  const after = balance != null ? balance - total : null
  const short = g.ticket_cost > 0 && balance != null && balance < total
  useEffect(() => { const k = (e) => e.key === 'Escape' && !busy && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [busy, onClose])
  return (
    <div className={styles.modalBg} onClick={() => !busy && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>{g.prize}</h3>
        <p>{g.title}</p>
        {room > 1 && (
          <div className={styles.step}>
            <button type="button" onClick={() => setQ((x) => Math.max(1, x - 1))} disabled={q <= 1}>−</button>
            <b>{q}</b>
            <button type="button" onClick={() => setQ((x) => Math.min(max, x + 1))} disabled={q >= max}>+</button>
            <small>{q === 1 ? 'ticket' : 'tickets'}</small>
          </div>
        )}
        {g.ticket_cost > 0 && (
          <div className={styles.sum}>
            <div><small>Balance</small><b>{balance == null ? '-' : fmt(balance)}</b></div>
            <div><small>Cost</small><b>-{fmt(total)}</b></div>
            <div><small>After</small><b className={short ? styles.neg : ''}>{after == null ? '-' : fmt(after)}</b></div>
          </div>
        )}
        <button type="button" className={styles.enter} disabled={busy || short} onClick={() => onConfirm(q)}>
          {busy ? 'Processing…' : short ? 'Not enough points' : g.ticket_cost > 0 ? `Spend ${fmt(total)} pts` : 'Confirm'}
        </button>
        <button type="button" className={styles.cancel} disabled={busy} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

export default function Giveaways() {
  const { user, profile } = useAuth()
  const uname = profile?.twitch_username || user?.user_metadata?.full_name || null
  const [list, setList] = useState(null)
  const [entries, setEntries] = useState([])
  const [tab, setTab] = useState('active')
  const [now, setNow] = useState(() => new Date())
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState(null)
  const { points, setPoints, refresh } = useStreamElementsPoints(uname)
  const [toast, setToast] = useState(null)
  const say = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const load = useCallback(async () => {
    const [g, e] = await Promise.all([
      supabase.from('giveaways').select('*').order('ends_at', { ascending: true }),
      supabase.from('giveaway_entries').select('giveaway_id,user_id,twitch_username,tickets'),
    ])
    setList(g.error ? [] : g.data || [])
    setEntries(e.error ? [] : e.data || [])
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, 15000) // live tickets and new giveaways
    return () => clearInterval(id)
  }, [load])
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  const { count, people } = useMemo(() => {
    const c = {}, p = {}
    entries.forEach((x) => { c[x.giveaway_id] = (c[x.giveaway_id] || 0) + (x.tickets || 1); (p[x.giveaway_id] ||= new Set()).add(x.user_id) })
    return { count: c, people: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.size])) }
  }, [entries])
  const mineN = useMemo(() => {
    const m = {}
    entries.forEach((x) => { if (user && x.user_id === user.id) m[x.giveaway_id] = (m[x.giveaway_id] || 0) + (x.tickets || 1) })
    return m
  }, [entries, user])

  const isOver = (g) => g.status === 'ended' || new Date(g.ends_at) <= now
  const active = (list || []).filter((g) => !isOver(g))
  const done = (list || []).filter(isOver).sort((a, b) => new Date(b.ends_at) - new Date(a.ends_at))
  const shown = tab === 'active' ? active : done
  const feat = active[0]

  const enter = (g) => {
    if (!user) return say('Log in with Twitch to enter.', 'error')
    if (!uname) return say('Twitch username not found.', 'error')
    if (g.ticket_cost > 0 && points == null) return say('Loading your points, try again in a second.', 'error')
    setModal(g)
  }

  const confirm = async (q) => {
    const g = modal
    const cost = q * g.ticket_cost
    const cap = capOf(g)
    if (cap != null && (mineN[g.id] || 0) + q > cap) return say('Ticket limit reached.', 'error')
    if (cost > 0 && (points ?? 0) < cost) return say('Not enough points.', 'error')
    setBusy(true)
    try {
      const { ok, data } = await workerPost('/giveaway/enter', { giveaway_id: g.id, tickets: q })
      if (data.newPoints != null) setPoints(data.newPoints)
      if (!ok) {
        const msg = data.error === 'insufficient' ? 'Not enough points.'
          : data.error === 'limit' ? 'Ticket limit reached.'
          : data.error === 'ended' ? 'This giveaway has ended.'
          : data.error === 'not_logged_in' || data.error === 'unauthorized' ? 'Log in again to enter.'
          : data.refunded ? 'Could not enter. Points refunded.' : 'Could not enter, try again.'
        say(msg, 'error')
      } else {
        say(`You are in: ${g.prize}`)
        setModal(null); load(); if (cost > 0) refresh()
      }
    } catch { say('Connection error. Try again.', 'error') }
    setBusy(false)
  }

  const myCount = active.reduce((n, g) => n + (mineN[g.id] || 0), 0)

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Giveaways &amp; Raffles</h1>
          <p className={styles.sub}>Spend your points on tickets, or join the free ones. Log in with Twitch to enter.</p>
        </div>
        <div className={styles.chip}>
          <Coin s={26} />
          <div>
            <b>{points != null ? fmt(points) : 'Log in'}</b>
            <small>{points != null ? `${myCount} active ${myCount === 1 ? 'ticket' : 'tickets'}` : 'to see your points and enter'}</small>
          </div>
        </div>
      </header>

      {feat && (
        <article className={styles.top}>
          <div className={styles.topArt}>
            {feat.image_url ? <img src={feat.image_url} alt="" /> : <Icon name="gift" size={56} />}
          </div>
          <div className={styles.topText}>
            <span className={styles.kind2}>{KINDS[feat.kind]} · Ending soonest</span>
            <h2>{feat.prize}</h2>
            <p>{feat.description || feat.title}</p>
            <div className={styles.topMeta}>
              <span>{fmt(count[feat.id] || 0)} {(count[feat.id] || 0) === 1 ? 'ticket' : 'tickets'}</span>
              {(people[feat.id] || 0) > 0 && <span>{fmt(people[feat.id])} {people[feat.id] === 1 ? 'player' : 'players'}</span>}
              {user && <b>{chanceOf(mineN[feat.id] || 0, count[feat.id] || 0)}</b>}
            </div>
          </div>
          <div className={styles.topSide}>
            <div className={styles.tiles}>
              {parts(new Date(feat.ends_at) - now).map(([l, v]) => <div key={l}><b>{v}</b><small>{l}</small></div>)}
            </div>
            <button type="button" className={styles.enter} disabled={capOf(feat) != null && (mineN[feat.id] || 0) >= capOf(feat)} onClick={() => enter(feat)}>
              {capOf(feat) != null && (mineN[feat.id] || 0) >= capOf(feat) ? 'You are in' : !user ? 'Log in to enter' : feat.ticket_cost > 0 ? <>{fmt(feat.ticket_cost)} PTS per ticket <Coin s={15} /></> : 'Enter for free'}
            </button>
          </div>
        </article>
      )}

      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'active'} className={tab === 'active' ? styles.on : ''} onClick={() => setTab('active')}>Active <i>{active.length}</i></button>
        <button type="button" role="tab" aria-selected={tab === 'ended'} className={tab === 'ended' ? styles.on : ''} onClick={() => setTab('ended')}>Ended <i>{done.length}</i></button>
      </div>

      {list === null ? <p className={styles.empty}>Loading…</p> : shown.length === 0 ? (
        <p className={styles.empty}>{tab === 'active' ? 'No active giveaways right now. Check back soon.' : 'No finished giveaways yet.'}</p>
      ) : (
        <div className={styles.grid}>
          {shown.map((g) => (
            <Card key={g.id} g={g} now={now} loggedIn={!!user} tickets={count[g.id] || 0} people={people[g.id] || 0} mine={mineN[g.id] || 0} onEnter={enter} />
          ))}
        </div>
      )}
      {tab === 'active' && done.some((g) => g.winner) && (
        <section className={styles.recent}>
          <h2>Recently drawn</h2>
          <div className={styles.recentGrid}>
            {done.filter((g) => g.winner).slice(0, 3).map((g) => (
              <div key={g.id} className={styles.drawn}>
                <Icon name="trophy" size={20} />
                <div><b>{g.prize}</b><span>Winner {g.winner}</span></div>
                <small>{ago(g.ends_at)}</small>
              </div>
            ))}
          </div>
        </section>
      )}
      {modal && <TicketModal g={modal} balance={points} mine={mineN[modal.id] || 0} busy={busy} onClose={() => setModal(null)} onConfirm={confirm} />}
      {toast && <div className={`${styles.toast} ${toast.type === 'error' ? styles.err : ''}`} role="status">{toast.msg}</div>}
    </div>
  )
}
