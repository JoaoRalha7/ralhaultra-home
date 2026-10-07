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


// ── Casino games (Mines, Blackjack, Crash, Keno) ───────────────────────────────────
// All game state and randomness live here. The browser only sends intents
// (start / reveal / hit / cashout) and receives the public part of the state.
const CASINO = { minBet: 10, maxBet: 10000, maxPayout: 250000, edge: 0.97, grid: 25, crashRate: 0.00008, crashCap: 1000 }
const CASINO_GAMES = ['mines', 'blackjack', 'crash', 'keno', 'plinko', 'roulette']
const INSTANT_GAMES = ['keno', 'plinko', 'roulette'] // settled in a single request

// Keno: pick 1-10 of 40, the house draws 10. Paytable is derived from the exact odds (~99% RTP, 1000x cap).
const KENO = { size: 40, draw: 10, max: 10, edge: 0.99, cap: 1000 }
const KENO_RISK = { classic: 1, low: 1, medium: 1, high: 1 } // risk levels, in display order
// Paytables per picks (1-10) and risk, indexed by hits (0..picks). Multipliers include the stake. RTP 98.7% to 99.1%.
const KENO_TABLES = {
  1: { classic: [0.0, 3.96], low: [0.7, 1.85], medium: [0.4, 2.75], high: [0.0, 3.96] },
  2: { classic: [0.0, 1.9, 4.5], low: [0.0, 2.0, 3.8], medium: [0.0, 1.8, 5.1], high: [0.0, 0.0, 17.1] },
  3: { classic: [0.0, 1.0, 3.1, 10.4], low: [0.0, 1.1, 1.38, 26.0], medium: [0.0, 0.0, 2.8, 50.0], high: [0.0, 0.0, 0.0, 81.5] },
  4: { classic: [0.0, 0.8, 1.8, 5.0, 22.5], low: [0.0, 0.0, 2.2, 7.9, 90.0], medium: [0.0, 0.0, 1.7, 10.0, 100.0], high: [0.0, 0.0, 0.0, 10.0, 259.0] },
  5: { classic: [0.0, 0.25, 1.4, 4.1, 16.5, 36.0], low: [0.0, 0.0, 1.5, 4.2, 13.0, 300.0], medium: [0.0, 0.0, 1.4, 4.0, 14.0, 390.0], high: [0.0, 0.0, 0.0, 4.5, 48.0, 450.0] },
  6: { classic: [0.0, 0.0, 1.0, 3.68, 7.0, 16.5, 40.0], low: [0.0, 0.0, 1.1, 2.0, 6.2, 100.0, 700.0], medium: [0.0, 0.0, 0.0, 3.0, 9.0, 180.0, 710.0], high: [0.0, 0.0, 0.0, 0.0, 11.0, 350.0, 710.0] },
  7: { classic: [0.0, 0.0, 0.47, 3.0, 4.5, 14.0, 31.0, 60.0], low: [0.0, 0.0, 1.1, 1.6, 3.5, 15.0, 225.0, 700.0], medium: [0.0, 0.0, 0.0, 2.0, 7.0, 30.0, 400.0, 800.0], high: [0.0, 0.0, 0.0, 0.0, 7.0, 90.0, 400.0, 800.0] },
  8: { classic: [0.0, 0.0, 0.0, 2.2, 4.0, 13.0, 22.0, 55.0, 70.0], low: [0.0, 0.0, 1.1, 1.5, 2.0, 5.5, 39.0, 100.0, 800.0], medium: [0.0, 0.0, 0.0, 2.0, 4.0, 11.0, 67.0, 400.0, 900.0], high: [0.0, 0.0, 0.0, 0.0, 5.0, 20.0, 270.0, 600.0, 900.0] },
  9: { classic: [0.0, 0.0, 0.0, 1.55, 3.0, 8.0, 15.0, 44.0, 60.0, 85.0], low: [0.0, 0.0, 1.1, 1.3, 1.7, 2.5, 7.5, 50.0, 250.0, 1000.0], medium: [0.0, 0.0, 0.0, 2.0, 2.5, 5.0, 15.0, 100.0, 500.0, 1000.0], high: [0.0, 0.0, 0.0, 0.0, 4.0, 11.0, 56.0, 500.0, 800.0, 1000.0] },
  10: { classic: [0.0, 0.0, 0.0, 1.4, 2.25, 4.5, 8.0, 17.0, 50.0, 80.0, 100.0], low: [0.0, 0.0, 1.1, 1.2, 1.3, 1.8, 3.5, 13.0, 50.0, 250.0, 1000.0], medium: [0.0, 0.0, 0.0, 1.6, 2.0, 4.0, 7.0, 26.0, 100.0, 500.0, 1000.0], high: [0.0, 0.0, 0.0, 0.0, 3.5, 8.0, 13.0, 63.0, 500.0, 800.0, 1000.0] },
}
function kenoTable(n, risk = 'classic') {
  const t = KENO_TABLES[n]
  return [...(t?.[risk] || t?.classic || [])]
}

