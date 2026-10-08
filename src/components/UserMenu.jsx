import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Medal, RANK_NAMES, RANK_COLORS } from './Medal'
import { workerGet } from '../lib/vip'
import styles from './UserMenu.module.css'

function Face({ src, name, size }) {
  const [bad, setBad] = useState(false)
  if (src && !bad) return <img className={styles.face} style={{ width: size, height: size }} src={src} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} />
  return <div className={styles.face} style={{ width: size, height: size, fontSize: size * 0.4 }}>{(name || '?')[0].toUpperCase()}</div>
}

export default function UserMenu({ src, name, userId, onLogout }) {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    let alive = true
    workerGet('/vip').then((d) => { if (alive && d?.me) setLevel(d.me.level || 0) })
    return () => { alive = false }
  }, [userId])

  useEffect(() => {
    if (!open) return
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const key = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])

  return (
    <div className={styles.wrap} ref={ref}>
      <button className={`${styles.trigger} ${open ? styles.triggerOn : ''}`} onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        <span className={styles.avWrap}>
          <Face src={src} name={name} size={34} />
          <span className={styles.badge}><Medal level={level} size={20} /></span>
        </span>
        <svg className={styles.chev} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.head}>
            <span className={styles.avWrap}>
              <Face src={src} name={name} size={44} />
              <span className={styles.badgeBig}><Medal level={level} size={24} /></span>
            </span>
            <div><b>{name}</b><small style={{ color: RANK_COLORS[level] }}>{RANK_NAMES[level]}</small></div>
          </div>
          <div className={styles.items}>
            <Link to="/profile" role="menuitem" onClick={() => setOpen(false)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" /></svg>My Profile
            </Link>
            <Link to="/vip" role="menuitem" onClick={() => setOpen(false)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" /></svg>VIP
            </Link>
            <i className={styles.sep} />
            <button role="menuitem" onClick={() => { setOpen(false); onLogout() }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4M16 8l4 4-4 4M20 12H9" /></svg>Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
