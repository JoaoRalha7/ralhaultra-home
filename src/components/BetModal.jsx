import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import s from './BetModal.module.css'

const NAMES = { mines: 'Mines', blackjack: 'Blackjack', keno: 'Keno', plinko: 'Plinko', roulette: 'Roulette', crash: 'Crash' }
// same icon and colours as the Originals page
const ART = { mines: ['mines', '#10b981', '#6ee7b7'], blackjack: ['cards', '#f5c542', '#fde68a'], crash: ['crash', '#8b5cf6', '#c4b5fd'], keno: ['keno', '#ec4899', '#f9a8d4'], plinko: ['plinko', '#06b6d4', '#67e8f9'], roulette: ['roulette', '#e11d48', '#fda4af'], jackpot: ['jackpot', '#f97316', '#fdba74'] }
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

const RISKS = [['classic', 'Classic'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]
const Emerald = ({ n }) => (
  <svg viewBox="0 0 40 40" className={s.emerald} aria-hidden="true">
    <path d="M12 3h16l9 9v16l-9 9H12l-9-9V12z" fill="#22c55e" stroke="#86efac" strokeWidth="1.5" />
    <path d="M14 8h12l6 6v12l-6 6H14l-6-6V14z" fill="#16a34a" opacity=".85" />
    <text x="20" y="25.5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#04210f">{n}</text>
  </svg>
)
function KenoBoard({ r }) {
  const picks = r.picks || [], draw = r.draw || []
  return (
    <div className={s.keno}>
      <div className={s.grid8}>
        {Array.from({ length: 40 }, (_, i) => {
          const n = i + 1, p = picks.includes(n), d = draw.includes(n)
          if (p && d) return <div key={n} className={`${s.kcell} ${s.kHit}`}><Emerald n={n} /></div>
          return <div key={n} className={`${s.kcell} ${d ? s.kDraw : p ? s.kPick : ''}`}>{n}</div>
        })}
      </div>
      <div className={s.risks}>{RISKS.map(([k, l]) => <span key={k} className={(r.risk || 'classic') === k ? s.riskOn : ''}>{l}</span>)}</div>
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

const fmtX = (x) => (x >= 100 ? Math.round(x) : x >= 10 ? x.toFixed(1) : x.toFixed(2).replace(/\.?0+$/, ''))
function PlinkoBoard({ r }) {
  const balls = r.balls && r.balls.length ? r.balls : [{ mult: r.mult, slot: r.slot }]
  return (
    <div className={s.plk}>
      <div className={s.plkChips}>
        {balls.map((b, i) => <span key={i} className={`${s.plkChip} ${b.mult < 1 ? s.plkLow : b.mult >= 10 ? s.plkTop : ''}`}>{fmtX(b.mult)}</span>)}
      </div>
      <div className={s.risks3}>{['low', 'medium', 'high'].map((k) => <span key={k} className={r.risk === k ? s.riskOn : ''}>{k[0].toUpperCase() + k.slice(1)}</span>)}</div>
      <div className={s.plkRows}><small>Row Count</small><div>{r.rows}</div></div>
    </div>
  )
}

const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
const PAY = { straight: 36, red: 2, black: 2, odd: 2, even: 2, low: 2, high: 2, dozen: 3, column: 3 }
const BET_LABEL = { red: 'Red', black: 'Black', odd: 'Odd', even: 'Even', low: '1-18', high: '19-36' }
const colorOf = (n) => (n === 0 ? 'green' : REDS.includes(n) ? 'red' : 'black')
function betMult(b, n) {
  const { type, value } = b
  if (type === 'multi') { const nums = String(value).split('-').map(Number); return nums.includes(n) ? 36 / nums.length : 0 }
  let win = false
  if (type === 'straight') win = n === Number(value)
  else if (n === 0) win = false
  else if (type === 'red') win = colorOf(n) === 'red'
  else if (type === 'black') win = colorOf(n) === 'black'
  else if (type === 'odd') win = n % 2 === 1
  else if (type === 'even') win = n % 2 === 0
  else if (type === 'low') win = n <= 18
  else if (type === 'high') win = n >= 19
  else if (type === 'dozen') win = Math.ceil(n / 12) === Number(value)
  else if (type === 'column') win = (n % 3 === 0 ? 3 : n % 3) === Number(value)
  return win ? PAY[type] || 0 : 0
}
const betName = (b) => (b.type === 'straight' ? `Number ${b.value}` : b.type === 'dozen' ? `Dozen ${b.value}` : b.type === 'column' ? `Column ${b.value}` : b.type === 'multi' ? `Split ${String(b.value).replace(/-/g, '/')}` : BET_LABEL[b.type] || b.type)
function RouletteBoard({ r }) {
  const bets = r.bets || []
  const straight = {}
  bets.forEach((b) => { if (b.type === 'straight') straight[b.value] = (straight[b.value] || 0) + b.amount })
  const cell = (n) => (
    <div key={n} className={`${s.rc} ${s['rc_' + colorOf(n)]} ${n === r.number ? s.rcWin : ''}`}>
      {n}
      {straight[n] ? <i className={s.rchip}>{fmt(straight[n])}</i> : null}
    </div>
  )
  const rows = [0, 1, 2].map((row) => Array.from({ length: 12 }, (_, c) => c * 3 + (3 - row)))
  return (
    <div className={s.roul}>
      <div className={s.rtable}>
        <div className={`${s.rzero} ${r.number === 0 ? s.rcWin : ''}`}>0{straight[0] ? <i className={s.rchip}>{fmt(straight[0])}</i> : null}</div>
        <div className={s.rnums}>{rows.map((row) => row.map(cell))}</div>
      </div>
      <div className={s.rres}><span className={`${s.rbig} ${s['rc_' + colorOf(r.number)]}`}>{r.number}</span><span>{colorOf(r.number)}</span></div>
      <div className={s.rbets}>
        {bets.map((b, i) => {
          const m = betMult(b, r.number)
          return <span key={i} className={m > 0 ? s.rbWin : ''}>{betName(b)} <b>{fmt(b.amount)}</b>{m > 0 ? <em>+{fmt(Math.floor(b.amount * m) - b.amount)}</em> : null}</span>
        })}
      </div>
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
  const [icon, c1, c2] = ART[game] || ART.mines
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
          <div className={s.art} style={{ '--c1': c1, '--c2': c2 }}><span className={s.artIco}><Icon name={icon} size={52} /></span><b>{NAMES[game]}</b></div>
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