// Plinko
// Plinko: n rows of pegs, the ball ends in slot 0..n (binomial). Multipliers are symmetric, highest at the edges.
const PLINKO = { minRows: 8, maxRows: 16, maxBalls: 25, edge: 0.99, risks: ['low', 'medium', 'high'] }
const PL_HI = { low: [5.6, 16], medium: [13, 110], high: [29, 1000] }
const PL_FLOOR = { low: 0.5, medium: 0.3, high: 0.2 }
const plC = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r }
function plinkoProbs(rows) { return Array.from({ length: rows + 1 }, (_, k) => plC(rows, k) / 2 ** rows) }
function plinkoTable(rows, risk = 'medium') {
  const n = Math.max(PLINKO.minRows, Math.min(PLINKO.maxRows, Math.floor(rows) || 8))
  const [a, b] = PL_HI[risk] || PL_HI.medium, lo = PL_FLOOR[risk] ?? PL_FLOOR.medium
  const hi = a * Math.pow(b / a, (n - PLINKO.minRows) / (PLINKO.maxRows - PLINKO.minRows))
  const P = plinkoProbs(n), half = n / 2
  const at = (p) => P.map((_, k) => lo + (hi - lo) * Math.pow(Math.abs(k - half) / half, p))
  const rtp = (p) => at(p).reduce((s, m, k) => s + m * P[k], 0)
  let l = 0.2, h = 30 // rtp falls as p grows: bisect to the target return
  for (let i = 0; i < 60; i++) { const m = (l + h) / 2; if (rtp(m) > PLINKO.edge) l = m; else h = m }
  return at((l + h) / 2).map((m) => Math.floor(m * 100) / 100)
}

// Roulette
// European roulette (single zero). Payouts are total multiples of the stake (stake included).
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
const ROULETTE = { maxBets: 24, payouts: { straight: 36, red: 2, black: 2, odd: 2, even: 2, low: 2, high: 2, dozen: 3, column: 3 } }
const rColor = (n) => (n === 0 ? 'green' : REDS.includes(n) ? 'red' : 'black')
function rouletteMult(bet, n) {
  const { type, value } = bet
  let win = false
  if (type === 'straight') win = n === value
  else if (n === 0) win = false
  else if (type === 'red') win = rColor(n) === 'red'
  else if (type === 'black') win = rColor(n) === 'black'
  else if (type === 'odd') win = n % 2 === 1
  else if (type === 'even') win = n % 2 === 0
  else if (type === 'low') win = n <= 18
  else if (type === 'high') win = n >= 19
  else if (type === 'dozen') win = Math.ceil(n / 12) === value
  else if (type === 'column') win = (n % 3 === 0 ? 3 : n % 3) === value
  return win ? ROULETTE.payouts[type] : 0
}
function validBet(b) {
  if (!b || !(b.type in ROULETTE.payouts)) return false
  if (!Number.isInteger(b.amount) || b.amount <= 0) return false
  if (b.type === 'straight') return Number.isInteger(b.value) && b.value >= 0 && b.value <= 36
  if (b.type === 'dozen' || b.type === 'column') return Number.isInteger(b.value) && b.value >= 1 && b.value <= 3
  return true
}

const _u32 = new Uint32Array(1)
function rndInt(n) { // unbiased integer in [0, n)
  const lim = Math.floor(0x100000000 / n) * n
  let x
  do { crypto.getRandomValues(_u32); x = _u32[0] } while (x >= lim)
  return x % n
}
function rndFloat() { crypto.getRandomValues(_u32); return _u32[0] / 0x100000000 }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rndInt(i + 1); [a[i], a[j]] = [a[j], a[i]] } return a }

