import { useCallback, useEffect, useRef, useState } from 'react'
import { WORKER, workerPost } from '../lib/points'
import { derive, sha256hex } from '../lib/fair'
import { Gem, Bomb } from './MineIcons'
import styles from './ProvablyFair.module.css'

const GAMES = { mines: 'Mines', blackjack: 'Blackjack', keno: 'Keno', plinko: 'Plinko', roulette: 'Roulette', crash: 'Crash', jackpot: 'Jackpot' }
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
const short = (s) => (s ? `${s.slice(0, 8)}…${s.slice(-6)}` : '-')
const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('')

const CopyIc = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></svg>
const CheckIc = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.400" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.500l4.500 4.500L19 7" /></svg>
const Chev = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>

function CopyBox({ label, value }) {
  const [ok, setOk] = useState(false)
  return (
    <div className={styles.fld}>
      <span className={styles.lab}>{label}</span>
      <div className={styles.box}>
        <code>{value || '-'}</code>
        {value ? <button type="button" className={styles.ic} aria-label="Copy" onClick={() => { navigator.clipboard?.writeText(value).then(() => { setOk(true); setTimeout(() => setOk(false), 1200) }).catch(() => {}) }}>{ok ? <CheckIc /> : <CopyIc />}</button> : null}
      </div>
    </div>
  )
}

function Select({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const off = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [open])
  const cur = options.find((o) => o.v === value)
  return (
    <div className={styles.fld} ref={ref}>
      <span className={styles.lab}>{label}</span>
      <button type="button" className={styles.sel} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}><b>{cur?.l ?? (value === '' ? 'Select' : value)}</b><Chev /></button>
      {open && (
        <ul className={styles.list} role="listbox">
          {options.map((o) => <li key={o.v} role="option" aria-selected={o.v === value} className={o.v === value ? styles.cur : ''} onClick={() => { onChange(o.v); setOpen(false) }}>{o.l}</li>)}
        </ul>
      )}
    </div>
  )
}

