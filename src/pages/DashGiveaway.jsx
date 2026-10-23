import { useState, useEffect, useRef } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'
import styles from './DashGiveaway.module.css'

const CHANNEL     = import.meta.env.VITE_TWITCH_CHANNEL || 'jralha_'
const GIVEAWAY_ID = 'main'

async function dbSave(payload) {
  const { error } = await supabase
    .from('giveaway_state')
    .upsert({ id: GIVEAWAY_ID, ...payload }, { onConflict: 'id' })
  if (error && /prize|reply_secs/.test(error.message)) {
    // columns not created yet: retry without the prize fields
    const { prize, prize_image, reply_secs, ...rest } = payload
    const r = await supabase.from('giveaway_state').upsert({ id: GIVEAWAY_ID, ...rest }, { onConflict: 'id' })
    if (r.error) console.error('[giveaway]', r.error.message)
    return
  }
  if (error) console.error('[giveaway]', error.message)
}

const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const lsSet = (k, v) => { try { localStorage.setItem(k, v) } catch {} }

function hslFromName(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return `hsl(${h % 360}, 65%, 60%)`
}

function fmtTimer(s) {
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
}

const BOTS = new Set(['nightbot','streamelements','streamlabs','moobot','fossabot','wizebot','sery_bot','commanderroot','ralha_bot'])
// Twitch/7TV add invisible characters when a message is repeated; strip them before comparing
const clean = (t) => String(t || '').replace(/[\u034f\u200b-\u200f\u2060\ufeff\u{e0000}-\u{e007f}]/gu, '').trim()
const WIN_KEY = 'ru-gw-winners'
const loadWinners = () => { try { return JSON.parse(localStorage.getItem(WIN_KEY) || '[]') } catch { return [] } }
const saveWinners = (w) => { try { localStorage.setItem(WIN_KEY, JSON.stringify(w)) } catch { /* ignore */ } }

