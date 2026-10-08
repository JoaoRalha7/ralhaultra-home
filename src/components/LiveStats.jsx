import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { resetStats, summarize, useStatItems } from '../lib/liveStats'
import styles from './LiveStats.module.css'

const GAMES = [['all', 'All'], ['mines', 'Mines'], ['blackjack', 'Blackjack'], ['crash', 'Crash'], ['keno', 'Keno'], ['plinko', 'Plinko'], ['roulette', 'Roulette'], ['jackpot', 'Jackpot']]
const fmt = (n) => Number(n ?? 0).toLocaleString('en-GB')
const ls = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch { return d } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } } }
const W = 330

function Chart({ line }) {
  const w = 300, h = 150
  const max = Math.max(1, ...line), min = Math.min(-1, ...line)
  const span = max - min
  const y = (v) => 8 + (1 - (v - min) / span) * (h - 16)
  const x = (i) => (line.length < 2 ? 0 : (i / (line.length - 1)) * w)
  const pts = line.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const up = line[line.length - 1] >= 0
  const c = up ? '#22ff7a' : '#f87171'
  return (
    <svg className={styles.chart} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Profit over time">
      <line x1="0" x2={w} y1={y(0)} y2={y(0)} stroke="#2a2e3b" strokeWidth="2" />
      {line.length > 1 && <polyline points={pts} fill="none" stroke={c} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
    </svg>
  )
}

export default function LiveStats({ onClose }) {
  const items = useStatItems()
  const [game, setGame] = useState('all')
  const [pickOpen, setPickOpen] = useState(false)
  const [pos, setPos] = useState(() => {
    const p = ls.get('casino-ls-pos', null)
    return p && Number.isFinite(p.x) ? p : { x: Math.max(8, window.innerWidth - W - 24), y: 90 }
  })
  const box = useRef(null)
  const drag = useRef(null)

  const clamp = (p) => {
    const hh = box.current?.offsetHeight || 420
    return { x: Math.min(Math.max(0, p.x), Math.max(0, window.innerWidth - Math.min(W, window.innerWidth))), y: Math.min(Math.max(0, p.y), Math.max(0, window.innerHeight - 60 - 0 * hh)) }
  }
  useEffect(() => {
    const fix = () => setPos((p) => clamp(p))
    fix(); window.addEventListener('resize', fix)
    return () => window.removeEventListener('resize', fix)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const down = (e) => {
    if (e.target.closest('button')) return
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e) => { if (drag.current) setPos(clamp({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy })) }
  const up = () => { if (drag.current) { drag.current = null; ls.set('casino-ls-pos', pos) } }

  const s = summarize(items, game)
  const money = (v, sign) => (
    <b className={sign ? (v > 0 ? styles.pos : v < 0 ? styles.neg : '') : ''}><i className={styles.coin} />{sign && v > 0 ? '+' : ''}{fmt(v)}</b>
  )

  return createPortal(
    <div className={styles.box} ref={box} style={{ left: pos.x, top: pos.y, width: Math.min(W, window.innerWidth - 16) }} role="dialog" aria-label="Live Stats">
      <div className={styles.head} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <span className={styles.title}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></svg>
          Live Stats
        </span>
        <button type="button" onClick={() => resetStats()} aria-label="Reset stats" title="Reset">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 10-2.3 5.700" /><path d="M20 4v7h-7" /></svg>
        </button>
        <button type="button" onClick={onClose} aria-label="Close" title="Close">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div className={styles.pickWrap}>
        <button type="button" className={styles.pick} onClick={() => setPickOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={pickOpen}>
          <b>{GAMES.find((g) => g[0] === game)[1]}</b>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{pickOpen ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}</svg>
        </button>
        {pickOpen && (
          <ul className={styles.list} role="listbox">
            {GAMES.map(([k, l]) => <li key={k} role="option" aria-selected={k === game} className={k === game ? styles.cur : ''} onClick={() => { setGame(k); setPickOpen(false) }}>{l}</li>)}
          </ul>
        )}
      </div>

      <div className={styles.nums}>
        <p><span>Profit</span>{money(s.profit, true)}</p>
        <hr />
        <p><span>Wagered</span>{money(s.wagered)}</p>
      </div>
      <div className={styles.plot}><Chart line={s.line} /></div>
      <div className={styles.wl}>
        <span>Wins <b className={styles.pos}>{s.wins}</b></span>
        <span>Losses <b className={styles.neg}>{s.losses}</b></span>
      </div>
    </div>,
    document.body,
  )
}
