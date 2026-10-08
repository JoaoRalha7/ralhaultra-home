import { useEffect, useState } from 'react'
import { WORKER } from './points'

// username (lowercase) -> { lvl, t }. Shared by every feed so each name is looked up once a minute at most.
const cache = new Map()
const TTL = 60000

export function useRanks(usernames) {
  const key = [...new Set((usernames || []).filter(Boolean).map((u) => String(u).toLowerCase()))].sort().join(',')
  const [, bump] = useState(0)
  useEffect(() => {
    const now = Date.now()
    const need = key ? key.split(',').filter((n) => !cache.has(n) || now - cache.get(n).t > TTL) : []
    if (!need.length) return
    let alive = true
    fetch(`${WORKER}/ranks?u=${encodeURIComponent(need.join(','))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        const t = Date.now()
        for (const n of need) cache.set(n, { lvl: d.ranks?.[n] ?? 0, t })
        if (alive) bump((x) => x + 1)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [key])
  return (name) => cache.get(String(name || '').toLowerCase())?.lvl
}
