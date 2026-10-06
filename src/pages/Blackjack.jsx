import { useState } from 'react'
import { BetPanel, ChipStack, Confetti, HistoryStrip, Page, Result, fmt, playSfx, useCasino, useFlag, MIN_BET, MAX_BET } from './CasinoShared'
import styles from './Casino.module.css'

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS = [
  { red: false, d: 'M12 2c4 5 8 7.500 8 11a4.500 4.500 0 01-7 3.500L14 22h-4l1-5.500A4.500 4.500 0 014 13c0-3.500 4-6 8-11z' },
  { red: true,  d: 'M12 21C5 15 3 11.500 3 8.500A4.500 4.500 0 0112 7a4.500 4.500 0 019 1.500C21 11.500 19 15 12 21z' },
  { red: true,  d: 'M12 2l7 10-7 10-7-10z' },
  { red: false, d: 'M12 3a4 4 0 00-3.500 6A4.500 4.500 0 106 17a4.400 4.400 0 003-1.200L8 22h8l-1-6.200A4.400 4.400 0 0018 17a4.500 4.500 0 10-2.500-8A4 4 0 0012 3z' },
]

// delay: ms before the card leaves the shoe. reveal: turn a face-down card over in place (dealer hole card).
function Card({ c, hidden, delay = 0, reveal }) {
  const suit = hidden ? null : SUITS[Math.floor((c % 52) / 13)]
  return (
    <div className={`${styles.card} ${reveal ? '' : styles.cardFly}`} style={{ '--dl': `${delay}ms` }} aria-label={hidden ? 'Hidden card' : RANKS[c % 13]}>
      <div className={`${styles.cardIn} ${hidden ? styles.down : reveal ? styles.revealTurn : styles.turnTurn}`}>
        <div className={`${styles.face} ${styles.cFront} ${suit?.red ? styles.red : ''}`}>
          {!hidden && (
            <>
              <b>{RANKS[c % 13]}</b>
              <svg viewBox="0 0 24 24" className={styles.pip} aria-hidden="true"><path d={suit.d} fill="currentColor" /></svg>
              <svg viewBox="0 0 24 24" className={styles.pipSm} aria-hidden="true"><path d={suit.d} fill="currentColor" /></svg>
            </>
          )}
        </div>
        <div className={`${styles.face} ${styles.cBack}`}><span /></div>
      </div>
    </div>
  )
}

const LABEL = { win: 'You win', blackjack: 'Blackjack', push: 'Push', lose: 'Dealer wins', bust: 'Bust', dealer_blackjack: 'Dealer blackjack', multi: 'Round over' }
const HAND = { win: 'Win', push: 'Push', lose: 'Lose', bust: 'Bust', blackjack: 'Blackjack' }
const SIDE_NAME = {
  perfect: 'Perfect pair', colored: 'Colored pair', mixed: 'Mixed pair',
  suitedTrips: 'Suited trips', straightFlush: 'Straight flush', trips: 'Three of a kind', straight: 'Straight', flush: 'Flush',
}

const clampSide = (v) => { const n = Math.floor(Number(v)) || 0; return n < MIN_BET ? 0 : Math.min(MAX_BET, n) }

function SideInput({ label, hint, value, setValue, disabled }) {
  return (
    <label className={styles.sideIn}>
      <span>{label}<small>{hint}</small></span>
      <input type="number" inputMode="numeric" min="0" placeholder="0" value={value} disabled={disabled}
        onChange={(e) => setValue(e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value))))}
        onBlur={() => setValue(clampSide(value) || '')} />
    </label>
  )
}

