import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import AuthCallback from './pages/AuthCallback';
import BonusHunts from './pages/BonusHunts';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import Offers from './pages/Offers';
import Placeholder from './pages/Placeholder';
import Shop from './pages/Shop';
import Slots from './pages/Slots';
import Stats from './pages/Stats';

const SOON = [
  ['giveaways', 'Giveaways & Raffles'],
  ['stream', 'Stream'],
  ['community', 'Community'],
  ['games', 'Mini-games'],
  ['torneios', 'Tournaments'],
  ['mini-games', 'Mini-Games'],
  ['pick-win', 'Pick & Win'],
  ['gtb', 'Guess the Balance'],
  ['avg-multi', 'Avg Multi'],
  ['terms', 'Terms of Service'],
  ['privacy', 'Privacy Policy'],
  ['cookies', 'Cookie Policy'],
];

export default function App() {
  return (
    <Routes>
      <Route path="auth/callback" element={<AuthCallback />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="offers" element={<Offers />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="shop" element={<Shop />} />
        <Route path="slots" element={<Slots />} />
        <Route path="bonus-hunts" element={<BonusHunts />} />
        <Route path="stats" element={<Stats />} />
        {SOON.map(([path, title]) => (
          <Route key={path} path={path} element={<Placeholder title={title} />} />
        ))}
        <Route path="*" element={<Placeholder title="Not found" />} />
      </Route>
    </Routes>
  );
}
