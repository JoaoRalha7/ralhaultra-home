import { useState, useEffect, useRef, useCallback } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

const TOTAL_SPINS = 130
const PHASE1 = 100
const PHASE2 = 30

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return n >= 1000
    ? n.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '€'
    : n.toFixed(2) + '€'
}

// ─── SpinBalls ─────────────────────────────────────────────────────────────
function SpinBalls({ spins }) {
  const p1 = Math.min(spins, PHASE1)
  const p2 = Math.max(0, spins - PHASE1)
  const pct1 = (p1 / PHASE1) * 100
  const pct2 = (p2 / PHASE2) * 100

  const Ball = ({ pct, label, color, total }) => {
    const r = 44, cx = 50, cy = 50
    const circ = 2 * Math.PI * r
    const dash = (pct / 100) * circ

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative', width: 110, height: 110 }}>
          <svg width="110" height="110" viewBox="0 0 100 100">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="8" />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="8"
              strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray .5s ease', filter: pct > 0 ? `drop-shadow(0 0 6px ${color}88)` : 'none' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', fontFamily: 'Sora, sans-serif', lineHeight: 1 }}>
              {Math.min(pct > 0 ? Math.round((pct / 100) * total) : 0, total)}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', fontWeight: 700 }}>/{total}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.4)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 32, justifyContent: 'center' }}>
      <Ball pct={pct1} label="Phase 1" color="#7c6fff" total={PHASE1} />
      <div style={{ width: 1, height: 60, background: 'rgba(255,255,255,.08)' }} />
      <Ball pct={pct2} label="Phase 2" color="#f59e0b" total={PHASE2} />
    </div>
  )
}

