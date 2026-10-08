// Live Stats: every settled round of every Originals game, kept in this browser. Used by the floating panel.
import { useSyncExternalStore } from 'react'

const KEY = 'casino-live-stats'
let items = []
try { items = JSON.parse(localStorage.getItem(KEY)) || [] } catch { items = [] }
const subs = new Set()
const emit = () => { try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* ignore */ } subs.forEach((f) => f()) }

export function recordStat(game, id, bet, payout) {
  const k = `${game}:${id}`
  if (id == null || items.some((x) => x.k === k)) return
  items = [...items, { k, game, bet: Number(bet) || 0, payout: Number(payout) || 0, t: Date.now() }]
  emit()
}
export function resetStats() { items = []; emit() }

const sub = (f) => { subs.add(f); return () => subs.delete(f) }
export const useStatItems = () => useSyncExternalStore(sub, () => items)

export function summarize(list, game) {
  const rows = game && game !== 'all' ? list.filter((x) => x.game === game) : list
  let profit = 0, wagered = 0, wins = 0, losses = 0
  const line = [0]
  for (const x of rows) {
    const p = x.payout - x.bet
    profit += p; wagered += x.bet
    if (p > 0) wins++; else if (p < 0) losses++
    line.push(profit)
  }
  return { profit, wagered, wins, losses, line }
}
