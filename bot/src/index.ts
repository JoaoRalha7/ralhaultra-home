import { RefreshingAuthProvider } from '@twurple/auth'
import { ChatClient } from '@twurple/chat'
import { ApiClient } from '@twurple/api'
import { createClient } from '@supabase/supabase-js'

const env = (k: string): string => {
  const v = process.env[k]
  if (!v) throw new Error(`Missing env var ${k}`)
  return v
}

const CHANNEL = env('TWITCH_CHANNEL').toLowerCase()
const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'), { auth: { persistSession: false } })

// ---- config (read from economy_config, cached 60s) ----
let cfgCache: Record<string, any> = {}
let cfgAt = 0
async function cfg(key: string, fallback: any): Promise<any> {
  if (Date.now() - cfgAt > 60_000) {
    const { data } = await sb.from('economy_config').select('key,value')
    if (data) cfgCache = Object.fromEntries(data.map((r) => [r.key, r.value]))
    cfgAt = Date.now()
  }
  return cfgCache[key] ?? fallback
}

const fmt = (n: number) => Math.floor(n).toLocaleString('pt-PT')

async function main() {
  const auth = new RefreshingAuthProvider({ clientId: env('TWITCH_CLIENT_ID'), clientSecret: env('TWITCH_CLIENT_SECRET') })
  const botId = await auth.addUserForToken(
    { accessToken: env('BOT_ACCESS_TOKEN'), refreshToken: env('BOT_REFRESH_TOKEN'), expiresIn: 0, obtainmentTimestamp: 0 },
    ['chat'],
  )
  // Optional: the broadcaster's own token (scope channel:read:subscriptions) lets the bot know every sub, even lurkers.
  let bcAuthId: string | null = null
  if (process.env.BROADCASTER_ACCESS_TOKEN && process.env.BROADCASTER_REFRESH_TOKEN) {
    bcAuthId = await auth.addUserForToken({ accessToken: env('BROADCASTER_ACCESS_TOKEN'), refreshToken: env('BROADCASTER_REFRESH_TOKEN'), expiresIn: 0, obtainmentTimestamp: 0 })
  }
  const api = new ApiClient({ authProvider: auth })
  const chat = new ChatClient({ authProvider: auth, channels: [CHANNEL] })

  const broadcaster = await api.users.getUserByName(CHANNEL)
  if (!broadcaster) throw new Error(`Channel ${CHANNEL} not found`)

  // ---- commands ----
  const cooldown = new Map<string, number>()
  chat.onMessage(async (channel, user, text, msg) => {
    if (msg.userInfo.userId === botId || !text.startsWith('!')) return
    const cmd = text.slice(1).split(/\s+/)[0].toLowerCase()
    const key = `${user}:${cmd}`
    if (Date.now() - (cooldown.get(key) ?? 0) < 5000) return
    cooldown.set(key, Date.now())
    const name = user.toLowerCase()

    if (cmd === 'points' || cmd === 'pontos') {
      const { data } = await sb.from('point_balances').select('balance').eq('username', name).maybeSingle()
      await chat.say(channel, `@${user} tens ${fmt(Number(data?.balance ?? 0))} pontos.`)
    } else if (cmd === 'watchtime') {
      const { data } = await sb.from('point_balances').select('watch_minutes').eq('username', name).maybeSingle()
      const m = Number(data?.watch_minutes ?? 0)
      await chat.say(channel, `@${user} já viste ${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m de stream.`)
    } else if (cmd === 'level' || cmd === 'nivel') {
      const [{ data: me }, { data: lv }] = await Promise.all([
        sb.from('point_balances').select('level,wagered_total,watch_minutes').eq('username', name).maybeSingle(),
        sb.from('vip_levels').select('*').order('level'),
      ])
      const levels = lv ?? []
      const cur = levels.find((l) => l.level === (me?.level ?? 0))
      const next = levels.find((l) => l.level === (me?.level ?? 0) + 1)
      const hrs = Math.floor(Number(me?.watch_minutes ?? 0) / 60)
      let msg = `@${user} nível ${cur?.name ?? 'Member'} | ${fmt(Number(me?.wagered_total ?? 0))} apostados | ${hrs}h de stream`
      if (next) msg += ` | próximo: ${next.name} (${fmt(Number(next.min_wagered))} apostados e ${next.min_watch_hours}h)`
      await chat.say(channel, msg)
    } else if (cmd === 'top') {
      const { data } = await sb.from('point_balances').select('username,balance').order('balance', { ascending: false }).limit(5)
      const line = (data ?? []).map((r, i) => `${i + 1}. ${r.username} (${fmt(Number(r.balance))})`).join(' | ')
      await chat.say(channel, `Top pontos: ${line}`)
    }
  })

  // ---- who may earn, and at what tier ----
  const subTier = new Map<string, number>() // twitch id -> 1..3
  const refreshSubs = async () => {
    if (!bcAuthId) return
    try {
      const subs = await api.asUser(bcAuthId, (c) => c.subscriptions.getSubscriptionsPaginated(broadcaster.id).getAll())
      subTier.clear()
      for (const x of subs) subTier.set(x.userId, Math.min(3, Math.max(1, Math.floor(Number(x.tier) / 1000) || 1)))
      console.log(`subs refreshed: ${subTier.size}`)
    } catch (e) { console.error('subs refresh failed (keeping previous list)', (e as Error).message) }
  }
  await refreshSubs()
  setInterval(refreshSubs, 5 * 60_000)

  const createdAt = new Map<string, number>() // account age never changes
  const followCache = new Map<string, { ok: boolean; at: number }>()
  let followWarned = false
  const isEligible = async (ids: string[]): Promise<Set<string>> => {
    const minDays = Number(await cfg('min_account_age_days', 7))
    const needFollow = (await cfg('require_follow', true)) === true
    const ok = new Set<string>()
    const unknown = ids.filter((id) => !createdAt.has(id))
    for (let i = 0; i < unknown.length; i += 100) {
      try { for (const u of await api.users.getUsersByIds(unknown.slice(i, i + 100))) createdAt.set(u.id, u.creationDate.getTime()) } catch (e) { console.error('users lookup failed', (e as Error).message) }
    }
    for (const id of ids) {
      const born = createdAt.get(id)
      if (born !== undefined && Date.now() - born < minDays * 86_400_000) continue // too young
      if (needFollow && id !== broadcaster.id) {
        const c = followCache.get(id)
        let follows = c && Date.now() - c.at < (c.ok ? 6 * 3600_000 : 10 * 60_000) ? c.ok : undefined
        if (follows === undefined) {
          try {
            const r = await api.asUser(botId, (x) => x.channels.getChannelFollowers(broadcaster.id, id))
            follows = r.data.length > 0
            followCache.set(id, { ok: follows, at: Date.now() })
          } catch (e) {
            if (!followWarned) { followWarned = true; console.error('follow check unavailable (bot token needs moderator:read:followers); allowing everyone', (e as Error).message) }
            follows = true
          }
        }
        if (!follows) continue
      }
      ok.add(id)
    }
    return ok
  }

  // ---- watchtime tick: every minute while live ----
  let ticking = false
  setInterval(async () => {
    if (ticking) return
    ticking = true
    try {
      const stream = await api.streams.getStreamByUserName(CHANNEL)
      if (!stream) return
      const chatters = (await api.asUser(botId, (c) => c.chat.getChattersPaginated(broadcaster.id).getAll())).filter((c) => c.userId !== botId)
      const eligible = await isEligible(chatters.map((c) => c.userId))
      const rows = chatters.map((c) => ({ username: c.userName, twitch_id: c.userId, sub_tier: subTier.get(c.userId) ?? 0, eligible: eligible.has(c.userId) }))
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await sb.rpc('watch_tick', { p_rows: rows.slice(i, i + 500) })
        if (error) console.error('watch_tick failed', error.message)
      }
      console.log(`tick: ${rows.length} viewers, ${eligible.size} eligible, ${rows.filter((r) => r.sub_tier > 0).length} subs`)
    } catch (e) {
      console.error('tick error', e)
    } finally {
      ticking = false
    }
  }, 60_000)

  chat.onConnect(() => console.log(`connected to #${CHANNEL}`))
  chat.connect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
