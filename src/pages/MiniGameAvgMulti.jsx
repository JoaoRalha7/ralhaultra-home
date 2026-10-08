import { useState, useEffect, useCallback, useRef } from 'react'
import { supabaseDash } from '../lib/supabase'
import { spendGamePoints, refundGamePoints } from '../lib/points'
import { useAuth } from '../hooks/useAuth'
import { useStreamElementsPoints } from '../hooks/useStreamElementsPoints'
import styles from './MiniGame.module.css'
import avgStyles from './MiniGameAvgMulti.module.css'
import {
  parseBet, fmtTime, fmtDate, useCountdown,
  Spinner, Medal, LockIcon, ChevronIcon,
  AVG_BUCKETS, getBucket
} from '../lib/miniGamesUtils'

const AVG_COST      = 100

// ── History List ───────────────────────────────────────────────────────────────
function AvgHistoryList({ games, onSelect, twitchUser }) {
  const [entriesMap, setEntriesMap] = useState({})

  useEffect(() => {
    const load = async () => {
      const ids = games.filter(g => g.status === 'finished').map(g => g.id)
      if (!ids.length) return
      const { data } = await supabaseDash
        .from('avg_multi_entries').select('game_id, twitch_username, guess, gap, rank, points_awarded')
        .in('game_id', ids).not('rank', 'is', null)
      if (!data) return
      const map = {}
      for (const e of data) {
        if (!map[e.game_id]) map[e.game_id] = []
        map[e.game_id].push(e)
      }
      setEntriesMap(map)
    }
    load()
  }, [games])

  if (!games.length) return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <p className={styles.emptyTitle}>No history yet</p>
      <p className={styles.emptySub}>Finished Avg Multi games will appear here.</p>
    </div>
  )

  return (
    <div className={styles.histList}>
      {games.map((g, i) => {
        const gameNum = games.length - i
        const winners = (entriesMap[g.id] || []).sort((a, b) => a.rank - b.rank)
        const myEntry = (entriesMap[g.id] || []).find(e => e.twitch_username?.toLowerCase() === twitchUser?.toLowerCase())
        return (
          <button key={g.id} className={styles.histCard} onClick={() => onSelect(i)}>
            <div className={styles.histCardLeft}>
              <div className={styles.histCardNum}>Avg Multi #{gameNum}</div>
              {g.bonus_hunts?.title && <div className={styles.histCardHunt}>{g.bonus_hunts.title}</div>}
              {g.result_avg > 0 && <div className={styles.histCardHunt}>Result: {g.result_avg}x</div>}
            </div>
            <div className={styles.histCardDiv} />
            <div className={styles.histCardWinners}>
              {winners.slice(0, 3).map((e, wi) => (
                <div key={e.twitch_username} className={styles.histWinnerPill}>
                  <Medal pos={wi+1} size={10} />
                  <span>{e.twitch_username}</span>
                  {e.gap != null && <span className={styles.histWinAmt}>±{parseBet(e.gap).toFixed(1)}x</span>}
                </div>
              ))}
              {!winners.length && <span className={styles.histNoPicks}>no results</span>}
            </div>
            <div className={styles.histCardRight}>
              {myEntry && <div className={styles.histMyBadge}><LockIcon size={8} /> your guess</div>}
              <span className={styles.histDate}>{fmtDate(g.created_at)}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{opacity:.3}}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Confirm Dialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ bucket, guess, cost, points, onConfirm, onCancel, loading }) {
  const canAfford = points != null && points >= cost
  return (
    <div className={styles.confirmBackdrop} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className={styles.confirmBox}>
        <div className={styles.confirmTitle}>Confirm your guess</div>
        <div className={styles.confirmSlotName}>
          {bucket ? `${bucket.id}: ${bucket.label}` : `${parseBet(guess).toFixed(1)}x`}
        </div>
        {bucket && guess && (
          <div style={{fontSize:12, color:'rgba(232,238,252,.3)'}}>
            exact: {parseBet(guess).toFixed(1)}x
          </div>
        )}

        <div className={styles.confirmCostRow}>
          <span className={styles.confirmCostLabel}>Entry cost</span>
          <span className={styles.confirmCostVal}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
            {cost.toLocaleString('en-GB')} pts
          </span>
        </div>

        <div className={styles.confirmBalanceRow}>
          <span className={styles.confirmBalanceLabel}>Your balance</span>
          <span className={`${styles.confirmBalanceVal} ${!canAfford ? styles.confirmBalanceInsuff : ''}`}>
            {points == null ? '…' : points.toLocaleString('en-GB')} pts
          </span>
        </div>

        {!canAfford && points != null && (
          <div className={styles.confirmWarning}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Not enough points to enter.
          </div>
        )}

        <div className={styles.confirmActions}>
          <button className={styles.confirmCancel} onClick={onCancel} disabled={loading}>Cancel</button>
          <button className={styles.confirmOk} onClick={onConfirm} disabled={loading || !canAfford}>
            {loading ? <Spinner size={14} /> : 'Lock in guess'}
          </button>
        </div>
        <p className={styles.confirmNote}>One guess per game. No changes after confirmation.</p>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MiniGameAvgMulti({ huntId = null, compact = false }) {
  const { user, profile } = useAuth()

  const [games,        setGames]        = useState([])
  const [idx,          setIdx]          = useState(0)
  const [entries,      setEntries]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [loadingGame,  setLoadingGame]  = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [confirm,      setConfirm]      = useState(null) // { bucket, guess }
  const [showHistory,  setShowHistory]  = useState(false)
  const [toast,        setToast]        = useState(null)
  const [selectedBucket, setSelectedBucket] = useState(null)
  const toastRef = useRef(null)

  const twitchUser = profile?.twitch_username || user?.user_metadata?.name || null
  const { points, setPoints, loading: ptsLoading, refresh: refreshPoints } =
    useStreamElementsPoints(twitchUser)

  const game     = games[idx] || null
  const isActive = idx === 0
  const secs     = useCountdown(isActive ? game?.closes_at : null)
  const isOpen   = game?.status === 'open' && secs > 0
  const isFinished = game?.status === 'finished'
  const isClosed   = game?.status === 'closed'

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type })
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 3500)
  }

  const loadAllGames = useCallback(async () => {
    const { data: gamesData } = await supabaseDash
      .from('avg_multi_games').select('*')
      .match(huntId ? { hunt_id: huntId } : {})
      .in('status', ['open', 'closed', 'finished'])
      .order('created_at', { ascending: false }).limit(50)

    if (!gamesData?.length) { setGames([]); setLoading(false); return }

    const huntIds = [...new Set(gamesData.map(g => g.hunt_id).filter(Boolean))]
    const { data: huntsData } = huntIds.length
      ? await supabaseDash.from('bonus_hunts').select('id, title, date').in('id', huntIds)
      : { data: [] }

    const huntMap = {}
    for (const h of (huntsData || [])) huntMap[h.id] = h

    setGames(gamesData.map(g => ({ ...g, bonus_hunts: g.hunt_id ? huntMap[g.hunt_id] || null : null })))
    setLoading(false)
  }, [huntId])

  useEffect(() => { loadAllGames() }, [loadAllGames])

  const loadGameData = useCallback(async (g) => {
    if (!g) { setEntries([]); return }
    setLoadingGame(true)
    const { data } = await supabaseDash.from('avg_multi_entries').select('*')
      .eq('game_id', g.id).order('created_at', { ascending: true })
    setEntries(data || [])
    setLoadingGame(false)
  }, [])

  useEffect(() => { if (!loading) loadGameData(game) }, [game?.id, loading]) // eslint-disable-line

  useEffect(() => {
    if (!game || !isActive) return
    const ch = supabaseDash.channel(`avg-pub-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avg_multi_entries', filter: `game_id=eq.${game.id}` },
        async () => {
          const { data } = await supabaseDash.from('avg_multi_entries').select('*').eq('game_id', game.id).order('created_at', { ascending: true })
          setEntries(data || [])
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'avg_multi_games', filter: `id=eq.${game.id}` },
        (payload) => setGames(prev => prev.map(g => g.id === payload.new.id ? { ...g, ...payload.new } : g)))
      .subscribe()
    return () => ch.unsubscribe()
  }, [game?.id, isActive])

  useEffect(() => {
    const ch = supabaseDash.channel('avg-games-new')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avg_multi_games' }, (p) => {
        loadAllGames()
        if (p.eventType === 'INSERT') setIdx(0)
      })
      .subscribe()
    const poll = setInterval(() => { if (!document.hidden) loadAllGames() }, 10000)
    return () => { ch.unsubscribe(); clearInterval(poll) }
  }, [loadAllGames])

  const goLeft  = () => { setIdx(i => Math.min(i + 1, games.length - 1)); setShowHistory(false) }
  const goRight = () => { setIdx(i => Math.max(i - 1, 0)); setShowHistory(false) }

  const requestSubmit = (bucket) => {
    if (!user || !twitchUser) { showToast('Log in with Twitch to play!', 'error'); return }
    if (!isOpen) { showToast('Game is closed.', 'error'); return }
    if (myEntry) { showToast('You already submitted a guess!', 'error'); return }
    const guessVal = (bucket.min + (bucket.max || bucket.min + 20)) / 2
    setSelectedBucket(bucket)
    setConfirm({ bucket, guess: guessVal })
  }

  const confirmSubmit = async () => {
    const { bucket, guess } = confirm
    if (points != null && points < AVG_COST) { showToast('Not enough points!', 'error'); setConfirm(null); return }
    setSubmitting(true); setConfirm(null)
    try {
      const res = await spendGamePoints('avg')
      if (!res.ok) {
        showToast(res.error === 'insufficient' ? 'Not enough points!' : res.status === 401 ? 'Log in again to play.' : 'Error deducting points. Try again.', 'error')
        setSubmitting(false); return
      }
      if (res.newPoints != null) setPoints(res.newPoints)
      else setPoints(p => Math.max(0, (p ?? 0) - AVG_COST))

      const { error } = await supabaseDash.from('avg_multi_entries').insert({
        game_id: game.id, twitch_username: twitchUser,
        guess, bucket: bucket?.id || null, cost_paid: AVG_COST,
      })
      if (error) {
        if (error.code === '23505') {
          await refundGamePoints('avg')
          setPoints(p => (p ?? 0) + AVG_COST)
          showToast('You already have a guess! Points refunded.', 'error')
        } else { showToast('Error saving guess. Contact the streamer.', 'error') }
      } else {
        const label = bucket ? `${bucket.id}: ${bucket.label}` : `${guess.toFixed(1)}x`
        showToast(`Locked in: ${label}. Good luck!`, 'success')
        setSelectedBucket(null)
        refreshPoints()
      }
    } catch { showToast('Connection error. Try again.', 'error') }
    setSubmitting(false)
  }

  const myEntry         = entries.find(e => e.twitch_username?.toLowerCase() === twitchUser?.toLowerCase())
  const gameNum         = games.length - idx
  const totalPtsAwarded = (game?.points_1st || 0) + (game?.points_2nd || 0) + (game?.points_3rd || 0)
  const canAfford       = points != null && points >= AVG_COST
  const rankedEntries   = isFinished
    ? [...entries].filter(e => e.rank).sort((a, b) => a.rank - b.rank)
    : [...entries].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  // Bucket stats for bar chart
  const bucketCounts = {}
  for (const e of entries) {
    const key = e.bucket || 'exact'
    bucketCounts[key] = (bucketCounts[key] || 0) + 1
  }

  if (loading) return <div className={`${styles.page}${compact ? ` ${styles.compact} ${avgStyles.compact}` : ''}`}><div className={styles.loadWrap}><Spinner size={28} /></div></div>

  return (
    <div className={`${styles.page}${compact ? ` ${styles.compact} ${avgStyles.compact}` : ''}`}>

      {/* STATUS BAR */}
      <div className={styles.statusBar}>
        <button className={styles.barNav} onClick={goLeft} disabled={idx >= games.length - 1}><ChevronIcon dir="left" /></button>
        <div className={styles.barDiv} />
        <span className={`${styles.barDot} ${!game ? styles.barDotIdle : isOpen ? styles.barDotLive : isFinished ? styles.barDotDone : styles.barDotIdle}`} />
        <span className={styles.barTitle}>AVG MULTI {games.length > 0 ? `#${gameNum}` : ''}</span>

        {!game
          ? <span className={styles.barSub} data-st="idle">NO GAMES YET</span>
          : isOpen ? <span className={styles.barSub} data-st="live">LIVE NOW</span>
          : isFinished ? <span className={styles.barSub} data-st="done">FINISHED</span>
          : <span className={styles.barSub} data-st="closed">CLOSED</span>
        }

        {game && (
          <>
            <div className={styles.barDiv} />
            {!isActive
              ? <><span className={styles.barDate}>{fmtDate(game.created_at)}</span>
                  {game.result_avg > 0 && <><div className={styles.barDiv} /><span className={styles.barStat} style={{color:'#fbbf24'}}>{game.result_avg}x result</span></>}</>
              : <div className={styles.barStat}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  {entries.length} guesses
                </div>
            }
            {isOpen && (
              <>
                <div className={styles.barDiv} />
                <div className={styles.barStat}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span className={styles.barTimer}>{fmtTime(secs)}</span>
                </div>
              </>
            )}
            {isFinished && totalPtsAwarded > 0 && (
              <>
                <div className={styles.barDiv} />
                <div className={styles.barStat}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M12 17v4"/><path d="M8 21h8"/><path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/></svg>
                  <span className={styles.barPts}>{totalPtsAwarded.toLocaleString('en-GB')} pts</span>
                </div>
              </>
            )}
            {game?.bonus_hunts?.title && (
              <>
                <div className={styles.barDiv} />
                <a href={`/bonus-hunts?hunt=${game.bonus_hunts.id}`} className={styles.barHuntBadge}>
                  {game.bonus_hunts.title.toUpperCase()}
                </a>
              </>
            )}
            {myEntry && isActive && (
              <>
                <div className={styles.barDiv} />
                <div className={styles.barStat}>
                  <LockIcon size={11} />
                  <span className={styles.barMyPick}>
                    {myEntry.bucket ? `${myEntry.bucket}: ${AVG_BUCKETS.find(b=>b.id===myEntry.bucket)?.label}` : `${parseBet(myEntry.guess).toFixed(1)}x`}
                  </span>
                </div>
              </>
            )}
          </>
        )}

        <div className={styles.barSpacer} />
        {games.length > 1 && <span className={styles.barPager}>{idx + 1} / {games.length}</span>}
        <div className={styles.barDiv} />
        <button className={`${styles.barHistBtn} ${showHistory ? styles.barHistBtnActive : ''}`} onClick={() => setShowHistory(v => !v)}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          History
        </button>
        <div className={styles.barDiv} />
        <button className={styles.barNav} onClick={() => { goRight(); setShowHistory(false) }} disabled={idx === 0}><ChevronIcon dir="right" /></button>
      </div>

      {/* HISTORY */}
      {showHistory && <AvgHistoryList games={games} twitchUser={twitchUser} onSelect={(i) => { setIdx(i); setShowHistory(false) }} />}

      {/* NO GAME */}
      {!showHistory && !game && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
            </svg>
          </div>
          <p className={styles.emptyTitle}>No active Avg Multi</p>
          <p className={styles.emptySub}>The streamer hasn't opened a game yet. Stay tuned!</p>
        </div>
      )}

      {/* GAME */}
      {!showHistory && game && (
        <>
          {loadingGame ? <div className={styles.loadWrap}><Spinner size={24} /></div> : (
            <div className={styles.gtbLayout}>
              <div className={styles.gtbLeft}>

                {/* Cost banner */}
                {isOpen && !myEntry && (
                  <div className={`${styles.costBanner} ${!canAfford && !ptsLoading && user ? styles.costBannerDanger : ''}`}>
                    <div className={styles.costLeft}>
                      <div className={styles.costIcon}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
                      </div>
                      <span>Entry: <strong>{AVG_COST} points</strong></span>
                    </div>
                    <div className={styles.costRight}>
                      {!user ? <span className={styles.costHint}>Login to play</span>
                        : ptsLoading ? <Spinner size={12} />
                        : <span className={`${styles.costBalance} ${!canAfford ? styles.costBalanceLow : ''}`}>
                            Balance: <strong>{(points ?? 0).toLocaleString('en-GB')} pts</strong>
                            {!canAfford && <span className={styles.costInsuff}> — insufficient</span>}
                          </span>
                      }
                    </div>
                  </div>
                )}

                {/* My entry banner */}
                {myEntry && (
                  <div className={styles.myPickBanner}>
                    <div className={styles.myPickImgWrap} style={{background:'rgba(99,102,241,.1)', border:'1px solid rgba(99,102,241,.2)'}}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                      </svg>
                    </div>
                    <div className={styles.myPickInfo}>
                      <div className={styles.myPickLabel}>Your guess</div>
                      <div className={styles.myPickName}>
                        {myEntry.bucket ? `${myEntry.bucket}: ${AVG_BUCKETS.find(b=>b.id===myEntry.bucket)?.label}` : `${parseBet(myEntry.guess).toFixed(1)}x`}
                      </div>
                      {myEntry.gap != null && <div className={styles.myPickProvider}>Gap: ±{parseBet(myEntry.gap).toFixed(1)}x</div>}
                    </div>
                    <div className={styles.myPickMeta}>
                      <div className={styles.myPickCost}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
                        {AVG_COST} pts spent
                      </div>
                      {myEntry.rank
                        ? <div className={styles.myPickLocked}><Medal pos={myEntry.rank} size={11} /> {myEntry.rank === 1 ? '1st' : myEntry.rank === 2 ? '2nd' : '3rd'} place</div>
                        : <div className={styles.myPickLocked}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>Locked in</div>
                      }
                    </div>
                  </div>
                )}

                {/* Range tiles: pick a range while open, live distribution afterwards */}
                {(isActive || isFinished || isClosed) && (
                  <div className={avgStyles.tiles}>
                    {isOpen && !myEntry && <div className={avgStyles.tilesHint}>Pick the range you think the average will land in</div>}
                    <div className={avgStyles.tileGrid}>
                      {AVG_BUCKETS.map(b => {
                        const count = bucketCounts[b.id] || 0
                        const pct = entries.length ? Math.round((count / entries.length) * 100) : 0
                        const isWinBucket = isFinished && game.result_avg
                          ? b.min <= game.result_avg && (b.max === null || game.result_avg <= b.max)
                          : false
                        const mine = myEntry?.bucket === b.id
                        const pickable = isOpen && !myEntry && !submitting
                        return (
                          <button
                            key={b.id}
                            type="button"
                            disabled={!pickable}
                            onClick={() => pickable && requestSubmit(b)}
                            className={[avgStyles.tile, pickable ? avgStyles.tilePick : '', isWinBucket ? avgStyles.tileWin : '', mine ? avgStyles.tileMine : ''].filter(Boolean).join(' ')}
                            style={{ '--bcolor': b.color }}
                          >
                            <i className={avgStyles.tileFill} style={{ height: `${pct}%` }} />
                            <span className={avgStyles.tileTop}>
                              <span className={avgStyles.tileId}>{b.id}</span>
                              {isWinBucket && <span className={avgStyles.tileTag}>Win</span>}
                              {!isWinBucket && mine && <span className={`${avgStyles.tileTag} ${avgStyles.tileTagMine}`}>You</span>}
                              {submitting && selectedBucket?.id === b.id && <Spinner size={10} />}
                            </span>
                            <span className={avgStyles.tileRange}>{b.label}</span>
                            <span className={avgStyles.tileBottom}>
                              <b>{pct}%</b>
                              <em>{count}</em>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {isFinished && game.result_avg != null && <div className={avgStyles.tilesFinal}>Final average <b>{Number(game.result_avg).toFixed(1)}x</b></div>}
                  </div>
                )}
              </div>

              {/* SIDEBAR — only the final results; the live guess list is gone */}
              {entries.length > 0 && isFinished && (
                <aside className={styles.sidebar}>
                  <div className={styles.sidebarHead}>
                    {isFinished
                      ? <><Medal pos={1} size={11} /><span>Final Results</span></>
                      : <><span className={styles.sidebarHeadIcon}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></span><span>Guesses</span></>
                    }
                    <span className={styles.sidebarCount}>{entries.length}</span>
                  </div>
                  <div className={styles.sidebarRows}>
                    {rankedEntries.map(e => {
                      const isMe = e.twitch_username?.toLowerCase() === twitchUser?.toLowerCase()
                      const bucket = AVG_BUCKETS.find(b => b.id === e.bucket)
                      return (
                        <div key={e.id} className={[styles.sidebarRow, e.rank ? styles.sidebarRowRanked : '', isMe ? styles.sidebarRowMe : ''].filter(Boolean).join(' ')}>
                          <div className={styles.sidebarRowL}>
                            <span className={styles.sidebarMedal}>
                              {e.rank ? <Medal pos={e.rank} size={13} /> : <span className={styles.sidebarDot}/>}
                            </span>
                            <div className={styles.sidebarInfo}>
                              <div className={`${styles.sidebarUser} ${isMe ? styles.sidebarUserMe : ''}`}>{e.twitch_username}</div>
                              <div className={styles.sidebarSlot}>
                                {bucket ? `${bucket.id}: ${bucket.label}` : `${parseBet(e.guess).toFixed(1)}x`}
                              </div>
                            </div>
                          </div>
                          <div className={styles.sidebarRowR}>
                            {e.gap != null ? (
                              <div className={styles.sidebarResult}>
                                <span className={styles.sidebarMulti}>±{parseBet(e.gap).toFixed(1)}x</span>
                                {e.points_awarded > 0 && <span className={styles.sidebarPrize}>+{e.points_awarded} pts</span>}
                              </div>
                            ) : <span className={styles.sidebarWait}>—</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </aside>
              )}
            </div>
          )}
        </>
      )}

      {confirm && (
        <ConfirmDialog
          bucket={confirm.bucket}
          guess={confirm.guess}
          cost={AVG_COST}
          points={points}
          loading={submitting}
          onConfirm={confirmSubmit}
          onCancel={() => setConfirm(null)}
        />
      )}

      {toast && <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>{toast.msg}</div>}
    </div>
  )
}