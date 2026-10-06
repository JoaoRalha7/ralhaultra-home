import { useState, useEffect } from 'react'
import styles from './AgeVerification.module.css'

export default function AgeVerification({ onVerified }) {
  const [show, setShow] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const verified = localStorage.getItem('ageVerified')
    if (!verified) {
      setShow(true)
      setTimeout(() => setVisible(true), 10)
    } else {
      onVerified()
    }
  }, [])

  const enter = () => {
    setVisible(false)
    setTimeout(() => {
      localStorage.setItem('ageVerified', '1')
      setShow(false)
      onVerified()
    }, 300)
  }

  const exit = () => {
    window.location.href = 'https://www.google.com'
  }

  if (!show) return null

  return (
    <div className={`${styles.overlay} ${visible ? styles.overlayVisible : ''}`}>
      <div className={`${styles.card} ${visible ? styles.cardVisible : ''}`}>

        {/* Icon */}
        <div className={styles.iconWrap}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.5C16.5 21.15 20 16.25 20 11V5L12 2z" fill="rgba(59,130,246,.12)"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <circle cx="12" cy="16" r=".8" fill="#3b82f6" stroke="none"/>
          </svg>
        </div>

        {/* Title */}
        <h1 className={styles.title}>AGE VERIFICATION</h1>

        {/* Body */}
        <p className={styles.body}>
          This site contains content related to gambling and betting.<br />
          You must be <strong>18 or older</strong> to enter.
        </p>

        {/* Buttons */}
        <button className={styles.btnEnter} onClick={enter}>
          I AM 18 OR OLDER – ENTER
        </button>
        <button className={styles.btnExit} onClick={exit}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
          EXIT SITE
        </button>

        {/* Footer */}
        <p className={styles.footer}>GAMBLE RESPONSIBLY</p>
      </div>
    </div>
  )
}