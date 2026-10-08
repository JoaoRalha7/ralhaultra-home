// Round Twitch picture; falls back to a coloured initial when the user has none.
import { useState } from 'react'

export default function TwitchAvatar({ name, map, size = 22, className }) {
  const n = String(name || '?')
  const [bad, setBad] = useState(false)
  const url = bad ? null : map?.[n.toLowerCase()]
  const hue = [...n].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const base = { width: size, height: size, borderRadius: '50%', flex: 'none', display: 'inline-grid', placeItems: 'center', verticalAlign: 'middle' }
  return url
    ? <img className={className} onError={() => setBad(true)} src={url} alt="" referrerPolicy="no-referrer" style={{ ...base, objectFit: 'cover', background: '#1b2130' }} />
    : <span className={className} aria-hidden="true" style={{ ...base, background: `hsl(${hue} 55% 45%)`, color: '#fff', font: `800 ${Math.round(size * 0.46)}px "Bricolage Grotesque",sans-serif` }}>{n[0].toUpperCase()}</span>
}
