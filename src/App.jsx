import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const BonusHunts = lazy(() => import('./pages/BonusHunts'));
const Blackjack = lazy(() => import('./pages/Blackjack'));
const Crash = lazy(() => import('./pages/Crash'));
const Keno = lazy(() => import('./pages/Keno'));
const Plinko = lazy(() => import('./pages/Plinko'));
const Roulette = lazy(() => import('./pages/Roulette'));
const Jackpot = lazy(() => import('./pages/Jackpot'));
const Originals = lazy(() => import('./pages/Originals'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
import Home from './pages/Home';
const Legal = lazy(() => import('./pages/Legal'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Vip = lazy(() => import('./pages/Vip'));
const Profile = lazy(() => import('./pages/Profile'));
import DevToolsGuard from './components/DevToolsGuard';
const MiniGame = lazy(() => import('./pages/MiniGame'));
const Mines = lazy(() => import('./pages/Mines'));
const MiniGameAvgMulti = lazy(() => import('./pages/MiniGameAvgMulti'));
const MiniGameGtb = lazy(() => import('./pages/MiniGameGtb'));
const MiniGamesLanding = lazy(() => import('./pages/MiniGamesLanding'));
const Offers = lazy(() => import('./pages/Offers'));
const Community = lazy(() => import('./pages/Community'));
const Placeholder = lazy(() => import('./pages/Placeholder'));
const Shop = lazy(() => import('./pages/Shop'));
const Giveaways = lazy(() => import('./pages/Giveaways'));
const Slots = lazy(() => import('./pages/Slots'));
const Stats = lazy(() => import('./pages/Stats'));
const Stream = lazy(() => import('./pages/Stream'));
const Torneios = lazy(() => import('./pages/Torneios'));

const BracketOverlay = lazy(() => import('./overlay/BracketOverlay'));
const ChatBox = lazy(() => import('./overlay/ChatBox'));
const OverlayBarra = lazy(() => import('./overlay/Barra'));
const OverlayHunting = lazy(() => import('./overlay/Hunting'));
const OverlayOpening = lazy(() => import('./overlay/Opening'));
const OverlayOverlay = lazy(() => import('./overlay/Overlay'));
const OverlaySlotStats = lazy(() => import('./overlay/SlotStats'));
const PickOverlay = lazy(() => import('./overlay/PickOverlay'));
const MinigamePlaying = lazy(() => import('./overlay/Minigameplaying'));
const OverlaySlotStatsH = lazy(() => import('./overlay/SlotStatsHorizontal'));
const TorneioOverlay = lazy(() => import('./overlay/Torneiooverlay'));

// OBS overlays: transparent page, no layout, no age check.
function Overlay({ page = false, children }) {
  useEffect(() => {
    document.body.classList.add('overlay-body');
    document.documentElement.classList.add('overlay-html');
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    return () => {
      document.body.classList.remove('overlay-body');
      document.documentElement.classList.remove('overlay-html');
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
    };
  }, []);
  return page ? <div className="overlay-page">{children}</div> : children;
}

// These pages navigate programmatically and expect a `navigate` prop.
function BonusHuntsPage() {
  const navigate = useNavigate();
  return <BonusHunts navigate={navigate} />;
}
function StatsPage() {
  const navigate = useNavigate();
  return <Stats navigate={navigate} />;
}

const SOON = [];

export default function App() {
  return (
    <>
    <DevToolsGuard />
    <Suspense fallback={null}>
    <Routes>
      <Route path="auth/callback" element={<AuthCallback />} />
      <Route path="dashboard/*" element={<Dashboard />} />

      <Route path="overlay/hunting" element={<Overlay page><OverlayHunting /></Overlay>} />
      <Route path="overlay/opening" element={<Overlay page><OverlayOpening /></Overlay>} />
      <Route path="overlay/hunt" element={<Overlay page><OverlayOverlay /></Overlay>} />
      <Route path="overlay/slotstats" element={<Overlay page><OverlaySlotStats /></Overlay>} />
      <Route path="overlay/slotstatsH" element={<Overlay page><OverlaySlotStatsH /></Overlay>} />
      <Route path="overlay/pick" element={<Overlay page><PickOverlay /></Overlay>} />
      <Route path="overlay/barra" element={<Overlay><OverlayBarra /></Overlay>} />
      <Route path="overlay/chatbox" element={<Overlay><ChatBox /></Overlay>} />
      <Route path="overlay/minigame" element={<Overlay><MinigamePlaying /></Overlay>} />
      <Route path="overlay/torneio" element={<Overlay><TorneioOverlay /></Overlay>} />
      <Route path="overlay/bracket" element={<Overlay><BracketOverlay /></Overlay>} />

      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="offers" element={<Offers />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="vip" element={<Vip />} />
        <Route path="profile" element={<Profile />} />
        <Route path="shop" element={<Shop />} />
        <Route path="giveaways" element={<Giveaways />} />
        <Route path="slots" element={<Slots />} />
        <Route path="bonus-hunts" element={<BonusHuntsPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="stream" element={<Stream />} />
        <Route path="torneios" element={<Torneios />} />
        <Route path="mini-games" element={<MiniGamesLanding />} />
        <Route path="mini-games/pick-win" element={<MiniGame />} />
        <Route path="mini-games/gtb" element={<MiniGameGtb />} />
        <Route path="mini-games/avg-multi" element={<MiniGameAvgMulti />} />
        <Route path="mines" element={<Mines />} />
        <Route path="blackjack" element={<Blackjack />} />
        <Route path="crash" element={<Crash />} />
        <Route path="keno" element={<Keno />} />
        <Route path="plinko" element={<Plinko />} />
        <Route path="roulette" element={<Roulette />} />
        <Route path="jackpot" element={<Jackpot />} />
        <Route path="originals" element={<Originals />} />
        <Route path="terms" element={<Legal />} />
        <Route path="privacy" element={<Legal />} />
        <Route path="cookies" element={<Legal />} />
        <Route path="rules" element={<Legal />} />
        <Route path="community" element={<Community />} />
        {SOON.map(([path, title]) => (
          <Route key={path} path={path} element={<Placeholder title={title} />} />
        ))}
        <Route path="*" element={<Placeholder title="Not found" />} />
      </Route>
    </Routes>
    </Suspense>
    </>
  );
}
