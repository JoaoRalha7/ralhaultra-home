import { useState } from 'react'
import { BetPanel, Confetti, HistoryStrip, Page, Result, fmt, playSfx, useCasino, useFlag, MIN_BET } from './CasinoShared'
import styles from './Casino.module.css'

const Gem = () => <svg viewBox="0 0 24 24" width="58%" height="58%" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z" fill="currentColor" fillOpacity=".18" /><path d="M2 9h20M9 3l-2 6 5 12 5-12-2-6" /></svg>
const Bomb = () => <svg viewBox="0 0 24 24" width="58%" height="58%" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="14" r="7" fill="currentColor" fillOpacity=".2" /><path d="M16 8l3-3M18 3v2M20 5h2M7.500 12a4 4 0 013-2" /></svg>

const MINE_CHOICES = [1, 3, 5, 10, 24]
// same maths as the worker (public, shown for the ladder only)
const mult = (k, m) => { let x = 0.97; for (let i = 0; i < k; i++) x *= (25 - i) / (25 - m - i); return Math.floor(x * 100) / 100 }

export default function Mines() {
  const g = useCasino('mines')
  const [bet, setBet] = useState(100)
  const [mines, setMines] = useState(3)
  const r = g.round
  const active = r?.status === 'active'
  const done = r?.status === 'done'
  const won = done && r.payout > 0
  const shaking = useFlag(g.shake)
  const k = r?.revealed?.length || 0
  const m = r?.mines || mines
  const potential = active && k ? Math.floor(r.bet * r.mult) : 0
  const safeLeft = 25 - m - k

  const tile = (i) => {
    if (!active || g.busy || r.revealed.includes(i)) return
    playSfx('click')
    g.act('reveal', { index: i })
  }

  const ladder = Array.from({ length: 6 }, (_, j) => ({ step: k + j + 1, x: mult(k + j + 1, m) })).filter((s) => s.step <= 25 - m)

  return (
    <Page game="mines" title="Mines" sub="Reveal gems, avoid the mines, cash out before you hit one.">
      <div className={styles.layout}>
        <BetPanel points={g.points} bet={bet} setBet={setBet} locked={active} loggedIn={!!g.user}>
          <span className={styles.lbl}>Mines <b className={styles.mcount}>{mines}</b></span>
          <input type="range" min="1" max="24" step="1" value={mines} disabled={active} aria-label="Number of mines"
            className={styles.range} style={{ '--p': `${((mines - 1) / 23) * 100}%` }}
            onChange={(e) => setMines(Number(e.target.value))} />
          <div className={styles.rangeInfo}><span>{mines} mine{mines > 1 ? 's' : ''} / {25 - mines} gems</span><span>1st gem {mult(1, mines).toFixed(2)}x</span></div>
          <div className={styles.quick}>
            {MINE_CHOICES.map((c) => (
              <button key={c} type="button" disabled={active} className={mines === c ? styles.on : ''} onClick={() => setMines(c)}>{c}</button>
            ))}
          </div>
          {active ? (
            <button type="button" className={`${styles.cta} ${k ? styles.pulse : ''}`} disabled={g.busy || !k} onClick={() => { playSfx('cash'); g.act('cashout') }}>
              {k ? `Cash out ${fmt(potential)}` : 'Reveal a tile'}
            </button>
          ) : (
            <button type="button" className={styles.cta} disabled={g.busy || !g.user || Number(bet) < MIN_BET}
              onClick={() => { playSfx('click'); g.start({ bet: Number(bet), mines }) }}>
              {g.user ? 'Start game' : 'Log in to play'}
            </button>
          )}
          {g.err && <p className={styles.err}>{g.err}</p>}
          <p className={styles.note}>More mines means higher multipliers and higher risk. Cash out any time after your first gem.</p>
        </BetPanel>

        <section className={`${styles.stage} ${styles.minesStage} ${shaking ? styles.shake : ''}`}>
          <HistoryStrip items={g.history} />

          <div className={styles.ribbon}>
            <div><small>Safe tiles left</small><b>{safeLeft}</b></div>
            <div><small>Multiplier</small><b>{(r?.mult ?? 1).toFixed(2)}x</b></div>
            <div><small>{active ? 'Next tile' : 'Mines'}</small><b>{active ? `${r.nextMult.toFixed(2)}x` : m}</b></div>
            <div className={active && k ? styles.ribGold : ''}><small>Cash out</small><b>{active && k ? fmt(potential) : '-'}</b></div>
          </div>

          <div className={styles.mines}>
            {Array.from({ length: 25 }, (_, i) => {
              const shown = r?.revealed?.includes(i)
              const isMine = done && r.minePositions?.includes(i)
              const missed = done && !shown && !isMine
              const boom = done && r.hit === i
              const flipped = shown || isMine || missed
              return (
                <button key={i} type="button" onClick={() => tile(i)} disabled={!active || shown || g.busy}
                  className={`${styles.tile} ${flipped ? styles.flip : ''} ${shown ? styles.tGem : ''} ${isMine ? styles.tMine : ''} ${missed ? styles.tMiss : ''} ${boom ? styles.tBoom : ''}`}
                  style={{ '--d': done && !shown ? `${(i % 7) * 45 + (isMine ? 0 : 250)}ms` : '0ms' }}
                  aria-label={shown ? 'Gem' : isMine ? 'Mine' : `Tile ${i + 1}`}>
                  <span className={styles.tIn}>
                    <span className={styles.tFront} />
                    <span className={styles.tBack}>{isMine ? <Bomb /> : flipped ? <Gem /> : null}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {!done && (
            <div className={styles.ladder} aria-label="Multiplier ladder">
              {ladder.map((s, i) => <span key={s.step} className={i === 0 ? styles.ladNext : ''}><small>{s.step}</small>{s.x.toFixed(2)}x</span>)}
            </div>
          )}

          {done && <Result won={won} payout={r.payout} bet={r.bet} label={won ? `Cashed out ${r.mult.toFixed(2)}x` : 'You hit a mine'} onAgain={() => g.setRound(null)} />}
          <Confetti fire={g.fire} colors={['#34d399', '#6ee7b7', '#22d3ee', '#f5c542', '#fff']} />
        </section>
      </div>
    </Page>
  )
}
