import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import OfferRow from '../components/OfferRow';
import InfoModal from '../components/InfoModal';
import { RedirectModal, TwitchPlayerModal, FeaturedOfferModal } from '../components/HomeModals';
import { casinoToOffer } from '../data/casinoToOffer';
import { OFFERS } from '../data/fallback';
import { useTwitchStatus } from '../hooks/useTwitchStatus';
import { supabase, supabaseDash } from '../lib/supabase';
import '../styles/ralhaultra-home.css';

const SE_WORKER_URL = 'https://ralha-points.jppralha.workers.dev';
const STATUS_WORKER_URL = 'https://ralha-status.jppralha.workers.dev';

const VIDEO_FALLBACK = [
  { id: 'f0', title: 'Latest stream', tone: 'v1' },
  { id: 'f1', title: 'Live highlights', tone: 'v2' },
  { id: 'f2', title: 'Big win compilation', tone: 'v3' },
  { id: 'f3', title: 'Bonus hunt result', tone: 'v4' },
  { id: 'f4', title: 'New record in Portugal', tone: 'v5' },
];

const DAILY_LABELS = { wheel: 'Daily Wheel', 'daily wheel': 'Daily Wheel', claim: 'Daily Claim', 'daily claim': 'Daily Claim' };

const LINKS = {
  twitch: 'https://twitch.tv/jralha_',
  kick: 'https://kick.com/jralha_',
  instagram: 'https://www.instagram.com/jotaralha7/',
  clips: 'https://instagram.com/clipsdoralha',
  discord: 'https://discord.gg/bdweuwugYJ',
  telegram: 'https://t.me/+AvzWdiNpmDJkNjY0',
};

const COMMUNITY = [
  { id: 1, icon: 'tv', name: 'Twitch', meta: 'jralha_', cta: 'Follow', url: LINKS.twitch },
  { id: 2, icon: 'play', name: 'Kick', meta: 'jralha_', cta: 'Follow', url: LINKS.kick },
  { id: 3, icon: 'camera', name: 'Instagram', meta: '@jotaralha7', cta: 'Follow', url: LINKS.instagram },
  { id: 4, icon: 'camera', name: 'Instagram clips', meta: '@clipsdoralha', cta: 'Follow', url: LINKS.clips },
  { id: 5, icon: 'chat', name: 'Discord', meta: '4,000+ members', cta: 'Join', url: LINKS.discord },
  { id: 6, icon: 'send', name: 'Telegram', meta: 'Announcements', cta: 'Join', url: LINKS.telegram },
];

const TABS = [
  { key: 'shop', label: 'Shop', icon: 'bag' },
  { key: 'giveaways', label: 'Giveaways & Raffles', icon: 'gift' },
  { key: 'games', label: 'Games & Daily', icon: 'spark' },
];

function parseDuration(d = '') {
  const h = d.match(/(\d+)h/)?.[1];
  const m = d.match(/(\d+)m/)?.[1];
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  if (m) return `${m}m`;
  return d;
}

