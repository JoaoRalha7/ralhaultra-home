// Single source of truth for the big text of an offer card / popup.
// New casinos store it in casino_info.offer = { big, label, sub }.
// Older casinos fall back to Feature 1/2 and then to the Welcome Bonus tiers.
export const txt = (x) => {
  if (x == null) return '';
  if (typeof x === 'object') {
    const known = x.value ?? x.title ?? x.text ?? x.label ?? x.name ?? x.feature;
    if (known != null) return txt(known);
    const first = Object.values(x).find((v) => typeof v === 'string' && v.trim());
    return first ? first.trim() : '';
  }
  return String(x).trim();
};

const NUM_SPLIT = /^(\d+\s?%?|€\s?\d[\d.,]*)\s+(.*)$/;

export function legacyOffer(c = {}) {
  const f = Array.isArray(c.features) ? c.features : [];
  const b = Array.isArray(c.welcome_bonus) ? c.welcome_bonus[0] || {} : {};
  const f0 = txt(f[0]);
  const f1 = txt(f[1]);
  if (f0) {
    const m = f0.match(NUM_SPLIT);
    return m ? { big: m[1], label: m[2], sub: f1 } : { big: f0, label: '', sub: f1 };
  }
  const pct = txt(b.pct);
  const upTo = txt(b.up_to).replace(/^up\s*to\s*/i, '');
  const fs = txt(b.fs);
  if (pct) return { big: pct, label: 'Welcome bonus', sub: [upTo && `Up to ${upTo}`, fs && `+ ${fs}`].filter(Boolean).join(' ') };
  if (fs) {
    const m = fs.match(/^(\d+)\s*(.*)$/);
    return m ? { big: m[1], label: 'Free spins', sub: f1 } : { big: fs, label: '', sub: f1 };
  }
  return { big: '', label: '', sub: f1 };
}

export function offerOf(c = {}) {
  const o = c.casino_info?.offer;
  if (o && (txt(o.big) || txt(o.label) || txt(o.sub))) return { big: txt(o.big), label: txt(o.label), sub: txt(o.sub) };
  return legacyOffer(c);
}
