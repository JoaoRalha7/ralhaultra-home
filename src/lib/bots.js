// Chat/system bots that must never appear in leaderboards.
export const BOT_NAMES = new Set(['nightbot', 'streamelements', 'wizebot', 'moobot', 'fossabot', 'streamlabs'])
export const isBot = (u) => BOT_NAMES.has(String(u?.username || u || '').toLowerCase())
