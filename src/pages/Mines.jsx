import { useState } from 'react'
import { BetPanel, Page, Result, fmt, useCasino, MIN_BET } from './CasinoShared'
import styles from './Casino.module.css'

const Gem = () => <svg viewBox="0 0 24 24" width="60%" height="60%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z" /><path d="M2 9h20M9 3l-2 6 5 12 5-12-2-6" /></svg>
const Bomb = () => <svg viewBox="0 0 24 24" width="60%" height="60%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="14" r="7" /><path d="M16 8l3-3M18 3v2M20 5h2M7.5 12a4 4 0 013-2" /></svg>

const MINE_CHOICES = [1, 3, 5, 10, 24]

export default function Mines() {
  const g = useCasino('mines')
  const [bet, setBet] = useState(100)
  const [mines, setMines] = useState(3)
  const r = g.round
  const active = r?.status === 'active'
  const done = r?.status === 'done'
  const won = done && r.payout > 0
  const k = r?.revealed?.length || 0
  const potential = active && k ? Math.floor(r.bet * r.mult) : 0

  const play = () => g.start({ bet: Number(bet), mines })
  const tile = (i) => {
    if (!active || g.busy || r.revealed.includes(i)) return
    g.act('reveal', { index: i })
  }

  return (
    <Page title="Mines" sub="Reveal gems, avoid the mines, cash out before you hit one.">
      <div className={styles.layout}>
        <BetPanel points={g.points} bet={bet} setBet={setBet} locked={active} loggedIn={!!g.user}>
          <span className={styles.lbl}>Mines</span>
          <div className={styles.quick}>
            {MINE_CHOICES.map((m) => (
              <button key={m} type="button" disabled={active} className={mines === m ? styles.on : ''} onClick={() => setMines(m)}>{m}</button>
            ))}
          </div>
          {active ? (
            <button type="button" className={styles.cta} disabled={g.busy || !k} onClick={() => g.act('cashout')}>
              {k ? `Cash out ${fmt(potential)}` : 'Reveal a tile'}
            </button>
          ) : (
            <button type="button" className={styles.cta} disabled={g.busy || !g.user || Number(bet) < MIN_BET} onClick={play}>
              {g.user ? 'Start game' : 'Log in to play'}
            </button>
          )}
          {g.err && <p className={styles.err}>{g.err}</p>}
          {r && (
            <dl className={styles.stats}>
              <div><dt>Gems found</dt><dd>{k}</dd></div>
              <div><dt>Multiplier</dt><dd>{r.mult.toFixed(2)}x</dd></div>
              {active && <div><dt>Next tile</dt><dd>{r.nextMult.toFixed(2)}x</dd></div>}
            </dl>
          )}
        </BetPanel>

        <section className={styles.stage}>
          <div className={styles.mines}>
            {Array.from({ length: 25 }, (_, i) => {
              const shown = r?.revealed?.includes(i)
              const mine = done && r.minePositions?.includes(i)
              const boom = done && r.hit === i
              return (
                <button key={i} type="button" onClick={() => tile(i)} disabled={!active || shown || g.busy}
                  className={`${styles.tile} ${shown ? styles.gem : ''} ${mine ? styles.mine : ''} ${boom ? styles.boom : ''}`}
                  aria-label={shown ? 'Gem' : mine ? 'Mine' : `Tile ${i + 1}`}>
                  {shown ? <Gem /> : mine ? <Bomb /> : null}
                </button>
              )
            })}
          </div>
          {done && <Result won={won} payout={r.payout} bet={r.bet} label={won ? `Cashed out ${r.mult.toFixed(2)}x` : 'You hit a mine'} onAgain={() => g.setRound(null)} />}
        </section>
      </div>
    </Page>
  )
}
