// Builds the Featured popup content from the casino's own fields.
// Anything filled in the Featured tab overrides the automatic value.
const txt = (x) => {
  if (x == null) return '';
  if (typeof x === 'object') return txt(x.value ?? x.title ?? x.text ?? x.label ?? '');
  return String(x).trim();
};

export function autoFeatured(c = {}) {
  const b = Array.isArray(c.welcome_bonus) ? c.welcome_bonus[0] || {} : {};
  const f = Array.isArray(c.features) ? c.features : [];
  const ci = c.casino_info || {};
  const pct = txt(b.pct);
  const upTo = txt(b.up_to);
  const fs = txt(b.fs);

  let amount = '';
  if (pct && upTo) amount = `${pct} up to ${upTo}`;
  else if (pct) amount = pct;
  else if (fs) amount = fs;
  else amount = txt(f[0]);

  const title = c.is_freespins && !pct ? 'Free spins' : c.promo_required ? 'Exclusive bonus' : 'Welcome bonus';

  const chips = [];
  if (pct && fs) chips.push(`+ ${fs}`);
  if (txt(ci.min_deposit)) chips.push(`Min deposit ${txt(ci.min_deposit)}`);
  if (txt(ci.withdraw)) chips.push(`Withdraw ${txt(ci.withdraw)}`);
  if (txt(f[1])) chips.push(txt(f[1]));
  if (c.kyc_required === false) chips.push('No KYC');

  return { title, amount, details: chips.join(' · '), accent: '#3b82f6' };
}

export function featuredOf(c = {}) {
  const a = autoFeatured(c);
  return {
    title: txt(c.featured_offer_title) || a.title,
    amount: txt(c.featured_offer_amount) || a.amount,
    details: txt(c.featured_offer_details) || a.details,
    accent: txt(c.featured_accent_color) || a.accent,
  };
}
