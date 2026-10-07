export const Gem = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="mgA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b6ffd0" /><stop offset="1" stopColor="#19e06b" /></linearGradient>
      <linearGradient id="mgB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3dff8a" /><stop offset="1" stopColor="#079a45" /></linearGradient>
    </defs>
    <path d="M13 6h22l10 12-21 25L3 18z" fill="url(#mgB)" />
    <path d="M13 6h22l10 12H3z" fill="url(#mgA)" />
    <path d="M3 18h42L24 43z" fill="#12c75a" opacity=".55" />
    <path d="M13 6l-4 12 15 25M35 6l4 12-15 25M17 18l7-12 7 12" fill="none" stroke="#eafff2" strokeOpacity=".7" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
)
export const Bomb = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <circle cx="22" cy="28" r="14" fill="#c4202e" />
    <ellipse cx="17" cy="22" rx="5" ry="3.500" fill="#ff6f7b" opacity=".55" transform="rotate(-30 17 22)" />
    <path d="M30 16l5-6M35 10l2-4M33 8l7 1" stroke="#7a1019" strokeWidth="2.600" strokeLinecap="round" fill="none" />
    <rect x="28" y="14" width="6" height="5" rx="1.500" fill="#7a1019" transform="rotate(40 31 16)" />
  </svg>
)
