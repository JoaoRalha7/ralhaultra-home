// European roulette (single zero). Payouts are total multiples of the stake (stake included).
export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
export const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
export const ROULETTE = { maxBets: 100,
  // outside bets that cover the same numbers from both sides: not allowed together
  opposite: { red: 'black', black: 'red', odd: 'even', even: 'odd', low: 'high', high: 'low' }, payouts: { straight: 36, red: 2, black: 2, odd: 2, even: 2, low: 2, high: 2, dozen: 3, column: 3, multi: 0 } }
export const rColor = (n) => (n === 0 ? 'green' : REDS.includes(n) ? 'red' : 'black')
export function rouletteMult(bet, n) {
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
export function validBet(b) {
  if (!b || !(b.type in ROULETTE.payouts)) return false
  if (!Number.isInteger(b.amount) || b.amount <= 0) return false
  if (b.type === 'multi') return typeof b.value === 'string'
  if (b.type === 'straight') return Number.isInteger(b.value) && b.value >= 0 && b.value <= 36
  if (b.type === 'dozen' || b.type === 'column') return Number.isInteger(b.value) && b.value >= 1 && b.value <= 3
  return true
}
