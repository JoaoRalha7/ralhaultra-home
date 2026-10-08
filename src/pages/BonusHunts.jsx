import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import MiniGame from './MiniGame'
import MiniGameGtb from './MiniGameGtb'
import MiniGameAvgMulti from './MiniGameAvgMulti'
import { supabaseDash } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import styles from './BonusHunts.module.css'
import x from './BonusHuntsX.module.css'

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
function huntStats(hunt, entries) {
  const opened   = entries.filter(e => e.opened && e.payment != null && parseBet(e.bet) > 0)
  const totalPay = opened.reduce((a, e) => a + parseBet(e.payment), 0)
  const balStart = parseBet(hunt.balance_start)
  const balEnd   = parseBet(hunt.balance_end)
  const profit   = balEnd > 0 ? balEnd + totalPay - balStart : totalPay - balStart
  const avg      = opened.length > 0
    ? opened.reduce((a, e) => a + parseBet(e.payment) / parseBet(e.bet), 0) / opened.length : 0
  const ranked   = [...opened].map(e => ({ ...e, multi: parseBet(e.payment) / parseBet(e.bet) }))
    .sort((a, b) => b.multi - a.multi)
  const best     = ranked[0] || null
  const worst    = ranked.length > 1 ? ranked[ranked.length - 1] : null
  const totalBet = entries.reduce((a, e) => a + parseBet(e.bet), 0)
  const be       = totalBet > 0 ? balStart / totalBet : 0
  const finished = entries.length > 0 && entries.every(e => e.opened)
  return {
    opened, totalPay, balStart, profit, avg, best, worst, be, finished, live: !!hunt.active && !finished,
    total: entries.length,
    supers: entries.filter(e => e.is_super).length,
    hasResult: opened.length > 0,
  }
}
const money = (n) => (n >= 0 ? '+' : '−') + '€' + Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function SlotThumb({ slot, size = 40 }) {
  return <img className={x.thumb} style={{ width: size, height: size }} src={slot?.image_url || ''} alt="" onError={ev => { ev.target.style.opacity = '.1' }} />
}


