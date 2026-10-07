// Stat chips that can be shown on an offer card. Admin picks which ones (casino_info.card_stats).
const txt = (x) => {
  if (x == null) return '';
  if (typeof x === 'object') return txt(x.value ?? x.title ?? x.text ?? x.label ?? '');
  return String(x).trim();
};

export const STAT_DEFS = [
  { key: 'min_deposit', label: 'Min deposit', icon: 'wallet', get: (c) => txt(c.casino_info?.min_deposit) },
  { key: 'withdraw', label: 'Withdraw', icon: 'clock', get: (c) => txt(c.casino_info?.withdraw) },
  { key: 'license', label: 'License', icon: 'shield', get: (c) => txt(c.casino_info?.license) },
  { key: 'cashback', label: 'Cashback', icon: 'gift', get: (c) => txt(c.casino_info?.cashback) },
  { key: 'min_withdrawal', label: 'Min withdrawal', icon: 'wallet', get: (c) => txt(c.min_withdrawal) },
  { key: 'games', label: 'Games', icon: 'slots', get: (c) => txt(c.casino_info?.games) },
  { key: 'established', label: 'Established', icon: 'cal', get: (c) => txt(c.casino_info?.established) },
  { key: 'support', label: 'Support', icon: 'chat', get: (c) => txt(c.support) },
  { key: 'kyc', label: 'KYC', icon: 'shield', get: (c) => (c.kyc_required ? 'Required' : 'Not required') },
  { key: 'vpn', label: 'VPN', icon: 'users', get: (c) => (c.vpn_allowed === false ? 'Not allowed' : 'Allowed') },
];

export const DEFAULT_STATS = ['min_deposit', 'withdraw', 'license'];

export function selectedStatKeys(c) {
  const k = c?.casino_info?.card_stats;
  return Array.isArray(k) ? k : DEFAULT_STATS;
}

export function pickStats(c) {
  const keys = selectedStatKeys(c);
  return STAT_DEFS.filter((d) => keys.includes(d.key))
    .map((d) => ({ key: d.key, icon: d.icon, label: d.label, value: d.get(c) }))
    .filter((s) => s.value);
}
