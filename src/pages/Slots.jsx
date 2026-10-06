import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabaseDash } from '../lib/supabase'
import styles from './Slots.module.css'

function norm(s) { return (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() }
function parseBet(v) { return parseFloat(v) || 0 }
function fmt(n, d = 2) {
  return parseFloat(n).toLocaleString('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// ── SVG Personalizado da Sidebar ──────────────────────────────────────────────
const SlotSVG = ({ size = 28, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <rect x="2" y="6" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.7"/>
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    <rect x="5" y="10" width="4" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="10" y="10" width="4" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="15" y="10" width="4" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="18.5" r=".8" fill="currentColor"/>
  </svg>
)

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}><i className={`bx ${icon}`} /></div>
      <div>
        <div className={styles.statLabel}>{label}</div>
        <div className={styles.statValue}>{value}</div>
      </div>
    </div>
  )
}

// ── Slot Detail ───────────────────────────────────────────────────────────────
function SlotDetail({ slot, onBack, navigate }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(1)
  const [filter, setFilter]   = useState('all')
  const [hunts, setHunts]     = useState([])
  const PER_PAGE = 10

  useEffect(() => {
    setPage(1); setFilter('all'); setLoading(true)
    supabaseDash
      .from('bonus_entries')
      .select('*, game_type, bonus_hunts(id, title, date)')
      .eq('slot_id', slot.id)
      .eq('opened', true)
      .not('payment', 'is', null)
      .order('paid_at', { ascending: false })
      .then(({ data }) => {
        const rows = (data || []).filter(e => parseBet(e.bet) > 0)
        setEntries(rows)
        const seen = new Set()
        const hs = []
        rows.forEach(e => {
          if (e.hunt_id && !seen.has(e.hunt_id)) {
            seen.add(e.hunt_id)
            hs.push({ id: e.hunt_id, date: e.bonus_hunts?.date })
          }
        })
        setHunts(hs)
        setLoading(false)
      })
  }, [slot.id])

  // Stats
  const withMulti = entries.map(e => ({
    ...e, multi: parseBet(e.payment) / parseBet(e.bet)
  }))
  const avgMulti = withMulti.length
    ? withMulti.reduce((a, e) => a + e.multi, 0) / withMulti.length : 0
  const bestEntry = [...withMulti].sort((a, b) => b.multi - a.multi)[0] || null
  const bestWin   = [...withMulti].sort((a, b) => parseBet(b.payment) - parseBet(a.payment))[0] || null

  const filtered    = filter === 'all' ? withMulti : withMulti.filter(e => String(e.hunt_id) === String(filter))
  const totalPages  = Math.ceil(filtered.length / PER_PAGE)
  const pageEntries = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className={styles.detailPage}>

      {/* Header */}
      <div className={styles.detailHeader}>
        <button className={styles.backBtn} onClick={onBack}>
          <i className="bx bx-chevron-left" />
        </button>
        <div>
          <h1 className={styles.detailTitle}>{slot.name}</h1>
          <p className={styles.detailSub}>Check all the stats behind this slot</p>
        </div>
      </div>

      <div className={styles.detailLayout}>

        {/* ── LEFT ── */}
        <aside className={styles.detailLeft}>

          {/* Slot image card */}
          <div className={styles.slotInfoCard}>
            <div className={styles.slotInfoImgWrap}>
              <img
                src={slot.image_url}
                alt={slot.name}
                className={styles.slotInfoImg}
                onError={e => { e.target.style.opacity = '.3' }}
              />
            </div>
            <div className={styles.slotInfoName}>{slot.name}</div>
            <div className={styles.slotInfoProv}>{slot.provider}</div>
          </div>

          {/* Info rows */}
          {slot.rtp && (
            <div className={styles.infoRow}>
              <div className={styles.infoRowIcon}><i className="bx bx-refresh" /></div>
              <div>
                <div className={styles.infoRowLabel}>RTP</div>
                <div className={styles.infoRowVal}>{parseFloat(slot.rtp).toFixed(2)}%</div>
              </div>
            </div>
          )}
          {slot.volatility && (
            <div className={styles.infoRow}>
              <div className={styles.infoRowIcon}><i className="bx bx-trending-up" /></div>
              <div>
                <div className={styles.infoRowLabel}>Volatility</div>
                <div className={styles.infoRowVal}>{slot.volatility}</div>
              </div>
            </div>
          )}
          {slot.max_win && (
            <div className={styles.infoRow}>
              <div className={styles.infoRowIcon}><i className="bx bx-crown" /></div>
              <div>
                <div className={styles.infoRowLabel}>Max win</div>
                <div className={styles.infoRowVal}>X{parseInt(slot.max_win).toLocaleString('pt-PT')}</div>
              </div>
            </div>
          )}
          {slot.release_date && (
            <div className={styles.infoRow}>
              <div className={styles.infoRowIcon}><i className="bx bx-calendar" /></div>
              <div>
                <div className={styles.infoRowLabel}>Release date</div>
                <div className={styles.infoRowVal}>{slot.release_date}</div>
              </div>
            </div>
          )}
        </aside>

        {/* ── RIGHT ── */}
        <section className={styles.detailRight}>

          {/* Stat cards — sem faixa hero, directamente aqui */}
          <div className={styles.statsRow}>
            <StatCard icon="bx-x"      label="Average multiplier" value={avgMulti > 0 ? `${Math.round(avgMulti)}X` : '—'} />
            <StatCard icon="bx-package" label="Total bonus"       value={entries.length || '—'} />
            <StatCard icon="bx-x"      label="Best multiplier"    value={bestEntry ? `${Math.round(bestEntry.multi)}X` : '—'} />
            <StatCard icon="bx-star"   label="Best win"           value={bestWin ? `${fmt(parseBet(bestWin.payment))} €` : '—'} />
          </div>

          {/* Table */}
          <div className={styles.tableWrap}>
            {hunts.length > 1 && (
              <div className={styles.tableFilter}>
                <select
                  className={styles.huntSelect}
                  value={filter}
                  onChange={e => { setFilter(e.target.value); setPage(1) }}
                >
                  <option value="all">All bonus</option>
                  {hunts.map(h => (
                    <option key={h.id} value={h.id}>
                      Bonus Hunt #{h.id}{h.date ? ` — ${h.date}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {loading ? (
              <div className={styles.tableLoading}><div className={styles.spinner} /> Loading...</div>
            ) : filtered.length === 0 ? (
              <div className={styles.tableEmpty}>No entries found.</div>
            ) : (
              <>
                <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>BET</th>
                      <th>MULTIPLIER</th>
                      <th>WIN</th>
                      <th>DATE</th>
                      <th>GAME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageEntries.map((e, i) => {
                      const mc = e.multi >= 200 ? styles.multiGood : e.multi >= 80 ? styles.multiMid : styles.multiBad
                      return (
                        <tr key={e.id || i}>
                          <td className={styles.tdBet}>
                            <div className={styles.betCell}>
                              {fmt(parseBet(e.bet))} €
                              {e.is_super && <span className={styles.superBadge}>SUPER</span>}
                            </div>
                          </td>
                          <td className={`${styles.tdMulti} ${mc}`}>X{Math.round(e.multi)}</td>
                          <td className={styles.tdWin}><strong>{fmt(parseBet(e.payment))} €</strong></td>
                          <td className={styles.tdDate}>{fmtDate(e.paid_at || e.bonus_hunts?.date)}</td>
                          <td>
                            {(() => {
                              const type = e.game_type || 'bonus_hunt'
                              if (type === 'bonus_hunt' && e.hunt_id) {
                                return (
                                  <button
                                    className={`${styles.gameTag} ${styles.gameTagHunt} ${styles.gameTagBtn}`}
                                    onClick={() => navigate('/bonus-hunts', { state: { huntId: e.hunt_id } })}
                                  >
                                    BONUS HUNT #{e.hunt_id}
                                  </button>
                                )
                              }
                              if (type === 'tournament') return (
                                e.tournament_id
                                  ? <button
                                      className={`${styles.gameTag} ${styles.gameTagTournament} ${styles.gameTagBtn}`}
                                      onClick={() => navigate('/torneios', { state: { tournamentId: e.tournament_id } })}
                                    >TOURNAMENT #{e.tournament_id}</button>
                                  : <span className={`${styles.gameTag} ${styles.gameTagTournament}`}>TOURNAMENT</span>
                              )
                              if (type === 'spin')       return <span className={`${styles.gameTag} ${styles.gameTagSpin}`}>SPIN</span>
                              if (type === 'bonus_buy')  return <span className={`${styles.gameTag} ${styles.gameTagBuy}`}>BONUS BUY</span>
                              return (
                                <button
                                  className={`${styles.gameTag} ${styles.gameTagHunt} ${styles.gameTagBtn}`}
                                  onClick={() => navigate('/bonus-hunts', { state: { huntId: e.hunt_id } })}
                                >
                                  BONUS HUNT #{e.hunt_id}
                                </button>
                              )
                            })()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>

                {totalPages > 1 && (
                  <div className={styles.pagination}>
                    <button className={styles.pgBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                      <i className="bx bx-chevron-left" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        className={`${styles.pgBtn} ${page === i + 1 ? styles.pgActive : ''}`}
                        onClick={() => setPage(i + 1)}
                      >{i + 1}</button>
                    ))}
                    <button className={styles.pgBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                      <i className="bx bx-chevron-right" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

// ── Slot Card ─────────────────────────────────────────────────────────────────
function SlotCard({ slot, badge, onClick }) {
  const initials = (slot.name || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
  return (
    <div className={styles.slotCard} onClick={onClick}>
      <div className={styles.slotImgWrap}>
        <img src={slot.image_url || ''} alt={slot.name} className={styles.slotImg} loading="lazy"
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
        <div className={styles.slotFallback} style={{ display: 'none' }}>{initials}</div>
        {badge && (
          <span className={`${styles.badge} ${styles['badge' + badge]}`}>
            <span className={styles.badgeDot} />{badge}
          </span>
        )}
      </div>
      <div className={styles.slotHover}>
        <div className={styles.hoverName}>{slot.name}</div>
        <div className={styles.hoverProv}>{slot.provider}</div>
        <div className={styles.hoverMeta}>
          {slot.rtp && <span>RTP {parseFloat(slot.rtp).toFixed(1)}%</span>}
          {slot.max_win && <span>{slot.max_win}x</span>}
        </div>
      </div>
    </div>
  )
}

// ── 3D ring carousel ──────────────────────────────────────────────────────────
function CoverSection({ icon, title, count, slots, badge, loading, onSlotClick, avgs, plays }) {
  const n = slots.length
  const step = n ? 360 / n : 0
  const [angle, setAngle] = useState(0)       // current rotation (deg)
  const [dragging, setDragging] = useState(false)
  const [vw, setVw] = useState(() => window.innerWidth)
  const drag = useRef(null)
  const moved = useRef(false)

  useEffect(() => {
    const on = () => setVw(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  useEffect(() => { setAngle(0) }, [n])

  const mobile = vw <= 640
  const w = mobile ? 150 : vw <= 1100 ? 176 : 214
  const R = n > 2 ? Math.max(w * 1.15, (w * 1.45) / (2 * Math.tan(Math.PI / n))) : w

  const active = n ? ((Math.round(-angle / step) % n) + n) % n : 0
  const snap = a => Math.round(a / step) * step
  const goTo = i => {
    // shortest way around the ring
    const target = -i * step
    let d = target - angle
    d = ((d + 180) % 360 + 360) % 360 - 180
    setAngle(snap(angle + d))
  }
  const move = d => setAngle(a => snap(a) - d * step)

  const onDown = e => { drag.current = { x: e.clientX, a: angle }; moved.current = false; setDragging(true) }
  const onMove = e => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    if (Math.abs(dx) > 4) moved.current = true
    setAngle(drag.current.a + dx * 0.35)
  }
  const onUp = () => {
    if (!drag.current) return
    drag.current = null
    setDragging(false)
    setAngle(a => snap(a))
  }

  const cur = slots[active]
  const Chev = ({ d }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>

  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionLeft}>
          <h2 className={styles.sectionTitle}>{icon}{title}</h2>
          {count > 0 && <span className={styles.sectionCount}>{count}</span>}
        </div>
      </div>
      {loading || !n ? (
        <div className={styles.carouselLoading}>{[...Array(7)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}</div>
      ) : (
        <div className={styles.ringWrap}>
          <button type="button" className={`${styles.cfArr} ${styles.cfL}`} aria-label={`Previous ${title}`} onClick={() => move(-1)}><Chev d="M15 18l-6-6 6-6" /></button>
          <div className={styles.ring} style={{ '--w': `${w}px`, '--h': `${Math.round(w * 4 / 3)}px` }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onPointerCancel={onUp}>
            <div className={styles.ringInner}
              style={{ transform: `translateZ(${-R}px) rotateY(${angle}deg)`, transition: dragging ? 'none' : 'transform .7s cubic-bezier(.2,.8,.2,1)' }}>
              {slots.map((slot, i) => {
                const dist = Math.abs(((i * step + angle) % 360 + 540) % 360 - 180) // 0 = front, 180 = back
                const dim = 1 - Math.min(dist, 160) / 160 * 0.65
                return (
                  <button type="button" key={slot.id}
                    className={`${styles.ringCard} ${i === active ? styles.ringOn : ''}`}
                    style={{ transform: `rotateY(${i * step}deg) translateZ(${R}px)`, filter: `brightness(${dim.toFixed(2)})` }}
                    aria-label={slot.name}
                    onClick={() => { if (moved.current) return; i === active ? onSlotClick(slot) : goTo(i) }}>
                    <img src={slot.image_url || ''} alt="" draggable="false" loading="lazy"
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                    <div className={styles.slotFallback} style={{ display: 'none' }}>{(slot.name || '?').split(' ').slice(0, 2).map(w2 => w2[0] || '').join('').toUpperCase()}</div>
                    {badge && <span className={`${styles.badge} ${styles['badge' + badge]}`}><span className={styles.badgeDot} />{badge}</span>}
                  </button>
                )
              })}
            </div>
          </div>
          <button type="button" className={`${styles.cfArr} ${styles.cfR}`} aria-label={`Next ${title}`} onClick={() => move(1)}><Chev d="M9 6l6 6-6 6" /></button>
          {cur && (
            <div className={styles.ringCap}>
              <div className={styles.capHead}>
                <strong>{cur.name}</strong>
                <span className={styles.capProv}>{cur.provider || '-'}{cur.volatility ? ` · ${cur.volatility} volatility` : ''}</span>
              </div>
              <div className={styles.capStats}>
                <div><small>Avg multiplier</small><b className={styles.gold}>{avgs[cur.id] != null ? `${Math.round(avgs[cur.id]).toLocaleString('pt-PT')}x` : '-'}</b></div>
                <div><small>Bonuses</small><b>{plays[cur.id] || 0}</b></div>
                <div><small>RTP</small><b>{cur.rtp ? `${parseFloat(cur.rtp).toFixed(2)}%` : '-'}</b></div>
                <div><small>Max win</small><b>{cur.max_win ? `${parseInt(cur.max_win).toLocaleString('pt-PT')}x` : '-'}</b></div>
              </div>
              <button type="button" className={styles.capBtn} onClick={() => onSlotClick(cur)}>View all stats</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Slots() {
  const location = useLocation()
  const navigate = useNavigate()
  const [allSlots,       setAllSlots]       = useState([])
  const [allSlotsDb,     setAllSlotsDb]     = useState([])
  const [playCounts,     setPlayCounts]     = useState({})
  const [avgMultipliers, setAvgMultipliers] = useState({})
  const [providers,      setProviders]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState(() => new URLSearchParams(window.location.search).get('q') || '')
  const [provFilter, setProvFilter] = useState('')
  const [selected,   setSelected]   = useState(null)

  // Auto-open slot se vier do Stats popover
  useEffect(() => {
    const slotId = location.state?.slotId
    if (!slotId || selected) return

    // Primeiro tenta nos já carregados
    const found = allSlotsDb.find(s => s.id === slotId) || allSlots.find(s => s.id === slotId)
    if (found) { setSelected(found); return }

    // Se ainda não carregou, vai buscar diretamente à DB
    supabaseDash.from('slots').select('*').eq('id', slotId).single()
      .then(({ data }) => { if (data) setSelected(data) })
  }, [allSlotsDb, allSlots, location.state])

  const load = useCallback(async () => {
    setLoading(true)

    // Buscar entradas abertas com bet e payment para calcular multipliers
    const { data: entries } = await supabaseDash
      .from('bonus_entries')
      .select('slot_id, bet, payment')
      .eq('opened', true)
      .not('payment', 'is', null)

    const counts = {}
    const multiSums = {}
    const multiCounts = {}
    const usedIds = new Set()

    ;(entries || []).forEach(e => {
      if (!e.slot_id) return
      usedIds.add(e.slot_id)
      counts[e.slot_id] = (counts[e.slot_id] || 0) + 1

      const bet = parseBet(e.bet)
      const pay = parseBet(e.payment)
      if (bet > 0) {
        const multi = pay / bet
        multiSums[e.slot_id]   = (multiSums[e.slot_id]   || 0) + multi
        multiCounts[e.slot_id] = (multiCounts[e.slot_id] || 0) + 1
      }
    })

    // AVG multiplier por slot
    const avgMultipliers = {}
    Object.keys(multiSums).forEach(id => {
      avgMultipliers[id] = multiSums[id] / multiCounts[id]
    })

    if (!usedIds.size) { setLoading(false); return }

    const { data: slots } = await supabaseDash.from('slots').select('*').in('id', [...usedIds]).order('name')
    const slotData = slots || []
    setAllSlots(slotData)
    setPlayCounts(counts)
    setAvgMultipliers(avgMultipliers)

    // Todas as slots (para search e New Slots)
    const PAGE_SIZE = 1000
    let allDbSlots = []
    let from = 0
    let hasMore = true
    while (hasMore) {
      const { data: batch, error } = await supabaseDash
        .from('slots')
        .select('id, name, provider, image_url, rtp, max_win, volatility, release_date, created_at')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
      if (error || !batch?.length) { hasMore = false; break }
      allDbSlots = [...allDbSlots, ...batch]
      if (batch.length < PAGE_SIZE) hasMore = false
      else from += PAGE_SIZE
    }
    setAllSlotsDb(allDbSlots)

    // Provider list de TODAS as slots
    const provCounts = {}
    ;(allDbSlots || []).forEach(s => { if (s.provider) provCounts[s.provider] = (provCounts[s.provider] || 0) + 1 })
    setProviders(Object.entries(provCounts).sort((a, b) => a[0].localeCompare(b[0])))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (selected) return <SlotDetail slot={selected} onBack={() => setSelected(null)} navigate={navigate} />

  // Top Slots — maior AVG multiplier
  const topSlots   = [...allSlots]
    .filter(s => avgMultipliers[s.id] != null)
    .sort((a, b) => (avgMultipliers[b.id] || 0) - (avgMultipliers[a.id] || 0))
    .slice(0, 12)

  // Most Played — mais bonus (entradas abertas com payment)
  const mostPlayed = [...allSlots]
    .sort((a, b) => (playCounts[b.id] || 0) - (playCounts[a.id] || 0))
    .slice(0, 12)

  // New Slots — todas as slots da DB, mais recentes primeiro
  const newSlots = allSlotsDb.slice(0, 12)
  // Search usa allSlotsDb
  const filtered = (search || provFilter)
    ? allSlotsDb.filter(s => {
        const q = norm(search)
        return (!q || norm(s.name).includes(q) || norm(s.provider || '').includes(q))
            && (!provFilter || s.provider === provFilter)
      })
    : null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <SlotSVG className={styles.titleIcon} size={28} />
          Slots
        </h1>
        <p className={styles.sub}>Check our top slots, most played slots, etc and find all the stats behind them</p>
      </div>
      <div className={styles.filterbar}>
        <div className={styles.searchBox}>
          <i className="bx bx-search" />
          <input type="text" placeholder="Search..." value={search}
            onChange={e => setSearch(e.target.value)} className={styles.searchInput} />
          {search && <button className={styles.clearBtn} onClick={() => setSearch('')}>✕</button>}
        </div>
        <select className={styles.provSelect} value={provFilter} onChange={e => setProvFilter(e.target.value)}>
          <option value="">All providers</option>
          {providers.map(([p]) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {filtered
        ? filtered.length === 0
          ? <div className={styles.empty}><div className={styles.emptyIcon}>🎰</div><p>No slots found.</p></div>
          : <div className={styles.searchGrid}>{filtered.map(s => <SlotCard key={s.id} slot={s} onClick={() => setSelected(s)} />)}</div>
        : <>
            <CoverSection avgs={avgMultipliers} plays={playCounts} 
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
              title="Top Slots"   
              count={topSlots.length}   
              slots={topSlots}   
              badge="TOP" 
              loading={loading} 
              onSlotClick={setSelected} 
            />
            <CoverSection avgs={avgMultipliers} plays={playCounts} 
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
              title="Most played" 
              count={mostPlayed.length} 
              slots={mostPlayed}             
              loading={loading} 
              onSlotClick={setSelected} 
            />
         <CoverSection avgs={avgMultipliers} plays={playCounts} 
  icon={
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.8a2 2 0 0 1 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 1-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 1-1.3-1.3L3 12l5.8-1.9a2 2 0 0 1 1.3-1.3L12 3z"/>
    </svg>
  }
  title="New Slots"   
  count={newSlots.length}   
  slots={newSlots}   
  badge="NEW" 
  loading={loading} 
  onSlotClick={setSelected} 
/>
          </>
      }
    </div>
  )
}