function ago(date) {
  const d = new Date(date);
  if (isNaN(d)) return '';
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function thumbOf(s) {
  return s.thumbnail_url ? s.thumbnail_url.replace('%{width}', 640).replace('%{height}', 360) : '';
}

function cleanAction(it) {
  if (it._type === 'daily') {
    const raw = (it.action || '').replace(/\s*[–—-].+$/, '').trim();
    return DAILY_LABELS[raw.toLowerCase()] || raw || '-';
  }
  return it.action || '-';
}

const rankLabel = (r) => (r === 1 ? '1st' : r === 2 ? '2nd' : '3rd');

function gameRows(rows, type, entryLabel, awardLabel, dateKey) {
  return (rows || []).flatMap((r) => {
    const out = [{ _type: type, action: entryLabel, username: r.twitch_username, created_at: r[dateKey], points: -(r.cost_paid || 100), status: 'ENTERED' }];
    if (r.points_awarded > 0 && r.rank && r.awarded_at) {
      out.push({ _type: type, action: `${awardLabel} - ${rankLabel(r.rank)} place`, username: r.twitch_username, created_at: r.awarded_at, points: r.points_awarded, status: 'AWARDED' });
    }
    return out;
  });
}

function Round() {
  return (
    <span className="round">
      <Icon name="right" size={14} />
    </span>
  );
}

function SectionHead({ icon, title, tag, count, showAll }) {
  return (
    <div className="sh">
      <Icon name={icon} color="var(--acc2)" />
      <h2>{title}</h2>
      {count != null && <span className="count">{count}</span>}
      {tag && <span className="tag">{tag}</span>}
      <div className="sp" />
      {showAll && <Link className="va" to={showAll}>View all</Link>}
    </div>
  );
}

export default function Home() {
  const live = useTwitchStatus();
  const [tab, setTab] = useState('shop');
  const [offers, setOffers] = useState(OFFERS.slice(0, 3));
  const [methodsBySlug, setMethodsBySlug] = useState({});
  const [selectedCasino, setSelectedCasino] = useState(null);
  const [redirect, setRedirect] = useState(null);
  const [featuredCasino, setFeaturedCasino] = useState(null);
  const [showFeatured, setShowFeatured] = useState(false);
  const [player, setPlayer] = useState(null);
  const [streams, setStreams] = useState([]);
  const [board, setBoard] = useState([]);
  const [ci, setCi] = useState(0);
  const dragX = useRef(null);
  const [activity, setActivity] = useState(null);

  // Featured offer popup, shown every time Home loads
  useEffect(() => {
    supabase.from('casinos').select('*').eq('is_active', true).eq('is_featured', true).limit(1).maybeSingle()
      .then(({ data }) => { if (data) { setFeaturedCasino(data); setShowFeatured(true); } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    supabase
      .from('casinos')
      .select('*')
      .eq('is_active', true)
      .order('is_hot', { ascending: false })
      .order('sort_order', { ascending: true })
      .limit(3)
      .then(({ data, error }) => {
        if (!error && data && data.length) setOffers(data.map((c, i) => casinoToOffer(c, i)));
      });
    supabase
      .from('deposit_methods')
      .select('slug,name,icon_url')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        const by = {};
        (data || []).forEach((m) => { by[m.slug] = { name: m.name, icon_url: m.icon_url }; });
        setMethodsBySlug(by);
      });
    fetch(`${SE_WORKER_URL}/leaderboard?limit=5`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.users) setBoard(d.users); })
      .catch(() => {});
    fetch(`${STATUS_WORKER_URL}/streams?limit=8`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.streams?.length) setStreams(d.streams); })
      .catch(() => {});
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      const empty = { redeems: [] };
      const [workerRes, shopRes, dailyRes, picks, gtb, avg] = await Promise.all([
        fetch(`${SE_WORKER_URL}/redeems?limit=10`).then((r) => (r.ok ? r.json() : empty)).catch(() => empty),
        supabase.from('shop_redeems').select('*, shop_products(name)').order('created_at', { ascending: false }).limit(10),
        fetch(`${SE_WORKER_URL}/daily-redeems?limit=10`).then((r) => (r.ok ? r.json() : empty)).catch(() => empty),
        supabaseDash.from('picks').select('twitch_username, cost_paid, picked_at, points_awarded, rank, awarded_at').order('picked_at', { ascending: false }).limit(10),
        supabaseDash.from('gtb_entries').select('twitch_username, cost_paid, created_at, rank, points_awarded, awarded_at').order('created_at', { ascending: false }).limit(10),
        supabaseDash.from('avg_multi_entries').select('twitch_username, cost_paid, created_at, rank, points_awarded, awarded_at').order('created_at', { ascending: false }).limit(10),
      ]);
      const shopData = shopRes.data || [];
      const minute = (d) => (d ? new Date(d).toISOString().slice(0, 16) : '');
      const shopKeys = new Set(shopData.map((r) => `${(r.twitch_username || '').toLowerCase()}|${minute(r.created_at)}`));
      const giveaways = (workerRes.redeems || workerRes.data || [])
        .filter((it) => !shopKeys.has(`${(it.username || '').toLowerCase()}|${minute(it.created_at)}`))
        .map((it) => ({ ...it, _type: 'giveaway', action: it.action || it.item }));
      const shop = shopData.map((r) => ({
        _type: 'shop', action: r.shop_products?.name || 'Redeem', username: r.twitch_username,
        created_at: r.created_at, points: -(r.cost_at_redeem || 0), status: r.status,
      }));
      const daily = (dailyRes.redeems || []).map((r) => ({
        _type: 'daily', action: r.action, username: r.username, created_at: r.created_at, points: r.points, status: 'AWARDED',
      }));
      const games = [
        ...gameRows(picks.data, 'pickwin', 'Pick & Win Entry', 'Pick & Win', 'picked_at'),
        ...gameRows(gtb.data, 'gtb', 'Guess the Balance Entry', 'Guess the Balance', 'created_at'),
        ...gameRows(avg.data, 'avgmulti', 'Avg Multi Entry', 'Avg Multi', 'created_at'),
        ...daily,
      ];
      const byDate = (a, b) => new Date(b.created_at) - new Date(a.created_at);
      setActivity({
        shop: shop.sort(byDate).slice(0, 10),
        giveaways: giveaways.sort(byDate).slice(0, 10),
        games: games.sort(byDate).slice(0, 10),
      });
    } catch (e) {
      console.error('activity error', e);
    }
  }, []);

  useEffect(() => {
    loadActivity();
    const ch = supabase
      .channel('home-activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_redeems' }, () => loadActivity())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'daily_redeems' }, () => loadActivity())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadActivity]);

  const claim = (o) => {
    const c = o.raw;
    const url = c?.claim_url || o.url;
    if (!url) return;
    setRedirect({ url, promo: (c?.promo_code ?? '').toString().trim() });
  };
  const info = (o) => { if (o.raw) setSelectedCasino(o.raw); };
  const handleRedirect = (url, promo) => setRedirect({ url, promo: (promo ?? '').toString().trim() });
  const play = (s) => setPlayer({ type: 'vod', id: s.id, title: s.title, meta: `${(s.view_count ?? 0).toLocaleString('en-GB')} views` });

  const feedRows = activity ? activity[tab] : [];
  const vids = streams.length ? streams : null;
  
  
  const slides = vids || VIDEO_FALLBACK;
  const go = (d) => setCi((c) => Math.min(slides.length - 1, Math.max(0, c + d)));
  const thumbStyle = (v) => (thumbOf(v) ? { backgroundImage: `url(${thumbOf(v)})` } : undefined);
  const thumbCls = (v, i) => `th ${v.thumbnail_url ? 'img' : v.tone || `v${(i % 5) + 1}`}`;

  return (
    <>
      <section className="hero" aria-label="Featured">
        <article className="hc a">
          <h2>#1 Casino Streamer in Portugal</h2>
          <p>Bonus hunts, giveaways and slots, almost every day.</p>
          <div className="act">
            <Round />
            <a className={`pill${live ? ' live' : ''}`} href={LINKS.twitch} target="_blank" rel="noopener noreferrer">
              <span className={`dot${live ? '' : ' off'}`} />{live ? 'Live now - Watch' : 'Offline - Twitch'}
            </a>
          </div>
        </article>
        <article className="hc b">
          <h2>Wager Race</h2>
          <p>Climb the board and win your share of the prize pool.</p>
          <div className="act">
            <Round />
            <Link className="pill" to="/leaderboard"><Icon name="trophy" size={16} />Leaderboard</Link>
          </div>
        </article>
      </section>

      <section>
        <SectionHead icon="tag" title="Top Offers" showAll="/offers" />
        <p className="hint">Sign up through the official links to support the channel and unlock the offers.</p>
        <div className="ocards">
          {offers.map((o) => <OfferRow key={o.id} o={o} onClaim={claim} onInfo={info} />)}
        </div>
      </section>

      <section>
        <SectionHead icon="tv" title="Latest Streams" tag="Twitch" showAll="/stream" />
        <div className="lsx">
          <div className="cover" onPointerDown={(e) => { dragX.current = e.clientX; }} onPointerUp={(e) => {
            if (dragX.current == null) return;
            const dx = e.clientX - dragX.current; dragX.current = null;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          }}>
            <button type="button" className="carArr l" aria-label="Previous stream" onClick={() => go(-1)}><Icon name="left" size={18} /></button>
            <div className="stage3d">
              {slides.map((v, i) => {
                const off = i - ci;
                const a = Math.abs(off);
                if (a > 3) return null;
                return (
                  <button
                    type="button" key={v.id}
                    className={`cv${off === 0 ? ' on' : ''}`}
                    style={{ transform: `translateX(calc(-50% + ${off * 185}px)) scale(${1 - a * 0.13})`, zIndex: 10 - a, opacity: a > 2 ? 0 : 1 }}
                    onClick={() => (off === 0 ? vids && play(v) : setCi(i))}
                    aria-label={v.title}
                    tabIndex={a > 1 ? -1 : 0}
                  >
                    <div className={thumbCls(v, i)} style={thumbStyle(v)}>
                      {vids && <span className="new">{ago(v.created_at)}</span>}
                      {v.duration && <span className="dur">{parseDuration(v.duration)}</span>}
                      <svg><use href="#play" /></svg>
                    </div>
                    <p>{v.title}</p>
                    {vids && <small>{(v.view_count ?? 0).toLocaleString('en-GB')} views</small>}
                  </button>
                );
              })}
            </div>
            <button type="button" className="carArr r" aria-label="Next stream" onClick={() => go(1)}><Icon name="right" size={18} /></button>
            <div className="dots" role="tablist" aria-label="Streams">
              {slides.map((v, i) => (
                <button type="button" key={v.id} role="tab" aria-selected={i === ci} aria-label={`Stream ${i + 1}`} className={i === ci ? 'on' : ''} onClick={() => setCi(i)} />
              ))}
            </div>
          </div>
          <aside className="lbp" aria-label="Top points">
            <div className="lbh"><span>Top points</span><Link to="/leaderboard">View all</Link></div>
            {board.length === 0 ? <p className="lbn">Leaderboard unavailable right now.</p> : (
              <ol>
                {board.slice(0, 5).map((u, i) => (
                  <li key={u.username}>
                    <span className={`lbr r${i + 1}`}>{i + 1}</span>
                    <b>{u.username}</b>
                    <span className="lbp2">{Number(u.points || 0).toLocaleString('en-GB')}<span className="coin" /></span>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      </section>

      <section>
        <SectionHead icon="users" title="Community" tag="Join us" />
        <div className="ccards">
          {COMMUNITY.map((c) => (
            <a key={c.id} className="cc" href={c.url} target="_blank" rel="noopener noreferrer">
              <span className="gi"><Icon name={c.icon} size={20} /></span>
              <div>
                <b>{c.name}</b>
                <small>{c.meta}</small>
              </div>
              <span className="go">{c.cta}</span>
            </a>
          ))}
        </div>
      </section>

      <section>
        <SectionHead icon="pulse" title="Activity Feed" tag="Live updates" />
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className={`tb${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>
              <Icon name={t.icon} />{t.label}
            </button>
          ))}
        </div>
        <div className="feed">
          <div className="ah">
            <span>Redeems</span>
            <span>Username</span>
            <span className="dt">Date</span>
            <span className="val">Value</span>
            <span>Status</span>
          </div>
          {feedRows.length === 0 && <div className="empty">{activity ? 'No recent activity.' : 'Loading...'}</div>}
          {feedRows.map((r, i) => {
            const pts = Number(r.points || 0);
            const st = String(r.status || 'pending').toLowerCase();
            return (
              <div key={i} className="ar">
                <span className="rd"><i />{cleanAction(r)}</span>
                <b>{r.username || '-'}</b>
                <span className="dt">{new Date(r.created_at).toLocaleString('pt-PT')}</span>
                <span className={`val${pts > 0 ? ' pos' : ''}`}>{pts > 0 ? '+' : pts < 0 ? '-' : ''} {Math.abs(pts).toLocaleString('pt-PT')} PTS <span className="coin" /></span>
                <span className={`stt ${st}`}>{st}</span>
              </div>
            );
          })}
        </div>
      </section>

      {selectedCasino && (
        <InfoModal casino={selectedCasino} methodsBySlug={methodsBySlug} onClose={() => setSelectedCasino(null)} onRedirect={handleRedirect} />
      )}
      {showFeatured && featuredCasino && (
        <FeaturedOfferModal casino={featuredCasino} onClose={() => setShowFeatured(false)} onRedirect={handleRedirect} />
      )}
      {redirect && <RedirectModal url={redirect.url} promo={redirect.promo} onClose={() => setRedirect(null)} />}
      {player && <TwitchPlayerModal type={player.type} id={player.id} title={player.title} meta={player.meta} onClose={() => setPlayer(null)} />}
    </>
  );
}
