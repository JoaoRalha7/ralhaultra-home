export const KENO = { size: 40, draw: 10, max: 10, edge: 0.97, cap: 1000, alpha: 0.3 }
const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r }
export function kenoProbs(n) { const t = C(KENO.size, KENO.draw); return Array.from({ length: n + 1 }, (_, h) => C(n, h) * C(KENO.size - n, KENO.draw - h) / t) }
export function kenoTable(n) {
  const P = kenoProbs(n)
  let S = []; for (let h = 1; h <= n; h++) S.push(h)
  let mult = []
  for (;;) {
    const W = S.map((h) => Math.pow(P[h], KENO.alpha)); const sum = W.reduce((a, b) => a + b, 0)
    mult = S.map((h, i) => KENO.edge * (W[i] / sum) / P[h])
    const low = mult.findIndex((m) => m < 1)
    if (low === -1 || S.length === 1) break
    S = S.slice(1)
  }
  const t = new Array(n + 1).fill(0)
  S.forEach((h, i) => { t[h] = Math.min(KENO.cap, Math.floor(mult[i] * 100) / 100) })
  return t
}
