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

const KICK_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <path d="M2 2h6v5h2V5h2V3h2V1h6v6h-2v2h-2v2h-2v2h2v2h2v2h2v6h-6v-2h-2v-2h-2v-2h-2v5H2V2z" />
  </svg>
)

const POINTS_SVG = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style={{ color: '#facc15' }}>
    <path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" />
  </svg>
)

const SOCIALS = [
  { label: 'Twitch',    href: 'https://www.twitch.tv/jralha_',         bg: 'linear-gradient(135deg,#6441a5,#9147ff)', icon: 'bxl-twitch' },
  { label: 'Kick',      href: 'https://kick.com/jralha_',              bg: 'linear-gradient(135deg,#0a0a0a,#53fc18)', svg: KICK_SVG },
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

// ── Featured Offer Modal (shown on entry) ────────────────────────────────────────
function FeaturedOfferModal({ casino: c, onClose, onRedirect }) {
  const accent = c.featured_accent_color || '#3b82f6'

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleClaim = () => {
    onRedirect(c.claim_url, c.promo_code)
    onClose()
  }

  return (
    <div className={styles.featuredOverlay} onClick={onClose}>
      <div
        className={styles.featuredBox}
        onClick={e => e.stopPropagation()}
        style={{ '--accent': accent }}
      >
        <div className={styles.featuredGlow} />
        <div className={styles.featuredTopBar}>
          <i className="bx bxs-star" /> EXCLUSIVE OFFER <i className="bx bxs-star" />
        </div>
        <button className={styles.featuredClose} onClick={onClose}>
          <i className="bx bx-x" />
        </button>

        <div className={styles.featuredBody}>
          <img src={c.logo_url} alt={c.name} className={styles.featuredLogo} />

          <div className={styles.featuredOfferBox}>
            <span className={styles.featuredOfferTag}>
              <i className="bx bx-gift" /> {c.featured_offer_title || 'Exclusive Bonus'}
            </span>
            <p className={styles.featuredOfferAmount}>{c.featured_offer_amount}</p>
            {c.featured_offer_details && (
              <p className={styles.featuredOfferDetails}>{c.featured_offer_details}</p>
            )}

            {c.promo_code && (
              <div className={styles.featuredPromoWrap}>
                <span className={styles.featuredPromoLabel}>Promo Code</span>
                <span className={styles.featuredPromoCode}>{c.promo_code}</span>
              </div>
            )}
          </div>

          <button className={styles.featuredCta} onClick={handleClaim}>
            Claim {c.featured_offer_amount || 'Bonus'} Now <i className="bx bx-chevron-right" />
          </button>
        </div>
      </div>
    </div>
  )
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
        <div className={styles.redirectIconWrap}><i className="bx bx-link-external" /></div>
        <h2 className={styles.redirectTitle}>Leaving Site</h2>
        <p className={styles.redirectSub}>
          You are about to be securely redirected to our partner's website.
        </p>
        <button className={styles.redirectCta} onClick={handleContinue}>
          CONTINUE
        </button>
        {promo && (
          <div className={styles.redirectPromo}>
            <p className={styles.redirectPromoLabel}>Don't forget to use the code:</p>
            <p className={styles.redirectPromoCode}>{promo}</p>
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
    ? 'localhost' : window.location.hostname.includes('vercel.app')
      ? 'ralha-react-ultra-bwxl.vercel.app' : 'jralha.com'

  const src = type === 'clip'
    ? `https://clips.twitch.tv/embed?clip=${id}&parent=${PARENT}&autoplay=true`
    : `https://player.twitch.tv/?video=${id}&parent=${PARENT}&autoplay=true`

  const handleFullscreen = () => {
    const el = iframeRef.current
    if (!el) return
    if (el.requestFullscreen) el.requestFullscreen()
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
  }

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.playerOverlay} onClick={onClose}>
      <div className={styles.playerBox} onClick={e => e.stopPropagation()}>
        <div className={styles.playerHeader}>
          <div className={styles.playerMeta}>
            <div className={styles.playerIconTwitch}><i className="bx bxl-twitch" /></div>
            <div className={styles.playerTextWrap}>
              <span className={styles.playerTitle}>{title}</span>
              {meta && <span className={styles.playerMetaText}>{meta}</span>}
            </div>
          </div>
          <div className={styles.playerActions}>
            <button className={styles.playerBtn} onClick={handleFullscreen} title="Fullscreen"><i className="bx bx-fullscreen" /></button>
            <button className={styles.playerBtn} onClick={onClose} title="Close"><i className="bx bx-x" /></button>
          </div>
        </div>
        <div className={styles.playerWrap}>
          <iframe ref={iframeRef} src={src} className={styles.playerIframe} allowFullScreen allow="autoplay; fullscreen" />
        </div>
      </div>
    </div>
  )
}

// ── Clean Offer Card ────────────────────────────────────────────────────────────
function OfferCard({ casino: c, onInfo, onNavigate, onRedirect, animDelay = 0 }) {
  const [imgError, setImgError] = useState(false)
  const FALLBACK = 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=600&q=80'
  const bannerUrl = (!imgError && c.banner_url) ? c.banner_url : FALLBACK

  return (
    <div className={styles.offerCard} style={{ animationDelay: `${animDelay}ms` }}>
      <img src={bannerUrl} alt={c.name} className={styles.offerImg} onError={() => setImgError(true)} loading="lazy" />
      <div className={styles.offerOverlay} />
      
      <div className={styles.offerBadgeStack}>
        {(c.is_hot || c.is_new) && (
          <span className={`${styles.offerBadge} ${c.is_hot ? styles.badgeHot : styles.badgeNew}`}>
            <span className={styles.badgeDot} />
            {c.is_hot ? 'HOT' : 'NEW'}
          </span>
        )}
        {c.is_freespins && (
          <span className={`${styles.offerBadge} ${styles.badgeFree}`}>
            <span className={styles.badgeDot} /> FREESPINS
          </span>
        )}
      </div>

      <button className={styles.offerInfoBtn} onClick={() => onNavigate?.('offers')} title="More Info">
        <i className="bx bx-info-circle" />
      </button>

      <div className={styles.offerLogoWrap}>
        <img src={c.logo_url} alt={c.name} className={styles.offerLogo} />
      </div>

      <div className={styles.offerActionWrap}>
        <button 
          className={styles.offerClaimBtn}
          onClick={e => { e.preventDefault(); onRedirect(c.claim_url, c.promo_code) }}
        >
          CLAIM BONUS <i className="bx bx-chevron-right" />
        </button>
      </div>
    </div>
  )
}

// ── Media Card (Stream / Clip) ──────────────────────────────────────────────────
function MediaCard({ media, type, onPlay }) {
  const [hovered, setHovered] = useState(false)
  const isClip = type === 'clip'
  const thumb = media.thumbnail_url?.replace('%{width}', '600').replace('%{height}', '338') || ''
  
  const parseDuration = (d = '') => {
    if(typeof d === 'number') {
      return d >= 60 ? `${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, '0')}` : `0:${String(Math.round(d)).padStart(2, '0')}`
    }
    return d.replace('h', 'h ').replace('m', 'm')
  }

  const dateObj = new Date(media.created_at)
  const diffDays = Math.floor((Date.now() - dateObj) / (1000 * 60 * 60 * 24))
  const dateStr = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : `${diffDays} days ago`

  return (
    <a 
      href={isClip ? media.url : `https://www.twitch.tv/videos/${media.id}`} 
      className={styles.mediaCard} 
      onClick={e => { e.preventDefault(); onPlay(media) }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      <div className={styles.mediaThumbWrap}>
        <img src={thumb} alt={media.title} className={styles.mediaThumb} loading="lazy" />
        <div className={`${styles.mediaHoverOverlay} ${hovered ? styles.mediaHoverOverlayShow : ''}`}>
          <div className={styles.mediaPlayIcon}><i className="bx bx-play" /></div>
        </div>
        <span className={styles.mediaDur}>{parseDuration(media.duration)}</span>
        {isClip && diffDays < 2 && <span className={styles.mediaNewBadge}>NEW</span>}
      </div>
      <div className={styles.mediaInfo}>
        <p className={styles.mediaDate}>{dateStr} • <i className="bx bx-show" /> {media.view_count?.toLocaleString()}</p>
        <p className={styles.mediaTitle}>{media.title}</p>
      </div>
    </a>
  )
}

// ── Live Feed Activity Row (Classic Table Style) ────────────────────────────────
const TYPE_PILL = {
  points:   { label: 'Points',   cls: 'pillPoints'   },
  shop:     { label: 'Shop',     cls: 'pillShop'     },
  giveaway: { label: 'Giveaway', cls: 'pillGiveaway' },
  entry:    { label: 'Entry',    cls: 'pillEntry'    },
  pickwin:  { label: 'P&W',      cls: 'pillPickwin'  },
  gtb:      { label: 'GTB',      cls: 'pillGtb'      },
  avgmulti: { label: 'Avg',      cls: 'pillAvgMulti' },
}

const TYPE_TO_KEY = {
  shop: 'shop',
  giveaway: 'giveaway',
  entry: 'entry',
  daily: 'points',
  pickwin: 'pickwin',
  gtb: 'gtb',
  avgmulti: 'avgmulti',
}

function getTypeMeta(item) {
  const key = TYPE_TO_KEY[item._type]
  if (!key) return { pill: null, border: null }
  return { pill: TYPE_PILL[key], border: `border${key.charAt(0).toUpperCase() + key.slice(1)}` }
}

function ActivityRow({ item }) {
  const pts = item.points || 0
  const positive = pts > 0
  const s = STATUS_MAP[item.status?.toLowerCase()] || { label: item.status || '—', cls: 'statusPending' }
  const { pill, border } = getTypeMeta(item)
  
  const rawAction = item._type === 'daily' ? (item.action || '').split('-')[0].trim() : (item.action || item.item || '—')
  const date = new Date(item.created_at)
  
  const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`${styles.actRow} ${border ? styles[border] : ''}`}>
      <div className={styles.actCellAction}>
        {pill && <span className={`${styles.actPill} ${styles[pill.cls]}`}>{pill.label}</span>}
        <span className={styles.actActionText} title={rawAction}>{rawAction}</span>
      </div>
      <div className={styles.actCellUser}>
        {item.username || 'Unknown'}
      </div>
      <div className={styles.actCellDate}>
        {dateStr} <span className={styles.actTime}>{timeStr}</span>
      </div>
      <div className={`${styles.actCellPts} ${positive ? styles.ptsPos : styles.ptsNeg}`}>
        {pts !== 0 ? `${positive ? '+' : ''}${pts.toLocaleString()}` : '—'}
      </div>
      <div className={styles.actCellStatus}>
        <span className={`${styles.actStatusBadge} ${styles[s.cls]}`}>{s.label}</span>
      </div>
    </div>
  )
}

