import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { useAuth } from '../hooks/useAuth'
import { useStreamElementsPoints } from '../hooks/useStreamElementsPoints'
import { supabase } from '../lib/supabase'
import styles from './Giveaways.module.css'

const SE_WORKER_URL = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'
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

const pick = (n) => {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0] % n
}

function Card({ g, tickets, mine, now, admin, onEnter, onDraw, onDelete, loggedIn, people }) {
  const ended = g.status === 'ended' || new Date(g.ends_at) <= now
  const t = left(new Date(g.ends_at) - now)
  const cap = capOf(g)
  const full = cap != null && mine >= cap
  return (
    <article className={`${styles.card} ${ended ? styles.over : ''}`}>
      <div className={styles.art}>
        {g.image_url ? <img src={g.image_url} alt="" loading="lazy" /> : <span className={styles.gift}><Icon name="gift" size={34} /></span>}
        <span className={styles.kind}>{KINDS[g.kind] || 'Giveaway'}</span>
      </div>
      <div className={styles.body}>
        <h3>{g.prize}</h3>
        <p className={styles.desc}>{g.description || g.title}</p>
        <ul className={styles.facts}>
          <li><Icon name="cards" size={15} />{cap == null ? 'Unlimited tickets' : cap === 1 ? '1 ticket per person' : `Up to ${cap} tickets`}</li>
          <li className={!ended ? styles.timer : ''}><Icon name="clock" size={15} />{ended ? (g.winner ? 'Drawn' : 'Ended') : `Ends in ${t}`}</li>
          <li><Icon name="users" size={15} /><span className={styles.pill}>{fmt(tickets)}</span>{people > 0 && <small>{fmt(people)} {people === 1 ? 'player' : 'players'}</small>}{mine > 0 && <small className={styles.you}>You: {mine}</small>}</li>
        </ul>
        {ended ? (
          <div className={styles.winner}>
            <Icon name="trophy" size={16} />
            {g.winner ? <span>Winner <b>{g.winner}</b></span> : <span>Waiting for the draw</span>}
          </div>
        ) : (
          <button type="button" className={styles.enter} disabled={full} onClick={() => onEnter(g)}>
            {full ? 'You are in' : !loggedIn ? 'Log in to enter' : g.ticket_cost > 0 ? <>{fmt(g.ticket_cost)} PTS. <Coin s={15} /></> : 'Enter for free'}
          </button>
        )}
        {admin && (
          <div className={styles.adm}>
            {ended && !g.winner && tickets > 0 && <button type="button" onClick={() => onDraw(g)}>Draw winner</button>}
            {!ended && tickets > 0 && <button type="button" onClick={() => onDraw(g)}>End and draw</button>}
            <button type="button" className={styles.del} onClick={() => onDelete(g)}>Delete</button>
          </div>
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

const EMPTY = { prize: '', title: '', description: '', kind: 'giveaway', ends_at: '', image_url: '', ticket_cost: '0', max_tickets: '' }
function NewForm({ onCreate }) {
  const [f, setF] = useState(EMPTY)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const ok = f.prize.trim() && f.title.trim() && f.ends_at
  return (
    <form className={styles.form} onSubmit={(e) => {
      e.preventDefault(); if (!ok) return
      onCreate({
        prize: f.prize.trim(), title: f.title.trim(), description: f.description.trim() || null, kind: f.kind,
        ends_at: new Date(f.ends_at).toISOString(), image_url: f.image_url.trim() || null,
        ticket_cost: Math.max(0, parseInt(f.ticket_cost, 10) || 0), max_tickets: parseInt(f.max_tickets, 10) || null,
      })
      setF(EMPTY)
    }}>
      <b>New giveaway</b>
      <input placeholder="Prize (e.g. PS5 + GTA VI)" value={f.prize} onChange={set('prize')} />
      <input placeholder="Title" value={f.title} onChange={set('title')} />
      <input placeholder="Description (optional)" value={f.description} onChange={set('description')} />
      <select value={f.kind} onChange={set('kind')}><option value="giveaway">Giveaway</option><option value="raffle">Raffle</option></select>
      <input type="datetime-local" value={f.ends_at} onChange={set('ends_at')} />
      <input type="number" min="0" placeholder="Ticket cost (pts, 0 = free)" value={f.ticket_cost} onChange={set('ticket_cost')} />
      <input type="number" min="1" placeholder="Max tickets (empty = unlimited)" value={f.max_tickets} onChange={set('max_tickets')} />
      <input placeholder="Image URL (optional)" value={f.image_url} onChange={set('image_url')} />
      <button type="submit" disabled={!ok}>Create</button>
    </form>
  )
}

export default function Giveaways() {
  const { user, profile, isAdmin } = useAuth()
  const admin = isAdmin()
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

  useEffect(() => { load() }, [load])
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
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_WORKER_SECRET}` }
    const move = (amount) => fetch(`${SE_WORKER_URL}/points/update`, { method: 'PUT', headers, body: JSON.stringify({ username: uname.toLowerCase(), amount }) })
    try {
      if (cost > 0) {
        const r = await move(-cost)
        if (!r.ok) { say('Error deducting points. Try again.', 'error'); setBusy(false); return }
        const d = await r.json().catch(() => ({}))
        setPoints(d.newPoints != null ? d.newPoints : (p) => Math.max(0, (p ?? 0) - cost))
      }
      const { error } = await supabase.from('giveaway_entries').insert({ giveaway_id: g.id, user_id: user.id, twitch_username: uname, tickets: q, cost_paid: cost })
      if (error) {
        if (cost > 0) { await move(cost); setPoints((p) => (p ?? 0) + cost) }
        say(cost > 0 ? 'Could not enter. Points refunded.' : 'Could not enter, try again.', 'error')
      } else {
        say(`You are in: ${g.prize}`)
        setModal(null); load(); if (cost > 0) refresh()
      }
    } catch { say('Connection error. Try again.', 'error') }
    setBusy(false)
  }

  const create = async (row) => {
    const { error } = await supabase.from('giveaways').insert(row)
    if (error) return say(error.message, 'error')
    say('Created.'); load()
  }

  const draw = async (g) => {
    const pool = entries.filter((x) => x.giveaway_id === g.id).flatMap((x) => Array(x.tickets || 1).fill(x))
    if (!pool.length) return say('No entries.', 'error')
    const w = pool[pick(pool.length)].twitch_username
    const { error } = await supabase.from('giveaways').update({ winner: w, status: 'ended' }).eq('id', g.id)
    if (error) return say(error.message, 'error')
    say(`Winner: ${w}`); load()
  }

  const del = async (g) => {
    if (!window.confirm(`Delete "${g.prize}"?`)) return
    const { error } = await supabase.from('giveaways').delete().eq('id', g.id)
    if (error) return say(error.message, 'error')
    load()
  }

  const myCount = active.reduce((n, g) => n + (mineN[g.id] || 0), 0)
  const ft = feat && left(new Date(feat.ends_at) - now)

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
            {feat.image_url ? <img src={feat.image_url} alt="" /> : <Icon name="gift" size={64} />}
          </div>
          <div className={styles.topText}>
            <span className={styles.kind2}>{KINDS[feat.kind]} · Ending soonest</span>
            <h2>{feat.prize}</h2>
            <p>{feat.title}</p>
          </div>
          <div className={styles.topSide}>
            <div className={styles.count}><b>{ft}</b><small>{fmt(count[feat.id] || 0)} tickets</small></div>
            <button type="button" className={styles.enter} disabled={capOf(feat) != null && (mineN[feat.id] || 0) >= capOf(feat)} onClick={() => enter(feat)}>
              {capOf(feat) != null && (mineN[feat.id] || 0) >= capOf(feat) ? 'You are in' : !user ? 'Log in to enter' : feat.ticket_cost > 0 ? <>{fmt(feat.ticket_cost)} PTS. <Coin s={15} /></> : 'Enter for free'}
            </button>
          </div>
        </article>
      )}

      {admin && <NewForm onCreate={create} />}

      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'active'} className={tab === 'active' ? styles.on : ''} onClick={() => setTab('active')}>Active <i>{active.length}</i></button>
        <button type="button" role="tab" aria-selected={tab === 'ended'} className={tab === 'ended' ? styles.on : ''} onClick={() => setTab('ended')}>Ended <i>{done.length}</i></button>
      </div>

      {list === null ? <p className={styles.empty}>Loading…</p> : shown.length === 0 ? (
        <p className={styles.empty}>{tab === 'active' ? 'No active giveaways right now. Check back soon.' : 'No finished giveaways yet.'}</p>
      ) : (
        <div className={styles.grid}>
          {shown.map((g) => (
            <Card key={g.id} g={g} now={now} admin={admin} loggedIn={!!user} tickets={count[g.id] || 0} people={people[g.id] || 0} mine={mineN[g.id] || 0} onEnter={enter} onDraw={draw} onDelete={del} />
          ))}
        </div>
      )}
      {modal && <TicketModal g={modal} balance={points} mine={mineN[modal.id] || 0} busy={busy} onClose={() => setModal(null)} onConfirm={confirm} />}
      {toast && <div className={`${styles.toast} ${toast.type === 'error' ? styles.err : ''}`} role="status">{toast.msg}</div>}
    </div>
  )
}
