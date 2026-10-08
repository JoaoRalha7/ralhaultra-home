import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { WORKER } from '../lib/points'
import styles from './Vip.module.css'

const COLORS = ['#5a6378', '#c27a3e', '#a2abc0', '#e0a82e', '#2fb8a6', '#8a82e0']
const fmt = (n) => Number(n || 0).toLocaleString('en-US')

function Glyph({ level }) {
  const star = <path d="M22 12l3 6 6.5.9-4.7 4.6 1.1 6.5L22 26.9 16.1 30l1.1-6.5-4.7-4.6 6.5-.9z" fill="rgba(255,255,255,.88)" />
  if (level === 0) return <circle cx="22" cy="22" r="5" fill="rgba(255,255,255,.8)" />
  if (level === 3) return <path d="M13 16l5 5 4-7 4 7 5-5-2 12H15z" fill="rgba(255,255,255,.92)" />
  if (level === 4) return <path d="M22 11l9 3.5v6c0 5-3.6 8.6-9 11-5.4-2.4-9-6-9-11v-6z" fill="rgba(255,255,255,.9)" />
  if (level === 5) return <path d="M14 18l3-4h10l3 4-8 12z" fill="rgba(255,255,255,.92)" />
  return star
}

export function Medal({ level, size = 44 }) {
  const c = COLORS[level] || COLORS[0]
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r="20" fill={c} />
      <circle cx="22" cy="22" r="15" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.5" />
      <Glyph level={level} />
    </svg>
  )
}

const Lock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
)
const Check = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>
)

function countdown(ms) {
  if (ms <= 0) return 'soon'
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`
}

function useVip() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const load = useCallback(async () => {
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s?.session?.access_token
      const r = await fetch(`${WORKER}/vip`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) throw new Error('vip')
      setData(await r.json()); setError(false)
    } catch { setError(true) }
  }, [])
  useEffect(() => { load() }, [load])
  return { data, error, reload: load }
}

function Bar({ label, value, max, suffix = '', gold }) {
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

function progressOf(levels, me) {
  const cur = levels.find((l) => l.level === me.level) || levels[0]
  const next = levels.find((l) => l.level === me.level + 1) || null
  const hours = me.minutes / 60
  const pct = next ? Math.round(((Math.min(1, me.wagered / next.min_wagered) + Math.min(1, hours / next.min_watch_hours)) / 2) * 100) : 100
  return { cur, next, hours: Math.floor(hours), pct }
}

function ProgressCard({ levels, me, onOpen }) {
  const { cur, next, hours, pct } = progressOf(levels, me)
  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <Medal level={cur.level} size={52} />
        <div className={styles.cardName}>
          <b>{cur.name}</b>
          <small>{next ? `Next: ${next.name}` : 'Top rank reached'}</small>
        </div>
        <div className={styles.pct}>{pct}%</div>
      </div>
      {next ? (
        <>
          <Bar label="Points wagered" value={me.wagered} max={Number(next.min_wagered)} />
          <Bar label="Hours watched" value={hours} max={next.min_watch_hours} suffix="h" gold />
        </>
      ) : <p className={styles.muted}>You are at the highest rank. Thank you for being here.</p>}
      <button className={styles.btn} onClick={() => onOpen('progress')}>View my rewards</button>
    </div>
  )
}

function RankCard({ l, me }) {
  const state = !me ? 'locked' : l.level < me.level ? 'done' : l.level === me.level ? 'current' : 'locked'
  return (
    <div className={`${styles.rank} ${state === 'current' ? styles.rankCur : ''} ${state === 'locked' ? styles.rankLocked : ''}`}>
      <Medal level={l.level} size={56} />
      <h3>{l.name}</h3>
      <ul>
        <li>{Number(l.min_wagered) ? `${fmt(l.min_wagered)} wagered` : 'Free for everyone'}</li>
        <li>{l.min_watch_hours ? `${l.min_watch_hours}h watched` : 'Join the chat'}</li>
        <li>{Number(l.bonus_mult) ? `+${Number(l.bonus_mult)}x watch bonus` : 'Base watch rate'}</li>
        <li>{Number(l.cashback_pct)}% weekly cashback</li>
      </ul>
      <span className={`${styles.tag} ${state === 'current' ? styles.tagCur : state === 'done' ? styles.tagDone : ''}`}>
        {state === 'current' ? 'Current' : state === 'done' ? <><Check />Unlocked</> : <><Lock />Locked</>}
      </span>
    </div>
  )
}

function RewardsModal({ levels, me, tab, setTab, onClose }) {
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

export default function Vip() {
  const { user, signInWithTwitch } = useAuth()
  const { data, error, reload } = useVip()
  const [modal, setModal] = useState(null)
  const levels = data?.levels || []
  const me = data?.me || null

  useEffect(() => { reload() }, [user, reload])

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>VIP Club</span>
          <h1>Watch. Play. Level up.</h1>
          <p>Every hour you watch and every point you play moves you up the ranks. Higher ranks earn more points while you watch and a bigger weekly cashback.</p>
        </div>
        {me && levels.length > 0 ? (
          <ProgressCard levels={levels} me={me} onOpen={setModal} />
        ) : (
          <div className={styles.card}>
            <div className={styles.cardTop}>
              <Medal level={0} size={52} />
              <div className={styles.cardName}><b>{error ? 'Could not load' : 'Your rank'}</b><small>{error ? 'Try again in a moment' : 'Log in to see your progress'}</small></div>
            </div>
            {error ? <button className={styles.btn} onClick={reload}>Retry</button>
              : <button className={styles.btn} onClick={signInWithTwitch}>Log in with Twitch</button>}
          </div>
        )}
      </section>

      <h2 className={styles.h2}>VIP Ranks</h2>
      {!data && !error ? <div className={styles.loading}><div className={styles.spinner} />Loading ranks</div> : (
        <div className={styles.ranks}>{levels.map((l) => <RankCard key={l.level} l={l} me={me} />)}</div>
      )}

      <h2 className={styles.h2}>How ranks work</h2>
      <div className={styles.how}>
        {[
          ['Watch the stream', 'You earn points every minute while the stream is live. Subs earn more.'],
          ['Play and wager', 'Points you wager on the originals and mini games count toward your next rank.'],
          ['Earn cashback', 'Every Monday a percentage of your net losses comes back, based on your rank.'],
        ].map(([t, d], i) => (
          <div key={t} className={styles.howCard}><span>{i + 1}</span><b>{t}</b><p>{d}</p></div>
        ))}
      </div>

      {modal && me && levels.length > 0 && <RewardsModal levels={levels} me={me} tab={modal} setTab={setModal} onClose={() => setModal(null)} />}
    </div>
  )
}