function Seeds({ onVerify }) {
  const [st, setSt] = useState(null), [rounds, setRounds] = useState([]), [cs, setCs] = useState(rand), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([workerPost('/fair/state'), workerPost('/fair/rounds')])
    if (!a.ok) { setErr(a.data?.error === 'not_logged_in' ? 'Log in to see your seeds.' : 'Could not load your seeds.'); return }
    setErr(''); setSt(a.data); setRounds(b.ok ? b.data.rounds || [] : [])
  }, [])
  useEffect(() => { load() }, [load])
  const change = async () => {
    setBusy(true)
    const r = await workerPost('/fair/rotate', { clientSeed: cs })
    setBusy(false)
    if (r.ok) { setSt(r.data); setCs(rand()); load() } else setErr('Could not change the seed pair. Try again.')
  }
  if (err) return <p className={styles.msg}>{err}</p>
  if (!st) return <p className={styles.msg}>Loading...</p>
  return (
    <div className={styles.pane}>
      <CopyBox label="Active Client Seed" value={st.client} />
      <CopyBox label="Active Server Seed (Hashed)" value={st.hash} />
      <div className={styles.fld}><span className={styles.lab}>Total Bets Made with Pair</span><div className={styles.box}><code>{st.nonce}</code></div></div>
      {st.prev?.serverSeed && <CopyBox label="Previous Server Seed (Revealed)" value={st.prev.serverSeed} />}
      <h4 className={styles.h4}>Rotate Seed Pair</h4>
      <div className={styles.fld}>
        <span className={styles.lab}>New Client Seed*</span>
        <div className={`${styles.box} ${styles.edit}`}>
          <input value={cs} maxLength={64} onChange={(e) => setCs(e.target.value.replace(/[^\w-]/g, ''))} aria-label="New client seed" />
          <button type="button" className={styles.mini} disabled={busy || !cs} onClick={change}>Change</button>
          <button type="button" className={styles.mini} disabled={busy} onClick={() => setCs(rand())}>Randomize</button>
        </div>
      </div>
      <CopyBox label="Next Server Seed (Hashed)" value={st.nextHash} />
      {rounds.length > 0 && (
        <>
          <h4 className={styles.h4}>Your recent bets</h4>
          <div className={styles.tbl}>
            {rounds.map((r, i) => (
              <div key={i} className={styles.tr}>
                <span>{GAMES[r.game] || r.game}</span><span>nonce {r.nonce}{r.ball != null ? `/${r.ball + 1}` : ''}</span><span className={styles.dim}>{when(r.at)}</span>
                {r.serverSeed ? <button type="button" className={styles.link} onClick={() => onVerify({ game: r.game, server: r.serverSeed, client: r.client, nonce: r.nonce })}>Verify</button> : <span className={styles.dim}>hidden</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const Cd = ({ c }) => <span className={`${styles.cd} ${c.red ? styles.cdRed : ''}`}>{c.r}{c.s}</span>

function Visual({ game, res, mines }) {
  if (game === 'mines') {
    const set = new Set(res?.tiles || [])
    return <div className={styles.mg}>{range(0, 24).map((i) => <span key={i} className={set.has(i) ? styles.mgBomb : styles.mgGem}>{set.has(i) ? <Bomb className={styles.ico} /> : <Gem className={styles.ico} />}</span>)}</div>
  }
  if (game === 'keno') {
    const set = new Set(res?.draw || [])
    return <div className={styles.kg}>{range(1, 40).map((n) => <span key={n} className={set.has(n) ? styles.kOn : ''}>{n}</span>)}</div>
  }
  if (!res) return <p className={styles.dash}>-</p>
  if (game === 'roulette') return <div className={styles.big}><span className={`${styles.rn} ${styles['rn_' + res.color]}`}>{res.n}</span></div>
  if (game === 'crash') return <div className={styles.big}><b className={styles.x}>{res.x.toFixed(2)}x</b></div>
  if (game === 'jackpot') return <div className={styles.big}><span className={styles.lab}>Ticket</span><b className={styles.x}>{res.ticket.toFixed(12)}</b></div>
  if (game === 'plinko') {
    return (
      <div className={styles.pl}>
        {res.balls.map((b, i) => <div key={i}><b>Slot {b.slot}</b><code>{b.path.map((x) => (x ? 'R' : 'L')).join('')}</code></div>)}
      </div>
    )
  }
  return (
    <div className={styles.bj}>
      {res.seats.map((s, i) => <div key={i}><span className={styles.lab}>Seat {i + 1}</span><p><Cd c={s[0]} /><Cd c={s[1]} /></p></div>)}
      <div><span className={styles.lab}>Dealer</span><p><Cd c={res.dealer[0]} /><Cd c={res.dealer[1]} /></p></div>
      <div className={styles.bjNext}><span className={styles.lab}>Next cards</span><p>{res.next.map((c, i) => <Cd key={i} c={c} />)}</p></div>
    </div>
  )
}

function Verify({ init }) {
  const [game, setGame] = useState(init?.game || 'mines')
  const [client, setClient] = useState(init?.client || ''), [server, setServer] = useState(init?.server || ''), [nonce, setNonce] = useState(init?.nonce != null ? String(init.nonce) : '')
  const [mines, setMines] = useState(4), [rows, setRows] = useState(16), [balls, setBalls] = useState(1), [seats, setSeats] = useState(1)
  const [res, setRes] = useState(null), [hash, setHash] = useState(''), [live, setLive] = useState([])
  const okServer = /^[0-9a-f]{64}$/i.test(server.trim())
  useEffect(() => {
    let off = false
    if (!okServer || nonce === '' || Number.isNaN(Number(nonce))) { setRes(null); setHash(''); return }
    Promise.all([derive(game, server.trim(), client.trim() || 'default', Math.max(0, Math.floor(Number(nonce))), { mines, rows, balls, seats }), sha256hex(server.trim())])
      .then(([r, h]) => { if (!off) { setRes(r); setHash(h) } }).catch(() => { if (!off) setRes(null) })
    return () => { off = true }
  }, [game, server, client, nonce, mines, rows, balls, seats, okServer])
  useEffect(() => { // shared rounds: pick one to fill the seeds
    if (game !== 'crash' && game !== 'jackpot') { setLive([]); return }
    let off = false
    fetch(`${WORKER}/${game}/state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.json()).then((d) => { if (!off) setLive((d.fair || []).filter((x) => x.seed)) }).catch(() => {})
    return () => { off = true }
  }, [game])
  return (
    <div className={styles.pane}>
      <div className={styles.vis}><Visual game={game} res={res} mines={mines} /></div>
      {hash && <p className={styles.hash}>SHA-256 of server seed: <code>{hash}</code></p>}
      <Select label="Games" value={game} options={Object.entries(GAMES).map(([v, l]) => ({ v, l }))} onChange={(v) => { setGame(v); setRes(null) }} />
      {live.length > 0 && (
        <Select label="Round" value="" options={live.map((x) => ({ v: x.seq, l: `${GAMES[game]} #${x.seq}` }))} onChange={(seq) => { const x = live.find((y) => y.seq === seq); setServer(x.seed); setClient(`${game}-${seq}`); setNonce('0') }} />
      )}
      <label className={styles.fld}><span className={styles.lab}>Client Seed</span><input className={styles.in} value={client} onChange={(e) => setClient(e.target.value)} placeholder="Enter Client Seed" /></label>
      <label className={styles.fld}><span className={styles.lab}>Server Seed</span><input className={styles.in} value={server} onChange={(e) => setServer(e.target.value)} placeholder="Enter Server Seed" /></label>
      <label className={styles.fld}><span className={styles.lab}>Nonce</span><input className={styles.in} type="number" min="0" value={nonce} onChange={(e) => setNonce(e.target.value)} placeholder="Enter Nonce" /></label>
      {game === 'mines' && <Select label="Mines" value={mines} options={range(1, 24).map((v) => ({ v, l: String(v) }))} onChange={setMines} />}
      {game === 'plinko' && (
        <>
          <Select label="Rows" value={rows} options={range(8, 16).map((v) => ({ v, l: String(v) }))} onChange={setRows} />
          <Select label="Balls" value={balls} options={range(1, 25).map((v) => ({ v, l: String(v) }))} onChange={setBalls} />
        </>
      )}
      {game === 'blackjack' && <Select label="Seats" value={seats} options={range(1, 3).map((v) => ({ v, l: String(v) }))} onChange={setSeats} />}
    </div>
  )
}

function Logs() {
  const [rows, setRows] = useState(null), [user, setUser] = useState(''), [game, setGame] = useState('')
  const load = useCallback(async () => {
    const r = await workerPost('/fair/log', { limit: 200, user: user.trim() || undefined, game: game || undefined })
    setRows(r.ok ? r.data.rounds || [] : [])
  }, [user, game])
  useEffect(() => { load() }, [load])
  const csv = () => {
    const head = 'time,user,game,bet,payout,nonce,ball,client_seed,server_hash,server_seed'
    const body = (rows || []).map((r) => [r.at, r.user, r.game, r.bet, r.payout, r.nonce, r.ball ?? '', r.client, r.hash, r.serverSeed || ''].join(','))
    const url = URL.createObjectURL(new Blob([[head, ...body].join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'fair-log.csv'; a.click(); URL.revokeObjectURL(url)
  }
  return (
    <div className={styles.pane}>
      <div className={styles.logBar}>
        <input className={styles.in} value={user} onChange={(e) => setUser(e.target.value)} placeholder="Player" />
        <select className={styles.in} value={game} onChange={(e) => setGame(e.target.value)}><option value="">All games</option>{Object.entries(GAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button type="button" className={styles.mini} onClick={csv}>CSV</button>
      </div>
      {!rows ? <p className={styles.msg}>Loading...</p> : !rows.length ? <p className={styles.msg}>No rounds.</p> : (
        <div className={styles.tbl}>
          {rows.map((r) => (
            <div key={r.id} className={`${styles.tr} ${styles.trLog}`}>
              <span>{when(r.at)}</span><b>{r.user}</b><span>{GAMES[r.game] || r.game}</span>
              <span>{r.bet} / {r.payout}</span><span>n{r.nonce ?? '-'}</span><span className={styles.dim} title={r.hash || ''}>{short(r.hash)}</span>
              <span className={r.serverSeed ? '' : styles.dim}>{r.serverSeed ? 'revealed' : 'hidden'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProvablyFair({ onClose }) {
  const [tab, setTab] = useState('seeds'), [init, setInit] = useState(null), [admin, setAdmin] = useState(false)
  useEffect(() => { workerPost('/fair/log', { limit: 1 }).then((r) => setAdmin(r.ok)) }, [])
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const tabs = [['seeds', 'Seeds'], ['verify', 'Verify'], ...(admin ? [['logs', 'Logs']] : [])]
  return (
    <div className={styles.ov} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-label="Provably Fair">
        <div className={styles.top}>
          <h3><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v16M7 20h10M5 7h14M5 7l-3 7a3.500 3.500 0 006 0zM19 7l-3 7a3.500 3.500 0 006 0z" /></svg>Provably Fair</h3>
          <button type="button" className={styles.x} onClick={onClose} aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        <div className={styles.tabs} style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }} role="tablist">{tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? styles.on : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
        <hr className={styles.hr} />
        {tab === 'seeds' && <Seeds onVerify={(v) => { setInit(v); setTab('verify') }} />}
        {tab === 'verify' && <Verify init={init} key={init ? `${init.server}${init.nonce}` : 'x'} />}
        {tab === 'logs' && <Logs />}
      </div>
    </div>
  )
}
