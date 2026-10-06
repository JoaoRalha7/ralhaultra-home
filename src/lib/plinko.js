// Plinko: n rows of pegs, the ball ends in slot 0..n (binomial). Multipliers are symmetric, highest at the edges.
export const PLINKO = { minRows: 8, maxRows: 16, edge: 0.99, risks: ['low', 'medium', 'high'] }
const PL_HI = { low: [5.6, 16], medium: [13, 110], high: [29, 1000] }
const PL_FLOOR = { low: 0.5, medium: 0.3, high: 0.2 }
const plC = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r }
export function plinkoProbs(rows) { return Array.from({ length: rows + 1 }, (_, k) => plC(rows, k) / 2 ** rows) }
export function plinkoTable(rows, risk = 'medium') {
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
