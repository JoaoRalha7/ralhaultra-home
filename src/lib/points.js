import { supabase } from './supabase'

export const WORKER = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : null
}

async function call(path, game) {
  const headers = await authHeaders()
  if (!headers) return { ok: false, status: 401, error: 'not_logged_in' }
  const res = await fetch(`${WORKER}${path}`, { method: 'POST', headers, body: JSON.stringify({ game }) })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, newPoints: body.newPoints ?? null, error: body.error }
}

// Charge a mini-game entry. Price and username are decided by the worker.
export const spendGamePoints = (game) => call('/game/spend', game)

// Undo the last spend for this game (only valid shortly after it).
export const refundGamePoints = (game) => call('/game/refund', game)

// Generic authenticated POST to the worker (identity always comes from the session token).
export async function workerPost(path, body = {}) {
  const headers = await authHeaders()
  if (!headers) return { ok: false, status: 401, data: { error: 'not_logged_in' } }
  const res = await fetch(`${WORKER}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// Streamer only: add or remove points for a viewer.
export const adminPoints = (username, amount) => workerPost('/admin/points', { username, amount })
