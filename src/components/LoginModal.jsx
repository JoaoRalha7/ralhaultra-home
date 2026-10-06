import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import styles from './LoginModal.module.css'

export default function LoginModal({ onClose }) {
  const { signInWithTwitch } = useAuth()
  const [accepted, setAccepted] = useState(false)
  const [shaking, setShaking]   = useState(false)

  // Fechar com ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleContinue = () => {
    if (!accepted) {
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
      return
    }
    signInWithTwitch()
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>

        {/* Close */}
        <button className={styles.closeBtn} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Logo */}
        <div className={styles.logoWrap}>
          <img src="/assets/04.png" alt="RALHA" className={styles.logo} />
        </div>

        {/* Title */}
        <h2 className={styles.title}>Sign In</h2>
        <p className={styles.sub}>
          You'll be redirected to Twitch to verify your account and load your points.
        </p>

        {/* Terms checkbox */}
        <label className={`${styles.termsLabel} ${shaking ? styles.shake : ''}`}>
          <div className={styles.checkbox} onClick={() => setAccepted(v => !v)}>
            {accepted && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <span>
            I have read and accept the{' '}
            <a href="/terms" target="_blank" rel="noopener">Terms of Service</a>
            {' '}and the{' '}
            <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.
          </span>
        </label>

        {/* CTA */}
        <button
          className={`${styles.twitchBtn} ${!accepted ? styles.twitchBtnDisabled : ''}`}
          onClick={handleContinue}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
          </svg>
          CONTINUE WITH TWITCH
        </button>

        {/* Responsible gaming note */}
        <p className={styles.legal}>
          +18 · Gamble responsibly ·{' '}
          <a href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware</a>
        </p>

      </div>
    </div>
  )
}