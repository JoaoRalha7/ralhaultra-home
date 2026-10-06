import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useStreamElementsPoints } from '../hooks/useStreamElementsPoints'
import { supabaseDash } from '../lib/supabase'
import styles from './Blackjack.module.css'

const SE_WORKER_URL = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'
const MIN_BET      = 50
const MAX_BET      = 5000
const SIDE_BET_MAX = 500

// ── Card helpers ───────────────────────────────────────────────────────────────
const SUITS = ['♠','♥','♦','♣']
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
const RED   = new Set(['♥','♦'])

function uid() { return Math.random().toString(36).slice(2) }
function createDeck() {
  const base = []
  for (const suit of SUITS)
    for (const rank of RANKS)
      base.push({ suit, rank })
  const six = []
  for (let i = 0; i < 6; i++) six.push(...base.map(c => ({ ...c, id: uid() })))
  return six
}
function shuffle(d) {
  const a = [...d]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function cardValue(rank) {
  if (['J','Q','K'].includes(rank)) return 10
  if (rank === 'A') return 11
  return parseInt(rank)
}
function handTotal(hand) {
  let t = 0, aces = 0
  for (const c of hand) { t += cardValue(c.rank); if (c.rank === 'A') aces++ }
  while (t > 21 && aces > 0) { t -= 10; aces-- }
  return t
}
function isBJ(hand)     { return hand.length === 2 && handTotal(hand) === 21 }
function isBust(hand)   { return handTotal(hand) > 21 }
function canSplit(hand) { return hand.length === 2 && cardValue(hand[0].rank) === cardValue(hand[1].rank) }

// ── Payout calc ────────────────────────────────────────────────────────────────
// Bet deducted upfront. Payout = what comes back (0 = nothing, bet = push, bet*2 = win, etc.)
function calcPayout(result, bet) {
  switch (result) {
    case 'blackjack': return bet + Math.floor(bet * 1.5)
    case 'win':       return bet * 2
    case 'push':      return bet
    default:          return 0
  }
}

// ── Side bet logic ─────────────────────────────────────────────────────────────
// Perfect Pairs — uses player's first 2 cards
function evalPerfectPairs(c1, c2) {
  if (c1.rank !== c2.rank) return null  // no pair
  if (c1.suit === c2.suit) return { name: 'Perfect Pair', mult: 25 }
  const bothRed = RED.has(c1.suit) && RED.has(c2.suit)
  const bothBlk = !RED.has(c1.suit) && !RED.has(c2.suit)
  if (bothRed || bothBlk) return { name: 'Coloured Pair', mult: 12 }
  return { name: 'Mixed Pair', mult: 6 }
}

// 21+3 — player's 2 cards + dealer upcard (3 cards poker)
function eval21Plus3(p1, p2, d1) {
  const cards = [p1, p2, d1]
  const ranks  = cards.map(c => c.rank).sort()
  const suits  = cards.map(c => c.suit)
  const vals   = cards.map(c => cardValue(c.rank)).sort((a,b) => a-b)

  const flush     = suits.every(s => s === suits[0])
  const straight  = (vals[2] - vals[0] === 2 && vals[1] - vals[0] === 1) ||
                    (ranks.join(',') === 'A,J,Q' || ranks.join(',') === 'A,K,Q' ||
                     ranks.join(',') === 'A,J,K')  // broadway
  const threeKind = ranks[0] === ranks[1] && ranks[1] === ranks[2]
  const suitedTK  = threeKind && flush

  if (suitedTK)        return { name: 'Suited Three of a Kind', mult: 100 }
  if (straight && flush) return { name: 'Straight Flush', mult: 40 }
  if (threeKind)       return { name: 'Three of a Kind', mult: 30 }
  if (straight)        return { name: 'Straight', mult: 10 }
  if (flush)           return { name: 'Flush', mult: 5 }
  return null
}

// Insurance pays 2:1 if dealer has BJ
function calcInsurancePayout(dealerHand, insAmt) {
  if (isBJ(dealerHand)) return insAmt * 3  // back the ins bet + 2:1 profit
  return 0  // lose the insurance bet
}

// ── SE points helper ──────────────────────────────────────────────────────────
async function seUpdate(username, amount, secret) {
  const res = await fetch(`${SE_WORKER_URL}/points/update`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
    body: JSON.stringify({ username: username.toLowerCase(), amount })
  })
  if (!res.ok) throw new Error('SE error')
  return res.json()
}

