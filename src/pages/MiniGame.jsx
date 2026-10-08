import { useState, useEffect, useCallback, useRef } from 'react'
import { supabaseDash } from '../lib/supabase'
import { spendGamePoints, refundGamePoints } from '../lib/points'
import { useAuth } from '../hooks/useAuth'
import { useStreamElementsPoints } from '../hooks/useStreamElementsPoints'
import styles from './MiniGame.module.css'
import { parseBet, fmtTime, fmtDate, useCountdown, Spinner, Medal, LockIcon, ChevronIcon } from '../lib/miniGamesUtils'

const PICK_COST     = 100

// ── Confirm Dialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ entry, cost, points, onConfirm, onCancel, loading }) {
  const canAfford = points != null && points >= cost
  return (
    <div className={styles.confirmBackdrop} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className={styles.confirmBox}>
        <div className={styles.confirmSlotImg}>
          {entry.slot?.image_url
            ? <img src={entry.slot.image_url} alt={entry.slot?.name} />
            : <div className={styles.confirmSlotFallback}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M8 6V4a2 2 0 0 1 4 0v2"/></svg></div>
          }
        </div>
        <div className={styles.confirmTitle}>Confirm your pick</div>
        <div className={styles.confirmSlotName}>{entry.slot?.name || '—'}</div>
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
            {loading ? <Spinner size={14} /> : 'Confirm pick'}
          </button>
        </div>
        <p className={styles.confirmNote}>First to confirm keeps the slot. No refunds.</p>
      </div>
    </div>
  )
}

