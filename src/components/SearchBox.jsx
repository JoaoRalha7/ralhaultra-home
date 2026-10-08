import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { supabase, supabaseDash } from '../lib/supabase'
import { openPlayer } from './PlayerModal'
import { Medal } from './Medal'
import { WORKER } from '../lib/points'
import { isVideoUrl } from './ProductMedia'
import s from './SearchBox.module.css'

// same sections as the sidebar
export const NAV_SECTIONS = [
  ['Discover', [['home', 'Home', '/'], ['tag', 'Casinos & Offers', '/offers'], ['trophy', 'Leaderboard', '/leaderboard']]],
  ['Rewards', [['crown', 'VIP', '/vip'], ['gift', 'Giveaways & Raffles', '/giveaways'], ['bag', 'Shop', '/shop']]],
  ['Casino', [['originals', 'Originals', '/originals'], ['mines', 'Mines', '/mines'], ['cards', 'Blackjack', '/blackjack'], ['crash', 'Crash', '/crash'], ['keno', 'Keno', '/keno'], ['plinko', 'Plinko', '/plinko'], ['roulette', 'Roulette', '/roulette'], ['jackpot', 'Jackpot', '/jackpot']]],
  ['Stream', [['slots', 'Slots', '/slots'], ['spark', 'Bonus Hunts', '/bonus-hunts'], ['ball', 'Tournaments', '/torneios'], ['pulse', 'Stats', '/stats'], ['play', 'Stream', '/stream'], ['users', 'Community', '/community']]],
]

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function Hl({ text, q }) {
  if (!q) return text
  const parts = String(text).split(new RegExp(`(${esc(q)})`, 'ig'))
  return parts.map((p, i) => (p.toLowerCase() === q.toLowerCase() ? <mark key={i}>{p}</mark> : p))
}

