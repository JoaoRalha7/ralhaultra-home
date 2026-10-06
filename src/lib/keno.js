export const KENO = { size: 40, draw: 10, max: 10, edge: 0.97, cap: 1000 }
export const KENO_RISK = { low: { alpha: 0.75, min: 1 }, classic: { alpha: 0.3, min: 1 }, medium: { alpha: 0, min: 1.5 }, high: { alpha: -0.5, min: 3 } }
const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r }
export function kenoProbs(n) { const t = C(KENO.size, KENO.draw); return Array.from({ length: n + 1 }, (_, h) => C(n, h) * C(KENO.size - n, KENO.draw - h) / t) }
export function kenoTable(n, risk = 'classic') {
  const R = KENO_RISK[risk] || KENO_RISK.classic
  const P = kenoProbs(n)
  let lo = 1 // lowest paying hit
  for (;;) {
    const S = []; for (let h = lo; h <= n; h++) S.push(h)
    const capped = new Set(), mult = {}
    for (;;) {
      const used = [...capped].reduce((a, h) => a + KENO.cap * P[h], 0)
      const free = S.filter((h) => !capped.has(h))
      const W = free.map((h) => Math.pow(P[h], R.alpha)); const sum = W.reduce((a, b) => a + b, 0)
      free.forEach((h, i) => { mult[h] = Math.max(0, KENO.edge - used) * (W[i] / sum) / P[h] })
      const over = free.filter((h) => mult[h] > KENO.cap)
      if (!over.length) break
      over.forEach((h) => capped.add(h))
      if (capped.size === S.length) break
    }
    S.forEach((h) => { if (capped.has(h)) mult[h] = KENO.cap })
    if (lo < n && mult[lo] < R.min) { lo++; continue }
    const t = new Array(n + 1).fill(0)
    S.forEach((h) => { t[h] = Math.min(KENO.cap, Math.floor(mult[h] * 100) / 100) })
    return t
  }
}
