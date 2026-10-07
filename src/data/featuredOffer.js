import { PALETTE } from './casinoToOffer';
import { offerOf, txt } from './offerText';
// Builds the Featured popup content from the casino's own fields.
// Anything filled in the Featured tab overrides the automatic value.
export function autoFeatured(c = {}) {
  const ci = c.casino_info || {};
  const op = offerOf(c);
  const amount = [op.big, op.label].filter(Boolean).join(' ');
  const title = c.is_freespins && !/%/.test(op.big) ? 'Free spins' : c.promo_required ? 'Exclusive bonus' : 'Welcome bonus';
  const chips = [];
  if (op.sub) chips.push(op.sub);
  if (txt(ci.min_deposit)) chips.push(`Min deposit ${txt(ci.min_deposit)}`);
  if (txt(ci.withdraw)) chips.push(`Withdraw ${txt(ci.withdraw)}`);
  return { title, amount, details: chips.join(' · '), accent: PALETTE[ci.card_color]?.[0] || '#3b82f6' };
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