export default function SearchBox() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ shop: [], casinos: [], giveaways: [] })
  const [slots, setSlots] = useState([])
  const [people, setPeople] = useState([])
  const [cur, setCur] = useState(0)
  const loaded = useRef(false)
  const box = useRef(null)
  const input = useRef(null)

  // site data is loaded once, the first time the box is used
  const load = () => {
    if (loaded.current) return
    loaded.current = true
    Promise.all([
      supabase.from('shop_products').select('id,name,image_url').eq('active', true).limit(100),
      supabase.from('casinos').select('id,name,logo_url').eq('is_active', true).limit(100),
      supabase.from('giveaways').select('id,title,image_url').order('ends_at', { ascending: false }).limit(30),
    ]).then(([a, b, c]) => setData({ shop: a.data || [], casinos: b.data || [], giveaways: c.data || [] })).catch(() => {})
  }

  const term = q.trim().replace(/^@/, '')
  const isPlayer = q.trim().startsWith('@')

  // @ + letters: members who logged in to the site
  useEffect(() => {
    if (!isPlayer || !term) { setPeople([]); return }
    let off = false
    const t = setTimeout(() => {
      fetch(`${WORKER}/players?q=${encodeURIComponent(term)}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (!off) setPeople(d?.players || []) }).catch(() => {})
    }, 180)
    return () => { off = true; clearTimeout(t) }
  }, [term, isPlayer])

  useEffect(() => {
    if (isPlayer || term.length < 2) { setSlots([]); return }
    let off = false
    const t = setTimeout(() => {
      supabaseDash.from('slots').select('id,name,image_url').ilike('name', `%${term}%`).order('name').limit(6)
        .then(({ data: d }) => { if (!off) setSlots(d || []) }).catch(() => {})
    }, 220)
    return () => { off = true; clearTimeout(t) }
  }, [term, isPlayer])

  const groups = useMemo(() => {
    const t = term.toLowerCase()
    const has = (n) => !t || String(n || '').toLowerCase().includes(t)
    const out = []
    if (isPlayer) {
      if (term) {
        const list = people.map((x) => ({ key: 'pl' + x.username, img: x.avatar || `https://unavatar.io/twitch/${encodeURIComponent(x.username)}?fallback=false`, level: x.level, icon: 'users', name: x.username, run: () => openPlayer(x.username) }))
        out.push({ label: 'Members', items: list.length ? list : [{ key: 'p', icon: 'users', name: `Open @${term.toLowerCase()}`, run: () => openPlayer(term) }] })
      }
      return out
    }
    NAV_SECTIONS.forEach(([label, list]) => {
      const items = list.filter(([, n]) => has(n)).map(([ic, n, to]) => ({ key: 'pg' + to, icon: ic, name: n, run: () => navigate(to) }))
      if (items.length) out.push({ label, items })
    })
    if (t) {
      const slotItems = slots.map((x) => ({ key: 'sl' + x.id, img: x.image_url, icon: 'slots', name: x.name, run: () => navigate('/slots', { state: { slotId: x.id } }) }))
      if (slotItems.length) out.push({ label: 'Slots', items: slotItems })
      const gv = data.giveaways.filter((x) => has(x.title)).slice(0, 5).map((x) => ({ key: 'gv' + x.id, img: x.image_url, icon: 'gift', name: x.title, run: () => navigate('/giveaways') }))
      if (gv.length) out.push({ label: 'Giveaways', items: gv })
      const sh = data.shop.filter((x) => has(x.name)).slice(0, 8).map((x) => ({ key: 'sh' + x.id, img: isVideoUrl(x.image_url) ? null : x.image_url, icon: 'bag', name: x.name, run: () => navigate('/shop') }))
      if (sh.length) out.push({ label: 'Shop', items: sh })
      const cs = data.casinos.filter((x) => has(x.name)).slice(0, 8).map((x) => ({ key: 'cs' + x.id, img: x.logo_url, icon: 'tag', name: x.name, run: () => navigate('/offers') }))
      if (cs.length) out.push({ label: 'Casinos', items: cs })
    }
    return out
  }, [term, isPlayer, slots, people, data, navigate])

  const flat = groups.flatMap((g) => g.items)
  useEffect(() => { setCur(0) }, [term])
  useEffect(() => {
    const down = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [])
  useEffect(() => { document.querySelector(`.${s.on}`)?.scrollIntoView({ block: 'nearest' }) }, [cur])

  const go = (it) => { it.run(); setOpen(false); setQ(''); input.current?.blur() }
  const onKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); input.current?.blur() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setCur((c) => Math.min(flat.length - 1, c + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCur((c) => Math.max(0, c - 1)) }
    else if (e.key === 'Enter' && q.trim()) {
      e.preventDefault()
      if (flat[cur]) go(flat[cur])
      else if (!isPlayer) { navigate(`/slots?q=${encodeURIComponent(q.trim())}`); setOpen(false); setQ('') }
    }
  }

  let idx = -1
  return (
    <div className={s.wrap} ref={box}>
      <label className="search">
        <Icon name="search" />
        <input ref={input} value={q} placeholder="Search..." aria-label="Search the site, slots or players (type @ before a username)" autoComplete="off"
          onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => { load(); setOpen(true) }} onKeyDown={onKey} />
      </label>
      {open && (
        <div className={s.drop} role="listbox">
          {groups.length === 0 && <div className={s.none}>{term.length < 2 ? 'Keep typing...' : 'No results.'}</div>}
          {groups.map((g) => (
            <div key={g.label} className={s.grp}>
              <div className={s.gl}>{g.label}</div>
              {g.items.map((it) => {
                idx++
                const mine = idx
                return (
                  <button type="button" key={it.key} role="option" aria-selected={cur === mine} className={`${s.item}${cur === mine ? ` ${s.on}` : ''}`}
                    onMouseEnter={() => setCur(mine)} onMouseDown={(e) => e.preventDefault()} onClick={() => go(it)}>
                    {it.img ? <img src={it.img} alt="" loading="lazy" /> : <span className={s.ic}><Icon name={it.icon} size={16} /></span>}
                    <span className={s.nm}><Hl text={it.name} q={term} /></span>
                    {it.level !== undefined && <span className={s.lv}><Medal level={it.level} size={16} /></span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
