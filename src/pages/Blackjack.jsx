import { useState } from 'react'
import { BetPanel, ChipStack, Confetti, HistoryStrip, Page, Result, fmt, playSfx, useCasino, useFlag, MIN_BET } from './CasinoShared'
import styles from './Casino.module.css'

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS = [
  { red: false, d: 'M12 2c4 5 8 7.500 8 11a4.500 4.500 0 01-7 3.500L14 22h-4l1-5.500A4.500 4.500 0 014 13c0-3.500 4-6 8-11z' },
  { red: true,  d: 'M12 21C5 15 3 11.500 3 8.500A4.500 4.500 0 0112 7a4.500 4.500 0 019 1.500C21 11.500 19 15 12 21z' },
  { red: true,  d: 'M12 2l7 10-7 10-7-10z' },
  { red: false, d: 'M12 3a4 4 0 00-3.500 6A4.500 4.500 0 106 17a4.400 4.400 0 003-1.200L8 22h8l-1-6.200A4.400 4.400 0 0018 17a4.500 4.500 0 10-2.500-8A4 4 0 0012 3z' },
]

function Card({ c, hidden, i, flip }) {
  if (hidden) return <div className={`${styles.card} ${styles.cardBack}`} style={{ '--i': i }} aria-label="Hidden card"><span /></div>
  const suit = SUITS[Math.floor(c / 13)]
  return (
    <div className={`${styles.card} ${suit.red ? styles.red : ''} ${flip ? styles.flipIn : ''}`} style={{ '--i': i }} aria-label={RANKS[c % 13]}>
      <b>{RANKS[c % 13]}</b>
      <svg viewBox="0 0 24 24" className={styles.pip} aria-hidden="true"><path d={suit.d} fill="currentColor" /></svg>
      <svg viewBox="0 0 24 24" className={styles.pipSm} aria-hidden="true"><path d={suit.d} fill="currentColor" /></svg>
    </div>
  )
}

const LABEL = { win: 'You win', blackjack: 'Blackjack', push: 'Push', lose: 'Dealer wins', bust: 'Bust', dealer_blackjack: 'Dealer blackjack' }

export default function Blackjack() {
  const g = useCasino('blackjack')
  const [bet, setBet] = useState(100)
  const r = g.round
  const active = r?.status === 'active'
  const done = r?.status === 'done'
  const shaking = useFlag(g.shake)
  const act = (a) => { playSfx('click'); g.act(a) }

  return (
    <Page game="blackjack" title="Blackjack" sub="Beat the dealer without going over 21. Blackjack pays 3:2.">
      <div className={styles.layout}>
        <BetPanel points={g.points} bet={bet} setBet={setBet} locked={active} loggedIn={!!g.user}>
          {active ? (
            <div className={styles.actions}>
              <button type="button" className={styles.cta} disabled={g.busy} onClick={() => act('hit')}>Hit</button>
              <button type="button" className={styles.ctaAlt} disabled={g.busy} onClick={() => act('stand')}>Stand</button>
              <button type="button" className={styles.ctaAlt} disabled={g.busy || !r.canDouble} onClick={() => act('double')}>Double</button>
            </div>
          ) : (
            <button type="button" className={styles.cta} disabled={g.busy || !g.user || Number(bet) < MIN_BET}
              onClick={() => { playSfx('click'); g.start({ bet: Number(bet) }) }}>
              {g.user ? 'Deal' : 'Log in to play'}
            </button>
          )}
          {g.err && <p className={styles.err}>{g.err}</p>}
          <p className={styles.note}>Dealer stands on 17. Double down on your first two cards.</p>
        </BetPanel>

        <section className={`${styles.stage} ${styles.felt} ${shaking ? styles.shake : ''}`}>
          <HistoryStrip items={g.history} />
          <div className={styles.shoe} aria-hidden="true"><i /><i /><i /></div>

          <div className={styles.table}>
            <svg className={styles.arc} viewBox="0 0 600 70" aria-hidden="true">
              <defs><path id="bjArc" d="M30 60 Q300 -20 570 60" /></defs>
              <text><textPath href="#bjArc" startOffset="50%" textAnchor="middle">BLACKJACK PAYS 3 TO 2</textPath></text>
            </svg>

            {!r ? (
              <div className={styles.idle}>
                <ChipStack amount={Number(bet)} />
                <span>Place your bet and deal</span>
              </div>
            ) : (
              <>
                <div className={styles.hand}>
                  <h3>Dealer <span>{r.dealerTotal}{!done && '+'}</span></h3>
                  <div className={styles.cards}>
                    {r.dealer.map((c, i) => <Card key={`d${i}`} c={c} i={i} flip={done && i > 0} />)}
                    {active && <Card hidden i={1} />}
                  </div>
                </div>
                <div className={styles.hand}>
                  <h3>You <span className={r.playerTotal === 21 ? styles.t21 : ''}>{r.playerTotal}</span></h3>
                  <div className={styles.cards}>{r.player.map((c, i) => <Card key={`p${i}`} c={c} i={i} />)}</div>
                </div>
                <div className={styles.betLine}><ChipStack amount={r.bet} /><b>{fmt(r.bet)}</b>{r.doubled && <em>Doubled</em>}</div>
              </>
            )}
          </div>

          {done && <Result won={r.payout > r.bet} push={r.payout === r.bet} payout={r.payout} bet={r.bet} label={LABEL[r.outcome] || 'Round over'} onAgain={() => g.setRound(null)} />}
          <Confetti fire={g.fire} colors={['#f5c542', '#fde68a', '#34d399', '#fff', '#93c5fd']} />
        </section>
      </div>
    </Page>
  )
}
