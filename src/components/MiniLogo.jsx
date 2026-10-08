import { useId } from 'react'

// Original logos for the three viewer mini-games (Pick & Win, Guess the Balance, Avg Multi).
const TONES = {
  pick: ['#fde68a', '#f59e0b', '#b45309'],
  gtb: ['#a7f3d0', '#10b981', '#047857'],
  avg: ['#bfdbfe', '#3b82f6', '#1d4ed8'],
}

export default function MiniLogo({ k = 'pick', size = 40 }) {
  const id = useId().replace(/:/g, '')
  const [a, b, c] = TONES[k] || TONES.pick
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" style={{ display: 'block', flex: 'none' }}>
      <defs>
        <linearGradient id={`g${id}`} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor={a} /><stop offset=".55" stopColor={b} /><stop offset="1" stopColor={c} />
        </linearGradient>
        <linearGradient id={`s${id}`} x1="24" y1="4" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity=".55" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="42" height="42" rx="13" fill={`url(#g${id})`} />
      <rect x="3" y="3" width="42" height="21" rx="13" fill={`url(#s${id})`} />
      <rect x="3.5" y="3.5" width="41" height="41" rx="12.5" stroke="#fff" strokeOpacity=".28" />
      {k === 'pick' && (
        /* a slot tile with a star: pick one */
        <g>
          <rect x="12" y="11" width="24" height="26" rx="6" fill="#fff" fillOpacity=".92" />
          <path d="M24 15.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill={c} />
        </g>
      )}
      {k === 'gtb' && (
        /* balance scale: guess the balance */
        <g stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M24 11v24M17 36h14" />
          <path d="M11 17h26" />
          <path d="M11 17l-4.5 9a5 5 0 0 0 9 0z" fill="#fff" fillOpacity=".25" />
          <path d="M37 17l-4.5 9a5 5 0 0 0 9 0z" fill="#fff" fillOpacity=".25" />
        </g>
      )}
      {k === 'avg' && (
        /* multiplier mark over bars: average multi */
        <g>
          <rect x="11" y="27" width="6" height="10" rx="2" fill="#fff" fillOpacity=".55" />
          <rect x="21" y="21" width="6" height="16" rx="2" fill="#fff" fillOpacity=".75" />
          <rect x="31" y="14" width="6" height="23" rx="2" fill="#fff" />
        </g>
      )}
    </svg>
  )
}
