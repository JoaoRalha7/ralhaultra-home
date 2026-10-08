import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon, IconSprite } from './Icon';
import AccountSetupOverlay from './AccountSetupOverlay';
import AdminPanel from './AdminPanel';
import AgeVerification from './AgeVerification';
import DailyRewardsModal from './DailyRewardsModal';
import Footer from './Footer';
import LoginModal from './LoginModal';
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
  const { points, setPoints, refresh } = useStreamElementsPoints(profile?.twitch_username || user?.user_metadata?.full_name, { poll: 30000 });
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [dailyReady, setDailyReady] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [live, setLive] = useState([]);
  const [ageOk, setAgeOk] = useState(false);
  const [votePop, setVotePop] = useState(false);
  const voteSeen = () => { try { return sessionStorage.getItem('ru-vote-seen') === '1'; } catch { return false; } };
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

  useEffect(() => {
    let alive = true;
    Promise.all(GAMES.map(([table]) => supabaseDash.from(table).select('id, hunt_id').eq('status', 'open').limit(1))).then((res) => {
      if (alive) setLive(GAMES.map(([, name, view], i) => ({ name, view, huntId: res[i].data?.[0]?.hunt_id })).filter((_, i) => res[i].data && res[i].data.length));
    });
    return () => {
      alive = false;
    };
  }, []);

  // Invite visitors to vote when a bonus hunt minigame is open (once per session, after other popups)
  useEffect(() => {
    if (!ageOk || !live.length || voteSeen() || location.pathname.startsWith('/bonus-hunts')) return undefined;
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
    try { sessionStorage.setItem('ru-vote-seen', '1'); } catch { /* storage unavailable */ }
  };
  const goVote = (g) => {
    closeVote();
    navigate('/bonus-hunts', { state: { huntId: g.huntId, view: g.view } });
  };

  const onSearch = (e) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      navigate(`/slots?q=${encodeURIComponent(e.currentTarget.value.trim())}`);
    }
  };

  return (
    <>
      <IconSprite />
      <AgeVerification onVerified={() => setAgeOk(true)} />
      <div className={`app${open ? '' : ' collapsed'}`}>
        <header className="top">
          <button className="menu-btn" aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <Icon name="menu" />
          </button>
          <Link className="logo" to="/">Ralha<b>Ultra</b><span className="beta">BETA</span></Link>
          <label className="search">
            <Icon name="search" />
            <input placeholder="Search slots..." aria-label="Search slots" onKeyDown={onSearch} />
          </label>
          <div className="sp" />
          {points !== null && <div className="pts"><span className="coin" />{points.toLocaleString('pt-PT')}</div>}
          {user && (
            <button className={`bell${dailyReady ? ' dailyReady' : ''}`} aria-label={dailyReady ? 'Daily rewards - ready to claim' : 'Daily rewards'} title={dailyReady ? 'Rewards ready to claim!' : 'Daily rewards'} onClick={() => setDailyOpen(true)}><Icon name="gift" />{dailyReady && <b className="dailyDot" />}</button>
          )}
          <div className="bellwrap">
            <button className="bell" aria-label="Notifications" aria-expanded={bellOpen} onClick={() => setBellOpen((v) => !v)}>
              <Icon name="bell" />
              {live.length > 0 && <i>{live.length}</i>}
            </button>
            {bellOpen && (
              <div className="drop" role="menu">
                {live.length === 0 ? (
                  <p className="dropEmpty">No live games right now.</p>
                ) : (
                  live.map(({ name, view, huntId }) => (
                    <Link key={view} to="/bonus-hunts" state={{ huntId, view }} onClick={() => setBellOpen(false)}>{name}<span className="chip">Live</span></Link>
                  ))
                )}
              </div>
            )}
          </div>
          {isAdmin() && <button className="pill adminBtn" onClick={() => setAdminOpen(true)}>Admin</button>}
          {user ? (
            <>
              <Avatar src={profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture} />
              <button className="logout" onClick={signOut}>Logout</button>
            </>
          ) : (
            <button className="logout login" onClick={() => setLoginOpen(true)}>Login</button>
          )}
        </header>

        {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
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
      {dailyOpen && <DailyRewardsModal onClose={() => setDailyOpen(false)} onPointsUpdate={() => refresh?.()} />}
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
      {isSettingUp && <AccountSetupOverlay />}
    </>
  );
}
