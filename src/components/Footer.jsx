import { useNavigate } from 'react-router-dom'
import { useTwitchStatus } from '../hooks/useTwitchStatus'
import styles from './Footer.module.css'

const COLS = [
  { title: 'Explore', links: [
    ['Home', '/'], ['Casinos & Offers', '/offers'], ['Bonus Hunts', '/bonus-hunts'], ['Slots', '/slots'], ['Stats', '/stats'],
  ] },
  { title: 'Community', links: [
    ['Giveaways & Raffles', '/giveaways'], ['Shop', '/shop'], ['Leaderboard', '/leaderboard'], ['Mini-Games', '/mini-games'], ['Stream', '/stream'],
  ] },
  { title: 'Legal', links: [
    ['Terms of Service', '/terms'], ['Privacy Policy', '/privacy'], ['Cookie Policy', '/cookies'], ['Site Rules', '/rules'],
  ] },
]

export default function Footer() {
  const navigate = useNavigate()
  const live = useTwitchStatus()
  // html and body both scroll (height:100% + overflow-x:hidden), so reset every candidate
  const toTop = (smooth) => {
    const opt = { top: 0, behavior: smooth ? 'smooth' : 'auto' }
    window.scrollTo(opt)
    document.documentElement.scrollTo?.(opt)
    document.body.scrollTo?.(opt)
  }
  const go = (href) => (e) => { e.preventDefault(); navigate(href); toTop(false) }

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>

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
          <button type="button" className={styles.toTop} onClick={() => toTop(true)}>
            Back to top
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
          </button>
        </div>
      </div>
    </footer>
  )
}
