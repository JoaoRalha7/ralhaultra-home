const PALETTE = [
  ['#2ee6a6', '#04251e', '#0b4a3c'],
  ['#f5c542', '#241a02', '#5e4508'],
  ['#38bdf8', '#06192e', '#0d3f66'],
];

// DB values may be strings or small objects like { title, value }; always return plain text.
const txt = (x) => {
  if (x == null) return '';
  if (typeof x === 'object') return txt(x.value ?? x.title ?? x.text ?? x.label ?? '');
  return String(x);
};

// Maps a row of the `casinos` table to the props OfferRow expects.
export function casinoToOffer(c, i = 0) {
  const [accent, c1, c2] = PALETTE[i % PALETTE.length];
  const f = Array.isArray(c.features) ? c.features : [];
  const ci = c.casino_info || {};
  return {
    id: c.id,
    brand: txt(c.name),
    logo: c.logo_url,
    banner: c.banner_url,
    badge: c.is_hot ? 'HOT' : c.is_new ? 'NEW' : null,
    freespins: Boolean(c.is_freespins),
    accent,
    c1,
    c2,
    headline: txt(f[0]) || txt(c.name),
    sub: txt(f[1]),
    deposit: txt(ci.min_deposit) || '-',
    bonus: txt(f[0]) || '-',
    spins: c.is_freespins ? 'Yes' : '-',
    withdraw: txt(ci.withdraw) || '-',
    license: txt(ci.license) || '-',
    code: txt(c.promo_code) || '-',
    url: c.claim_url,
  };
}
