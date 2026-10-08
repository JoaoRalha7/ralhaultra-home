import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { WORKER } from '../lib/points'
import { Medal, Medal3D, RANK_COLORS } from '../components/Medal'
import { RewardsModal, Lock, Check, Bar, progressOf, fmt } from '../components/RewardsModal'
import styles from './Vip.module.css'


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
  useEffect(() => {
    load()
    const t = setInterval(() => { if (!document.hidden) load() }, 15000) // live: wagered, rank and cashback refresh while the page is open
    return () => clearInterval(t)
  }, [load])
  return { data, error, reload: load }
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
    <div className={`${styles.rank} ${state === 'current' ? styles.rankCur : ''} ${state === 'locked' ? styles.rankLocked : ''}`} style={{ '--rc': RANK_COLORS[l.level] }}>
      <div className={styles.stage}><Medal3D level={l.level} size={84} delay={l.level * 0.9} /></div>
      <h3>{l.name}</h3>
      <ul>
        <li>{Number(l.min_wagered) ? `${fmt(l.min_wagered)} wagered` : 'Free for everyone'}</li>
        <li>{l.min_watch_hours ? `${l.min_watch_hours}h watched` : 'Join the chat'}</li>
        <li>{Number(l.bonus_mult) ? `+${Number(l.bonus_mult)}x watch bonus` : 'Base watch rate'}</li>
        <li>{Number(l.cashback_pct)}% weekly cashback</li>
        {Number(l.daily_boost_pct) > 0 && <li>+{l.daily_boost_pct}% daily reward</li>}
        {Number(l.levelup_reward) > 0 && <li>{fmt(l.levelup_reward)} pts level-up reward</li>}
      </ul>
      <span className={`${styles.tag} ${state === 'current' ? styles.tagCur : state === 'done' ? styles.tagDone : ''}`}>
        {state === 'current' ? 'Current' : state === 'done' ? <><Check />Unlocked</> : <><Lock />Locked</>}
      </span>
    </div>
  )
}


function Faq({ levels }) {
  const [open, setOpen] = useState(null)
  const top = levels[levels.length - 1]
  const items = [
    ['How do I rank up?', 'Watch the stream and play the Originals. You need enough hours watched and enough points wagered.'],
    ['Do I need both hours and wager?', 'Yes. Both bars have to be full to reach the next rank.'],
    ['Does my wager go down if I win?', 'No. Every bet counts, win or lose.'],
    ['What do I get when I rank up?', 'A one-time reward for each new rank. Open your rewards and press Claim.'],
    ['What is the daily boost?', 'A bonus on your daily reward that grows with your rank, up to +' + (top?.daily_boost_pct ?? 25) + '% at ' + (top?.name || 'Diamond') + '.'],
    ['How does cashback work?', 'Every Monday you get back a percentage of last week\'s net losses. If you won, there is no cashback.'],
    ['Why is my rank not updating?', 'It updates every hour and after your bets. Reload the page if it still looks wrong.'],
    ['Do ranks change my odds?', 'No. Every game is provably fair for everyone.'],
  ]
  const cols = [items.filter((_, i) => i % 2 === 0), items.filter((_, i) => i % 2 === 1)]
  return (
    <>
      <h2 className={styles.h2}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ verticalAlign: '-3px', marginRight: 8 }}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></svg>Frequently asked</h2>
      <div className={styles.faq}>
        {cols.map((col, c) => (
          <div key={c} className={styles.faqCol}>
            {col.map(([q, a]) => (
              <div key={q} className={`${styles.faqItem} ${open === q ? styles.faqOpen : ''}`}>
                <button type="button" aria-expanded={open === q} onClick={() => setOpen(open === q ? null : q)}>
                  <span>{q}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                {open === q && <p>{a}</p>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className={styles.note} style={{ marginTop: 14 }}><a href="/rules" style={{ color: 'var(--acc2)' }}>Read the full Site Rules</a></p>
    </>
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
              <div className={styles.cardName}><b>{error || user ? 'Could not load' : 'Your rank'}</b><small>{error || user ? 'Try again in a moment' : 'Log in to see your progress'}</small></div>
            </div>
            {error || user ? <button className={styles.btn} onClick={reload}>Retry</button>
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

      {levels.length > 0 && <Faq levels={levels} />}

      {modal && me && levels.length > 0 && <RewardsModal levels={levels} me={me} tab={modal} setTab={setModal} onClose={() => setModal(null)} />}
    </div>
  )
}
