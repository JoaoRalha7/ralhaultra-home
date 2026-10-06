import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import styles from './Leaderboard.module.css'

const SE_WORKER_URL = import.meta.env.VITE_SE_WORKER_URL || 'https://ralha-points.jppralha.workers.dev'
const PAGE_SIZE = 25

// Cores Oficiais do Pódio (Alinhado com os Minijogos)
const PODIUM_COLORS = {
  0: { bg: 'var(--yellow)', glow: 'rgba(251,191,36,0.3)',  label: '1ST', ring: 'var(--yellow)' },
  1: { bg: '#94a3b8',       glow: 'rgba(148,163,184,0.2)', label: '2ND', ring: '#94a3b8' },
  2: { bg: '#cd7c54',       glow: 'rgba(205,124,84,0.25)', label: '3RD', ring: '#cd7c54' },
}

// ── Funções de Avatar (Cache + IVR) ────────────────────────────────────────────
const profileCache = {}
async function getProfilePic(username) {
  if (!username) return null
  if (profileCache[username]) return profileCache[username]
  try {
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), 4000)
    const res  = await fetch(`https://api.ivr.fi/v2/twitch/user?login=${username.toLowerCase()}`, { signal: c.signal })
    clearTimeout(t)
    const data = await res.json()
    const url  = data?.[0]?.logo || null
    if (url) profileCache[username] = url
    return url
  } catch { return null }
}

function hslFromName(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return `hsl(${h % 360}, 55%, 58%)`
}