// ─── Twitch IRC ────────────────────────────────────────────────────────────
function useTwitchChat(onMsg) {
  const cbRef   = useRef(onMsg)
  const seenIds = useRef(new Set())
  cbRef.current = onMsg

  useEffect(() => {
    let ws, retryTimer
    const connect = () => {
      ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443')
      ws.onopen = () => {
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands')
        ws.send('PASS oauth:ralhaoverlayanon2026')
        ws.send('NICK justinfan12345')
        ws.send(`JOIN #${CHANNEL.toLowerCase()}`)
      }
      ws.onmessage = (e) => {
        const lines = String(e.data).split('\r\n').filter(Boolean)
        for (const line of lines) {
          if (line.includes('PING')) { ws.send('PONG :tmi.twitch.tv'); continue }
          const match = line.match(/^@([^ ]+) :([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.+)/)
          if (!match) continue
          const tags  = Object.fromEntries(match[1].split(';').map(kv => { const [k,...v]=kv.split('='); return [k,v.join('=')] }))
          const msgId = tags['id'] || null
          if (msgId) {
            if (seenIds.current.has(msgId)) continue
            seenIds.current.add(msgId)
            if (seenIds.current.size > 500) seenIds.current.delete(seenIds.current.values().next().value)
          }
          cbRef.current({
            username: match[2],
            text:     match[3].trim(),
            color:    (tags['color'] && tags['color'] !== '') ? tags['color'] : hslFromName(match[2]),
          })
        }
      }
      ws.onclose = () => { retryTimer = setTimeout(connect, 3000) }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => { clearTimeout(retryTimer); ws?.close() }
  }, [])
}

// ─── Avatar ────────────────────────────────────────────────────────────────
function Avatar({ name, color, size = 34 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `radial-gradient(circle at 35% 35%, ${color}cc, ${color}44)`,
      border: `2px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: size * 0.38, color: '#fff',
      fontFamily: 'Rubik, sans-serif', userSelect: 'none',
    }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

// ─── Presets ───────────────────────────────────────────────────────────────
const PRESETS = [
  { label: '1 min',  secs: 60 },
  { label: '2 min',  secs: 120 },
  { label: '3 min',  secs: 180 },
  { label: '5 min',  secs: 300 },
  { label: '10 min', secs: 600 },
]

// ─── Main ──────────────────────────────────────────────────────────────────
export default function DashGiveaway() {
  const [keyword,   setKeyword]   = useState('!ralhudo')
  const [kwDraft,   setKwDraft]   = useState('!ralhudo')
  const [editingKw, setEditingKw] = useState(false)
  const [duration,  setDuration]  = useState(300)
  const [customMin, setCustomMin] = useState('')
  const [active,    setActive]    = useState(false)
  const [endsAt,    setEndsAt]    = useState(null)
  const [countdown, setCountdown] = useState(0)
  const [parts,     setParts]     = useState([])
  const [log,       setLog]       = useState([])
  const [winners,   setWinners]   = useState([])
  const [winner,    setWinner]    = useState(null)
  const [sorting,   setSorting]   = useState(false)
  const [timerDone, setTimerDone] = useState(false)
  const [warn,      setWarn]      = useState('')
  const [ready,     setReady]     = useState(false)
  const [prize,     setPrize]     = useState(() => lsGet('ru-gw-prize', ''))
  const [replySecs, setReplySecs] = useState(() => Number(lsGet('ru-gw-reply45', '45')))

  const partSet   = useRef(new Set())
  const activeRef = useRef(active)
  const kwRef     = useRef(keyword)
  const endsRef   = useRef(null)
  activeRef.current = active
  kwRef.current     = keyword
  endsRef.current   = endsAt

  // ── Restore after a refresh: the participants live in giveaway_state, not only in this tab ──
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('giveaway_state').select('*').eq('id', GIVEAWAY_ID).maybeSingle()
      if (data?.active) {
        const list = Array.isArray(data.participants) ? data.participants : []
        partSet.current = new Set(list.map(p => String(p.username).toLowerCase()))
        setParts(list)
        setLog(list.slice().reverse().slice(0, 60).map(p => ({ username: p.username, color: p.color, ts: '' })))
        if (data.keyword) setKeyword(data.keyword)
        if (data.prize != null) setPrize(data.prize)
        if (data.reply_secs != null) setReplySecs(data.reply_secs)
        setEndsAt(data.ends_at)
        setActive(true)
        setWinners(loadWinners())
      }
      setReady(true)
    })()
  }, [])

  // keep the participants saved while the giveaway is running (the overlay shows this number)
  useEffect(() => {
    if (!ready || !active || sorting) return
    const t = setTimeout(() => { dbSave({ participants: parts }) }, 1200)
    return () => clearTimeout(t)
  }, [parts, active, sorting, ready])

  // ── Countdown ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !endsAt) { setCountdown(0); return }
    const tick = () => {
      const s = Math.max(0, Math.floor((new Date(endsAt) - Date.now()) / 1000))
      setCountdown(s)
      if (s === 0) setTimerDone(true)
    }
    tick()
    const t = setInterval(tick, 500)
    return () => clearInterval(t)
  }, [active, endsAt])

  // ── Poll for winner from overlay ──────────────────────────────────────
  // Quando sorting=true, faz poll ao Supabase até o ChatBox gravar spinning:false + winner
  // Timeout de segurança: se ao fim de 15s não há resposta, desbloqueia o botão
  useEffect(() => {
    if (!sorting) return
    let done = false
    const timeout = setTimeout(() => {
      if (!done) {
        console.warn('[giveaway] timeout a aguardar resultado da overlay')
        setWarn('A overlay não respondeu. Confirma que a overlay do chat está aberta no OBS e tenta outra vez.')
        setSorting(false)
      }
    }, 60000)

    const t = setInterval(async () => {
      const { data } = await supabase
        .from('giveaway_state')
        .select('spinning, winner')
        .eq('id', GIVEAWAY_ID)
        .single()
      if (data && !data.spinning && data.winner) {
        done = true
        clearInterval(t)
        clearTimeout(timeout)
        const winnerName = data.winner
        setWinner(winnerName)
        setSorting(false)
        setParts(prev => prev.filter(p => p.username.toLowerCase() !== winnerName.toLowerCase()))
        setWarn('')
        setWinners(prev => { const n = [...prev, { username: winnerName, ts: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) }]; saveWinners(n); return n })
      }
    }, 1000)
    return () => { clearInterval(t); clearTimeout(timeout) }
  }, [sorting])

  // ── Twitch IRC ────────────────────────────────────────────────────────
  useTwitchChat(({ username, text, color }) => {
    if (!activeRef.current) return
    if (endsRef.current && Date.now() > new Date(endsRef.current).getTime()) return   // closed: late entries do not count
    if (clean(text).toLowerCase() !== kwRef.current.toLowerCase()) return
    const key = username.toLowerCase()
    if (key === CHANNEL.toLowerCase() || BOTS.has(key)) return                          // streamer and bots do not enter
    if (partSet.current.has(key)) return
    partSet.current.add(key)
    setParts(prev => [...prev, { username, color }])
    setLog(prev => {
      const ts = new Date().toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
      return [{ username, color, ts }, ...prev].slice(0, 60)
    })
  })

  // ── Actions ───────────────────────────────────────────────────────────
  const start = () => {
    const secs = customMin ? Math.round(parseFloat(customMin) * 60) : duration
    const ends = new Date(Date.now() + secs * 1000).toISOString()
    partSet.current.clear()
    setParts([])
    setLog([])
    setWinner(null)
    setWinners([]); saveWinners([])
    setWarn('')
    setSorting(false)
    setTimerDone(false)
    setEndsAt(ends)
    setActive(true)
    lsSet('ru-gw-prize', prize); lsSet('ru-gw-reply45', String(replySecs))
    dbSave({ active: true, keyword, ends_at: ends, spinning: false, winner: null, participants: [], prize: prize.trim() || null, prize_image: null, reply_secs: replySecs })
  }

  const stop = () => {
    setActive(false)
    setEndsAt(null)
    setTimerDone(false)
    setSorting(false)
    dbSave({ active: false, ends_at: null, spinning: false })
  }

  // reset de emergência — limpa spinning preso no Supabase sem fechar o giveaway
  const resetSpin = async () => {
    setSorting(false)
    await dbSave({ spinning: false, winner: null })
  }

  const sortear = async () => {
    if (parts.length < 1) return
    setWinner(null)
    setSorting(true)
    // reset winner no Supabase antes de arrancar
    await dbSave({ spinning: true, participants: parts, winner: null })
  }

  // add time to a running giveaway (also reopens it if the timer already hit zero)
  const addTime = (secs) => {
    const base = Math.max(Date.now(), endsAt ? new Date(endsAt).getTime() : 0)
    const ends = new Date(base + secs * 1000).toISOString()
    setEndsAt(ends); setTimerDone(false)
    dbSave({ ends_at: ends })
  }

  // close entries now (the giveaway stays open so winners can still be drawn)
  const closeEntries = () => {
    const now = new Date().toISOString()
    setEndsAt(now); setTimerDone(true)
    dbSave({ ends_at: now })
  }

  // reroll: discard the current winner and draw again from whoever is left
  const reroll = async () => {
    if (winner) removeWinner(winner)
    await sortear()
  }

  const saveKw = () => {
    const kw = kwDraft.trim() || '!ralhudo'
    setKeyword(kw)
    setEditingKw(false)
    partSet.current.clear(); setParts([]); setLog([])
    if (active) dbSave({ keyword: kw })
  }

  const removeWinner = (username) => {
    setWinners(prev => { const n = prev.filter(w => w.username !== username); saveWinners(n); return n })
    if (winner === username) setWinner(null)
  }

  const isEnding   = active && countdown > 0 && countdown <= 30
  const canSortear = active && parts.length >= 1 && !sorting

  const prizeSet = prize.trim()
  const lastWinner = winners.length ? winners[winners.length - 1].username : null

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Giveaway</h1>
          <p className={styles.sub}>Sorteio no chat da stream. Quem escreve a palavra-chave entra.</p>
        </div>
        {active && <span className={styles.live}><i />ATIVO</span>}
      </div>

      <div className={styles.cols}>
        {/* ── CONTROL ── */}
        <section className={styles.panel}>
          {!active ? (
            <>
              <div className={styles.panelTitle}>Novo giveaway</div>
              <label className={styles.fld}><span>Prémio</span>
                <input value={prize} maxLength={40} placeholder="ex: 200 FS" onChange={e => setPrize(e.target.value)} />
              </label>
              <div className={styles.fld}><span>Palavra-chave</span>
                {editingKw ? (
                  <div className={styles.row}>
                    <input className={styles.in} value={kwDraft} autoFocus placeholder="ex: !ralhudo" onChange={e => setKwDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveKw()} />
                    <button className={styles.ghost} onClick={saveKw}>Guardar</button>
                  </div>
                ) : (
                  <div className={styles.row}>
                    <div className={styles.kw}>{keyword}</div>
                    <button className={styles.ghost} onClick={() => { setKwDraft(keyword); setEditingKw(true) }}>Editar</button>
                  </div>
                )}
              </div>
              <div className={styles.fld}><span>Duração</span>
                <div className={styles.chips}>
                  {PRESETS.map(p => (
                    <button key={p.secs} className={duration === p.secs && !customMin ? styles.on : ''} onClick={() => { setDuration(p.secs); setCustomMin('') }}>{p.label}</button>
                  ))}
                </div>
                <input type="number" min="0.5" max="60" step="0.5" placeholder="ou personalizado (minutos)" value={customMin} onChange={e => setCustomMin(e.target.value)} />
              </div>
              <div className={styles.fld}><span>Tempo para o vencedor responder</span>
                <div className={styles.chips}>
                  {[0, 30, 45, 60].map(v => (
                    <button key={v} className={replySecs === v ? styles.on : ''} onClick={() => setReplySecs(v)}>{v === 0 ? 'Off' : v + 's'}</button>
                  ))}
                </div>
              </div>
              <button className={styles.primary} onClick={start}>Iniciar giveaway</button>
            </>
          ) : (
            <>
              <div className={styles.panelTitle}>{prizeSet || 'Giveaway'} <em>{keyword}</em></div>
              <div className={`${styles.timer}${isEnding ? ' ' + styles.ending : ''}`}>
                <b>{timerDone ? '00:00' : fmtTimer(countdown)}</b>
                <span>{timerDone ? 'Fechado — pronto para sortear' : 'tempo restante'}</span>
              </div>
              <div className={styles.fld}><span>Adicionar tempo</span>
                <div className={styles.chips}>
                  {[60, 120, 300, 600].map(v => <button key={v} onClick={() => addTime(v)}>+{v / 60} min</button>)}
                </div>
              </div>
              {!timerDone && (
                <button className={styles.closeBtn} onClick={closeEntries}>Fechar participações já</button>
              )}
              {warn && <p className={styles.warn}>{warn}</p>}

              {winner && !sorting && (
                <div className={styles.winBox}>
                  <Avatar name={winner} color={hslFromName(winner)} size={40} />
                  <div><small>VENCEDOR</small><b>{winner}</b></div>
                </div>
              )}

              <button className={styles.primary} disabled={!canSortear} onClick={sortear}>
                {sorting ? 'A sortear…' : winners.length ? `Sortear outro (${parts.length})` : `Sortear (${parts.length})`}
              </button>
              <div className={styles.two}>
                <button className={styles.reroll} disabled={!winner || sorting || parts.length < 1} onClick={reroll} title="Descarta o vencedor atual e sorteia de novo">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 11-2.1-9.4L23 10"/></svg>
                  Reroll
                </button>
                {sorting
                  ? <button className={styles.danger} onClick={resetSpin}>Desbloquear</button>
                  : <button className={styles.danger} onClick={stop}>Encerrar</button>}
              </div>
              <p className={styles.hint}>Reroll descarta o vencedor atual (ex: não respondeu) e sorteia entre os restantes.</p>
            </>
          )}
        </section>

        {/* ── RIGHT ── */}
        <div className={styles.stack}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>Participantes <span className={styles.count}>{parts.length}</span></div>
            {parts.length === 0 ? (
              <p className={styles.empty}>{active ? <>À espera de quem escreva <b>{keyword}</b></> : 'Inicia o giveaway para começar a recolher.'}</p>
            ) : (
              <div className={styles.people}>
                {parts.slice(0, 40).map((p, i) => (
                  <div key={i} className={styles.person} title={p.username}>
                    <Avatar name={p.username} color={p.color} size={34} />
                    <span>{p.username}</span>
                  </div>
                ))}
                {parts.length > 40 && <div className={styles.more}>+{parts.length - 40}</div>}
              </div>
            )}
          </section>

          <div className={styles.cols2}>
            <section className={styles.panel}>
              <div className={styles.panelTitle}>Sorteados {winners.length > 0 && <span className={styles.count}>{winners.length}</span>}</div>
              {winners.length === 0 ? <p className={styles.empty}>Ainda sem sorteados.</p> : (
                <div className={styles.list}>
                  {winners.map((w, i) => (
                    <div key={i} className={`${styles.li}${w.username === lastWinner ? ' ' + styles.cur : ''}`}>
                      <span className={styles.idx}>{i + 1}</span>
                      <Avatar name={w.username} color={hslFromName(w.username)} size={24} />
                      <b>{w.username}</b>
                      <small>{w.ts}</small>
                      <button onClick={() => removeWinner(w.username)} title="Remover" aria-label="Remover">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className={styles.panel}>
              <div className={styles.panelTitle}>Entradas</div>
              {log.length === 0 ? <p className={styles.empty}>Sem entradas ainda.</p> : (
                <div className={styles.list}>
                  {log.map((e, i) => (
                    <div key={i} className={styles.li}>
                      <Avatar name={e.username} color={e.color} size={22} />
                      <b style={{ color: e.color }}>{e.username}</b>
                      <small>{e.ts}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
