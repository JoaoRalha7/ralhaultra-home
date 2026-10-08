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

// ── Points backend switch ─────────────────────────────────────────────────────────
// Every points call in this file goes to StreamElements' URL. While ECONOMY_SOURCE is not
// 'supabase' nothing changes. When it is 'supabase', the shadowed fetch() below answers those
// same URLs from point_balances (same response shape), so the ~18 call sites stay untouched.
let ECON = null // env of the current invocation (set in fetch/scheduled)
const _fetch = globalThis.fetch.bind(globalThis)
const SE_POINTS_RE = /^https:\/\/api\.streamelements\.com\/kappa\/v2\/points\/[^/]+\/(.+)$/
const fetch = (url, init) => {
  if (ECON && ECON.ECONOMY_SOURCE === 'supabase' && typeof url === 'string') {
    const m = SE_POINTS_RE.exec(url)
    if (m) return econPoints(ECON, m[1], init || {})
  }
  return _fetch(url, init)
}
const econJson = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
async function econPoints(env, rest, init) {
  const sb = { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
  try {
    // GET /top?limit=&offset=
    if (rest.startsWith('top')) {
      const q = new URLSearchParams(rest.split('?')[1] || '')
      const limit = Math.min(parseInt(q.get('limit') || '100', 10), 1000)
      const offset = Math.max(parseInt(q.get('offset') || '0', 10), 0)
      const r = await _fetch(`${env.SUPABASE_URL}/rest/v1/point_balances?select=username,balance&order=balance.desc,username.asc&limit=${limit}&offset=${offset}`, { headers: sb })
      if (!r.ok) return econJson({ error: 'db error' }, 502)
      const rows = await r.json()
      return econJson({ users: rows.map((x) => ({ username: x.username, points: Number(x.balance) })) })
    }
    const [user, amountStr] = rest.split('/')
    const username = decodeURIComponent(user).toLowerCase()
    // PUT /{user}/{amount}: add (or subtract) points
    if ((init.method || 'GET').toUpperCase() === 'PUT' && amountStr !== undefined) {
      const delta = parseInt(amountStr, 10)
      if (!Number.isInteger(delta)) return econJson({ error: 'invalid amount' }, 400)
      const r = await _fetch(`${env.SUPABASE_URL}/rest/v1/rpc/add_points`, { method: 'POST', headers: sb, body: JSON.stringify({ p_username: username, p_delta: delta, p_reason: 'worker' }) })
      if (!r.ok) {
        const t = await r.text()
        return econJson({ error: t.includes('insufficient') ? 'insufficient points' : 'db error', detail: t }, t.includes('insufficient') ? 400 : 502)
      }
      const bal = Number(await r.json())
      return econJson({ username, points: bal, newAmount: bal })
    }
    // GET /{user}: balance
    const r = await _fetch(`${env.SUPABASE_URL}/rest/v1/point_balances?username=eq.${encodeURIComponent(username)}&select=balance`, { headers: sb })
    if (!r.ok) return econJson({ error: 'db error' }, 502)
    const row = (await r.json())?.[0]
    return econJson({ username, points: Number(row?.balance ?? 0) })
  } catch (e) {
    return econJson({ error: e.message }, 502)
  }
}


// ── Casino games (Mines, Blackjack, Crash, Keno) ───────────────────────────────────
// All game state and randomness live here. The browser only sends intents
// (start / reveal / hit / cashout) and receives the public part of the state.
const CASINO = { minBet: 10, maxBet: 10000, maxPayout: 250000, edge: 0.99, grid: 25, crashRate: 0.00008, crashCap: 1000 }
const CASINO_GAMES = ['mines', 'blackjack', 'crash', 'keno', 'plinko', 'roulette']
const INSTANT_GAMES = ['keno', 'plinko', 'roulette'] // settled in a single request
// The result is already known when an instant round is saved, but the player is still watching the animation.
// The feed only shows a round once that animation is over (updated_at is set in the future), so nothing is spoiled.
function feedDelay(game, rows, count) {
  if (game === 'plinko') return Math.max(95, 190 - rows * 6) * rows + (count > 1 ? (count - 1) * (count > 12 ? 70 : 115) : 0) + 700
  if (game === 'roulette') return 7200
  return 3600 // keno
}

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
const PL_HALF = { // the published Stake / Degen paytables (left half, centre included); every table returns about 99%
  low: { 8: [5.6, 2.1, 1.1, 1, 0.5], 9: [5.6, 2, 1.6, 1, 0.7], 10: [8.9, 3, 1.4, 1.1, 1, 0.5], 11: [8.4, 3, 1.9, 1.3, 1, 0.7], 12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5], 13: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7], 14: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5], 15: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7], 16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5] },
  medium: { 8: [13, 3, 1.3, 0.7, 0.4], 9: [18, 4, 1.7, 0.9, 0.5], 10: [22, 5, 2, 1.4, 0.6, 0.4], 11: [24, 6, 3, 1.8, 0.7, 0.5], 12: [33, 11, 4, 2, 1.1, 0.6, 0.3], 13: [43, 13, 6, 3, 1.3, 0.7, 0.4], 14: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2], 15: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3], 16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3] },
  high: { 8: [29, 4, 1.5, 0.3, 0.2], 9: [43, 7, 2, 0.6, 0.2], 10: [76, 10, 3, 0.9, 0.3, 0.2], 11: [120, 14, 5.2, 1.4, 0.4, 0.2], 12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2], 13: [260, 37, 11, 4, 1, 0.2, 0.2], 14: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2], 15: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2], 16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2] },
}
const plC = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r }
function plinkoProbs(rows) { return Array.from({ length: rows + 1 }, (_, k) => plC(rows, k) / 2 ** rows) }
function plinkoTable(rows, risk = 'medium') {
  const n = Math.max(PLINKO.minRows, Math.min(PLINKO.maxRows, Math.floor(rows) || 8))
  const h = (PL_HALF[risk] || PL_HALF.medium)[n]
  return n % 2 === 0 ? [...h, ...h.slice(0, -1).reverse()] : [...h, ...[...h].reverse()]
}

