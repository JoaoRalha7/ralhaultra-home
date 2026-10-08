// Run in the browser console on jralha.com, logged in as the streamer (admin).
// 1) dry run:  await importWatch(true)     2) real import:  await importWatch(false)
async function importWatch(dry = true) {
  const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k))
  const token = JSON.parse(localStorage.getItem(key)).access_token
  const base = 'https://ralha-points.jppralha.workers.dev'
  let offset = 0, total = 0
  for (let i = 0; i < 50; i++) {
    const r = await fetch(`${base}/admin/import-se-watch?offset=${offset}${dry ? '&dry=1' : ''}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const d = await r.json()
    console.log(d)
    if (!d.ok) return
    total += d.users
    if (d.next == null || dry) break
    offset = d.next
  }
  console.log(dry ? 'dry run done' : `import done, ${total} users`)
}
