import { Link, useLocation } from 'react-router-dom'
import { Icon } from './Icon'
import OriginalsBets from './OriginalsBets'
import { ORIGINALS } from '../pages/Originals'
import cards from '../pages/Originals.module.css'
import styles from './OriginalsBelow.module.css'

// Shown under every original game: the other games, then the live bets feed (same as the Originals page).
export default function OriginalsBelow() {
  const { pathname } = useLocation()
  const others = ORIGINALS.filter((o) => o.to !== pathname)
  return (
    <div className={styles.wrap}>
      <h2 className={styles.h}>More originals</h2>
      <div className={`${cards.grid} ${styles.g}`}>
        {others.map((o) => (
          <Link key={o.to} to={o.to} className={cards.card} style={{ '--g1': o.g1, '--g2': o.g2 }}>
            <span className={cards.art} aria-hidden="true"><Icon name={o.icon} size={44} /></span>
            <span className={cards.body}><b>{o.name}</b></span>
            <span className={cards.play}>Play<Icon name="right" size={14} /></span>
          </Link>
        ))}
      </div>
      <OriginalsBets />
    </div>
  )
}
