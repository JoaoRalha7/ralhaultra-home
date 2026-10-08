import { supabase } from './supabase'
import { WORKER } from './points'

// Authenticated GET against the Worker. Returns parsed JSON or null.
export async function workerGet(path) {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) return null
    const r = await fetch(`${WORKER}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    return r.ok ? await r.json() : null
  } catch { return null }
}
