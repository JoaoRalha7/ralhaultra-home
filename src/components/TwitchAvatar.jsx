// Round Twitch picture; falls back to a coloured initial when the user has none.
export default function TwitchAvatar({ name, map, size = 22 }) {
  const n = String(name || '?')
  const url = map?.[n.toLowerCase()]
  const hue = [...n].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const base = { width: size, height: size, borderRadius: '50%', flex: 'none', display: 'inline-grid', placeItems: 'center', verticalAlign: 'middle' }
  return url
    ? <img src={url} alt="" referrerPolicy="no-referrer" style={{ ...base, objectFit: 'cover', background: '#1b2130' }} />
    : <span aria-hidden="true" style={{ ...base, background: `hsl(${hue} 55% 45%)`, color: '#fff', font: `800 ${Math.round(size * 0.46)}px "Bricolage Grotesque",sans-serif` }}>{n[0].toUpperCase()}</span>
}
