import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useStreamElementsPoints } from '../hooks/useStreamElementsPoints'
import { supabaseDash } from '../lib/supabase'
import styles from './Mines.module.css'

const SE_WORKER_URL = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'
const SIZE = 25
const MIN_BET = 50
const MAX_BET = 5000
const MAX_PAYOUT = 100000
const EDGE = 0.97
const MINE_PRESETS = [1, 3, 5, 10, 24]

async function seUpdate(username, amount, secret) {
  const res = await fetch(`${SE_WORKER_URL}/points/update`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ username: username.toLowerCase(), amount }),
  })
  if (!res.ok) throw new Error('SE error')
  return res.json()
}

// multiplier after k safe picks with m mines on a 25 grid (3% edge)
function multiplier(k, m) {
  if (k <= 0) return 1
  let r = 1
  for (let i = 0; i < k; i++) r *= (SIZE - i) / (SIZE - m - i)
  return r * EDGE
}

function randInt(n) {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0] % n
}

function placeMines(m) {
  const cells = Array.from({ length: SIZE }, (_, i) => i)
  for (let i = SIZE - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[cells[i], cells[j]] = [cells[j], cells[i]]
  }
  return new Set(cells.slice(0, m))
}

const Gem = () => (
  <svg viewBox="0 0 24 24" width="62%" height="62%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
    <path d="M6 3h12l4 6-10 12L2 9z" /><path d="M2 9h20M9 3l-2 6 5 12 5-12-2-6" />
  </svg>
)
const Bomb = () => (
  <svg viewBox="0 0 24 24" width="62%" height="62%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="14" r="7" /><path d="M16 9l3-3M19 3v2M21 5h-2M7.5 12a3.5 3.5 0 0 1 2.5-2.5" />
  </svg>
)

const fmt = (n) => Math.floor(n).toLocaleString('pt-PT')

