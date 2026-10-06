import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon, IconSprite } from './Icon';
import AccountSetupOverlay from './AccountSetupOverlay';
import AdminPanel from './AdminPanel';
import AgeVerification from './AgeVerification';
import DailyRewardsModal from './DailyRewardsModal';
import Footer from './Footer';
import LoginModal from './LoginModal';
import { useAuth } from '../hooks/useAuth';
import { useStreamElementsPoints } from '../hooks/useStreamElementsPoints';
import { supabaseDash } from '../lib/supabase';

const NAV_GROUPS = [
  [['home', 'Home', '/'], ['tag', 'Casinos & Offers', '/offers'], ['trophy', 'Leaderboard', '/leaderboard']],
  [['gift', 'Giveaways & Raffles', '/giveaways'], ['bag', 'Shop', '/shop']],
  [['originals', 'Originals', '/originals']],
  [
    ['slots', 'Slots', '/slots'],
    ['spark', 'Bonus Hunts', '/bonus-hunts'],
    ['ball', 'Tournaments', '/torneios'],
    ['pulse', 'Stats', '/stats'],
    ['play', 'Stream', '/stream'],
    ['users', 'Community', '/community'],
  ],
];

const ORIGINAL_PATHS = ['/originals', '/mines', '/blackjack', '/crash', '/keno', '/plinko', '/roulette'];

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
  const { points, setPoints, refresh } = useStreamElementsPoints(profile?.twitch_username || user?.user_metadata?.full_name);
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [live, setLive] = useState([]);
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

  useEffect(() => {
    let alive = true;
    Promise.all(GAMES.map(([table]) => supabaseDash.from(table).select('id, hunt_id').eq('status', 'open').limit(1))).then((res) => {
      if (alive) setLive(GAMES.map(([, name, view], i) => ({ name, view, huntId: res[i].data?.[0]?.hunt_id })).filter((_, i) => res[i].data && res[i].data.length));
    });
    return () => {
      alive = false;
    };
  }, []);

  const onSearch = (e) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      navigate(`/slots?q=${encodeURIComponent(e.currentTarget.value.trim())}`);
    }
  };

  return (
    <>
      <IconSprite />
      <AgeVerification onVerified={() => {}} />
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
            <button className="bell" aria-label="Daily rewards" onClick={() => setDailyOpen(true)}><Icon name="gift" /></button>
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
          {NAV_GROUPS.map((group, gi) => (
            <div className="grp" key={gi}>
              {group.map(([icon, label, to]) => (
                <NavLink key={to} to={to} end={to === '/'} title={label} aria-label={label} className={({ isActive }) => `nav${isActive || (to === '/originals' && ORIGINAL_PATHS.some((p) => location.pathname.startsWith(p))) ? ' on' : ''}`}>
                  <Icon name={icon} />
                  <span className="lbl">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
          {user && <button type="button" className="drawerOut" onClick={signOut}>Logout</button>}
        </aside>

        <main>
          <Outlet />
          <Footer />
        </main>
      </div>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      {dailyOpen && <DailyRewardsModal onClose={() => setDailyOpen(false)} onPointsUpdate={() => refresh?.()} />}
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
      {isSettingUp && <AccountSetupOverlay />}
    </>
  );
}
