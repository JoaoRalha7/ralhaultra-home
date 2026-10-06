/**
 * miniGamesUtils.jsx
 * Shared utilities and components for all Mini-Games pages.
 * Import from here instead of defining locally in each page.
 */
import { useState, useEffect } from 'react'

// ── Formatters ─────────────────────────────────────────────────────────────────
export function parseBet(v) {
  if (v == null) return 0
  return parseFloat(String(v).replace(',', '.')) || 0
}

export function fmtTime(s) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Hooks ──────────────────────────────────────────────────────────────────────
export function useCountdown(closesAt) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!closesAt) { setSecs(0); return }
    const tick = () => setSecs(Math.max(0, Math.floor((new Date(closesAt) - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [closesAt])
  return secs
}

// ── Components ─────────────────────────────────────────────────────────────────
export function Spinner({ size = 18 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: '2px solid rgba(255,255,255,.1)',
      borderTopColor: '#3b82f6',
      animation: 'spin .7s linear infinite',
      flexShrink: 0,
    }} />
  )
}

export function Medal({ pos, size = 14 }) {
  const colors = ['#fbbf24', '#94a3b8', '#cd7c54']
  const c = colors[pos - 1] || colors[2]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
      <path d="M12 17v4"/><path d="M8 21h8"/>
      <path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/>
    </svg>
  )
}

export function LockIcon({ size = 9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

export function ChevronIcon({ dir }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {dir === 'left'
        ? <polyline points="15 18 9 12 15 6"/>
        : <polyline points="9 18 15 12 9 6"/>
      }
    </svg>
  )
}

// ── Avg Multi buckets config ───────────────────────────────────────────────────
export const AVG_BUCKETS = [
  { id: 'A', label: '0-65x',    min: 0,   max: 65,  color: '#6366f1' },
  { id: 'B', label: '66-75x',   min: 66,  max: 75,  color: '#8b5cf6' },
  { id: 'C', label: '76-85x',   min: 76,  max: 85,  color: '#ec4899' },
  { id: 'D', label: '86-95x',   min: 86,  max: 95,  color: '#f59e0b' },
  { id: 'E', label: '96-105x',  min: 96,  max: 105, color: '#10b981' },
  { id: 'F', label: '+106x',    min: 106, max: null, color: '#3b82f6' },
]

export function getBucket(avg) {
  if (!avg) return null
  return AVG_BUCKETS.find(b => avg >= b.min && (b.max === null || avg <= b.max)) || null
}