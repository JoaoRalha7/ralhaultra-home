import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { WORKER } from '../lib/points'
import { Medal, RANK_NAMES } from './Medal'
import TwitchAvatar from './TwitchAvatar'
import { Icon } from './Icon'
import s from './PlayerModal.module.css'

const GAME_NAME = { mines: 'Mines', blackjack: 'Blackjack', crash: 'Crash', keno: 'Keno', plinko: 'Plinko', roulette: 'Roulette' }
const GAME_ICON = { mines: 'mines', blackjack: 'cards', crash: 'crash', keno: 'keno', plinko: 'plinko', roulette: 'roulette' }
const fmt = (n) => Number(n || 0).toLocaleString('en-GB')

// open from anywhere: openPlayer('name')
export const openPlayer = (name) => window.dispatchEvent(new CustomEvent('open-player', { detail: String(name || '') }))

export function PlayerModalHost() {
  const [name, setName] = useState(null)
  useEffect(() => {
    const on = (e) => { const n = String(e.detail || '').replace(/^@/, '').trim().toLowerCase(); if (n) setName(n) }
    window.addEventListener('open-player', on)
    return () => window.removeEventListener('open-player', on)
  }, [])
  return name ? <PlayerModal name={name} onClose={() => setName(null)} /> : null
}

function PlayerModal({ name, onClose }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('stats')
  useEffect(() => {
    let off = false
    setD(null); setErr('')
    fetch(`${WORKER}/player?u=${encodeURIComponent(name)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => { if (!off) setD(j) })
      .catch((c) => { if (!off) setErr(c === 404 ? 'Player not found.' : 'Could not load this profile.') })
    return () => { off = true }
  }, [name])
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [onClose])
  const st = d?.stats
  const lvl = d?.level || 0
  const joined = d?.joined ? new Date(d.joined).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  return createPortal(
    <div className={s.back} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true" aria-label="Player profile">
      <div className={s.modal}>
        <div className={s.head}>
          <span className={s.hTitle}><Icon name="users" size={14} /> Profile</span>
          <button type="button" className={s.x} onClick={onClose} aria-label="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        <div className={s.card}>
          <div className={s.who}>
            <TwitchAvatar name={name} map={d?.avatar ? { [name]: d.avatar } : { [name]: `https://unavatar.io/twitch/${encodeURIComponent(name)}?fallback=false` }} size={54} />
            <b>{name}</b>
          </div>
          <div className={s.meta}>
            <span className={s.rank}><Medal level={lvl} size={22} /> {RANK_NAMES[lvl] || 'Member'}</span>
            {joined && <span className={s.joined}>Joined {joined}</span>}
          </div>
        </div>
        {err && <p className={s.err}>{err}</p>}
        {!d && !err && <p className={s.load}>Loading...</p>}
        {d && (
          <>
            <div className={s.tabs} role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'stats'} className={tab === 'stats' ? s.on : ''} onClick={() => setTab('stats')}>Statistics</button>
              <button type="button" role="tab" aria-selected={tab === 'games'} className={tab === 'games' ? s.on : ''} onClick={() => setTab('games')}>Games</button>
            </div>
            {tab === 'stats' && (
              <div className={s.tiles}>
                <div><small>Total Bets</small><b>{fmt(st.bets)}</b></div>
                <div><small>Number of Wins</small><b>{fmt(st.wins)}</b></div>
                <div><small>Number of Losses</small><b>{fmt(st.losses)}</b></div>
                <div><small>Wagered</small><b><i className={s.coin} />{fmt(st.wagered)}</b></div>
                <div><small>Biggest Win</small><b className={s.pos}><i className={s.coin} />{fmt(st.bestWin)}</b></div>
                <div><small>Best Multiplier</small><b>{st.bestMult ? `${st.bestMult}x` : '-'}</b></div>
              </div>
            )}
            {tab === 'games' && (
              <div className={s.list}>
                {d.games.length === 0 && <p className={s.load}>No bets yet.</p>}
                {d.games.map((g) => (
                  <div key={g.game} className={s.gRow}>
                    <span className={s.gName}><Icon name={GAME_ICON[g.game] || 'originals'} size={16} />{GAME_NAME[g.game] || g.game}</span>
                    <span className={s.gBets}>{fmt(g.bets)} bets</span>
                    <span className={s.gWag}>{fmt(g.wagered)} <i className={s.coin} /></span>
                    <span className={g.profit >= 0 ? s.pos : s.neg}>{g.profit >= 0 ? '+' : ''}{fmt(g.profit)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
