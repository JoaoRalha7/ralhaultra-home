/**
 * ralha-points — Cloudflare Worker
 */

const ALLOWED_ORIGINS = [
  'https://jralha.com',
  'https://ralha-react-ultra-bwxl.vercel.app',
  'https://ralhaultra-home.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
]

const STREAK_POINTS = [50, 75, 100, 150, 200, 300, 500]

// Server-side price list for mini-games (the browser never sends an amount).
const GAME_COSTS = { pick: 100, gtb: 100, avg: 100 }

const ADMIN_IDS = ['13878854-d588-4c49-ad36-1428920902bd']

// Validates the Supabase session token and resolves the Twitch username.
async function getUser(request, env, sbHeaders) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${token}` },
  })
  if (!r.ok) return null
  const u = await r.json()
  if (!u?.id) return null
  const p = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${u.id}&select=twitch_username`, { headers: sbHeaders })
  const prof = (await p.json())?.[0]
  const username = (prof?.twitch_username || u.user_metadata?.name || '').toLowerCase()
  return username ? { id: u.id, username } : null
}

export default {
  async fetch(request, env) {
    const origin    = request.headers.get('Origin') || ''
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app')

    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowed ? origin : 'https://jralha.com',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

    const url = new URL(request.url)
    const { searchParams, pathname } = url

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    const sbHeaders = {
      'Content-Type':  'application/json',
      'apikey':        env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    }

    try {

      // ── DEBUG ─────────────────────────────────────────────────────────────────
      if (pathname === '/debug' && request.method === 'GET') {
        const testRes = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/jralha_/-1`,
          { method: 'PUT', headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } }
        )
        return json({
          secrets: {
            SE_JWT_existe:       !!env.SE_JWT,
            SE_JWT_inicio:       env.SE_JWT?.substring(0, 20) ?? 'VAZIO',
            SE_CHANNEL_ID:       env.SE_CHANNEL_ID ?? 'VAZIO',
            SUPABASE_URL_existe: !!env.SUPABASE_URL,
            SUPABASE_KEY_existe: !!env.SUPABASE_SERVICE_KEY,
          },
          se_test: { status: testRes.status, ok: testRes.ok, body: await testRes.text() },
        })
      }

      // ── PUT /points/update ────────────────────────────────────────────────────
      if (pathname === '/points/update' && request.method === 'PUT') {
        const auth = request.headers.get('Authorization')
        if (!auth || auth !== `Bearer ${env.INTERNAL_SECRET}`)
          return json({ error: 'Não autorizado' }, 401)

        const { username, amount } = await request.json()
        if (!username || !amount)
          return json({ error: 'username e amount são obrigatórios' }, 400)

        const res = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${username.toLowerCase()}/${amount}`,
          { method: 'PUT', headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } }
        )
        if (!res.ok) return json({ error: `SE API erro ${res.status}`, detail: await res.text() }, res.status)

        const data = await res.json()
        return json({ ok: true, newPoints: data.newAmount ?? data.points ?? null })
      }

      // ── POST /giveaway/enter ──────────────────────────────────────────────────
      // Everything is decided here: price, limits, deadline, payment and the entry row.
      if (pathname === '/giveaway/enter' && request.method === 'POST') {
        const who = await getUser(request, env, sbHeaders)
        if (!who) return json({ error: 'unauthorized' }, 401)

        const body = await request.json()
        const q = parseInt(body.tickets, 10)
        if (!body.giveaway_id || !Number.isInteger(q) || q < 1 || q > 1000)
          return json({ error: 'invalid request' }, 400)

        const gRes = await fetch(`${env.SUPABASE_URL}/rest/v1/giveaways?id=eq.${encodeURIComponent(body.giveaway_id)}&select=id,status,ends_at,ticket_cost,max_tickets`, { headers: sbHeaders })
        const g = (await gRes.json())?.[0]
        if (!g) return json({ error: 'not found' }, 404)
        if (g.status !== 'active' || new Date(g.ends_at) <= new Date()) return json({ error: 'ended' }, 400)

        const unit = g.ticket_cost || 0
        const cap = unit > 0 ? (g.max_tickets || null) : 1
        if (cap == null && q > 100) return json({ error: 'invalid request' }, 400)

        const eRes = await fetch(`${env.SUPABASE_URL}/rest/v1/giveaway_entries?giveaway_id=eq.${g.id}&user_id=eq.${who.id}&select=tickets`, { headers: sbHeaders })
        const have = ((await eRes.json()) || []).reduce((n, r) => n + (r.tickets || 1), 0)
        if (cap != null && have + q > cap) return json({ error: 'limit' }, 400)

        const cost = q * unit
        const seUrl = `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${who.username}`
        const seHeaders = { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' }
        let newPoints = null

        if (cost > 0) {
          const balRes = await fetch(seUrl, { headers: seHeaders })
          if (!balRes.ok) return json({ error: 'balance check failed' }, 502)
          const { points: current = 0 } = await balRes.json()
          if (current < cost) return json({ error: 'insufficient', currentPoints: current }, 400)
          const d = await fetch(`${seUrl}/${-cost}`, { method: 'PUT', headers: seHeaders })
          if (!d.ok) return json({ error: `SE API erro ${d.status}` }, 502)
          const dd = await d.json()
          newPoints = dd.newAmount ?? dd.points ?? null
        }

        const ins = await fetch(`${env.SUPABASE_URL}/rest/v1/giveaway_entries`, {
          method: 'POST',
          headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ giveaway_id: g.id, user_id: who.id, twitch_username: who.username, tickets: q, cost_paid: cost }),
        })
        if (!ins.ok) {
          if (cost > 0) {
            const r = await fetch(`${seUrl}/${cost}`, { method: 'PUT', headers: seHeaders })
            if (r.ok) { const rd = await r.json(); newPoints = rd.newAmount ?? rd.points ?? newPoints }
          }
          return json({ error: 'entry failed', refunded: cost > 0, newPoints }, 500)
        }
        return json({ ok: true, newPoints })
      }

      // ── POST /admin/points ────────────────────────────────────────────────────
      // Streamer only: award or refund points to a viewer (hunts, mini-game prizes, shop refunds).
      if (pathname === '/admin/points' && request.method === 'POST') {
        const who = await getUser(request, env, sbHeaders)
        if (!who || !ADMIN_IDS.includes(who.id)) return json({ error: 'unauthorized' }, 401)

        const { username, amount } = await request.json()
        const n = parseInt(amount, 10)
        if (!username || !Number.isInteger(n) || n === 0 || Math.abs(n) > 1000000)
          return json({ error: 'username e amount são obrigatórios' }, 400)

        const res = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${String(username).toLowerCase()}/${n}`,
          { method: 'PUT', headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } }
        )
        if (!res.ok) return json({ error: `SE API erro ${res.status}`, detail: await res.text() }, res.status)
        const data = await res.json()
        return json({ ok: true, newPoints: data.newAmount ?? data.points ?? null })
      }

      // ── POST /game/spend ──────────────────────────────────────────────────────
      // Mini-game entry. The browser sends only its Supabase session token and the
      // game key; user, username and price are decided here. No shared secret.
      if (pathname === '/game/spend' && request.method === 'POST') {
        const who = await getUser(request, env, sbHeaders)
        if (!who) return json({ error: 'unauthorized' }, 401)

        const { game } = await request.json()
        const cost = GAME_COSTS[game]
        if (!cost) return json({ error: 'unknown game' }, 400)

        const seUrl = `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${who.username}`
        const seHeaders = { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' }

        const balRes = await fetch(seUrl, { headers: seHeaders })
        if (!balRes.ok) return json({ error: 'balance check failed' }, 502)
        const { points: current = 0 } = await balRes.json()
        if (current < cost) return json({ error: 'insufficient', currentPoints: current }, 400)

        const res = await fetch(`${seUrl}/${-cost}`, { method: 'PUT', headers: seHeaders })
        if (!res.ok) return json({ error: `SE API erro ${res.status}` }, 502)
        const data = await res.json()

        await fetch(`${env.SUPABASE_URL}/rest/v1/points_ledger`, {
          method: 'POST',
          headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ user_id: who.id, username: who.username, game, amount: cost }),
        })
        return json({ ok: true, newPoints: data.newAmount ?? data.points ?? null })
      }

      // ── POST /game/refund ─────────────────────────────────────────────────────
      // Only refunds a spend this same user made in the last 10 minutes, once.
      if (pathname === '/game/refund' && request.method === 'POST') {
        const who = await getUser(request, env, sbHeaders)
        if (!who) return json({ error: 'unauthorized' }, 401)

        const { game } = await request.json()
        if (!GAME_COSTS[game]) return json({ error: 'unknown game' }, 400)

        const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
        const found = await fetch(
          `${env.SUPABASE_URL}/rest/v1/points_ledger?user_id=eq.${who.id}&game=eq.${game}&refunded=eq.false&created_at=gte.${since}&order=created_at.desc&limit=1&select=id,amount`,
          { headers: sbHeaders }
        )
        const row = (await found.json())?.[0]
        if (!row) return json({ error: 'nothing to refund' }, 404)

        // claim the row first so a double call cannot refund twice
        const claim = await fetch(
          `${env.SUPABASE_URL}/rest/v1/points_ledger?id=eq.${row.id}&refunded=eq.false`,
          { method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=representation' }, body: JSON.stringify({ refunded: true }) }
        )
        if (!(await claim.json())?.length) return json({ error: 'already refunded' }, 409)

        const res = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${who.username}/${row.amount}`,
          { method: 'PUT', headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } }
        )
        if (!res.ok) return json({ error: `SE API erro ${res.status}` }, 502)
        const data = await res.json()
        return json({ ok: true, newPoints: data.newAmount ?? data.points ?? null })
      }

      // ── POST /daily/claim ─────────────────────────────────────────────────────
      if (pathname === '/daily/claim' && request.method === 'POST') {
        const who = await getUser(request, env, sbHeaders)
        if (!who) return json({ error: 'unauthorized' }, 401)
        const username = who.username
        const userId   = who.id

        // 1. Garantir que o perfil existe
        await fetch(`${env.SUPABASE_URL}/rest/v1/profiles`, {
          method: 'POST',
          headers: { ...sbHeaders, 'Prefer': 'resolution=ignore-duplicates' },
          body: JSON.stringify({ id: userId }),
        })

        // 2. Buscar perfil completo
        const profileRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=last_daily_claim,streak_count,streak_last_day`,
          { headers: sbHeaders }
        )
        const profiles = await profileRes.json()
        const profile  = profiles?.[0] || {}

        // 3. Verificar cooldown 24h
        if (profile.last_daily_claim) {
          const diff = Date.now() - new Date(profile.last_daily_claim).getTime()
          if (diff < 86400000)
            return json({ error: 'already_claimed', nextClaimMs: Math.ceil(86400000 - diff) }, 400)
        }

        // 4. Calcular streak
        const today        = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
        const lastDay      = profile.streak_last_day || null
        const currentStreak = profile.streak_count || 0

        // Verificar se o último claim foi ontem (streak contínuo)
        let newStreak = 1
        if (lastDay) {
          const last     = new Date(lastDay)
          const now      = new Date()
          last.setHours(0,0,0,0); now.setHours(0,0,0,0)
          const diffDays = Math.round((now - last) / 86400000)
          if (diffDays === 1) {
            // Ontem — streak continua
            newStreak = Math.min(currentStreak + 1, 7)
          } else {
            // Mais de 1 dia — reset
            newStreak = 1
          }
        }

        // 5. Pontos baseados no streak (índice 0-6)
        const streakIndex  = newStreak - 1
        const DAILY_POINTS = STREAK_POINTS[streakIndex] ?? 50

        // 6. Adicionar pontos no StreamElements
        const seRes = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${username.toLowerCase()}/${DAILY_POINTS}`,
          { method: 'PUT', headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } }
        )
        if (!seRes.ok)
          return json({ error: `SE API erro ${seRes.status}` }, 502)

        const seData    = await seRes.json()
        const newPoints = seData.newAmount ?? seData.points ?? null

        // 7. Atualizar perfil — last_daily_claim, streak_count, streak_last_day
        await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: 'PATCH',
          headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            last_daily_claim: new Date().toISOString(),
            streak_count:     newStreak,
            streak_last_day:  today,
          }),
        })

        // 8. Registar em daily_redeems
        await fetch(`${env.SUPABASE_URL}/rest/v1/daily_redeems`, {
          method: 'POST',
          headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            user_id:         userId,
            twitch_username: username.toLowerCase(),
            type:            'claim',
            reward:          `${DAILY_POINTS} pts`,
            points:          DAILY_POINTS,
          }),
        })

        return json({ ok: true, points: DAILY_POINTS, newPoints, streak: newStreak })
      }

      // ── POST /daily/wheel ─────────────────────────────────────────────────────
      if (pathname === '/daily/wheel' && request.method === 'POST') {
        const who = await getUser(request, env, sbHeaders)
        if (!who) return json({ error: 'unauthorized' }, 401)
        const username = who.username
        const userId   = who.id

        // 1. Garantir que o perfil existe
        await fetch(`${env.SUPABASE_URL}/rest/v1/profiles`, {
          method: 'POST',
          headers: { ...sbHeaders, 'Prefer': 'resolution=ignore-duplicates' },
          body: JSON.stringify({ id: userId }),
        })

        // 2. Verificar last_wheel_spin
        const profileRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=last_wheel_spin`,
          { headers: sbHeaders }
        )
        const profiles = await profileRes.json()
        const profile  = profiles?.[0]

        if (profile?.last_wheel_spin) {
          const diff = Date.now() - new Date(profile.last_wheel_spin).getTime()
          if (diff < 86400000)
            return json({ error: 'already_spun', nextSpinMs: Math.ceil(86400000 - diff) }, 400)
        }

        // 3. Sortear prémio server-side
        const PRIZES = [
          { label: '10 pts',     points: 10,   weight: 35 },
          { label: '25 pts',     points: 25,   weight: 25 },
          { label: '50 pts',     points: 50,   weight: 20 },
          { label: '100 pts',    points: 100,  weight: 10 },
          { label: '250 pts',    points: 250,  weight: 7  },
          { label: '500 pts',    points: 500,  weight: 2  },
          { label: 'JACKPOT 1K', points: 1000, weight: 1  },
        ]
        const totalWeight = PRIZES.reduce((s, p) => s + p.weight, 0)
        let rand = Math.random() * totalWeight
        let prize = PRIZES[0]
        for (const p of PRIZES) { rand -= p.weight; if (rand <= 0) { prize = p; break } }

        // 4. Adicionar pontos no StreamElements
        const seRes = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${username.toLowerCase()}/${prize.points}`,
          { method: 'PUT', headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } }
        )
        if (!seRes.ok)
          return json({ error: `SE API erro ${seRes.status}` }, 502)

        const seData    = await seRes.json()
        const newPoints = seData.newAmount ?? seData.points ?? null

        // 5. Atualizar last_wheel_spin
        await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: 'PATCH',
          headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ last_wheel_spin: new Date().toISOString() }),
        })

        // 6. Registar em daily_redeems
        await fetch(`${env.SUPABASE_URL}/rest/v1/daily_redeems`, {
          method: 'POST',
          headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            user_id:         userId,
            twitch_username: username.toLowerCase(),
            type:            'wheel',
            reward:          prize.label,
            points:          prize.points,
          }),
        })

        return json({ ok: true, prize: prize.label, points: prize.points, newPoints, prizeIndex: PRIZES.indexOf(prize) })
      }

      // ── POST /redeem ──────────────────────────────────────────────────────────
      if (pathname === '/redeem' && request.method === 'POST') {
        const who = await getUser(request, env, sbHeaders)
        if (!who) return json({ error: 'unauthorized' }, 401)
        const username = who.username
        const userId   = who.id
        const { productId } = await request.json()
        if (!productId) return json({ error: 'productId é obrigatório' }, 400)

        const prodRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/shop_products?id=eq.${encodeURIComponent(productId)}&select=id,stock,active,cost`,
          { headers: sbHeaders }
        )
        if (!prodRes.ok)
          return json({ error: 'Não foi possível verificar o produto.' }, 502)

        const products = await prodRes.json()
        const product  = products?.[0]

        if (!product)        return json({ error: 'Produto não encontrado.' }, 404)
        if (!product.active) return json({ error: 'Produto não está disponível.' }, 400)
        if (product.stock <= 0) return json({ error: 'Produto sem stock.' }, 400)
        const cost = product.cost
        if (!Number.isInteger(cost) || cost <= 0) return json({ error: 'Produto sem preço válido.' }, 400)

        const checkRes = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${username.toLowerCase()}`,
          { headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } }
        )
        if (!checkRes.ok)
          return json({ error: 'Não foi possível verificar os pontos.' }, 502)

        const { points: currentPoints = 0 } = await checkRes.json()
        if (currentPoints < cost)
          return json({ error: 'Pontos insuficientes.', currentPoints }, 400)

        const deductRes = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${username.toLowerCase()}/${-cost}`,
          { method: 'PUT', headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } }
        )
        if (!deductRes.ok)
          return json({ error: `Erro ao descontar pontos: ${deductRes.status}`, detail: await deductRes.text() }, 502)

        const deductData = await deductRes.json()
        const newPoints  = deductData.newAmount ?? deductData.points ?? null

        const stockRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/rpc/decrement_stock`,
          { method: 'POST', headers: sbHeaders, body: JSON.stringify({ product_id: productId }) }
        )
        if (!stockRes.ok) console.error('Stock decrement falhou:', await stockRes.text())

        const sbRes = await fetch(`${env.SUPABASE_URL}/rest/v1/shop_redeems`, {
          method: 'POST',
          headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            user_id:         userId,
            twitch_username: username.toLowerCase(),
            product_id:      productId,
            cost_at_redeem:  cost,
            status:          'pending',
          }),
        })
        if (!sbRes.ok) console.error('Supabase insert falhou:', await sbRes.text())

        return json({ ok: true, newPoints })
      }

      // ── POST /refund ──────────────────────────────────────────────────────────
      if (pathname === '/refund' && request.method === 'POST') {
        const who = await getUser(request, env, sbHeaders)
        if (!who || !ADMIN_IDS.includes(who.id)) return json({ error: 'unauthorized' }, 401)

        const { username, amount } = await request.json()

        if (!username || !amount)
          return json({ error: 'username e amount são obrigatórios' }, 400)

        const res = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${username.toLowerCase()}/${amount}`,
          { method: 'PUT', headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } }
        )
        if (!res.ok)
          return json({ error: `SE API erro ${res.status}`, detail: await res.text() }, res.status)

        const data = await res.json()
        return json({ ok: true, newPoints: data.newAmount ?? data.points ?? null })
      }

      if (request.method !== 'GET')
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })

      // ── GET /redeems ──────────────────────────────────────────────────────────
      if (pathname === '/redeems') {
        const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)

        const sbRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/shop_redeems?select=twitch_username,cost_at_redeem,created_at,status,shop_products(name,emoji)&order=created_at.desc&limit=${limit}`,
          { headers: sbHeaders }
        )

        if (!sbRes.ok) return json({ redeems: [] })

        const data = await sbRes.json()
        const redeems = (data || []).map(r => ({
          action:     r.shop_products?.name || 'Shop Redeem',
          username:   r.twitch_username,
          points:     -r.cost_at_redeem,
          status:     r.status,
          created_at: r.created_at,
          emoji:      r.shop_products?.emoji || '🎁',
        }))

        return json({ redeems })
      }

      // ── GET /daily-redeems ────────────────────────────────────────────────────
      if (pathname === '/daily-redeems') {
        const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)

        const sbRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/daily_redeems?select=twitch_username,type,reward,points,created_at&order=created_at.desc&limit=${limit}`,
          { headers: sbHeaders }
        )

        if (!sbRes.ok) return json({ redeems: [] })

        const data = await sbRes.json()
        const redeems = (data || []).map(r => ({
          action:     r.type === 'wheel' ? `Wheel — ${r.reward}` : `Daily Claim — ${r.reward}`,
          username:   r.twitch_username,
          points:     r.points,
          status:     'AWARDED',
          created_at: r.created_at,
          emoji:      r.type === 'wheel' ? '🎰' : '⏰',
        }))

        return json({ redeems })
      }

      // ── GET /leaderboard ─────────────────────────────────────────────────────
      if (pathname === '/leaderboard') {
        const limit  = Math.min(parseInt(searchParams.get('limit')  || '100'), 100)
        const offset = Math.max(parseInt(searchParams.get('offset') || '0'),   0)

        const res = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/top?limit=${limit}&offset=${offset}`,
          { headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } }
        )
        if (!res.ok)
          return json({ error: `SE API erro ${res.status}`, detail: await res.text() }, res.status)

        const data  = await res.json()
        const users = data.users ?? []
        return json({ users, hasMore: users.length === limit })
      }

      // ── GET / — pontos de um utilizador ──────────────────────────────────────
      const username = searchParams.get('username')?.toLowerCase()
      if (!username)
        return json({ error: 'username é obrigatório' }, 400)

      const res = await fetch(
        `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${username}`,
        { headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } }
      )
      if (!res.ok)
        return json({ error: `SE API erro ${res.status}`, detail: await res.text() }, res.status)

      const data = await res.json()
      return json({ points: data.points ?? 0, username: data.username })

    } catch (err) {
      return json({ error: err.message }, 500)
    }
  },
}