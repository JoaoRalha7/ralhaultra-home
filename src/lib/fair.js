// Provably fair generator. Must stay identical to fairRng() in worker/ralha-points.js.
const enc = new TextEncoder()
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
export const sha256hex = async (str) => toHex(await crypto.subtle.digest('SHA-256', enc.encode(str)))

export async function fairRng(server, client, nonce) {
  const key = await crypto.subtle.importKey('raw', enc.encode(server), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const blocks = await Promise.all(Array.from({ length: 128 }, (_, i) => crypto.subtle.sign('HMAC', key, enc.encode(`${client}:${nonce}:${i}`))))
  const w = new Uint32Array(1024)
  blocks.forEach((b, i) => { const dv = new DataView(b); for (let j = 0; j < 8; j++) w[i * 8 + j] = dv.getUint32(j * 4) })
  let p = 0
  const next = () => { if (p >= w.length) throw new Error('stream exhausted'); return w[p++] }
  const int = (n) => { const lim = Math.floor(0x100000000 / n) * n; let x; do { x = next() } while (x >= lim); return x % n }
  return { float: () => next() / 0x100000000, int, shuffle: (a) => { for (let i = a.length - 1; i > 0; i--) { const j = int(i + 1); [a[i], a[j]] = [a[j], a[i]] } return a } }
}

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS = ['♠', '♥', '♦', '♣']
const card = (c) => `${RANKS[c % 13]}${SUITS[Math.floor(c / 13) % 4]}`

export const GAME_OPTS = {
  roulette: [], keno: [], jackpot: [],
  blackjack: [{ k: 'seats', label: 'Seats', def: 1, min: 1, max: 3 }],
  mines: [{ k: 'mines', label: 'Mines', def: 3, min: 1, max: 24 }],
  plinko: [{ k: 'rows', label: 'Rows', def: 16, min: 8, max: 16 }, { k: 'balls', label: 'Balls in the bet', def: 1, min: 1, max: 25 }],
  crash: [],
}

// What a given seed pair + nonce produced, for each game. Returns [{ label, value }].
export async function derive(game, server, client, nonce, o = {}) {
  const rg = await fairRng(server, client, nonce)
  if (game === 'roulette') {
    const n = rg.int(37)
    return [{ label: 'Number', value: `${n} (${n === 0 ? 'green' : RED.has(n) ? 'red' : 'black'})` }]
  }
  if (game === 'mines') {
    const m = Math.min(24, Math.max(1, Math.floor(o.mines) || 3))
    const t = rg.shuffle(Array.from({ length: 25 }, (_, i) => i)).slice(0, m).sort((a, b) => a - b)
    return [{ label: `Mine tiles (0-24, left to right, top to bottom)`, value: t.join(', ') }]
  }
  if (game === 'keno') {
    const d = rg.shuffle(Array.from({ length: 40 }, (_, i) => i + 1)).slice(0, 10).sort((a, b) => a - b)
    return [{ label: 'Drawn numbers', value: d.join(', ') }]
  }
  if (game === 'plinko') {
    const rows = Math.min(16, Math.max(8, Math.floor(o.rows) || 16)), balls = Math.min(25, Math.max(1, Math.floor(o.balls) || 1))
    return Array.from({ length: balls }, (_, b) => {
      const path = Array.from({ length: rows }, () => rg.int(2))
      return { label: `Ball ${b + 1}: slot`, value: `${path.reduce((a, c) => a + c, 0)} (path ${path.map((x) => (x ? 'R' : 'L')).join('')})` }
    })
  }
  if (game === 'blackjack') {
    const n = Math.min(3, Math.max(1, Math.floor(o.seats) || 1))
    const d = rg.shuffle(Array.from({ length: 312 }, (_, i) => i % 52))
    const seatsOut = Array.from({ length: n }, (_, i) => ({ label: `Seat ${i + 1}`, value: `${card(d[i])} ${card(d[n + 1 + i])}` }))
    return [...seatsOut, { label: 'Dealer (up card, hole card)', value: `${card(d[n])} ${card(d[2 * n + 1])}` }, { label: 'Next cards', value: d.slice(2 * n + 2, 2 * n + 10).map(card).join(' ') }]
  }
  if (game === 'jackpot') return [{ label: 'Ticket (0-1, the winner is where ticket x pot falls)', value: rg.float().toFixed(12) }]
  const u = rg.float()
  return [{ label: 'Crash point', value: `${Math.min(1000, Math.max(1, Math.floor((0.97 / (1 - u)) * 100) / 100)).toFixed(2)}x` }]
}