// Mines multiplier after k safe reveals with m mines on a 25-tile grid (3% edge)
function minesMult(k, m) {
  let x = CASINO.edge
  for (let i = 0; i < k; i++) x *= (CASINO.grid - i) / (CASINO.grid - m - i)
  return Math.floor(x * 100) / 100
}

// Blackjack helpers: card = 0..51, rank = card % 13 (0=A, 9..12 = 10 value)
const bjVal = (c) => { const r = c % 13; return r === 0 ? 11 : Math.min(r + 1, 10) }
function bjTotal(cards) {
  let t = 0, aces = 0
  for (const c of cards) { t += bjVal(c); if (c % 13 === 0) aces++ }
  while (t > 21 && aces > 0) { t -= 10; aces-- }
  return t
}
const isBJ = (cards) => cards.length === 2 && bjTotal(cards) === 21

// Blackjack runs on a 6-deck shoe (card = 0..51 repeated). suit = floor((c % 52) / 13): 0 spade, 1 heart, 2 diamond, 3 club.
const BJ_DECKS = 6
const bjSuit = (c) => Math.floor((c % 52) / 13)
const bjRed = (c) => { const x = bjSuit(c); return x === 1 || x === 2 }
// Side bets pay "total multiples" of the stake (stake included). Odds checked on a 6-deck shoe: Perfect Pairs ~94.5%, 21+3 ~95.4%.
const SIDE_PP = { perfect: 30, colored: 12, mixed: 6 }
const SIDE_T3 = { suitedTrips: 101, straightFlush: 41, trips: 31, straight: 11, flush: 6 }
function sidePP(a, b) {
  if (a % 13 !== b % 13) return { kind: 'none', mult: 0 }
  const kind = bjSuit(a) === bjSuit(b) ? 'perfect' : bjRed(a) === bjRed(b) ? 'colored' : 'mixed'
  return { kind, mult: SIDE_PP[kind] }
}
function sideT3(a, b, c) {
  const r = [a % 13, b % 13, c % 13].sort((x, y) => x - y), s = [bjSuit(a), bjSuit(b), bjSuit(c)]
  const flush = s[0] === s[1] && s[1] === s[2], trips = r[0] === r[1] && r[1] === r[2]
  const straight = (r[1] === r[0] + 1 && r[2] === r[1] + 1) || (r[0] === 0 && r[1] === 11 && r[2] === 12)
  const kind = trips && flush ? 'suitedTrips' : straight && flush ? 'straightFlush' : trips ? 'trips' : straight ? 'straight' : flush ? 'flush' : 'none'
  return { kind, mult: SIDE_T3[kind] || 0 }
}
const bjStake = (s) => s.hands.reduce((a, h) => a + h.bet, 0) + (s.sideStake || 0)
const bjCanSplit = (s) => {
  const h = s.hands[s.active]
  return !!h && !h.done && h.cards.length === 2 && s.hands.length < 4 && !h.noResplit && bjVal(h.cards[0]) === bjVal(h.cards[1])
}
const bjCanDouble = (s) => { const h = s.hands[s.active]; return !!h && !h.done && h.cards.length === 2 && !h.noDouble }

// Crash multiplier helpers
const crashAtMs = (m) => Math.log(m) / CASINO.crashRate
const crashMultAt = (ms) => Math.floor(Math.exp(CASINO.crashRate * Math.max(0, ms)) * 100) / 100
function newCrashPoint() {
  const u = rndFloat()
  return Math.min(CASINO.crashCap, Math.max(1, Math.floor((CASINO.edge / (1 - u)) * 100) / 100))
}

// Resolve a crash round against the clock. Returns { status, mult?, payoutMult? }.
function crashResolve(st, now) {
  const elapsed = now - st.startedAt
  const tCrash = crashAtMs(st.crashAt)
  const tAuto = st.auto ? crashAtMs(st.auto) : Infinity
  if (st.auto && st.auto <= st.crashAt && elapsed >= tAuto) return { status: 'cashed', payoutMult: st.auto }
  if (elapsed >= tCrash) return { status: 'crashed' }
  return { status: 'active', mult: crashMultAt(elapsed) }
}