function BestWorst({ best, worst, compact }) {
  if (!best) return null
  const row = (e, bad) => (
    <div className={`${x.fBest} ${bad ? x.fWorst : ''} ${compact ? x.fCompact : ''}`}>
      {bad
        ? <svg className={x.fSkull} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 7 6-7" /></svg>
        : <svg className={x.fCrown} width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" /></svg>}
      <SlotThumb slot={e.slot} size={compact ? 44 : 52} />
      <b>{e.slot?.name || '—'}</b>
      <strong>{e.multi.toFixed(bad ? 1 : 0)}x</strong>
      <span className={bad ? x.fWorstWin : x.fBestWin}>{bad ? '' : '+'}€{parseBet(e.payment).toFixed(0)}</span>
    </div>
  )
  return (
    <div className={x.fBW}>
      {row(best, false)}
      {worst && worst.id !== best.id
        ? row(worst, true)
        : <div className={`${x.fBest} ${x.fWorst} ${x.fEmpty} ${compact ? x.fCompact : ''}`}><b>Worst bonus</b><span>waiting for more bonuses</span></div>}
    </div>
  )
}

function FeaturedHunt({ hunt, entries, onClick }) {
  const st = huntStats(hunt, entries)
  return (
    <button type="button" className={x.featured} onClick={onClick}>
      <div className={x.fMain}>
        <div className={x.fTop}>
          {st.live
            ? <span className={x.pillLive}><span className={x.liveDot} />LIVE</span>
            : <span className={x.pillOff}>{st.finished ? 'FINISHED' : 'Latest hunt'}</span>}
          <span className={x.fDate}>{fmtDate(hunt.date)}</span>
        </div>
        <h2 className={x.fTitle}>Bonus Hunt #{hunt.id}</h2>
        <div className={x.fSeg} aria-hidden="true">
          {Array.from({ length: Math.min(st.total, 24) }, (_, i) => <i key={i} className={i < Math.round((st.opened.length / Math.max(st.total, 1)) * Math.min(st.total, 24)) ? x.segOn : ''} />)}
        </div>
        <div className={x.fCount}><b>{st.opened.length} / {st.total}</b> opened</div>
      </div>
      <div className={x.fStats}>
        <div className={x.fProfit}>
          <span className={x.lbl}>Profit</span>
          <b className={st.hasResult ? (st.profit >= 0 ? x.pos : x.neg) : ''}>{st.hasResult ? money(st.profit) : '—'}</b>
        </div>
      </div>
      <div className={x.fChipsCell}><FeaturedGameChips huntId={hunt.id} /></div>
      <div className={x.fTiles}>
        <div className={x.fTile}><span>Start</span><b>{st.balStart > 0 ? '€' + st.balStart.toFixed(0) : '—'}</b></div>
        <div className={x.fTile}><span>Pay</span><b>{st.totalPay > 0 ? '€' + st.totalPay.toFixed(0) : '—'}</b></div>
        <div className={x.fTile}><span>Avg</span><b>{st.avg > 0 ? st.avg.toFixed(2) + 'x' : '—'}</b></div>
        <div className={x.fTile}><span>BE</span><b>{st.be > 0 ? st.be.toFixed(1) + 'x' : '—'}</b></div>
      </div>
      <BestWorst best={st.best} worst={st.worst} />
    </button>
  )
}

function HuntCard({ hunt, entries, onClick }) {
  const st = huntStats(hunt, entries)
  return (
    <button type="button" className={`${x.hCard} ${st.live ? x.hCardLive : ''}`} onClick={onClick}>
      <div className={x.hcTop}>
        <span className={x.hcId}>#{hunt.id}{st.live && <span className={x.liveDot} />}</span>
        <span className={x.hcDate}>{fmtDate(hunt.date)}</span>
      </div>
      <b className={`${x.hcProfit} ${st.hasResult ? (st.profit >= 0 ? x.pos : x.neg) : ''}`}>{st.hasResult ? money(st.profit) : '—'}</b>
      <div className={x.hcPair}>
        {[['Best', st.best, x.hcGood], ['Worst', st.worst, x.hcBad]].map(([lbl, e, cls]) => (
          <div key={lbl} className={x.hcBw}>
            {e
              ? <><SlotThumb slot={e.slot} size={34} /><span><small>{lbl}</small><b>{e.slot?.name || '—'}</b></span><strong className={cls}>{e.multi >= 10 ? e.multi.toFixed(0) : e.multi.toFixed(2)}x</strong></>
              : <><span className={x.hcBwEmpty}><small>{lbl}</small><b>—</b></span></>}
          </div>
        ))}
      </div>
      <div className={x.hcFoot}>
        <span><small>Bonuses</small>{st.total || '—'}</span>
        <span><small>Super</small><i className={st.supers > 0 ? x.hcSuper : ''}>{st.supers || '—'}</i></span>
        <span><small>Avg multi</small>{st.avg > 0 ? st.avg.toFixed(1) + 'x' : '—'}</span>
        <span><small>Total pay</small>{st.totalPay > 0 ? '€' + st.totalPay.toFixed(0) : '—'}</span>
      </div>
    </button>
  )
}

// ── Mini-games tied to a hunt ──────────────────────────────────────────────────
const GAME_DEFS = [
  { key: 'pick', label: 'Pick & Win',        route: '/mini-games/pick-win',  games: 'pick_games',      entries: 'picks',             blurb: 'Pick a slot from the hunt' },
  { key: 'gtb',  label: 'Guess the Balance', route: '/mini-games/gtb',       games: 'gtb_games',       entries: 'gtb_entries',       blurb: 'Guess the final balance' },
  { key: 'avg',  label: 'Avg Multi',         route: '/mini-games/avg-multi', games: 'avg_multi_games', entries: 'avg_multi_entries', blurb: 'Guess the average multiplier' },
]
const GAME_STATUS = {
  open:     { label: 'Live',     cls: 'gLive' },
  closed:   { label: 'Closed',   cls: 'gClosed' },
  finished: { label: 'Finished', cls: 'gDone' },
}

function useHuntGames(huntId) {
  const [list, setList] = useState(null)
  useEffect(() => {
    let off = false
    let timer = null
    setList(null)
    const load = async () => {
      const out = await Promise.all(GAME_DEFS.map(async (d) => {
        const { data: gs, error } = await supabaseDash.from(d.games).select('*')
          .eq('hunt_id', huntId).in('status', ['open', 'closed', 'finished'])
          .order('created_at', { ascending: false }).limit(1)
        const game = !error && gs?.[0] ? gs[0] : null
        if (!game) return { ...d, game: null, count: 0, winner: null }
        const { data: ents } = await supabaseDash.from(d.entries)
          .select('twitch_username, rank, points_awarded').eq('game_id', game.id)
        const rows = ents || []
        const winner = rows.find(e => e.rank === 1) || null
        return { ...d, game, count: rows.length, winner }
      }))
      if (!off) setList(out)
    }
    const soon = () => { clearTimeout(timer); timer = setTimeout(load, 250) }
    load()
    // instant updates when the streamer opens / closes a game or someone enters; light poll as a safety net
    const ch = supabaseDash.channel(`hunt-games-${huntId}-${Math.random().toString(36).slice(2, 7)}`)
    GAME_DEFS.forEach(d => {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: d.games }, soon)
      ch.on('postgres_changes', { event: '*', schema: 'public', table: d.entries }, soon)
    })
    ch.subscribe()
    const iv = setInterval(() => { if (!document.hidden) load() }, 8000)
    return () => { off = true; clearTimeout(timer); clearInterval(iv); supabaseDash.removeChannel(ch) }
  }, [huntId])
  return list
}

