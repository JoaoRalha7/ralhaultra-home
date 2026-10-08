import { useState, useEffect } from 'react'
import { Medal } from './Medal'
import { workerGet } from '../lib/vip'
import styles from '../pages/Vip.module.css'

export const fmt = (n) => Number(n || 0).toLocaleString('en-US')

export const Lock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
)
export const Check = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>
)

function countdown(ms) {
  if (ms <= 0) return 'soon'
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`
}

export function Bar({ label, value, max, suffix = '', gold }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 100
  return (
    <div>
      <div className={styles.barHead}>
        <span>{label}</span>
        <b>{fmt(value)}{suffix} <em>/ {fmt(max)}{suffix}</em></b>
      </div>
      <div className={styles.track}><i className={gold ? styles.fillGold : styles.fill} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export function progressOf(levels, me) {
  const cur = levels.find((l) => l.level === me.level) || levels[0]
  const next = levels.find((l) => l.level === me.level + 1) || null
  const hours = me.minutes / 60
  const pct = next ? Math.round(((Math.min(1, me.wagered / next.min_wagered) + Math.min(1, hours / next.min_watch_hours)) / 2) * 100) : 100
  return { cur, next, hours: Math.floor(hours), pct }
}

export function RewardsModal({ levels, me, tab, setTab, onClose }) {
  const { cur, next, hours, pct } = progressOf(levels, me)
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const tabs = [['progress', 'Progress'], ['cashback', 'Cashback'], ['perks', 'Perks']]
  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="VIP Rewards">
        <div className={styles.mHead}>
          <div className={styles.mTitle}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M12 8c-2.5 0-4-1-4-2.5S9.5 3 12 5c2.5-2 4-.5 4 .5S14.5 8 12 8z" /></svg>
            VIP Rewards
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        <div className={styles.tabs}>
          {tabs.map(([k, t]) => <button key={k} className={tab === k ? styles.tabOn : ''} onClick={() => setTab(k)}>{t}</button>)}
        </div>
        <div className={styles.mBody}>
          {tab === 'progress' && (
            <>
              <div className={`${styles.card} ${styles.cardFlat}`}>
                <div className={styles.cardTop}>
                  <Medal level={cur.level} size={48} />
                  <div className={styles.cardName}><b>{cur.name}</b><small>{next ? `Next: ${next.name}` : 'Top rank reached'}</small></div>
                  <div className={styles.pct}>{pct}%</div>
                </div>
                {next && <><Bar label="Points wagered" value={me.wagered} max={Number(next.min_wagered)} /><Bar label="Hours watched" value={hours} max={next.min_watch_hours} suffix="h" gold /></>}
              </div>
              <div className={styles.listHead}>Ranks and perks</div>
              <div className={styles.list}>
                {levels.map((l) => {
                  const st = l.level < me.level ? 'done' : l.level === me.level ? 'cur' : 'lock'
                  return (
                    <div key={l.level} className={`${styles.row} ${st === 'cur' ? styles.rowCur : ''} ${st === 'lock' ? styles.rowLock : ''}`}>
                      <Medal level={l.level} size={28} />
                      <div className={styles.rowName}>{l.name} <small>{Number(l.bonus_mult) ? `· +${Number(l.bonus_mult)}x ` : '· '}{Number(l.cashback_pct)}% cashback</small></div>
                      {st === 'cur' ? <span className={styles.pill}>Current</span> : st === 'done' ? <span className={styles.okTxt}><Check />Unlocked</span> : <span className={styles.lockTxt}><Lock />Locked</span>}
                    </div>
                  )
                })}
              </div>
            </>
          )}
          {tab === 'cashback' && (
            <>
              <div className={`${styles.card} ${styles.cardFlat}`}>
                <div className={styles.cbTop}>
                  <div><small>Estimated this week</small><div className={styles.cbBig}>+{fmt(me.cashbackEst)} <span>pts</span></div></div>
                  <div className={styles.cbR}><small>Paid out in</small><b>{countdown(me.nextPayoutMs)}</b></div>
                </div>
                <div className={styles.cbRow}>
                  <div><small>Net losses</small><b>{fmt(me.weekLoss)}</b></div>
                  <div><small>Your rate ({cur.name})</small><b>{me.cashbackPct}%</b></div>
                </div>
                <Bar label="Weekly cap" value={me.cashbackEst} max={me.cashbackCap} gold />
              </div>
              <p className={styles.note}>Cashback is paid every Monday on your net losses only. Wins reduce it. Rank up to raise your rate.</p>
            </>
          )}
          {tab === 'perks' && (
            <div className={styles.list}>
              {[
                ['Watch bonus', 'Earn more points per hour while the stream is live. Stacks with your sub multiplier.'],
                ['Weekly cashback', 'A share of your net casino losses comes back every Monday, up to the weekly cap.'],
                ['Higher payouts, same rules', 'Ranks never change the odds. They only reward time and activity.'],
              ].map(([t, d]) => (
                <div key={t} className={styles.perk}><b>{t}</b><span>{d}</span></div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.mFoot}>Both wagered points and hours watched are needed to rank up.</div>
      </div>
    </div>
  )
}


// Opens the rewards modal from anywhere (user menu, Originals): loads the VIP data itself and keeps it fresh while open.
export default function RewardsPanel({ open, onClose, initialTab = 'progress' }) {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState(initialTab)
  useEffect(() => {
    if (!open) return
    setTab(initialTab)
    let alive = true
    const load = () => workerGet('/vip').then((d) => { if (alive) setData(d || { levels: [], me: null }) })
    load()
    const t = setInterval(() => { if (!document.hidden) load() }, 15000)
    return () => { alive = false; clearInterval(t) }
  }, [open, initialTab])
  if (!open) return null
  const levels = data?.levels || []
  if (!data) return null
  if (!data.me || !levels.length) {
    return (
      <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className={styles.modal} style={{ padding: 28, textAlign: 'center' }}>
          <p className={styles.muted}>Could not load your rewards. Try again in a moment.</p>
          <button className={styles.btn} style={{ width: '100%' }} onClick={onClose}>Close</button>
        </div>
      </div>
    )
  }
  return <RewardsModal levels={levels} me={data.me} tab={tab} setTab={setTab} onClose={onClose} />
}
