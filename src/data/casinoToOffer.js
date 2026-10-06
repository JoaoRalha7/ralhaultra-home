const PALETTE = [
  ['#2ee6a6', '#04251e', '#0b4a3c'],
  ['#f5c542', '#241a02', '#5e4508'],
  ['#38bdf8', '#06192e', '#0d3f66'],
];

// Maps a row of the `casinos` table to the props OfferRow expects.
export function casinoToOffer(c, i = 0) {
  const [accent, c1, c2] = PALETTE[i % PALETTE.length];
  const f = Array.isArray(c.features) ? c.features : [];
  const ci = c.casino_info || {};
  return {
    id: c.id,
    brand: c.name,
    logo: c.logo_url,
    banner: c.banner_url,
    badge: c.is_hot ? 'HOT' : c.is_new ? 'NEW' : null,
    freespins: Boolean(c.is_freespins),
    accent,
    c1,
    c2,
    headline: f[0] || c.name,
    sub: f[1] || '',
    deposit: ci.min_deposit || '-',
    bonus: f[0] || '-',
    spins: c.is_freespins ? 'Yes' : '-',
    withdraw: ci.withdraw || '-',
    license: ci.license || '-',
    code: c.promo_code || '-',
    url: c.claim_url,
  };
}
