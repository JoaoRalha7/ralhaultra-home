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

  return (
    <div className={styles.page}>

      {/* ── HEADER ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}><TrophySVG />LEADERBOARD</h1>
            {users.length > 0 && (
              <div className={styles.statPills}>
                <div className={styles.statPill}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="4" stroke="var(--blue)" strokeWidth="1.8"/><path d="M2 21c0-4 3.134-7 7-7s7 3 7 7" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round"/><path d="M19 8v6M22 11h-6" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  <span className={styles.statPillVal}>{totalUsers.toLocaleString('en-GB')}</span>
                  <span className={styles.statPillLbl}>users</span>
                </div>
                <div className={styles.statPill}>
                  <CoinSVG size={13} />
                  <span className={styles.statPillVal}>{formatK(totalPoints)}</span>
                  <span className={styles.statPillLbl}>pts</span>
                </div>
                <div className={styles.statPill}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 12h18M8 7l-5 5 5 5" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className={styles.statPillVal}>{formatK(avgPoints)}</span>
                  <span className={styles.statPillLbl}>avg</span>
                </div>
              </div>
            )}
          </div>
          <p className={styles.sub}>Top viewers ranked by points</p>
        </div>
        <div className={styles.headerRight}>
          {lastUpdated && (
            <span className={styles.updated}>
              Updated at {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button className={styles.refreshBtn} onClick={fetchLeaderboard} title="Refresh">
            <i className="bx bx-refresh" />
          </button>
        </div>
      </div>

      {/* ── MY RANK ── */}
      {myRank >= 0 && (
        <div className={styles.myRank}>
          <i className="bx bx-user" />
          <span>Your rank: <strong>#{myRank + 1}</strong></span>
          <span className={styles.myRankPoints}>
            <CoinSVG size={14} /> {users[myRank].points?.toLocaleString('en-GB')} pts
          </span>
        </div>
      )}

      {/* ── PÓDIO ── */}
      {podiumOrder.length === 3 && (
        <div className={styles.podium}>
          {podiumOrder.map((p, i) => {
            const colorIdx = podiumIdx[i]
            const col      = PODIUM_COLORS[colorIdx]
            const isFirst  = colorIdx === 0
            return (
              <div key={p.username} className={`${styles.podiumCard} ${isFirst ? styles.podiumFirst : ''}`} style={{ '--glow': col.glow }}>
                <div className={styles.podiumBadge} style={{ background: col.bg, color: '#000' }}>{col.label}</div>
                
                <div className={styles.podiumAvatarWrap} style={{ '--ring': col.ring, '--glow': col.glow }}>
                  <TwitchAvatar username={p.username} size={isFirst ? 100 : 80} className={styles.podiumAvatar} />
                </div>
                
                <SlideText text={p.username} className={styles.podiumName} />
                
                <div className={styles.podiumPoints} style={{ color: col.bg }}>
                  {p.points?.toLocaleString('en-GB')} <CoinSVG size={15} color={col.bg} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── SEARCH ── */}
      <div className={styles.searchWrap}>
        <div className={styles.searchBox}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search player..."
            value={search}
            onChange={handleSearch}
            spellCheck={false}
          />
          {search && (
            <button className={styles.searchClear} onClick={() => { setSearch(''); setPage(1) }}>
              <i className="bx bx-x" />
            </button>
          )}
        </div>
        {search && (
          <span className={styles.searchCount}>
            {tableUsers.length} result{tableUsers.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── TABELA ── */}
      {tableUsers.length > 0 ? (
        <>
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>#</span><span>PLAYER</span><span>POINTS</span>
            </div>
            {pageSlice.map((u, i) => {
              const rank = users.findIndex(x => x.username === u.username) + 1
              const isMe = u.username?.toLowerCase() === myUsername
              return (
                <div key={u.username} className={`${styles.tableRow} ${isMe ? styles.tableRowMe : ''}`}>
                  <span className={styles.colPos}>{rank}</span>
                  <div className={styles.colPlayer}>
                    <div className={styles.rowAvatarWrap}>
                      <TwitchAvatar username={u.username} size={36} className={styles.rowAvatar} />
                    </div>
                    <SlideText text={u.username} className={styles.rowName} />
                    {isMe && <span className={styles.youBadge}>YOU</span>}
                  </div>
                  <span className={styles.colPoints}>
                    {u.points?.toLocaleString('en-GB')} <CoinSVG size={13} />
                  </span>
                </div>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <i className="bx bx-chevron-left" />
              </button>
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
              <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <i className="bx bx-chevron-right" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptySearch}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="var(--muted2)" strokeWidth="1.8"/>
            <path d="M20 20l-3-3" stroke="var(--muted2)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <p>No players found for "{search}"</p>
        </div>
      )}
    </div>
  )
}