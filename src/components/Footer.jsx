import { useNavigate } from 'react-router-dom'
import { useTwitchStatus } from '../hooks/useTwitchStatus'
import styles from './Footer.module.css'

const I = ({ children }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)

const SOCIALS = [
  { key: 'twitch', label: 'Twitch', handle: 'jralha_', cta: 'Follow', href: 'https://www.twitch.tv/jralha_',
    icon: <I><path d="M4 3h17v11l-4 4h-4l-3 3v-3H4z" /><path d="M16 8v4M11 8v4" /></I> },
  { key: 'discord', label: 'Discord', handle: 'Community server', cta: 'Join', href: 'https://discord.gg/bdweuwugYJ',
    icon: <I><path d="M5 6c2-1.2 4-1.7 7-1.7S17 4.8 19 6c1.4 3 2.3 6.2 2.2 10-1.4 1.2-3 2-4.7 2.5l-1-1.7M5 6C3.6 9 2.7 12.2 2.8 16c1.4 1.2 3 2 4.7 2.5l1-1.7" /><circle cx="9" cy="12" r="1.3" /><circle cx="15" cy="12" r="1.3" /></I> },
  { key: 'instagram', label: 'Instagram', handle: '@jotaralha7', cta: 'Follow', href: 'https://www.instagram.com/jotaralha7/',
    icon: <I><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".6" fill="currentColor" /></I> },
  { key: 'telegram', label: 'Telegram', handle: 'Announcements', cta: 'Join', href: 'https://t.me/+AvzWdiNpmDJkNjY0',
    icon: <I><path d="M21 4L3 11l6 2 2 6 3-4 5 4z" /><path d="M9 13l12-9" /></I> },
]

const COLS = [
  { title: 'Explore', links: [
    ['Home', '/'], ['Casinos & Offers', '/offers'], ['Bonus Hunts', '/bonus-hunts'], ['Slots', '/slots'], ['Stats', '/stats'],
  ] },
  { title: 'Community', links: [
    ['Giveaways & Raffles', '/giveaways'], ['Shop', '/shop'], ['Leaderboard', '/leaderboard'], ['Mini-Games', '/mini-games'], ['Stream', '/stream'],
  ] },
  { title: 'Legal', links: [
    ['Terms of Service', '/terms'], ['Privacy Policy', '/privacy'], ['Cookie Policy', '/cookies'],
  ] },
]

export default function Footer() {
  const navigate = useNavigate()
  const live = useTwitchStatus()
  const go = (href) => (e) => { e.preventDefault(); navigate(href); window.scrollTo({ top: 0 }) }

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>

        <section className={styles.join} aria-label="Community">
          <div className={styles.joinHead}>
            <h2>Join the community</h2>
            <p>Follow the streams, giveaways and announcements.</p>
          </div>
          <div className={styles.socials}>
            {SOCIALS.map(s => (
              <a key={s.key} href={s.href} target="_blank" rel="noopener" className={`${styles.social} ${styles[s.key]}`}>
                <span className={styles.sIcon}>{s.icon}</span>
                <span className={styles.sText}><b>{s.label}</b><small>{s.handle}</small></span>
                <span className={styles.sCta}>{s.cta}</span>
              </a>
            ))}
          </div>
        </section>

        <div className={styles.top}>
          <div className={styles.brandCol}>
            <div className={styles.brandRow}>
              <img src="/assets/04.png" alt="RALHA" className={styles.logo} />
              <div>
                <p className={styles.url}>jralha.com</p>
                <p className={styles.desc}>Casino streamer</p>
              </div>
            </div>
            <a href="https://www.twitch.tv/jralha_" target="_blank" rel="noopener" className={`${styles.status} ${live ? styles.statusLive : ''}`}>
              <span className={styles.dot} />
              {live ? 'Live now on Twitch' : 'Offline · twitch.tv/jralha_'}
              {live && <span className={styles.watch}>Watch</span>}
            </a>
          </div>

          <nav className={styles.linksCol} aria-label="Footer">
            {COLS.map(c => (
              <div key={c.title} className={styles.linkGroup}>
                <h3 className={styles.groupTitle}>{c.title}</h3>
                <ul className={styles.linkList}>
                  {c.links.map(([label, href]) => (
                    <li key={label}><a href={href} onClick={go(href)}>{label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <section className={styles.rg} aria-label="Responsible gaming">
          <span className={styles.age}>18+</span>
          <p>Gambling can be addictive. Please play responsibly and only with money you can afford to lose.</p>
          <div className={styles.rgLinks}>
            <a href="https://www.gamblingtherapy.org" target="_blank" rel="noopener">Gambling Therapy</a>
            <a href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware</a>
          </div>
        </section>

        <div className={styles.bottom}>
          <p className={styles.copy}>© 2026 RALHA. All rights reserved.</p>
          <button type="button" className={styles.toTop} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Back to top
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
          </button>
        </div>
      </div>
    </footer>
  )
}
