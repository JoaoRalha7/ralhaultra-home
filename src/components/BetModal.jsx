import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import s from './BetModal.module.css'

const NAMES = { mines: 'Mines', blackjack: 'Blackjack', keno: 'Keno', plinko: 'Plinko', roulette: 'Roulette', crash: 'Crash' }
const ART = { mines: ['#0e7490', '#164e63'], blackjack: ['#6d28d9', '#312e81'], keno: ['#7e22ce', '#3b0764'], plinko: ['#2563eb', '#1e3a8a'], roulette: ['#b91c1c', '#450a0a'], crash: ['#ea580c', '#7c2d12'] }
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUIT = ['♠', '♥', '♦', '♣']
const fmt = (n) => Number(n ?? 0).toLocaleString('en-GB')

const Coin = () => <i className={s.coin} />
const Gem = ({ lit }) => (
  <svg viewBox="0 0 24 24" className={lit ? s.gemLit : s.gemDim} aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z" fill="currentColor" /><path d="M2 9h20M9 3l-2 6 5 12 5-12-2-6" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1" /></svg>
)
const Bomb = ({ hit }) => (
  <svg viewBox="0 0 24 24" className={hit ? s.bombHit : s.bomb} aria-hidden="true"><circle cx="11" cy="14" r="7" fill="currentColor" /><path d="M16 8l3-3M18 3v3M21 6h-3" stroke="#fbbf24" strokeWidth="1.6" strokeLinecap="round" fill="none" /></svg>
)

function MinesBoard({ r }) {
  const mines = r.minePositions || []
  const rev = r.revealed || []
  return (
    <div className={s.grid5}>
      {Array.from({ length: 25 }, (_, i) => {
        const isM = mines.includes(i), isR = rev.includes(i)
        return <div key={i} className={`${s.cell} ${isR ? s.cellLit : ''} ${r.hit === i ? s.cellBoom : ''}`}>{isM ? <Bomb hit={r.hit === i} /> : <Gem lit={isR} />}</div>
      })}
    </div>
  )
}

function KenoBoard({ r }) {
  const picks = r.picks || [], draw = r.draw || []
  return (
    <div className={s.grid8}>
      {Array.from({ length: 40 }, (_, i) => {
        const n = i + 1, p = picks.includes(n), d = draw.includes(n)
        return <div key={n} className={`${s.kcell} ${p && d ? s.kHit : p ? s.kPick : d ? s.kDraw : ''}`}>{n}</div>
      })}
    </div>
  )
}

