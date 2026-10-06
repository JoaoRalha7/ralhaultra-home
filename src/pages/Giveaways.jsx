import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import styles from './Giveaways.module.css'

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

function Card({ g, entries, mine, now, admin, busy, onEnter, onDraw, onDelete, loggedIn }) {
  const ended = g.status === 'ended' || new Date(g.ends_at) <= now
  const t = left(new Date(g.ends_at) - now)
  return (
    <article className={`${styles.card} ${ended ? styles.over : ''}`}>
      <div className={styles.art}>
        {g.image_url ? <img src={g.image_url} alt="" loading="lazy" /> : <span className={styles.gift}><Icon name="gift" size={34} /></span>}
        <span className={styles.kind}>{KINDS[g.kind] || 'Giveaway'}</span>
      </div>
      <div className={styles.body}>
        <h3>{g.prize}</h3>
        <p>{g.title}</p>
        <div className={styles.meta}>
          <span><Icon name="users" size={14} />{entries} {entries === 1 ? 'entry' : 'entries'}</span>
          {!ended && t && <span className={styles.timer}><Icon name="clock" size={14} />{t}</span>}
        </div>
        {ended ? (
          <div className={styles.winner}>
            <Icon name="trophy" size={16} />
            {g.winner ? <span>Winner <b>{g.winner}</b></span> : <span>Waiting for the draw</span>}
          </div>
        ) : (
          <button type="button" className={styles.enter} disabled={mine || busy} onClick={() => onEnter(g)}>
            {mine ? 'You are in' : !loggedIn ? 'Log in to enter' : busy ? 'Entering…' : 'Enter'}
          </button>
        )}
        {admin && (
          <div className={styles.adm}>
            {ended && !g.winner && entries > 0 && <button type="button" onClick={() => onDraw(g)}>Draw winner</button>}
            {!ended && entries > 0 && <button type="button" onClick={() => onDraw(g)}>End and draw</button>}
            <button type="button" className={styles.del} onClick={() => onDelete(g)}>Delete</button>
          </div>
        )}
      </div>
    </article>
  )
}

function NewForm({ onCreate }) {
  const [f, setF] = useState({ prize: '', title: '', kind: 'giveaway', ends_at: '', image_url: '' })
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const ok = f.prize.trim() && f.title.trim() && f.ends_at
  return (
    <form className={styles.form} onSubmit={(e) => { e.preventDefault(); if (ok) { onCreate({ ...f, ends_at: new Date(f.ends_at).toISOString(), image_url: f.image_url.trim() || null }); setF({ prize: '', title: '', kind: 'giveaway', ends_at: '', image_url: '' }) } }}>
      <b>New giveaway</b>
      <input placeholder="Prize (e.g. 500 EUR cash)" value={f.prize} onChange={set('prize')} />
      <input placeholder="Title" value={f.title} onChange={set('title')} />
      <select value={f.kind} onChange={set('kind')}><option value="giveaway">Giveaway</option><option value="raffle">Raffle</option></select>
      <input type="datetime-local" value={f.ends_at} onChange={set('ends_at')} />
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
  const [busy, setBusy] = useState(null)
  const [toast, setToast] = useState(null)
  const say = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const load = useCallback(async () => {
    const [g, e] = await Promise.all([
      supabase.from('giveaways').select('*').order('ends_at', { ascending: true }),
      supabase.from('giveaway_entries').select('giveaway_id,user_id,twitch_username'),
    ])
    setList(g.error ? [] : g.data || [])
    setEntries(e.error ? [] : e.data || [])
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  const count = useMemo(() => { const m = {}; entries.forEach((x) => { m[x.giveaway_id] = (m[x.giveaway_id] || 0) + 1 }); return m }, [entries])
  const mineSet = useMemo(() => new Set(entries.filter((x) => user && x.user_id === user.id).map((x) => x.giveaway_id)), [entries, user])

  const isOver = (g) => g.status === 'ended' || new Date(g.ends_at) <= now
  const active = (list || []).filter((g) => !isOver(g))
  const done = (list || []).filter(isOver).sort((a, b) => new Date(b.ends_at) - new Date(a.ends_at))
  const shown = tab === 'active' ? active : done
  const feat = active[0]

  const enter = async (g) => {
    if (!user) return say('Log in with Twitch to enter.', 'error')
    if (!uname) return say('Twitch username not found.', 'error')
    setBusy(g.id)
    const { error } = await supabase.from('giveaway_entries').insert({ giveaway_id: g.id, user_id: user.id, twitch_username: uname })
    setBusy(null)
    if (error) return say(error.code === '23505' ? 'You already entered.' : 'Could not enter, try again.', 'error')
    say(`You are in: ${g.prize}`)
    load()
  }

  const create = async (row) => {
    const { error } = await supabase.from('giveaways').insert(row)
    if (error) return say(error.message, 'error')
    say('Created.'); load()
  }

  const draw = async (g) => {
    const pool = entries.filter((x) => x.giveaway_id === g.id)
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

  const myCount = [...mineSet].filter((id) => active.some((g) => g.id === id)).length
  const ft = feat && left(new Date(feat.ends_at) - now)

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Giveaways &amp; Raffles</h1>
          <p className={styles.sub}>Free entries for everyone watching. Log in with Twitch and join.</p>
        </div>
        <div className={styles.chip}>
          <Icon name="gift" size={22} />
          <div>
            <b>{user ? myCount : 'Log in'}</b>
            <small>{user ? (myCount === 1 ? 'active entry' : 'active entries') : 'to enter giveaways'}</small>
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
            <div className={styles.count}><b>{ft}</b><small>{count[feat.id] || 0} entries</small></div>
            <button type="button" className={styles.enter} disabled={mineSet.has(feat.id) || busy === feat.id} onClick={() => enter(feat)}>
              {mineSet.has(feat.id) ? 'You are in' : !user ? 'Log in to enter' : 'Enter now'}
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
            <Card key={g.id} g={g} now={now} admin={admin} loggedIn={!!user} entries={count[g.id] || 0} mine={mineSet.has(g.id)} busy={busy === g.id} onEnter={enter} onDraw={draw} onDelete={del} />
          ))}
        </div>
      )}
      {toast && <div className={`${styles.toast} ${toast.type === 'error' ? styles.err : ''}`} role="status">{toast.msg}</div>}
    </div>
  )
}
