import { useState } from 'react'
import styles from './DashOverlays.module.css'

const BASE_URL = window.location.origin

const OVERLAYS = [
  {
    key:     'barra',
    label:   'Barra OBS',
    sub:     'Topbar com casino, modo e activity',
    url:     `${BASE_URL}/overlay/barra`,
    accent:  'purple',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 2H8"/><path d="M12 2v5"/>
      </svg>
    ),
  },
  {
    key:     'hunting',
    label:   'Hunting',
    sub:     'Lista de slots da bonus hunt',
    url:     `${BASE_URL}/overlay/hunting`,
    accent:  'blue',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
    ),
  },
  {
    key:     'opening',
    label:   'Opening',
    sub:     'Carrossel de abertura de bónus',
    url:     `${BASE_URL}/overlay/opening`,
    accent:  'green',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/>
        <path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
      </svg>
    ),
  },
  {
    key:     'hunt',
    label:   'Overlay Hunt',
    sub:     'Barra horizontal 960px para OBS',
    url:     `${BASE_URL}/overlay/hunt`,
    accent:  'amber',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>
      </svg>
    ),
  },
  {
    key:     'slotstats',
    label:   'Slot Stats',
    sub:     'Estatísticas do slot atual',
    url:     `${BASE_URL}/overlay/slotstats`,
    accent:  'red',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    key:     'chatbox',
    label:   'Chat + Giveaway',
    sub:     'Chat ao vivo, eventos e sorteio com roleta',
    url:     `${BASE_URL}/overlay/chatbox`,
    accent:  'amber',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
]

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  )
}

function OpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

export default function DashOverlays() {
  const [copied, setCopied] = useState(null)

  function handleCopy(key, url) {
    navigator.clipboard.writeText(url)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function handleOpen(url) {
    window.open(url, '_blank')
  }

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>
          </svg>
        </div>
        <div>
          <div className={styles.headerTitle}>Overlays OBS</div>
          <div className={styles.headerSub}>Clica para abrir ou copiar o URL</div>
        </div>
      </div>

      <div className={styles.grid}>
        {OVERLAYS.map(o => (
          <div key={o.key} className={`${styles.card} ${styles['card_' + o.accent]}`}>

            <div className={styles.cardLeft}>
              <div className={`${styles.cardIcon} ${styles['icon_' + o.accent]}`}>
                {o.icon}
              </div>
              <div className={styles.cardText}>
                <div className={styles.cardLabel}>{o.label}</div>
                <div className={styles.cardSub}>{o.sub}</div>
                <div className={styles.cardUrl}>{o.url}</div>
              </div>
            </div>

            <div className={styles.cardActions}>
              <button
                className={`${styles.btn} ${styles.btnCopy} ${copied === o.key ? styles.btnCopied : ''}`}
                onClick={() => handleCopy(o.key, o.url)}
                title="Copiar URL"
              >
                {copied === o.key ? <CheckIcon /> : <CopyIcon />}
                {copied === o.key ? 'Copiado!' : 'Copiar'}
              </button>
              <button
                className={`${styles.btn} ${styles.btnOpen}`}
                onClick={() => handleOpen(o.url)}
                title="Abrir em nova aba"
              >
                <OpenIcon />
                Abrir
              </button>
            </div>

          </div>
        ))}
      </div>

    </div>
  )
}