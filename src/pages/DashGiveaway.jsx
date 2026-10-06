import { useState, useEffect, useRef } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

const CHANNEL     = import.meta.env.VITE_TWITCH_CHANNEL || 'jralha_'
const GIVEAWAY_ID = 'main'

async function dbSave(payload) {
  const { error } = await supabase
    .from('giveaway_state')
    .upsert({ id: GIVEAWAY_ID, ...payload }, { onConflict: 'id' })
  if (error) console.error('[giveaway]', error.message)
}

function hslFromName(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return `hsl(${h % 360}, 65%, 60%)`
}

function fmtTimer(s) {
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
}

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

  const partSet   = useRef(new Set())
  const activeRef = useRef(active)
  const kwRef     = useRef(keyword)
  activeRef.current = active
  kwRef.current     = keyword

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
        setSorting(false)
      }
    }, 15000)

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
        setWinners(prev => [...prev, { username: winnerName, ts: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) }])
      }
    }, 1000)
    return () => { clearInterval(t); clearTimeout(timeout) }
  }, [sorting])

  // ── Twitch IRC ────────────────────────────────────────────────────────
  useTwitchChat(({ username, text, color }) => {
    if (!activeRef.current) return
    if (text.toLowerCase() !== kwRef.current.toLowerCase()) return
    const key = username.toLowerCase()
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
    setWinners([])
    setSorting(false)
    setTimerDone(false)
    setEndsAt(ends)
    setActive(true)
    dbSave({ active: true, keyword, ends_at: ends, spinning: false, winner: null, participants: [] })
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

  const saveKw = () => {
    const kw = kwDraft.trim() || '!ralhudo'
    setKeyword(kw)
    setEditingKw(false)
    partSet.current.clear(); setParts([]); setLog([])
    if (active) dbSave({ keyword: kw })
  }

  const removeWinner = (username) => {
    setWinners(prev => prev.filter(w => w.username !== username))
    if (winner === username) setWinner(null)
  }

  const isEnding   = active && countdown > 0 && countdown <= 30
  const canSortear = active && parts.length >= 1 && !sorting

  // ── Styles ────────────────────────────────────────────────────────────
  const s = {
    page:      { padding: '28px 24px', fontFamily: 'Rubik, sans-serif', maxWidth: 1200 },
    topRow:    { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 },
    title:     { fontSize: '1.35em', fontWeight: 900, color: '#fff', margin: 0 },
    badge:     { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 8, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.25)', fontSize: '.72em', fontWeight: 800, color: '#f59e0b', letterSpacing: '.1em' },
    dot:       { width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.4s ease-in-out infinite' },
    grid:      { display: 'grid', gridTemplateColumns: '300px 1fr 240px', gap: 16, alignItems: 'start' },
    card:      { background: '#0d1017', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' },
    cardHead:  { display: 'flex', alignItems: 'center', gap: 8, padding: '11px 15px 10px', borderBottom: '1px solid rgba(255,255,255,.05)', background: 'rgba(255,255,255,.02)', fontSize: '.78em', fontWeight: 700, color: 'rgba(255,255,255,.5)', letterSpacing: '.06em' },
    section:   { padding: '13px 15px 0' },
    label:     { fontSize: '.68em', fontWeight: 700, color: 'rgba(255,255,255,.32)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 7, display: 'block' },
    kwVal:     { display: 'flex', alignItems: 'center', gap: 8 },
    kwBadge:   { flex: 1, fontSize: '.9em', fontWeight: 800, color: '#a78bfa', background: 'rgba(124,111,255,.1)', border: '1px solid rgba(124,111,255,.2)', borderRadius: 9, padding: '6px 12px' },
    kwEditRow: { display: 'flex', gap: 7 },
    kwInput:   { flex: 1, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(124,111,255,.5)', borderRadius: 9, padding: '6px 10px', color: '#fff', fontSize: '.88em', fontFamily: 'Rubik, sans-serif', fontWeight: 700, outline: 'none' },
    hint:      { fontSize: '.71em', color: 'rgba(255,255,255,.26)', lineHeight: 1.55, marginTop: 7 },
    presets:   { display: 'flex', flexWrap: 'wrap', gap: 6 },
    preset:    (sel) => ({ padding: '5px 12px', borderRadius: 8, border: `1px solid ${sel ? 'rgba(124,111,255,.4)' : 'rgba(255,255,255,.1)'}`, background: sel ? 'rgba(124,111,255,.18)' : 'rgba(255,255,255,.04)', color: sel ? '#a78bfa' : 'rgba(255,255,255,.5)', fontSize: '.76em', fontWeight: 700, cursor: 'pointer', fontFamily: 'Rubik, sans-serif' }),
    customIn:  { width: '100%', marginTop: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: '7px 10px', color: 'rgba(255,255,255,.7)', fontSize: '.8em', fontFamily: 'Rubik, sans-serif', outline: 'none' },
    timerBox:  { margin: '14px 15px 0', background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 12, padding: '14px 0', textAlign: 'center' },
    timerVal:  (end) => ({ fontSize: '2.6em', fontWeight: 900, color: end ? '#f87171' : '#f59e0b', letterSpacing: '.1em', fontVariantNumeric: 'tabular-nums', lineHeight: 1, animation: end ? 'pulse .6s ease-in-out infinite' : 'none' }),
    timerLbl:  { fontSize: '.7em', color: 'rgba(255,255,255,.28)', fontWeight: 600, marginTop: 4 },
    cta:       { display: 'flex', gap: 8, padding: '14px 15px 15px' },
    btnStart:  { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', fontWeight: 800, fontSize: '.85em', fontFamily: 'Rubik, sans-serif', cursor: 'pointer' },
    btnDraw:   (dis) => ({ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 11, border: 'none', background: dis ? 'rgba(124,111,255,.2)' : 'linear-gradient(135deg, #7c6fff, #a78bfa)', color: dis ? 'rgba(255,255,255,.3)' : '#fff', fontWeight: 800, fontSize: '.85em', fontFamily: 'Rubik, sans-serif', cursor: dis ? 'not-allowed' : 'pointer' }),
    btnStop:   { padding: '10px 15px', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.45)', fontWeight: 700, fontSize: '.82em', fontFamily: 'Rubik, sans-serif', cursor: 'pointer' },
    btnEdit:   { padding: '5px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.4)', fontSize: '.74em', fontWeight: 700, cursor: 'pointer', fontFamily: 'Rubik, sans-serif' },
    btnSave:   { padding: '6px 14px', borderRadius: 9, border: 'none', background: '#7c6fff', color: '#fff', fontSize: '.78em', fontWeight: 800, cursor: 'pointer', fontFamily: 'Rubik, sans-serif' },
    empty:     { padding: '24px 15px', textAlign: 'center', fontSize: '.78em', color: 'rgba(255,255,255,.22)', fontStyle: 'italic', lineHeight: 1.6 },
    countBadge:{ marginLeft: 'auto', background: 'rgba(24,221,138,.15)', color: '#18dd8a', fontSize: '.78em', fontWeight: 800, padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(24,221,138,.2)' },
    avatarGrid:{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '13px 15px' },
    avatarItem:{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, maxWidth: 46 },
    avatarName:{ fontSize: '.62em', color: 'rgba(255,255,255,.45)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 46, textAlign: 'center' },
    logList:   { maxHeight: 280, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,.07) transparent' },
    logRow:    { display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderBottom: '1px solid rgba(255,255,255,.03)' },
    logName:   { fontSize: '.78em', fontWeight: 700, flex: 1 },
    logTs:     { fontSize: '.67em', color: 'rgba(255,255,255,.25)', fontWeight: 500, flexShrink: 0 },
  }

  return (
    <div style={s.page}>
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}`}</style>

      {/* Title */}
      <div style={s.topRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/>
            <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
            <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
          </svg>
          <h1 style={s.title}>Giveaway</h1>
        </div>
        {active && <div style={s.badge}><div style={s.dot} />ATIVO</div>}
      </div>

      <div style={s.grid}>

        {/* CONFIG */}
        <div style={s.card}>
          <div style={s.cardHead}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c6fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>
            Configuração
          </div>

          {/* Keyword */}
          <div style={s.section}>
            <span style={s.label}>Palavra-chave</span>
            {editingKw ? (
              <div style={s.kwEditRow}>
                <input style={s.kwInput} value={kwDraft}
                  onChange={e => setKwDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveKw()}
                  autoFocus placeholder="ex: !ralhudo" />
                <button style={s.btnSave} onClick={saveKw}>Guardar</button>
              </div>
            ) : (
              <div style={s.kwVal}>
                <span style={s.kwBadge}>{keyword}</span>
                {!active && <button style={s.btnEdit} onClick={() => { setKwDraft(keyword); setEditingKw(true) }}>Editar</button>}
              </div>
            )}
            <p style={s.hint}>Quem escrever <strong style={{ color: 'rgba(255,255,255,.5)' }}>{keyword}</strong> no chat entra automaticamente.</p>
          </div>

          {/* Duration */}
          {!active && (
            <div style={s.section}>
              <span style={s.label}>Duração</span>
              <div style={s.presets}>
                {PRESETS.map(p => (
                  <button key={p.secs} style={s.preset(duration === p.secs && !customMin)}
                    onClick={() => { setDuration(p.secs); setCustomMin('') }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <input style={s.customIn} type="number" min="0.5" max="60" step="0.5"
                placeholder="Personalizado (minutos)"
                value={customMin} onChange={e => setCustomMin(e.target.value)} />
            </div>
          )}

          {/* Timer */}
          {active && (
            <div style={s.timerBox}>
              <div style={s.timerVal(isEnding)}>
                {timerDone ? '00:00' : fmtTimer(countdown)}
              </div>
              <div style={s.timerLbl}>
                {timerDone ? 'Pronto para sortear' : 'tempo restante'}
              </div>
            </div>
          )}

          {/* Botões */}
          <div style={s.cta}>
            {!active ? (
              <button style={s.btnStart} onClick={start}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                Iniciar Giveaway
              </button>
            ) : (
              <>
                <button style={s.btnDraw(!canSortear)} onClick={canSortear ? sortear : undefined}>
                  {sorting
                    ? 'A sortear...'
                    : winners.length > 0
                      ? `Sortear novamente (${parts.length})`
                      : `Sortear (${parts.length})`}
                </button>
                {sorting && (
                  <button onClick={resetSpin} style={{ padding: '10px 12px', borderRadius: 11, border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.08)', color: '#f87171', fontWeight: 700, fontSize: '.78em', fontFamily: 'Rubik, sans-serif', cursor: 'pointer' }} title="Limpar spinning preso">Reset</button>
                )}
                <button style={s.btnStop} onClick={stop}>Encerrar</button>
              </>
            )}
          </div>
        </div>

        {/* PARTICIPANTES */}
        <div style={s.card}>
          <div style={s.cardHead}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#18dd8a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Participantes
            <span style={s.countBadge}>{parts.length}</span>
          </div>
          {parts.length === 0 ? (
            <div style={s.empty}>
              {active
                ? <>Aguarda que alguém escreva <strong style={{ color: 'rgba(255,255,255,.45)', fontStyle: 'normal' }}>{keyword}</strong></>
                : 'Inicia o giveaway para começar a recolher.'}
            </div>
          ) : (
            <div style={s.avatarGrid}>
              {parts.slice(0, 30).map((p, i) => (
                <div key={i} style={s.avatarItem} title={p.username}>
                  <Avatar name={p.username} color={p.color} size={36} />
                  <span style={s.avatarName}>{p.username}</span>
                </div>
              ))}
              {parts.length > 30 && (
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.06)', border: '2px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.68em', fontWeight: 800, color: 'rgba(255,255,255,.4)' }}>
                  +{parts.length - 30}
                </div>
              )}
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: sorteados + log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* SORTEADOS */}
          <div style={s.card}>
            <div style={s.cardHead}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Sorteados
              {winners.length > 0 && (
                <span style={{ ...s.countBadge, background: 'rgba(251,191,36,.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,.2)' }}>
                  {winners.length}
                </span>
              )}
            </div>

            {winners.length === 0 ? (
              <div style={s.empty}>Ainda sem sorteados.</div>
            ) : (
              <div>
                {winners.map((w, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '8px 14px',
                    borderBottom: i < winners.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                    background: w.username === winner ? 'rgba(251,191,36,.05)' : 'transparent',
                  }}>
                    {/* posição */}
                    <span style={{ fontSize: '.65em', fontWeight: 800, color: 'rgba(255,255,255,.2)', width: 16, textAlign: 'center', flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <Avatar name={w.username} color={hslFromName(w.username)} size={26} />
                    <span style={{ fontSize: '.82em', fontWeight: 700, color: w.username === winner ? '#fbbf24' : '#fff', flex: 1 }}>
                      {w.username}
                    </span>
                    <span style={{ fontSize: '.65em', color: 'rgba(255,255,255,.25)', flexShrink: 0 }}>{w.ts}</span>
                    {/* botão remover */}
                    <button onClick={() => removeWinner(w.username)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,.2)', padding: '2px 4px', borderRadius: 4, lineHeight: 1,
                      fontSize: '.75em',
                    }} title="Remover">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* LOG */}
          <div style={s.card}>
            <div style={s.cardHead}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Log
            </div>
            <div style={s.logList}>
              {log.length === 0
                ? <div style={s.empty}>Sem entradas ainda.</div>
                : log.map((entry, i) => (
                  <div key={i} style={s.logRow}>
                    <Avatar name={entry.username} color={entry.color} size={22} />
                    <span style={{ ...s.logName, color: entry.color }}>{entry.username}</span>
                    <span style={s.logTs}>{entry.ts}</span>
                  </div>
                ))
              }
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}