// ── Clean & Compact Hero Section ────────────────────────────────────────────────
function Hero({ user, profile, points, pointsLoading, rank, live, onLogin, onDailyOpen, canClaimDaily, onNavigate }) {
  const isGuest = !user
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.user_metadata?.name || 'U')}&background=3b82f6&color=fff`
  const displayName = profile?.twitch_username || user?.user_metadata?.name || 'User'

  return (
    <div className={styles.heroBanner}>
      {isGuest ? (
        <div className={styles.heroGuest}>
          <div className={styles.heroGuestLeft}>
            {live ? <span className={styles.liveTag}><span className={styles.liveDot} /> LIVE NOW</span> : <span className={styles.offlineTag}><i className="bx bxl-twitch" /> Jralha Community</span>}
            <h1 className={styles.heroTitle}>Your <span>Rewards</span> Hub</h1>
            <p className={styles.heroSub}>Access the shop, earn points, enter giveaways and dominate the leaderboard. All just a click away.</p>
          </div>
          <div className={styles.heroGuestRight}>
            <button className={styles.heroTwitchBtn} onClick={onLogin}>
              <i className="bx bxl-twitch" /> Login with Twitch
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.heroUser}>
          <div className={styles.heroUserLeft}>
            <div className={styles.heroAvatarWrap}>
              <img src={avatarUrl} alt={displayName} className={styles.heroAvatar} />
              {live && <span className={styles.heroLiveDot} title="Live Now" />}
            </div>
            <div className={styles.heroUserText}>
              <p>Welcome back,</p>
              <h2>{displayName}</h2>
            </div>
          </div>
          
          <div className={styles.heroUserRight}>
            <div className={styles.heroStats}>
              <div className={styles.statBox}>
                <span className={styles.statIconSvg}>{POINTS_SVG}</span>
                <div className={styles.statInfo}>
                  <span className={styles.statVal}>{pointsLoading ? '...' : (points ?? 0).toLocaleString()}</span>
                  <span className={styles.statLbl}>Points</span>
                </div>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.statBox}>
                <i className="bx bx-trophy" style={{color: '#3B82F6'}} />
                <div className={styles.statInfo}>
                  <span className={styles.statVal}>{rank > 0 ? `#${rank}` : '—'}</span>
                  <span className={styles.statLbl}>Rank</span>
                </div>
              </div>
            </div>

            <div className={styles.heroActions}>
              <button className={styles.heroBtnSecondary} onClick={() => onNavigate?.('shop')}><i className="bx bx-store" /> Shop</button>
              <button className={styles.heroBtnSecondary} onClick={() => onNavigate?.('leaderboard')}><i className="bx bx-bar-chart-alt-2" /> Leaderboard</button>
              <button className={`${styles.heroBtnPrimary} ${canClaimDaily ? styles.btnDailyReady : ''}`} onClick={onDailyOpen}>
                <i className="bx bx-gift" /> {canClaimDaily ? 'Claim Daily!' : 'Daily Rewards'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section Header (Updated with Badge) ─────────────────────────────────────────
function SectionHeader({ icon, title, badge, action, onAction, onPrev, onNext, showArrows }) {
  return (
    <div className={styles.sectionHeader}>
      <div className={styles.secHeadLeft}>
        <div className={styles.secHeadIcon}>{icon}</div>
        <div className={styles.titleWrap}>
          <h2 className={styles.secTitle}>{title}</h2>
          {badge !== undefined && <span className={styles.secBadge}>{badge}</span>}
        </div>
      </div>
      <div className={styles.secHeadRight}>
        {action && <button className={styles.secActionBtn} onClick={onAction}>{action}</button>}
        {showArrows && (
          <div className={styles.secArrows}>
            <button className={styles.secArrow} onClick={onPrev}><i className="bx bx-chevron-left" /></button>
            <button className={styles.secArrow} onClick={onNext}><i className="bx bx-chevron-right" /></button>
          </div>
        )}
      </div>
    </div>
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

  const [casinos, setCasinos] = useState([])
  const [selectedCasino, setSelectedCasino] = useState(null)
  const [dailyOpen, setDailyOpen] = useState(false)
  const [canClaimDaily, setCanClaimDaily] = useState(false)
  const [featuredCasino, setFeaturedCasino] = useState(null)
  const [showFeatured, setShowFeatured] = useState(false)

  useEffect(() => { if (dailyOpenProp !== undefined) setDailyOpen(dailyOpenProp) }, [dailyOpenProp])
  const handleDailyOpen  = () => { setDailyOpen(true);  onDailyOpen?.() }
  const handleDailyClose = () => { setDailyOpen(false); onDailyClose?.() }

  const [casinosLoading, setCasinosLoading] = useState(true)
  const [redirect, setRedirect] = useState(null)
  const [player, setPlayer] = useState(null)

  const [clips, setClips] = useState([])
  const [clipsLoading, setClipsLoading] = useState(true)
  const [activity, setActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [streams, setStreams] = useState([])
  const [streamsLoading, setStreamsLoading] = useState(true)

  const offersRef = useRef(null)
  const streamsRef = useRef(null)
  const clipsRef = useRef(null)

  useEffect(() => {
    if (!user) { setCanClaimDaily(false); return }
    supabase.from('profiles').select('last_daily_claim').eq('id', user.id).single()
      .then(({ data }) => setCanClaimDaily(!data?.last_daily_claim || (Date.now() - new Date(data.last_daily_claim).getTime()) >= 86400000))
      .catch(() => setCanClaimDaily(false))
  }, [user])

  // Featured offer modal — shown every time the Home page loads
  useEffect(() => {
    supabase.from('casinos').select('*').eq('is_active', true).eq('is_featured', true).limit(1).maybeSingle()
      .then(({ data }) => { if (data) { setFeaturedCasino(data); setShowFeatured(true) } })
      .catch(() => {})
  }, [])

  const loadCasinos = useCallback(async () => {
    setCasinosLoading(true)
    try {
      const { data } = await supabase.from('casinos').select('*').eq('is_active', true).order('is_hot', { ascending: false }).order('sort_order', { ascending: true })
      setCasinos(data || [])
    } catch (e) {} finally { setCasinosLoading(false) }
  }, [])

  const loadClips = useCallback(async () => {
    setClipsLoading(true)
    try {
      const res = await fetch(`https://ralha-status.jppralha.workers.dev/clips?limit=10`)
      if (res.ok) { const d = await res.json(); setClips(d.clips || d.data || []) }
    } catch (e) {} finally { setClipsLoading(false) }
  }, [])

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const [workerRes, { data: shopData }, dailyRes, { data: picksData }, { data: gtbData }, { data: avgData }] = await Promise.all([
        fetch(`${SE_WORKER_URL}/redeems?limit=10`).then(r => r.ok ? r.json() : { redeems: [] }).catch(() => ({ redeems: [] })),
        supabase.from('shop_redeems').select('*, shop_products(name, image_url, color)').order('created_at', { ascending: false }).limit(10),
        fetch(`${SE_WORKER_URL}/daily-redeems?limit=10`).then(r => r.ok ? r.json() : { redeems: [] }).catch(() => ({ redeems: [] })),
        supabaseDash.from('picks').select('*').order('picked_at', { ascending: false }).limit(10),
        supabaseDash.from('gtb_entries').select('*').order('created_at', { ascending: false }).limit(10),
        supabaseDash.from('avg_multi_entries').select('*').order('created_at', { ascending: false }).limit(10),
      ])

      const shopKeys = new Set((shopData || []).map(r => `${(r.twitch_username || '').toLowerCase()}|${r.created_at ? new Date(r.created_at).toISOString().slice(0, 16) : ''}`))
      const workerItems = (workerRes.redeems || workerRes.data || []).filter(item => !shopKeys.has(`${(item.username || '').toLowerCase()}|${item.created_at ? new Date(item.created_at).toISOString().slice(0, 16) : ''}`)).map(item => ({ ...item, _type: 'giveaway' }))
      const shopItems = (shopData || []).map(r => ({ _type: 'shop', action: r.shop_products?.name || 'Redeem', username: r.twitch_username, created_at: r.created_at, points: -r.cost_at_redeem, status: r.status }))
      const dailyItems = (dailyRes.redeems || []).map(r => ({ _type: 'daily', action: r.action, username: r.username, created_at: r.created_at, points: r.points, status: 'AWARDED' }))
      
      const gameItems = [];
      [picksData, gtbData, avgData].forEach((dataArr, idx) => {
        const type = ['pickwin', 'gtb', 'avgmulti'][idx]
        ;(dataArr || []).forEach(r => {
          gameItems.push({ _type: type, action: `${type} Entry`, username: r.twitch_username, created_at: r.created_at || r.picked_at, points: -(r.cost_paid || 100), status: 'ENTERED' })
          if(r.points_awarded > 0 && r.awarded_at) gameItems.push({ _type: type, action: `${type} Win`, username: r.twitch_username, created_at: r.awarded_at, points: r.points_awarded, status: 'AWARDED' })
        })
      })

      const merged = [...workerItems, ...shopItems, ...dailyItems, ...gameItems].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 12)
      setActivity(merged)
    } catch (e) {} finally { setActivityLoading(false) }
  }, [])

  const loadStreams = useCallback(async () => {
    setStreamsLoading(true)
    try {
      const res = await fetch(`https://ralha-status.jppralha.workers.dev/streams?limit=8`)
      if (res.ok) { const d = await res.json(); setStreams(d.streams || []) }
    } catch (e) {} finally { setStreamsLoading(false) }
  }, [])

  useEffect(() => { loadCasinos(); loadClips(); loadActivity(); loadStreams() }, [loadCasinos, loadClips, loadActivity, loadStreams])

  useEffect(() => {
    const ch1 = supabase.channel('home-feed-1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_redeems' }, () => loadActivity())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'daily_redeems' }, () => loadActivity()).subscribe()
    const ch2 = supabaseDash.channel('home-feed-2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'picks' }, () => loadActivity())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gtb_entries' }, () => loadActivity()).subscribe()
    return () => { ch1.unsubscribe(); ch2.unsubscribe() }
  }, [loadActivity])

  const scroll = (ref, dir) => ref.current?.scrollBy({ left: dir * 300, behavior: 'smooth' })
  const handleRedirect = (url, promo) => setRedirect({ url, promo: (promo ?? '').toString().trim() })
  const handlePlayMedia = (media, type) => setPlayer({ type, id: media.slug || media.id, title: media.title, meta: `${media.view_count?.toLocaleString()} views` })

  return (
    <div className={styles.pageWrap}>

      {/* ── Section 1: CLEAN HERO ── */}
      <Hero 
        user={user} profile={profile} points={points} pointsLoading={pointsLoading} 
        rank={rank} live={live} onLogin={onLoginOpen} onDailyOpen={handleDailyOpen} 
        canClaimDaily={canClaimDaily} onNavigate={onNavigate} 
      />

      {/* ── Section 2: TOP OFFERS ── */}
      <section className={styles.sectionBlock}>
        <SectionHeader 
          icon={<i className="bx bx-crown" style={{color: '#F59E0B'}}/>} 
          title="Top Offers" 
          badge={casinosLoading ? '...' : casinos.length}
          action="View All" onAction={() => onNavigate?.('offers')}
          showArrows onPrev={() => scroll(offersRef, -1)} onNext={() => scroll(offersRef, 1)}
        />
        <div className={styles.carouselWrapper}>
          <div className={styles.fadeRight} />
          {casinosLoading ? (
            <div className={styles.skeletonRow}>{[...Array(5)].map((_, i) => <div key={i} className={styles.skeletonOffer} />)}</div>
          ) : (
            <div className={styles.carouselList} ref={offersRef}>
              {casinos.map((c, i) => (
                <OfferCard key={c.id} casino={c} onInfo={setSelectedCasino} onNavigate={onNavigate} onRedirect={handleRedirect} animDelay={i * 40} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 3: MEDIA VAULT ── */}
      <section className={styles.mediaGrid}>
        
        <div className={styles.mediaCol}>
          <SectionHeader 
            icon={<i className="bx bx-video" style={{color: '#9146FF'}}/>} 
            title="Latest Streams" 
            showArrows onPrev={() => scroll(streamsRef, -1)} onNext={() => scroll(streamsRef, 1)}
          />
          <div className={styles.carouselWrapper}>
            <div className={styles.fadeRight} />
            {streamsLoading ? (
              <div className={styles.skeletonRow}>{[...Array(3)].map((_, i) => <div key={i} className={styles.skeletonMedia} />)}</div>
            ) : streams.length === 0 ? (
              <div className={styles.emptyState}><i className="bx bx-video-off" /><p>No streams.</p></div>
            ) : (
              <div className={styles.carouselList} ref={streamsRef}>
                {streams.map((s) => <MediaCard key={s.id} media={s} type="vod" onPlay={(m) => handlePlayMedia(m, 'vod')} />)}
              </div>
            )}
          </div>
        </div>

        <div className={styles.mediaCol}>
          <SectionHeader 
            icon={<i className="bx bx-movie-play" style={{color: '#9146FF'}}/>} 
            title="Popular Clips" 
            showArrows onPrev={() => scroll(clipsRef, -1)} onNext={() => scroll(clipsRef, 1)}
          />
          <div className={styles.carouselWrapper}>
            <div className={styles.fadeRight} />
            {clipsLoading ? (
              <div className={styles.skeletonRow}>{[...Array(3)].map((_, i) => <div key={i} className={styles.skeletonMedia} />)}</div>
            ) : clips.length === 0 ? (
              <div className={styles.emptyState}><i className="bx bx-film" /><p>No clips.</p></div>
            ) : (
              <div className={styles.carouselList} ref={clipsRef}>
                {clips.map((c) => <MediaCard key={c.slug} media={c} type="clip" onPlay={(m) => handlePlayMedia(m, 'clip')} />)}
              </div>
            )}
          </div>
        </div>

      </section>

      {/* ── Section 4: THE HUB (Live Feed + Socials) ── */}
      <section className={styles.hubGrid}>
        
        {/* Left Col: Activity Table */}
        <div className={styles.hubCol}>
          <SectionHeader 
            icon={<i className="bx bx-pulse" style={{color: '#10B981'}}/>} 
            title="Live Feed" 
          />
          <div className={styles.feedContainer}>
            {activityLoading ? (
               <div className={styles.skeletonCol}>{[...Array(6)].map((_, i) => <div key={i} className={styles.skeletonFeedRow} />)}</div>
            ) : activity.length === 0 ? (
               <div className={styles.emptyState}><i className="bx bx-ghost" /><p>No recent activity.</p></div>
            ) : (
              <div className={styles.feedTable}>
                <div className={styles.feedHeader}>
                  <span>Action</span>
                  <span>User</span>
                  <span>Date</span>
                  <span style={{textAlign: 'right'}}>Points</span>
                  <span style={{textAlign: 'right'}}>Status</span>
                </div>
                <div className={styles.feedBody}>
                  {activity.map((item, i) => <ActivityRow key={i} item={item} />)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Social Connect */}
        <div className={styles.hubColSocials}>
          <SectionHeader 
            icon={<i className="bx bx-network-chart" style={{color: '#3B82F6'}}/>} 
            title="Social Hub" 
          />
          <div className={styles.socialGrid}>
            {SOCIALS.map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className={styles.socialCard}>
                <div className={styles.socialBg} style={{ background: s.bg }} />
                {s.svg
                  ? <span className={styles.socialIcon}>{s.svg}</span>
                  : <i className={`bx ${s.icon} ${styles.socialIcon}`} />}
                <span className={styles.socialText}>{s.label}</span>
                <i className={`bx bx-right-top-arrow-circle ${styles.socialArrow}`} />
              </a>
            ))}
          </div>
        </div>

      </section>

      {/* Modals */}
      {showFeatured && featuredCasino && (
        <FeaturedOfferModal casino={featuredCasino} onClose={() => setShowFeatured(false)} onRedirect={handleRedirect} />
      )}
      {selectedCasino && <InfoModal casino={selectedCasino} methodsBySlug={{}} onClose={() => setSelectedCasino(null)} onRedirect={handleRedirect} />}
      {dailyOpen && <DailyRewardsModal onClose={() => { handleDailyClose(); setCanClaimDaily(false) }} onPointsUpdate={() => {}} />}
      {redirect && <RedirectModal url={redirect.url} promo={redirect.promo} onClose={() => setRedirect(null)} />}
      {player && <TwitchPlayerModal type={player.type} id={player.id} title={player.title} meta={player.meta} onClose={() => setPlayer(null)} />}

    </div>
  )
}