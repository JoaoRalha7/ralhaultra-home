import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'

const SE_WORKER_URL = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'

// One shared balance per user: the header, the games, the shop... all read and write the same value,
// so a bet or a win shows up in the top bar straight away.
const store = new Map() // key -> number | null
const subs = new Set()
const keyOf = (u) => (u ? String(u).toLowerCase() : '')
const emit = () => subs.forEach((f) => f())
const subscribe = (f) => { subs.add(f); return () => subs.delete(f) }
let ver = 0 // bumped on every local write, so a slower fetch that started earlier can't overwrite it
const put = (k, v) => { ver++; if (store.get(k) === v) return; store.set(k, v); emit() }

async function fetchPoints(k) {
  const v0 = ver
  const res = await fetch(`${SE_WORKER_URL}?username=${k}`)
  if (!res.ok) throw new Error(`Worker erro ${res.status}`)
  const data = await res.json()
  return { points: data.points ?? 0, stale: ver !== v0 && store.has(k) }
}
// a game animating its result can hold back server refreshes so the balance does not spoil it
let held = false
export const holdPointsPulls = (on) => { held = !!on }
const pull = (k) => (held ? Promise.resolve() : fetchPoints(k).then((r) => { if (!r.stale) put(k, r.points) }))

// opts.poll: refresh every N ms while the tab is visible (used by the header)
export function useStreamElementsPoints(twitchUsername, opts = {}) {
  const k = keyOf(twitchUsername)
  const points = useSyncExternalStore(subscribe, () => (k && store.has(k) ? store.get(k) : null))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  const poll = opts.poll || 0

  useEffect(() => {
    if (!k) return
    let cancelled = false
    setLoading(true); setError(null)
    pull(k)
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [k, tick])

  useEffect(() => {
    if (!k || !poll) return
    const run = () => { if (document.visibilityState === 'visible') pull(k).catch(() => {}) }
    const id = setInterval(run, poll)
    document.addEventListener('visibilitychange', run)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', run) }
  }, [k, poll])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  // accepts a value or an updater, like useState; broadcasts to every component
  const setPoints = useCallback((v) => {
    if (!k) return
    const cur = store.has(k) ? store.get(k) : null
    put(k, typeof v === 'function' ? v(cur) : v)
  }, [k])

  return { points, setPoints, loading, error, refresh }
}
