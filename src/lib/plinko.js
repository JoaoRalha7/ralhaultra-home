// Plinko: n rows of pegs, the ball ends in slot 0..n (binomial). Multipliers are symmetric, highest at the edges.
export const PLINKO = { minRows: 8, maxRows: 16, maxBalls: 25, edge: 0.99, risks: ['low', 'medium', 'high'] }
const PL_HALF = { // the published Stake / Degen paytables (left half, centre included); every table returns about 99%
  low: { 8: [5.6, 2.1, 1.1, 1, 0.5], 9: [5.6, 2, 1.6, 1, 0.7], 10: [8.9, 3, 1.4, 1.1, 1, 0.5], 11: [8.4, 3, 1.9, 1.3, 1, 0.7], 12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5], 13: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7], 14: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5], 15: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7], 16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5] },
  medium: { 8: [13, 3, 1.3, 0.7, 0.4], 9: [18, 4, 1.7, 0.9, 0.5], 10: [22, 5, 2, 1.4, 0.6, 0.4], 11: [24, 6, 3, 1.8, 0.7, 0.5], 12: [33, 11, 4, 2, 1.1, 0.6, 0.3], 13: [43, 13, 6, 3, 1.3, 0.7, 0.4], 14: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2], 15: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3], 16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3] },
  high: { 8: [29, 4, 1.5, 0.3, 0.2], 9: [43, 7, 2, 0.6, 0.2], 10: [76, 10, 3, 0.9, 0.3, 0.2], 11: [120, 14, 5.2, 1.4, 0.4, 0.2], 12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2], 13: [260, 37, 11, 4, 1, 0.2, 0.2], 14: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2], 15: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2], 16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2] },
}
const plC = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r }
export function plinkoProbs(rows) { return Array.from({ length: rows + 1 }, (_, k) => plC(rows, k) / 2 ** rows) }
export function plinkoTable(rows, risk = 'medium') {
  const n = Math.max(PLINKO.minRows, Math.min(PLINKO.maxRows, Math.floor(rows) || 8))
  const h = (PL_HALF[risk] || PL_HALF.medium)[n]
  return n % 2 === 0 ? [...h, ...h.slice(0, -1).reverse()] : [...h, ...[...h].reverse()]
}
