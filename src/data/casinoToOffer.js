import { pickStats } from './offerStats';
export const PALETTE = [
  ['#2ee6a6', '#04251e', '#0b4a3c'], // emerald
  ['#f5c542', '#241a02', '#5e4508'], // gold
  ['#38bdf8', '#06192e', '#0d3f66'], // sky
  ['#ff8a2b', '#2a1204', '#6b3208'], // orange
  ['#ef4444', '#2a0808', '#6b1414'], // red
  ['#ec4899', '#2a0818', '#6b1442'], // pink
  ['#a855f7', '#1a0b2e', '#44207a'], // violet
  ['#6366f1', '#0d0f2e', '#262a7a'], // indigo
  ['#14b8a6', '#04201e', '#0b4f4a'], // teal
  ['#a3e635', '#14200a', '#3b560f'], // lime
  ['#e2e8f0', '#12151b', '#2c3440'], // silver
];
export const PALETTE_NAMES = ['Emerald', 'Gold', 'Sky', 'Orange', 'Red', 'Pink', 'Violet', 'Indigo', 'Teal', 'Lime', 'Silver'];

// DB values may be strings or small objects like { title, value }; always return plain text.
const txt = (x) => {
  if (x == null) return '';
  if (typeof x === 'object') {
    const known = x.value ?? x.title ?? x.text ?? x.label ?? x.name ?? x.feature;
    if (known != null) return txt(known);
    const first = Object.values(x).find((v) => typeof v === 'string' && v.trim());
    return first ? first.trim() : '';
  }
  return String(x);
};

// Maps a row of the `casinos` table to the props OfferRow expects.
function bonusParts(c, f) {
  const b = Array.isArray(c.welcome_bonus) ? c.welcome_bonus[0] || {} : {};
  const pct = txt(b.pct);
  const upTo = txt(b.up_to).replace(/^up\s*to\s*/i, '');
  const fs = txt(b.fs);
  if (pct) return { big: pct, rest: 'Welcome bonus', sub: [upTo && `Up to ${upTo}`, fs && `+ ${fs}`].filter(Boolean).join(' ') };
  if (fs) {
    const m = fs.match(/^(\d+)\s*(.*)$/);
    return m ? { big: m[1], rest: 'Free spins', sub: txt(f[0]) } : { big: fs, rest: '', sub: txt(f[0]) };
  }
  return null;
}

export function casinoToOffer(c, i = 0) {
  const pick = Number.isInteger(c.casino_info?.card_color) && PALETTE[c.casino_info.card_color] ? c.casino_info.card_color : i % 3;
  const [accent, c1, c2] = PALETTE[pick];
  const f = Array.isArray(c.features) ? c.features : [];
  const ci = c.casino_info || {};
  const bp = txt(f[0]) ? null : bonusParts(c, f);
  return {
    stats: pickStats(c),
    big: bp?.big || '',
    rest: bp?.rest || '',
    id: c.id,
    raw: c,
    brand: txt(c.name),
    logo: c.logo_url,
    banner: c.banner_url,
    badge: c.is_hot ? 'HOT' : c.is_new ? 'NEW' : null,
    freespins: Boolean(c.is_freespins),
    accent,
    c1,
    c2,
    headline: txt(f[0]) || txt(c.name),
    sub: bp ? bp.sub : txt(f[1]),
    deposit: txt(ci.min_deposit) || '-',
    bonus: txt(f[0]) || '-',
    spins: c.is_freespins ? 'Yes' : '-',
    withdraw: txt(ci.withdraw) || '-',
    license: txt(ci.license) || '-',
    code: txt(c.promo_code) || '-',
    url: c.claim_url,
  };
}
