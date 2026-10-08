import { BRAND_PATHS } from '../data/brandPaths'
import { COMMUNITY } from '../data/community'
import styles from './Community.module.css'

const CTA = { twitch: 'Watch live', kick: 'Watch live', instagram: 'Follow', discord: 'Join server', telegram: 'Join channel' }

export default function Community() {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>Community</h1>
        <p>Follow Ralha everywhere and join the community.</p>
      </header>
      <div className={styles.grid}>
        {COMMUNITY.map((c) => (
          <a key={c.id} className={`${styles.card} ${styles[c.brand]} ${c.id === 4 ? styles.clips : ''}`} href={c.url} target="_blank" rel="noopener noreferrer" aria-label={`${c.name} ${c.meta}`}>
            <svg className={styles.mark} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={BRAND_PATHS[c.brand]} /></svg>
            <svg className={styles.logo} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={BRAND_PATHS[c.brand]} /></svg>
            <div className={styles.info}>
              <b>{c.name}</b>
              <small>{c.meta}</small>
            </div>
            <span className={styles.cta}>
              {CTA[c.brand] || 'Open'}
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
