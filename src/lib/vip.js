import { supabase } from './supabase'
import { WORKER } from './points'

// Authenticated GET against the Worker. Returns parsed JSON or null.
export async function workerGet(path) {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) return null
    const r = await fetch(`${WORKER}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    if (r.status === 401 || r.status === 403) await dropDeadSession()
    return r.ok ? await r.json() : null
  } catch { return null }
}

// After sessions are revoked server-side (e.g. the launch reset) the browser still holds the old token:
// confirm with Supabase and, if it is really dead, log out locally so the user just logs in again.
let checking = null
function dropDeadSession() {
  if (!checking) {
    checking = supabase.auth.getUser()
      .then(({ error }) => { if (error && (error.status === 401 || error.status === 403 || /session|jwt|token/i.test(error.message || ''))) return supabase.auth.signOut({ scope: 'local' }) })
      .catch(() => {})
      .finally(() => { setTimeout(() => { checking = null }, 5000) })
  }
  return checking
}
