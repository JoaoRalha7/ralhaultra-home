import { useId } from 'react'

export const RANK_NAMES = ['Member', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond']
// main colour of each rank (used for text and tints)
export const RANK_COLORS = ['#7a839b', '#cd7f32', '#b8c2d4', '#f0b429', '#34d1bf', '#9b8cff']

// metal ramps: light, mid, dark, deep
const RAMP = [
  ['#a9b2c6', '#6b7389', '#454c5f', '#2a2f3d'],
  ['#ffd0a0', '#d98a45', '#9a5320', '#5a2d0c'],
  ['#ffffff', '#c3ccdc', '#7d8aa3', '#4a5468'],
  ['#fff1b0', '#f5c542', '#c8861a', '#7a4d06'],
  ['#c8fff4', '#4fe0cc', '#1e9c8c', '#0c5148'],
  ['#e4dcff', '#a99bff', '#6a58d8', '#34277f'],
]

const HEX = 'M22 2.5l17 9.75v19.5L22 41.5 5 31.75v-19.5z'
const INNER = 'M22 7l13 7.5v15L22 37 9 29.5v-15z'

function Emblem({ level, fill }) {
  switch (level) {
    case 0: return <circle cx="22" cy="22" r="4.5" fill={fill} />
    case 1: return <path d="M22 13.5l2.7 5.5 6 .85-4.35 4.25 1.05 6L22 27.2l-5.4 2.9 1.05-6-4.35-4.25 6-.85z" fill={fill} />
    case 2: return <path d="M13.5 22.5L22 15l8.5 7.5-2.4 2.6L22 19.8l-6.1 5.3zM13.5 29L22 21.5 30.5 29l-2.4 2.6L22 26.3l-6.1 5.3z" fill={fill} />
    case 3: return <path d="M12.5 17l5 5 4.5-8 4.5 8 5-5-2 12.5h-15zM14 31h16v2H14z" fill={fill} />
    case 4: return <path d="M22 12.5l8 3v5.8c0 4.7-3.3 8-8 10.4-4.7-2.4-8-5.7-8-10.4v-5.8zM22 17.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill={fill} fillRule="evenodd" />
    default: return <path d="M15 17.5l3.2-4h7.6l3.2 4-7 12.5zM15 17.5h14M18.2 13.5L22 30l3.8-16.5" fill={fill} stroke="rgba(0,0,0,.25)" strokeWidth=".8" strokeLinejoin="round" />
  }
}

// Original rank badge: a metal hexagon with a bevel, a recessed plate and an emblem per rank.
export function Medal({ level = 0, size = 44, plain = false }) {
  const id = useId().replace(/:/g, '')
  const [l, m, d, dd] = RAMP[level] || RAMP[0]
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={l} /><stop offset=".45" stopColor={m} /><stop offset="1" stopColor={d} /></linearGradient>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={d} /><stop offset="1" stopColor={dd} /></linearGradient>
        <linearGradient id={`${id}e`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor={l} /></linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <clipPath id={`${id}c`}><path d={HEX} /></clipPath>
      </defs>
      <path d={HEX} fill={dd} transform="translate(0 1.2)" opacity=".55" />
      <path d={HEX} fill={`url(#${id}r)`} />
      <path d={HEX} fill="none" stroke={l} strokeOpacity=".85" strokeWidth="1" />
      <path d={INNER} fill={`url(#${id}p)`} />
      <path d={INNER} fill="none" stroke={m} strokeOpacity=".7" strokeWidth=".9" />
      {!plain && <g clipPath={`url(#${id}c)`}><path d="M0 0h44v19C30 24 14 24 0 17z" fill={`url(#${id}s)`} opacity=".7" /></g>}
      {!plain && <Emblem level={level} fill={`url(#${id}e)`} />}
    </svg>
  )
}

// Thick 3D version: a stack of layers along Z that turns around its vertical axis (CSS in Vip.module.css: .spin3d).
export function Medal3D({ level = 0, size = 64, delay = 0, className = '' }) {
  const layers = [-5, -4, -3, -2, -1]
  return (
    <div className={className} style={{ width: size, height: size, perspective: 700 }}>
      <div style={{ position: 'relative', width: size, height: size, transformStyle: 'preserve-3d', animation: `medalSpin 7s cubic-bezier(.6,0,.25,1) ${delay}s infinite` }}>
        {layers.map((z) => (
          <div key={z} style={{ position: 'absolute', inset: 0, transform: `translateZ(${z * 1.4}px)`, filter: `brightness(${0.55 + (z + 5) * 0.06})` }}>
            <Medal level={level} size={size} plain />
          </div>
        ))}
        <div style={{ position: 'absolute', inset: 0, transform: 'translateZ(1px)' }}><Medal level={level} size={size} /></div>
      </div>
    </div>
  )
}