const GameIcon = ({ k }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {k === 'pick' && <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>}
    {k === 'gtb'  && <><path d="M17.5 6.5A7 7 0 0 0 7 12a7 7 0 0 0 10.5 5.5M4 10h10M4 14h10"/></>}
    {k === 'avg'  && <><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></>}
  </svg>
)

function FeaturedGameChips({ huntId }) {
  const list = useHuntGames(huntId)
  const active = (list || []).filter(g => g.game && g.game.status !== 'finished')
  if (!active.length) return null
  return (
    <div className={x.fGames}>
      {active.map(g => (
        <span key={g.key} className={`${x.fChip} ${g.game.status === 'open' ? x.fChipLive : ''}`}>
          <span className={x.fChipIco}><GameIcon k={g.key} /></span>
          <span className={x.fChipName}>{{ pick: 'PICK & WIN', gtb: 'GTB', avg: 'AVG' }[g.key] || g.label}</span>
          {g.game.status === 'open' ? <em className={x.fChipLiveTag}><i />Live</em> : <i className={x.fChipOff} title="Closed" />}
        </span>
      ))}
    </div>
  )
}

// ── Hunt Detail ────────────────────────────────────────────────────────────────
function HuntDetail({ hunt, hunts, byHunt, onNavigate, onBack }) {
  const location = useLocation()
  const gameList = useHuntGames(hunt.id)
  const [pickOpen, setPickOpen] = useState(false)
  useEffect(() => {
    if (!pickOpen) return
    const k = (e) => e.key === 'Escape' && setPickOpen(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [pickOpen])
  const wantView = location.state?.huntId === hunt.id ? location.state?.view : null
  useEffect(() => {
    if (!wantView || !gameList) return
    const t = setTimeout(() => document.getElementById('game-' + wantView)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    return () => clearTimeout(t)
  }, [wantView, !!gameList, location.key])
  const [entries,       setEntries]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [page,          setPage]          = useState(1)
  const [slotStats,     setSlotStats]     = useState({})
  const [avgBySlot,     setAvgBySlot]     = useState({})
  const [activePopover, setActivePopover] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'order', dir: 1 })
  const PER_PAGE = 10

  const currentIdx = hunts.findIndex(h => h.id === hunt.id)
  const prevHunt   = currentIdx < hunts.length - 1 ? hunts[currentIdx + 1] : null
  const nextHunt   = currentIdx > 0 ? hunts[currentIdx - 1] : null

  useEffect(() => {
    setLoading(true)
    setPage(1)
    setFilter('all'); setSort({ key: 'order', dir: 1 })
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

  const counts = {
    all: entries.length,
    opened: entries.filter(e => e.opened).length,
    pending: entries.filter(e => !e.opened).length,
    super: entries.filter(e => e.is_super).length,
  }
  const mOf = e => (parseBet(e.bet) > 0 && e.payment != null ? parseBet(e.payment) / parseBet(e.bet) : -1)
  let view = entries.map((e, i) => ({ ...e, _n: i + 1 }))
  if (filter === 'opened')  view = view.filter(e => e.opened)
  if (filter === 'pending') view = view.filter(e => !e.opened)
  if (filter === 'super')   view = view.filter(e => e.is_super)
  if (sort.key === 'multi') view.sort((a, b) => (mOf(a) - mOf(b)) * sort.dir)
  if (sort.key === 'win')   view.sort((a, b) => ((a.payment ?? -1) - (b.payment ?? -1)) * sort.dir)
  if (sort.key === 'bet')   view.sort((a, b) => (parseBet(a.bet) - parseBet(b.bet)) * sort.dir)
  const toggleSort = (key) => { setPage(1); setSort(sv => sv.key === key ? (sv.dir === -1 ? { key, dir: 1 } : { key: 'order', dir: 1 }) : { key, dir: -1 }) }
  const arrow = (key) => sort.key === key ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''
  const totalPages  = Math.ceil(view.length / PER_PAGE)
  const pageEntries = view.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const podium = [...opened].map(e => ({ ...e, multi: parseBet(e.payment) / parseBet(e.bet) }))
    .filter(e => e.multi > 0).sort((a, b) => b.multi - a.multi).slice(0, 3)
  const nextUp = unopened[0] || null
  const hasResult = opened.length > 0
  const bestMulti = best ? best.multi : 0
  const worst = [...withMulti].sort((a, b) => a.multi - b.multi)[0] || null
  const ribRef = useRef(null)
  const stats = [
    { lbl: 'Start', val: balStart > 0 ? '€' + balStart.toFixed(2) : '—' },
    { lbl: 'Pay', val: totalPay > 0 ? '€' + totalPay.toFixed(2) : '—', cls: x.pos },
    { lbl: 'BE start', val: beInit > 0 ? beInit.toFixed(2) + 'x' : '—' },
    { lbl: 'BE now', val: beCurr > 0 ? beCurr.toFixed(2) + 'x' : '0x', cls: x.neg },
    { lbl: 'Avg', val: avg > 0 ? avg.toFixed(2) + 'x' : '—' },
    { lbl: 'Bonuses', val: String(entries.length) },
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

  const gbox = (key, node) => {
    const d = GAME_DEFS.find(q => q.key === key)
    const g = (gameList || []).find(q => q.key === key)
    if (!gameList) return null
    if (!g?.game) return (
      <section id={'game-' + key} className={`${x.gbox} ${x.gboxMini}`} aria-label={d.label}>
        <span className={x.gameIcon}><GameIcon k={key} /></span>
        <b>{d.label}</b>
        <em>No game yet</em>
      </section>
    )
    const st = g.game.status
    const live = st === 'open'
    const unit = key === 'pick' ? (g.count === 1 ? 'pick' : 'picks') : (g.count === 1 ? 'guess' : 'guesses')
    return (
      <section id={'game-' + key} className={`${x.gbox} ${x.gv2} ${live ? x.gboxLive : ''}`} aria-label={d.label}>
        <header className={x.gv2Head}>
          <span className={x.gv2Ico}><GameIcon k={key} /></span>
          <div className={x.gv2Name}><b>{d.label}</b><small>{d.blurb}</small></div>
          <span className={`${x.gv2St} ${live ? x.gv2Live : ''}`}><i />{GAME_STATUS[st].label.toUpperCase()}</span>
        </header>
        <div className={x.gv2Count}><b>{g.count}</b><span>{unit}</span></div>
        {key !== 'pick' && st === 'closed'
          ? <div className={x.gv2Off}>Results coming soon</div>
          : <div className={x.gboxBody}>{node}</div>}
      </section>
    )
  }

  return (
    <div className={`${x.page} ${styles.detail}`}>
      <button className={x.back} onClick={onBack}><BackIcon /> All hunts</button>

      <header className={x.dHero}>
        <div className={x.dHeroMain}>
          <div className={x.dNav}>
            <button className={x.navBtn} onClick={() => prevHunt && onNavigate(prevHunt)} disabled={!prevHunt} aria-label="Previous hunt"><ChevLeft /></button>
            <button className={x.navBtn} onClick={() => nextHunt && onNavigate(nextHunt)} disabled={!nextHunt} aria-label="Next hunt"><ChevRight /></button>
            {isFinished
              ? <span className={x.pillOff}>Finished</span>
              : <span className={x.pillLive}><span className={x.liveDot} />LIVE</span>}
            <span className={x.fDate}>{fmtDate(hunt.date)}</span>
          </div>
          <h1 className={x.dTitle}>Bonus Hunt #{hunt.id}</h1>
          <div className={x.fProgress}>
            <div className={x.strip} aria-hidden="true">
              {entries.map(e => {
                const m = mOf(e)
                const st = !e.opened ? x.sPend : m >= 1 ? x.sWin : x.sLoss
                return <i key={e.id} className={`${st} ${e.is_super ? x.sSuper : ''} ${nextUp && nextUp.id === e.id ? x.sNext : ''}`} title={`${e.slot?.name || '—'}${e.opened && m >= 0 ? ' · ' + m.toFixed(0) + 'x' : ''}`} />
              })}
            </div>
            <div className={x.fCount}><b>{opened.length} / {entries.length}</b> opened</div>
          </div>
        </div>
        <div className={x.dProfit}>
          <span className={x.lbl}>Profit</span>
          <b className={hasResult ? (profit >= 0 ? x.pos : x.neg) : ''}>{hasResult ? money(profit) : '—'}</b>
          <BestWorst best={best} worst={worst} compact />
        </div>
      </header>

      <div className={x.dBoard}>
        {stats.map(t => (
          <div key={t.lbl} className={x.dTile}><span className={x.lbl}>{t.lbl}</span><b className={t.cls || ''}>{t.val}</b></div>
        ))}
      </div>

      <div className={x.split}>
      <div className={x.dBody}>
        <div className={x.chips} role="tablist">
          {[['all', 'All'], ['opened', 'Opened'], ['pending', 'Waiting'], ['super', 'Super']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={`${x.chip} ${filter === k ? x.chipOn : ''}`} onClick={() => { setFilter(k); setPage(1) }}>
              {l}<span>{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className={`${styles.tablePanel} ${x.tbl}`}>
          {loading ? (
            <div className={styles.loading}><div className={styles.spinner} /> Loading...</div>
          ) : (
            <>
              <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th><th>SLOT</th>
                    <th className={x.sortTh} onClick={() => toggleSort('bet')}>BET{arrow('bet')}</th>
                    <th className={x.sortTh} onClick={() => toggleSort('multi')}>MULTI{arrow('multi')}</th>
                    <th className={x.sortTh} onClick={() => toggleSort('win')}>WIN{arrow('win')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageEntries.map((e, i) => {
                    const idx   = e._n
                    const multi = parseBet(e.bet) > 0 && e.payment != null
                      ? parseBet(e.payment) / parseBet(e.bet) : null
                    const mc = multi === null ? '' : multi >= 100 ? styles.good : multi >= 40 ? styles.mid : styles.bad
                    const isOpen = activePopover?.id === e.id
                    return (
                      <tr key={e.id} className={`${e.opened ? '' : styles.unopened} ${podium[0]?.id === e.id ? x.bestRow : ''} ${nextUp && nextUp.id === e.id ? x.nextRow : ''}`}>
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
                                {nextUp && nextUp.id === e.id && <span className={x.nextTag}>NEXT</span>}
                                <small className={x.prov}>{e.slot?.provider || ''}</small>
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
                        <td className={styles.tdBet}>{e.bet ? parseBet(e.bet).toFixed(2) + ' €' : '—'}</td>
                        <td className={`${styles.tdMulti} ${mc}`}>{multi !== null ? <>×{multi.toFixed(2)}<span className={x.mBar}><i style={{ width: Math.min(100, (multi / Math.max(bestMulti, 1)) * 100) + '%' }} /></span></> : '—'}</td>
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
      <div className={x.rail}>
        {gbox('gtb', <MiniGameGtb huntId={hunt.id} compact />)}
        {gbox('avg', <MiniGameAvgMulti huntId={hunt.id} compact />)}
        {gbox('pick', (() => {
          const g = (gameList || []).find(q => q.key === 'pick')
          const st = g?.game?.status
          return (
            <div className={x.pickSum}>
              <div className={x.pickStats}>
                <span><b>{g?.count ?? 0}</b> picks so far</span>
                {st === 'finished' && g?.winner && <span>Winner <b>{g.winner.twitch_username}</b></span>}
              </div>
              <button className={x.pickBtn} onClick={() => setPickOpen(true)}>
                {st === 'open' ? 'Pick your slot' : st === 'closed' ? 'See picks' : 'See results'}
              </button>
            </div>
          )
        })())}
      </div>
      </div>
      {pickOpen && (
        <div className={x.modalBack} onClick={() => setPickOpen(false)} role="dialog" aria-modal="true" aria-label="Pick & Win">
          <div className={x.modal} onClick={e => e.stopPropagation()}>
            <button className={x.modalX} onClick={() => setPickOpen(false)} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <MiniGame huntId={hunt.id} embedded />
          </div>
        </div>
      )}

      <section className={x.ribbon} aria-label="Hunt history">
        <div className={x.ribbonHead}><h2>History</h2><span>Jump to another hunt</span></div>
        <div className={x.ribbonWrap}>
        <button className={x.ribArrow} onClick={() => ribRef.current?.scrollBy({ left: -360, behavior: 'smooth' })} aria-label="Scroll left"><ChevLeft /></button>
        <div className={x.ribbonRow} ref={ribRef}>
          {hunts.slice(0, 24).map(h => {
            const st = huntStats(h, (byHunt && byHunt[h.id]) || [])
            const cur = h.id === hunt.id
            return (
              <button key={h.id} className={`${x.rib} ${cur ? x.ribOn : ''} ${st.hasResult ? (st.profit >= 0 ? x.ribWin : x.ribLoss) : ''}`} onClick={() => !cur && onNavigate(h)} aria-current={cur ? 'true' : undefined}>
                <small>#{h.id}{st.live && <i className={x.liveDot} />}</small>
                <b>{st.hasResult ? money(st.profit) : '—'}</b>
                <em>{st.total} bonuses</em>
              </button>
            )
          })}
        </div>
        <button className={x.ribArrow} onClick={() => ribRef.current?.scrollBy({ left: 360, behavior: 'smooth' })} aria-label="Scroll right"><ChevRight /></button>
        </div>
      </section>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function BonusHunts() {
  const location = useLocation()
  const [hunts, setHunts]               = useState([])
  const [byHunt, setByHunt]             = useState({})
  const [loading, setLoading]           = useState(true)
  const [selectedHunt, setSelectedHunt] = useState(null)
  const [tab, setTab]                   = useState('all')
  const [gridPage, setGridPage]         = useState(1)
  const [sort, setSort]               = useState('new')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: huntsData } = await supabaseDash
      .from('bonus_hunts').select('*').order('id', { ascending: false })
    if (!huntsData?.length) { setLoading(false); return }
    const ids = huntsData.map(h => h.id)
    const { data: allEntries } = await supabaseDash
      .from('bonus_entries')
      .select('id, hunt_id, bet, payment, opened, is_super, slot:slots(name, image_url)')
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
    if (huntId && hunts.length > 0 && selectedHunt?.id !== huntId) {
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
      key={selectedHunt.id}
      hunt={selectedHunt}
      hunts={hunts}
      byHunt={byHunt}
      onNavigate={setSelectedHunt}
      onBack={() => setSelectedHunt(null)}
    />
  )

  const liveNow = (h) => huntStats(h, byHunt[h.id] || []).live
  const liveCount = hunts.filter(liveNow).length
  const visibleHunts = tab === 'active' ? hunts.filter(liveNow) : hunts
  const featured = hunts.find(liveNow) || hunts[0] || null
  const baseHistory = tab === 'active' ? visibleHunts : visibleHunts.filter(h => h !== featured)
  const sortKey = (h) => {
    const st = huntStats(h, byHunt[h.id] || [])
    if (sort === 'profit') return st.hasResult ? st.profit : -Infinity
    if (sort === 'multi') return st.best ? st.best.multi : -Infinity
    return h.id
  }
  const history = sort === 'new' ? baseHistory : [...baseHistory].sort((a, b) => sortKey(b) - sortKey(a))
  const totalGridPages = Math.ceil(history.length / GRID_PAGE)
  const pageHunts = history.slice((gridPage - 1) * GRID_PAGE, gridPage * GRID_PAGE)

  // totals across every hunt that has results
  const all = hunts.map(h => huntStats(h, byHunt[h.id] || []))
  const done = all.filter(a => a.hasResult)
  const lifetime = done.reduce((s, a) => s + a.profit, 0)
  const bonusCount = all.reduce((s, a) => s + a.total, 0)
  const winRate = done.length ? Math.round((done.filter(a => a.profit >= 0).length / done.length) * 100) : null

  const pager = totalGridPages > 1 && (
    <div className={styles.gridPagination}>
      <button className={styles.pgBtn} disabled={gridPage === 1} onClick={() => setGridPage(p => p - 1)}><ChevLeft /></button>
      {Array.from({ length: totalGridPages }, (_, i) => i + 1).map(n => (
        <button key={n} className={`${styles.pgBtn} ${n === gridPage ? styles.pgActive : ''}`} onClick={() => setGridPage(n)}>{n}</button>
      ))}
      <button className={styles.pgBtn} disabled={gridPage === totalGridPages} onClick={() => setGridPage(p => p + 1)}><ChevRight /></button>
    </div>
  )

  return (
    <div className={x.page}>
      <header className={x.head}>
        <div>
          <h1 className={x.h1}>Bonus Hunts</h1>
          <p className={x.hSub}>Every hunt, bonus by bonus.</p>
        </div>
        <div className={x.seg} role="tablist">
          <button role="tab" aria-selected={tab === 'all'} className={`${x.segBtn} ${tab === 'all' ? x.segOn : ''}`} onClick={() => { setTab('all'); setGridPage(1) }}>History</button>
          <button role="tab" aria-selected={tab === 'active'} className={`${x.segBtn} ${tab === 'active' ? x.segOn : ''}`} onClick={() => { setTab('active'); setGridPage(1) }}>
            Live{liveCount > 0 && <span className={x.segBadge}>{liveCount}</span>}
          </button>
        </div>
      </header>

      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /> Loading...</div>
      ) : !visibleHunts.length ? (
        <div className={x.empty}>
          <p>{tab === 'active' ? 'No hunt is live right now.' : 'No bonus hunts yet.'}</p>
          {tab === 'active' && <button className={x.segBtn} onClick={() => setTab('all')}>See past hunts</button>}
        </div>
      ) : (
        <>
          {tab === 'all' && featured && (
            <div className={x.top}>
              <FeaturedHunt hunt={featured} entries={byHunt[featured.id] || []} onClick={() => setSelectedHunt(featured)} />
              {done.length > 0 && (
                <div className={x.life}>
                  <div><span className={x.lbl}>All-time result</span><b className={lifetime >= 0 ? x.pos : x.neg}>{money(lifetime)}</b></div>
                  <div><span className={x.lbl}>Hunts in profit</span><b>{winRate}%</b></div>
                  <div><span className={x.lbl}>Hunts</span><b>{hunts.length}</b></div>
                  <div><span className={x.lbl}>Bonuses opened</span><b>{bonusCount.toLocaleString('en-GB')}</b></div>
                </div>
              )}
            </div>
          )}

          <div className={x.listHead}>
            <h2>{tab === 'active' ? 'Live hunts' : 'Past hunts'}</h2>
            <div className={x.sort} role="group" aria-label="Sort hunts">
              {[['new', 'Newest'], ['profit', 'Best profit'], ['multi', 'Best multi']].map(([k, l]) => (
                <button key={k} className={`${x.sortBtn} ${sort === k ? x.sortOn : ''}`} onClick={() => { setSort(k); setGridPage(1) }}>{l}</button>
              ))}
            </div>
          </div>

          <div className={x.list}>
            {pageHunts.map(hunt => (
              <HuntCard key={hunt.id} hunt={hunt} entries={byHunt[hunt.id] || []} onClick={() => setSelectedHunt(hunt)} />
            ))}
          </div>
          {pager}
        </>
      )}
    </div>
  )
}
