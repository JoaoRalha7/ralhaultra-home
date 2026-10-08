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
  {
    key:     'slotstatsH',
    label:   'Slot Stats Horizontal',
    sub:     'Estatísticas do slot atual em barra horizontal',
    url:     `${BASE_URL}/overlay/slotstatsH`,
    accent:  'red',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="18" x2="14" y2="18"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="10" y2="6"/>
      </svg>
    ),
  },
  {
    key:     'pick',
    label:   'Pick & Win',
    sub:     'Mini-game Pick & Win em direto',
    url:     `${BASE_URL}/overlay/pick`,
    accent:  'purple',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    key:     'minigame',
    label:   'Minigame',
    sub:     'Mini-game a decorrer com participantes',
    url:     `${BASE_URL}/overlay/minigame`,
    accent:  'green',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 12h4M8 10v4"/><circle cx="16" cy="11" r="1"/><circle cx="18" cy="13" r="1"/>
      </svg>
    ),
  },
  {
    key:     'torneio',
    label:   'Torneio',
    sub:     'Ranking e estado do torneio',
    url:     `${BASE_URL}/overlay/torneio`,
    accent:  'amber',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4a2 2 0 0 1-2-2V5h4M18 9h2a2 2 0 0 0 2-2V5h-4M6 9a6 6 0 0 0 12 0V3H6v6ZM12 17v4M8 21h8"/>
      </svg>
    ),
  },
  {
    key:     'bracket',
    label:   'Bracket',
    sub:     'Bracket do torneio com os jogos',
    url:     `${BASE_URL}/overlay/bracket`,
    accent:  'blue',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5h5v4H3zM3 15h5v4H3zM16 10h5v4h-5z"/><path d="M8 7h3v10H8M11 12h5"/>
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