function publicGame(game, row, now) {
  let st = row.state
  if (game === 'blackjack' && !st.hands) st = { ...st, hands: [{ cards: st.player || [], bet: row.bet }], active: 0 } // round started before splits existed
  const done = row.status === 'done'
  const base = { game, id: row.id, bet: row.bet, status: row.status, payout: row.payout || 0, serverNow: now }
  if (game === 'mines') {
    const k = st.revealed.length
    return { ...base, mines: st.m, revealed: st.revealed, mult: k ? minesMult(k, st.m) : 1,
      nextMult: minesMult(k + 1, st.m), minePositions: done ? st.mines : null, hit: st.hit ?? null }
  }
  if (game === 'blackjack') {
    return { ...base, hands: st.hands.map((h) => ({ cards: h.cards, bet: h.bet, total: bjTotal(h.cards), doubled: !!h.doubled, done: !!h.done, result: h.result || null, payout: h.payout || 0 })),
      active: st.active, dealer: done ? st.dealer : [st.dealer[0]], dealerTotal: done ? bjTotal(st.dealer) : bjVal(st.dealer[0]),
      canDouble: !done && bjCanDouble(st), canSplit: !done && bjCanSplit(st), outcome: st.outcome || null,
      side: st.sideRes || null, sidePayout: st.sidePayout || 0 }
  }
  if (game === 'plinko') {
    return { ...base, rows: st.rows, risk: st.risk, path: st.path, slot: st.slot, mult: st.mult }
  }
  if (game === 'roulette') {
    return { ...base, bets: st.bets, number: st.number, color: rColor(st.number) }
  }
  if (game === 'keno') {
    return { ...base, picks: st.picks, risk: st.risk || 'classic', draw: st.draw, hits: st.hits, mult: st.mult }
  }
  // crash
  const r = done ? null : crashResolve(st, now)
  return { ...base, startedAt: st.startedAt, rate: CASINO.crashRate, auto: st.auto || null,
    crashAt: done ? st.crashAt : null, cashedAt: st.cashedAt || null, mult: r?.mult ?? st.cashedAt ?? null }
}

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

      // ── POST /casino/start | /casino/action | /casino/state ───────────────────
      if (pathname.startsWith('/casino/') && request.method === 'POST') {
        const who = await getUser(request, env, sbHeaders)
        if (!who) return json({ error: 'unauthorized' }, 401)
        const body = await request.json()
        const game = body.game
        if (!CASINO_GAMES.includes(game)) return json({ error: 'unknown game' }, 400)

        const seUrl = `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${who.username}`
        const seH = { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' }
        const seAdd = async (amount) => {
          const r = await fetch(`${seUrl}/${amount}`, { method: 'PUT', headers: seH })
          if (!r.ok) return { ok: false }
          const d = await r.json()
          return { ok: true, points: d.newAmount ?? d.points ?? null }
        }
        const rest = `${env.SUPABASE_URL}/rest/v1/casino_games`
        const loadActive = async () => {
          const r = await fetch(`${rest}?user_id=eq.${who.id}&game=eq.${game}&status=eq.active&order=created_at.desc&limit=1`, { headers: sbHeaders })
          return (await r.json())?.[0] || null
        }
        // compare-and-swap update: only one concurrent request can move a row forward
        const save = async (row, patch) => {
          const r = await fetch(`${rest}?id=eq.${row.id}&version=eq.${row.version}`, {
            method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=representation' },
            body: JSON.stringify({ ...patch, version: row.version + 1, updated_at: new Date().toISOString() }),
          })
          const out = await r.json()
          return Array.isArray(out) && out[0] ? out[0] : null
        }
        // finish a round: store result, then pay out
        const finish = async (row, state, payout) => {
          payout = Math.max(0, Math.min(Math.floor(payout), CASINO.maxPayout))
          const saved = await save(row, { state, status: 'done', payout })
          if (!saved) return { conflict: true }
          let newPoints = null
          if (payout > 0) { const p = await seAdd(payout); if (!p.ok) { const p2 = await seAdd(payout); newPoints = p2.points } else newPoints = p.points }
          return { row: saved, newPoints }
        }
        const out = (row, extra = {}) => json({ ok: true, active: row.status === 'active', state: publicGame(game, row, Date.now()), ...extra })

        // lazily settle a crash round (crashed or auto cash-out) before anything else
        const settleCrash = async (row) => {
          if (game !== 'crash' || row.status !== 'active') return { row }
          const r = crashResolve(row.state, Date.now())
          if (r.status === 'active') return { row }
          if (r.status === 'crashed') {
            const f = await finish(row, row.state, 0)
            return f.conflict ? { row: (await loadActive()) || row } : { row: f.row }
          }
          const st = { ...row.state, cashedAt: r.payoutMult }
          const f = await finish(row, st, row.bet * r.payoutMult)
          return f.conflict ? { row: (await loadActive()) || row } : { row: f.row, newPoints: f.newPoints }
        }

        // ---- state (resume / poll) ----
        if (pathname === '/casino/state') {
          let row = await loadActive()
          if (!row) return json({ ok: true, active: false })
          const s = await settleCrash(row)
          return out(s.row, { newPoints: s.newPoints ?? null })
        }

        // ---- start ----
        if (pathname === '/casino/start') {
          let rBets = null
          if (game === 'roulette') {
            rBets = Array.isArray(body.bets) ? body.bets.map((b) => ({ type: b?.type, value: b?.value == null ? null : Number(b.value), amount: Number(b?.amount) })) : []
            if (!rBets.length || rBets.length > ROULETTE.maxBets || !rBets.every((b) => validBet(b) && b.amount >= CASINO.minBet && b.amount <= CASINO.maxBet)) return json({ error: 'invalid bets' }, 400)
            body.bet = rBets.reduce((a, b) => a + b.amount, 0)
          }
          const bet = parseInt(body.bet, 10)
          if (!Number.isInteger(bet) || bet < CASINO.minBet || bet > (game === 'roulette' ? CASINO.maxBet * 5 : CASINO.maxBet)) return json({ error: 'invalid bet', min: CASINO.minBet, max: CASINO.maxBet }, 400)

          let existing = await loadActive()
          if (existing) {
            const s = await settleCrash(existing)
            if (s.row.status === 'active') return json({ ok: true, active: true, resumed: true, state: publicGame(game, s.row, Date.now()) })
          }

          let params = {}
          if (game === 'mines') {
            const m = parseInt(body.mines, 10)
            if (!Number.isInteger(m) || m < 1 || m > 24) return json({ error: 'invalid mines' }, 400)
            params = { m }
          }
          let stake = bet
          let sides = { pp: 0, t3: 0 }
          if (game === 'blackjack') {
            const pp = body.pp == null || body.pp === '' ? 0 : parseInt(body.pp, 10)
            const t3 = body.t3 == null || body.t3 === '' ? 0 : parseInt(body.t3, 10)
            const okSide = (v) => Number.isInteger(v) && v >= 0 && v <= CASINO.maxBet && (v === 0 || v >= CASINO.minBet)
            if (!okSide(pp) || !okSide(t3)) return json({ error: 'invalid side bet' }, 400)
            sides = { pp, t3 }; stake = bet + pp + t3
          }
          if (game === 'plinko') {
            const rows = parseInt(body.rows, 10)
            if (!Number.isInteger(rows) || rows < PLINKO.minRows || rows > PLINKO.maxRows || !PLINKO.risks.includes(body.risk)) return json({ error: 'invalid plinko' }, 400)
            params = { rows, risk: body.risk }
          }
          if (game === 'keno') {
            const picks = Array.isArray(body.picks) ? body.picks.map(Number) : []
            const ok = picks.length >= 1 && picks.length <= KENO.max && new Set(picks).size === picks.length && picks.every((x) => Number.isInteger(x) && x >= 1 && x <= KENO.size)
            if (!ok) return json({ error: 'invalid picks' }, 400)
            const risk = KENO_RISK[body.risk] ? body.risk : 'classic'
            params = { picks: [...picks].sort((a, b) => a - b), risk }
          }
          if (game === 'crash' && body.auto != null && body.auto !== '') {
            const a = Math.round(Number(body.auto) * 100) / 100
            if (!(a >= 1.01 && a <= CASINO.crashCap)) return json({ error: 'invalid auto' }, 400)
            params = { auto: a }
          }

          // plinko: several balls in one request = one balance check, one charge, one payout
          if (game === 'plinko' && body.count != null && body.count !== '' && parseInt(body.count, 10) !== 1) {
            const count = parseInt(body.count, 10)
            if (!Number.isInteger(count) || count < 1 || count > PLINKO.maxBalls) return json({ error: 'invalid plinko' }, 400)
            const total = bet * count
            const bRes = await fetch(seUrl, { headers: seH })
            if (!bRes.ok) return json({ error: 'balance check failed' }, 502)
            const { points: have = 0 } = await bRes.json()
            if (have < total) return json({ error: 'insufficient', currentPoints: have }, 400)
            const chg = await seAdd(-total)
            if (!chg.ok) return json({ error: 'charge failed' }, 502)
            const tab = plinkoTable(params.rows, params.risk)
            const rowsOut = Array.from({ length: count }, () => {
              const path = Array.from({ length: params.rows }, () => rndInt(2))
              const slot = path.reduce((a, b) => a + b, 0)
              const mult = tab[slot]
              return { user_id: who.id, username: who.username, game, bet, state: { rows: params.rows, risk: params.risk, path, slot, mult }, status: 'done', payout: Math.min(Math.floor(bet * mult), CASINO.maxPayout) }
            })
            const insB = await fetch(rest, { method: 'POST', headers: { ...sbHeaders, 'Prefer': 'return=representation' }, body: JSON.stringify(rowsOut) })
            const made = insB.ok ? await insB.json() : null
            if (!Array.isArray(made) || made.length !== count) { const rf = await seAdd(total); return json({ error: 'could not start', refunded: true, newPoints: rf.points ?? null }, 409) }
            const totalPay = made.reduce((a, r) => a + (r.payout || 0), 0)
            let newPts = chg.points
            if (totalPay > 0) { let pp = await seAdd(totalPay); if (!pp.ok) pp = await seAdd(totalPay); if (pp.points != null) newPts = pp.points }
            return json({ ok: true, active: false, balls: made.map((r) => publicGame(game, r, Date.now())), newPoints: newPts })
          }

          const balRes = await fetch(seUrl, { headers: seH })
          if (!balRes.ok) return json({ error: 'balance check failed' }, 502)
          const { points: current = 0 } = await balRes.json()
          if (current < stake) return json({ error: 'insufficient', currentPoints: current }, 400)
          const charge = await seAdd(-stake)
          if (!charge.ok) return json({ error: 'charge failed' }, 502)

          let state, kenoPayout = 0 // kenoPayout holds the instant payout for keno / plinko / roulette
          if (game === 'mines') {
            const tiles = shuffle(Array.from({ length: CASINO.grid }, (_, i) => i))
            state = { m: params.m, mines: tiles.slice(0, params.m).sort((a, b) => a - b), revealed: [] }
          } else if (game === 'keno') {
            const draw = shuffle(Array.from({ length: KENO.size }, (_, i) => i + 1)).slice(0, KENO.draw)
            const hits = params.picks.filter((p) => draw.includes(p)).length
            const mult = kenoTable(params.picks.length, params.risk)[hits]
            state = { picks: params.picks, risk: params.risk, draw, hits, mult }
            kenoPayout = Math.min(Math.floor(bet * mult), CASINO.maxPayout)
          } else if (game === 'plinko') {
            const path = Array.from({ length: params.rows }, () => rndInt(2))
            const slot = path.reduce((a, b) => a + b, 0)
            const mult = plinkoTable(params.rows, params.risk)[slot]
            state = { rows: params.rows, risk: params.risk, path, slot, mult }
            kenoPayout = Math.min(Math.floor(bet * mult), CASINO.maxPayout)
          } else if (game === 'roulette') {
            const number = rndInt(37)
            state = { bets: rBets, number }
            kenoPayout = Math.min(Math.floor(rBets.reduce((a, b) => a + b.amount * rouletteMult(b, number), 0)), CASINO.maxPayout)
          } else if (game === 'blackjack') {
            const deck = shuffle(Array.from({ length: 52 * BJ_DECKS }, (_, i) => i % 52))
            const pc = [deck[0], deck[2]], dc = [deck[1], deck[3]]
            const sideRes = {}
            let sidePayout = 0
            if (sides.pp) { const r = sidePP(pc[0], pc[1]); sideRes.pp = { stake: sides.pp, ...r }; sidePayout += sides.pp * r.mult }
            if (sides.t3) { const r = sideT3(pc[0], pc[1], dc[0]); sideRes.t3 = { stake: sides.t3, ...r }; sidePayout += sides.t3 * r.mult }
            state = { deck: deck.slice(4), dealer: dc, hands: [{ cards: pc, bet }], active: 0, sideStake: sides.pp + sides.t3, sideRes: sides.pp || sides.t3 ? sideRes : null, sidePayout }
          } else {
            state = { crashAt: newCrashPoint(), startedAt: Date.now() + 600, auto: params.auto || null }
          }

          const ins = await fetch(rest, {
            method: 'POST', headers: { ...sbHeaders, 'Prefer': 'return=representation' },
            body: JSON.stringify({ user_id: who.id, username: who.username, game, bet: stake, state, status: INSTANT_GAMES.includes(game) ? 'done' : 'active', payout: kenoPayout }),
          })
          const created = ins.ok ? (await ins.json())?.[0] : null
          if (!created) { const rf = await seAdd(stake); return json({ error: 'could not start', refunded: true, newPoints: rf.points ?? null }, 409) }

          let row = created, newPoints = charge.points
          if (INSTANT_GAMES.includes(game) && kenoPayout > 0) {
            let p = await seAdd(kenoPayout); if (!p.ok) p = await seAdd(kenoPayout)
            if (p.points != null) newPoints = p.points
          }
          if (game === 'blackjack') {
            const pBJ = isBJ(state.hands[0].cards), dBJ = isBJ(state.dealer)
            if (pBJ || dBJ) {
              const main = pBJ && dBJ ? bet : pBJ ? bet * 2.5 : 0
              const result = pBJ && dBJ ? 'push' : pBJ ? 'blackjack' : 'lose'
              const hands = [{ ...state.hands[0], done: true, result, payout: main }]
              const f = await finish(created, { ...state, hands, outcome: pBJ && dBJ ? 'push' : pBJ ? 'blackjack' : 'dealer_blackjack' }, main + state.sidePayout)
              if (f.row) { row = f.row; newPoints = f.newPoints ?? newPoints }
            }
          }
          return out(row, { newPoints })
        }

        // ---- action ----
        if (pathname === '/casino/action') {
          let row = await loadActive()
          if (!row) return json({ error: 'no active round' }, 404)
          const bet = row.bet
          const st = row.state
          const action = body.action

          if (game === 'mines') {
            if (action === 'reveal') {
              const i = parseInt(body.index, 10)
              if (!Number.isInteger(i) || i < 0 || i >= CASINO.grid || st.revealed.includes(i)) return json({ error: 'invalid tile' }, 400)
              if (st.mines.includes(i)) {
                const f = await finish(row, { ...st, hit: i }, 0)
                if (f.conflict) return json({ error: 'conflict' }, 409)
                return out(f.row)
              }
              const ns = { ...st, revealed: [...st.revealed, i] }
              if (ns.revealed.length === CASINO.grid - st.m) { // cleared the board: auto cash-out
                const f = await finish(row, ns, bet * minesMult(ns.revealed.length, st.m))
                if (f.conflict) return json({ error: 'conflict' }, 409)
                return out(f.row, { newPoints: f.newPoints })
              }
              const saved = await save(row, { state: ns })
              if (!saved) return json({ error: 'conflict' }, 409)
              return out(saved)
            }
            if (action === 'cashout') {
              if (!st.revealed.length) return json({ error: 'reveal a tile first' }, 400)
              const f = await finish(row, st, bet * minesMult(st.revealed.length, st.m))
              if (f.conflict) return json({ error: 'conflict' }, 409)
              return out(f.row, { newPoints: f.newPoints })
            }
            return json({ error: 'unknown action' }, 400)
          }

          if (game === 'blackjack') {
            const cur = row.state
            if (!cur.hands) return json({ error: 'round expired' }, 409)
            const clone = () => ({ ...cur, deck: [...cur.deck], hands: cur.hands.map((h) => ({ ...h, cards: [...h.cards] })) })
            const nextActive = (s) => { const i = s.hands.findIndex((h) => !h.done); if (i >= 0) s.active = i; return i < 0 }
            // all hands finished: dealer plays (unless everyone busted), then settle every hand
            const finishRound = async (s) => {
              const anyLive = s.hands.some((h) => bjTotal(h.cards) <= 21)
              if (anyLive) while (bjTotal(s.dealer) < 17) s.dealer = [...s.dealer, s.deck.shift()]
              const d = bjTotal(s.dealer)
              let total = 0
              s.hands = s.hands.map((h) => {
                const p = bjTotal(h.cards)
                let result, payout
                if (p > 21) { result = 'bust'; payout = 0 }
                else if (d > 21 || p > d) { result = 'win'; payout = h.bet * 2 }
                else if (p === d) { result = 'push'; payout = h.bet }
                else { result = 'lose'; payout = 0 }
                total += payout
                return { ...h, result, payout }
              })
              s.outcome = s.hands.length === 1 ? s.hands[0].result : 'multi'
              const f = await finish(row, s, total + (s.sidePayout || 0))
              if (f.conflict) return json({ error: 'conflict' }, 409)
              return out(f.row, { newPoints: f.newPoints })
            }
            const proceed = async (s) => {
              if (nextActive(s)) return finishRound(s)
              const saved = await save(row, { state: s, bet: bjStake(s) })
              if (!saved) return json({ error: 'conflict' }, 409)
              return out(saved)
            }
            // extra stake (double / split): claim the round first, then charge, undo if the charge fails
            const withStake = async (s, extra) => {
              const balRes = await fetch(seUrl, { headers: seH })
              const { points: current = 0 } = balRes.ok ? await balRes.json() : {}
              if (current < extra) return { err: json({ error: 'insufficient', currentPoints: current }, 400) }
              const marked = await save(row, { state: s, bet: bjStake(s) })
              if (!marked) return { err: json({ error: 'conflict' }, 409) }
              const ch = await seAdd(-extra)
              if (!ch.ok) { await save(marked, { state: cur, bet: bjStake(cur) }); return { err: json({ error: 'charge failed' }, 502) } }
              row = marked
              return { ok: true }
            }
            const settleHand = (h) => { if (bjTotal(h.cards) >= 21) h.done = true }

            if (action === 'hit') {
              const s = clone(), h = s.hands[s.active]
              if (h.done) return json({ error: 'hand finished' }, 400)
              h.cards.push(s.deck.shift()); settleHand(h)
              return proceed(s)
            }
            if (action === 'stand') {
              const s = clone(); s.hands[s.active].done = true
              return proceed(s)
            }
            if (action === 'double') {
              if (!bjCanDouble(cur)) return json({ error: 'cannot double' }, 400)
              const s = clone(), h = s.hands[s.active], extra = h.bet
              h.bet = extra * 2; h.doubled = true; h.cards.push(s.deck.shift()); h.done = true
              const w2 = await withStake(s, extra); if (w2.err) return w2.err
              return proceed(s)
            }
            if (action === 'split') {
              if (!bjCanSplit(cur)) return json({ error: 'cannot split' }, 400)
              const s = clone(), i = s.active, h = s.hands[i], aces = h.cards[0] % 13 === 0
              const h1 = { cards: [h.cards[0], s.deck.shift()], bet: h.bet }
              const h2 = { cards: [h.cards[1], s.deck.shift()], bet: h.bet }
              if (aces) for (const x of [h1, h2]) { x.done = true; x.noDouble = true; x.noResplit = true }
              else for (const x of [h1, h2]) settleHand(x)
              s.hands.splice(i, 1, h1, h2)
              const w2 = await withStake(s, h.bet); if (w2.err) return w2.err
              return proceed(s)
            }
            return json({ error: 'unknown action' }, 400)
          }

          // crash
          if (action === 'cashout') {
            if (Date.now() < st.startedAt) return json({ error: 'too early' }, 400)
            const r = crashResolve(st, Date.now())
            if (r.status === 'crashed') {
              const f = await finish(row, st, 0)
              return f.conflict ? json({ error: 'conflict' }, 409) : out(f.row)
            }
            const m = r.status === 'cashed' ? r.payoutMult : r.mult
            if (!(m >= 1)) return json({ error: 'too early' }, 400)
            const f = await finish(row, { ...st, cashedAt: m }, bet * m)
            if (f.conflict) return json({ error: 'conflict' }, 409)
            return out(f.row, { newPoints: f.newPoints })
          }
          return json({ error: 'unknown action' }, 400)
        }
        return json({ error: 'not found' }, 404)
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

      // ── GET /casino-feed (public: finished rounds only, no game state) ────────
      if (pathname === '/casino-feed') {
        const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
        const r = await fetch(
          `${env.SUPABASE_URL}/rest/v1/casino_games?status=eq.done&select=username,game,bet,payout,updated_at&order=updated_at.desc&limit=${limit}`,
          { headers: sbHeaders }
        )
        if (!r.ok) return json({ rounds: [] })
        return json({ rounds: await r.json() })
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