// Daily rewards reset at 00:00 Europe/Lisbon.
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

function sinceMidnight(ms) {
  const o = {}
  for (const x of fmt.formatToParts(new Date(ms))) o[x.type] = x.value
  return ((Number(o.hour) % 24) * 3600 + Number(o.minute) * 60 + Number(o.second)) * 1000
}

export const msToReset = (ms = Date.now()) => Math.max(1000, 86400000 - sinceMidnight(ms))
// true when the timestamp is from today (Lisbon), i.e. already used until midnight
export const doneToday = (t, ms = Date.now()) => !!t && new Date(t).getTime() >= ms - sinceMidnight(ms)
