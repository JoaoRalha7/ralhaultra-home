import { PlayerModalHost } from './PlayerModal';
import SearchBox from './SearchBox';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon, IconSprite } from './Icon';
import AccountSetupOverlay from './AccountSetupOverlay';
import WelcomePopup from './WelcomePopup';
import { workerPost } from '../lib/points';
import AdminPanel from './AdminPanel';
import AgeVerification from './AgeVerification';
import DailyRewardsModal from './DailyRewardsModal';
import Footer from './Footer';
import LoginModal from './LoginModal';
import UserMenu from './UserMenu';
import RewardsPanel from './RewardsModal';
import { workerGet } from '../lib/vip';
import LiveVotePopup from './LiveVotePopup';
import { useAuth } from '../hooks/useAuth';
import { useStreamElementsPoints } from '../hooks/useStreamElementsPoints';
import { supabase, supabaseDash } from '../lib/supabase';

const NAV_GROUPS = [
  { label: 'Discover', items: [['home', 'Home', '/', 'blue'], ['tag', 'Casinos & Offers', '/offers', 'green'], ['trophy', 'Leaderboard', '/leaderboard', 'gold']] },
  { label: 'Rewards', items: [['crown', 'VIP', '/vip', 'gold'], ['gift', 'Giveaways & Raffles', '/giveaways', 'pink'], ['bag', 'Shop', '/shop', 'violet']] },
  { label: 'Casino', items: [['originals', 'Originals', '/originals', 'orange']] },
  {
    label: 'Stream',
    items: [
      ['slots', 'Slots', '/slots', 'cyan'],
      ['spark', 'Bonus Hunts', '/bonus-hunts', 'gold'],
      ['ball', 'Tournaments', '/torneios', 'green'],
      ['pulse', 'Stats', '/stats', 'blue'],
      ['play', 'Stream', '/stream', 'red'],
      ['users', 'Community', '/community', 'violet'],
    ],
  },
];

const ORIGINAL_GAMES = [
  ['mines', 'Mines', '/mines', '#10b981'],
  ['cards', 'Blackjack', '/blackjack', '#f5c542'],
  ['crash', 'Crash', '/crash', '#8b5cf6'],
  ['keno', 'Keno', '/keno', '#ec4899'],
  ['plinko', 'Plinko', '/plinko', '#22d3ee'],
  ['roulette', 'Roulette', '/roulette', '#e11d48'],
  ['jackpot', 'Jackpot', '/jackpot', '#f97316'],
];

const ORIGINAL_PATHS = ['/originals', '/mines', '/blackjack', '/crash', '/keno', '/plinko', '/roulette', '/jackpot'];

const GAMES = [
  ['pick_games', 'Pick & Win', 'pick'],
  ['gtb_games', 'Guess the Balance', 'gtb'],
  ['avg_multi_games', 'Avg Multi', 'avg'],
];

function Avatar({ src }) {
  const [bad, setBad] = useState(false)
  return src && !bad
    ? <img className="av" src={src} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} />
    : <div className="av" aria-hidden="true" />
}

