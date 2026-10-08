import { useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import AuthCallback from './pages/AuthCallback';
import BonusHunts from './pages/BonusHunts';
import Blackjack from './pages/Blackjack';
import Crash from './pages/Crash';
import Keno from './pages/Keno';
import Plinko from './pages/Plinko';
import Roulette from './pages/Roulette';
import Jackpot from './pages/Jackpot';
import Originals from './pages/Originals';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Legal from './pages/Legal';
import Leaderboard from './pages/Leaderboard';
import Vip from './pages/Vip';
import Profile from './pages/Profile';
import DevToolsGuard from './components/DevToolsGuard';
import MiniGame from './pages/MiniGame';
import Mines from './pages/Mines';
import MiniGameAvgMulti from './pages/MiniGameAvgMulti';
import MiniGameGtb from './pages/MiniGameGtb';
import MiniGamesLanding from './pages/MiniGamesLanding';
import Offers from './pages/Offers';
import Community from './pages/Community';
import Placeholder from './pages/Placeholder';
import Shop from './pages/Shop';
import Giveaways from './pages/Giveaways';
import Slots from './pages/Slots';
import Stats from './pages/Stats';
import Stream from './pages/Stream';
import Torneios from './pages/Torneios';

import BracketOverlay from './overlay/BracketOverlay';
import ChatBox from './overlay/ChatBox';
import OverlayBarra from './overlay/Barra';
import OverlayHunting from './overlay/Hunting';
import OverlayOpening from './overlay/Opening';
import OverlayOverlay from './overlay/Overlay';
import OverlaySlotStats from './overlay/SlotStats';
import PickOverlay from './overlay/PickOverlay';
import MinigamePlaying from './overlay/Minigameplaying';
import OverlaySlotStatsH from './overlay/SlotStatsHorizontal';
import TorneioOverlay from './overlay/Torneiooverlay';

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
    </>
  );
}