// ─── SlotSearch ────────────────────────────────────────────────────────────
function SlotSearch({ value, onChange }) {
  const [query, setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen]     = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('slots').select('id, name, provider, image_url')
        .ilike('name', `%${query}%`).limit(8)
      setResults(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const s = {
    wrap:   { position: 'relative', flex: 1 },
    input:  { width: '100%', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '9px 12px', color: '#fff', fontSize: '.88em', fontFamily: 'Rubik, sans-serif', outline: 'none' },
    drop:   { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#12141f', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.6)' },
    item:   { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.04)' },
    img:    { width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0, background: '#1a1d2e' },
  }

  return (
    <div style={s.wrap} ref={ref}>
      <input style={s.input}
        placeholder={value ? value.name : 'Pesquisar slot...'}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && results.length > 0 && (
        <div style={s.drop}>
          {results.map(slot => (
            <div key={slot.id} style={s.item}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onClick={() => { onChange(slot); setQuery(''); setOpen(false) }}>
              <img style={s.img} src={slot.image_url || ''} alt={slot.name} onError={e => e.target.style.opacity = '.3'} />
              <div>
                <div style={{ fontSize: '.82em', fontWeight: 700, color: '#fff' }}>{slot.name}</div>
                <div style={{ fontSize: '.72em', color: 'rgba(255,255,255,.4)' }}>{slot.provider}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function DashMinigame() {
  const [session,   setSession]   = useState(null)
  const [ranking,   setRanking]   = useState([])
  const [username,  setUsername]  = useState('')
  const [slot,      setSlot]      = useState(null)
  const [bet,       setBet]       = useState('')
  const [payValue,  setPayValue]  = useState('')
  const [payType,   setPayType]   = useState('win') // win | bonus
  const [loading,   setLoading]   = useState(false)

  // ── Load active session + ranking ────────────────────────────────────
  const loadSession = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('minigame_sessions')
      .select('*, slot:slots(*)')
      .eq('status', 'playing')
      .eq('stream_date', today)
      .order('created_at', { ascending: false })
      .limit(1).single()
    setSession(data || null)
  }, [])

  const loadRanking = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('minigame_ranking')
      .select('*')
      .eq('stream_date', today)
      .order('total_won', { ascending: false })
    setRanking(data || [])
  }, [])

  useEffect(() => {
    loadSession()
    loadRanking()
    const ch = supabase.channel('minigame-dash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'minigame_sessions' }, () => { loadSession(); loadRanking() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'minigame_ranking'  }, loadRanking)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // ── Start session ─────────────────────────────────────────────────────
  const start = async () => {
    if (!username.trim() || !slot || !bet) return
    setLoading(true)
    const { data } = await supabase.from('minigame_sessions').insert({
      username: username.trim(),
      slot_id: slot.id,
      bet: parseFloat(bet),
      spins_done: 0,
      total_won: 0,
      status: 'playing',
      payments: [],
    }).select('*, slot:slots(*)').single()
    setSession(data)
    setUsername(''); setSlot(null); setBet('')
    setLoading(false)
  }

  // ── Add spin ──────────────────────────────────────────────────────────
  const addSpin = async (count = 1) => {
    if (!session) return
    const newSpins = Math.min(session.spins_done + count, TOTAL_SPINS)
    await supabase.from('minigame_sessions').update({ spins_done: newSpins }).eq('id', session.id)
    setSession(prev => ({ ...prev, spins_done: newSpins }))
  }

  // ── Add payment ───────────────────────────────────────────────────────
  const addPayment = async () => {
    if (!session || !payValue) return
    const val = parseFloat(payValue)
    if (isNaN(val) || val <= 0) return
    const multi = val / session.bet
    const payment = { spin: session.spins_done, value: val, type: payType, multiplier: parseFloat(multi.toFixed(1)) }
    const payments = [...(session.payments || []), payment]
    const total_won = payments.reduce((a, p) => a + p.value, 0)
    await supabase.from('minigame_sessions').update({ payments, total_won }).eq('id', session.id)
    setSession(prev => ({ ...prev, payments, total_won }))
    setPayValue('')
  }

  // ── Remove payment ────────────────────────────────────────────────────
  const removePayment = async (idx) => {
    if (!session) return
    const payments = session.payments.filter((_, i) => i !== idx)
    const total_won = payments.reduce((a, p) => a + p.value, 0)
    await supabase.from('minigame_sessions').update({ payments, total_won }).eq('id', session.id)
    setSession(prev => ({ ...prev, payments, total_won }))
  }

  // ── Finish session ────────────────────────────────────────────────────
  const finish = async () => {
    if (!session) return
    await supabase.from('minigame_sessions').update({ status: 'done', spins_done: TOTAL_SPINS }).eq('id', session.id)
    // Update ranking
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase.from('minigame_ranking')
      .select('*').eq('stream_date', today).eq('username', session.username).single()
    if (existing) {
      await supabase.from('minigame_ranking').update({
        total_won: existing.total_won + session.total_won,
        sessions_count: existing.sessions_count + 1,
        updated_at: new Date().toISOString()
      }).eq('id', existing.id)
    } else {
      await supabase.from('minigame_ranking').insert({
        username: session.username,
        total_won: session.total_won,
        sessions_count: 1,
      })
    }
    setSession(null)
    loadRanking()
  }

  // ── Reset ranking ────────────────────────────────────────────────────
  const resetRanking = async () => {
    if (!confirm('Apagar todo o ranking de hoje?')) return
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('minigame_ranking').delete().eq('stream_date', today)
    setRanking([])
  }

  const s = {
    page:     { padding: '28px 24px', fontFamily: 'Rubik, sans-serif', maxWidth: 1100, color: '#fff' },
    topRow:   { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 },
    title:    { fontSize: '1.35em', fontWeight: 900, color: '#fff', margin: 0 },
    grid:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
    card:     { background: '#0d1017', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' },
    cardHead: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.05)', background: 'rgba(255,255,255,.02)', fontSize: '.78em', fontWeight: 700, color: 'rgba(255,255,255,.5)', letterSpacing: '.06em' },
    body:     { padding: 16 },
    label:    { fontSize: '.68em', fontWeight: 700, color: 'rgba(255,255,255,.32)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6, display: 'block' },
    input:    { width: '100%', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '9px 12px', color: '#fff', fontSize: '.88em', fontFamily: 'Rubik, sans-serif', outline: 'none' },
    row:      { display: 'flex', gap: 10, marginBottom: 14 },
    btn:      (c) => ({ padding: '10px 18px', borderRadius: 11, border: 'none', background: c, color: '#fff', fontWeight: 800, fontSize: '.83em', fontFamily: 'Rubik, sans-serif', cursor: 'pointer', whiteSpace: 'nowrap' }),
    btnSm:    (c) => ({ padding: '6px 14px', borderRadius: 8, border: 'none', background: c, color: '#fff', fontWeight: 700, fontSize: '.78em', fontFamily: 'Rubik, sans-serif', cursor: 'pointer' }),
    btnGhost: { padding: '10px 18px', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.45)', fontWeight: 700, fontSize: '.83em', fontFamily: 'Rubik, sans-serif', cursor: 'pointer' },
    empty:    { padding: '24px 16px', textAlign: 'center', fontSize: '.78em', color: 'rgba(255,255,255,.22)', fontStyle: 'italic' },
    payRow:   { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,.04)', marginBottom: 6 },
    rankRow:  (i) => ({ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: i === 0 ? 'rgba(251,191,36,.07)' : i === 1 ? 'rgba(180,180,180,.05)' : i === 2 ? 'rgba(180,100,50,.05)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,.04)' }),
  }

  const trophyColors = ['#fbbf24', '#cbd5e1', '#cd7c4d']
  const TrophyIcon = ({ color }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
      <path d="M12 17v4"/><path d="M8 21h8"/>
      <path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/>
    </svg>
  )

  return (
    <div style={s.page}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* Header */}
      <div style={s.topRow}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c6fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <h1 style={s.title}>Minigame</h1>
        {session && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.25)', fontSize: '.75em', fontWeight: 800, color: '#22c55e' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.4s ease-in-out infinite' }} />
            A JOGAR — {session.username}
          </div>
        )}
      </div>

      <div style={s.grid}>

        {/* LEFT — sessão atual ou nova */}
        <div>
          {!session ? (
            <div style={s.card}>
              <div style={s.cardHead}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c6fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                Nova Sessão
              </div>
              <div style={s.body}>
                <div style={{ marginBottom: 14 }}>
                  <span style={s.label}>Username</span>
                  <input style={s.input} placeholder="ex: TaxiSantos" value={username} onChange={e => setUsername(e.target.value)} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <span style={s.label}>Slot</span>
                  <SlotSearch value={slot} onChange={setSlot} />
                  {slot && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '8px 10px', borderRadius: 9, background: 'rgba(124,111,255,.08)', border: '1px solid rgba(124,111,255,.2)' }}>
                      <img src={slot.image_url} alt={slot.name} style={{ width: 36, height: 36, borderRadius: 7, objectFit: 'cover' }} onError={e => e.target.style.opacity = '.3'} />
                      <div>
                        <div style={{ fontSize: '.85em', fontWeight: 700, color: '#fff' }}>{slot.name}</div>
                        <div style={{ fontSize: '.72em', color: 'rgba(255,255,255,.4)' }}>{slot.provider}</div>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 18 }}>
                  <span style={s.label}>Aposta (€)</span>
                  <input style={s.input} type="number" step="0.01" placeholder="ex: 2.00" value={bet} onChange={e => setBet(e.target.value)} />
                </div>
                <button style={s.btn('linear-gradient(135deg, #7c6fff, #a78bfa)')}
                  onClick={start} disabled={!username || !slot || !bet || loading}>
                  {loading ? 'A iniciar...' : 'Iniciar Sessão'}
                </button>
              </div>
            </div>
          ) : (
            <div style={s.card}>
              <div style={s.cardHead}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Sessão Activa — {session.username}
              </div>
              <div style={s.body}>

                {/* Slot info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
                  {session.slot?.image_url && <img src={session.slot.image_url} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover' }} />}
                  <div>
                    <div style={{ fontSize: '1em', fontWeight: 800, color: '#fff' }}>{session.slot?.name || '—'}</div>
                    <div style={{ fontSize: '.75em', color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{session.slot?.provider} · Aposta: <strong style={{ color: '#f59e0b' }}>{session.bet}€</strong></div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: '.68em', color: 'rgba(255,255,255,.35)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Total</div>
                    <div style={{ fontSize: '1.4em', fontWeight: 900, color: '#22c55e' }}>{fmt(session.total_won)}</div>
                  </div>
                </div>

                {/* Spin balls */}
                <div style={{ marginBottom: 20 }}>
                  <SpinBalls spins={session.spins_done} />
                </div>

                {/* Spin controls */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
                  {[1, 5, 10, 20].map(n => (
                    <button key={n} style={s.btnSm('rgba(124,111,255,.2)')} onClick={() => addSpin(n)}>+{n}</button>
                  ))}
                  <button style={s.btnSm('rgba(239,68,68,.15)')}
                    onClick={() => { if(session.spins_done > 0) { supabase.from('minigame_sessions').update({ spins_done: session.spins_done - 1 }).eq('id', session.id); setSession(prev => ({ ...prev, spins_done: prev.spins_done - 1 })) } }}>
                    -1
                  </button>
                </div>
                {/* Complete phase buttons */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
                  <button
                    style={s.btnSm(session.spins_done < PHASE1 ? 'linear-gradient(135deg,#7c6fff,#a78bfa)' : 'rgba(255,255,255,.06)')}
                    disabled={session.spins_done >= PHASE1}
                    onClick={async () => {
                      await supabase.from('minigame_sessions').update({ spins_done: PHASE1 }).eq('id', session.id)
                      setSession(prev => ({ ...prev, spins_done: PHASE1 }))
                    }}>
                    {session.spins_done >= PHASE1 ? '✓ Phase 1' : 'Complete Phase 1'}
                  </button>
                  <button
                    style={s.btnSm(session.spins_done >= PHASE1 && session.spins_done < TOTAL_SPINS ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(255,255,255,.06)')}
                    disabled={session.spins_done < PHASE1 || session.spins_done >= TOTAL_SPINS}
                    onClick={async () => {
                      await supabase.from('minigame_sessions').update({ spins_done: TOTAL_SPINS }).eq('id', session.id)
                      setSession(prev => ({ ...prev, spins_done: TOTAL_SPINS }))
                    }}>
                    {session.spins_done >= TOTAL_SPINS ? '✓ Phase 2' : 'Complete Phase 2'}
                  </button>
                </div>

                {/* Add payment */}
                <div style={{ ...s.row, marginBottom: 20 }}>
                  <select style={{ ...s.input, flex: '0 0 100px' }} value={payType} onChange={e => setPayType(e.target.value)}>
                    <option value="win">+50x Win</option>
                    <option value="bonus">Bonus</option>
                  </select>
                  <input style={{ ...s.input, flex: 1 }} type="number" step="0.01" placeholder="Valor €" value={payValue} onChange={e => setPayValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addPayment()} />
                  <button style={s.btn('linear-gradient(135deg, #22c55e, #16a34a)')} onClick={addPayment}>Anotar</button>
                </div>

                {/* Payments list */}
                <div style={{ marginBottom: 20 }}>
                  {session.payments?.length === 0
                    ? <div style={s.empty}>Sem pagamentos ainda.</div>
                    : [...session.payments].reverse().map((p, i) => {
                      const realIdx = session.payments.length - 1 - i
                      return (
                        <div key={i} style={s.payRow}>
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: p.type === 'bonus' ? 'rgba(245,158,11,.15)' : 'rgba(124,111,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {p.type === 'bonus'
                              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c6fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '.8em', color: p.type === 'bonus' ? '#f59e0b' : '#a78bfa', fontWeight: 700 }}>{p.type === 'bonus' ? 'Bonus' : '+50x Win'}</span>
                            <span style={{ fontSize: '.72em', color: 'rgba(255,255,255,.3)', marginLeft: 6 }}>spin #{p.spin} · {p.multiplier}x</span>
                          </div>
                          <div style={{ fontSize: '.9em', fontWeight: 800, color: '#fff' }}>{fmt(p.value)}</div>
                          <button onClick={() => removePayment(realIdx)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.25)', cursor: 'pointer', fontSize: '1em', padding: '0 4px' }}>✕</button>
                        </div>
                      )
                    })
                  }
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={{ ...s.btn('linear-gradient(135deg, #f59e0b, #d97706)'), flex: 1 }} onClick={finish}>
                    Terminar Sessão
                  </button>
                  <button style={s.btnGhost} onClick={() => { if(confirm('Cancelar sessão sem guardar?')) { supabase.from('minigame_sessions').update({ status: 'done' }).eq('id', session.id); setSession(null) } }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Ranking */}
        <div style={s.card}>
          <div style={{ ...s.cardHead, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              Ranking do Stream
            </div>
            {ranking.length > 0 && (
              <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.25)', cursor: 'pointer', fontSize: '.72em', fontFamily: 'Rubik, sans-serif' }} onClick={resetRanking}>Apagar</button>
            )}
          </div>
          {ranking.length === 0
            ? <div style={s.empty}>Ainda sem resultados hoje.</div>
            : ranking.map((r, i) => (
              <div key={r.id} style={s.rankRow(i)}>
                <div style={{ width: 28, textAlign: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {i < 3 ? <TrophyIcon color={trophyColors[i]} /> : <span style={{ fontSize: '.82em', fontWeight: 800, color: 'rgba(255,255,255,.3)' }}>#{i + 1}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '.9em', fontWeight: 800, color: '#fff' }}>{r.username}</div>
                  <div style={{ fontSize: '.7em', color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{r.sessions_count} sess{r.sessions_count !== 1 ? 'ões' : 'ão'}</div>
                </div>
                <div style={{ fontSize: '1.05em', fontWeight: 900, color: i === 0 ? '#fbbf24' : i === 1 ? '#cbd5e1' : i === 2 ? '#cd7c4d' : '#fff' }}>
                  {fmt(r.total_won)}
                </div>
              </div>
            ))
          }
        </div>

      </div>
    </div>
  )
}