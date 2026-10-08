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
    } else if (cmd === 'top') {
      const { data } = await sb.from('point_balances').select('username,balance').order('balance', { ascending: false }).limit(5)
      const line = (data ?? []).map((r, i) => `${i + 1}. ${r.username} (${fmt(Number(r.balance))})`).join(' | ')
      await chat.say(channel, `Top pontos: ${line}`)
    }
  })

  // ---- watchtime tick: every minute while live ----
  let ticking = false
  setInterval(async () => {
    if (ticking) return
    ticking = true
    try {
      const stream = await api.streams.getStreamByUserName(CHANNEL)
      if (!stream) return
      const perMin = Number(await cfg('watch_points_per_hour', 6000)) / 60
      const chatters = await api.chat.getChattersPaginated(broadcaster.id).getAll()
      const rows = chatters
        .filter((c) => c.userId !== botId)
        .map((c) => ({ username: c.userName, twitch_id: c.userId, points: Math.round(perMin), minutes: 1 }))
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await sb.rpc('watch_tick', { p_rows: rows.slice(i, i + 500) })
        if (error) console.error('watch_tick failed', error.message)
      }
      console.log(`tick: ${rows.length} viewers`)
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