// Roulette
// European roulette (single zero). Payouts are total multiples of the stake (stake included).
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
const ROULETTE = { maxBets: 100, opposite: { red: 'black', black: 'red', odd: 'even', even: 'odd', low: 'high', high: 'low' }, payouts: { straight: 36, red: 2, black: 2, odd: 2, even: 2, low: 2, high: 2, dozen: 3, column: 3, multi: 0 } }
// legal grouped inside bets, keyed by their sorted numbers: splits, streets/trios, corners/first four, double streets
const MULTI = (() => {
  const S = new Set(), add = (a) => S.add(a.slice().sort((x, y) => x - y).join('-'))
  for (let n = 1; n <= 36; n++) { if (n % 3 !== 0) add([n, n + 1]); if (n <= 33) add([n, n + 3]) }
  for (const z of [1, 2, 3]) add([0, z])
  for (let k = 0; k < 12; k++) add([3 * k + 1, 3 * k + 2, 3 * k + 3])
  add([0, 1, 2]); add([0, 2, 3]); add([0, 1, 2, 3])
  for (let n = 1; n <= 32; n++) if (n % 3 !== 0) add([n, n + 1, n + 3, n + 4])
  for (let k = 0; k < 11; k++) add([3 * k + 1, 3 * k + 2, 3 * k + 3, 3 * k + 4, 3 * k + 5, 3 * k + 6])
  return S
})()
const rColor = (n) => (n === 0 ? 'green' : REDS.includes(n) ? 'red' : 'black')
function rouletteMult(bet, n) {
  const { type, value } = bet
  let win = false
  if (type === 'multi') { const nums = String(value).split('-').map(Number); return nums.includes(n) ? 36 / nums.length : 0 }
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
  if (b.type === 'multi') return typeof b.value === 'string' && MULTI.has(b.value)
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

// ── Provably fair ─────────────────────────────────────────────────────────────
// Every outcome comes from HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${block}`). The player sees
// sha256(serverSeed) before betting, picks the client seed, and the nonce rises with every bet.
// 128 blocks x 8 words = 1024 uint32 words per bet, consumed in order (unbiased rejection sampling).
// Keep the generator below identical to src/lib/fair.js (the Verify tab recomputes it in the browser).
const _enc = new TextEncoder()
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha256hex = async (str) => toHex(await crypto.subtle.digest('SHA-256', _enc.encode(str)))
const newSeedHex = () => { const a = new Uint8Array(32); crypto.getRandomValues(a); return toHex(a) }
async function fairRng(server, client, nonce, nb = 128) {
  const key = await crypto.subtle.importKey('raw', _enc.encode(server), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const blocks = await Promise.all(Array.from({ length: nb }, (_, i) => crypto.subtle.sign('HMAC', key, _enc.encode(`${client}:${nonce}:${i}`))))
  const w = new Uint32Array(nb * 8)
  blocks.forEach((b, i) => { const dv = new DataView(b); for (let j = 0; j < 8; j++) w[i * 8 + j] = dv.getUint32(j * 4) })
  let p = 0
  const next = () => { if (p >= w.length) throw new Error('fair stream exhausted'); return w[p++] }
  const int = (n) => { const lim = Math.floor(0x100000000 / n) * n; let x; do { x = next() } while (x >= lim); return x % n }
  return { float: () => next() / 0x100000000, int, shuffle: (a) => { for (let i = a.length - 1; i > 0; i--) { const j = int(i + 1); [a[i], a[j]] = [a[j], a[i]] } return a } }
}
const cleanClient = (v) => String(v ?? '').replace(/[^\w\-]/g, '').slice(0, 64)
// new active pair. The hash of the NEXT server seed is committed too, so a rotation can be checked later.
async function fairInsert(env, sbH, who, server, client, next = newSeedHex()) {
  const q = `${env.SUPABASE_URL}/rest/v1/casino_seeds`
  const row = { user_id: who.id, username: who.username, server_seed: server, server_hash: await sha256hex(server), client_seed: client }
  const hdr = { ...sbH, 'Prefer': 'return=minimal' }
  const r = await fetch(q, { method: 'POST', headers: hdr, body: JSON.stringify({ ...row, next_seed: next, next_hash: await sha256hex(next) }) })
  if (!r.ok) await fetch(q, { method: 'POST', headers: hdr, body: JSON.stringify(row) }) // next_seed columns not created yet
}
// active seed pair of a player (created on first use). Returns the row or null.
async function fairPair(env, sbH, who) {
  const q = `${env.SUPABASE_URL}/rest/v1/casino_seeds`
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${q}?user_id=eq.${who.id}&active=eq.true&limit=1`, { headers: sbH })
    const row = r.ok ? (await r.json())?.[0] : null
    if (row) return row
    await fairInsert(env, sbH, who, newSeedHex(), newSeedHex().slice(0, 24))
  }
  return null
}
// reserve the next nonce (compare-and-swap, so two bets never share one) and build the generator
async function fairNext(env, sbH, who) {
  const q = `${env.SUPABASE_URL}/rest/v1/casino_seeds`
  for (let i = 0; i < 5; i++) {
    const pair = await fairPair(env, sbH, who)
    if (!pair) return null
    const r = await fetch(`${q}?id=eq.${pair.id}&nonce=eq.${pair.nonce}&active=eq.true`, { method: 'PATCH', headers: { ...sbH, 'Prefer': 'return=representation' }, body: JSON.stringify({ nonce: pair.nonce + 1 }) })
    const ok = r.ok ? (await r.json())?.[0] : null
    if (ok) return { rg: await fairRng(pair.server_seed, pair.client_seed, pair.nonce), fair: { h: pair.server_hash, c: pair.client_seed, n: pair.nonce } }
  }
  return null
}

// Mines multiplier after k safe reveals with m mines on a 25-tile grid (1% edge)
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
// Side bets pay "total multiples" of the stake (stake included). Odds checked on a 6-deck shoe: Perfect Pairs ~94.3%, 21+3 ~95.5%.
const SIDE_PP = { perfect: 26, colored: 13, mixed: 7 } // 25:1, 12:1, 6:1
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
  return !!h && !h.done && h.cards.length === 2 && s.hands.length < 6 && !h.noResplit && bjVal(h.cards[0]) === bjVal(h.cards[1])
}
const bjCanDouble = (s) => { const h = s.hands[s.active]; return !!h && !h.done && h.cards.length === 2 && !h.noDouble }


// avatars: profiles.avatar_url by Twitch name, cached for a while (the games show them next to each player)
const AV_CACHE = new Map()
async function avatarsFor(env, sbH, names) {
  const want = [...new Set(names.map((n) => String(n || '').toLowerCase()).filter((n) => /^[a-z0-9_]{1,40}$/.test(n)))]
  const now = Date.now()
  const miss = want.filter((n) => { const c = AV_CACHE.get(n); return !c || now - c.at > 600000 })
  if (miss.length) {
    try {
      const r = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?twitch_username=in.(${miss.join(',')})&select=twitch_username,avatar_url`, { headers: sbH })
      const rows = r.ok ? await r.json() : []
      const got = new Map((Array.isArray(rows) ? rows : []).map((x) => [String(x.twitch_username).toLowerCase(), x.avatar_url || null]))
      for (const n of miss) AV_CACHE.set(n, { at: now, url: got.get(n) || null })
    } catch { /* avatars are optional */ }
  }
  const out = {}
  for (const n of want) { const u = AV_CACHE.get(n)?.url; if (u) out[n] = u }
  return out
}


// players whose profile has no picture yet: keep the one from their login so everybody sees it in the games
async function saveAvatar(env, sbH, who) {
  if (!who.avatar || who.savedAvatar) { if (who.avatar) AV_CACHE.set(who.username, { at: Date.now(), url: who.avatar }); return }
  AV_CACHE.set(who.username, { at: Date.now(), url: who.avatar })
  try { await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${who.id}&avatar_url=is.null`, { method: 'PATCH', headers: { ...sbH, 'Prefer': 'return=minimal' }, body: JSON.stringify({ avatar_url: who.avatar }) }) } catch { /* optional */ }
}

// Crash multiplier helpers
const crashAtMs = (m) => Math.log(m) / CASINO.crashRate
const crashMultAt = (ms) => Math.floor(Math.exp(CASINO.crashRate * Math.max(0, ms)) * 100) / 100
function newCrashPoint(u = rndFloat()) {
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

// ── Live crash: one shared round at a time, a new one every ~15s ─────────────────────
// Rounds live in crash_rounds (crash_at stays secret until the round is over), bets in crash_bets.
// Nothing runs on a timer: whoever calls the API after a round ended creates the next one, and
// auto cash-outs are settled lazily with a compare-and-swap, so a payout can only happen once.
const CL = { betMs: 10000, keep: 16, feed: 25, lockMs: 300, maxCatch: 1800000 }
const clEnd = (r) => Number(r.start_ms) + Math.ceil(crashAtMs(Number(r.crash_at)))
const clSb = (env, sbH, path, init = {}) => fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...sbH, ...(init.headers || {}) } })
async function clPay(env, username, amount) { // add points in StreamElements (one retry)
  for (let i = 0; i < 2; i++) {
    const r = await fetch(`https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${username}/${amount}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } })
    if (r.ok) { const d = await r.json(); return { ok: true, points: d.newAmount ?? d.points ?? null } }
  }
  return { ok: false }
}
async function clRounds(env, sbH) {
  const r = await clSb(env, sbH, `crash_rounds?select=*&order=seq.desc&limit=${CL.keep}`)
  const rows = r.ok ? await r.json() : []
  return Array.isArray(rows) ? rows : []
}
async function clBets(env, sbH, seq) {
  const r = await clSb(env, sbH, `crash_bets?seq=eq.${seq}&order=created_at.asc&limit=300`)
  const rows = r.ok ? await r.json() : []
  return Array.isArray(rows) ? rows : []
}
// pay every auto cash-out whose target the round has already passed (claimed once, by compare-and-swap)
async function clSettle(env, sbH, round, now, bets) {
  bets = bets || await clBets(env, sbH, round.seq)
  const crashAt = Number(round.crash_at), elapsed = now - Number(round.start_ms)
  await Promise.all(bets.map(async (b) => {
    if (b.cashed_at != null || b.auto == null) return
    const a = Number(b.auto)
    if (!(a <= crashAt && elapsed >= crashAtMs(a))) return
    const payout = Math.min(Math.floor(b.bet * a), payCap(b.bet))
    const c = await clSb(env, sbH, `crash_bets?id=eq.${b.id}&cashed_at=is.null`, { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify({ cashed_at: a, payout }) })
    const row = c.ok ? (await c.json())?.[0] : null
    if (!row) { const cur = (await (await clSb(env, sbH, `crash_bets?id=eq.${b.id}`)).json())?.[0]; if (cur) Object.assign(b, cur); return }
    Object.assign(b, row)
    const p = await clPay(env, b.username, payout)
    if (p.ok) { await clSb(env, sbH, `crash_bets?id=eq.${b.id}`, { method: 'PATCH', body: JSON.stringify({ paid: true }) }); b.paid = true }
  }))
  return bets
}
// Rounds run back to back on a fixed clock: the next one starts betMs after the previous crash, whether
// or not anyone was watching. Whoever calls first (or the cron trigger) writes every round that has
// passed since the last one, so the timeline never stops. Each round has a server seed: its hash is
// public from creation, the seed itself is revealed once the round is over.
const clMake = async (seq, startMs) => {
  const server = newSeedHex()
  const rg = await fairRng(server, `crash-${seq}`, 0, 1)
  return { seq, start_ms: startMs, crash_at: newCrashPoint(rg.float()), server_seed: server, server_hash: await sha256hex(server) }
}
async function clEnsure(env, sbH, now) {
  let rounds = await clRounds(env, sbH)
  const cur = rounds[0]
  if (cur && now < clEnd(cur)) return rounds
  if (cur) await clSettle(env, sbH, cur, now)
  let seq = cur ? Number(cur.seq) : 0
  let end = cur ? clEnd(cur) : now
  if (now - end > CL.maxCatch) end = now // idle for a long time: restart the clock instead of writing hundreds of rounds
  const made = []
  for (let i = 0; i < 200; i++) {
    const r = await clMake(++seq, end + CL.betMs)
    made.push(r); end = clEnd(r)
    if (end > now) break
  }
  let ins = await clSb(env, sbH, 'crash_rounds', { method: 'POST', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify(made) })
  if (!ins.ok) { // seed columns not created yet: keep the game running without them
    ins = await clSb(env, sbH, 'crash_rounds', { method: 'POST', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify(made.map(({ seq, start_ms, crash_at }) => ({ seq, start_ms, crash_at }))) })
  }
  rounds = ins.ok ? [...made.reverse(), ...rounds].slice(0, CL.keep) : await clRounds(env, sbH) // someone else created them first
  return rounds
}
let CL_CACHE = null // public state, reused for a moment so many viewers cost one set of queries
async function clState(env, sbH, now) {
  if (CL_CACHE && now - CL_CACHE.at < 600 && now < CL_CACHE.until) return CL_CACHE.data
  const rounds = await clEnsure(env, sbH, now)
  const cur = rounds[0]
  if (!cur) return { error: 'no round' }
  const bets = await clSettle(env, sbH, cur, now)
  const fr = await clSb(env, sbH, `crash_bets?seq=lt.${cur.seq}&order=created_at.desc&limit=${CL.feed}&select=username,bet,cashed_at,payout,created_at,seq`)
  const feed = fr.ok ? await fr.json() : []
  const status = now < Number(cur.start_ms) ? 'betting' : now < clEnd(cur) ? 'flying' : 'crashed'
  const last = rounds[1] || null
  const avatars = await avatarsFor(env, sbH, [...bets.map((b) => b.username), ...(Array.isArray(feed) ? feed : []).map((b) => b.username)])
  const data = {
    ok: true, serverNow: now, rate: CASINO.crashRate, betMs: CL.betMs, avatars,
    round: { seq: Number(cur.seq), startAt: Number(cur.start_ms), status, crashAt: status === 'crashed' ? Number(cur.crash_at) : null },
    last: last ? { seq: Number(last.seq), crashAt: Number(last.crash_at) } : null,
    history: rounds.slice(1).map((r) => Number(r.crash_at)),
    fair: rounds.slice(0, 12).map((r) => ({ seq: Number(r.seq), hash: r.server_hash || null, seed: now >= clEnd(r) ? r.server_seed || null : null, crashAt: now >= clEnd(r) ? Number(r.crash_at) : null })),
    bets: bets.map((b) => ({ u: b.username, bet: b.bet, cashedAt: b.cashed_at == null ? null : Number(b.cashed_at), payout: b.payout })),
    feed: (Array.isArray(feed) ? feed : []).map((b) => ({ u: b.username, bet: b.bet, cashedAt: b.cashed_at == null ? null : Number(b.cashed_at), payout: b.payout, at: b.created_at, seq: b.seq })),
  }
  CL_CACHE = { at: now, until: status === 'betting' ? Number(cur.start_ms) : status === 'flying' ? clEnd(cur) : now, data }
  return data
}

