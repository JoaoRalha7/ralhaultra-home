import { useState, useEffect, useCallback } from 'react'

const SE_WORKER_URL = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'

export function useStreamElementsPoints(twitchUsername) {
  const [points,  setPoints]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [tick,    setTick]    = useState(0)

  useEffect(() => {
    if (!twitchUsername) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`${SE_WORKER_URL}?username=${twitchUsername.toLowerCase()}`)
      .then(res => {
        if (!res.ok) throw new Error(`Worker erro ${res.status}`)
        return res.json()
      })
      .then(data => { if (!cancelled) setPoints(data.points ?? 0) })
      .catch(err  => { if (!cancelled) setError(err.message) })
      .finally(()  => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [twitchUsername, tick])

  const refresh = useCallback(() => setTick(t => t + 1), [])

  // setPoints exposto para actualizar localmente após resgate
  return { points, setPoints, loading, error, refresh }
}