export default function Blackjack() {
  const g = useCasino('blackjack')
  const [bet, setBet] = useState(100)
  const [pp, setPp] = useState('')
  const [t3, setT3] = useState('')
  const r = g.round
  const active = r?.status === 'active'
  const done = r?.status === 'done'
  const shaking = useFlag(g.shake)
  const act = (a) => { playSfx('click'); g.act(a) }
  const stake = Number(bet) + clampSide(pp) + clampSide(t3)
  const multi = r && r.hands.length > 1

  return (
    <Page game="blackjack" title="Blackjack" sub="Beat the dealer without going over 21. Blackjack pays 3:2. Split pairs and add side bets.">
      <div className={styles.layout}>
        <BetPanel points={g.points} bet={bet} setBet={setBet} locked={active} loggedIn={!!g.user}>
          {active ? (
            <div className={styles.actions}>
              <button type="button" className={styles.cta} disabled={g.busy} onClick={() => act('hit')}>Hit</button>
              <button type="button" className={styles.ctaAlt} disabled={g.busy} onClick={() => act('stand')}>Stand</button>
              <button type="button" className={styles.ctaAlt} disabled={g.busy || !r.canDouble} onClick={() => act('double')}>Double</button>
              <button type="button" className={styles.ctaAlt} disabled={g.busy || !r.canSplit} onClick={() => act('split')}>Split</button>
            </div>
          ) : (
            <>
              <span className={styles.lbl}>Side bets</span>
              <SideInput label="Perfect Pairs" hint="Your 2 cards pair. Up to 29:1" value={pp} setValue={setPp} disabled={g.busy} />
              <SideInput label="21+3" hint="Your 2 cards + dealer card. Up to 100:1" value={t3} setValue={setT3} disabled={g.busy} />
              <button type="button" className={styles.cta} disabled={g.busy || !g.user || Number(bet) < MIN_BET}
                onClick={() => { playSfx('click'); g.start({ bet: Number(bet), pp: clampSide(pp), t3: clampSide(t3) }) }}>
                {g.user ? `Deal${stake !== Number(bet) ? ` (${fmt(stake)})` : ''}` : 'Log in to play'}
              </button>
            </>
          )}
          {g.err && <p className={styles.err}>{g.err}</p>}
          <p className={styles.note}>Dealer stands on 17. Double on any two cards, split up to 4 hands (split aces get one card each). Side bets are paid when the hand is dealt.</p>
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
                    {r.dealer.map((c, i) => (
                      <Card key={i === 1 && done ? 'dh-open' : `d${i}`} c={c} reveal={i === 1 && done}
                        delay={i === 0 ? 200 : i === 1 ? 0 : 750 + (i - 2) * 600} />
                    ))}
                    {active && <Card key="dh" hidden delay={600} />}
                  </div>
                </div>

                {r.side && (
                  <div className={styles.sideRes}>
                    {r.side.pp && <span className={r.side.pp.mult ? styles.sideWin : ''}>Perfect Pairs {r.side.pp.mult ? `${SIDE_NAME[r.side.pp.kind]} +${fmt(r.side.pp.stake * r.side.pp.mult)}` : `-${fmt(r.side.pp.stake)}`}</span>}
                    {r.side.t3 && <span className={r.side.t3.mult ? styles.sideWin : ''}>21+3 {r.side.t3.mult ? `${SIDE_NAME[r.side.t3.kind]} +${fmt(r.side.t3.stake * r.side.t3.mult)}` : `-${fmt(r.side.t3.stake)}`}</span>}
                  </div>
                )}

                <div className={`${styles.seats} ${multi ? styles.multi : ''}`}>
                  {r.hands.map((h, hi) => (
                    <div key={hi} className={`${styles.seat} ${active && hi === r.active && multi ? styles.seatOn : ''} ${h.done && active ? styles.seatDone : ''} ${done && h.result === 'bust' ? styles.seatBust : ''} ${done && (h.result === 'win' || h.result === 'blackjack') ? (h.result === 'blackjack' ? styles.seatBj : styles.seatWin) : ''} ${done && h.result === 'lose' ? styles.seatLose : ''}`}>
                      <div className={styles.hand}>
                        <h3>{multi ? `Hand ${hi + 1}` : 'You'} <span key={h.total} className={`${styles.totPop} ${h.total === 21 ? styles.t21 : ''}`}>{h.total}</span></h3>
                        <div className={styles.cards}>{h.cards.map((c, i) => <Card key={`p${hi}-${i}`} c={c} delay={i === 0 ? 0 : i === 1 ? 400 : 0} />)}</div>
                      </div>
                      <div className={styles.betLine}><ChipStack amount={h.bet} /><b>{fmt(h.bet)}</b>{h.doubled && <em>Doubled</em>}
                        {done && h.result && <em className={h.payout > h.bet ? styles.emWin : h.payout === h.bet ? '' : styles.emLose}>{HAND[h.result]}</em>}</div>
                    </div>
                  ))}
                </div>
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