function publicGame(game, row, now) {
  let st = row.state
  if (game === 'blackjack' && !st.hands) st = { ...st, hands: [{ cards: st.player || [], bet: row.bet }], active: 0 } // round started before splits existed
  const done = row.status === 'done'
  const base = { game, id: row.id, bet: row.bet, status: row.status, payout: row.payout || 0, serverNow: now, fair: st.fair ? { hash: st.fair.h, client: st.fair.c, nonce: st.fair.n } : null }
  if (game === 'mines') {
    const k = st.revealed.length
    return { ...base, mines: st.m, revealed: st.revealed, mult: k ? minesMult(k, st.m) : 1,
      nextMult: minesMult(k + 1, st.m), minePositions: done ? st.mines : null, hit: st.hit ?? null }
  }
  if (game === 'blackjack') {
    return { ...base, hands: st.hands.map((h) => ({ cards: h.cards, bet: h.bet, side: h.side || null, total: bjTotal(h.cards), doubled: !!h.doubled, done: !!h.done, result: h.result || null, payout: h.payout || 0 })),
      active: st.active, dealer: done ? st.dealer : [st.dealer[0]], dealerTotal: done ? bjTotal(st.dealer) : bjVal(st.dealer[0]),
      canDouble: !done && bjCanDouble(st), canSplit: !done && bjCanSplit(st), outcome: st.outcome || null,
      side: st.sideRes || null, sidePayout: st.sidePayout || 0, ins: st.ins || null, insCost: st.ins === 'offer' ? Math.floor(st.hands.reduce((a, h) => a + h.bet, 0) / 2) : (st.insStake || 0), insPayout: st.insPayout || 0 }
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
  const p = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${u.id}&select=twitch_username,avatar_url`, { headers: sbHeaders })
  const prof = (await p.json())?.[0]
  // The name comes from the Twitch identity Supabase verified at login (identity_data), never from profiles.twitch_username
  // or user_metadata, because the user can edit both of those and would otherwise be able to act as someone else.
  const idt = ((u.identities || []).find((i) => /twitch/i.test(i.provider || '')) || (u.identities || [])[0])?.identity_data || {}
  const username = String(idt.name || idt.preferred_username || idt.user_name || idt.full_name || '').toLowerCase()
  const pic = idt.avatar_url || idt.picture || u.user_metadata?.avatar_url || u.user_metadata?.picture || null
  return username ? { id: u.id, username, avatar: prof?.avatar_url || pic, savedAvatar: !!prof?.avatar_url } : null
}


// ── Jackpot: everyone puts points in one pot, a wheel picks the winner by share ─────
// The timer (60s) starts when the 2nd player joins. When it ends the first request to arrive settles the round:
// the winner is drawn with a CSPRNG weighted by stake, claimed with a compare-and-swap, and paid once.
const JP = { roundMs: 60000, spinMs: 8000, resultMs: 6000, fee: 0.05, minBet: 10, maxDeposit: 10000, maxTotal: 50000, maxPlayers: 40, lockMs: 800, keep: 12 }
const jpSb = clSb
async function jpRounds(env, sbH) {
  const r = await jpSb(env, sbH, `jackpot_rounds?select=*&order=seq.desc&limit=${JP.keep}`)
  const rows = r.ok ? await r.json() : []
  return Array.isArray(rows) ? rows : []
}
async function jpPlayers(env, sbH, seq) { // entries summed per player, in order of first deposit
  const r = await jpSb(env, sbH, `jackpot_entries?seq=eq.${seq}&order=created_at.asc&limit=500&select=user_id,username,amount`)
  const rows = r.ok ? await r.json() : []
  const by = new Map()
  for (const e of (Array.isArray(rows) ? rows : [])) {
    const p = by.get(e.user_id)
    if (p) p.amount += e.amount; else by.set(e.user_id, { id: e.user_id, u: e.username, amount: e.amount })
  }
  return [...by.values()]
}
async function jpSettle(env, sbH, round) {
  const players = await jpPlayers(env, sbH, round.seq)
  const pot = players.reduce((a, p) => a + p.amount, 0)
  if (!players.length || !pot) return round
  const t = round.server_seed ? (await fairRng(round.server_seed, `jackpot-${round.seq}`, 0, 1)).float() : rndFloat()
  let acc = 0, win = players[players.length - 1]
  for (const p of players) { acc += p.amount; if (t * pot < acc) { win = p; break } }
  const fee = Math.floor(pot * JP.fee), payout = pot - fee
  const c = await jpSb(env, sbH, `jackpot_rounds?seq=eq.${round.seq}&status=eq.open`, { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify({ status: 'done', winner_id: win.id, winner_name: win.u, winner_amount: win.amount, pot, fee, payout, ticket: t }) })
  const row = c.ok ? (await c.json())?.[0] : null
  if (!row) return (await jpRounds(env, sbH)).find((r) => r.seq === round.seq) || round
  const p = await clPay(env, win.u, payout)
  if (p.ok) { await jpSb(env, sbH, `jackpot_rounds?seq=eq.${round.seq}`, { method: 'PATCH', body: JSON.stringify({ paid: true }) }); row.paid = true }
  return row
}
// newest rounds (index 0 is the live one): settles a finished timer and opens the next pot after the result was shown
async function jpEnsure(env, sbH, now) {
  let rounds = await jpRounds(env, sbH)
  let cur = rounds[0]
  const make = async (seq) => {
    const server = newSeedHex(), hash = await sha256hex(server)
    let ins = await jpSb(env, sbH, 'jackpot_rounds', { method: 'POST', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify({ seq, server_seed: server, server_hash: hash }) })
    if (!ins.ok) ins = await jpSb(env, sbH, 'jackpot_rounds', { method: 'POST', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify({ seq }) }) // seed columns not created yet
    return ins.ok ? [{ seq, status: 'open', end_ms: null, pot: 0, paid: false, server_seed: server, server_hash: hash }, ...rounds].slice(0, JP.keep) : await jpRounds(env, sbH)
  }
  if (!cur) return make(1)
  if (cur.status === 'open' && cur.end_ms != null && now >= Number(cur.end_ms)) { cur = await jpSettle(env, sbH, cur); rounds = [cur, ...rounds.slice(1)] }
  if (cur.status === 'done') {
    const end = Number(cur.end_ms)
    if (now >= end + JP.spinMs + JP.resultMs) return make(Number(cur.seq) + 1)
    if (!cur.paid && now > end + 20000) { // a payout that failed earlier: claim it once and retry
      const cl = await jpSb(env, sbH, `jackpot_rounds?seq=eq.${cur.seq}&paid=eq.false`, { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify({ paid: true }) })
      if (cl.ok && (await cl.json())?.[0]) { const p = await clPay(env, cur.winner_name, cur.payout); if (!p.ok) await jpSb(env, sbH, `jackpot_rounds?seq=eq.${cur.seq}`, { method: 'PATCH', body: JSON.stringify({ paid: false }) }) }
    }
  }
  return rounds
}
let JP_CACHE = null
async function jpState(env, sbH, now) {
  if (JP_CACHE && now - JP_CACHE.at < 700) return JP_CACHE.data
  const rounds = await jpEnsure(env, sbH, now)
  const cur = rounds[0]
  if (!cur) return { error: 'no round' }
  const players = await jpPlayers(env, sbH, cur.seq)
  const pot = players.reduce((a, p) => a + p.amount, 0)
  const done = cur.status === 'done'
  const hist = rounds.filter((r) => r.status === 'done' && r.seq !== cur.seq)
  const avatars = await avatarsFor(env, sbH, [...players.map((p) => p.u), ...hist.map((r) => r.winner_name), cur.winner_name])
  const data = {
    ok: true, serverNow: now, avatars, cfg: { roundMs: JP.roundMs, spinMs: JP.spinMs, resultMs: JP.resultMs, fee: JP.fee, min: JP.minBet, max: jpMax(), total: jpTotal() },
    round: {
      seq: Number(cur.seq), endAt: cur.end_ms == null ? null : Number(cur.end_ms), pot, done,
      players: players.map((p) => ({ u: p.u, amount: p.amount })),
      winner: done ? { u: cur.winner_name, amount: cur.winner_amount, payout: cur.payout, fee: cur.fee, ticket: Number(cur.ticket) } : null,
    },
    history: rounds.filter((r) => r.status === 'done' && r.seq !== cur.seq).map((r) => ({ seq: Number(r.seq), u: r.winner_name, pot: r.pot, payout: r.payout, amount: r.winner_amount })),
    fair: rounds.slice(0, 12).map((r) => ({ seq: Number(r.seq), hash: r.server_hash || null, seed: r.status === 'done' ? r.server_seed || null : null, ticket: r.status === 'done' && r.ticket != null ? Number(r.ticket) : null })),
  }
  JP_CACHE = { at: now, data }
  return data
}

// ── New economy casino rules (only when ECONOMY_SOURCE=supabase) ──────────────────
// No payout ceiling per round: every game is capped at 1000x the bet instead, and the max bet of each
// game is risk_cap / its top multiplier (now one fixed ECON_MAX_BET for all), so one round can never reach the cheapest shop prize.
const ECON_RISK_CAP = 100000
const ECON_MAX_MULT = 1000
const ECON_MAX_BET = 1000      // same max bet in every Original, whatever the mode or risk
const econOn = () => !!ECON && ECON.ECONOMY_SOURCE === 'supabase'
const jpMax = () => (econOn() ? 1000 : JP.maxDeposit)    // jackpot deposit limit (new economy: same as the other games)
const jpTotal = () => (econOn() ? 5000 : JP.maxTotal)
const payCap = (bet) => (econOn() ? Math.floor(bet * ECON_MAX_MULT) : CASINO.maxPayout)
function econMaxBet() {
  return ECON_MAX_BET   // one fixed max bet for every Original and every mode
}

// Hourly VIP refresh and Monday weekly cashback (only with the new economy). Both SQL functions are idempotent.
async function econCron(env, sb, d) {
  const rpc = (fn, body) => _fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: sb, body: JSON.stringify(body) })
  if (d.getUTCMinutes() === 10) await rpc('refresh_vip', {})
  if (d.getUTCDay() === 1 && d.getUTCHours() === 3 && d.getUTCMinutes() === 30) { // Monday 03:30 UTC, covers the previous 7 days
    const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    const from = new Date(to.getTime() - 7 * 86400000)
    await rpc('run_cashback', { p_key: 'week:' + to.toISOString().slice(0, 10), p_from: from.toISOString(), p_to: to.toISOString() })
  }
}

export default {
  // Cron Trigger (every minute): keeps Crash rounds running with nobody on the page, and settles jackpots
  async scheduled(event, env, ctx) {
    ECON = env
    const sbHeaders = { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
    ctx.waitUntil((async () => {
      try { const now = Date.now(); const rounds = await clEnsure(env, sbHeaders, now); if (rounds[0]) await clSettle(env, sbHeaders, rounds[0], now) } catch (e) { console.error('cron crash', e.message) }
      try { await jpEnsure(env, sbHeaders, Date.now()) } catch (e) { console.error('cron jackpot', e.message) }
      try { if (econOn()) await econCron(env, sbHeaders, new Date(event.scheduledTime)) } catch (e) { console.error('cron economy', e.message) }
    })())
  },
  async fetch(request, env) {
    const origin    = request.headers.get('Origin') || ''
    const isAllowed = ALLOWED_ORIGINS.includes(origin)

    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowed ? origin : 'https://jralha.com',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

    ECON = env
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

      // ── POST /admin/import-se ─────────────────────────────────────────────────
      // Streamer only. Copies StreamElements balances into point_balances, in slices (a Worker call is
      // limited to ~50 subrequests). Call it repeatedly with ?offset=<next> until "next" is null.
      // Idempotent: re-run it right before the cutover and only the difference is applied.
      // ?mult=N scales old -> new economy, ?dry=1 only counts and does not write.
      if (pathname === '/admin/import-se' && request.method === 'POST') {
        const who = await getUser(request, env, sbHeaders)
        if (!who || !ADMIN_IDS.includes(who.id)) return json({ error: 'unauthorized' }, 401)
        const mult = Number(searchParams.get('mult') || '1')
        const dry = searchParams.get('dry') === '1'
        let offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0)
        if (!(mult > 0)) return json({ error: 'invalid mult' }, 400)

        const rows = []
        let next = offset
        let done = false
        for (let i = 0; i < 20; i++) { // 20 SE pages per call
          const r = await _fetch(`https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/top?limit=1000&offset=${next}`, { headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } })
          if (!r.ok) return json({ error: `SE API erro ${r.status}`, detail: await r.text(), next }, 502)
          const users = (await r.json()).users ?? []
          if (!users.length) { done = true; break }
          for (const u of users) rows.push({ username: String(u.username).toLowerCase(), points: Number(u.points) || 0 })
          next += users.length
        }
        const total = rows.reduce((s, u) => s + u.points, 0)
        let written = 0
        if (!dry) {
          for (let i = 0; i < rows.length; i += 1000) { // <= 20 batches
            const r = await _fetch(`${env.SUPABASE_URL}/rest/v1/rpc/import_se_balances`, { method: 'POST', headers: sbHeaders, body: JSON.stringify({ p_rows: rows.slice(i, i + 1000), p_mult: mult }) })
            if (!r.ok) return json({ error: 'import failed', detail: await r.text(), written, next: offset }, 502)
            written += Number(await r.json())
          }
        }
        return json({ ok: true, dry, users: rows.length, written, totalPointsOld: total, mult, from: offset, next: done ? null : next, top5: offset === 0 ? rows.slice(0, 5) : undefined })
      }

      // ── POST /jackpot/state | /jackpot/deposit ────────────────────────────────────
      if (pathname.startsWith('/jackpot/') && request.method === 'POST') {
        const now = Date.now()
        if (pathname === '/jackpot/state') return json(await jpState(env, sbHeaders, now))
        if (pathname !== '/jackpot/deposit') return json({ error: 'not found' }, 404)
        const who = await getUser(request, env, sbHeaders)
        if (!who) return json({ error: 'unauthorized' }, 401)
        const body = await request.json().catch(() => ({}))
        const amount = parseInt(body.amount, 10)
        if (!Number.isInteger(amount) || amount < JP.minBet || amount > jpMax()) return json({ error: 'invalid bet', min: JP.minBet, max: jpMax() }, 400)

        const rounds = await jpEnsure(env, sbHeaders, now)
        const cur = rounds[0]
        if (!cur || cur.status !== 'open' || (cur.end_ms != null && now >= Number(cur.end_ms) - JP.lockMs)) return json({ error: 'round closed' }, 409)
        const players = await jpPlayers(env, sbHeaders, cur.seq)
        const mine = players.find((p) => p.id === who.id)
        if (!mine && players.length >= JP.maxPlayers) return json({ error: 'pot full' }, 409)
        if ((mine?.amount || 0) + amount > jpTotal()) return json({ error: 'stake limit' }, 400)

        const seUrl = `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${who.username}`
        const seH = { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' }
        const balRes = await fetch(seUrl, { headers: seH })
        if (!balRes.ok) return json({ error: 'balance check failed' }, 502)
        const { points: current = 0 } = await balRes.json()
        if (current < amount) return json({ error: 'insufficient', currentPoints: current }, 400)
        const charge = await fetch(`${seUrl}/${-amount}`, { method: 'PUT', headers: seH })
        if (!charge.ok) return json({ error: 'charge failed' }, 502)
        const cd = await charge.json()
        const ins = await jpSb(env, sbHeaders, 'jackpot_entries', { method: 'POST', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify({ seq: cur.seq, user_id: who.id, username: who.username, amount }) })
        if (!ins.ok) { const rf = await clPay(env, who.username, amount); return json({ error: 'could not join', refunded: true, newPoints: rf.points ?? null }, 409) }
        // the timer starts when a second player joins (compare-and-swap: only the first request sets it)
        if (cur.end_ms == null && (mine ? players.length : players.length + 1) >= 2) {
          await jpSb(env, sbHeaders, `jackpot_rounds?seq=eq.${cur.seq}&end_ms=is.null&status=eq.open`, { method: 'PATCH', body: JSON.stringify({ end_ms: now + JP.roundMs }) })
        }
        JP_CACHE = null
        await saveAvatar(env, sbHeaders, who)
        return json({ ok: true, seq: Number(cur.seq), amount, newPoints: cd.newAmount ?? cd.points ?? null })
      }

      // ── POST /crash/state | /crash/bet | /crash/cashout | /crash/mine (live shared rounds) ──
      if (pathname.startsWith('/crash/') && request.method === 'POST') {
        const now = Date.now()
        if (pathname === '/crash/state') return json(await clState(env, sbHeaders, now))

        const who = await getUser(request, env, sbHeaders)
        if (!who) return json({ error: 'unauthorized' }, 401)
        const body = await request.json().catch(() => ({}))
        const seUrl = `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${who.username}`
        const seH = { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' }

        if (pathname === '/crash/bet') {
          const bet = parseInt(body.bet, 10)
          if (!Number.isInteger(bet) || bet < CASINO.minBet || bet > econMaxBet('crash', body)) return json({ error: 'invalid bet', min: CASINO.minBet, max: econMaxBet('crash', body) }, 400)
          let auto = null
          if (body.auto != null && body.auto !== '') {
            auto = Math.round(Number(body.auto) * 100) / 100
            if (!(auto >= 1.01 && auto <= CASINO.crashCap)) return json({ error: 'invalid auto' }, 400)
          }
          const cur = (await clEnsure(env, sbHeaders, now))[0]
          if (!cur || now >= Number(cur.start_ms) - CL.lockMs) return json({ error: 'round closed' }, 409)
          const balRes = await fetch(seUrl, { headers: seH })
          if (!balRes.ok) return json({ error: 'balance check failed' }, 502)
          const { points: current = 0 } = await balRes.json()
          if (current < bet) return json({ error: 'insufficient', currentPoints: current }, 400)
          // claim the seat first (one bet per player and round), then charge
          const ins = await clSb(env, sbHeaders, 'crash_bets', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify({ seq: cur.seq, user_id: who.id, username: who.username, bet, auto }) })
          const row = ins.ok ? (await ins.json())?.[0] : null
          if (!row) return json({ error: 'already bet' }, 409)
          const charge = await fetch(`${seUrl}/${-bet}`, { method: 'PUT', headers: seH })
          if (!charge.ok) { await clSb(env, sbHeaders, `crash_bets?id=eq.${row.id}`, { method: 'DELETE' }); return json({ error: 'charge failed' }, 502) }
          const cd = await charge.json()
          CL_CACHE = null
          await saveAvatar(env, sbHeaders, who)
          return json({ ok: true, seq: Number(cur.seq), bet, auto, newPoints: cd.newAmount ?? cd.points ?? null })
        }

        if (pathname === '/crash/cashout') {
          const cur = (await clEnsure(env, sbHeaders, now))[0]
          if (!cur || Number(body.seq) !== Number(cur.seq) || now >= clEnd(cur)) return json({ error: 'round over' }, 409)
          if (now < Number(cur.start_ms)) return json({ error: 'too early' }, 400)
          const bets = await clSettle(env, sbHeaders, cur, now)
          const mine = bets.find((b) => b.user_id === who.id)
          if (!mine) return json({ error: 'no bet' }, 404)
          if (mine.cashed_at != null) return json({ ok: true, already: true, cashedAt: Number(mine.cashed_at), payout: mine.payout })
          const m = crashMultAt(now - Number(cur.start_ms))
          if (!(m >= 1)) return json({ error: 'too early' }, 400)
          const payout = Math.min(Math.floor(mine.bet * m), payCap(mine.bet))
          const c = await clSb(env, sbHeaders, `crash_bets?id=eq.${mine.id}&cashed_at=is.null`, { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify({ cashed_at: m, payout }) })
          const row = c.ok ? (await c.json())?.[0] : null
          if (!row) return json({ error: 'conflict' }, 409)
          CL_CACHE = null
          const p = await clPay(env, who.username, payout)
          if (p.ok) await clSb(env, sbHeaders, `crash_bets?id=eq.${mine.id}`, { method: 'PATCH', body: JSON.stringify({ paid: true }) })
          return json({ ok: true, cashedAt: m, payout, newPoints: p.points ?? null })
        }

        if (pathname === '/crash/mine') {
          // retry any win that was marked but never paid (e.g. StreamElements was down), then list my recent bets
          const old = new Date(now - 20000).toISOString()
          const un = await clSb(env, sbHeaders, `crash_bets?user_id=eq.${who.id}&cashed_at=not.is.null&paid=eq.false&created_at=lt.${old}&limit=5`)
          for (const b of (un.ok ? await un.json() : [])) {
            const cl = await clSb(env, sbHeaders, `crash_bets?id=eq.${b.id}&paid=eq.false`, { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify({ paid: true }) })
            if (!(cl.ok && (await cl.json())?.[0])) continue
            const p = await clPay(env, who.username, b.payout)
            if (!p.ok) await clSb(env, sbHeaders, `crash_bets?id=eq.${b.id}`, { method: 'PATCH', body: JSON.stringify({ paid: false }) })
          }
          const r = await clSb(env, sbHeaders, `crash_bets?user_id=eq.${who.id}&order=created_at.desc&limit=20&select=seq,bet,cashed_at,payout,created_at`)
          const rows = r.ok ? await r.json() : []
          return json({ ok: true, bets: (Array.isArray(rows) ? rows : []).map((b) => ({ seq: b.seq, bet: b.bet, cashedAt: b.cashed_at == null ? null : Number(b.cashed_at), payout: b.payout, at: b.created_at })) })
        }
        return json({ error: 'not found' }, 404)
      }

      // ── POST /casino/start | /casino/action | /casino/state ───────────────────
      // ── Provably fair: /fair/state | /fair/rotate | /fair/rounds (player) and /fair/log (admin) ──
      if (pathname.startsWith('/fair/') && request.method === 'POST') {
        const who = await getUser(request, env, sbHeaders)
        if (!who) return json({ error: 'unauthorized' }, 401)
        const body = await request.json().catch(() => ({}))
        const q = `${env.SUPABASE_URL}/rest/v1/casino_seeds`
        if (pathname === '/fair/state' || pathname === '/fair/rotate') {
          if (pathname === '/fair/rotate') {
            const cur = await fairPair(env, sbHeaders, who)
            if (!cur) return json({ error: 'fair seed unavailable' }, 502)
            const server = cur.next_seed || newSeedHex()
            const client = cleanClient(body.clientSeed) || newSeedHex().slice(0, 24)
            const done = await fetch(`${q}?id=eq.${cur.id}&active=eq.true`, { method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=representation' }, body: JSON.stringify({ active: false, revealed_at: new Date().toISOString() }) })
            if (done.ok && (await done.json())?.[0]) {
              await fairInsert(env, sbHeaders, who, server, client)
            }
          }
          const pair = await fairPair(env, sbHeaders, who)
          const pr = await fetch(`${q}?user_id=eq.${who.id}&active=eq.false&order=revealed_at.desc&limit=1`, { headers: sbHeaders })
          const prev = pr.ok ? (await pr.json())?.[0] : null
          return json({ ok: true, hash: pair?.server_hash, nextHash: pair?.next_hash || null, client: pair?.client_seed, nonce: pair?.nonce ?? 0,
            prev: prev ? { serverSeed: prev.server_seed, hash: prev.server_hash, client: prev.client_seed, nonces: prev.nonce } : null })
        }
        if (pathname === '/fair/rounds') {
          const r = await fetch(`${env.SUPABASE_URL}/rest/v1/casino_games?user_id=eq.${who.id}&status=eq.done&select=game,bet,payout,state,created_at&order=created_at.desc&limit=30`, { headers: sbHeaders })
          const rows = (r.ok ? await r.json() : []).filter((x) => x.state?.fair)
          const hs = [...new Set(rows.map((x) => x.state.fair.h))]
          const sr = hs.length ? await fetch(`${q}?user_id=eq.${who.id}&active=eq.false&server_hash=in.(${hs.join(',')})&select=server_hash,server_seed`, { headers: sbHeaders }) : null
          const rev = new Map((sr && sr.ok ? await sr.json() : []).map((x) => [x.server_hash, x.server_seed]))
          return json({ ok: true, rounds: rows.map((x) => ({ game: x.game, bet: x.bet, payout: x.payout, at: x.created_at, hash: x.state.fair.h, client: x.state.fair.c, nonce: x.state.fair.n, ball: x.state.fair.ball ?? null, serverSeed: rev.get(x.state.fair.h) || null })) })
        }
        if (pathname === '/fair/log') { // admin: every round of every player, with its fair data
          if (!ADMIN_IDS.includes(who.id)) return json({ error: 'unauthorized' }, 401)
          const lim = Math.min(Math.max(parseInt(body.limit, 10) || 100, 1), 500)
          const f = [`select=id,username,game,bet,payout,status,state,created_at`, `order=created_at.desc`, `limit=${lim}`]
          if (body.user) f.push(`username=eq.${encodeURIComponent(String(body.user).toLowerCase())}`)
          if (CASINO_GAMES.includes(body.game)) f.push(`game=eq.${body.game}`)
          const r = await fetch(`${env.SUPABASE_URL}/rest/v1/casino_games?${f.join('&')}`, { headers: sbHeaders })
          const rows = r.ok ? await r.json() : []
          const hs = [...new Set(rows.map((x) => x.state?.fair?.h).filter(Boolean))]
          const sr = hs.length ? await fetch(`${q}?active=eq.false&server_hash=in.(${hs.join(',')})&select=server_hash,server_seed`, { headers: sbHeaders }) : null
          const rev = new Map((sr && sr.ok ? await sr.json() : []).map((x) => [x.server_hash, x.server_seed]))
          return json({ ok: true, rounds: rows.map((x) => { const fr = x.state?.fair; return { id: x.id, user: x.username, game: x.game, bet: x.bet, payout: x.payout, status: x.status, at: x.created_at, hash: fr?.h || null, client: fr?.c || null, nonce: fr?.n ?? null, ball: fr?.ball ?? null, serverSeed: fr ? rev.get(fr.h) || null : null } }) })
        }
        return json({ error: 'not found' }, 404)
      }

      // ── POST /bets/mine (finished rounds of the logged-in player, all originals) ──
      if (pathname === '/bets/mine' && request.method === 'POST') {
        const who = await getUser(request, env, sbHeaders)
        if (!who) return json({ error: 'unauthorized' }, 401)
        const r = await fetch(
          `${env.SUPABASE_URL}/rest/v1/casino_games?user_id=eq.${who.id}&status=eq.done&select=username,game,bet,payout,updated_at&order=updated_at.desc&limit=300`,
          { headers: sbHeaders }
        )
        const grouped = new Map()
        for (const x of (r.ok ? await r.json() : [])) {
          const k = `${x.game}|${x.updated_at}`
          const g = grouped.get(k)
          if (g) { g.bet += x.bet || 0; g.payout += x.payout || 0 } else grouped.set(k, { ...x, bet: x.bet || 0, payout: x.payout || 0 })
        }
        let extra = []
        try {
          const cur = (await clRounds(env, sbHeaders))[0]
          if (cur) {
            const upto = Date.now() >= clEnd(cur) ? Number(cur.seq) + 1 : Number(cur.seq)
            const cb = await clSb(env, sbHeaders, `crash_bets?user_id=eq.${who.id}&seq=lt.${upto}&order=created_at.desc&limit=50&select=username,bet,cashed_at,payout,created_at`)
            extra = (cb.ok ? await cb.json() : []).map((b) => ({ username: b.username, game: 'crash', bet: b.bet, payout: b.cashed_at == null ? 0 : b.payout, updated_at: b.created_at }))
          }
        } catch { /* crash history is optional */ }
        const rounds = [...grouped.values(), ...extra].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 50)
        return json({ ok: true, rounds })
      }

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
          payout = Math.max(0, Math.min(Math.floor(payout), payCap(row.bet)))
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
            rBets = Array.isArray(body.bets) ? body.bets.map((b) => ({ type: b?.type, value: b?.value == null ? null : b?.type === 'multi' ? String(b.value) : Number(b.value), amount: Number(b?.amount) })) : []
            if (!rBets.length || rBets.length > ROULETTE.maxBets || !rBets.every((b) => validBet(b) && b.amount >= CASINO.minBet && b.amount <= econMaxBet('roulette', body))) return json({ error: 'invalid bets' }, 400)
            if (rBets.some((b) => ROULETTE.opposite[b.type] && rBets.some((o) => o.type === ROULETTE.opposite[b.type])) || new Set(rBets.map((b) => b.type + ':' + b.value)).size !== rBets.length) return json({ error: 'invalid bets' }, 400) // no red+black / odd+even / low+high, no duplicate spots
            body.bet = rBets.reduce((a, b) => a + b.amount, 0)
          }
          const bet = parseInt(body.bet, 10)
          if (!Number.isInteger(bet) || bet < CASINO.minBet || bet > (game === 'roulette' ? econMaxBet(game, body) * 5 : econMaxBet(game, body))) return json({ error: 'invalid bet', min: CASINO.minBet, max: econMaxBet(game, body) }, 400)

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
            const okSide = (v) => Number.isInteger(v) && v >= 0 && v <= (econOn() ? Math.floor(ECON_RISK_CAP / (100 * Math.max(1, parseInt(body.seats, 10) || 1))) : CASINO.maxBet) && (v === 0 || v >= CASINO.minBet)
            if (!okSide(pp) || !okSide(t3)) return json({ error: 'invalid side bet' }, 400)
            const seats = body.seats == null || body.seats === '' ? 1 : parseInt(body.seats, 10)
            if (!Number.isInteger(seats) || seats < 1 || seats > 3) return json({ error: 'invalid seats' }, 400)
            params = { seats }
            sides = { pp, t3 }; stake = seats * (bet + pp + t3) // every seat plays the same bet and side bets
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

          const fx = await fairNext(env, sbHeaders, who)
          if (!fx) return json({ error: 'fair seed unavailable' }, 502)
          const rg = fx.rg

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
            const feedAt = new Date(Date.now() + feedDelay('plinko', params.rows, count)).toISOString()
            const rowsOut = Array.from({ length: count }, (_, bi) => {
              const path = Array.from({ length: params.rows }, () => rg.int(2))
              const slot = path.reduce((a, b) => a + b, 0)
              const mult = tab[slot]
              return { user_id: who.id, username: who.username, game, bet, state: { rows: params.rows, risk: params.risk, path, slot, mult, fair: { ...fx.fair, ball: bi, balls: count } }, status: 'done', payout: Math.min(Math.floor(bet * mult), payCap(bet)), updated_at: feedAt }
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
            const tiles = rg.shuffle(Array.from({ length: CASINO.grid }, (_, i) => i))
            state = { m: params.m, mines: tiles.slice(0, params.m).sort((a, b) => a - b), revealed: [], fair: fx.fair }
          } else if (game === 'keno') {
            const draw = rg.shuffle(Array.from({ length: KENO.size }, (_, i) => i + 1)).slice(0, KENO.draw)
            const hits = params.picks.filter((p) => draw.includes(p)).length
            const mult = kenoTable(params.picks.length, params.risk)[hits]
            state = { picks: params.picks, risk: params.risk, draw, hits, mult, fair: fx.fair }
            kenoPayout = Math.min(Math.floor(bet * mult), payCap(bet))
          } else if (game === 'plinko') {
            const path = Array.from({ length: params.rows }, () => rg.int(2))
            const slot = path.reduce((a, b) => a + b, 0)
            const mult = plinkoTable(params.rows, params.risk)[slot]
            state = { rows: params.rows, risk: params.risk, path, slot, mult, fair: { ...fx.fair, ball: 0, balls: 1 } }
            kenoPayout = Math.min(Math.floor(bet * mult), payCap(bet))
          } else if (game === 'roulette') {
            const number = rg.int(37)
            state = { bets: rBets, number, fair: fx.fair }
            kenoPayout = Math.min(Math.floor(rBets.reduce((a, b) => a + b.amount * rouletteMult(b, number), 0)), payCap(bet))
          } else if (game === 'blackjack') {
            const deck = rg.shuffle(Array.from({ length: 52 * BJ_DECKS }, (_, i) => i % 52))
            // deal order: one card to each seat, dealer up card, second card to each seat, dealer hole card
            const n = params.seats
            const dc = [deck[n], deck[2 * n + 1]]
            let sidePayout = 0
            const hands = Array.from({ length: n }, (_, i) => {
              const cards = [deck[i], deck[n + 1 + i]], h = { cards, bet, ...(isBJ([deck[i], deck[n + 1 + i]]) ? { done: true, nat: true } : {}) }, side = {}
              if (sides.pp) { const r = sidePP(cards[0], cards[1]); side.pp = { stake: sides.pp, ...r }; sidePayout += sides.pp * r.mult }
              if (sides.t3) { const r = sideT3(cards[0], cards[1], dc[0]); side.t3 = { stake: sides.t3, ...r }; sidePayout += sides.t3 * r.mult }
              if (side.pp || side.t3) h.side = side
              return h
            })
            state = { fair: fx.fair, deck: deck.slice(2 * n + 2), dealer: dc, hands, active: Math.max(0, hands.findLastIndex((h) => !h.done)), sideStake: n * (sides.pp + sides.t3), sidePayout, ins: dc[0] % 13 === 0 ? 'offer' : null }
          } else {
            state = { fair: fx.fair, crashAt: newCrashPoint(rg.float()), startedAt: Date.now() + 600, auto: params.auto || null }
          }

          const ins = await fetch(rest, {
            method: 'POST', headers: { ...sbHeaders, 'Prefer': 'return=representation' },
            body: JSON.stringify({ user_id: who.id, username: who.username, game, bet: stake, state, status: INSTANT_GAMES.includes(game) ? 'done' : 'active', payout: kenoPayout, ...(INSTANT_GAMES.includes(game) ? { updated_at: new Date(Date.now() + feedDelay(game, params.rows, 1)).toISOString() } : {}) }),
          })
          const created = ins.ok ? (await ins.json())?.[0] : null
          if (!created) { const rf = await seAdd(stake); return json({ error: 'could not start', refunded: true, newPoints: rf.points ?? null }, 409) }

          let row = created, newPoints = charge.points
          if (INSTANT_GAMES.includes(game) && kenoPayout > 0) {
            let p = await seAdd(kenoPayout); if (!p.ok) p = await seAdd(kenoPayout)
            if (p.points != null) newPoints = p.points
          }
          if (game === 'blackjack' && state.ins !== 'offer' && state.hands.every((h) => h.done)) {
            // every seat has a natural and there is nothing left to decide: the dealer turns the hole card now.
            // No peek: a dealer blackjack is only found out here (or after the players have acted), never earlier.
            const dBJ = isBJ(state.dealer)
            const hs = state.hands.map((h) => ({ ...h, result: dBJ ? 'push' : 'blackjack', payout: dBJ ? h.bet : h.bet * 2.5 }))
            const f = await finish(created, { ...state, hands: hs, outcome: hs.length > 1 ? 'multi' : hs[0].result }, hs.reduce((a, h) => a + h.payout, 0) + state.sidePayout)
            if (f.row) { row = f.row; newPoints = f.newPoints ?? newPoints }
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
            const nextActive = (s) => { const i = s.hands.findLastIndex((h) => !h.done); if (i >= 0) s.active = i; return i < 0 } // seats play from the right
            // all hands finished: dealer plays (unless everyone busted), then settle every hand
            const finishRound = async (s) => {
              const dBJ = isBJ(s.dealer) // the hole card is only looked at now: a dealer blackjack beats every hand that is not a natural
              const anyLive = s.hands.some((h) => !h.nat && bjTotal(h.cards) <= 21)
              if (anyLive && !dBJ) while (bjTotal(s.dealer) < 17) s.dealer = [...s.dealer, s.deck.shift()]
              const d = bjTotal(s.dealer)
              let total = 0
              s.hands = s.hands.map((h) => {
                if (h.nat) { const pay = dBJ ? h.bet : h.bet * 2.5; total += pay; return { ...h, result: dBJ ? 'push' : 'blackjack', payout: pay } }
                const p = bjTotal(h.cards)
                let result, payout
                if (p > 21) { result = 'bust'; payout = 0 }
                else if (dBJ) { result = 'lose'; payout = 0 }
                else if (d > 21 || p > d) { result = 'win'; payout = h.bet * 2 }
                else if (p === d) { result = 'push'; payout = h.bet }
                else { result = 'lose'; payout = 0 }
                total += payout
                return { ...h, result, payout }
              })
              if (s.ins === 'taken' && dBJ) { s.insPayout = s.insStake * 3; s.sidePayout = (s.sidePayout || 0) + s.insPayout }
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

            if (cur.ins === 'offer' && action !== 'insurance') return json({ error: 'insurance pending' }, 400)
            if (action === 'insurance') {
              if (cur.ins !== 'offer') return json({ error: 'no insurance offer' }, 400)
              const s = clone(), take = !!body.take
              s.ins = take ? 'taken' : 'declined'
              const extra = take ? Math.floor(s.hands.reduce((a, h) => a + h.bet, 0) / 2) : 0
              if (take) { s.insStake = extra; s.sideStake = (s.sideStake || 0) + extra }
              // no peek: the hole card stays face down, the insurance is settled when the round ends
              if (extra > 0) { const w2 = await withStake(s, extra); if (w2.err) return w2.err }
              return proceed(s)
            }

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

        // 3. Verificar cooldown 24h (check rápido; o claim atómico mais abaixo é que impede duplos)
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
        let DAILY_POINTS = econOn() ? 10000 + 1000 * Math.min(Math.max(streakIndex, 0), 6) : (STREAK_POINTS[streakIndex] ?? 50)
        if (econOn()) { // VIP rank boost (%)
          try {
            const br = await fetch(`${env.SUPABASE_URL}/rest/v1/point_balances?username=eq.${encodeURIComponent(username.toLowerCase())}&select=level`, { headers: sbHeaders })
            const lvl = Number((await br.json())?.[0]?.level) || 0
            const lr = await fetch(`${env.SUPABASE_URL}/rest/v1/vip_levels?level=eq.${lvl}&select=daily_boost_pct`, { headers: sbHeaders })
            const pct = Number((await lr.json())?.[0]?.daily_boost_pct) || 0
            DAILY_POINTS = Math.floor(DAILY_POINTS * (100 + pct) / 100)
          } catch { /* no boost */ }
        }

        // 6. Claim atómico ANTES de pagar: só um pedido consegue mudar last_daily_claim (impede duplo claim em paralelo)
        const cutoff = new Date(Date.now() - 86400000).toISOString()
        const claimRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&or=(last_daily_claim.is.null,last_daily_claim.lt.${cutoff})`,
          {
            method: 'PATCH',
            headers: { ...sbHeaders, 'Prefer': 'return=representation' },
            body: JSON.stringify({ last_daily_claim: new Date().toISOString(), streak_count: newStreak, streak_last_day: today }),
          }
        )
        if (!claimRes.ok || !(await claimRes.json())?.length)
          return json({ error: 'already_claimed', nextClaimMs: 86400000 }, 400)
        const undoClaim = () => fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ last_daily_claim: profile.last_daily_claim || null, streak_count: currentStreak, streak_last_day: lastDay }),
        })

        // 7. Adicionar pontos
        const seRes = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${username.toLowerCase()}/${DAILY_POINTS}`,
          { method: 'PUT', headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } }
        )
        if (!seRes.ok) {
          await undoClaim()
          return json({ error: `SE API erro ${seRes.status}` }, 502)
        }

        const seData    = await seRes.json()
        const newPoints = seData.newAmount ?? seData.points ?? null

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

        // 4. Claim atómico ANTES de pagar (impede girar várias vezes em paralelo)
        const wCutoff = new Date(Date.now() - 86400000).toISOString()
        const wClaim = await fetch(
          `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&or=(last_wheel_spin.is.null,last_wheel_spin.lt.${wCutoff})`,
          { method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=representation' }, body: JSON.stringify({ last_wheel_spin: new Date().toISOString() }) }
        )
        if (!wClaim.ok || !(await wClaim.json())?.length)
          return json({ error: 'already_spun', nextSpinMs: 86400000 }, 400)

        // 5. Adicionar pontos
        const seRes = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${username.toLowerCase()}/${prize.points}`,
          { method: 'PUT', headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } }
        )
        if (!seRes.ok) {
          await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, { method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=minimal' }, body: JSON.stringify({ last_wheel_spin: profile?.last_wheel_spin || null }) })
          return json({ error: `SE API erro ${seRes.status}` }, 502)
        }

        const seData    = await seRes.json()
        const newPoints = seData.newAmount ?? seData.points ?? null

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

        // Reserva o stock de forma atómica ANTES de cobrar (compare-and-swap: só avança se o stock ainda for o que lemos).
        // Impede vender mais unidades do que as que existem quando vários pedidos chegam ao mesmo tempo.
        let seen = Number(product.stock), reserved = false
        for (let i = 0; i < 8 && seen > 0; i++) {
          const cas = await fetch(
            `${env.SUPABASE_URL}/rest/v1/shop_products?id=eq.${encodeURIComponent(productId)}&stock=eq.${seen}`,
            { method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=representation' }, body: JSON.stringify({ stock: seen - 1 }) }
          )
          if (cas.ok && (await cas.json())?.length) { reserved = true; break }
          const again = await fetch(`${env.SUPABASE_URL}/rest/v1/shop_products?id=eq.${encodeURIComponent(productId)}&select=stock`, { headers: sbHeaders })
          seen = Number((await again.json())?.[0]?.stock ?? 0)
        }
        if (!reserved) return json({ error: 'Produto sem stock.' }, 400)
        const giveBackStock = async () => {
          const cur = await fetch(`${env.SUPABASE_URL}/rest/v1/shop_products?id=eq.${encodeURIComponent(productId)}&select=stock`, { headers: sbHeaders })
          let st = Number((await cur.json())?.[0]?.stock ?? 0)
          for (let i = 0; i < 8; i++) {
            const r = await fetch(`${env.SUPABASE_URL}/rest/v1/shop_products?id=eq.${encodeURIComponent(productId)}&stock=eq.${st}`, { method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=representation' }, body: JSON.stringify({ stock: st + 1 }) })
            if (r.ok && (await r.json())?.length) return
            const a = await fetch(`${env.SUPABASE_URL}/rest/v1/shop_products?id=eq.${encodeURIComponent(productId)}&select=stock`, { headers: sbHeaders })
            st = Number((await a.json())?.[0]?.stock ?? 0)
          }
        }

        const deductRes = await fetch(
          `https://api.streamelements.com/kappa/v2/points/${env.SE_CHANNEL_ID}/${username.toLowerCase()}/${-cost}`,
          { method: 'PUT', headers: { 'Authorization': `Bearer ${env.SE_JWT}`, 'Accept': 'application/json' } }
        )
        if (!deductRes.ok) {
          await giveBackStock()
          return json({ error: `Erro ao descontar pontos: ${deductRes.status}`, detail: await deductRes.text() }, deductRes.status === 400 ? 400 : 502)
        }

        const deductData = await deductRes.json()
        const newPoints  = deductData.newAmount ?? deductData.points ?? null

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

      // ── POST /vip/claim — one-time level-up reward ──
      if (pathname === '/vip/claim' && request.method === 'POST') {
        const who = await getUser(request, env, sbHeaders)
        if (!who?.username) return json({ error: 'unauthorized' }, 401)
        const body = await request.json().catch(() => ({}))
        const level = parseInt(body.level, 10)
        if (!Number.isInteger(level)) return json({ error: 'invalid_level' }, 400)
        const r = await _fetch(`${env.SUPABASE_URL}/rest/v1/rpc/claim_levelup`, { method: 'POST', headers: sbHeaders, body: JSON.stringify({ p_user: who.username, p_level: level }) })
        if (!r.ok) {
          const t = await r.text()
          const e = ['not_reached', 'no_reward', 'already_claimed'].find((k) => t.includes(k))
          return json({ error: e || 'failed' }, e ? 400 : 502)
        }
        return json({ ok: true, balance: Number(await r.json()) })
      }

      // ── POST /voucher/redeem ──
      if (pathname === '/voucher/redeem' && request.method === 'POST') {
        const who = await getUser(request, env, sbHeaders)
        if (!who?.username) return json({ error: 'unauthorized' }, 401)
        const body = await request.json().catch(() => ({}))
        const code = String(body.code || '').trim().slice(0, 40)
        if (!code) return json({ error: 'invalid_code' }, 400)
        const r = await _fetch(`${env.SUPABASE_URL}/rest/v1/rpc/redeem_voucher`, { method: 'POST', headers: sbHeaders, body: JSON.stringify({ p_user: who.username, p_code: code }) })
        if (!r.ok) {
          const t = await r.text()
          const e = ['invalid_code', 'expired', 'used_up', 'already_redeemed'].find((k) => t.includes(k))
          return json({ error: e || 'failed' }, e ? 400 : 502)
        }
        return json({ ok: true, points: Number(await r.json()) })
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
        // ?sort=top: biggest single payouts (all time) instead of the latest rounds
        if (searchParams.get('sort') === 'top') {
          const t = await fetch(
            `${env.SUPABASE_URL}/rest/v1/casino_games?status=eq.done&payout=gt.0&select=username,game,bet,payout,updated_at&order=payout.desc&limit=${limit}`,
            { headers: sbHeaders }
          )
          return json({ rounds: t.ok ? await t.json() : [] })
        }
        const r = await fetch(
          `${env.SUPABASE_URL}/rest/v1/casino_games?status=eq.done&updated_at=lte.${new Date().toISOString()}&select=username,game,bet,payout,updated_at&order=updated_at.desc&limit=${Math.min(limit * 30, 300)}`,
          { headers: sbHeaders }
        )
        if (!r.ok) return json({ rounds: [] })
        // a multi-ball plinko drop is one row in the feed (same player, game and instant): sum it up
        const grouped = new Map()
        for (const x of await r.json()) {
          const k = `${x.username}|${x.game}|${x.updated_at}`
          const g = grouped.get(k)
          if (g) { g.bet += x.bet || 0; g.payout += x.payout || 0; g.count += 1 } else grouped.set(k, { ...x, bet: x.bet || 0, payout: x.payout || 0, count: 1 })
        }
        const rows = [...grouped.values()].slice(0, limit)
        // live crash bets and jackpot winners count as casino rounds too (each source can fail on its own)
        let extra = []
        try {
          const cur = (await clRounds(env, sbHeaders))[0]
          if (cur) {
            const upto = Date.now() >= clEnd(cur) ? Number(cur.seq) + 1 : Number(cur.seq)
            const cb = await clSb(env, sbHeaders, `crash_bets?seq=lt.${upto}&order=created_at.desc&limit=${limit}&select=username,bet,cashed_at,payout,created_at`)
            extra = extra.concat((cb.ok ? await cb.json() : []).map((b) => ({ username: b.username, game: 'crash', bet: b.bet, payout: b.cashed_at == null ? 0 : b.payout, updated_at: b.created_at })))
          }
        } catch { /* feed still works without crash */ }
        try {
          const jr = await jpSb(env, sbHeaders, `jackpot_rounds?status=eq.done&order=seq.desc&limit=${limit}&select=winner_name,winner_amount,payout,end_ms`)
          if (jr.ok) extra = extra.concat((await jr.json()).filter((x) => Number(x.end_ms) + JP.spinMs <= Date.now()).map((x) => ({ username: x.winner_name, game: 'jackpot', bet: x.winner_amount, payout: x.payout, updated_at: new Date(Number(x.end_ms) + JP.spinMs).toISOString() })))
        } catch { /* feed still works without jackpot */ }
        if (extra.length) return json({ rounds: [...rows, ...extra].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, limit) })
        return json({ rounds: rows })
      }

      // ── GET /vip — ranks (public) + my progress and cashback estimate (when logged in) ──
      if (pathname === '/vip' && request.method === 'GET') {
        const lv = await fetch(`${env.SUPABASE_URL}/rest/v1/vip_levels?select=level,name,min_wagered,min_watch_hours,bonus_mult,cashback_pct,levelup_reward,daily_boost_pct&order=level.asc`, { headers: sbHeaders })
        const levels = lv.ok ? await lv.json() : []
        let me = null
        const who = await getUser(request, env, sbHeaders)
        if (who?.username) {
          const u = who.username
          await _fetch(`${env.SUPABASE_URL}/rest/v1/rpc/refresh_vip_user`, { method: 'POST', headers: sbHeaders, body: JSON.stringify({ p_user: u }) }).catch(() => {})
          const br = await fetch(`${env.SUPABASE_URL}/rest/v1/point_balances?username=eq.${encodeURIComponent(u)}&select=balance,watch_minutes,wagered_total,level`, { headers: sbHeaders })
          const row = (await br.json())?.[0] || {}
          const now = new Date()
          const wk = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
          wk.setUTCDate(wk.getUTCDate() - ((wk.getUTCDay() + 6) % 7)) // this Monday 00:00 UTC
          const next = new Date(wk.getTime() + 7 * 86400000 + 3.5 * 3600000) // payout: next Monday 03:30 UTC
          const since = encodeURIComponent(wk.toISOString())
          let wagered = 0, paid = 0
          const g = await fetch(`${env.SUPABASE_URL}/rest/v1/casino_games?username=ilike.${encodeURIComponent(u)}&status=eq.done&created_at=gte.${since}&select=bet,payout&limit=5000`, { headers: sbHeaders })
          if (g.ok) for (const x of await g.json()) { wagered += Number(x.bet) || 0; paid += Number(x.payout) || 0 }
          const c = await fetch(`${env.SUPABASE_URL}/rest/v1/crash_bets?username=ilike.${encodeURIComponent(u)}&created_at=gte.${since}&select=bet,cashed_at&limit=5000`, { headers: sbHeaders })
          if (c.ok) for (const x of await c.json()) { wagered += Number(x.bet) || 0; paid += Math.floor((Number(x.bet) || 0) * (Number(x.cashed_at) || 0)) }
          const lvl = Number(row.level) || 0
          const pct = Number(levels.find((l) => l.level === lvl)?.cashback_pct) || 0
          const cfg = await fetch(`${env.SUPABASE_URL}/rest/v1/economy_config?key=eq.cashback_cap_week&select=value`, { headers: sbHeaders })
          const cap = Number((await cfg.json())?.[0]?.value) || 50000
          const loss = Math.max(0, wagered - paid)
          me = {
            username: u, level: lvl, balance: Number(row.balance) || 0,
            wagered: Number(row.wagered_total) || 0, minutes: Number(row.watch_minutes) || 0,
            weekLoss: loss, cashbackPct: pct, cashbackCap: cap,
            cashbackEst: Math.min(Math.floor(loss * pct / 100), cap),
            nextPayoutMs: next.getTime() - now.getTime(),
            claimed: [],
          }
          try {
            const cr = await fetch(`${env.SUPABASE_URL}/rest/v1/vip_level_claims?username=eq.${encodeURIComponent(u)}&select=level`, { headers: sbHeaders })
            if (cr.ok) me.claimed = (await cr.json()).map((x) => x.level)
          } catch { /* optional */ }
        }
        return json({ levels, me })
      }

      // ── GET /profile — stats + activity for the logged-in user ──
      if (pathname === '/profile' && request.method === 'GET') {
        const who = await getUser(request, env, sbHeaders)
        if (!who?.username) return json({ error: 'unauthorized' }, 401)
        const u = encodeURIComponent(who.username)
        const kind = searchParams.get('kind') || 'all'
        const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
        const get = async (q) => { try { const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${q}`, { headers: sbHeaders }); return r.ok ? await r.json() : [] } catch { return [] } }
        const [games, crash, redeems, tx] = await Promise.all([
          get(`casino_games?username=ilike.${u}&status=eq.done&select=game,bet,payout,updated_at&order=updated_at.desc&limit=5000`),
          get(`crash_bets?username=ilike.${u}&select=bet,cashed_at,created_at&order=created_at.desc&limit=5000`),
          get(`shop_redeems?twitch_username=ilike.${u}&select=cost_at_redeem,created_at,status,shop_products(name)&order=created_at.desc&limit=100`),
          get(`point_transactions?username=eq.${u}&or=(reason.like.cashback:*,reason.like.voucher:*,reason.like.vip_levelup*,reason.like.daily*)&select=delta,reason,created_at&order=created_at.desc&limit=100`),
        ])
        let wins = 0, losses = 0
        const acts = []
        for (const g of games) {
          const bet = Number(g.bet) || 0, pay = Number(g.payout) || 0
          if (pay > bet) wins++; else losses++
          if (acts.length < 400) acts.push({ kind: 'games', title: `${g.game[0].toUpperCase()}${g.game.slice(1)} session`, at: g.updated_at, value: pay - bet, status: pay > bet ? 'WIN' : 'LOSS' })
        }
        for (const c of crash) {
          const bet = Number(c.bet) || 0, pay = c.cashed_at ? Math.floor(bet * Number(c.cashed_at)) : 0
          if (pay > bet) wins++; else losses++
          if (acts.length < 400) acts.push({ kind: 'games', title: 'Crash session', at: c.created_at, value: pay - bet, status: pay > bet ? 'WIN' : 'LOSS' })
        }
        for (const r of redeems) acts.push({ kind: 'shop', title: `Shop: ${r.shop_products?.name || 'Reward'}`, at: r.created_at, value: -(Number(r.cost_at_redeem) || 0), status: String(r.status || 'pending').toUpperCase() })
        for (const t of tx) {
          const rs = String(t.reason)
          const title = rs.startsWith('cashback:') ? 'Weekly cashback' : rs.startsWith('voucher:') ? `Voucher ${rs.slice(8)}` : rs.startsWith('vip_levelup') ? 'Level-up reward' : 'Daily reward'
          acts.push({ kind: 'rewards', title, at: t.created_at, value: Number(t.delta) || 0, status: 'AWARDED' })
        }
        const counts = { all: acts.length, games: 0, shop: 0, rewards: 0 }
        for (const a of acts) counts[a.kind]++
        const list = acts.filter((a) => kind === 'all' || a.kind === kind).sort((a, b) => (a.at < b.at ? 1 : -1))
        return json({ stats: { bets: games.length + crash.length, wins, losses }, counts, total: list.length, page, items: list.slice((page - 1) * 8, page * 8) })
      }

      // ── GET /ranks?u=a,b,c — VIP level of up to 60 usernames (public, for the feeds) ──
      if (pathname === '/ranks' && request.method === 'GET') {
        const names = [...new Set((searchParams.get('u') || '').toLowerCase().split(',').map((x) => x.trim()).filter((x) => /^[a-z0-9_]{1,30}$/.test(x)))].slice(0, 60)
        if (!names.length) return json({ ranks: {} })
        const r = await fetch(`${env.SUPABASE_URL}/rest/v1/point_balances?username=in.(${names.join(',')})&select=username,level`, { headers: sbHeaders })
        const ranks = {}
        if (r.ok) for (const x of await r.json()) ranks[x.username] = Number(x.level) || 0
        return json({ ranks })
      }

      // ── GET /casino/limits?game=&rows=&risk=&picks=&mines= — exact min/max bet for the chosen settings ──
      if (pathname === '/casino/limits' && request.method === 'GET') {
        const game = searchParams.get('game') || ''
        if (game === 'jackpot') return json({ min: JP.minBet, max: jpMax() })
        if (!CASINO_GAMES.includes(game)) return json({ error: 'unknown game' }, 400)
        const n = Math.max(1, Math.min(10, parseInt(searchParams.get('picks') || '10', 10) || 10))
        const body = { rows: searchParams.get('rows'), risk: searchParams.get('risk') || undefined, mines: searchParams.get('mines'), picks: new Array(n).fill(0) }
        return json({ min: CASINO.minBet, max: econMaxBet(game, body), roulette: game === 'roulette' ? econMaxBet(game, body) * 5 : undefined })
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