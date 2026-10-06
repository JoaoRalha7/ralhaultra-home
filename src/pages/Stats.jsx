import { useState, useEffect, useCallback, useRef } from 'react'
import { supabaseDash } from '../lib/supabase'
import styles from './Stats.module.css'

function parseBet(v) { return parseFloat(v) || 0 }
function fmt(n) {
  return parseBet(n).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}
function fmtX(x) {
  if (!x || x <= 0) return '—'
  const n = Math.round(x)
  if (n >= 1000) return 'X' + n.toLocaleString('pt-PT')
  return 'X' + n
}

function fmtCompact(n) {
  const v = parseBet(n)
  if (!v) return '—'
  if (v >= 10000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K€'
  if (v % 1 === 0) return v + '€'
  return v.toFixed(2).replace('.', ',') + '€'
}

const SORT_OPTIONS = [
  { value: 'biggest_win',   label: 'Biggest wins' },
  { value: 'biggest_multi', label: 'Biggest multiplier' },
  { value: 'biggest_bet',   label: 'Biggest bet' },
  { value: 'newest',        label: 'Most recent' },
]

const TYPE_OPTIONS = [
  { value: 'all',        label: 'All types' },
  { value: 'bonus_hunt', label: 'Bonus Hunt' },
  { value: 'bonus_buy',  label: 'Bonus Buy' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'spin',       label: 'Spin' },
]

const TYPE_LABELS = {
  bonus_hunt: 'BONUS HUNT',
  bonus_buy:  'BONUS BUY',
  tournament: 'TOURNAMENT',
  spin:       'SPIN',
}

// ── Efeito Ping-Pong Otimizado ───────────────────────────────────────────────
function SlideText({ text, className }) {
  const containerRef = useRef(null)
  const textRef = useRef(null)
  const [slideDist, setSlideDist] = useState(0)

  useEffect(() => {
    if (containerRef.current && textRef.current) {
      const cWidth = containerRef.current.clientWidth
      const tWidth = textRef.current.scrollWidth
      if (tWidth > cWidth) {
        setSlideDist(cWidth - tWidth - 6) 
      } else {
        setSlideDist(0)
      }
    }
  }, [text])

  return (
    <div className={`${styles.slideWrap} ${className || ''}`} ref={containerRef}>
      <div 
        className={`${styles.slideInner} ${slideDist < 0 ? styles.animPingPong : ''}`}
        style={{ '--slide-dist': `${slideDist}px` }}
      >
        <span className={styles.slideText} ref={textRef}>{text}</span>
      </div>
    </div>
  )
}

// ── Slot Popover ───────────────────────────────────────────────────────────────
function SlotPopover({ slot, slotStats, avgMulti, onClose, onNavigate, anchor }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (anchor) {
      const rect       = anchor.getBoundingClientRect()
      const popH       = 210
      const spaceBelow = window.innerHeight - rect.bottom
      const openUp     = spaceBelow < popH + 16
      setPos({
        top:  openUp ? rect.top - popH - 6 : rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - 377),
      })
    }
  }, [anchor])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const stats = slotStats || {}

  const PILLS = [
    {
      icon: <i className="bx bx-pie-chart-alt-2" />,
      lbl: 'RTP', val: slot?.rtp ? slot.rtp + '%' : '—'
    },
    {
      icon: <i className="bx bx-line-chart" />,
      lbl: 'Volatility', val: slot?.volatility || '—'
    },
    {
      icon: <i className="bx bx-trending-up" />,
      lbl: 'Avg. multi', val: fmtX(avgMulti)
    },
    {
      icon: <i className="bx bx-diamond" />,
      lbl: 'Max win', val: slot?.max_win ? 'X' + slot.max_win : '—'
    },
    {
      icon: <i className="bx bx-gift" />,
      lbl: 'Total opened', val: stats.total_bonus_opened ? String(stats.total_bonus_opened) : '—'
    },
    {
      icon: <i className="bx bx-trophy" />,
      lbl: 'Best win', val: stats.best_payment ? fmtCompact(stats.best_payment) : '—'
    },
  ]

  return (
    <div className={styles.popover} ref={ref} style={{ position: 'fixed', top: pos.top, left: pos.left }}>
      <div className={styles.popoverHead}>
        <div className={styles.popoverImgWrap}>
          <img src={slot?.image_url || ''} alt={slot?.name} className={styles.popoverImg}
            onError={ev => { ev.target.style.opacity = '.2' }} />
        </div>
        <div className={styles.popoverInfo}>
          <div className={styles.popoverProvider}>{slot?.provider || '—'}</div>
          <SlideText text={slot?.name || '—'} className={styles.popoverName} />
        </div>
        {onNavigate && (
          <button className={styles.popoverNavBtn} onClick={onNavigate} title="View slot">
            <i className="bx bx-link-external" />
          </button>
        )}
      </div>
      <div className={styles.popoverDivider} />
      <div className={styles.popoverPills}>
        {PILLS.map(({ icon, lbl, val }) => (
          <div key={lbl} className={styles.popoverPill}>
            <span className={styles.pillIcon}>{icon}</span>
            <div className={styles.pillText}>
              <div className={styles.pillLbl}>{lbl}</div>
              <div className={styles.pillVal}>{val}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Stats({ navigate }) {
  const [entries,      setEntries]      = useState([])
  const [avgBySlot,    setAvgBySlot]    = useState({})
  const [slotStats,    setSlotStats]    = useState({})
  const [slotData,     setSlotData]     = useState({})
  const [loading,      setLoading]      = useState(true)
  const [sort,         setSort]         = useState('biggest_win')
  const [typeFilter,   setTypeFilter]   = useState('all')
  const [page,         setPage]         = useState(1)
  const [activePopover, setActivePopover] = useState(null)
  const PER_PAGE = 15

  const load = useCallback(async () => {
    setLoading(true)

    const [{ data }, { data: statsData }, { data: slotsData }] = await Promise.all([
      supabaseDash
        .from('bonus_entries')
        .select('id, slot_id, bet, payment, is_super, hunt_id, tournament_id, paid_at, created_at, game_type, slot:slots(id, name, image_url, rtp, max_win, volatility, provider), bonus_hunts(id, date)')
        .eq('opened', true)
        .not('payment', 'is', null)
        .gt('payment', 0),
      supabaseDash.from('slot_stats').select('slot_id, best_payment, avg_payment, total_bonus_opened'),
      supabaseDash.from('slots').select('id, name, image_url, rtp, max_win, volatility, provider'),
    ])

    const rows = (data || []).filter(e => parseBet(e.bet) > 0)

    const sums = {}, counts = {}
    rows.forEach(e => {
      const id = e.slot_id || e.slot?.id
      if (!id) return
      const m = parseBet(e.payment) / parseBet(e.bet)
      sums[id]   = (sums[id]   || 0) + m
      counts[id] = (counts[id] || 0) + 1
    })
    const avgs = {}
    Object.keys(sums).forEach(id => { avgs[id] = sums[id] / counts[id] })

    const statsMap = {}
    ;(statsData || []).forEach(s => { statsMap[s.slot_id] = s })

    const slotsMap = {}
    ;(slotsData || []).forEach(s => { slotsMap[s.id] = s })

    setAvgBySlot(avgs)
    setSlotStats(statsMap)
    setSlotData(slotsMap)
    setEntries(rows)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = entries.filter(e =>
    typeFilter === 'all' || (e.game_type || 'bonus_hunt') === typeFilter
  )

  const sorted = [...filtered].sort((a, b) => {
    const ma = parseBet(a.payment) / parseBet(a.bet)
    const mb = parseBet(b.payment) / parseBet(b.bet)
    switch (sort) {
      case 'biggest_win':   return parseBet(b.payment) - parseBet(a.payment)
      case 'biggest_multi': return mb - ma
      case 'biggest_bet':   return parseBet(b.bet) - parseBet(a.bet)
      case 'newest':        return new Date(b.paid_at || b.bonus_hunts?.date || 0) - new Date(a.paid_at || a.bonus_hunts?.date || 0)
      default:              return 0
    }
  })

  const totalPages   = Math.ceil(sorted.length / PER_PAGE)
  const pageEntries  = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const globalOffset = (page - 1) * PER_PAGE

  const handleSort = v => { setSort(v);       setPage(1) }
  const handleType = v => { setTypeFilter(v); setPage(1) }

  const getPagesToShow = () => {
    const delta = 4
    const start = Math.max(1, page - delta)
    const end   = Math.min(totalPages, page + delta)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <h1 className={styles.title}>
          <i className="bx bx-bar-chart-alt-2" style={{color: 'var(--blue)'}} />
          Global Stats
        </h1>
        <p className={styles.sub}>The latest casino stats for this year.</p>
      </div>

      <div className={styles.filters}>
        <select className={styles.select} value={typeFilter} onChange={e => handleType(e.target.value)}>
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className={styles.select} value={sort} onChange={e => handleSort(e.target.value)}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /> Loading...</div>
        ) : sorted.length === 0 ? (
          <div className={styles.empty}>No entries found.</div>
        ) : (
          <>
            <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thRank}>#</th>
                  <th className={styles.thSlot}>Slot</th>
                  <th>Bet</th>
                  <th>Multiplier</th>
                  <th>Average</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th className={styles.thWin}>Win</th>
                </tr>
              </thead>
              <tbody>
                {pageEntries.map((e, i) => {
                  const rank    = globalOffset + i + 1
                  const multi   = parseBet(e.payment) / parseBet(e.bet)
                  const slotId  = e.slot_id || e.slot?.id
                  const avg     = avgBySlot[slotId] || 0
                  const date    = e.paid_at || e.bonus_hunts?.date
                  const type    = e.game_type || 'bonus_hunt'
                  const popKey  = `${e.id}-${slotId}`
                  const isOpen  = activePopover?.key === popKey

                  const rankClass = rank === 1 ? styles.rank1Row
                                  : rank === 2 ? styles.rank2Row
                                  : rank === 3 ? styles.rank3Row : ''

                  return (
                    <tr key={e.id || i} className={`${styles.row} ${rankClass}`}>

                      {/* Rank */}
                      <td className={styles.tdRank}>
                        <span className={rank <= 3 ? styles.rankTop : styles.rankNum}>{rank}</span>
                      </td>

                      {/* Slot */}
                      <td className={styles.tdSlot}>
                        <div className={styles.slotCellWrap}>
                          <div className={styles.slotCell}>
                            <div className={styles.slotImgWrap}>
                              {e.slot?.image_url 
                                ? <img src={e.slot.image_url} alt={e.slot.name} className={styles.slotImg} onError={ev => { ev.target.style.opacity = '.2' }} />
                                : <div className={styles.slotImgFallback}><i className="bx bx-image" /></div>
                              }
                            </div>
                            <div className={styles.slotNameWrap}>
                              <button
                                className={styles.slotNameBtn}
                                onClick={ev => setActivePopover(isOpen ? null : { key: popKey, anchor: ev.currentTarget })}
                              >
                                <SlideText text={e.slot?.name || '—'} />
                              </button>
                              {e.is_super && <span className={styles.superTag}>SUPER</span>}
                            </div>
                          </div>
                          {isOpen && (
                            <SlotPopover
                              slot={slotData[slotId] || e.slot}
                              slotStats={slotStats[slotId]}
                              avgMulti={avg}
                              anchor={activePopover.anchor}
                              onNavigate={() => { navigate('/slots', { state: { slotId } }); setActivePopover(null) }}
                              onClose={() => setActivePopover(null)}
                            />
                          )}
                        </div>
                      </td>

                      {/* Bet */}
                      <td className={styles.tdBet}>{fmt(parseBet(e.bet))} €</td>

                      {/* Multiplier */}
                      <td className={styles.tdMulti}>{fmtX(multi)}</td>

                      {/* Average */}
                      <td className={styles.tdAvg}>{fmtX(avg)}</td>

                      {/* Date */}
                      <td className={styles.tdDate}>{fmtDate(e.paid_at || e.bonus_hunts?.date || e.created_at)}</td>

                      {/* Type */}
                      <td>
                        {type === 'bonus_hunt' && e.hunt_id ? (
                          <button className={styles.huntLink} onClick={() => navigate('/bonus-hunts', { state: { huntId: e.hunt_id } })}>
                            BONUS HUNT #{e.hunt_id}
                          </button>
                        ) : type === 'tournament' && e.tournament_id ? (
                          <button className={styles.huntLink} onClick={() => navigate('/torneios', { state: { tournamentId: e.tournament_id } })}>
                            TOURNAMENT #{e.tournament_id}
                          </button>
                        ) : (
                          <span className={`${styles.typeTag} ${styles['type_' + type]}`}>
                            {TYPE_LABELS[type] || type}
                          </span>
                        )}
                      </td>

                      {/* Win */}
                      <td className={styles.tdWin}>{fmt(parseBet(e.payment))} €</td>
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
                {getPagesToShow().map(p => (
                  <button key={p} className={`${styles.pgBtn} ${page === p ? styles.pgActive : ''}`}
                    onClick={() => setPage(p)}>{p}</button>
                ))}
                <button className={styles.pgBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                  <i className="bx bx-chevron-right" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}