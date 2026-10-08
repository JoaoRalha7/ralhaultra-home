import { useEffect, useState } from 'react'
import { Confetti, HistoryStrip, Page, fmt, playSfx, useCasino, useFlag, MIN_BET, MAX_BET, useMaxBet, MaxBet } from './CasinoShared'
import shared from './Casino.module.css'
import styles from './Blackjack.module.css'

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS = [
  { red: false, d: 'M12 2c4 5 8 7.500 8 11a4.500 4.500 0 01-7 3.500L14 22h-4l1-5.500A4.500 4.500 0 014 13c0-3.500 4-6 8-11z' },
  { red: true,  d: 'M12 21C5 15 3 11.500 3 8.500A4.500 4.500 0 0112 7a4.500 4.500 0 019 1.500C21 11.500 19 15 12 21z' },
  { red: true,  d: 'M12 2l7 10-7 10-7-10z' },
  { red: false, d: 'M12 3a4 4 0 00-3.500 6A4.500 4.500 0 106 17a4.400 4.400 0 003-1.200L8 22h8l-1-6.200A4.400 4.400 0 0018 17a4.500 4.500 0 10-2.500-8A4 4 0 0012 3z' },
]

function Card({ c, hidden, delay = 0, reveal, tone }) {
  const suit = hidden ? null : SUITS[Math.floor((c % 52) / 13)]
  return (
    <div className={`${styles.card} ${reveal ? '' : styles.fly} ${tone ? styles[tone] : ''}`} style={{ '--dl': `${delay}ms` }} aria-label={hidden ? 'Hidden card' : RANKS[c % 13]}>
      <div className={`${styles.cardIn} ${hidden ? styles.down : reveal ? styles.revealTurn : styles.turnTurn}`}>
        <div className={`${styles.face} ${styles.front} ${suit?.red ? styles.red : ''}`}>
          {!hidden && (
            <>
              <span className={`${styles.idx} ${styles.idxTl}`}><b>{RANKS[c % 13]}</b><svg viewBox="0 0 24 24" aria-hidden="true"><path d={suit.d} fill="currentColor" /></svg></span>
              <span className={`${styles.idx} ${styles.idxBr}`}><b>{RANKS[c % 13]}</b><svg viewBox="0 0 24 24" aria-hidden="true"><path d={suit.d} fill="currentColor" /></svg></span>
              <svg viewBox="0 0 24 24" className={styles.pip} aria-hidden="true"><path d={suit.d} fill="currentColor" /></svg>
            </>
          )}
        </div>
        <div className={`${styles.face} ${styles.back}`}><i /></div>
      </div>
    </div>
  )
}

// "9 / 19" while an ace can still count either way
const showTotal = (cards, total, live) => {
  if (!live) return String(total)
  const hard = cards.reduce((a, c) => a + Math.min((c % 13) + 1, 10), 0)
  return cards.some((c) => c % 13 === 0) && hard + 10 <= 21 ? `${hard} / ${hard + 10}` : String(total)
}
const PPN = { perfect: 'Perfect Pair', colored: 'Colored Pair', mixed: 'Mixed Pair' }
const T3N = { suitedTrips: 'Suited Trips', straightFlush: 'Straight Flush', trips: 'Trips', straight: 'Straight', flush: 'Flush' }
const RES = { win: ['WIN', 'win'], blackjack: ['BLACKJACK', 'win'], push: ['PUSH', 'push'], lose: ['LOSE', 'lose'], bust: ['BUST', 'lose'] }

const dTotal = (cards) => {
  let t = 0, a = 0
  for (const c of cards) { const r = c % 13; if (r === 0) { a++; t += 11 } else t += Math.min(r + 1, 10) }
  while (t > 21 && a-- > 0) t -= 10
  return t
}

const clamp = (v) => Math.max(0, Math.min(MAX_BET, Math.floor(Number(v)) || 0))
const IC = {
  hit: <path d="M12 5v14M5 12h14" />,
  stand: <path d="M6 12.500l4 4 8-9" />,
  split: <path d="M12 4v6M12 10l-6 4v6M12 10l6 4v6" />,
  double: <path d="M7 12h10M12 7v10M4 4h16v16H4z" />,
}
const Ico = ({ n }) => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{IC[n]}</svg>

