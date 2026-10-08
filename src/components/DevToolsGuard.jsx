import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// A deterrent, not security: the real protection is on the server. Shows a notice while the browser developer
// tools are open, except for admins, overlays (OBS browser sources) and localhost.
export default function DevToolsGuard() {
  const { isAdmin } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const skip = isAdmin() || pathname.startsWith('/overlay') || ['localhost', '127.0.0.1'].includes(window.location.hostname)

  useEffect(() => {
    if (skip) { setOpen(false); return }
    if (window.matchMedia?.('(pointer: coarse)').matches) return // phones and tablets
    // 1) docked devtools shrink the page; 2) an object with a getter is only read when the console is open
    // (works in device mode and undocked windows, where the size check cannot see anything)
    const probe = new Image()
    let probed = false
    Object.defineProperty(probe, 'id', { get() { probed = true; return '' } })
    const check = () => {
      const wide = window.outerWidth - window.innerWidth > 200
      const tall = window.outerHeight - window.innerHeight > 220
      probed = false
      console.log('%c', probe) // eslint-disable-line no-console
      setTimeout(() => setOpen(wide || tall || probed), 80)
    }
    const keys = (e) => {
      const k = e.key.toLowerCase()
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) || (e.metaKey && e.altKey && ['i', 'j', 'c'].includes(k)) || (e.ctrlKey && k === 'u')) e.preventDefault()
    }
    check()
    const id = setInterval(check, 1000)
    window.addEventListener('resize', check)
    window.addEventListener('keydown', keys)
    return () => { clearInterval(id); window.removeEventListener('resize', check); window.removeEventListener('keydown', keys) }
  }, [skip])

  if (skip || !open) return null
  return (
    <div role="alertdialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(8,10,15,.97)', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', color: '#eef1f7', fontFamily: '"DM Sans",system-ui,sans-serif' }}>
      <div style={{ maxWidth: 420 }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>
        <h2 style={{ font: '800 24px "Bricolage Grotesque",sans-serif', margin: '14px 0 8px' }}>Developer tools detected</h2>
        <p style={{ margin: 0, color: '#8d96ab', fontSize: 15, lineHeight: 1.5 }}>For security reasons this site does not work with the browser developer tools open. Close them to continue.</p>
      </div>
    </div>
  )
}
