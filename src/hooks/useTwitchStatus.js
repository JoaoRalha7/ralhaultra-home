import { useEffect, useState } from 'react'

const WORKER_URL = 'https://ralha-status.jppralha.workers.dev/'

export function useTwitchStatus() {
  const [live, setLive] = useState(false)

  useEffect(() => {
    async function check() {
      try {
        const r = await fetch(WORKER_URL)
        const d = await r.json()
        setLive(!!d.live)
      } catch {
        setLive(false)
      }
    }

    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [])

  return live
}