// ── History List ──────────────────────────────────────────────────────────────
function HistoryList({ games, onSelect, twitchUser }) {
  const [picksMap, setPicksMap] = useState({})  // gameId → picks[]

  useEffect(() => {
    const load = async () => {
      const ids = games.filter(g => g.status === 'finished').map(g => g.id)
      if (!ids.length) return
      const { data } = await supabaseDash
        .from('picks')
        .select('game_id, twitch_username, rank, win_amount, points_awarded')
        .in('game_id', ids)
        .not('rank', 'is', null)
      if (!data) return
      const map = {}
      for (const p of data) {
        if (!map[p.game_id]) map[p.game_id] = []
        map[p.game_id].push(p)
      }
      setPicksMap(map)
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
      <p className={styles.emptySub}>Finished games will appear here.</p>
    </div>
  )

  return (
    <div className={styles.histList}>
      {games.map((g, i) => {
        const gameNum  = games.length - i
        const winners  = (picksMap[g.id] || []).sort((a, b) => a.rank - b.rank)
        const myPick   = winners.find(p => p.twitch_username?.toLowerCase() === twitchUser?.toLowerCase())
          || (picksMap[g.id] || []).find(p => p.twitch_username?.toLowerCase() === twitchUser?.toLowerCase())
        const huntTitle = g.bonus_hunts?.title || null

        return (
          <button key={g.id} className={styles.histCard} onClick={() => onSelect(i)}>

            <div className={styles.histCardLeft}>
              <div className={styles.histCardNum}>Pick & Win #{gameNum}</div>
              {huntTitle && <div className={styles.histCardHunt}>{huntTitle}</div>}
            </div>

            <div className={styles.histCardDiv} />

            <div className={styles.histCardWinners}>
              {winners.slice(0, 3).map((p, wi) => (
                <div key={p.twitch_username} className={styles.histWinnerPill}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke={['#fbbf24','#94a3b8','#cd7c54'][wi]} strokeWidth="2.2"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
                    <path d="M12 17v4"/><path d="M8 21h8"/>
                    <path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/>
                  </svg>
                  <span>{p.twitch_username}</span>
                  {p.win_amount > 0 && (
                    <span className={styles.histWinAmt}>€{parseBet(p.win_amount).toFixed(2)}</span>
                  )}
                </div>
              ))}
              {!winners.length && g.status !== 'finished' && (
                <span className={styles.histNoPicks}>in progress</span>
              )}
            </div>

            <div className={styles.histCardRight}>
              {myPick && (
                <div className={styles.histMyBadge}>
                  <LockIcon size={8} /> your pick
                </div>
              )}
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

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MiniGame({ huntId = null, embedded = false }) {
  const { user, profile } = useAuth()

  // All games list (active + finished), newest first = index 0
  const [games,   setGames]   = useState([])       // all known games
  const [idx,     setIdx]     = useState(0)         // current position (0 = newest/active)
  const [entries, setEntries] = useState([])
  const [picks,   setPicks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingGame, setLoadingGame] = useState(false)
  const [picking, setPicking] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [toast,   setToast]   = useState(null)
  const [showHistory, setShowHistory] = useState(false)
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

  // ── Load all games list ────────────────────────────────────────────────────
  const loadAllGames = useCallback(async () => {
    const { data: gamesData } = await supabaseDash
      .from('pick_games')
      .select('*')
      .match(huntId ? { hunt_id: huntId } : {})
      .in('status', ['open', 'closed', 'finished'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (!gamesData?.length) { setGames([]); setLoading(false); return }

    // Fetch hunt titles using hunt_id directly — avoid FK join ambiguity
    const huntIds = [...new Set(gamesData.map(g => g.hunt_id).filter(Boolean))]
    const { data: huntsData } = huntIds.length
      ? await supabaseDash.from('bonus_hunts').select('id, title, date').in('id', huntIds)
      : { data: [] }

    const huntMap = {}
    for (const h of (huntsData || [])) huntMap[h.id] = h

    const games = gamesData.map(g => ({
      ...g,
      bonus_hunts: g.hunt_id ? huntMap[g.hunt_id] || null : null,
    }))

    setGames(games)
    setLoading(false)
  }, [huntId])

  useEffect(() => { loadAllGames() }, [loadAllGames])

  // ── Load entries + picks for current game ──────────────────────────────────
  const loadGameData = useCallback(async (g) => {
    if (!g) { setEntries([]); setPicks([]); return }
    setLoadingGame(true)
    const huntId = g.hunt_id
    const [{ data: ents }, { data: ps }] = await Promise.all([
      supabaseDash.from('bonus_entries')
        .select('*, slot:slots(id, name, image_url, provider)')
        .eq('hunt_id', huntId)
        .order('created_at', { ascending: true }),
      supabaseDash.from('picks').select('*').eq('game_id', g.id)
    ])
    setEntries(ents || [])
    setPicks(ps || [])
    setLoadingGame(false)
  }, [])

  useEffect(() => {
    if (!loading) loadGameData(game)
  }, [game?.id, loading]) // eslint-disable-line

  // ── Realtime (active game only) ────────────────────────────────────────────
  useEffect(() => {
    if (!game || !isActive) return
    const huntId = game.hunt_id
    const ch = supabaseDash.channel(`minigame-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'picks', filter: `game_id=eq.${game.id}` },
        async () => {
          const { data } = await supabaseDash.from('picks').select('*').eq('game_id', game.id)
          setPicks(data || [])
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pick_games', filter: `id=eq.${game.id}` },
        (payload) => setGames(prev => prev.map(g => g.id === payload.new.id ? { ...g, ...payload.new } : g)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bonus_entries', filter: `hunt_id=eq.${huntId}` },
        async () => {
          const { data } = await supabaseDash.from('bonus_entries')
            .select('*, slot:slots(id, name, image_url, provider)')
            .eq('hunt_id', huntId).order('created_at', { ascending: true })
          setEntries(data || [])
        })
      .subscribe()
    return () => ch.unsubscribe()
  }, [game?.id, isActive])

  // Listen for new games
  useEffect(() => {
    const ch = supabaseDash.channel('pick-games-new')
      // any change (a new game, or an existing one being opened/closed) reloads the list; only a new game jumps to it
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_games' }, (p) => {
        loadAllGames()
        if (p.eventType === 'INSERT') setIdx(0)
      })
      .subscribe()
    // safety net in case the realtime socket drops
    const poll = setInterval(() => { if (!document.hidden) loadAllGames() }, 10000)
    return () => { ch.unsubscribe(); clearInterval(poll) }
  }, [loadAllGames])

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goLeft  = () => { setIdx(i => Math.min(i + 1, games.length - 1)); setShowHistory(false) }
  const goRight = () => { setIdx(i => Math.max(i - 1, 0)); setShowHistory(false) }

  const canGoLeft  = idx < games.length - 1
  const canGoRight = idx > 0

  // ── Pick flow ──────────────────────────────────────────────────────────────
  const requestPick = (entry) => {
    if (!user || !twitchUser) { showToast('Log in with Twitch to play!', 'error'); return }
    if (!isOpen)              { showToast('Pick phase is closed.', 'error'); return }
    const myPick = picks.find(p => p.twitch_username?.toLowerCase() === twitchUser?.toLowerCase())
    if (myPick)               { showToast('You already have a pick!', 'error'); return }
    if (picks.find(p => p.entry_id === entry.id)) { showToast('Slot already taken!', 'error'); return }
    setConfirm(entry)
  }

  const confirmPick = async () => {
    const entry = confirm
    if (!entry) return
    if (points != null && points < PICK_COST) {
      showToast('Not enough points!', 'error'); setConfirm(null); return
    }
    setPicking(entry.id); setConfirm(null)
    try {
      const res = await spendGamePoints('pick')
      if (!res.ok) {
        showToast(res.error === 'insufficient' ? 'Not enough points!' : res.status === 401 ? 'Log in again to play.' : 'Error deducting points. Try again.', 'error')
        setPicking(null); return
      }
      if (res.newPoints != null) setPoints(res.newPoints)
      else setPoints(p => Math.max(0, (p ?? 0) - PICK_COST))

      const { error } = await supabaseDash.from('picks').insert({
        game_id: game.id, entry_id: entry.id, twitch_username: twitchUser, cost_paid: PICK_COST,
      })
      if (error) {
        if (error.code === '23505') {
          await refundGamePoints('pick')
          setPoints(p => (p ?? 0) + PICK_COST)
          showToast('Slot just got taken! Points refunded.', 'error')
        } else {
          showToast('Error saving pick. Contact the streamer.', 'error')
        }
      } else {
        showToast(`Locked in: ${entry.slot?.name}. Good luck!`, 'success')
        refreshPoints()
      }
    } catch { showToast('Connection error. Try again.', 'error') }
    setPicking(null)
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const myPick  = picks.find(p => p.twitch_username?.toLowerCase() === twitchUser?.toLowerCase())
  const myEntry = myPick ? entries.find(e => e.id === myPick.entry_id) : null
  const total   = entries.length
  const picked  = picks.length
  const pct     = total > 0 ? Math.round((picked / total) * 100) : 0

  const openedEntries = entries.filter(e => e.opened && e.payment != null && parseBet(e.bet) > 0)
  const hasLiveData   = openedEntries.length > 0

  const liveRanked = picks.map(p => {
    const entry   = entries.find(e => e.id === p.entry_id)
    const opened  = entry ? openedEntries.find(e => e.id === entry.id) : null
    const payment = opened ? parseBet(opened.payment) : null
    const bet     = opened ? parseBet(opened.bet) : null
    const multi   = payment && bet ? payment / bet : null
    return { pick: p, entry, payment, multi, revealed: !!opened }
  })

  const byWin   = [...liveRanked].filter(r => r.payment != null).sort((a, b) => b.payment - a.payment)
  const byMulti = [...liveRanked].filter(r => r.multi   != null).sort((a, b) => b.multi   - a.multi)
  const rank1   = byWin[0]
  const rank2   = byMulti.find(r => r.pick.id !== rank1?.pick.id)
  const rank3   = byWin.find(r => r.pick.id !== rank1?.pick.id && r.pick.id !== rank2?.pick.id)

  const rankMap = {}
  if (rank1) rankMap[rank1.pick.id] = { pos: 1, color: '#fbbf24' }
  if (rank2) rankMap[rank2.pick.id] = { pos: 2, color: '#94a3b8' }
  if (rank3) rankMap[rank3.pick.id] = { pos: 3, color: '#cd7c54' }

  const top3 = isFinished
    ? [...picks].filter(p => p.rank).sort((a, b) => a.rank - b.rank).slice(0, 3)
    : []

  const totalPtsAwarded = (game?.points_1st || 0) + (game?.points_2nd || 0) + (game?.points_3rd || 0)
  const canAffordEntry  = points != null && points >= PICK_COST
  const gameNumber      = games.length - idx  // #1 = oldest, newest = highest

  if (loading) return (
    <div className={`${styles.page}${embedded ? ` ${styles.embedded}` : ''}`}>
      <div className={styles.loadWrap}><Spinner size={28} /></div>
    </div>
  )

  return (
    <div className={`${styles.page}${embedded ? ` ${styles.embedded}` : ''}`}>

      {/* ── STATUS BAR ── */}
      <div className={styles.statusBar}>

        {/* Left arrow — go older */}
        <button className={styles.barNav} onClick={goLeft} disabled={!canGoLeft}>
          <ChevronIcon dir="left" />
        </button>

        <div className={styles.barDiv} />

        {/* Dot */}
        <span className={`${styles.barDot} ${
          !game ? styles.barDotIdle
          : isOpen ? styles.barDotLive
          : isFinished ? styles.barDotDone
          : styles.barDotIdle
        }`} />

        {/* Title + number */}
        <span className={styles.barTitle}>
          PICK & WIN {games.length > 0 ? `#${gameNumber}` : ''}
        </span>

        {/* Sub-status */}
        {!game
          ? <span className={styles.barSub} data-st="idle">NO GAMES YET</span>
          : isOpen
            ? <span className={styles.barSub} data-st="live">LIVE NOW</span>
            : isFinished
              ? <span className={styles.barSub} data-st="done">FINISHED</span>
              : <span className={styles.barSub} data-st="closed">PICKS CLOSED</span>
        }

        {game && (
          <>
            <div className={styles.barDiv} />

            {/* Date (history) or picks count (active) */}
            {!isActive ? (
              <span className={styles.barDate}>{fmtDate(game.created_at)}</span>
            ) : (
              <div className={styles.barStat}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span>{picked} / {total} picks</span>
              </div>
            )}

            {/* Timer */}
            {isOpen && (
              <>
                <div className={styles.barDiv} />
                <div className={styles.barStat}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span className={styles.barTimer}>{fmtTime(secs)}</span>
                </div>
              </>
            )}

            {/* Pts awarded (finished) */}
            {isFinished && totalPtsAwarded > 0 && (
              <>
                <div className={styles.barDiv} />
                <div className={styles.barStat}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
                    <path d="M12 17v4"/><path d="M8 21h8"/>
                    <path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/>
                  </svg>
                  <span className={styles.barPts}>{totalPtsAwarded.toLocaleString('en-GB')} pts</span>
                </div>
              </>
            )}

            {/* My pick */}
            {myPick && myEntry && isActive && (
              <>
                <div className={styles.barDiv} />
                <div className={styles.barStat}>
                  <LockIcon size={11} />
                  <span className={styles.barMyPick}>{myEntry.slot?.name || '—'}</span>
                </div>
              </>
            )}
          </>
        )}

        {/* Hunt badge */}
        {game?.bonus_hunts?.title && (
          <>
            <div className={styles.barDiv} />
            <a
              href={`/bonus-hunts?hunt=${game.bonus_hunts.id}`}
              className={styles.barHuntBadge}
            >
              {game.bonus_hunts.title.toUpperCase()}
            </a>
          </>
        )}

        <div className={styles.barSpacer} />

        {/* Pagination */}
        {games.length > 1 && (
          <span className={styles.barPager}>{idx + 1} / {games.length}</span>
        )}

        <div className={styles.barDiv} />

        {/* History button */}
        <button className={`${styles.barHistBtn} ${showHistory ? styles.barHistBtnActive : ''}`} onClick={() => setShowHistory(v => !v)}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          History
        </button>

        <div className={styles.barDiv} />

        {/* Right arrow */}
        <button className={styles.barNav} onClick={() => { goRight(); setShowHistory(false) }} disabled={!canGoRight}>
          <ChevronIcon dir="right" />
        </button>

      </div>

      {/* ── HISTORY VIEW ── */}
      {showHistory && (
        <HistoryList
          games={games}
          twitchUser={twitchUser}
          onSelect={(i) => { setIdx(i); setShowHistory(false) }}
        />
      )}

      {/* ── NO GAMES ── */}
      {!showHistory && !game && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
          </div>
          <p className={styles.emptyTitle}>No Pick & Win yet</p>
          <p className={styles.emptySub}>The streamer hasn't opened a game yet. Stay tuned!</p>
        </div>
      )}


      {/* ── GAME CONTENT ── */}
      {!showHistory && game && (
        <>
          {loadingGame ? (
            <div className={styles.loadWrap}><Spinner size={24} /></div>
          ) : (
            <>
              {/* COST BANNER — active + open + no pick yet */}
              {isActive && isOpen && !myPick && (
                <div className={`${styles.costBanner} ${!canAffordEntry && !ptsLoading && user ? styles.costBannerDanger : ''}`}>
                  <div className={styles.costLeft}>
                    <div className={styles.costIcon}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
                    </div>
                    <span>Entry: <strong>{PICK_COST} points</strong> per pick</span>
                  </div>
                  <div className={styles.costRight}>
                    {!user
                      ? <span className={styles.costHint}>Login to play</span>
                      : ptsLoading ? <Spinner size={12} />
                      : <span className={`${styles.costBalance} ${!canAffordEntry ? styles.costBalanceLow : ''}`}>
                          Your balance: <strong>{(points ?? 0).toLocaleString('en-GB')} pts</strong>
                          {!canAffordEntry && <span className={styles.costInsuff}> — insufficient</span>}
                        </span>
                    }
                  </div>
                </div>
              )}

              {/* MY PICK BANNER */}
              {isActive && myPick && myEntry && (
                <div className={styles.myPickBanner}>
                  <div className={styles.myPickImgWrap}>
                    {myEntry.slot?.image_url
                      ? <img src={myEntry.slot.image_url} alt="" />
                      : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M8 6V4a2 2 0 0 1 4 0v2"/></svg>
                    }
                  </div>
                  <div className={styles.myPickInfo}>
                    <div className={styles.myPickLabel}>Your pick</div>
                    <div className={styles.myPickName}>{myEntry.slot?.name || '—'}</div>
                    {myEntry.slot?.provider && <div className={styles.myPickProvider}>{myEntry.slot.provider}</div>}
                  </div>
                  <div className={styles.myPickMeta}>
                    <div className={styles.myPickCost}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
                      {PICK_COST} pts spent
                    </div>
                    <div className={styles.myPickLocked}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                      Locked in
                    </div>
                  </div>
                </div>
              )}

              {/* PROGRESS */}
              <div className={styles.progressRow}>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                </div>
                <span className={styles.progressLabel}>{picked} / {total} picked</span>
              </div>

              {/* PODIUM */}
              {(isFinished || !isActive) && top3.length > 0 && (
                <div className={styles.podium}>
                  <div className={styles.podiumHeading}>
                    <Medal pos={1} size={13} /> Final Results
                  </div>
                  <div className={styles.podiumCards}>
                    {top3.map((p, i) => {
                      const entry = entries.find(e => e.id === p.entry_id)
                      return (
                        <div key={p.id} className={`${styles.podiumCard} ${[styles.podiumGold, styles.podiumSilver, styles.podiumBronze][i]}`}>
                          <div className={styles.podiumMedal}><Medal pos={i + 1} size={22} /></div>
                          {entry?.slot?.image_url && <img src={entry.slot.image_url} alt="" className={styles.podiumImg} />}
                          <div className={styles.podiumSlot}>{entry?.slot?.name || '—'}</div>
                          <div className={styles.podiumUser}>{p.twitch_username}</div>
                          {p.points_awarded > 0 && <div className={styles.podiumPts}>+{p.points_awarded.toLocaleString('en-GB')} pts</div>}
                          <div className={styles.podiumReason}>{['Biggest Win', 'Best Multi', 'Top 3'][i]}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* MAIN LAYOUT: grid + sidebar */}
              <div className={styles.mainLayout}>

                {/* GRID */}
                <div className={styles.grid}>
                  {entries.map((entry, entryIdx) => {
                    const pick       = picks.find(p => p.entry_id === entry.id)
                    const isMine     = !!pick && !!twitchUser && pick.twitch_username?.toLowerCase() === twitchUser.toLowerCase()
                    const isTaken    = !!pick
                    const isLoading  = picking === entry.id
                    const isSuper    = !!entry.is_super
                    const bet        = parseBet(entry.bet)
                    const payment    = entry.payment != null ? parseBet(entry.payment) : null
                    const multi      = payment != null && bet > 0 ? (payment / bet) : null
                    const rk         = pick ? rankMap[pick.id] : null
                    const isRevealed = entry.opened && payment != null
                    const isPickable = isActive && isOpen && !isTaken && !myPick && !isLoading && !!user

                    return (
                      <button
                        key={entry.id}
                        className={[
                          styles.card,
                          isSuper    ? styles.cardSuper    : '',
                          isTaken && !isMine ? styles.cardTaken : '',
                          isMine     ? styles.cardMine     : '',
                          isPickable ? styles.cardPickable : '',
                          isLoading  ? styles.cardLoading  : '',
                          rk?.pos === 1 ? styles.cardRank1 : '',
                          rk?.pos === 2 ? styles.cardRank2 : '',
                          rk?.pos === 3 ? styles.cardRank3 : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => isPickable && requestPick(entry)}
                        disabled={!isPickable || isLoading}
                      >
                        <div className={styles.cardNum}>#{entryIdx + 1}</div>
                        {isSuper && <div className={styles.cardSuperBadge}>SUPER</div>}
                        {rk && <div className={styles.cardRankBadge}><Medal pos={rk.pos} size={15} /></div>}

                        <div className={styles.cardImgWrap}>
                          {entry.slot?.image_url
                            ? <img src={entry.slot.image_url} alt={entry.slot?.name} className={styles.cardImg} />
                            : <div className={styles.cardImgFallback}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="6" width="20" height="14" rx="2"/></svg>
                              </div>
                          }
                          {isTaken && !isLoading && (
                            <div className={styles.cardOverlay}>
                              {isRevealed && multi != null && (
                                <div className={styles.cardRevealCenter}>
                                  <div className={styles.cardRevealBet}>€{bet.toFixed(2)}</div>
                                  <div className={styles.cardRevealMulti}>{multi.toFixed(1)}x</div>
                                  <div className={styles.cardRevealWin}>€{payment.toFixed(2)}</div>
                                </div>
                              )}
                              <div className={`${styles.cardOwnerPill} ${isMine ? styles.cardOwnerMine : ''}`}>
                                <LockIcon size={9} />
                                {pick.twitch_username}
                              </div>
                            </div>
                          )}
                          {isPickable && <div className={styles.cardCta}><span>Pick this slot</span><b>{PICK_COST} pts</b></div>}
                          {isLoading && (
                            <div className={styles.cardOverlay} style={{ background: 'rgba(0,0,0,.6)' }}>
                              <Spinner size={18} />
                            </div>
                          )}
                        </div>

                        <div className={styles.cardFooter}>
                          <p className={styles.cardName}>{entry.slot?.name || '—'}</p>
                          {isTaken && <span className={`${styles.cardOwner} ${isMine ? styles.cardOwnerYou : ''}`}>{pick.twitch_username}</span>}
                          {isRevealed && payment != null
                            ? <div className={styles.cardWinRow}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                                <span className={styles.cardWin}>€{payment.toFixed(2)}</span>
                              </div>
                            : bet > 0 ? <span className={styles.cardBet}>€{bet.toFixed(2)}</span>
                            : null
                          }
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* SIDEBAR */}
                {picks.length > 0 && (
                  <aside className={styles.sidebar}>
                    <div className={styles.sidebarHead}>
                      {hasLiveData && isActive
                        ? <><span className={styles.liveDot}/><span>Live Ranking</span></>
                        : <><span className={styles.sidebarHeadIcon}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
                              <path d="M12 17v4"/><path d="M8 21h8"/>
                              <path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/>
                            </svg>
                          </span><span>{isFinished || !isActive ? 'Results' : 'Picks'}</span></>
                      }
                      <span className={styles.sidebarCount}>{picks.length}</span>
                    </div>

                    <div className={styles.sidebarRows}>
                      {liveRanked
                        .sort((a, b) => {
                          // finished: sort by rank first, then by payment
                          if (isFinished || !isActive) {
                            if (a.pick.rank && b.pick.rank) return a.pick.rank - b.pick.rank
                            if (a.pick.rank) return -1
                            if (b.pick.rank) return 1
                          }
                          if (b.payment != null && a.payment == null) return 1
                          if (a.payment != null && b.payment == null) return -1
                          return (b.payment || 0) - (a.payment || 0)
                        })
                        .map(({ pick: p, entry, payment, multi: m }) => {
                          const rk  = rankMap[p.id] || (p.rank ? { pos: p.rank, color: ['#fbbf24','#94a3b8','#cd7c54'][p.rank-1] } : null)
                          const isMe = p.twitch_username?.toLowerCase() === twitchUser?.toLowerCase()
                          return (
                            <div key={p.id} className={[
                              styles.sidebarRow,
                              rk   ? styles.sidebarRowRanked : '',
                              isMe ? styles.sidebarRowMe     : '',
                            ].filter(Boolean).join(' ')}>
                              <div className={styles.sidebarRowL}>
                                <span className={styles.sidebarMedal}>
                                  {rk ? <Medal pos={rk.pos} size={13} /> : <span className={styles.sidebarDot}/>}
                                </span>
                                {entry?.slot?.image_url
                                  ? <img src={entry.slot.image_url} alt="" className={styles.sidebarImg} onError={e => e.target.style.opacity = '.2'} />
                                  : <div className={styles.sidebarImgFallback}/>
                                }
                                <div className={styles.sidebarInfo}>
                                  <div className={`${styles.sidebarUser} ${isMe ? styles.sidebarUserMe : ''}`}>{p.twitch_username}</div>
                                  <div className={styles.sidebarSlot}>{entry?.slot?.name || '—'}</div>
                                </div>
                              </div>
                              <div className={styles.sidebarRowR}>
                                {payment != null ? (
                                  <div className={styles.sidebarResult}>
                                    <span className={styles.sidebarMulti}>{m?.toFixed(1)}x</span>
                                    <span className={styles.sidebarWin}>€{payment.toFixed(2)}</span>
                                    {rk && p.points_awarded > 0 && (
                                      <span className={styles.sidebarPrize}>+{p.points_awarded.toLocaleString('en-GB')} pts</span>
                                    )}
                                  </div>
                                ) : rk && p.points_awarded > 0 ? (
                                  <span className={styles.sidebarPrize}>+{p.points_awarded.toLocaleString('en-GB')} pts</span>
                                ) : (
                                  <span className={styles.sidebarWait}>—</span>
                                )}
                              </div>
                            </div>
                          )
                        })
                      }
                    </div>
                  </aside>
                )}
              </div>
            </>
          )}
        </>
      )}

      {confirm && (
        <ConfirmDialog
          entry={confirm} cost={PICK_COST} points={points}
          loading={!!picking} onConfirm={confirmPick} onCancel={() => setConfirm(null)}
        />
      )}
      {toast && <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>{toast.msg}</div>}
    </div>
  )
}