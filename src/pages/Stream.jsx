import { useEffect, useRef } from 'react'
import { useTwitchStatus } from '../hooks/useTwitchStatus'
import styles from './Stream.module.css'

const CHANNEL = 'jralha_'

export default function Stream() {
  const live      = useTwitchStatus()
  const playerRef = useRef(null)
  const embedRef  = useRef(null)

  useEffect(() => {
    if (!playerRef.current) return

    if (!document.getElementById('twitch-embed-script')) {
      const s = document.createElement('script')
      s.id = 'twitch-embed-script'
      s.src = 'https://embed.twitch.tv/embed/v1.js'
      s.async = true
      s.onload = () => initPlayer()
      document.body.appendChild(s)
    } else if (window.Twitch) {
      initPlayer()
    }

    function initPlayer() {
      if (!playerRef.current || embedRef.current) return
      const container = playerRef.current.querySelector('#twitch-player')
      if (!container || container.hasChildNodes()) return
      embedRef.current = new window.Twitch.Player('twitch-player', {
        channel: CHANNEL,
        parent: [window.location.hostname],
        width: '100%',
        height: '100%',
        autoplay: false,
      })
    }

    return () => { embedRef.current = null }
  }, [])

  const parent = window.location.hostname === 'localhost'
    ? 'localhost'
    : window.location.hostname.includes('vercel.app')
      ? 'ralha-react-ultra-bwxl.vercel.app'
      : 'jralha.com'

  const chatSrc = `https://www.twitch.tv/embed/${CHANNEL}/chat?parent=${parent}&darkpopout`

  return (
    <div className={styles.page}>

      {/* ── HEADER ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Stream</h1>
          <div className={`${styles.statusBadge} ${live ? styles.online : styles.offline}`}>
            <span className={styles.dot} />
            {live ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>
        <p className={styles.watchText}>
          Watch <a href={`https://twitch.tv/${CHANNEL}`} target="_blank" rel="noopener" className={styles.watchLink}>JRALHA</a> on Twitch!
        </p>
      </div>

      {/* ── PLAYER + CHAT ── */}
      <div className={styles.layout}>

        {/* Player */}
        <div className={styles.playerWrap} ref={playerRef}>
          <div id="twitch-player" className={styles.player} />
          {!live && (
            <div className={styles.offlineOverlay}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="1.5" strokeLinecap="round">
                <rect x="2" y="7" width="20" height="15" rx="2"/>
                <path d="M17 2l-5 5-5-5"/>
              </svg>
              <p className={styles.offlineTitle}>Stream offline</p>
              <p className={styles.offlineSub}>
                Follow on{' '}
                <a href={`https://twitch.tv/${CHANNEL}`} target="_blank" rel="noopener">
                  twitch.tv/{CHANNEL}
                </a>{' '}
                to know when the stream goes live.
              </p>
            </div>
          )}
        </div>

        {/* Chat */}
        <div className={styles.chatWrap}>
          <iframe
            src={chatSrc}
            className={styles.chatFrame}
            title="Twitch Chat"
            frameBorder="0"
            scrolling="yes"
          />
        </div>

      </div>
    </div>
  )
}