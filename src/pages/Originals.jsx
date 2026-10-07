import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import styles from './Originals.module.css'

export const ORIGINALS = [
  { to: '/mines', icon: 'mines', name: 'Mines', tag: 'Reveal gems, dodge the mines and cash out in time.', stats: ['1 to 24 mines', 'Up to 24x+'], g1: '#10b981', g2: '#6ee7b7' },
  { to: '/blackjack', icon: 'cards', name: 'Blackjack', tag: 'Beat the dealer. Split, double and two side bets.', stats: ['Pays 3:2', 'Split and double'], g1: '#f5c542', g2: '#fde68a' },
  { to: '/crash', icon: 'crash', name: 'Crash', tag: 'Live rounds shared with everyone. Bet, climb and cash out before it crashes.', stats: ['Live rounds', 'Up to 1000x'], g1: '#8b5cf6', g2: '#c4b5fd' },
  { to: '/keno', icon: 'keno', name: 'Keno', tag: 'Pick up to 10 numbers and match the draw.', stats: ['4 risk levels', 'Auto and turbo'], g1: '#ec4899', g2: '#f9a8d4' },
  { to: '/plinko', icon: 'plinko', name: 'Plinko', tag: 'Drop the ball through the pegs into a multiplier.', stats: ['8 to 16 rows', 'Auto and turbo'], g1: '#06b6d4', g2: '#67e8f9' },
  { to: '/roulette', icon: 'roulette', name: 'Roulette', tag: 'European wheel with a single zero and multi-chip bets.', stats: ['Return 97.3%', 'Auto spin'], g1: '#e11d48', g2: '#fda4af' },
]

export default function Originals() {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>Originals</h1>
        <p>Pick a game and play with your points. Every round is decided on the server.</p>
      </header>
      <div className={styles.grid}>
        {ORIGINALS.map((o) => (
          <Link key={o.to} to={o.to} className={styles.card} style={{ '--g1': o.g1, '--g2': o.g2 }}>
            <span className={styles.art} aria-hidden="true"><Icon name={o.icon} size={44} /></span>
            <span className={styles.body}>
              <b>{o.name}</b>
              <small>{o.tag}</small>
              <span className={styles.stats}>{o.stats.map((s) => <i key={s}>{s}</i>)}</span>
            </span>
            <span className={styles.play}>Play<Icon name="right" size={14} /></span>
          </Link>
        ))}
      </div>
    </div>
  )
}
