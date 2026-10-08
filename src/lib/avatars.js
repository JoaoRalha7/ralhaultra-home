import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Twitch profile pictures by (lowercase) username, cached for the whole session.
const cache = new Map() // name -> url | null
const pending = new Set()
const listeners = new Set()

async function fetchMissing(names) {
  const want = names.filter(n => n && !cache.has(n) && !pending.has(n)).slice(0, 150)
  if (!want.length) return
  want.forEach(n => pending.add(n))
  try {
    // profiles is RLS-protected for other users -> security-definer RPC (supabase/avatars.sql); table select as fallback
    let data = null
    try { const r = await supabase.rpc('get_avatars', { p_names: want }); if (!r.error) data = r.data } catch { /* fallback */ }
    if (!data) { try { data = (await supabase.from('profiles').select('twitch_username, avatar_url').in('twitch_username', want)).data } catch { /* none */ } }
    // default: Twitch picture via unavatar (works for any Twitch name), then saved avatar overrides it
    want.forEach(n => cache.set(n, `https://unavatar.io/twitch/${encodeURIComponent(n)}?fallback=false`))
    ;(data || []).forEach(r => { if (r.twitch_username && r.avatar_url) cache.set(r.twitch_username.toLowerCase(), r.avatar_url) })
  } catch { want.forEach(n => cache.set(n, `https://unavatar.io/twitch/${encodeURIComponent(n)}?fallback=false`)) }
  want.forEach(n => pending.delete(n))
  listeners.forEach(fn => fn())
}

// names: array of usernames (any case). Returns { lowercaseName: url }.
export function useAvatars(names) {
  const key = [...new Set((names || []).map(n => String(n || '').toLowerCase()).filter(Boolean))].sort().join(',')
  const [, bump] = useState(0)
  useEffect(() => {
    const fn = () => bump(v => v + 1)
    listeners.add(fn)
    fetchMissing(key.split(',').filter(Boolean))
    return () => { listeners.delete(fn) }
  }, [key])
  const out = {}
  key.split(',').filter(Boolean).forEach(n => { if (cache.get(n)) out[n] = cache.get(n) })
  return out
}
