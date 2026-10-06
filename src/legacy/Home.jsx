import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, supabaseDash } from '../lib/supabase'
import { useTwitchStatus } from '../hooks/useTwitchStatus'
import { useAuth } from '../hooks/useAuth'
import { useStreamElementsPoints } from '../hooks/useStreamElementsPoints'
import InfoModal from '../components/InfoModal'
import DailyRewardsModal from '../components/DailyRewardsModal'
import styles from './Home.module.css'

const SE_WORKER_URL = 'https://ralha-points.jppralha.workers.dev'
const TWITCH_CHANNEL = 'jralha_'

const SOCIALS = [
  { label: 'Twitch',    href: 'https://www.twitch.tv/jralha_',         bg: 'linear-gradient(135deg,#6441a5,#9147ff)', icon: 'bxl-twitch' },
  { label: 'Instagram', href: 'https://www.instagram.com/jotaralha7/',  bg: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', icon: 'bxl-instagram' },
  { label: 'Discord',   href: 'https://discord.gg/bdweuwugYJ',          bg: 'linear-gradient(135deg,#3a4099,#5865f2)', icon: 'bxl-discord-alt' },
  { label: 'Telegram',  href: 'https://t.me/+AvzWdiNpmDJkNjY0',        bg: 'linear-gradient(135deg,#1b8fc4,#26a5e4)', icon: 'bxl-telegram' },
  { label: 'X',         href: 'https://x.com/joaoralha7',                  bg: 'linear-gradient(135deg,#1a1a1a,#333)',    icon: 'bxl-twitter' },
]

const STATUS_MAP = {
  joined:   { label: 'JOINED',   cls: 'statusNeutral' },
  applied:  { label: 'APPLIED',  cls: 'statusNeutral' },
  refunded: { label: 'REFUNDED', cls: 'statusNeutral' },
  pending:  { label: 'PENDING',  cls: 'statusNeutral' },
  done:     { label: 'COMPLETED',cls: 'statusNeutral' },
  rejected: { label: 'REJECTED', cls: 'statusNeutral' },
  awarded:  { label: 'AWARDED',  cls: 'statusNeutral' },
  paid:     { label: 'PAID',     cls: 'statusNeutral' },
  shipped:  { label: 'SHIPPED',  cls: 'statusNeutral' },
  completed:{ label: 'COMPLETED',cls: 'statusNeutral' },
  entered:  { label: 'ENTERED',  cls: 'statusNeutral' },
}

// ── Feed item types ──────────────────────────────────────────────────────────
const FEED_TYPE_LABELS = {
  shop:     'Resgate',
  giveaway: 'Giveaway',
  raffle:   'Raffle',
  bet:      'Aposta',
  pickwin:  'Pick & Win',
  gtb:      'Guess the Balance',
  avgmulti: 'Avg Multi',
}

// ── Redirect Modal ──────────────────────────────────────────────────────────────
function RedirectModal({ url, promo, onClose }) {
  const handleContinue = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }
  return (
    <div className={styles.redirectOverlay} onClick={onClose}>
      <div className={styles.redirectBox} onClick={e => e.stopPropagation()}>
        <button className={styles.redirectClose} onClick={onClose}>
          <i className="bx bx-x" />
        </button>
        <h2 className={styles.redirectTitle}>You're being redirected</h2>
        <p className={styles.redirectSub}>
          You are now leaving <strong>jralha.com</strong>, please click the button below to continue
        </p>
        <button className={styles.redirectCta} onClick={handleContinue}>
          CONTINUE
        </button>
        {promo && (
          <div className={styles.redirectPromo}>
            <p className={styles.redirectPromoLabel}>Remember to use the code:</p>
            <p className={styles.redirectPromoCode}>{promo}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Home Offer Card ─────────────────────────────────────────────────────────────
function HomeOfferCard({ casino: c, onInfo, onNavigate, onRedirect, animDelay = 0 }) {
  const [imgError, setImgError] = useState(false)
  const FALLBACK = 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=600&q=80'
  const bannerUrl = (!imgError && c.banner_url) ? c.banner_url : FALLBACK

  return (
    <div className={styles.offerCard} style={{ animationDelay: `${animDelay}ms` }}>
      <img
        src={bannerUrl}
        alt={c.name}
        className={styles.offerImg}
        onError={() => setImgError(true)}
        loading="lazy"
      />
      <div className={styles.offerBlur} />
      <div className={styles.offerOverlay} />

      {(c.is_hot || c.is_new) && (
        <span className={`${styles.offerBadge} ${c.is_hot ? styles.offerBadgeHot : styles.offerBadgeNew}`}>
          <span className={styles.offerBadgeDot} />
          {c.is_hot ? 'HOT' : 'NEW'}
        </span>
      )}

      <button
        className={styles.offerInfoBtn}
        onClick={() => onNavigate?.('offers')}
        title="View all offers"
      >
        <i className="bx bx-info-circle" />
      </button>

      <div className={styles.offerLogoWrap}>
        <img src={c.logo_url} alt={c.name} className={styles.offerLogo} />
      </div>

      <div className={styles.offerHoverCta}>
        <a
          href={c.claim_url}
          className={styles.offerClaimBtn}
          onClick={e => { e.preventDefault(); onRedirect(c.claim_url, c.promo_code) }}
        >
          CLAIM BONUS
        </a>
      </div>
    </div>
  )
}

// ── Section Header ──────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, badge, action, onAction, onPrev, onNext, showArrows }) {
  return (
    <div className={styles.sectionHead}>
      <div className={styles.sectionLeft}>
        {icon && <span className={styles.sectionIcon}>{icon}</span>}
        <span className={styles.sectionTitle}>{title}</span>
        {badge !== undefined && badge !== null && (
          <span className={styles.sectionBadge}>{badge}</span>
        )}
      </div>
      <div className={styles.sectionRight}>
        {action && <button className={styles.viewAll} onClick={onAction}>{action}</button>}
        {showArrows && (
          <div className={styles.arrows}>
            <button className={styles.arrowBtn} onClick={onPrev}><i className="bx bx-chevron-left" /></button>
            <button className={styles.arrowBtn} onClick={onNext}><i className="bx bx-chevron-right" /></button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Twitch Player Modal ─────────────────────────────────────────────────────────
function TwitchPlayerModal({ type, id, title, meta, onClose }) {
  const iframeRef = useRef(null)
  const PARENT = window.location.hostname === 'localhost'
    ? 'localhost'
    : window.location.hostname.includes('vercel.app')
      ? 'ralha-react-ultra-bwxl.vercel.app'
      : 'jralha.com'

  const src = type === 'clip'
    ? `https://clips.twitch.tv/embed?clip=${id}&parent=${PARENT}&autoplay=true`
    : `https://player.twitch.tv/?video=${id}&parent=${PARENT}&autoplay=true`

  const handleFullscreen = () => {
    const el = iframeRef.current
    if (!el) return
    if (el.requestFullscreen) el.requestFullscreen()
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
  }

  // Fechar com ESC
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.playerOverlay} onClick={onClose}>
      <div className={styles.playerBox} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.playerHeader}>
          <div className={styles.playerMeta}>
            <i className="bx bxl-twitch" style={{ color: '#9147ff', fontSize: 18 }} />
            <span className={styles.playerTitle}>{title}</span>
            {meta && <span className={styles.playerMetaText}>{meta}</span>}
          </div>
          <div className={styles.playerActions}>
            <button className={styles.playerBtn} onClick={handleFullscreen} title="Fullscreen">
              <i className="bx bx-fullscreen" />
            </button>
            <button className={styles.playerBtn} onClick={onClose} title="Fechar">
              <i className="bx bx-x" />
            </button>
          </div>
        </div>

        {/* Player */}
        <div className={styles.playerWrap}>
          <iframe
            ref={iframeRef}
            src={src}
            className={styles.playerIframe}
            allowFullScreen
            allow="autoplay; fullscreen"
            frameBorder="0"
            scrolling="no"
          />
        </div>
      </div>
    </div>
  )
}

// ── Clip Card ───────────────────────────────────────────────────────────────────
function ClipCard({ clip, onPlay }) {
  const [hovered, setHovered] = useState(false)
  const thumb = clip.thumbnail_url?.replace('%{width}', '352').replace('%{height}', '488') || ''
  const durSec = clip.duration || 0
  const dur = durSec >= 60
    ? `${Math.floor(durSec / 60)}:${String(Math.round(durSec % 60)).padStart(2, '0')}`
    : `0:${String(Math.round(durSec)).padStart(2, '0')}`
  const clipDate = new Date(clip.created_at)
  const diffDays = Math.floor((Date.now() - clipDate) / (1000 * 60 * 60 * 24))
  const dateStr = diffDays === 0 ? 'Today'
    : diffDays === 1 ? 'Yesterday'
    : clipDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const isNew = diffDays < 2

  return (
    <a
      href={clip.url}
      className={styles.clipCard}
      onClick={e => { e.preventDefault(); onPlay(clip) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={styles.clipThumbWrap}>
        <img src={thumb} alt={clip.title} className={styles.clipThumb} loading="lazy" />
        <div className={`${styles.clipHoverOverlay} ${hovered ? styles.clipHoverOverlayShow : ''}`}>
          <div className={styles.clipPlay}><i className="bx bx-play" /></div>
        </div>
        {isNew && <span className={styles.clipBadge}><span className={styles.clipDot} />NEW</span>}
        <span className={styles.clipDur}>{dur}</span>
      </div>
      <div className={styles.clipInfo}>
        <p className={styles.clipDate}>{dateStr}</p>
        <p className={styles.clipTitle}>{clip.title}</p>
        <div className={styles.clipMeta}>
          <span><i className="bx bx-show" /> {clip.view_count?.toLocaleString('en-GB')}</span>
          <span><i className="bx bx-time" /> {dur}</span>
        </div>
      </div>
    </a>
  )
}

// ── Activity Row ────────────────────────────────────────────────────────────────
const TYPE_PILL = {
  points:   { label: 'Points',   cls: 'pillPoints'   },
  shop:     { label: 'Shop',     cls: 'pillShop'     },
  giveaway: { label: 'Giveaway', cls: 'pillGiveaway' },
  entry:    { label: 'Entry',    cls: 'pillEntry'    },
  pickwin:  { label: 'Pick & Win',cls: 'pillPickwin' },
  gtb:      { label: 'GTB',      cls: 'pillGtb'     },
  avgmulti: { label: 'Avg Multi', cls: 'pillAvgMulti'},
}

function getTypeMeta(item) {
  if (item._type === 'shop')     return { pill: TYPE_PILL.shop,     border: 'borderShop'     }
  if (item._type === 'giveaway') return { pill: TYPE_PILL.giveaway, border: 'borderGiveaway' }
  if (item._type === 'entry')    return { pill: TYPE_PILL.entry,    border: 'borderEntry'    }
  if (item._type === 'daily')    return { pill: TYPE_PILL.points,   border: 'borderPoints'   }
  if (item._type === 'pickwin')  return { pill: TYPE_PILL.pickwin,  border: 'borderPickwin'  }
  if (item._type === 'gtb')      return { pill: TYPE_PILL.gtb,      border: 'borderGtb'      }
  if (item._type === 'avgmulti') return { pill: TYPE_PILL.avgmulti, border: 'borderAvgMulti' }
  return { pill: null, border: null }
}

const DAILY_LABEL_MAP = {
  'wheel':       'Daily Wheel',
  'daily wheel': 'Daily Wheel',
  'claim':       'Daily Claim',
  'daily claim': 'Daily Claim',
}

function cleanAction(item) {
  if (item._type === 'daily') {
    const raw = (item.action || '').replace(/\s*[\u2013\u2014-].+$/i, '').trim().toLowerCase()
    return DAILY_LABEL_MAP[raw] || (item.action || '').replace(/\s*[\u2013\u2014-].+$/i, '').trim() || '—'
  }
  return item.action || item.item || '—'
}

function ActivityRow({ item }) {
  const pts      = item.points || 0
  const positive = pts > 0
  const status   = item.status?.toLowerCase()
  const s        = STATUS_MAP[status] || { label: item.status || '—', cls: 'statusPending' }
  const { pill, border } = getTypeMeta(item)
  const label    = cleanAction(item)

  const date    = new Date(item.created_at)
  const dateStr =
    date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ', ' +
    date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className={`${styles.activityRow} ${border ? styles[border] : ''}`}>
      {/* Action / type */}
      <div className={styles.actActionCell}>
        <span className={styles.actAction}>{label}</span>
        {pill && (
          <span className={`${styles.actTypePill} ${styles[pill.cls]}`}>{pill.label}</span>
        )}
      </div>
      <span className={styles.actUser}>{item.username || '—'}</span>
      <span className={styles.actDate}>{dateStr}</span>
      <span className={`${styles.actPts} ${positive ? styles.ptsPos : styles.ptsNeg}`}>
        {pts !== 0 ? `${positive ? '+' : ''}${pts.toLocaleString('en-GB')} pts` : '—'}
      </span>
      <span className={`${styles.actStatus} ${styles[s.cls]}`}>{s.label}</span>
    </div>
  )
}

// ── Hero — Guest ────────────────────────────────────────────────────────────────
function HeroGuest({ onLogin, live }) {
  const FEATURES = [
    { icon: 'bx-store',      label: 'Shop' },
    { icon: 'bx-coin-stack', label: 'Points' },
    { icon: 'bx-gift',       label: 'Giveaways' },
    { icon: 'bx-trophy',     label: 'Leaderboard' },
  ]
  return (
    <div className={styles.hero}>
      <div className={styles.heroContent}>
        <div className={styles.heroEyebrow}>
          {live
            ? <span className={styles.livePill}><span className={styles.liveDot} />LIVE NOW</span>
            : <span className={styles.offlinePill}><i className="bx bxl-twitch" />jralha's community</span>
          }
        </div>
        <h1 className={styles.heroTitle}>One login.<br />Everything unlocked.</h1>
        <p className={styles.heroSub}>Shop, points, giveaways and leaderboard — all in one place.</p>
      </div>
      <div className={styles.heroCta}>
        <button className={styles.heroBtnTwitch} onClick={onLogin}>
          <i className="bx bxl-twitch" />Login with Twitch
        </button>
        <div className={styles.heroTags}>
          {FEATURES.map(f => (
            <div key={f.label} className={styles.heroTag}>
              <i className={`bx ${f.icon}`} /><span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Hero — Logged In ────────────────────────────────────────────────────────────
function HeroUser({ user, profile, points, pointsLoading, rank, onNavigate, live, onDailyOpen, canClaimDaily }) {
  const avatarUrl = profile?.avatar_url
    || user?.user_metadata?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.user_metadata?.name || 'U')}&background=3b82f6&color=fff`
  const displayName = profile?.twitch_username || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'
  return (
    <div className={styles.heroUser}>
      <div className={styles.heroUserLeft}>
        <div className={styles.heroAvatarWrap}>
          <img src={avatarUrl} alt={displayName} className={styles.heroAvatar} />
          {live && <span className={styles.heroAvatarLive} />}
        </div>
        <div className={styles.heroUserInfo}>
          <p className={styles.heroGreeting}>Hi,</p>
          <h2 className={styles.heroUserName}>{displayName}</h2>
          {live && <span className={styles.livePill} style={{ marginTop: 4 }}><span className={styles.liveDot} />LIVE NOW</span>}
        </div>
      </div>
      <div className={styles.heroUserStats}>
        <div className={styles.heroStat}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{color:'#facc15'}}><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
          <div>
            <p className={styles.heroStatVal}>{pointsLoading ? '…' : (points ?? 0).toLocaleString('en-GB')}</p>
            <p className={styles.heroStatLbl}>Points</p>
          </div>
        </div>
        <div className={styles.heroStatDivider} />
        <div className={styles.heroStat}>
          <i className="bx bx-trophy" />
          <div>
            <p className={styles.heroStatVal}>{rank > 0 ? `#${rank}` : '—'}</p>
            <p className={styles.heroStatLbl}>Rank</p>
          </div>
        </div>
        <div className={styles.heroStatDivider} />
        <div className={styles.heroUserActions}>
          <button className={styles.heroActionBtn} onClick={() => onNavigate?.('shop')}>
            <i className="bx bx-store" />Shop
          </button>
          <button className={styles.heroActionBtnGhost} onClick={() => onNavigate?.('leaderboard')}>
            <i className="bx bx-trophy" />Leaderboard
          </button>
          <button
            className={`${styles.heroActionBtnDaily} ${canClaimDaily ? styles.heroActionBtnDailyReady : ''}`}
            onClick={onDailyOpen}
          >
            {canClaimDaily ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#facc15"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            )}
            {canClaimDaily ? 'Claim Reward!' : 'Daily Rewards'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stream Card (VOD) ───────────────────────────────────────────────────────────
function StreamCard({ stream, onPlay }) {
  const [hovered, setHovered] = useState(false)
  const thumb = stream.thumbnail_url?.replace('%{width}', '440').replace('%{height}', '248') || ''
  const parseDuration = (d = '') => {
    const h = d.match(/(\d+)h/)?.[1]
    const m = d.match(/(\d+)m/)?.[1]
    if (h && m) return `${h}h ${m}m`
    if (h) return `${h}h`
    if (m) return `${m}m`
    return d
  }
  const streamDate = new Date(stream.created_at)
  const diffDays = Math.floor((Date.now() - streamDate) / (1000 * 60 * 60 * 24))
  const dateStr = diffDays === 0 ? 'Today'
    : diffDays === 1 ? 'Yesterday'
    : diffDays < 7 ? `${diffDays} days ago`
    : streamDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
  return (
    <a
      href={`https://www.twitch.tv/videos/${stream.id}`}
      className={styles.streamCard}
      onClick={e => { e.preventDefault(); onPlay(stream) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={styles.streamThumbWrap}>
        {thumb
          ? <img src={thumb} alt={stream.title} className={styles.streamThumb} loading="lazy" />
          : <div className={styles.streamThumbFallback}><i className="bx bx-play-circle" /></div>
        }
        <div className={`${styles.streamHoverOverlay} ${hovered ? styles.streamHoverOverlayShow : ''}`}>
          <div className={styles.streamPlay}><i className="bx bx-play" /></div>
        </div>
        <span className={styles.streamDur}>{parseDuration(stream.duration)}</span>
      </div>
      <div className={styles.streamInfo}>
        <p className={styles.streamDate}>{dateStr}</p>
        <p className={styles.streamTitle}>{stream.title}</p>
        <div className={styles.streamMeta}>
          <span><i className="bx bx-show" /> {stream.view_count?.toLocaleString('en-GB')}</span>
        </div>
      </div>
    </a>
  )
}

// ── MAIN ────────────────────────────────────────────────────────────────────────
export default function Home({ onNavigate, onLoginOpen, dailyOpen: dailyOpenProp, onDailyOpen, onDailyClose }) {
  const { user, profile } = useAuth()
  const live = useTwitchStatus()

  const twitchUsername = profile?.twitch_username || user?.user_metadata?.full_name || null
  const { points, loading: pointsLoading } = useStreamElementsPoints(twitchUsername)

  const [rank, setRank] = useState(0)
  useEffect(() => {
    if (!twitchUsername) return
    fetch('https://ralha-points.jppralha.workers.dev/leaderboard?limit=200')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.users) return
        const idx = d.users.findIndex(u => u.username?.toLowerCase() === twitchUsername.toLowerCase())
        setRank(idx >= 0 ? idx + 1 : 0)
      })
      .catch(() => {})
  }, [twitchUsername])

  const [casinos, setCasinos]               = useState([])
  const [selectedCasino, setSelectedCasino] = useState(null)
  const [dailyOpen,      setDailyOpen]      = useState(false)
  const [canClaimDaily,  setCanClaimDaily]  = useState(false)

  // Sync with lifted state from App
  useEffect(() => {
    if (dailyOpenProp !== undefined) setDailyOpen(dailyOpenProp)
  }, [dailyOpenProp])

  const handleDailyOpen  = () => { setDailyOpen(true);  onDailyOpen?.() }
  const handleDailyClose = () => { setDailyOpen(false); onDailyClose?.() }
  const [casinosLoading, setCasinosLoading] = useState(true)
  const [redirect, setRedirect]             = useState(null)
  const [player, setPlayer]                 = useState(null) // { type, id, title, meta }

  const [clips, setClips]                   = useState([])
  const [clipsLoading, setClipsLoading]     = useState(true)

  const [activity, setActivity]             = useState([])
  const [activityLoading, setActivityLoading] = useState(true)

  const [streams, setStreams]               = useState([])
  const [streamsLoading, setStreamsLoading] = useState(true)

  const offersRef  = useRef(null)
  const clipsRef   = useRef(null)
  const streamsRef = useRef(null)

  // Check if daily reward is available
  useEffect(() => {
    if (!user) { setCanClaimDaily(false); return }
    supabase.from('profiles').select('last_daily_claim').eq('id', user.id).single()
      .then(({ data }) => {
        const available = !data?.last_daily_claim || (Date.now() - new Date(data.last_daily_claim).getTime()) >= 86400000
        setCanClaimDaily(available)
      }).catch(() => setCanClaimDaily(false))
  }, [user])

  const loadCasinos = useCallback(async () => {
    setCasinosLoading(true)
    try {
      const { data } = await supabase.from('casinos').select('*')
        .eq('is_active', true)
        .order('is_hot', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
      setCasinos(data || [])
    } catch (e) { console.error(e) }
    finally { setCasinosLoading(false) }
  }, [])

  const loadClips = useCallback(async () => {
    setClipsLoading(true)
    try {
      const res = await fetch(`https://ralha-status.jppralha.workers.dev/clips?limit=12`)
      if (res.ok) { const d = await res.json(); setClips(d.clips || d.data || []) }
    } catch (e) { console.error('clips error', e) }
    finally { setClipsLoading(false) }
  }, [])

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      // Fetch Worker redeems + Supabase shop_redeems + daily_redeems + mini-games em paralelo
      const [workerRes, { data: shopData }, dailyRes, { data: picksData }, { data: gtbData }, { data: avgData }] = await Promise.all([
        fetch(`${SE_WORKER_URL}/redeems?limit=10`).then(r => r.ok ? r.json() : { redeems: [] }).catch(() => ({ redeems: [] })),
        supabase
          .from('shop_redeems')
          .select('*, shop_products(name, image_url, color)')
          .order('created_at', { ascending: false })
          .limit(10),
        fetch(`${SE_WORKER_URL}/daily-redeems?limit=10`).then(r => r.ok ? r.json() : { redeems: [] }).catch(() => ({ redeems: [] })),
        supabaseDash.from('picks').select('twitch_username, cost_paid, picked_at, points_awarded, rank, awarded_at').order('picked_at', { ascending: false }).limit(10),
        supabaseDash.from('gtb_entries').select('twitch_username, cost_paid, guess, created_at, rank, points_awarded, awarded_at').order('created_at', { ascending: false }).limit(10),
        supabaseDash.from('avg_multi_entries').select('twitch_username, cost_paid, guess, bucket, created_at, rank, points_awarded, awarded_at').order('created_at', { ascending: false }).limit(10),
      ])

      // Normalizar Worker items
      const shopKeys = new Set((shopData || []).map(r => {
        const min = r.created_at ? new Date(r.created_at).toISOString().slice(0, 16) : ''
        return `${(r.twitch_username || '').toLowerCase()}|${min}`
      }))

      const workerItems = (workerRes.redeems || workerRes.data || [])
        .filter(item => {
          const min = item.created_at ? new Date(item.created_at).toISOString().slice(0, 16) : ''
          const key = `${(item.username || '').toLowerCase()}|${min}`
          return !shopKeys.has(key)
        })
        .map(item => ({ ...item, _type: 'giveaway' }))

      // Normalizar Shop items
      const shopItems = (shopData || []).map(r => ({
        _type:      'shop',
        _imageUrl:  r.shop_products?.image_url || null,
        _color:     r.shop_products?.color || '#3b82f6',
        action:     r.shop_products?.name || 'Resgate',
        username:   r.twitch_username,
        created_at: r.created_at,
        points:     -r.cost_at_redeem,
        status:     r.status,
      }))

      // Normalizar Daily items
      const dailyItems = (dailyRes.redeems || []).map(r => ({
        _type:      'daily',
        action:     r.action,
        username:   r.username,
        created_at: r.created_at,
        points:     r.points,
        status:     'AWARDED',
        emoji:      r.emoji,
      }))

      // Normalizar Pick & Win items
      const pickItems = (picksData || []).flatMap(r => {
        const items = [{
          _type:      'pickwin',
          action:     'Pick & Win Entry',
          username:   r.twitch_username,
          created_at: r.picked_at,
          points:     -(r.cost_paid || 100),
          status:     'ENTERED',
        }]
        if (r.points_awarded > 0 && r.rank && r.awarded_at) {
          const rankLabel = r.rank === 1 ? '1st' : r.rank === 2 ? '2nd' : '3rd'
          items.push({
            _type:      'pickwin',
            action:     `Pick & Win — ${rankLabel} place`,
            username:   r.twitch_username,
            created_at: r.awarded_at,
            points:     r.points_awarded,
            status:     'AWARDED',
          })
        }
        return items
      })

      // Normalizar GTB items
      const gtbItems = (gtbData || []).flatMap(r => {
        const items = [{
          _type:      'gtb',
          action:     'Guess the Balance Entry',
          username:   r.twitch_username,
          created_at: r.created_at,
          points:     -(r.cost_paid || 100),
          status:     'ENTERED',
        }]
        if (r.points_awarded > 0 && r.rank && r.awarded_at) {
          const rankLabel = r.rank === 1 ? '1st' : r.rank === 2 ? '2nd' : '3rd'
          items.push({
            _type:      'gtb',
            action:     `Guess the Balance — ${rankLabel} place`,
            username:   r.twitch_username,
            created_at: r.awarded_at,
            points:     r.points_awarded,
            status:     'AWARDED',
          })
        }
        return items
      })

      // Normalizar Avg Multi items
      const avgItems = (avgData || []).flatMap(r => {
        const items = [{
          _type:      'avgmulti',
          action:     'Avg Multi Entry',
          username:   r.twitch_username,
          created_at: r.created_at,
          points:     -(r.cost_paid || 100),
          status:     'ENTERED',
        }]
        if (r.points_awarded > 0 && r.rank && r.awarded_at) {
          const rankLabel = r.rank === 1 ? '1st' : r.rank === 2 ? '2nd' : '3rd'
          items.push({
            _type:      'avgmulti',
            action:     `Avg Multi — ${rankLabel} place`,
            username:   r.twitch_username,
            created_at: r.awarded_at,
            points:     r.points_awarded,
            status:     'AWARDED',
          })
        }
        return items
      })

      // Merge + ordenar por data desc
      const merged = [...workerItems, ...shopItems, ...dailyItems, ...pickItems, ...gtbItems, ...avgItems].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      ).slice(0, 10)

      setActivity(merged)
    } catch (e) { console.error('activity error', e) }
    finally { setActivityLoading(false) }
  }, [])

  const loadStreams = useCallback(async () => {
    setStreamsLoading(true)
    try {
      const res = await fetch(`https://ralha-status.jppralha.workers.dev/streams?limit=10`)
      if (res.ok) { const d = await res.json(); setStreams(d.streams || []) }
    } catch (e) { console.error('streams error', e) }
    finally { setStreamsLoading(false) }
  }, [])

  useEffect(() => {
    loadCasinos(); loadClips(); loadActivity(); loadStreams()
  }, [loadCasinos, loadClips, loadActivity, loadStreams])

  // Realtime: refresh feed quando há novo resgate na loja
  useEffect(() => {
    const ch = supabase
      .channel('home-shop-redeems')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shop_redeems' }, () => loadActivity())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shop_redeems' }, () => loadActivity())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'daily_redeems' }, () => loadActivity())

      .subscribe()
    return () => ch.unsubscribe()
  }, [loadActivity])

  // Realtime mini-games (supabaseDash)
  useEffect(() => {
    const ch = supabaseDash.channel('home-minigames-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'picks' }, () => loadActivity())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gtb_entries' }, () => loadActivity())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avg_multi_entries' }, () => loadActivity())
      .subscribe()
    return () => ch.unsubscribe()
  }, [loadActivity])

  const scroll = (ref, dir) => ref.current?.scrollBy({ left: dir * 620, behavior: 'smooth' })
  const handleRedirect = (url, promo) => setRedirect({ url, promo: (promo ?? '').toString().trim() })
  const handlePlayClip = (clip) => setPlayer({
    type: 'clip',
    id: clip.slug || clip.id,
    title: clip.title,
    meta: `${clip.view_count?.toLocaleString('en-GB')} views`
  })
  const handlePlayStream = (stream) => setPlayer({
    type: 'vod',
    id: stream.id,
    title: stream.title,
    meta: `${stream.view_count?.toLocaleString('en-GB')} views`
  })

  return (
    <div className={styles.page}>

      {user ? (
        <HeroUser user={user} profile={profile} points={points} pointsLoading={pointsLoading} rank={rank} onNavigate={onNavigate} live={live} onDailyOpen={handleDailyOpen} canClaimDaily={canClaimDaily} />
      ) : (
        <HeroGuest onLogin={onLoginOpen} live={live} />
      )}

      <section className={styles.sectionCarousel}>
        <SectionHeader
          icon={<i className="bx bx-crown" style={{ color: '#3b82f6', fontSize: 18 }} />}
          title="Top Offers"
          badge={casinosLoading ? null : casinos.length}
          action="View all"
          onAction={() => onNavigate?.('offers')}
          showArrows
          onPrev={() => scroll(offersRef, -1)}
          onNext={() => scroll(offersRef, 1)}
        />
        {casinosLoading ? (
          <div className={styles.skeletonRow}>{[...Array(4)].map((_, i) => <div key={i} className={styles.skeleton} />)}</div>
        ) : (
          <div className={styles.carouselWrap}>
            <div className={styles.carousel} ref={offersRef}>
              {casinos.map((c, i) => (
                <div key={c.id} className={styles.carouselItem}>
                  <HomeOfferCard casino={c} onInfo={setSelectedCasino} onNavigate={onNavigate} onRedirect={handleRedirect} animDelay={i * 60} />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className={styles.sectionCarousel}>
        <SectionHeader
          icon={<span style={{ color: '#9147ff', fontSize: 16, display: 'flex' }}><i className="bx bxl-twitch" /></span>}
          title="Latest Clips" badge="Twitch" action="View all"
          onAction={() => window.open(`https://www.twitch.tv/${TWITCH_CHANNEL}/clips`, '_blank')}
          showArrows onPrev={() => scroll(clipsRef, -1)} onNext={() => scroll(clipsRef, 1)}
        />
        {clipsLoading ? (
          <div className={styles.skeletonRow}>{[...Array(6)].map((_, i) => <div key={i} className={`${styles.skeleton} ${styles.skeletonClip}`} />)}</div>
        ) : clips.length === 0 ? (
          <div className={styles.emptyState}><i className="bx bx-film" style={{ fontSize: 36, marginBottom: 8 }} /><p>Clips not available right now.</p></div>
        ) : (
          <div className={styles.carouselWrap}>
            <div className={styles.carousel} ref={clipsRef}>
              {clips.map((clip, i) => <div key={clip.id || i} className={styles.carouselItemClip}><ClipCard clip={clip} onPlay={handlePlayClip} /></div>)}
            </div>
          </div>
        )}
      </section>

      <section className={styles.sectionCarousel}>
        <SectionHeader
          icon={<i className="bx bx-video" style={{ color: '#9147ff', fontSize: 18 }} />}
          title="Latest Streams" badge="Twitch" action="View all"
          onAction={() => window.open(`https://www.twitch.tv/${TWITCH_CHANNEL}/videos`, '_blank')}
          showArrows onPrev={() => scroll(streamsRef, -1)} onNext={() => scroll(streamsRef, 1)}
        />
        {streamsLoading ? (
          <div className={styles.skeletonRow}>{[...Array(5)].map((_, i) => <div key={i} className={`${styles.skeleton} ${styles.skeletonStream}`} />)}</div>
        ) : streams.length === 0 ? (
          <div className={styles.emptyState}><i className="bx bx-video" style={{ fontSize: 36, marginBottom: 8 }} /><p>No recent streams.</p></div>
        ) : (
          <div className={styles.carouselWrap}>
            <div className={styles.carousel} ref={streamsRef}>
              {streams.map((s, i) => <div key={s.id || i} className={styles.carouselItemStream}><StreamCard stream={s} onPlay={handlePlayStream} /></div>)}
            </div>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <SectionHeader
          icon={<i className="bx bx-group" style={{ color: '#3b82f6', fontSize: 18, display: 'flex' }} />}
          title="Join Our Community" badge="Socials"
        />
        <div className={styles.socialRow}>
          {SOCIALS.map(s => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className={styles.socialCard} style={{ background: s.bg }}>
              <i className={`bx ${s.icon} ${styles.socialIco}`} />
              <span className={styles.socialLabel}>{s.label}</span>
            </a>
          ))}
        </div>
      </section>


      <section className={styles.section}>
        <SectionHeader
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
          title="Latest Activity" badge="Shop · Pick & Win · GTB · More"
        />
        {activityLoading ? (
          <div className={styles.skeletonCol}>{[...Array(8)].map((_, i) => <div key={i} className={styles.skeletonRow2} />)}</div>
        ) : activity.length === 0 ? (
          <div className={styles.emptyState}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8, opacity: .3 }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <p>No recent activity.</p>
          </div>
        ) : (
          <div className={styles.activityTable}>
            <div className={styles.activityHeader}>
              <span>Action</span><span>User</span><span>Date</span><span>Points</span><span>Status</span>
            </div>
            {activity.map((item, i) => <ActivityRow key={i} item={item} />)}
          </div>
        )}
      </section>

      {selectedCasino && (
        <InfoModal casino={selectedCasino} methodsBySlug={{}} onClose={() => setSelectedCasino(null)} onRedirect={handleRedirect} />
      )}

      {dailyOpen && (
        <DailyRewardsModal onClose={() => { handleDailyClose(); setCanClaimDaily(false) }} onPointsUpdate={() => {}} />
      )}

      {redirect && (
        <RedirectModal url={redirect.url} promo={redirect.promo} onClose={() => setRedirect(null)} />
      )}

      {player && (
        <TwitchPlayerModal
          type={player.type}
          id={player.id}
          title={player.title}
          meta={player.meta}
          onClose={() => setPlayer(null)}
        />
      )}

    </div>
  )
}