function Money({ label, value, setValue, disabled, min }) {
  const set = (v) => setValue(Math.max(min, Math.min(MAX_BET, Math.floor(v) || min)))
  return (
    <div className={styles.fld}>
      <span className={styles.lab}>{label}{label === 'Bet Amount' && <MaxBet />}</span>
      <div className={`${styles.money} ${disabled ? styles.off : ''}`}>
        <i className={styles.coin} aria-hidden="true" />
        <input type="number" inputMode="numeric" min={min} value={value} disabled={disabled} placeholder="0"
          onChange={(e) => setValue(e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value))))}
          onBlur={() => setValue(min === 0 && !clamp(value) ? '' : set(value))} />
        <button type="button" disabled={disabled} onClick={() => set((Number(value) || 0) / 2)}>1/2</button>
        <button type="button" disabled={disabled} onClick={() => set((Number(value) || min || MIN_BET) * 2)}>2x</button>
      </div>
    </div>
  )
}

export default function Blackjack() {
  const g = useCasino('blackjack')
  const [tab, setTab] = useState('standard')
  const [bet, setBet] = useState(100)
  useMaxBet('blackjack', {}, bet, setBet)
  const [pp, setPp] = useState('')
  const [t3, setT3] = useState('')
  const [seats, setSeats] = useState(1)
  const r = g.round
  const active = r?.status === 'active'
  const done = r?.status === 'done'
  const shaking = useFlag(g.shake)
  // nothing about the outcome shows until the dealer has finished playing: the hole card turns, the extra
  // cards arrive one by one, and only then the results (and sound, confetti, balance) are released
  const [fin, setFin] = useState(null) // id of the round whose results are visible
  const [dCount, setDCount] = useState(1)
  const rid = r?.id, rdone = r?.status === 'done', dlen = r?.dealer.length || 0
  useEffect(() => {
    if (!rdone) { setDCount(1); return }
    const T = [setTimeout(() => setDCount(2), 650)]
    for (let i = 2; i < dlen; i++) T.push(setTimeout(() => setDCount(i + 1), 750 + (i - 2) * 600 + 950))
    const end = (dlen > 2 ? 750 + (dlen - 3) * 600 + 950 : 650) + 450
    T.push(setTimeout(() => { setFin(rid); g.release() }, end))
    return () => T.forEach(clearTimeout)
  }, [rid, rdone, dlen]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = done && fin === r.id // results visible
  const waiting = done && !shown
  const act = (a, extra) => { playSfx('click'); g.hold.current = true; g.act(a, extra) }
  const offer = active && r?.ins === 'offer'
  const ppv = tab === 'side' ? clamp(pp) : 0, t3v = tab === 'side' ? clamp(t3) : 0
  const place = () => { playSfx('click'); g.hold.current = true; g.start({ bet: Number(bet), pp: ppv >= MIN_BET ? ppv : 0, t3: t3v >= MIN_BET ? t3v : 0, seats }) }
  const n = r?.hands.length || 0
  const first = (i, ci) => (ci * (n + 1) + i) * 170 // opening deal order: every seat, then the dealer

  return (
    <Page game="blackjack" title="Blackjack" sub="">
      <div className={shared.layout}>
        <aside className={`${shared.panel} ${styles.panel}`}>
          <div className={styles.tabs} role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'standard'} className={tab === 'standard' ? styles.on : ''} onClick={() => setTab('standard')}>Standard</button>
            <button type="button" role="tab" aria-selected={tab === 'side'} className={tab === 'side' ? styles.on : ''} onClick={() => setTab('side')}>Side Bets</button>
          </div>
          <Money label="Bet Amount" value={bet} setValue={setBet} disabled={active} min={MIN_BET} />
          {tab === 'side' && (
            <>
              <Money label="Perfect Pairs" value={pp} setValue={setPp} disabled={active} min={0} />
              <Money label="21+3" value={t3} setValue={setT3} disabled={active} min={0} />
            </>
          )}
          <div className={styles.fld}>
            <span className={styles.lab}>Seats</span>
            <div className={styles.seatsSel}>
              {[1, 2, 3].map((s) => <button key={s} type="button" disabled={active} className={seats === s ? styles.on : ''} onClick={() => setSeats(s)}>{s}</button>)}
            </div>
          </div>
          <div className={styles.acts}>
            <button type="button" disabled={!active || g.busy || offer} onClick={() => act('hit')}><Ico n="hit" />Hit</button>
            <button type="button" disabled={!active || g.busy || offer} onClick={() => act('stand')}><Ico n="stand" />Stand</button>
            <button type="button" disabled={!active || g.busy || offer || !r?.canSplit} onClick={() => act('split')}><Ico n="split" />Split</button>
            <button type="button" disabled={!active || g.busy || offer || !r?.canDouble} onClick={() => act('double')}><Ico n="double" />Double</button>
          </div>
          <button type="button" className={styles.place} disabled={active || waiting || g.busy || !g.user || Number(bet) < MIN_BET} onClick={place}>{g.user ? 'Place Bet' : 'Log in to play'}</button>
          {g.err && <p className={styles.err}>{g.err}</p>}
        </aside>

        <section className={`${styles.table} ${shaking ? shared.shake : ''}`}>
          <div className={styles.histWrap}><HistoryStrip items={g.history} /></div>
          <div className={styles.shoe} aria-hidden="true" />
          {r && (
            <div className={styles.dealer}>
              {shown && r.insPayout > 0 && <small className={`${styles.tag} ${styles.t_win}`}>INSURANCE 2:1</small>}
              <span className={styles.pill}>{done ? dTotal(r.dealer.slice(0, dCount)) : r.dealerTotal}</span>
              <div className={styles.cards}>
                {r.dealer.map((c, i) => <Card key={`${r.id}-d${i}${i === 1 && done ? 'o' : ''}`} c={c} reveal={i === 1 && done} delay={i === 0 ? first(n, 0) : i === 1 ? 0 : 750 + (i - 2) * 600} />)}
                {active && <Card key={`${r.id}-dh`} hidden delay={first(n, 1)} />}
              </div>
            </div>
          )}
          {offer && (
            <div className={styles.ins} role="dialog" aria-label="Insurance">
              <b>Insurance</b>
              <span><i className={styles.coin} />{fmt(r.insCost)}</span>
              <div>
                <button type="button" disabled={g.busy} onClick={() => act('insurance', { take: false })}>No</button>
                <button type="button" className={styles.insYes} disabled={g.busy} onClick={() => act('insurance', { take: true })}>Yes</button>
              </div>
            </div>
          )}
          {!offer && <div className={styles.rules}><b>Blackjack 3:2</b><span>Dealer stands on 17</span></div>}
          {r && (
            <div className={styles.seats}>
              {r.hands.map((h, hi) => {
                const on = active && hi === r.active && !h.done
                const res = shown ? RES[h.result] : null
                const tone = res ? res[1] : null
                const side = [h.side?.pp?.mult ? [PPN[h.side.pp.kind] || 'Pair', h.side.pp.mult] : null, h.side?.t3?.mult ? [T3N[h.side.t3.kind] || '21+3', h.side.t3.mult] : null].filter(Boolean)
                return (
                  <div key={hi} className={`${styles.seat} ${on ? styles.seatOn : ''}`}>
                    {side.length > 0 && (
                      <div className={styles.sides}>
                        {side.map(([nm, m]) => <span key={nm} className={styles.sbet} style={{ '--d': `${first(hi, 1) + 450}ms` }}><em>{nm}</em><i>{m - 1}:1</i></span>)}
                      </div>
                    )}
                    <div className={styles.tags}>
                      {res ? (
                        <span className={`${styles.fpill} ${styles['f_' + tone]}`}><i>{showTotal(h.cards, h.total, !h.done)}</i><em>{res[0]}</em></span>
                      ) : (
                        <span className={`${styles.pill} ${on ? styles.pillOn : ''}`}>{showTotal(h.cards, h.total, !h.done)}</span>
                      )}
                      {h.doubled && <small className={styles.tag}>DOUBLE</small>}
                    </div>
                    <div className={styles.hand}>
                      {on && n > 1 && <i className={styles.chev} aria-hidden="true">&rsaquo;</i>}
                      <div className={styles.cards}>
                        {h.cards.map((c, i) => <Card key={`${r.id}-${hi}-${i}`} c={c} tone={shown ? tone : null} delay={i < 2 && h.cards.length <= 2 ? first(hi, i) : 0} />)}
                      </div>
                      {on && n > 1 && <i className={styles.chev} aria-hidden="true">&lsaquo;</i>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {shown && r.payout > r.bet && (
            <div className={styles.pop} role="status" key={r.id}>
              <b>{(r.payout / r.bet).toFixed(2)}&times;</b>
              <hr />
              <span><i className={styles.coin} />{fmt(r.payout)}</span>
            </div>
          )}
          <Confetti fire={g.fire} colors={['#f5c542', '#fde68a', '#34d399', '#fff', '#93c5fd']} />
        </section>
      </div>
    </Page>
  )
}
