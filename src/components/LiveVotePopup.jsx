import { useEffect } from 'react';
import { Icon } from './Icon';

const ICONS = { pick: 'spark', gtb: 'wallet', avg: 'pulse' };
const SHORT = { pick: 'Pick & Win', gtb: 'GTB', avg: 'AVG' };

export default function LiveVotePopup({ games, onGo, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const names = games.map((g) => SHORT[g.view] || g.name);
  const joined = names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names[0];

  return (
    <div className="lvOverlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Bonus hunt voting">
      <div className="lvCard" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="lvX" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <span className="lvLive"><i />Voting live now</span>
        <h2>Bonus hunt needs your vote</h2>
        <p>{joined} {games.length > 1 ? 'are' : 'is'} open. Lock in your prediction before voting closes.</p>
        <div className="lvTiles" data-n={games.length}>
          {games.map((g) => (
            <button type="button" key={g.view} className="lvTile" onClick={() => onGo(g)}>
              <Icon name={ICONS[g.view] || 'spark'} size={22} />
              <b>{SHORT[g.view] || g.name}</b>
            </button>
          ))}
        </div>
        <button type="button" className="lvCta" onClick={() => onGo(games[0])}>
          Vote on {joined}<Icon name="right" size={14} />
        </button>
        <button type="button" className="lvLater" onClick={onClose}>Maybe later</button>
      </div>
    </div>
  );
}