function TwitchAvatar({ username, size = 36, className = '' }) {
  const color = hslFromName(username || '?')
  const [imgSrc, setImgSrc] = useState(profileCache[username] || null)
  
  useEffect(() => {
    if (!username) return
    if (profileCache[username]) { setImgSrc(profileCache[username]); return }
    let mounted = true
    getProfilePic(username).then(url => { if (mounted && url) setImgSrc(url) })
    return () => { mounted = false }
  }, [username])

  const style = { width: size, height: size, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }
  if (imgSrc) return <img src={imgSrc} alt={username} className={className} style={style} loading="lazy" />
  return (
    <div className={className} style={{ ...style, background: `${color}25`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 900, color, fontFamily: 'var(--font)' }}>
      {username?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

// ── Efeito Ping-Pong ─────────────────────────────────────────────────────────
function SlideText({ text, className }) {
  const containerRef = useRef(null)
  const textRef = useRef(null)
  const [slideDist, setSlideDist] = useState(0)

  useEffect(() => {
    if (containerRef.current && textRef.current) {
      const cWidth = containerRef.current.clientWidth
      const tWidth = textRef.current.scrollWidth
      if (tWidth > cWidth) { setSlideDist(cWidth - tWidth - 6) } 
      else { setSlideDist(0) }
    }
  }, [text])

  return (
    <div className={`${styles.slideWrap} ${className || ''}`} ref={containerRef}>
      <div className={`${styles.slideInner} ${slideDist < 0 ? styles.animPingPong : ''}`} style={{ '--slide-dist': `${slideDist}px` }}>
        <span className={styles.slideText} ref={textRef}>{text}</span>
      </div>
    </div>
  )
}

const TrophySVG = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 15c-3.314 0-6-2.686-6-6V3h12v6c0 3.314-2.686 6-6 6z" stroke="var(--yellow)" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M6 5H3.5A1.5 1.5 0 0 0 2 6.5C2 8.433 3.567 10 5.5 10H6M18 5h2.5A1.5 1.5 0 0 1 22 6.5C22 8.433 20.433 10 18.5 10H18" stroke="var(--yellow)" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M12 15v4M8 21h8" stroke="var(--yellow)" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

const CoinSVG = ({ size = 13, color = 'var(--yellow)' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/>
  </svg>
)

export default function Leaderboard() {
  const { user } = useAuth()
  const myUsername = user?.user_metadata?.full_name?.toLowerCase() || null

  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [page,        setPage]        = useState(1)
  const [search,      setSearch]      = useState('')

  const fetchLeaderboard = async () => {
    setLoading(true); setError(null)
    try {
      const PAGE = 100; const MAX_PAGES = 100
      const first = await fetch(`${SE_WORKER_URL}/leaderboard?limit=${PAGE}&offset=0`)
      if (!first.ok) throw new Error(`Erro ${first.status}`)
      const firstData  = await first.json()
      const firstBatch = firstData.users || []
      if (!firstData.hasMore || firstBatch.length < PAGE) {
        setUsers(firstBatch); setLastUpdated(new Date()); setPage(1); return
      }
      const offsets   = Array.from({ length: MAX_PAGES - 1 }, (_, i) => (i + 1) * PAGE)
      const responses = await Promise.all(
        offsets.map(offset =>
          fetch(`${SE_WORKER_URL}/leaderboard?limit=${PAGE}&offset=${offset}`)
            .then(r => r.ok ? r.json() : { users: [] }).catch(() => ({ users: [] }))
        )
      )
      const all = [...firstBatch, ...responses.flatMap(d => d.users || [])]
        .filter((u, i, arr) => arr.findIndex(x => x.username === u.username) === i)
      setUsers(all.filter(u => u.username))
      setLastUpdated(new Date()); setPage(1)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchLeaderboard() }, [])

  const podium  = users.slice(0, 3)
  const myRank  = myUsername ? users.findIndex(u => u.username?.toLowerCase() === myUsername) : -1

  const totalUsers  = users.length
  const totalPoints = users.reduce((s, u) => s + (u.points || 0), 0)
  const avgPoints   = totalUsers > 0 ? Math.round(totalPoints / totalUsers) : 0
  
  const formatK = (n) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000)    return `${(n / 1000).toFixed(1)}K`
    return n.toLocaleString('en-GB')
  }

  const filteredUsers = useMemo(() => {
    const rest = users.slice(3)
    if (!search.trim()) return rest
    const q = search.trim().toLowerCase()
    return users.filter(u => u.username?.toLowerCase().includes(q))
  }, [users, search])

  const tableUsers = filteredUsers
  const totalPages = Math.max(1, Math.ceil(tableUsers.length / PAGE_SIZE))
  const pageSlice  = tableUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const handleSearch = (e) => { setSearch(e.target.value); setPage(1) }

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.spinner} /><span>Loading leaderboard...</span>
    </div>
  )

  if (error) return (
    <div className={styles.errorState}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="rgba(255,255,255,.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      <p>Error loading leaderboard.</p>
      <button className={styles.retryBtn} onClick={fetchLeaderboard}>Tentar novamente</button>
    </div>
  )

  const podiumOrder = podium.length >= 3 ? [podium[1], podium[0], podium[2]] : []
  const podiumIdx   = [1, 0, 2]
  const maxPts      = users[0]?.points || 1
  const ahead       = myRank > 0 ? users[myRank - 1] : null
  const gap         = ahead ? Math.max(0, (ahead.points || 0) - (users[myRank].points || 0)) : 0

  const Ico = ({ d, size = 16, sw = 2 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
  )

  return (
    <div className={styles.page}>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Leaderboard</h1>
          <p className={styles.sub}>Top viewers ranked by points. Watch the stream to climb.</p>
        </div>
        <div className={styles.headerRight}>
          {lastUpdated && <span className={styles.updated}>Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
          <button className={styles.refreshBtn} onClick={fetchLeaderboard} title="Refresh" aria-label="Refresh">
            <Ico d={<><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></>} />
          </button>
        </div>
      </header>

      {users.length > 0 && (
        <div className={styles.stats}>
          <div className={styles.stat}><span className={styles.statIco}><Ico d={<><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7M17 4a4 4 0 0 1 0 8M22 21c0-3-2-5.5-5-6.5"/></>} size={18} /></span><div><b>{totalUsers.toLocaleString('en-GB')}</b><small>Players</small></div></div>
          <div className={styles.stat}><span className={`${styles.statIco} ${styles.gold}`}><CoinSVG size={18} /></span><div><b>{formatK(totalPoints)}</b><small>Points in circulation</small></div></div>
          <div className={styles.stat}><span className={`${styles.statIco} ${styles.green}`}><Ico d={<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>} size={18} /></span><div><b>{formatK(avgPoints)}</b><small>Average per player</small></div></div>
        </div>
      )}

      {myRank >= 0 && (
        <div className={styles.myRank}>
          <div className={styles.myPos}><small>Your rank</small><b>#{myRank + 1}</b></div>
          <div className={styles.myMid}>
            <span className={styles.myPts}><CoinSVG size={16} />{users[myRank].points?.toLocaleString('en-GB')} pts</span>
            {ahead
              ? <span className={styles.myGap}>{gap.toLocaleString('en-GB')} pts to pass <b>{ahead.username}</b> (#{myRank})</span>
              : <span className={styles.myGap}>You are leading the board.</span>}
            {ahead && <div className={styles.myTrack}><i style={{ width: `${Math.min(100, ((users[myRank].points || 0) / Math.max(1, ahead.points || 1)) * 100)}%` }} /></div>}
          </div>
        </div>
      )}

      {podiumOrder.length === 3 && !search && (
        <div className={styles.podium}>
          {podiumOrder.map((p, i) => {
            const idx   = podiumIdx[i]
            const col   = PODIUM_COLORS[idx]
            const first = idx === 0
            const mine  = p.username?.toLowerCase() === myUsername
            return (
              <div key={p.username} className={`${styles.podiumCard} ${styles['pod' + idx]} ${mine ? styles.podMe : ''}`} style={{ '--c': col.bg, '--glow': col.glow }}>
                {first && (
                  <svg className={styles.crown} width="34" height="26" viewBox="0 0 34 26" aria-hidden="true">
                    <path d="M2 22L5 6l8 8 4-11 4 11 8-8 3 16z" fill="currentColor" stroke="rgba(0,0,0,.35)" strokeWidth="1.2" strokeLinejoin="round"/>
                  </svg>
                )}
                <div className={styles.podiumAvatarWrap}>
                  <TwitchAvatar username={p.username} size={first ? 92 : 72} className={styles.podiumAvatar} />
                  <span className={styles.podiumBadge}>{idx + 1}</span>
                </div>
                <SlideText text={p.username} className={styles.podiumName} />
                <div className={styles.podiumPoints}>{p.points?.toLocaleString('en-GB')} <CoinSVG size={15} color={col.bg} /></div>
                <div className={styles.step}><span>{col.label}</span></div>
              </div>
            )
          })}
        </div>
      )}

      <div className={styles.searchWrap}>
        <div className={styles.searchBox}>
          <Ico d={<><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></>} />
          <input className={styles.searchInput} type="text" placeholder="Search player..." value={search} onChange={handleSearch} spellCheck={false} />
          {search && <button className={styles.searchClear} onClick={() => { setSearch(''); setPage(1) }} aria-label="Clear"><Ico d={<path d="M18 6L6 18M6 6l12 12"/>} size={14} sw={2.5} /></button>}
        </div>
        {search && <span className={styles.searchCount}>{tableUsers.length} result{tableUsers.length !== 1 ? 's' : ''}</span>}
      </div>

      {tableUsers.length > 0 ? (
        <>
          <div className={styles.table}>
            <div className={styles.tableHeader}><span>#</span><span>Player</span><span>Points</span></div>
            {pageSlice.map((u) => {
              const rank = users.findIndex(x => x.username === u.username) + 1
              const isMe = u.username?.toLowerCase() === myUsername
              return (
                <div key={u.username} className={`${styles.tableRow} ${isMe ? styles.tableRowMe : ''}`} style={{ '--p': Math.max(2, ((u.points || 0) / maxPts) * 100) }}>
                  <span className={styles.colPos}>{rank}</span>
                  <div className={styles.colPlayer}>
                    <div className={styles.rowAvatarWrap}><TwitchAvatar username={u.username} size={36} className={styles.rowAvatar} /></div>
                    <SlideText text={u.username} className={styles.rowName} />
                    {isMe && <span className={styles.youBadge}>YOU</span>}
                  </div>
                  <span className={styles.colPoints}>{u.points?.toLocaleString('en-GB')} <CoinSVG size={13} /></span>
                </div>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous"><Ico d={<path d="M15 6l-6 6 6 6"/>} size={16} sw={2.5} /></button>
              {(() => {
                const pages = []
                const delta = 2
                const left  = Math.max(2, page - delta)
                const right = Math.min(totalPages - 1, page + delta)
                pages.push(1)
                if (left > 2) pages.push('...')
                for (let i = left; i <= right; i++) pages.push(i)
                if (right < totalPages - 1) pages.push('...')
                if (totalPages > 1) pages.push(totalPages)
                return pages.map((n, i) =>
                  n === '...'
                    ? <span key={`e${i}`} className={styles.pageEllipsis}>…</span>
                    : <button key={n} className={`${styles.pageBtn} ${n === page ? styles.pageBtnActive : ''}`} onClick={() => setPage(n)}>{n}</button>
                )
              })()}
              <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next"><Ico d={<path d="M9 6l6 6-6 6"/>} size={16} sw={2.5} /></button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptySearch}>
          <Ico d={<><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></>} size={34} />
          <p>No players found for "{search}"</p>
        </div>
      )}
    </div>
  )
}
