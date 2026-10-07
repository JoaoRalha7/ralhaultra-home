import { useState } from 'react';
import { Icon } from './Icon';

function Chip({ icon, label, value }) {
  return (
    <div className="oChip">
      <Icon name={icon} />
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

export default function OfferRow({ o, rank, onClaim, onInfo }) {
  const [copied, setCopied] = useState(false);
  const hasCode = o.code && o.code !== '-';
  const m = String(o.headline || '').match(/^(\d+\s?%?|€\s?\d[\d.,]*)\s+(.*)$/);
  const big = o.big || (m ? m[1] : o.headline);
  const rest = o.big ? o.rest : (m ? m[2] : '');
  const isNum = o.big ? String(o.big).length <= 8 : Boolean(m);
  const tag = o.badge ? o.badge : rank === 1 ? 'TOP PICK' : null;
  const copy = () => {
    try { navigator.clipboard.writeText(String(o.code)); } catch { /* clipboard unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const spot = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <article className="oc2" style={{ '--ac': o.accent, '--c1': o.c1, '--c2': o.c2 }} onPointerMove={spot}>
      <div className="oSparks" aria-hidden="true">
        {[8, 22, 37, 52, 66, 80, 92].map((l, i) => <i key={l} style={{ left: `${l}%`, animationDelay: `${(i * 1.3) % 6}s`, animationDuration: `${6 + (i % 3) * 2}s` }} />)}
      </div>
      {o.banner && <div className="oBg" style={{ backgroundImage: `url(${o.banner})` }} />}
      {tag && <span className="oTag"><i className="oDot" />{tag}</span>}
      <div className="oLogo">
        {o.logo ? <img src={o.logo} alt={o.brand} /> : <span>{o.brand}</span>}
      </div>
      <span className="oPill"><Icon name={o.freespins !== false ? 'spark' : 'gift'} />{o.freespins !== false ? 'Free spins' : 'Welcome bonus'}</span>
      <div className="oHero">
        {isNum && <span className="oGhost" aria-hidden="true">{big}</span>}
      <div className={`oBig${isNum ? '' : ' txt'}`}>{big}</div>
      {rest && <div className="oRest">{rest}</div>}
      {o.sub && <div className="oSub">{o.sub}</div>}
      </div>
      <div className="oTear" aria-hidden="true"><i /><i /></div>
      <div className="oChips">
        {(o.stats || [
          { key: 'd', icon: 'wallet', label: 'Min deposit', value: o.deposit },
          { key: 'w', icon: 'clock', label: 'Withdraw', value: o.withdraw },
          { key: 'l', icon: 'shield', label: 'License', value: o.license },
        ]).map((st) => <Chip key={st.key} icon={st.icon} label={st.label} value={st.value} />)}
      </div>
      {hasCode && (
        <button type="button" className={`oCode${copied ? ' done' : ''}`} onClick={copy}>
          <span><small>Promo code</small><b>{o.code}</b></span>
          <i><Icon name="tag" />{copied ? 'Copied' : 'Copy'}</i>
        </button>
      )}
      <div className="oSpacer" />
      <button type="button" className="oClaim" onClick={() => onClaim?.(o)}>Claim offer<Icon name="right" size={14} /></button>
      <button type="button" className="oMore" onClick={() => onInfo?.(o)}>More info<Icon name="right" size={13} /></button>
    </article>
  );
}