// ── Playing card component ────────────────────────────────────────────────────
// Each card tracks its own "dealt" state via a dealIndex passed from outside.
// When dealIndex changes, the card slides in from the deck position.
function PlayingCard({ card, hidden = false, small = false, dealIdx = 0, deckOrigin }) {
  const [visible, setVisible]   = useState(false)
  const [revealed, setRevealed] = useState(!hidden)
  const prevHidden = useRef(hidden)

  // Slide in: staggered by dealIdx (0=first, 1=second, etc.)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), dealIdx * 160 + 30)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line

  // Flip hole card when hidden→false
  useEffect(() => {
    if (prevHidden.current && !hidden) {
      setTimeout(() => setRevealed(true), 60)
    }
    prevHidden.current = hidden
  }, [hidden])

  const w = small ? 56 : 72
  const h = small ? 80 : 104
  const red = card && RED.has(card.suit)

  return (
    <div
      className={`${styles.cardOuter} ${visible ? styles.cardVisible : ''}`}
      style={{ width: w, height: h }}
    >
      <div className={`${styles.cardInner} ${!revealed ? styles.cardShowBack : ''}`}>
        {/* FRONT */}
        <div className={`${styles.face} ${styles.front} ${red ? styles.cardRed : styles.cardBlack}`}>
          {card && (
            <>
              <div className={styles.corner}>
                <span className={styles.cornerRank}>{card.rank}</span>
                <span className={styles.cornerSuit}>{card.suit}</span>
              </div>
              <span className={styles.centerSuit}>{card.suit}</span>
              <div className={`${styles.corner} ${styles.cornerBtm}`}>
                <span className={styles.cornerRank}>{card.rank}</span>
                <span className={styles.cornerSuit}>{card.suit}</span>
              </div>
            </>
          )}
        </div>
        {/* BACK */}
        <div className={`${styles.face} ${styles.back}`}>
          <div className={styles.backInner}>
            <div className={styles.backGrid} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Hand({ cards, hideSecond = false, label, total, bust, bj, small = false, glow = false, startIdx = 0 }) {
  return (
    <div className={`${styles.handWrap} ${glow ? styles.handGlow : ''}`}>
      {label && (
        <div className={styles.handLabel}>
          <span className={styles.handName}>{label}</span>
          {bj   && <span className={styles.tagBj}>BLACKJACK</span>}
          {bust  && <span className={styles.tagBust}>BUST</span>}
          {!bj && !bust && total != null && <span className={styles.handTotal}>{total}</span>}
        </div>
      )}
      <div className={styles.cardRow}>
        {cards.map((c, i) => (
          <PlayingCard
            key={c.id}
            card={c}
            hidden={hideSecond && i === 1}
            small={small}
            dealIdx={startIdx + i}
          />
        ))}
      </div>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null
  return <div className={`${styles.toast} ${styles['toast' + type]}`}>{msg}</div>
}

function HexCoin({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="#facc15"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
}

// ── Side bet display ──────────────────────────────────────────────────────────
function SideBetInput({ label, sub, value, onChange, max, color }) {
  return (
    <div className={styles.sideBetItem}>
      <div className={styles.sideBetInfo}>
        <span className={styles.sideBetLabel} style={{ color }}>{label}</span>
        <span className={styles.sideBetSub}>{sub}</span>
      </div>
      <div className={styles.sideBetRow}>
        <HexCoin size={11}/>
        <input
          className={styles.sideBetInput}
          type="number" min={0} max={max}
          placeholder="0"
          value={value || ''}
          onChange={e => onChange(Math.min(max, Math.max(0, parseInt(e.target.value) || 0)))}
        />
      </div>
    </div>
  )
}

function SideBetResult({ label, result, color }) {
  if (!result) return null
  const won = result.payout > 0
  return (
    <div className={`${styles.sideBetResultItem} ${won ? styles.sideBetWon : styles.sideBetLost}`}>
      <span style={{ color }}>{label}</span>
      <span>{result.name || (won ? 'WIN' : 'LOSS')}</span>
      <span>{won ? `+${(result.payout - result.bet).toLocaleString('en-GB')}` : `-${result.bet.toLocaleString('en-GB')}`}</span>
    </div>
  )
}

// ── Insurance modal ────────────────────────────────────────────────────────────
function InsurancePrompt({ maxIns, onTake, onDecline, loading }) {
  return (
    <div className={styles.insBackdrop}>
      <div className={styles.insBox}>
        <div className={styles.insTitle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Dealer shows an Ace
        </div>
        <p className={styles.insSub}>Take insurance? Pays 2:1 if dealer has Blackjack.</p>
        <div className={styles.insMaxLabel}>Max: {maxIns.toLocaleString('en-GB')} pts (half your bet)</div>
        <div className={styles.insBtns}>
          <button className={styles.insBtnTake} onClick={onTake} disabled={loading}>
            {loading ? '…' : `Take Insurance`}
          </button>
          <button className={styles.insBtnDecline} onClick={onDecline} disabled={loading}>
            No Thanks
          </button>
        </div>
      </div>
    </div>
  )
}

// ── History & Leaderboard ──────────────────────────────────────────────────────
function HistoryRow({ row, me }) {
  const isMe = row.twitch_username?.toLowerCase() === me?.toLowerCase()
  const net  = row.payout - row.bet
  const won  = row.result === 'win' || row.result === 'blackjack'
  const push = row.result === 'push'
  return (
    <div className={`${styles.histRow} ${isMe ? styles.histRowMe : ''}`}>
      <div className={styles.histUser}>{row.twitch_username}</div>
      <div className={styles.histBet}><HexCoin size={11}/>{row.bet.toLocaleString('en-GB')}</div>
      <div className={`${styles.histResult} ${won ? styles.clrWin : push ? styles.clrPush : styles.clrLoss}`}>
        {row.result === 'blackjack' ? 'BJ' : row.result.toUpperCase()}
      </div>
      <div className={`${styles.histDelta} ${net > 0 ? styles.clrWin : net < 0 ? styles.clrLoss : styles.clrPush}`}>
        {net > 0 ? '+' : ''}{net.toLocaleString('en-GB')}
      </div>
    </div>
  )
}

function Leaderboard({ data }) {
  if (!data.length) return <div className={styles.lbEmpty}>No games yet. Be the first!</div>
  return (
    <div className={styles.lbList}>
      {data.map((row, i) => (
        <div key={row.twitch_username} className={styles.lbRow}>
          <div className={`${styles.lbRank} ${styles['lbRank' + Math.min(i,2)]}`}>#{i+1}</div>
          <div className={styles.lbUser}>{row.twitch_username}</div>
          <div className={styles.lbStat}><span className={styles.lbStatLabel}>W/L</span>{row.wins}/{row.losses}</div>
          <div className={styles.lbStat}><span className={styles.lbStatLabel}>Games</span>{row.games}</div>
          <div className={`${styles.lbNet} ${row.net >= 0 ? styles.clrWin : styles.clrLoss}`}>
            {row.net >= 0 ? '+' : ''}{row.net.toLocaleString('en-GB')} pts
          </div>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const PHASES = { IDLE:'idle', INSURANCE:'insurance', PLAYING:'playing', DEALER:'dealer', RESULT:'result' }

export default function Blackjack() {
  const { user, profile } = useAuth()
  const twitchUser = profile?.twitch_username || user?.user_metadata?.name || null
  const { points, setPoints, loading: pointsLoading, refresh: refreshPoints } = useStreamElementsPoints(twitchUser)
  const secret = import.meta.env.VITE_WORKER_SECRET

  // ── Game state ──
  const [phase,      setPhase]      = useState(PHASES.IDLE)
  const [deck,       setDeck]       = useState([])
  const [dealer,     setDealer]     = useState([])
  const [hands,      setHands]      = useState([[]])
  const [activeHand, setActiveHand] = useState(0)
  const [bets,       setBets]       = useState([])
  const [results,    setResults]    = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [doubled,    setDoubled]    = useState([])
  const [splitCount, setSplitCount] = useState(0)

  // ── Bet inputs ──
  const [betInput,  setBetInput]  = useState('200')
  const [ppBet,     setPpBet]     = useState(0)    // Perfect Pairs
  const [t3Bet,     setT3Bet]     = useState(0)    // 21+3
  const [insBet,    setInsBet]    = useState(0)    // Insurance (set during game)
  const [insLoading,setInsLoading]= useState(false)

  // ── Side bet results ──
  const [ppResult,  setPpResult]  = useState(null)
  const [t3Result,  setT3Result]  = useState(null)
  const [insResult, setInsResult] = useState(null)

  // ── UI ──
  const [tab,     setTab]     = useState('game')
  const [history, setHistory] = useState([])
  const [lbData,  setLbData]  = useState([])
  const [toast,   setToast]   = useState(null)
  const toastTimer = useRef(null)

  const showToast = useCallback((msg, type = 'info') => {
    clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  const loadHistory = useCallback(async () => {
    const { data } = await supabaseDash
      .from('blackjack_games').select('twitch_username,bet,result,payout,created_at')
      .order('created_at', { ascending: false }).limit(60)
    if (data) setHistory(data)
  }, [])

  const loadLeaderboard = useCallback(async () => {
    const { data } = await supabaseDash
      .from('blackjack_games').select('twitch_username,bet,result,payout')
    if (!data) return
    const map = {}
    for (const r of data) {
      if (!map[r.twitch_username])
        map[r.twitch_username] = { twitch_username: r.twitch_username, wins: 0, losses: 0, games: 0, net: 0 }
      const m = map[r.twitch_username]
      m.games++
      const won = r.result === 'win' || r.result === 'blackjack'
      if (won) m.wins++; else if (r.result !== 'push') m.losses++
      m.net += (r.payout - r.bet)
    }
    setLbData(Object.values(map).sort((a,b) => b.net - a.net))
  }, [])

  useEffect(() => { loadHistory(); loadLeaderboard() }, [loadHistory, loadLeaderboard])

  const drawCard = useCallback((dk) => {
    const nd = [...dk]; return { card: nd.pop(), newDeck: nd }
  }, [])

  const awardPoints = useCallback(async (amount) => {
    if (!amount || amount <= 0 || !twitchUser) return
    try {
      const d = await seUpdate(twitchUser, amount, secret)
      if (d.newPoints != null) setPoints(d.newPoints)
      else setPoints(p => (p ?? 0) + amount)
    } catch { /* silent */ }
  }, [twitchUser, secret, setPoints])

  const saveGame = useCallback(async (bet, result, payout) => {
    await supabaseDash.from('blackjack_games').insert({
      twitch_username: twitchUser, bet, result, payout, created_at: new Date().toISOString()
    })
  }, [twitchUser])

  // ── Dealer play ──
  const playDealer = useCallback(async (dealerHand, currentDeck) => {
    let d = [...dealerHand], dk = [...currentDeck]
    setDealer([...d])             // reveal hole card
    await new Promise(r => setTimeout(r, 600))
    while (handTotal(d) < 17) {
      const { card, newDeck } = drawCard(dk)
      d = [...d, card]; dk = newDeck
      setDealer([...d])
      await new Promise(r => setTimeout(r, 500))
    }
    return { finalDealer: d }
  }, [drawCard])

  // ── Resolve side bets ──
  const resolveSideBets = useCallback(async (playerHand, dealerHand, pp, t3, ins) => {
    const results = {}

    if (pp > 0) {
      const hit = evalPerfectPairs(playerHand[0], playerHand[1])
      const payout = hit ? pp + pp * hit.mult : 0
      results.pp = { name: hit?.name || null, bet: pp, payout }
      await awardPoints(payout)
    }
    if (t3 > 0) {
      const hit = eval21Plus3(playerHand[0], playerHand[1], dealerHand[0])
      const payout = hit ? t3 + t3 * hit.mult : 0
      results.t3 = { name: hit?.name || null, bet: t3, payout }
      await awardPoints(payout)
    }
    if (ins > 0) {
      const payout = calcInsurancePayout(dealerHand, ins)
      results.ins = { name: isBJ(dealerHand) ? 'Dealer Blackjack' : null, bet: ins, payout }
      await awardPoints(payout)
    }

    if (results.pp) setPpResult(results.pp)
    if (results.t3) setT3Result(results.t3)
    if (results.ins) setInsResult(results.ins)
    return results
  }, [awardPoints])

  // ── Full resolve ──
  const resolveGame = useCallback(async (handsArr, betsArr, dealerHand, currentDeck, ppAmt, t3Amt, insAmt) => {
    setPhase(PHASES.DEALER)
    const { finalDealer } = await playDealer(dealerHand, currentDeck)

    // Resolve side bets first (uses final dealer hand for insurance)
    await resolveSideBets(handsArr[0], finalDealer, ppAmt, t3Amt, insAmt)

    const dealerTotal = handTotal(finalDealer)
    const dealerBJ    = isBJ(finalDealer)
    const handResults = []

    for (let i = 0; i < handsArr.length; i++) {
      const h = handsArr[i], b = betsArr[i]
      const ht     = handTotal(h)
      const hBJ    = isBJ(h) && handsArr.length === 1
      const hBust  = isBust(h)
      let result

      if      (hBust)                            result = 'bust'
      else if (hBJ && !dealerBJ)                 result = 'blackjack'
      else if (hBJ && dealerBJ)                  result = 'push'
      else if (isBust(finalDealer) || ht > dealerTotal) result = 'win'
      else if (ht === dealerTotal)               result = 'push'
      else                                       result = 'loss'

      const payout = calcPayout(result, b)
      handResults.push({ result, payout, bet: b })
      await saveGame(b, result, payout)
      await awardPoints(payout)
    }

    setResults(handResults)
    setPhase(PHASES.RESULT)

    const allWon  = handResults.every(r => r.result === 'win' || r.result === 'blackjack')
    const allPush = handResults.every(r => r.result === 'push')
    const allLost = handResults.every(r => r.result === 'loss' || r.result === 'bust')

    if      (allWon && handResults[0]?.result === 'blackjack')
      showToast('🃏 BLACKJACK! +' + Math.floor(betsArr[0] * 1.5).toLocaleString('en-GB') + ' pts', 'success')
    else if (allWon)
      showToast('✅ Win! +' + handResults.reduce((s,r) => s + r.payout - r.bet, 0).toLocaleString('en-GB') + ' pts', 'success')
    else if (allPush) showToast('🤝 Push! Bet returned.', 'info')
    else if (allLost) showToast('❌ Dealer wins.', 'error')
    else showToast('Game over!', 'info')

    refreshPoints(); loadHistory(); loadLeaderboard()
  }, [playDealer, resolveSideBets, saveGame, awardPoints, showToast, refreshPoints, loadHistory, loadLeaderboard])

  // ── Auto-advance hand ──
  useEffect(() => {
    if (phase !== PHASES.PLAYING) return
    const h = hands[activeHand]
    if (!h || h.length < 2) return
    if (!isBJ(h) && !isBust(h) && handTotal(h) !== 21) return
    const t = setTimeout(() => {
      if (activeHand < hands.length - 1) setActiveHand(a => a + 1)
      else resolveGame(hands, bets, dealer, deck, ppBet, t3Bet, insBet)
    }, 400)
    return () => clearTimeout(t)
  }, [hands, activeHand, phase]) // eslint-disable-line

  // ── Deal ──
  const handleDeal = useCallback(async () => {
    if (!twitchUser)                              { showToast('Login with Twitch to play!', 'error'); return }
    const betAmt = parseInt(betInput) || 0
    if (betAmt < MIN_BET)                         { showToast(`Min bet: ${MIN_BET} pts`, 'error'); return }
    if (betAmt > MAX_BET)                         { showToast(`Max bet: ${MAX_BET} pts`, 'error'); return }
    const totalDeduct = betAmt + (ppBet || 0) + (t3Bet || 0)
    if (points != null && totalDeduct > points)   { showToast('Not enough points!', 'error'); return }
    if (submitting) return
    setSubmitting(true)

    try {
      const d = await seUpdate(twitchUser, -totalDeduct, secret)
      if (d.newPoints != null) setPoints(d.newPoints)
      else setPoints(p => Math.max(0, (p ?? 0) - totalDeduct))
    } catch { showToast('Error deducting points.', 'error'); setSubmitting(false); return }

    // Deal 4 cards: d1, p1, d2, p2 (classic order)
    let dk = shuffle(createDeck())
    let d1, p1, d2, p2
    ;({ card: d1, newDeck: dk } = drawCard(dk))
    ;({ card: p1, newDeck: dk } = drawCard(dk))
    ;({ card: d2, newDeck: dk } = drawCard(dk))
    ;({ card: p2, newDeck: dk } = drawCard(dk))

    const playerHand = [p1, p2]
    const dealerHand = [d1, d2]

    setBets([betAmt]); setDeck(dk); setDealer(dealerHand)
    setHands([playerHand]); setActiveHand(0); setResults([])
    setDoubled([]); setSplitCount(0); setInsBet(0)
    setPpResult(null); setT3Result(null); setInsResult(null)
    setSubmitting(false)

    // Insurance check: dealer upcard is Ace
    if (d1.rank === 'A') {
      setPhase(PHASES.INSURANCE)
    } else {
      setPhase(PHASES.PLAYING)
      if (isBJ(playerHand)) {
        setTimeout(() => resolveGame([playerHand], [betAmt], dealerHand, dk, ppBet, t3Bet, 0), 900)
      }
    }
  }, [twitchUser, betInput, ppBet, t3Bet, points, submitting, drawCard, resolveGame, showToast, setPoints, secret])

  // ── Insurance handlers ──
  const handleTakeInsurance = useCallback(async () => {
    const maxIns = Math.floor((parseInt(betInput) || 0) / 2)
    if (points != null && maxIns > points) { showToast('Not enough points for insurance!', 'error'); return }
    setInsLoading(true)
    try {
      const d = await seUpdate(twitchUser, -maxIns, secret)
      if (d.newPoints != null) setPoints(d.newPoints)
      else setPoints(p => Math.max(0, (p ?? 0) - maxIns))
      setInsBet(maxIns)
    } catch { showToast('Error taking insurance.', 'error') }
    setInsLoading(false)
    setPhase(PHASES.PLAYING)
    const ph = hands[0]
    if (isBJ(ph)) {
      setTimeout(() => resolveGame([ph], bets, dealer, deck, ppBet, t3Bet, maxIns), 900)
    }
  }, [twitchUser, betInput, points, hands, bets, dealer, deck, ppBet, t3Bet, resolveGame, showToast, setPoints, secret])

  const handleDeclineInsurance = useCallback(() => {
    setPhase(PHASES.PLAYING)
    if (isBJ(hands[0])) {
      setTimeout(() => resolveGame([hands[0]], bets, dealer, deck, ppBet, t3Bet, 0), 900)
    }
  }, [hands, bets, dealer, deck, ppBet, t3Bet, resolveGame])

  // ── Hit ──
  const handleHit = useCallback(() => {
    if (phase !== PHASES.PLAYING) return
    const { card, newDeck } = drawCard(deck)
    setDeck(newDeck)
    setHands(h => h.map((hand, i) => i === activeHand ? [...hand, card] : hand))
  }, [phase, deck, activeHand, drawCard])

  // ── Stand ──
  const handleStand = useCallback(() => {
    if (phase !== PHASES.PLAYING) return
    if (activeHand < hands.length - 1) setActiveHand(a => a + 1)
    else resolveGame(hands, bets, dealer, deck, ppBet, t3Bet, insBet)
  }, [phase, hands, bets, dealer, deck, ppBet, t3Bet, insBet, activeHand, resolveGame])

  // ── Double ──
  const handleDouble = useCallback(async () => {
    if (phase !== PHASES.PLAYING || hands[activeHand].length !== 2 || doubled.includes(activeHand)) return
    const extra = bets[activeHand]
    if (points != null && extra > points) { showToast('Not enough points to double!', 'error'); return }
    try {
      const d = await seUpdate(twitchUser, -extra, secret)
      if (d.newPoints != null) setPoints(d.newPoints)
      else setPoints(p => Math.max(0, (p ?? 0) - extra))
    } catch { showToast('Error.', 'error'); return }

    const { card, newDeck } = drawCard(deck)
    const newHands   = hands.map((h, i) => i === activeHand ? [...h, card] : h)
    const newBets    = bets.map((b, i) => i === activeHand ? b * 2 : b)
    const newDoubled = [...doubled, activeHand]
    setDeck(newDeck); setHands(newHands); setBets(newBets); setDoubled(newDoubled)

    setTimeout(() => {
      if (activeHand < newHands.length - 1) setActiveHand(a => a + 1)
      else resolveGame(newHands, newBets, dealer, newDeck, ppBet, t3Bet, insBet)
    }, 500)
  }, [phase, hands, bets, activeHand, doubled, points, deck, dealer, ppBet, t3Bet, insBet, twitchUser, secret, drawCard, resolveGame, showToast, setPoints])

  // ── Split ──
  const handleSplit = useCallback(async () => {
    if (phase !== PHASES.PLAYING || !canSplit(hands[activeHand]) || splitCount >= 2) return
    const extra = bets[activeHand]
    if (points != null && extra > points) { showToast('Not enough points to split!', 'error'); return }
    try {
      const d = await seUpdate(twitchUser, -extra, secret)
      if (d.newPoints != null) setPoints(d.newPoints)
      else setPoints(p => Math.max(0, (p ?? 0) - extra))
    } catch { showToast('Error.', 'error'); return }

    const [c1, c2] = hands[activeHand]
    let dk = deck, draw1, draw2
    ;({ card: draw1, newDeck: dk } = drawCard(dk))
    ;({ card: draw2, newDeck: dk } = drawCard(dk))

    const before   = hands.slice(0, activeHand)
    const after    = hands.slice(activeHand + 1)
    const newHands = [...before, [c1, draw1], [c2, draw2], ...after]
    const newBets  = [...bets.slice(0, activeHand), extra, extra, ...bets.slice(activeHand + 1)]
    setHands(newHands); setBets(newBets); setDeck(dk); setSplitCount(s => s + 1)
  }, [phase, hands, bets, activeHand, splitCount, points, deck, twitchUser, secret, drawCard, showToast, setPoints])

  // ── New game ──
  const handleNewGame = useCallback(() => {
    setPhase(PHASES.IDLE); setHands([[]]); setDealer([]); setResults([])
    setDoubled([]); setActiveHand(0); setSplitCount(0); setBets([])
    setPpResult(null); setT3Result(null); setInsResult(null); setInsBet(0)
  }, [])

  const setBetQuick = v => setBetInput(String(Math.min(MAX_BET, Math.max(MIN_BET, v))))
  const betAmt = parseInt(betInput) || 0

  const currentHand = hands[activeHand] || []
  const canDouble   = phase === PHASES.PLAYING && currentHand.length === 2 && !doubled.includes(activeHand)
  const canSplitNow = phase === PHASES.PLAYING && canSplit(currentHand) && splitCount < 2
  const isPlaying   = phase === PHASES.PLAYING
  const isDealer    = phase === PHASES.DEALER
  const isResult    = phase === PHASES.RESULT
  const isInsurance = phase === PHASES.INSURANCE
  const isIdle      = phase === PHASES.IDLE
  const anySideBets = ppResult || t3Result || insResult

  return (
    <div className={styles.page}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {isInsurance && (
        <InsurancePrompt
          maxIns={Math.floor(betAmt / 2)}
          onTake={handleTakeInsurance}
          onDecline={handleDeclineInsurance}
          loading={insLoading}
        />
      )}

      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <rect x="2" y="3" width="20" height="18" rx="3"/>
            <path d="M7 7h.01M7 12h.01M12 7h.01M12 12h.01M17 7h.01M17 12h.01"/>
          </svg>
          Blackjack
        </div>
        <div className={styles.tabs}>
          {['game','history','leaderboard'].map(t => (
            <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {tab === 'game' && (
        <div className={styles.gameLayout}>
          {/* ── LEFT PANEL ── */}
          <div className={styles.panel}>

            {/* Balance */}
            <div className={styles.balanceBox}>
              <HexCoin size={16}/>
              <span className={styles.balanceVal}>{pointsLoading ? '…' : (points ?? 0).toLocaleString('en-GB')}</span>
              <span className={styles.balanceCur}>GDS</span>
              <button className={styles.refreshBtn} onClick={refreshPoints}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>
            </div>

            {/* Main bet */}
            {(isIdle || isResult) && (
              <div className={styles.betSection}>
                <div className={styles.betLabel}>
                  Bet <span className={styles.betMax}>Max {MAX_BET.toLocaleString('en-GB')}</span>
                </div>
                <div className={styles.betRow}>
                  <HexCoin size={14}/>
                  <input className={styles.betInput} type="number" min={MIN_BET} max={MAX_BET}
                    value={betInput} onChange={e => setBetInput(e.target.value)}/>
                  <button className={styles.betQuick} onClick={() => setBetQuick(Math.floor((parseInt(betInput)||MIN_BET)/2))}>½</button>
                  <button className={styles.betQuick} onClick={() => setBetQuick((parseInt(betInput)||MIN_BET)*2)}>2×</button>
                </div>
                <div className={styles.quickBets}>
                  {[100,250,500,1000,2500].map(v => (
                    <button key={v} className={styles.quickBet} onClick={() => setBetQuick(v)}>
                      {v >= 1000 ? v/1000+'k' : v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Side bets */}
            {(isIdle || isResult) && (
              <div className={styles.sideBetsSection}>
                <div className={styles.sideBetsTitle}>Side Bets <span className={styles.sideBetsOptional}>optional</span></div>
                <SideBetInput
                  label="Perfect Pairs" sub="25x same suit · 12x colour · 6x mixed"
                  value={ppBet} onChange={setPpBet} max={SIDE_BET_MAX} color="#a78bfa"
                />
                <SideBetInput
                  label="21+3" sub="Your 2 cards + dealer upcard"
                  value={t3Bet} onChange={setT3Bet} max={SIDE_BET_MAX} color="#34d399"
                />
              </div>
            )}

            {/* Active bet info */}
            {!isIdle && !isResult && (
              <div className={styles.activeBetBox}>
                <span className={styles.activeBetLabel}>Your bet</span>
                <div className={styles.activeBetVal}>
                  <HexCoin size={14}/>{bets.reduce((a,b)=>a+b,0).toLocaleString('en-GB')} pts
                </div>
                {hands.length > 1 && (
                  <div className={styles.activeBetSplit}>
                    {bets.map((b,i) => (
                      <span key={i} className={`${styles.splitChip} ${i===activeHand&&isPlaying?styles.splitChipActive:''}`}>
                        H{i+1}: {b.toLocaleString('en-GB')}
                      </span>
                    ))}
                  </div>
                )}
                {(ppBet > 0 || t3Bet > 0 || insBet > 0) && (
                  <div className={styles.sideBetActive}>
                    {ppBet > 0  && <span className={styles.sideBetChip} style={{color:'#a78bfa'}}>PP: {ppBet}</span>}
                    {t3Bet > 0  && <span className={styles.sideBetChip} style={{color:'#34d399'}}>21+3: {t3Bet}</span>}
                    {insBet > 0 && <span className={styles.sideBetChip} style={{color:'#f59e0b'}}>INS: {insBet}</span>}
                  </div>
                )}
              </div>
            )}

            {/* Side bet results */}
            {isResult && anySideBets && (
              <div className={styles.sideBetResults}>
                <div className={styles.sideBetResultsTitle}>Side Bets</div>
                <SideBetResult label="PP"   result={ppResult}  color="#a78bfa"/>
                <SideBetResult label="21+3" result={t3Result}  color="#34d399"/>
                <SideBetResult label="INS"  result={insResult} color="#f59e0b"/>
              </div>
            )}

            {/* Main result */}
            {isResult && results.length > 0 && (
              <div className={styles.resultBox}>
                {results.map((r,i) => {
                  const net = r.payout - r.bet
                  const won = r.result === 'win' || r.result === 'blackjack'
                  const push = r.result === 'push'
                  return (
                    <div key={i} className={`${styles.resultLine} ${won?styles.clrWin:push?styles.clrPush:styles.clrLoss}`}>
                      {hands.length > 1 && <span>H{i+1} </span>}
                      <span className={styles.resultLabel}>{r.result==='blackjack'?'BLACKJACK':r.result.toUpperCase()}</span>
                      <span>{net > 0 ? '+' : ''}{net.toLocaleString('en-GB')} pts</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Actions */}
            <div className={styles.actions}>
              {(isIdle || isResult) && (
                <button className={styles.btnDeal} onClick={isResult ? handleNewGame : handleDeal}
                  disabled={submitting || (!isResult && !twitchUser)}>
                  {submitting ? 'Dealing…' : isResult ? 'NEW GAME' : 'DEAL'}
                </button>
              )}
              {isPlaying && <>
                <div className={styles.actionRow}>
                  <button className={styles.btnHit}   onClick={handleHit}>HIT</button>
                  <button className={styles.btnStand} onClick={handleStand}>STAND</button>
                </div>
                {(canDouble || canSplitNow) && (
                  <div className={styles.actionRow}>
                    {canDouble   && <button className={styles.btnDouble} onClick={handleDouble}>DOUBLE</button>}
                    {canSplitNow && <button className={styles.btnSplit}  onClick={handleSplit}>SPLIT</button>}
                  </div>
                )}
              </>}
              {isDealer    && <div className={styles.dealerMsg}>Dealer drawing…</div>}
              {isInsurance && <div className={styles.dealerMsg}>Waiting for insurance decision…</div>}
            </div>

            {!twitchUser && (
              <div className={styles.loginPrompt}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Login with Twitch to play
              </div>
            )}
            <div className={styles.rulesBadge}>Blackjack pays 3:2 · Dealer stands on 17</div>
          </div>

          {/* ── TABLE ── */}
          <div className={styles.table}>
            <div className={styles.tableInner}>
              <div className={styles.felt}/>
              <div className={styles.feltRing}/>
              <div className={styles.feltLabel}>
                <span>BLACKJACK PAYS 3 TO 2</span>
                <span className={styles.feltLabelSub}>INSURANCE PAYS 2 TO 1</span>
              </div>

              {dealer.length > 0 && (
                <Hand
                  cards={dealer} hideSecond={isPlaying || isInsurance}
                  label="Dealer"
                  total={(isPlaying || isInsurance) ? cardValue(dealer[0].rank) : handTotal(dealer)}
                  bust={!isPlaying && !isInsurance && isBust(dealer)}
                  bj={!isPlaying && !isInsurance && isBJ(dealer)}
                  startIdx={0}
                />
              )}

              {hands.map((h, i) => h.length > 0 && (
                <Hand key={i} cards={h}
                  label={hands.length > 1 ? `Hand ${i+1}` : (twitchUser || 'You')}
                  total={handTotal(h)} bust={isBust(h)} bj={isBJ(h)}
                  glow={isPlaying && i === activeHand}
                  small={hands.length > 1}
                  startIdx={2 + i * 2}
                />
              ))}

              {isIdle && (
                <div className={styles.idleMsg}>
                  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="1.1">
                    <rect x="2" y="3" width="20" height="18" rx="3"/>
                    <path d="M7 7h.01M7 12h.01M12 7h.01M12 12h.01M17 7h.01M17 12h.01"/>
                  </svg>
                  <span>Place your bet and deal</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className={styles.histSection}>
          <div className={styles.histHeader}>
            <div>Player</div><div>Bet</div><div>Result</div><div>Net</div>
          </div>
          {history.length === 0
            ? <div className={styles.lbEmpty}>No games yet.</div>
            : history.map((r,i) => <HistoryRow key={i} row={r} me={twitchUser}/>)
          }
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className={styles.lbSection}><Leaderboard data={lbData}/></div>
      )}
    </div>
  )
}