export default function Mines() {
  const { user, profile } = useAuth()
  const twitchUser = profile?.twitch_username || user?.user_metadata?.preferred_username || user?.user_metadata?.full_name || null
  const { points, setPoints, refresh } = useStreamElementsPoints(twitchUser)
  const secret = import.meta.env.VITE_WORKER_SECRET

  const [phase, setPhase] = useState('idle') // idle | playing | over
  const [betInput, setBetInput] = useState('200')
  const [mineCount, setMineCount] = useState(3)
  const [revealed, setRevealed] = useState([])
  const [bust, setBust] = useState(null)
  const [mines, setMines] = useState(null) // only filled when the round ends
  const [bet, setBet] = useState(0)
  const [payout, setPayout] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [history, setHistory] = useState([])
  const minesRef = useRef(new Set())

  const loadHistory = useCallback(async () => {
    const { data } = await supabaseDash
      .from('mines_games').select('twitch_username,bet,mines,picks,result,payout,created_at')
      .order('created_at', { ascending: false }).limit(10)
    if (data) setHistory(data)
  }, [])
  useEffect(() => { loadHistory() }, [loadHistory])

  useEffect(() => {
    if (phase !== 'playing') return
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase])

  const credit = async (amount) => {
    const d = await seUpdate(twitchUser, amount, secret)
    if (d.newPoints != null) setPoints(d.newPoints)
    else setPoints((p) => (p ?? 0) + amount)
  }

  const save = (b, m, picks, result, pay) =>
    supabaseDash.from('mines_games')
      .insert({ twitch_username: twitchUser, bet: b, mines: m, picks, result, payout: pay, created_at: new Date().toISOString() })
      .then(() => loadHistory(), () => {})

  const betNum = Math.max(0, Math.floor(Number(betInput) || 0))
  const safeTotal = SIZE - mineCount
  const k = revealed.length
  const curMult = multiplier(k, phase === 'idle' ? mineCount : mineCount)
  const nextMult = k < safeTotal ? multiplier(k + 1, mineCount) : curMult
  const curWin = Math.min(MAX_PAYOUT, Math.floor((phase === 'idle' ? betNum : bet) * curMult))

  const start = async () => {
    setErr('')
    if (!user || !twitchUser) return setErr('Login with Twitch to play.')
    if (betNum < MIN_BET || betNum > MAX_BET) return setErr(`Bet must be between ${MIN_BET} and ${MAX_BET.toLocaleString('pt-PT')}.`)
    if ((points ?? 0) < betNum) return setErr('Not enough points.')
    setBusy(true)
    try {
      await credit(-betNum)
    } catch {
      setBusy(false)
      return setErr('Could not place the bet. Try again.')
    }
    minesRef.current = placeMines(mineCount)
    setBet(betNum); setRevealed([]); setBust(null); setMines(null); setPayout(0)
    setPhase('playing'); setBusy(false)
  }

  const finish = async (result, picks, pay) => {
    setMines([...minesRef.current])
    setPayout(pay)
    setPhase('over')
    if (pay > 0) {
      try { await credit(pay) } catch { setErr('Could not credit your win. Contact a mod, your bet is logged.'); refresh?.() }
    }
    save(bet, mineCount, picks, result, pay)
  }

  const pick = (i) => {
    if (phase !== 'playing' || busy || revealed.includes(i)) return
    if (minesRef.current.has(i)) {
      setBust(i)
      return finish('loss', revealed.length, 0)
    }
    const next = [...revealed, i]
    setRevealed(next)
    if (next.length === safeTotal) {
      const pay = Math.min(MAX_PAYOUT, Math.floor(bet * multiplier(next.length, mineCount)))
      finish('win', next.length, pay)
    }
  }

  const cashOut = () => {
    if (phase !== 'playing' || !k || busy) return
    setBusy(true)
    const pay = Math.min(MAX_PAYOUT, Math.floor(bet * multiplier(k, mineCount)))
    finish('win', k, pay).finally(() => setBusy(false))
  }

  const playing = phase === 'playing'
  const won = phase === 'over' && payout > 0

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>Mines</h1>
        <p>Find the gems, avoid the mines. Cash out before you hit one.</p>
      </div>

      <div className={styles.layout}>
        <aside className={styles.panel}>
          <div className={styles.bal}><span>Your points</span><b>{points === null ? '-' : fmt(points)}</b></div>

          <label className={styles.lbl}>Bet</label>
          <div className={styles.betRow}>
            <input
              className={styles.inp} inputMode="numeric" value={betInput} disabled={playing}
              onChange={(e) => setBetInput(e.target.value.replace(/\D/g, ''))}
            />
            <button type="button" disabled={playing} onClick={() => setBetInput(String(Math.max(MIN_BET, Math.floor(betNum / 2))))}>1/2</button>
            <button type="button" disabled={playing} onClick={() => setBetInput(String(Math.min(MAX_BET, betNum * 2)))}>2x</button>
            <button type="button" disabled={playing} onClick={() => setBetInput(String(Math.min(MAX_BET, points ?? MIN_BET)))}>Max</button>
          </div>

          <label className={styles.lbl}>Mines</label>
          <div className={styles.mineRow}>
            {MINE_PRESETS.map((m) => (
              <button key={m} type="button" disabled={playing} className={mineCount === m ? styles.on : ''} onClick={() => setMineCount(m)}>{m}</button>
            ))}
          </div>

          <div className={styles.stats}>
            <div><span>Gems left</span><b>{safeTotal - k}</b></div>
            <div><span>Multiplier</span><b>{curMult.toFixed(2)}x</b></div>
            {playing && <div><span>Next</span><b>{nextMult.toFixed(2)}x</b></div>}
          </div>

          {playing ? (
            <button type="button" className={styles.cta} disabled={!k || busy} onClick={cashOut}>
              {k ? `Cash out ${fmt(curWin)}` : 'Pick a tile'}
            </button>
          ) : (
            <button type="button" className={styles.cta} disabled={busy} onClick={start}>
              {phase === 'over' ? 'Play again' : 'Place bet'}
            </button>
          )}
          {err && <p className={styles.err}>{err}</p>}
          <p className={styles.fine}>Max payout {fmt(MAX_PAYOUT)}. Leaving mid-round forfeits the bet.</p>
        </aside>

        <section className={styles.boardWrap}>
          <div className={styles.board}>
            {Array.from({ length: SIZE }, (_, i) => {
              const isGem = revealed.includes(i)
              const isMine = mines?.includes(i)
              const cls = [
                styles.tile,
                isGem && styles.gem,
                bust === i && styles.boom,
                phase === 'over' && !isGem && isMine && styles.mine,
                phase === 'over' && !isGem && !isMine && styles.dim,
              ].filter(Boolean).join(' ')
              return (
                <button key={i} type="button" className={cls} disabled={!playing || isGem} onClick={() => pick(i)} aria-label={`Tile ${i + 1}`}>
                  {isGem ? <Gem /> : phase === 'over' && isMine ? <Bomb /> : null}
                </button>
              )
            })}
          </div>
          {phase === 'over' && (
            <div className={`${styles.result} ${won ? styles.rw : styles.rl}`}>
              {won ? `You won ${fmt(payout)} points (${multiplier(k, mineCount).toFixed(2)}x)` : 'Boom. You hit a mine.'}
            </div>
          )}
        </section>
      </div>

      <section className={styles.hist}>
        <h2>Recent games</h2>
        {history.length === 0 ? <p className={styles.fine}>No games yet.</p> : (
          <div className={styles.hrows}>
            {history.map((h, i) => (
              <div key={i} className={styles.hrow}>
                <span className={styles.hu}>{h.twitch_username}</span>
                <span>{h.mines} mines</span>
                <span>{h.picks} gems</span>
                <span>Bet {fmt(h.bet)}</span>
                <b className={h.payout > 0 ? styles.pos : styles.neg}>{h.payout > 0 ? `+${fmt(h.payout - h.bet)}` : `-${fmt(h.bet)}`}</b>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
