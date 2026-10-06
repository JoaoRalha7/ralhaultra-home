import { Icon } from './Icon';

function Stat({ icon, label, value }) {
  return (
    <div className="st">
      <span className="ic"><Icon name={icon} /></span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
      </div>
    </div>
  );
}

export default function OfferRow({ o, onClaim, onInfo }) {
  return (
    <article className="oc" style={{ '--ac': o.accent }}>
      <div
        className="bn"
        style={{
          background: o.banner
            ? `linear-gradient(90deg, rgba(0,0,0,.82), rgba(0,0,0,.1)), url(${o.banner}) center / cover`
            : `radial-gradient(90% 90% at 85% 40%, ${o.c2}, transparent 70%), ${o.c1}`,
        }}
      >
        <div className="badges">
          {o.badge && <span className={`bd b-${o.badge.toLowerCase()}`}>{o.badge}</span>}
          {o.freespins !== false && <span className="bd b-fs">Free spins</span>}
        </div>
        <small>Claim the</small>
        <h3>{o.headline}</h3>
        <div className="sub">{o.sub}</div>
        {o.logo ? <img className="brandLogo" src={o.logo} alt={o.brand} /> : <span className="brand">{o.brand}</span>}
      </div>
      <div className="stats">
        <Stat icon="wallet" label="Min deposit" value={o.deposit} />
        <Stat icon="gift" label="Bonus" value={o.bonus} />
        <Stat icon="spark" label="Free spins" value={o.spins} />
        <Stat icon="clock" label="Withdraw" value={o.withdraw} />
        <Stat icon="shield" label="License" value={o.license} />
        <Stat icon="tag" label="Code" value={o.code} />
      </div>
      <div className="btns">
        <button type="button" className="btn-claim" onClick={() => onClaim?.(o)}>Claim offer<Icon name="right" size={12} /></button>
        <button type="button" className="btn-more" onClick={() => onInfo?.(o)}>More info<Icon name="right" size={12} /></button>
      </div>
    </article>
  );
}

