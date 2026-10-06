import { useState, useEffect, useCallback, useRef } from 'react'
import { supabaseDash } from '../lib/supabase'
import { spendGamePoints, refundGamePoints } from '../lib/points'
import { useAuth } from '../hooks/useAuth'
import { useStreamElementsPoints } from '../hooks/useStreamElementsPoints'
import styles from './MiniGame.module.css'
import { parseBet, fmtTime, fmtDate, useCountdown, Spinner, Medal, LockIcon, ChevronIcon } from '../lib/miniGamesUtils'

const GTB_COST      = 100


// ── History List ───────────────────────────────────────────────────────────────
function GtbHistoryList({ games, onSelect, twitchUser }) {
  const [entriesMap, setEntriesMap] = useState({})

  useEffect(() => {
    const load = async () => {
      const ids = games.filter(g => g.status === 'finished').map(g => g.id)
      if (!ids.length) return
      const { data } = await supabaseDash
        .from('gtb_entries').select('game_id, twitch_username, guess, gap, rank, points_awarded')
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
      <p className={styles.emptySub}>Finished GTB games will appear here.</p>
    </div>
  )

  return (
    <div className={styles.histList}>
      {games.map((g, i) => {
        const gameNum  = games.length - i
        const winners  = (entriesMap[g.id] || []).sort((a, b) => a.rank - b.rank)
        const myEntry  = (entriesMap[g.id] || []).find(e => e.twitch_username?.toLowerCase() === twitchUser?.toLowerCase())
        const huntTitle = g.bonus_hunts?.title || null

        return (
          <button key={g.id} className={styles.histCard} onClick={() => onSelect(i)}>
            <div className={styles.histCardLeft}>
              <div className={styles.histCardNum}>GTB #{gameNum}</div>
              {huntTitle && <div className={styles.histCardHunt}>{huntTitle}</div>}
              {g.target_balance > 0 && <div className={styles.histCardHunt}>Final: €{parseBet(g.target_balance).toFixed(2)}</div>}
            </div>
            <div className={styles.histCardDiv} />
            <div className={styles.histCardWinners}>
              {winners.slice(0, 3).map((e, wi) => (
                <div key={e.twitch_username} className={styles.histWinnerPill}>
                  <Medal pos={wi+1} size={10} />
                  <span>{e.twitch_username}</span>
                  {e.gap != null && <span className={styles.histWinAmt}>±€{parseBet(e.gap).toFixed(2)}</span>}
                </div>
              ))}
              {!winners.length && <span className={styles.histNoPicks}>no results</span>}
            </div>
            <div className={styles.histCardRight}>
              {myEntry && (
                <div className={styles.histMyBadge}>
                  <LockIcon size={8} /> your guess
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

// ── Confirm Dialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ guess, cost, points, onConfirm, onCancel, loading, cashPrize }) {
  const canAfford = points != null && points >= cost
  return (
    <div className={styles.confirmBackdrop} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className={styles.confirmBox}>
        <div className={styles.confirmTitle}>Confirm your guess</div>
        <div className={styles.confirmSlotName}>€{parseBet(guess).toFixed(2)}</div>

        {cashPrize > 0 && (
          <div className={styles.confirmCostRow} style={{borderColor:'rgba(34,197,94,.25)'}}>
            <span className={styles.confirmCostLabel}>1st place prize</span>
            <span className={styles.confirmCostVal} style={{color:'#4ade80'}}>€{cashPrize} cash</span>
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
export default function MiniGameGtb({ huntId = null, compact = false }) {
  const { user, profile } = useAuth()

  const [games,       setGames]       = useState([])
  const [idx,         setIdx]         = useState(0)
  const [entries,     setEntries]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [loadingGame, setLoadingGame] = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [confirm,     setConfirm]     = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [toast,       setToast]       = useState(null)
  const [guessInput,  setGuessInput]  = useState('')
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
      .from('gtb_games').select('*')
      .match(huntId ? { hunt_id: huntId } : {})
      .in('status', ['open', 'closed', 'finished'])
      .order('created_at', { ascending: false })
      .limit(50)

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
    const { data } = await supabaseDash
      .from('gtb_entries').select('*').eq('game_id', g.id)
      .order('created_at', { ascending: true })
    setEntries(data || [])
    setLoadingGame(false)
  }, [])

  useEffect(() => {
    if (!loading) loadGameData(game)
  }, [game?.id, loading]) // eslint-disable-line

  // Realtime (active only)
  useEffect(() => {
    if (!game || !isActive) return
    const ch = supabaseDash.channel(`gtb-pub-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gtb_entries', filter: `game_id=eq.${game.id}` },
        async () => {
          const { data } = await supabaseDash.from('gtb_entries').select('*').eq('game_id', game.id).order('created_at', { ascending: true })
          setEntries(data || [])
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gtb_games', filter: `id=eq.${game.id}` },
        (payload) => setGames(prev => prev.map(g => g.id === payload.new.id ? { ...g, ...payload.new } : g)))
      .subscribe()
    return () => ch.unsubscribe()
  }, [game?.id, isActive])

  // Listen for new games
  useEffect(() => {
    const ch = supabaseDash.channel('gtb-games-new')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gtb_games' }, () => {
        loadAllGames(); setIdx(0)
      })
      .subscribe()
    return () => ch.unsubscribe()
  }, [loadAllGames])

  const goLeft  = () => { setIdx(i => Math.min(i + 1, games.length - 1)); setShowHistory(false) }
  const goRight = () => { setIdx(i => Math.max(i - 1, 0)); setShowHistory(false) }
  const canGoLeft  = idx < games.length - 1
  const canGoRight = idx > 0

  const requestSubmit = () => {
    const val = parseFloat(guessInput)
    if (!val || val <= 0) { showToast('Enter a valid balance guess.', 'error'); return }
    if (!user || !twitchUser) { showToast('Log in with Twitch to play!', 'error'); return }
    if (!isOpen) { showToast('GTB is closed.', 'error'); return }
    if (myEntry) { showToast('You already submitted a guess!', 'error'); return }
    setConfirm(val)
  }

  const confirmSubmit = async () => {
    const val = confirm
    if (!val) return
    if (points != null && points < GTB_COST) {
      showToast('Not enough points!', 'error'); setConfirm(null); return
    }
    setSubmitting(true); setConfirm(null)
    try {
      const res = await spendGamePoints('gtb')
      if (!res.ok) {
        showToast(res.error === 'insufficient' ? 'Not enough points!' : res.status === 401 ? 'Log in again to play.' : 'Error deducting points. Try again.', 'error')
        setSubmitting(false); return
      }
      if (res.newPoints != null) setPoints(res.newPoints)
      else setPoints(p => Math.max(0, (p ?? 0) - GTB_COST))

      const { error } = await supabaseDash.from('gtb_entries').insert({
        game_id: game.id, twitch_username: twitchUser,
        guess: val, cost_paid: GTB_COST,
      })
      if (error) {
        if (error.code === '23505') {
          await refundGamePoints('gtb')
          setPoints(p => (p ?? 0) + GTB_COST)
          showToast('You already have a guess! Points refunded.', 'error')
        } else {
          showToast('Error saving guess. Contact the streamer.', 'error')
        }
      } else {
        showToast(`Locked in: €${val.toFixed(2)}. Good luck!`, 'success')
        setGuessInput('')
        refreshPoints()
      }
    } catch { showToast('Connection error. Try again.', 'error') }
    setSubmitting(false)
  }

  // Derived
  const myEntry         = entries.find(e => e.twitch_username?.toLowerCase() === twitchUser?.toLowerCase())
  const gameNum         = games.length - idx
  const totalPtsAwarded = (game?.points_1st || 0) + (game?.points_2nd || 0) + (game?.points_3rd || 0)
  const canAfford       = points != null && points >= GTB_COST

  // Live ranking (finished — sort by gap asc)
  const rankedEntries = isFinished
    ? [...entries].filter(e => e.rank).sort((a, b) => a.rank - b.rank)
    : [...entries].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  if (loading) return (
    <div className={`${styles.page}${compact ? ` ${styles.compact}` : ''}`}><div className={styles.loadWrap}><Spinner size={28} /></div></div>
  )

  return (
    <div className={`${styles.page}${compact ? ` ${styles.compact}` : ''}`}>

      {/* STATUS BAR */}
      <div className={styles.statusBar}>
        <button className={styles.barNav} onClick={goLeft} disabled={!canGoLeft}>
          <ChevronIcon dir="left" />
        </button>
        <div className={styles.barDiv} />

        <span className={`${styles.barDot} ${
          !game ? styles.barDotIdle
          : isOpen ? styles.barDotLive
          : isFinished ? styles.barDotDone
          : styles.barDotIdle
        }`} />

        <span className={styles.barTitle}>
          GTB {games.length > 0 ? `#${gameNum}` : ''}
        </span>

        {!game
          ? <span className={styles.barSub} data-st="idle">NO GAMES YET</span>
          : isOpen
            ? <span className={styles.barSub} data-st="live">LIVE NOW</span>
            : isFinished
              ? <span className={styles.barSub} data-st="done">FINISHED</span>
              : <span className={styles.barSub} data-st="closed">CLOSED</span>
        }

        {game && (
          <>
            <div className={styles.barDiv} />
            {!isActive ? (
              <span className={styles.barDate}>{fmtDate(game.created_at)}</span>
            ) : (
              <div className={styles.barStat}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span>{entries.length} guesses</span>
              </div>
            )}

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
                  <span className={styles.barMyPick}>€{parseBet(myEntry.guess).toFixed(2)}</span>
                </div>
              </>
            )}
          </>
        )}

        <div className={styles.barSpacer} />
        {games.length > 1 && <span className={styles.barPager}>{idx + 1} / {games.length}</span>}
        <div className={styles.barDiv} />
        <button className={`${styles.barHistBtn} ${showHistory ? styles.barHistBtnActive : ''}`} onClick={() => setShowHistory(v => !v)}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          History
        </button>
        <div className={styles.barDiv} />
        <button className={styles.barNav} onClick={() => { goRight(); setShowHistory(false) }} disabled={!canGoRight}>
          <ChevronIcon dir="right" />
        </button>
      </div>

      {/* HISTORY */}
      {showHistory && (
        <GtbHistoryList
          games={games}
          twitchUser={twitchUser}
          onSelect={(i) => { setIdx(i); setShowHistory(false) }}
        />
      )}

      {/* NO GAME */}
      {!showHistory && !game && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <p className={styles.emptyTitle}>No active GTB</p>
          <p className={styles.emptySub}>The streamer hasn't opened a game yet. Stay tuned!</p>
        </div>
      )}

      {/* GAME CONTENT */}
      {!showHistory && game && (
        <>
          {loadingGame ? (
            <div className={styles.loadWrap}><Spinner size={24} /></div>
          ) : (
            <div className={styles.gtbLayout}>

              {/* LEFT — input + my guess */}
              <div className={styles.gtbLeft}>

                {/* Cash prize banner */}
                {game.prize_cash_1st > 0 && (
                  <div className={styles.gtbCashBanner}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round">
                      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    <span>1st place wins <strong>€{game.prize_cash_1st} cash</strong></span>
                  </div>
                )}

                {/* Cost banner */}
                {isOpen && !myEntry && (
                  <div className={`${styles.costBanner} ${!canAfford && !ptsLoading && user ? styles.costBannerDanger : ''}`}>
                    <div className={styles.costLeft}>
                      <div className={styles.costIcon}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
                      </div>
                      <span>Entry: <strong>{GTB_COST} points</strong></span>
                    </div>
                    <div className={styles.costRight}>
                      {!user
                        ? <span className={styles.costHint}>Login to play</span>
                        : ptsLoading ? <Spinner size={12} />
                        : <span className={`${styles.costBalance} ${!canAfford ? styles.costBalanceLow : ''}`}>
                            Balance: <strong>{(points ?? 0).toLocaleString('en-GB')} pts</strong>
                            {!canAfford && <span className={styles.costInsuff}> — insufficient</span>}
                          </span>
                      }
                    </div>
                  </div>
                )}

                {/* My guess banner */}
                {myEntry && (
                  <div className={styles.myPickBanner}>
                    <div className={styles.myPickImgWrap} style={{background:'rgba(59,130,246,.1)', border:'1px solid rgba(59,130,246,.2)'}}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round">
                        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                      </svg>
                    </div>
                    <div className={styles.myPickInfo}>
                      <div className={styles.myPickLabel}>Your guess</div>
                      <div className={styles.myPickName}>€{parseBet(myEntry.guess).toFixed(2)}</div>
                      {myEntry.gap != null && <div className={styles.myPickProvider}>Gap: ±€{parseBet(myEntry.gap).toFixed(2)}</div>}
                    </div>
                    <div className={styles.myPickMeta}>
                      <div className={styles.myPickCost}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
                        {GTB_COST} pts spent
                      </div>
                      {myEntry.rank && (
                        <div className={styles.myPickLocked}>
                          <Medal pos={myEntry.rank} size={11} />
                          {myEntry.rank === 1 ? '1st' : myEntry.rank === 2 ? '2nd' : '3rd'} place
                        </div>
                      )}
                      {!myEntry.rank && (
                        <div className={styles.myPickLocked}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                          Locked in
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Guess input */}
                {isOpen && !myEntry && (
                  <div className={styles.gtbInputWrap}>
                    <div className={styles.gtbInputLabel}>Guess the final balance</div>
                    <div className={styles.gtbInputSub}>Closest guess without going wild wins. One shot per game.</div>
                    <div className={styles.gtbInputRow}>
                      <span className={styles.gtbInputPrefix}>€</span>
                      <input
                        className={styles.gtbInput}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 1450.00"
                        value={guessInput}
                        onChange={e => setGuessInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && requestSubmit()}
                      />
                      <button
                        className={styles.gtbSubmitBtn}
                        onClick={requestSubmit}
                        disabled={submitting || !guessInput}
                      >
                        {submitting ? <Spinner size={14} /> : 'Submit'}
                      </button>
                    </div>
                    <div className={styles.gtbChips}>
                      {[-500, -100, 100, 500].map(d => (
                        <button key={d} type="button" className={styles.gtbChip} onClick={() => setGuessInput(v => String(Math.max(0, (parseFloat(v) || 0) + d)))}>
                          {d > 0 ? '+' : '−'}€{Math.abs(d)}
                        </button>
                      ))}
                    </div>
                    {game.target_balance > 0 && (
                      <div className={styles.gtbHint}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        Target balance: €{parseBet(game.target_balance).toFixed(2)}
                      </div>
                    )}
                  </div>
                )}

                {/* Closed / finished state */}
                {(isClosed || (isFinished && !myEntry)) && (
                  <div className={styles.gtbClosed}>
                    <LockIcon size={16} />
                    <span>{isClosed ? 'Picks are closed. Results coming soon.' : 'Game finished.'}</span>
                  </div>
                )}
              </div>

              {/* RIGHT — leaderboard */}
              {entries.length > 0 && (
                <aside className={styles.sidebar}>
                  <div className={styles.sidebarHead}>
                    {isFinished
                      ? <><Medal pos={1} size={11} /><span>Final Results</span></>
                      : <><span className={styles.sidebarHeadIcon}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                          </svg>
                        </span><span>Guesses</span></>
                    }
                    <span className={styles.sidebarCount}>{entries.length}</span>
                  </div>

                  <div className={styles.sidebarRows}>
                    {rankedEntries.map((e, i) => {
                      const isMe = e.twitch_username?.toLowerCase() === twitchUser?.toLowerCase()
                      const hasRank = !!e.rank
                      return (
                        <div key={e.id} className={[
                          styles.sidebarRow,
                          hasRank ? styles.sidebarRowRanked : '',
                          isMe    ? styles.sidebarRowMe    : '',
                        ].filter(Boolean).join(' ')}>
                          <div className={styles.sidebarRowL}>
                            <span className={styles.sidebarMedal}>
                              {hasRank ? <Medal pos={e.rank} size={13} /> : <span className={styles.sidebarDot}/>}
                            </span>
                            <div className={styles.sidebarInfo}>
                              <div className={`${styles.sidebarUser} ${isMe ? styles.sidebarUserMe : ''}`}>
                                {e.twitch_username}
                              </div>
                              <div className={styles.sidebarSlot}>€{parseBet(e.guess).toFixed(2)}</div>
                            </div>
                          </div>
                          <div className={styles.sidebarRowR}>
                            {e.gap != null ? (
                              <div className={styles.sidebarResult}>
                                <span className={styles.sidebarMulti}>±€{parseBet(e.gap).toFixed(2)}</span>
                                {e.points_awarded > 0 && <span className={styles.sidebarPrize}>+{e.points_awarded} pts</span>}
                                {e.rank === 1 && game.prize_cash_1st > 0 && (
                                  <span style={{fontSize:10, color:'#4ade80', fontWeight:800}}>+€{game.prize_cash_1st}</span>
                                )}
                              </div>
                            ) : (
                              <span className={styles.sidebarWait}>—</span>
                            )}
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
          guess={confirm}
          cost={GTB_COST}
          points={points}
          loading={submitting}
          cashPrize={game?.prize_cash_1st || 0}
          onConfirm={confirmSubmit}
          onCancel={() => setConfirm(null)}
        />
      )}

      {toast && (
        <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>{toast.msg}</div>
      )}
    </div>
  )
}