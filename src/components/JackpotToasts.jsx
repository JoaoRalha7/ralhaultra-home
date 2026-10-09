import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const WORKER = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'
const POLL_MS = 5000
const LIFE_MS = 6000
const MAX = 3

const fmt = (n) => Number(n || 0).toLocaleString('en-GB')

function Av({ name, src }) {
  const url = src || `https://unavatar.io/twitch/${encodeURIComponent(String(name).toLowerCase())}?fallback=false`
  const [bad, setBad] = useState(false)
  return (
    <span className="jtAv">
      {String(name || '?').slice(0, 1).toUpperCase()}
      {!bad && <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} />}
    </span>
  )
}

// Site-wide "joined Jackpot" notifications (not shown on the Jackpot page itself).
export default function JackpotToasts({ me, active }) {
  const nav = useNavigate()
  const [items, setItems] = useState([])
  const prev = useRef(null) // { seq, map }
  const uid = useRef(0)

  useEffect(() => {
    if (!active || !me) { prev.current = null; return undefined }
    let off = false
    let timer
    const tick = async () => {
      if (off) return
      if (document.visibilityState === 'visible') {
        try {
          const res = await fetch(`${WORKER}/jackpot/state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
          const d = await res.json()
          const r = d?.ok ? d.round : null
          if (r && !off) {
            const map = new Map((r.players || []).map((p) => [p.u, p.amount]))
            const before = prev.current
            if (before && !r.done) {
              const base = before.seq === r.seq ? before.map : new Map()
              const fresh = []
              for (const p of r.players || []) {
                if (p.u.toLowerCase() === me) continue
                const was = base.get(p.u) || 0
                if (p.amount > was) fresh.push({ id: ++uid.current, u: p.u, add: p.amount - was, isNew: !was, pot: r.pot, av: d.avatars?.[p.u.toLowerCase()] })
              }
              if (fresh.length) setItems((l) => [...l, ...fresh].slice(-MAX))
            }
            prev.current = { seq: r.seq, map }
          }
        } catch { /* ignore */ }
      }
      timer = setTimeout(tick, POLL_MS)
    }
    tick()
    return () => { off = true; clearTimeout(timer) }
  }, [active, me])

  useEffect(() => {
    if (!items.length) return undefined
    const t = setTimeout(() => setItems((l) => l.slice(1)), LIFE_MS)
    return () => clearTimeout(t)
  }, [items])

  if (!active || !items.length) return null
  return (
    <div className="jtStack" aria-live="polite">
      {items.map((it) => (
        <div key={it.id} className="jt" role="status">
          <Av name={it.u} src={it.av} />
          <div className="jtTxt">
            <div className="jtK">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 3" /></svg>Jackpot
            </div>
            <div className="jtN">{it.u} <span>{it.isNew ? 'joined' : 'added'}</span></div>
            <div className="jtS">{it.isNew ? 'bet' : '+'} <b>{fmt(it.add)}</b> pts &middot; pot {fmt(it.pot)}</div>
          </div>
          <button type="button" className="jtGo" onClick={() => { setItems((l) => l.filter((x) => x.id !== it.id)); nav('/jackpot') }}>JOIN</button>
          <i className="jtBar" />
        </div>
      ))}
    </div>
  )
}
