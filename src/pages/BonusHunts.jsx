import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabaseDash } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import styles from './BonusHunts.module.css'

function parseBet(val) { return parseFloat(val) || 0 }
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const GRID_PAGE = 12

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const CalendarIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const StatusIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const StarIcon      = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
const MoneyIcon     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const ListIcon      = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const TotalPayIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const BreakevenIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 12h18M3 6l9 6-9 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const AvgIcon       = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 12h18M8 7l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const ProfitIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 20V4M5 13l7-7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const BackIcon      = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const ChevLeft      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const ChevRight     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtX(x) {
  if (!x || x <= 0) return '—'
  const n = Math.round(x)
  if (n >= 1000) return 'X' + n.toLocaleString('en-GB')
  return 'X' + n
}
function fmtCompact(n) {
  const v = parseFloat(n) || 0
  if (!v) return '—'
  if (v >= 10000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K€'
  if (v % 1 === 0) return v + '€'
  return v.toFixed(2).replace('.', ',') + '€'
}

// ── Slot Popover ───────────────────────────────────────────────────────────────
function SlotPopover({ slot, slotStats, avgMulti, onClose, onNavigate, anchor }) {
  const ref     = useRef(null)
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
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 1 1-6.219-8.56" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
      lbl: 'RTP', val: slot?.rtp ? slot.rtp + '%' : '—'
    },
    {
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M3 18l9-14 9 14H3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
      lbl: 'Volatility', val: slot?.volatility || '—'
    },
    {
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
      lbl: 'Avg. multi', val: fmtX(avgMulti)
    },
    {
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
      lbl: 'Max win', val: slot?.max_win ? 'X' + slot.max_win : '—'
    },
    {
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8"/></svg>,
      lbl: 'Total opened', val: stats.total_bonus_opened ? String(stats.total_bonus_opened) : '—'
    },
    {
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
      lbl: 'Best win', val: stats.best_payment ? fmtCompact(stats.best_payment) : '—'
    },
  ]

  return (
    <div
      className={styles.popover}
      ref={ref}
      style={{ position: 'fixed', top: pos.top, left: pos.left }}
    >
      <div className={styles.popoverHead}>
        <div className={styles.popoverImgWrap}>
          <img src={slot?.image_url || ''} alt={slot?.name} className={styles.popoverImg}
            onError={ev => { ev.target.style.opacity = '.2' }} />
        </div>
        <div className={styles.popoverInfo}>
          <div className={styles.popoverProvider}>{slot?.provider || '—'}</div>
          <div className={styles.popoverName}>{slot?.name || '—'}</div>
        </div>
        {onNavigate && (
          <button className={styles.popoverNavBtn} onClick={onNavigate} title="Ver slot">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M7 17L17 7M17 7H7M17 7v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
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

// ── Hunt Card ──────────────────────────────────────────────────────────────────
function HuntCard({ hunt, entries, onClick }) {
  const opened   = entries.filter(e => e.opened && e.payment != null && parseBet(e.bet) > 0)
  const totalPay = opened.reduce((a, e) => a + parseBet(e.payment), 0)
  const balStart = parseBet(hunt.balance_start)
  const balEnd   = parseBet(hunt.balance_end)
  const profit   = balEnd > 0 ? balEnd + totalPay - balStart : totalPay - balStart
  const avg      = opened.length > 0
    ? opened.reduce((a, e) => a + parseBet(e.payment) / parseBet(e.bet), 0) / opened.length : 0
  const withMulti = opened.map(e => ({ ...e, multi: parseBet(e.payment) / parseBet(e.bet) }))
  const best      = [...withMulti].sort((a, b) => b.multi - a.multi)[0] || null
  const profitStr = (profit >= 0 ? '+' : '−') + '€' + Math.abs(profit).toFixed(2)
  const totalBonus  = entries.length
  const totalSupers = entries.filter(e => e.is_super).length

  const STATS = [
    { lbl: 'Start',     val: balStart > 0 ? '€' + balStart.toLocaleString('en-GB', {minimumFractionDigits:2,maximumFractionDigits:2}) : '—' },
    { lbl: 'Bonuses',   val: totalBonus > 0 ? String(totalBonus) : '—' },
    { lbl: 'Supers',    val: totalSupers > 0 ? String(totalSupers) : '0', color: totalSupers > 0 ? '#fbbf24' : undefined },
    { lbl: 'Total Pay', val: totalPay > 0 ? '€' + totalPay.toFixed(2) : '—' },
    { lbl: 'Avg Multi', val: avg > 0 ? avg.toFixed(2) + 'x' : '—' },
    { lbl: 'Profit',    val: opened.length > 0 ? profitStr : '—', color: opened.length > 0 ? (profit >= 0 ? '#21d16e' : '#f04f4f') : undefined },
  ]

  return (
    <div className={`${styles.huntCard} ${hunt.active ? styles.huntCardActive : ''}`} onClick={onClick}>
      <div className={styles.cardHead}>
        <div className={styles.cardId}>BONUS HUNT #{hunt.id}</div>
        <div className={styles.cardHeadRight}>
          {hunt.active && <span className={styles.activePill}><span className={styles.activeDot}/>ATIVO</span>}
          <span className={styles.cardDate}>{fmtDate(hunt.date)}</span>
        </div>
      </div>

      <div className={styles.cardStats}>
        {STATS.map(({ lbl, val, color }) => (
          <div key={lbl} className={styles.csStat}>
            <div className={styles.csLbl}>{lbl}</div>
            <div className={styles.csVal} style={color ? { color } : {}}>{val}</div>
          </div>
        ))}
      </div>

      {best ? (
        <div className={styles.cardBest}>
          <span className={styles.bestStar}>★</span>
          <span className={styles.bestName}>{best.slot?.name || '—'}</span>
          <span className={styles.bestMulti}>{best.multi.toFixed(2)}x</span>
        </div>
      ) : (
        <div className={styles.cardBestEmpty}>No open bonuses</div>
      )}
    </div>
  )
}

// ── Hunt Detail ────────────────────────────────────────────────────────────────
function HuntDetail({ hunt, hunts, onNavigate, onBack, navigate }) {
  const [entries,       setEntries]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [page,          setPage]          = useState(1)
  const [slotStats,     setSlotStats]     = useState({})
  const [avgBySlot,     setAvgBySlot]     = useState({})
  const [activePopover, setActivePopover] = useState(null)
  const PER_PAGE = 10

  const currentIdx = hunts.findIndex(h => h.id === hunt.id)
  const prevHunt   = currentIdx < hunts.length - 1 ? hunts[currentIdx + 1] : null
  const nextHunt   = currentIdx > 0 ? hunts[currentIdx - 1] : null

  useEffect(() => {
    setLoading(true)
    setPage(1)
    setActivePopover(null)
    supabaseDash
      .from('bonus_entries').select('*, slot:slots(*)')
      .eq('hunt_id', hunt.id).order('created_at', { ascending: true })
      .then(({ data }) => {
        const rows = data || []
        setEntries(rows)
        setLoading(false)

        // Buscar slot_stats e calcular avgBySlot para esta hunt
        const slotIds = [...new Set(rows.map(e => e.slot_id).filter(Boolean))]
        if (!slotIds.length) return

        Promise.all([
          supabaseDash.from('slot_stats').select('slot_id, best_payment, avg_payment, total_bonus_opened').in('slot_id', slotIds),
          supabaseDash.from('bonus_entries')
            .select('slot_id, bet, payment')
            .in('slot_id', slotIds)
            .eq('opened', true)
            .not('payment', 'is', null)
        ]).then(([{ data: statsData }, { data: allEntries }]) => {
          const statsMap = {}
          ;(statsData || []).forEach(s => { statsMap[s.slot_id] = s })
          setSlotStats(statsMap)

          const sums = {}, counts = {}
          ;(allEntries || []).forEach(e => {
            const bet = parseFloat(e.bet) || 0
            if (!e.slot_id || bet <= 0) return
            const m = (parseFloat(e.payment) || 0) / bet
            sums[e.slot_id]   = (sums[e.slot_id]   || 0) + m
            counts[e.slot_id] = (counts[e.slot_id] || 0) + 1
          })
          const avgs = {}
          Object.keys(sums).forEach(id => { avgs[id] = sums[id] / counts[id] })
          setAvgBySlot(avgs)
        })
      })

    const ch = supabaseDash.channel(`hunt-detail-${hunt.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_entries', filter: `hunt_id=eq.${hunt.id}` },
        async () => {
          const { data } = await supabaseDash.from('bonus_entries').select('*, slot:slots(*)')
            .eq('hunt_id', hunt.id).order('created_at', { ascending: true })
          if (data) setEntries(data)
        })
      .subscribe()
    return () => ch.unsubscribe()
  }, [hunt.id])

  const opened    = entries.filter(e => e.opened && e.payment != null && parseBet(e.bet) > 0)
  const balStart  = parseBet(hunt.balance_start)
  const balEnd    = parseBet(hunt.balance_end)
  const totalPay  = opened.reduce((a, e) => a + parseBet(e.payment), 0)
  const totalBet  = entries.reduce((a, e) => a + parseBet(e.bet), 0)
  const profit    = balEnd > 0 ? balEnd + totalPay - balStart : totalPay - balStart
  const beInit    = totalBet > 0 ? balStart / totalBet : 0
  const unopened  = entries.filter(e => !e.opened && parseBet(e.bet) > 0)
  const sumUnop   = unopened.reduce((a, e) => a + parseBet(e.bet), 0)
  const beCurr    = sumUnop > 0 ? (balStart - totalPay) / sumUnop : 0
  const avg       = opened.length > 0
    ? opened.reduce((a, e) => a + parseBet(e.payment) / parseBet(e.bet), 0) / opened.length : 0
  const withMulti = opened.map(e => ({ ...e, multi: parseBet(e.payment) / parseBet(e.bet) }))
  const best      = [...withMulti].sort((a, b) => b.multi - a.multi)[0] || null
  const isFinished = opened.length === entries.length && entries.length > 0

  const totalPages  = Math.ceil(entries.length / PER_PAGE)
  const pageEntries = entries.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const INFO_ROWS = [
    { icon: <CalendarIcon />,  bg: 'rgba(100,100,255,.15)', color: '#8080ff',  lbl: 'Data',      val: fmtDate(hunt.date) },
    { icon: <StatusIcon />,    bg: isFinished ? 'rgba(33,209,110,.15)' : 'rgba(245,166,35,.15)', color: isFinished ? '#21d16e' : '#f5a623', lbl: 'Status', val: isFinished ? 'Finished' : hunt.mode === 'opening' ? 'Opening' : 'Collecting', valColor: isFinished ? '#21d16e' : '#f5a623' },
    ...(best ? [{ icon: <StarIcon />, bg: 'rgba(245,166,35,.15)', color: '#f5a623', lbl: 'Best slot', val: best.slot?.name || '—', sub: '€' + parseBet(best.payment).toFixed(2) }] : []),
    { icon: <MoneyIcon />,     bg: 'rgba(59,130,246,.15)', color: '#3b82f6', lbl: 'Start',     val: balStart > 0 ? '€' + balStart.toFixed(2) : '—' },
    { icon: <ListIcon />,      bg: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.45)', lbl: 'Bonuses', val: String(entries.length) },
    { icon: <TotalPayIcon />,  bg: 'rgba(33,209,110,.15)', color: '#21d16e', lbl: 'Total Pay', val: totalPay > 0 ? '€' + totalPay.toFixed(2) : '—' },
    { icon: <BreakevenIcon />, bg: 'rgba(255,140,0,.15)',  color: '#ff8c00', lbl: 'Initial BE', val: beInit > 0 ? beInit.toFixed(2) + 'x' : '—' },
    { icon: <BreakevenIcon />, bg: 'rgba(255,80,80,.15)',  color: '#ff5050', lbl: 'BE Atual',   val: beCurr > 0 ? beCurr.toFixed(2) + 'x' : '0x' },
    { icon: <AvgIcon />,       bg: 'rgba(59,130,246,.15)', color: '#3b82f6', lbl: 'Avg Multi', val: avg > 0 ? avg.toFixed(2) + 'x' : '—' },
    { icon: <ProfitIcon />,    bg: profit >= 0 ? 'rgba(33,209,110,.15)' : 'rgba(240,79,79,.15)', color: profit >= 0 ? '#21d16e' : '#f04f4f', lbl: 'Profit', val: (profit >= 0 ? '+' : '') + '€' + profit.toFixed(2), valColor: profit >= 0 ? '#21d16e' : '#f04f4f' },
  ]

  const renderPagination = (total, cur, set) => {
    if (total <= 1) return null
    const pages = []
    const delta = 2
    const left  = Math.max(2, cur - delta)
    const right = Math.min(total - 1, cur + delta)
    pages.push(1)
    if (left > 2) pages.push('...')
    for (let i = left; i <= right; i++) pages.push(i)
    if (right < total - 1) pages.push('...')
    if (total > 1) pages.push(total)
    return (
      <div className={styles.pagination}>
        <button className={styles.pgBtn} disabled={cur === 1} onClick={() => set(p => p - 1)}><ChevLeft /></button>
        {pages.map((n, i) => n === '...'
          ? <span key={`e${i}`} className={styles.pgEllipsis}>…</span>
          : <button key={n} className={`${styles.pgBtn} ${n === cur ? styles.pgActive : ''}`} onClick={() => set(n)}>{n}</button>
        )}
        <button className={styles.pgBtn} disabled={cur === total} onClick={() => set(p => p + 1)}><ChevRight /></button>
      </div>
    )
  }

  return (
    <div className={styles.detail}>
      <div className={styles.detailLayout}>
        <aside className={styles.sidebar}>
          <button className={styles.backBtn} onClick={onBack}><BackIcon /> Back to history</button>
          <div className={styles.huntNav}>
            <button className={styles.huntNavBtn} onClick={() => prevHunt && onNavigate(prevHunt)} disabled={!prevHunt} title={prevHunt ? `Hunt #${prevHunt.id}` : ''}><ChevLeft /></button>
            <span className={styles.huntNavTitle}>BONUS HUNT #{hunt.id}</span>
            <button className={styles.huntNavBtn} onClick={() => nextHunt && onNavigate(nextHunt)} disabled={!nextHunt} title={nextHunt ? `Hunt #${nextHunt.id}` : ''}><ChevRight /></button>
          </div>
          {INFO_ROWS.map(({ icon, bg, color, lbl, val, valColor, sub }) => (
            <div key={lbl} className={styles.infoItem}>
              <div className={styles.infoIcon} style={{ background: bg, color }}>{icon}</div>
              <div className={styles.infoText}>
                <div className={styles.infoLbl}>{lbl}</div>
                <div className={styles.infoVal} style={valColor ? { color: valColor } : {}}>{val}</div>
                {sub && <div className={styles.infoSub}>{sub}</div>}
              </div>
            </div>
          ))}
        </aside>

        <div className={styles.tablePanel}>
          {loading ? (
            <div className={styles.loading}><div className={styles.spinner} /> Loading...</div>
          ) : (
            <>
              <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th><th>SLOT</th><th>PROVIDER</th>
                    <th>BET</th><th>MULTI</th><th>WIN</th>
                  </tr>
                </thead>
                <tbody>
                  {pageEntries.map((e, i) => {
                    const idx   = (page - 1) * PER_PAGE + i + 1
                    const multi = parseBet(e.bet) > 0 && e.payment != null
                      ? parseBet(e.payment) / parseBet(e.bet) : null
                    const mc = multi === null ? '' : multi >= 100 ? styles.good : multi >= 40 ? styles.mid : styles.bad
                    const isOpen = activePopover?.id === e.id
                    return (
                      <tr key={e.id} className={e.opened ? '' : styles.unopened}>
                        <td className={styles.numCell}>{idx}</td>
                        <td>
                          <div className={styles.slotCellWrap}>
                            <div className={styles.slotCell}>
                              <img src={e.slot?.image_url || ''} alt="" className={styles.slotImg}
                                onError={ev => { ev.target.style.opacity = '.1' }} />
                              <div className={styles.slotNameWrap}>
                                <button
                                  className={`${styles.slotNameBtn} ${(!e.opened || e.payment == null) ? styles.slotNameBtnDisabled : ''}`}
                                  onClick={ev => {
                                    if (!e.opened || e.payment == null) return
                                    if (isOpen) { setActivePopover(null); return }
                                    setActivePopover({ id: e.id, anchor: ev.currentTarget })
                                  }}
                                >
                                  {e.slot?.name || '—'}
                                </button>
                                {e.is_super && <span className={styles.superTag}>SUPER</span>}
                              </div>
                            </div>
                            {isOpen && (
                              <SlotPopover
                                slot={e.slot}
                                slotStats={slotStats[e.slot_id]}
                                avgMulti={avgBySlot[e.slot_id] || 0}
                                anchor={activePopover.anchor}
                                onNavigate={navigate ? () => { navigate('/slots', { state: { slotId: e.slot_id } }); setActivePopover(null) } : undefined}
                                onClose={() => setActivePopover(null)}
                              />
                            )}
                          </div>
                        </td>
                        <td className={styles.provCell}>{e.slot?.provider || '—'}</td>
                        <td className={styles.tdBet}>{e.bet ? parseBet(e.bet).toFixed(2) + ' €' : '—'}</td>
                        <td className={`${styles.tdMulti} ${mc}`}>{multi !== null ? '×' + multi.toFixed(2) : '—'}</td>
                        <td className={styles.tdWin}>{e.payment != null ? <strong>€{parseBet(e.payment).toFixed(2)}</strong> : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
              {renderPagination(totalPages, page, setPage)}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function BonusHunts({ navigate }) {
  const location = useLocation()
  const [hunts, setHunts]               = useState([])
  const [byHunt, setByHunt]             = useState({})
  const [loading, setLoading]           = useState(true)
  const [selectedHunt, setSelectedHunt] = useState(null)
  const [tab, setTab]                   = useState('all')
  const [gridPage, setGridPage]         = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: huntsData } = await supabaseDash
      .from('bonus_hunts').select('*').order('id', { ascending: false })
    if (!huntsData?.length) { setLoading(false); return }
    const ids = huntsData.map(h => h.id)
    const { data: allEntries } = await supabaseDash
      .from('bonus_entries')
      .select('hunt_id, bet, payment, opened, is_super, slot:slots(name)')
      .in('hunt_id', ids)
    const map = {}
    ;(allEntries || []).forEach(e => {
      if (!map[e.hunt_id]) map[e.hunt_id] = []
      map[e.hunt_id].push(e)
    })
    setHunts(huntsData); setByHunt(map); setLoading(false)
  }, [])

  // Auto-open hunt se vier do Stats
  useEffect(() => {
    const huntId = location.state?.huntId
    if (huntId && hunts.length > 0 && !selectedHunt) {
      const found = hunts.find(h => h.id === huntId)
      if (found) setSelectedHunt(found)
    }
  }, [hunts, location.state])

  useEffect(() => {
    load()
    const ch = supabaseDash.channel('hunts-public-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_hunts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_entries' }, () => { if (!selectedHunt) load() })
      .subscribe()
    return () => ch.unsubscribe()
  }, [load, selectedHunt])

  if (selectedHunt) return (
    <HuntDetail
      hunt={selectedHunt}
      hunts={hunts}
      onNavigate={setSelectedHunt}
      onBack={() => setSelectedHunt(null)}
      navigate={navigate}
    />
  )

  const visibleHunts = tab === 'active' ? hunts.filter(h => h.active) : hunts
  const totalGridPages = Math.ceil(visibleHunts.length / GRID_PAGE)
  const pageHunts = visibleHunts.slice((gridPage - 1) * GRID_PAGE, gridPage * GRID_PAGE)

  const renderGridPagination = () => {
    if (totalGridPages <= 1) return null
    const pages = []
    const delta = 2
    const left  = Math.max(2, gridPage - delta)
    const right = Math.min(totalGridPages - 1, gridPage + delta)
    pages.push(1)
    if (left > 2) pages.push('...')
    for (let i = left; i <= right; i++) pages.push(i)
    if (right < totalGridPages - 1) pages.push('...')
    if (totalGridPages > 1) pages.push(totalGridPages)
    return (
      <div className={styles.gridPagination}>
        <button className={styles.pgBtn} disabled={gridPage === 1} onClick={() => setGridPage(p => p - 1)}><ChevLeft /></button>
        {pages.map((n, i) => n === '...'
          ? <span key={`e${i}`} className={styles.pgEllipsis}>…</span>
          : <button key={n} className={`${styles.pgBtn} ${n === gridPage ? styles.pgActive : ''}`} onClick={() => setGridPage(n)}>{n}</button>
        )}
        <button className={styles.pgBtn} disabled={gridPage === totalGridPages} onClick={() => setGridPage(p => p + 1)}><ChevRight /></button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>BONUS HUNTS</h1>
          <p className={styles.sub}>Full history of all bonus hunts</p>
        </div>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'all' ? styles.tabActive : ''}`} onClick={() => { setTab('all'); setGridPage(1) }}>History</button>
          <button className={`${styles.tab} ${tab === 'active' ? styles.tabActive : ''}`} onClick={() => { setTab('active'); setGridPage(1) }}>
            Ativos
            {hunts.filter(h => h.active).length > 0 && <span className={styles.tabBadge}>{hunts.filter(h => h.active).length}</span>}
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /> Loading...</div>
      ) : !visibleHunts.length ? (
        <div className={styles.empty}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,.2)" strokeWidth="1.8"/><path d="M12 8v4M12 16h.01" stroke="rgba(255,255,255,.2)" strokeWidth="1.8" strokeLinecap="round"/></svg>
          <p>No bonus hunts found.</p>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {pageHunts.map(hunt => (
              <HuntCard key={hunt.id} hunt={hunt} entries={byHunt[hunt.id] || []} onClick={() => setSelectedHunt(hunt)} />
            ))}
          </div>
          {renderGridPagination()}
        </>
      )}
    </div>
  )
}