const Card = ({ c }) => {
  const red = Math.floor((c % 52) / 13) === 1 || Math.floor((c % 52) / 13) === 2
  return <div className={`${s.card} ${red ? s.cardRed : ''}`}><b>{RANKS[c % 13]}</b><span>{SUIT[Math.floor((c % 52) / 13)]}</span></div>
}
function BlackjackBoard({ r }) {
  return (
    <div className={s.bj}>
      <div className={s.bjRow}>
        <div className={s.cards}>{(r.dealer || []).map((c, i) => <Card key={i} c={c} />)}</div>
        <span className={s.badge}>{r.dealerTotal}</span>
      </div>
      <div className={s.bjHands}>
        {(r.hands || []).map((h, i) => (
          <div key={i} className={s.bjRow}>
            <div className={s.cards}>{h.cards.map((c, j) => <Card key={j} c={c} />)}</div>
            <span className={`${s.badge} ${h.result === 'win' || h.result === 'blackjack' ? s.badgeWin : h.result === 'push' ? s.badgePush : s.badgeLose}`}>{h.total}<em>{(h.result || '').toUpperCase()}</em></span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlinkoBoard({ r }) {
  const rows = r.rows || 0
  let x = 0
  const pts = [[0, 0]]
  ;(r.path || []).forEach((d, i) => { x += d ? 0.5 : -0.5; pts.push([x, i + 1]) })
  const W = 300, H = 200, sx = W / (rows + 2), sy = H / (rows + 1)
  return (
    <div className={s.plinko}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden="true">
        {Array.from({ length: rows }, (_, row) => Array.from({ length: row + 1 }, (_, k) => <circle key={row + '-' + k} cx={W / 2 + (k - row / 2) * sx} cy={(row + 0.5) * sy} r="2.2" fill="rgba(255,255,255,.25)" />))}
        <polyline fill="none" stroke="#34d399" strokeWidth="2.4" strokeLinejoin="round" points={pts.map(([px, py]) => `${W / 2 + px * sx},${py * sy - sy / 2}`).join(' ')} />
      </svg>
      <p>{rows} rows &middot; {r.risk} risk &middot; slot {r.slot + 1}</p>
    </div>
  )
}

function RouletteBoard({ r }) {
  return (
    <div className={s.roul}>
      <div className={`${s.rnum} ${s['r_' + r.color]}`}>{r.number}</div>
      <div className={s.rbets}>{(r.bets || []).map((b, i) => <span key={i}>{b.type}{b.value != null ? ' ' + b.value : ''} <b>{fmt(b.amount)}</b></span>)}</div>
    </div>
  )
}

function CrashBoard({ r }) {
  return (
    <div className={s.roul}>
      <div className={s.rnum}>{(r.crashAt || 0).toFixed(2)}x</div>
      <div className={s.rbets}><span>{r.cashedAt ? <>Cashed out at <b>{r.cashedAt.toFixed(2)}x</b></> : 'Crashed before cash out'}</span></div>
    </div>
  )
}

const BOARD = { mines: MinesBoard, keno: KenoBoard, blackjack: BlackjackBoard, plinko: PlinkoBoard, roulette: RouletteBoard, crash: CrashBoard }

export default function BetModal({ item, onClose }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [onClose])
  const r = item.round
  const game = item.game || r.game
  const Board = BOARD[game]
  const [c1, c2] = ART[game] || ART.mines
  const mult = r.bet > 0 ? r.payout / r.bet : 0
  const when = item.at ? new Date(item.at).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null
  return createPortal(
    <div className={s.back} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true" aria-label="Bet details">
      <div className={s.modal}>
        <div className={s.head}>
          <span className={s.hTitle}>Bet</span>
          <button type="button" className={s.x} onClick={onClose} aria-label="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        <div className={s.hero}>
          <div className={s.art} style={{ background: `linear-gradient(160deg, ${c1}, ${c2})` }}><b>{NAMES[game]}</b></div>
          <div className={s.meta}>
            <div className={s.mName}>{NAMES[game]} <span className={s.id}>#{String(r.id).replace(/-/g, '').slice(0, 8)}</span></div>
            {item.by && <div className={s.mBy}>Placed by <b>{item.by}</b></div>}
            {when && <div className={s.mBy}>on {when}</div>}
            <Link to={`/${game}`} className={s.play} onClick={onClose}>&#9654; Play {NAMES[game]}</Link>
          </div>
        </div>
        <div className={s.stats}>
          <div><span><Coin /> {fmt(r.bet)}</span><small>Bet</small></div>
          <div><span>{mult.toFixed(2)}&times;</span><small>Multiplier</small></div>
          <div><span className={r.payout > r.bet ? s.win : ''}><Coin /> {fmt(r.payout)}</span><small>Payout</small></div>
        </div>
        {Board && <div className={s.board}><Board r={r} /></div>}
        {r.fair && (
          <details className={s.fair}>
            <summary>Fairness</summary>
            <dl><dt>Server hash</dt><dd>{r.fair.hash}</dd><dt>Client seed</dt><dd>{r.fair.client}</dd><dt>Nonce</dt><dd>{r.fair.nonce}</dd></dl>
          </details>
        )}
      </div>
    </div>,
    document.body,
  )
}