export default function Layout() {
  const { user, profile, isAdmin, isSettingUp, signOut } = useAuth();
  const { points, setPoints, refresh } = useStreamElementsPoints(profile?.twitch_username || user?.user_metadata?.full_name, { poll: 10000 });
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  // welcome popup: right after the "Setting up your account" screen, on every login (the first one says "Welcome to", the next ones "Welcome back")
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeFirst, setWelcomeFirst] = useState(false);
  const wasSettingUp = useRef(false);
  useEffect(() => {
    if (isSettingUp) { wasSettingUp.current = true; return; }
    if (!wasSettingUp.current || !user) return;
    wasSettingUp.current = false;
    workerPost('/welcome').then(({ ok, data }) => { setWelcomeFirst(!!(ok && data?.first)); setWelcomeOpen(true); }).catch(() => setWelcomeOpen(true));
  }, [isSettingUp, user]);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [dailyReady, setDailyReady] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [live, setLive] = useState([]);
  const [navLive, setNavLive] = useState({});
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [claimable, setClaimable] = useState([]);
  const [ageOk, setAgeOk] = useState(false);
  const [votePop, setVotePop] = useState(false);
  const liveSig = (l) => l.map((g) => `${g.view}:${g.huntId}`).join('|');
  const voteSeen = (l) => { try { return sessionStorage.getItem('ru-vote-seen') === liveSig(l); } catch { return false; } };
  const location = useLocation();
  const [open, setOpen] = useState(() => {
    if (window.innerWidth <= 820) return false;
    try {
      const saved = localStorage.getItem('ru-sidebar');
      if (saved !== null) return saved === 'open';
    } catch {
      /* storage unavailable */
    }
    return window.innerWidth > 820;
  });

  useEffect(() => {
    if (window.innerWidth <= 820) setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (window.innerWidth <= 820) return;
    try {
      localStorage.setItem('ru-sidebar', open ? 'open' : 'closed');
    } catch {
      /* storage unavailable */
    }
  }, [open]);

  useEffect(() => {
    if (user) setLoginOpen(false);
  }, [user]);

  // Daily rewards: highlight the gift button when the daily claim or the wheel is available
  useEffect(() => {
    if (!user?.id) { setDailyReady(false); return undefined; }
    let alive = true;
    const check = () => {
      supabase.from('profiles').select('last_daily_claim, last_wheel_spin').eq('id', user.id).single()
        .then(({ data }) => {
          if (!alive) return;
          const ready = (t) => !t || Date.now() - new Date(t).getTime() >= 86400000;
          setDailyReady(ready(data?.last_daily_claim) || ready(data?.last_wheel_spin));
        })
        .catch(() => alive && setDailyReady(false));
    };
    check();
    const t = setInterval(check, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [user?.id, dailyOpen]);

  // Open mini-games: realtime + light polling, so no F5 is needed when the streamer starts one
  useEffect(() => {
    let alive = true;
    const load = () => Promise.all(GAMES.map(([table]) => supabaseDash.from(table).select('id, hunt_id').eq('status', 'open').limit(1))).then((res) => {
      if (alive) setLive(GAMES.map(([, name, view], i) => ({ name, view, huntId: res[i].data?.[0]?.hunt_id })).filter((_, i) => res[i].data && res[i].data.length));
    }, () => {});
    load();
    const ch = supabaseDash.channel('layout-open-games');
    GAMES.forEach(([table]) => ch.on('postgres_changes', { event: '*', schema: 'public', table }, load));
    ch.subscribe();
    const iv = setInterval(() => { if (!document.hidden) load(); }, 10000);
    return () => { alive = false; clearInterval(iv); supabaseDash.removeChannel(ch); };
  }, []);

  // Level-up rewards waiting to be claimed (shown in the bell)
  useEffect(() => {
    if (!user?.id) { setClaimable([]); return undefined; }
    let alive = true;
    const check = () => workerGet('/vip').then((d) => {
      if (!alive || !d?.me) return;
      const done = new Set(d.me.claimed || []);
      setClaimable((d.levels || []).filter((l) => l.level > 0 && l.level <= d.me.level && Number(l.levelup_reward) > 0 && !done.has(l.level)));
    });
    check();
    const iv = setInterval(() => { if (!document.hidden) check(); }, 90000);
    return () => { alive = false; clearInterval(iv); };
  }, [user?.id, rewardsOpen]);

  // Sidebar LIVE tags: live bonus hunt, open giveaway, active tournament
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const nowIso = new Date().toISOString();
      const [h, g, t] = await Promise.all([
        supabaseDash.from('bonus_hunts').select('id').eq('active', true).limit(1).then(async (r) => {
          const id = r.data?.[0]?.id;
          if (!id) return { data: [] };
          // a hunt whose bonuses are all opened is finished, not live
          const [any, pend] = await Promise.all([
            supabaseDash.from('bonus_entries').select('id', { count: 'exact', head: true }).eq('hunt_id', id),
            supabaseDash.from('bonus_entries').select('id', { count: 'exact', head: true }).eq('hunt_id', id).eq('opened', false),
          ]);
          return { data: !any.count || pend.count > 0 ? [{ id }] : [] };
        }),
        supabase.from('giveaways').select('id').eq('status', 'active').gt('ends_at', nowIso).limit(1),
        supabaseDash.from('tournaments').select('id').eq('status', 'active').limit(1),
      ].map((p) => p.then((r) => !!r.data?.length, () => false)));
      if (alive) setNavLive({ '/bonus-hunts': h, '/giveaways': g, '/torneios': t });
    };
    check();
    const ch = supabaseDash.channel('layout-nav-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_hunts' }, check)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_entries' }, check)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, check)
      .subscribe();
    const iv = setInterval(() => { if (!document.hidden) check(); }, 15000);
    return () => { alive = false; clearInterval(iv); supabaseDash.removeChannel(ch); };
  }, []);

  // Invite visitors to vote when a bonus hunt minigame is open (once per session, after other popups)
  useEffect(() => {
    if (!ageOk || !live.length || voteSeen(live) || location.pathname.startsWith('/bonus-hunts')) return undefined;
    const t0 = Date.now();
    const wait = location.pathname === '/' ? 2600 : 1200;
    const id = setInterval(() => {
      if (Date.now() - t0 < wait) return;
      if (document.querySelector('.fmOverlay')) return;
      clearInterval(id);
      setVotePop(true);
    }, 300);
    return () => clearInterval(id);
  }, [ageOk, live, location.pathname]);

  const closeVote = () => {
    setVotePop(false);
    try { sessionStorage.setItem('ru-vote-seen', liveSig(live)); } catch { /* storage unavailable */ }
  };
  const goVote = (g) => {
    closeVote();
    navigate('/bonus-hunts', { state: { huntId: g.huntId, view: g.view } });
  };

  const notifCount = live.length + claimable.length + (user && dailyReady ? 1 : 0);

  return (
    <>
      <IconSprite />
      <PlayerModalHost />
      <AgeVerification onVerified={() => setAgeOk(true)} />
      <div className={`app${open ? '' : ' collapsed'}`}>
        <header className="top">
          <button className="menu-btn" aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <Icon name="menu" />
          </button>
          <Link className="logo" to="/" aria-label="JRALHA"><img className="logoImg" src="/assets/logo-jralha-beta.png" alt="JRALHA Beta" /></Link>
          <SearchBox />
          <div className="sp" />
          {points !== null && <div className="pts"><span className="coin" />{points.toLocaleString('pt-PT')}</div>}
          <div className="topR">
            {user && (
              <button className={`bell${dailyReady ? ' dailyReady' : ''}`} aria-label={dailyReady ? 'Daily rewards - ready to claim' : 'Daily rewards'} title={dailyReady ? 'Rewards ready to claim!' : 'Daily rewards'} onClick={() => setDailyOpen(true)}><Icon name="gift" />{dailyReady && <b className="dailyDot" />}</button>
            )}
            <div className="bellwrap">
              <button className="bell" aria-label="Notifications" aria-expanded={bellOpen} onClick={() => setBellOpen((v) => !v)}>
                <Icon name="bell" />
                {notifCount > 0 && <i>{notifCount}</i>}
              </button>
              {bellOpen && (
                <div className="drop" role="menu">
                  {notifCount === 0 ? (
                    <p className="dropEmpty">You are all caught up.</p>
                  ) : (
                    <>
                      {user && dailyReady && (
                        <button type="button" className="dropItem" onClick={() => { setBellOpen(false); setDailyOpen(true); }}>Daily reward ready<span className="chip">Claim</span></button>
                      )}
                      {claimable.map((l) => (
                        <button type="button" key={l.level} className="dropItem" onClick={() => { setBellOpen(false); setRewardsOpen(true); }}>Rank reward: {l.name}<span className="chip">+{Number(l.levelup_reward).toLocaleString('en-US')}</span></button>
                      ))}
                      {live.map(({ name, view, huntId }) => (
                        <Link key={view} to="/bonus-hunts" state={{ huntId, view }} onClick={() => setBellOpen(false)}>{name} open<span className="chip">Live</span></Link>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            {isAdmin() && <button className="pill adminBtn" onClick={() => setAdminOpen(true)}>Admin</button>}
            {user ? (
              <>
                <UserMenu
                  src={profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
                  name={profile?.twitch_username || user?.user_metadata?.full_name || user?.user_metadata?.name || 'Account'}
                  userId={user.id}
                  onLogout={signOut}
                />
              </>
            ) : (
              <button className="logout login" onClick={() => setLoginOpen(true)}>Login</button>
            )}
          </div>
        </header>

        {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
        <nav className="mnav" aria-label="Main navigation">
          <button type="button" className={open ? 'on' : ''} aria-expanded={open} onClick={() => setOpen((v) => !v)}><Icon name="menu" /><span>Menu</span></button>
          <NavLink to="/leaderboard"><Icon name="trophy" /><span>Leaderboard</span></NavLink>
          <NavLink to="/offers"><Icon name="tag" /><span>Casinos</span></NavLink>
          <NavLink to="/shop"><Icon name="bag" /><span>Shop</span></NavLink>
          <NavLink to="/giveaways"><Icon name="gift" /><span>Giveaways</span></NavLink>
        </nav>
        <aside>
          {NAV_GROUPS.map((group) => (
            <div className="grp" key={group.label}>
              <div className="grpTitle">{group.label}</div>
              {group.items.map(([icon, label, to, tone]) => {
                const inOrig = to === '/originals' && ORIGINAL_PATHS.some((p) => location.pathname.startsWith(p));
                return (
                  <div key={to} className="navItem">
                    <NavLink to={to} end={to === '/'} title={label} aria-label={label} data-tone={tone} className={({ isActive }) => `nav${isActive || inOrig ? ' on' : ''}`}>
                      <span className="ico"><Icon name={icon} /></span>
                      <span className="lbl">{label}</span>
                      {navLive[to] && (to === '/giveaways' ? <span className="liveDotOnly" title="Live" /> : <span className="liveTag"><i />Live</span>)}
                    </NavLink>
                    {inOrig && (
                      <div className="subnav">
                        {ORIGINAL_GAMES.map(([gi, gl, gt, gc]) => (
                          <NavLink key={gt} to={gt} className={({ isActive }) => `sub${isActive ? ' on' : ''}`} style={{ '--c': gc }}>
                            <Icon name={gi} />
                            <span>{gl}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {user && <button type="button" className="drawerOut" onClick={signOut}>Logout</button>}
        </aside>

        <main>
          <Outlet />
          <Footer />
        </main>
      </div>

      {votePop && live.length > 0 && <LiveVotePopup games={live} onGo={goVote} onClose={closeVote} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      <RewardsPanel open={rewardsOpen} onClose={() => setRewardsOpen(false)} />
      {dailyOpen && <DailyRewardsModal onClose={() => setDailyOpen(false)} onPointsUpdate={() => refresh?.()} />}
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
      {isSettingUp && <AccountSetupOverlay />}
      {welcomeOpen && <WelcomePopup first={welcomeFirst} onClose={() => setWelcomeOpen(false)} />}
    </>
  );
}
