import { useNavigate } from 'react-router-dom'
import styles from './Footer.module.css'

const QUICK_LINKS = [
  { label: 'Home',             href: '/' },
  { label: 'Casinos & Offers', href: '/offers' },
  { label: 'Bonus Hunts',      href: '/bonus-hunts' },
  { label: 'Slots',            href: '/slots' },
  { label: 'Stats',            href: '/stats' },
  { label: 'Shop',             href: '/shop' },
  { label: 'Leaderboard',      href: '/leaderboard' },
]

const SOCIALS = [
  { label: 'Twitch',    href: 'https://www.twitch.tv/jralha_',             icon: 'bxl-twitch' },
  { label: 'Discord',   href: 'https://discord.gg/bdweuwugYJ',             icon: 'bxl-discord' },
  { label: 'Instagram', href: 'https://www.instagram.com/jotaralha7/',     icon: 'bxl-instagram' },
  { label: 'Telegram',  href: 'https://t.me/+AvzWdiNpmDJkNjY0',           icon: 'bxl-telegram' },
]

export default function Footer() {
  const navigate = useNavigate()

  return (
    <footer className={styles.footer}>
      <div className={styles.top}>

        {/* Brand col */}
        <div className={styles.brandCol}>
          <img src="/assets/04.png" alt="RALHA" className={styles.logo} />
          <p className={styles.url}>jralha.com</p>
          <p className={styles.desc}>
            Casino streamer<br />
            twitch.tv/jralha_
          </p>
        </div>

        {/* Links col */}
        <nav className={styles.linksCol}>
          <div className={styles.linkGroup}>
            <h3 className={styles.groupTitle}>Quick Links</h3>
            <ul className={styles.linkList}>
              {QUICK_LINKS.map(l => (
                <li key={l.label}>
                  <a onClick={e => { e.preventDefault(); navigate(l.href) }} href={l.href}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.linkGroup}>
            <h3 className={styles.groupTitle}>Responsible Gaming</h3>
            <ul className={styles.linkList}>
              <li><a href="https://www.gamblingtherapy.org" target="_blank" rel="noopener">Gambling Therapy</a></li>
              <li><a href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware</a></li>
            </ul>
          </div>

          <div className={styles.linkGroup}>
            <h3 className={styles.groupTitle}>Legal</h3>
            <ul className={styles.linkList}>
              <li><a href="/terms" onClick={e => { e.preventDefault(); navigate('/terms') }}>Terms of Service</a></li>
              <li><a href="/privacy" onClick={e => { e.preventDefault(); navigate('/privacy') }}>Privacy Policy</a></li>
              <li><a href="/cookies" onClick={e => { e.preventDefault(); navigate('/cookies') }}>Cookie Policy</a></li>
            </ul>
          </div>
        </nav>
      </div>

      <div className={styles.divider} />

      <div className={styles.bottom}>
        {/* Socials */}
        <div className={styles.socialRow}>
          {SOCIALS.map(s => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener"
              className={styles.social}
              aria-label={s.label}
            >
              <i className={`bx ${s.icon}`} />
            </a>
          ))}
        </div>

        {/* Legal */}
        <div className={styles.legalRow}>
          <p className={styles.responsible}>
            +18 · Gambling can be addictive. Please play responsibly. ·{' '}
            <a href="https://www.begambleaware.org" target="_blank" rel="noopener">
              BeGambleAware.org
            </a>
          </p>
          <p className={styles.copy}>© 2026 RALHA. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}