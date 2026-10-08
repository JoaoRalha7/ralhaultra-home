import React from 'react'

export const RANK_NAMES = ['Member', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond']
export const RANK_COLORS = ['#5a6378', '#c27a3e', '#a2abc0', '#e0a82e', '#2fb8a6', '#8a82e0']

function Glyph({ level }) {
  const star = <path d="M22 12l3 6 6.5.9-4.7 4.6 1.1 6.5L22 26.9 16.1 30l1.1-6.5-4.7-4.6 6.5-.9z" fill="rgba(255,255,255,.88)" />
  if (level === 0) return <circle cx="22" cy="22" r="5" fill="rgba(255,255,255,.8)" />
  if (level === 3) return <path d="M13 16l5 5 4-7 4 7 5-5-2 12H15z" fill="rgba(255,255,255,.92)" />
  if (level === 4) return <path d="M22 11l9 3.5v6c0 5-3.6 8.6-9 11-5.4-2.4-9-6-9-11v-6z" fill="rgba(255,255,255,.9)" />
  if (level === 5) return <path d="M14 18l3-4h10l3 4-8 12z" fill="rgba(255,255,255,.92)" />
  return star
}

export function Medal({ level, size = 44 }) {
  const c = RANK_COLORS[level] || RANK_COLORS[0]
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r="20" fill={c} />
      <circle cx="22" cy="22" r="15" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.5" />
      <Glyph level={level} />
    </svg>
  )
}

