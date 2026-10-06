import { useState, useEffect, useCallback } from 'react'
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

// ── Icons ─────────────────────────────────────────────────────────────────────
const I = {
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>,
  grid: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  bolt: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>,
  box: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>,
  crown: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18l-1-11 6 5 4-8 4 8 6-5-1 11z"/></svg>,
}

const SORTS = [
  ['top',    'Top multiplier'],
  ['played', 'Most played'],
  ['new',    'Newest'],
  ['az',     'A - Z'],
]
const STEP = 36

// ── Slot Card ─────────────────────────────────────────────────────────────────
function SlotImg({ slot, className }) {
  const [bad, setBad] = useState(false)
  const initials = (slot.name || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
  return slot.image_url && !bad
    ? <img src={slot.image_url} alt={slot.name} className={className} loading="lazy" onError={() => setBad(true)} />
    : <div className={styles.slotFallback}>{initials}</div>
}

function SlotCard({ slot, avg, plays, onClick }) {
  return (
    <button type="button" className={styles.slotCard} onClick={onClick}>
      <div className={styles.slotImgWrap}>
        <SlotImg slot={slot} className={styles.slotImg} />
        {avg != null && <span className={styles.avgTag}>{Math.round(avg).toLocaleString('pt-PT')}x</span>}
      </div>
      <div className={styles.cardInfo}>
        <div className={styles.cardName}>{slot.name}</div>
        <div className={styles.cardProv}>
          <span>{slot.provider || '-'}</span>
          {plays > 0 && <b>{plays} bonus</b>}
        </div>
      </div>
    </button>
  )
}

function Spot({ slot, rank, avg, plays, onClick }) {
  return (
    <button type="button" className={`${styles.spot} ${styles['spot' + rank]}`} onClick={onClick}>
      <SlotImg slot={slot} className={styles.spotImg} />
      <span className={styles.spotRank}>{rank}</span>
      <div className={styles.spotBody}>
        <div className={styles.spotName}>{slot.name}</div>
        <div className={styles.spotProv}>{slot.provider}</div>
        <div className={styles.spotStats}>
          <div><small>Avg multi</small><strong>{Math.round(avg).toLocaleString('pt-PT')}x</strong></div>
          <div><small>Bonuses</small><strong>{plays}</strong></div>
        </div>
      </div>
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Slots() {
  const location = useLocation()
  const navigate = useNavigate()
  const [allSlotsDb,     setAllSlotsDb]     = useState([])
  const [playCounts,     setPlayCounts]     = useState({})
  const [avgMultipliers, setAvgMultipliers] = useState({})
  const [providers,      setProviders]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState(() => new URLSearchParams(window.location.search).get('q') || '')
  const [provFilter, setProvFilter] = useState('')
  const [volFilter,  setVolFilter]  = useState('')
  const [sort,       setSort]       = useState('top')
  const [shown,      setShown]      = useState(STEP)
  const [selected,   setSelected]   = useState(null)

  // Auto-open slot se vier do Stats popover
  useEffect(() => {
    const slotId = location.state?.slotId
    if (!slotId || selected) return
    const found = allSlotsDb.find(s => s.id === slotId)
    if (found) { setSelected(found); return }
    supabaseDash.from('slots').select('*').eq('id', slotId).single()
      .then(({ data }) => { if (data) setSelected(data) })
  }, [allSlotsDb, location.state])

  useEffect(() => { setShown(STEP) }, [search, provFilter, volFilter, sort])

  const load = useCallback(async () => {
    setLoading(true)

    const { data: entries } = await supabaseDash
      .from('bonus_entries')
      .select('slot_id, bet, payment')
      .eq('opened', true)
      .not('payment', 'is', null)

    const counts = {}
    const multiSums = {}
    const multiCounts = {}
    ;(entries || []).forEach(e => {
      if (!e.slot_id) return
      counts[e.slot_id] = (counts[e.slot_id] || 0) + 1
      const bet = parseBet(e.bet)
      const pay = parseBet(e.payment)
      if (bet > 0) {
        multiSums[e.slot_id]   = (multiSums[e.slot_id]   || 0) + pay / bet
        multiCounts[e.slot_id] = (multiCounts[e.slot_id] || 0) + 1
      }
    })
    const avgs = {}
    Object.keys(multiSums).forEach(id => { avgs[id] = multiSums[id] / multiCounts[id] })
    setPlayCounts(counts)
    setAvgMultipliers(avgs)

    const PAGE_SIZE = 1000
    let all = []
    let from = 0
    for (;;) {
      const { data: batch, error } = await supabaseDash
        .from('slots')
        .select('id, name, provider, image_url, rtp, max_win, volatility, release_date, created_at')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
      if (error || !batch?.length) break
      all = [...all, ...batch]
      if (batch.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
    setAllSlotsDb(all)

    const provCounts = {}
    all.forEach(s => { if (s.provider) provCounts[s.provider] = (provCounts[s.provider] || 0) + 1 })
    setProviders(Object.entries(provCounts).sort((a, b) => a[0].localeCompare(b[0])))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const volatilities = [...new Set(allSlotsDb.map(s => s.volatility).filter(Boolean))].sort()
  const q = norm(search)
  const searching = !!(q || provFilter || volFilter)

  if (selected) return <SlotDetail slot={selected} onBack={() => setSelected(null)} navigate={navigate} />

  const withStats = allSlotsDb.filter(s => avgMultipliers[s.id] != null || playCounts[s.id])
  const spotlight = [...withStats]
    .filter(s => avgMultipliers[s.id] != null)
    .sort((a, b) => avgMultipliers[b.id] - avgMultipliers[a.id])
    .slice(0, 5)

  let pool = allSlotsDb.filter(s =>
    (!q || norm(s.name).includes(q) || norm(s.provider || '').includes(q)) &&
    (!provFilter || s.provider === provFilter) &&
    (!volFilter || s.volatility === volFilter))
  if (!searching && (sort === 'top' || sort === 'played')) pool = pool.filter(s => avgMultipliers[s.id] != null || playCounts[s.id])
  const cmp = {
    top:    (a, b) => (avgMultipliers[b.id] ?? -1) - (avgMultipliers[a.id] ?? -1),
    played: (a, b) => (playCounts[b.id] || 0) - (playCounts[a.id] || 0),
    new:    () => 0,
    az:     (a, b) => (a.name || '').localeCompare(b.name || ''),
  }[sort]
  pool = [...pool].sort(cmp)
  const skip = !searching && sort === 'top' && spotlight.length >= 3 ? spotlight.length : 0
  const visible = pool.slice(skip, skip + shown)

  const totalBonus = Object.values(playCounts).reduce((a, b) => a + b, 0)
  const best = spotlight[0]
  const clearAll = () => { setSearch(''); setProvFilter(''); setVolFilter('') }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <SlotSVG className={styles.titleIcon} size={30} />
            Slots
          </h1>
          <p className={styles.sub}>Every slot we have opened on stream, with the real numbers behind it.</p>
        </div>
        <div className={styles.kpis}>
          <div className={styles.kpi}>{I.grid}<div><small>Slots</small><strong>{allSlotsDb.length.toLocaleString('pt-PT')}</strong></div></div>
          <div className={styles.kpi}>{I.box}<div><small>Bonuses opened</small><strong>{totalBonus.toLocaleString('pt-PT')}</strong></div></div>
          <div className={styles.kpi}>{I.crown}<div><small>Best avg multi</small><strong>{best ? `${Math.round(avgMultipliers[best.id]).toLocaleString('pt-PT')}x` : '-'}</strong></div></div>
        </div>
      </div>

      {!searching && !loading && spotlight.length >= 3 && (
        <section className={styles.spotWrap} aria-label="Top multipliers">
          <h2 className={styles.h2}>{I.bolt} Top multipliers</h2>
          <div className={styles.spots}>
            {spotlight.map((s, i) => (
              <Spot key={s.id} slot={s} rank={i + 1} avg={avgMultipliers[s.id]} plays={playCounts[s.id] || 0} onClick={() => setSelected(s)} />
            ))}
          </div>
        </section>
      )}

      <div className={styles.toolbar}>
        <label className={styles.searchBox}>
          {I.search}
          <input type="text" placeholder="Search slot or provider" value={search}
            onChange={e => setSearch(e.target.value)} className={styles.searchInput} aria-label="Filter slots or providers" />
          {search && <button type="button" className={styles.clearBtn} onClick={() => setSearch('')} aria-label="Clear search">{I.x}</button>}
        </label>
        <select className={styles.provSelect} value={provFilter} onChange={e => setProvFilter(e.target.value)} aria-label="Provider">
          <option value="">All providers</option>
          {providers.map(([p, n]) => <option key={p} value={p}>{p} ({n})</option>)}
        </select>
        {volatilities.length > 0 && (
          <select className={styles.provSelect} value={volFilter} onChange={e => setVolFilter(e.target.value)} aria-label="Volatility">
            <option value="">Any volatility</option>
            {volatilities.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        )}
      </div>

      <div className={styles.sortRow}>
        <div className={styles.sortTabs} role="tablist">
          {SORTS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={sort === id}
              className={`${styles.sortTab} ${sort === id ? styles.sortOn : ''}`} onClick={() => setSort(id)}>{label}</button>
          ))}
        </div>
        <div className={styles.count}>
          {loading ? 'Loading...' : `${pool.length.toLocaleString('pt-PT')} slots`}
          {searching && <button type="button" className={styles.reset} onClick={clearAll}>Clear filters</button>}
        </div>
      </div>

      {loading ? (
        <div className={styles.grid}>{[...Array(12)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}</div>
      ) : pool.length === 0 ? (
        <div className={styles.empty}><p>No slots found.</p>{searching && <button type="button" className={styles.reset} onClick={clearAll}>Clear filters</button>}</div>
      ) : (
        <>
          <div className={styles.grid}>
            {visible.map(s => (
              <SlotCard key={s.id} slot={s} avg={avgMultipliers[s.id]} plays={playCounts[s.id] || 0} onClick={() => setSelected(s)} />
            ))}
          </div>
          {skip + shown < pool.length && (
            <button type="button" className={styles.more} onClick={() => setShown(n => n + STEP)}>
              Show more ({pool.length - skip - shown} left)
            </button>
          )}
        </>
      )}
    </div>
  )
}
