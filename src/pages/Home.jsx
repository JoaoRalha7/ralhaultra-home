import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import OfferRow from '../components/OfferRow';
import { casinoToOffer } from '../data/casinoToOffer';
import { OFFERS } from '../data/fallback';
import { supabase } from '../lib/supabase';
import '../styles/ralhaultra-home.css';


const FEATURED_VIDEO = { title: 'Best moments - September', age: '2 days ago', tone: 'v1', isNew: true };
const VIDEOS = [
  { id: 1, title: 'Live highlights', age: '5 days ago', tone: 'v2' },
  { id: 2, title: 'Big win compilation', age: '1 week ago', tone: 'v3' },
  { id: 3, title: 'Bonus hunt result', age: '2 weeks ago', tone: 'v4' },
  { id: 4, title: 'New record in Portugal', age: '3 weeks ago', tone: 'v5' },
];

const FEED = {
  shop: [
    { id: 1, item: '100 Free Spins No Deposit', user: 'user_one', date: '05/10/2026, 23:41:15', value: '100 000', status: 'pending' },
    { id: 2, item: '100 Free Spins No Deposit', user: 'user_two', date: '05/10/2026, 22:41:41', value: '100 000', status: 'paid' },
    { id: 3, item: '100 Free Spins No Deposit', user: 'user_three', date: '05/10/2026, 22:38:56', value: '100 000', status: 'paid' },
    { id: 4, item: '100 Free Spins No Deposit', user: 'user_four', date: '05/10/2026, 21:49:40', value: '100 000', status: 'pending' },
    { id: 5, item: '100 Free Spins No Deposit', user: 'user_five', date: '05/10/2026, 19:27:42', value: '100 000', status: 'paid' },
    { id: 6, item: '50 Free Spins No Deposit', user: 'user_six', date: '04/10/2026, 23:55:10', value: '80 000', status: 'paid' },
    { id: 7, item: '50 Free Spins No Deposit', user: 'user_seven', date: '04/10/2026, 23:54:56', value: '80 000', status: 'paid' },
  ],
  giveaways: [
    { id: 1, item: 'Daily Giveaway Entry', user: 'user_eight', date: '05/10/2026, 20:00:03', value: '5 000', status: 'paid' },
    { id: 2, item: 'Weekly Raffle Ticket', user: 'user_nine', date: '05/10/2026, 18:12:44', value: '20 000', status: 'paid' },
    { id: 3, item: 'Weekly Raffle Ticket', user: 'user_ten', date: '05/10/2026, 17:03:19', value: '20 000', status: 'pending' },
  ],
};

const LINKS = {
  twitch: 'https://twitch.tv/jralha_',
  kick: 'https://kick.com/jralha_',
  instagram: 'https://instagram.com/jotaralha7',
  clips: 'https://instagram.com/clipsdoralha',
  discord: '#',
  telegram: '#',
};

const COMMUNITY = [
  { id: 1, icon: 'tv', name: 'Twitch', meta: 'jralha_', cta: 'Follow', url: LINKS.twitch },
  { id: 2, icon: 'play', name: 'Kick', meta: 'jralha_', cta: 'Follow', url: LINKS.kick },
  { id: 3, icon: 'camera', name: 'Instagram', meta: '@jotaralha7', cta: 'Follow', url: LINKS.instagram },
  { id: 4, icon: 'camera', name: 'Instagram clips', meta: '@clipsdoralha', cta: 'Follow', url: LINKS.clips },
  { id: 5, icon: 'chat', name: 'Discord', meta: '4,000+ members', cta: 'Join', url: LINKS.discord },
  { id: 6, icon: 'send', name: 'Telegram', meta: 'Announcements', cta: 'Join', url: LINKS.telegram },
];

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
  const [tab, setTab] = useState('shop');
  const [offers, setOffers] = useState(OFFERS.slice(0, 3));

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
  }, []);

  const [shopFeed, setShopFeed] = useState(FEED.shop);

  useEffect(() => {
    supabase
      .from('shop_redeems')
      .select('*, shop_products(name)')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (error || !data || !data.length) return;
        setShopFeed(
          data.map((r) => ({
            id: r.id,
            item: r.shop_products?.name || 'Redeem',
            user: r.twitch_username,
            date: new Date(r.created_at).toLocaleString('pt-PT'),
            value: Number(r.cost_at_redeem || 0).toLocaleString('pt-PT'),
            status: String(r.status || 'pending').toLowerCase(),
          }))
        );
      });
  }, []);

  const feedRows = tab === 'shop' ? shopFeed : FEED.giveaways;
  return (
    <>
          <section className="hero" aria-label="Featured">
            <article className="hc a">
              <h2>#1 Casino Streamer in Portugal</h2>
              <p>Bonus hunts, giveaways and slots, almost every day.</p>
              <div className="act">
                <Round />
                <a className="pill live" href={LINKS.twitch} target="_blank" rel="noopener noreferrer"><span className="dot" />Watch now</a>
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
              {offers.map((o) => <OfferRow key={o.id} o={o} />)}
            </div>
          </section>

          <section>
            <SectionHead icon="tv" title="Latest Videos" tag="YouTube" showAll="/stream" />
            <div className="vgrid">
              <a className="vbig" href="#">
                <div className={`th ${FEATURED_VIDEO.tone}`}>
                  {FEATURED_VIDEO.isNew && <span className="new">New</span>}
                  <svg><use href="#play" /></svg>
                </div>
                <p>{FEATURED_VIDEO.title}</p>
                <small>{FEATURED_VIDEO.age}</small>
              </a>
              <div className="vl">
                {VIDEOS.map((v) => (
                  <a key={v.id} className="vi" href="#">
                    <div className={`th ${v.tone}`}><svg><use href="#play" /></svg></div>
                    <div>
                      <p>{v.title}</p>
                      <small>{v.age}</small>
                    </div>
                  </a>
                ))}
              </div>
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
              <button role="tab" aria-selected={tab === 'shop'} className={`tb${tab === 'shop' ? ' on' : ''}`} onClick={() => setTab('shop')}>
                <Icon name="bag" />Shop
              </button>
              <button role="tab" aria-selected={tab === 'giveaways'} className={`tb${tab === 'giveaways' ? ' on' : ''}`} onClick={() => setTab('giveaways')}>
                <Icon name="gift" />Giveaways &amp; Raffles
              </button>
            </div>
            <div className="feed">
              <div className="ah">
                <span>Redeems</span>
                <span>Username</span>
                <span className="dt">Date</span>
                <span className="val">Value</span>
                <span>Status</span>
              </div>
              {feedRows.map((r) => (
                <div key={r.id} className="ar">
                  <span className="rd"><i />{r.item}</span>
                  <b>{r.user}</b>
                  <span className="dt">{r.date}</span>
                  <span className="val">- {r.value} PTS <span className="coin" /></span>
                  <span className={`stt ${r.status}`}>{r.status}</span>
                </div>
              ))}
            </div>
          </section>
        
    </>
  );
}
