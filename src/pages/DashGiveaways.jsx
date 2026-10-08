import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import DashVouchers from './DashVouchers'
import styles from './DashGiveaways.module.css'

const EMPTY = { prize: '', title: '', description: '', kind: 'giveaway', ends_at: '', image_url: '', ticket_cost: '0', max_tickets: '' }
const DURATIONS = [['1 h', 1], ['24 h', 24], ['7 dias', 168], ['30 dias', 720]]
const COSTS = [['Grátis', '0'], ['100', '100'], ['500', '500'], ['1000', '1000']]
const fmtDate = (d) => new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const pick = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n }
const pad = (n) => String(n).padStart(2, '0')
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const left = (end) => {
  const ms = new Date(end) - Date.now()
  if (ms <= 0) return null
  const m = Math.floor(ms / 60000)
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60
  return d > 0 ? `${d}d ${h}h` : `${h}h ${pad(mi)}m`
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const WEEK = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
const TIMES = ['18:00', '20:00', '22:00', '00:00']
const parseLocal = (v) => (v ? new Date(v) : null)
const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

function DatePick({ value, onChange }) {
  const cur = parseLocal(value)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => { const d = cur || new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const box = useRef(null)

  useEffect(() => {
    if (!open) return
    const out = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', out)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc) }
  }, [open])

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const first = new Date(view.getFullYear(), view.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7 // segunda = 0
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))]

  const hh = cur ? cur.getHours() : 22
  const mm = cur ? cur.getMinutes() : 0
  const emit = (d) => onChange(toLocalInput(d))
  const pickDay = (d) => { const n = new Date(d); n.setHours(hh, mm, 0, 0); emit(n) }
  const setTime = (h, m) => {
    const n = cur ? new Date(cur) : new Date(today.getTime() + 86400000)
    n.setHours(h, m, 0, 0); emit(n)
  }
  const prevOk = new Date(view.getFullYear(), view.getMonth(), 0) >= today

  const label = cur
    ? `${cur.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })} · ${pad(cur.getHours())}:${pad(cur.getMinutes())}`
    : 'Escolher data e hora'
  const hint = cur ? (cur <= new Date() ? 'Já passou' : `Daqui a ${left(cur)}`) : null

  return (
    <div className={styles.dp} ref={box}>
      <button type="button" className={`${styles.dpBtn} ${open ? styles.dpBtnOpen : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
        <span className={cur ? '' : styles.dpPh}>{label}</span>
        {hint && <em className={cur <= new Date() ? styles.dpBad : ''}>{hint}</em>}
      </button>

      {open && (
        <div className={styles.dpPop}>
          <div className={styles.dpHead}>
            <button type="button" aria-label="Mês anterior" disabled={!prevOk} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <b>{MONTHS[view.getMonth()]} {view.getFullYear()}</b>
            <button type="button" aria-label="Mês seguinte" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
          <div className={styles.dpGrid}>
            {WEEK.map((w, i) => <span key={i} className={styles.dpW}>{w}</span>)}
            {cells.map((d, i) => d ? (
              <button key={i} type="button" disabled={d < today}
                className={`${styles.dpD} ${cur && same(d, cur) ? styles.dpOn : ''} ${same(d, today) ? styles.dpToday : ''}`}
                onClick={() => pickDay(d)}>{d.getDate()}</button>
            ) : <span key={i} />)}
          </div>
          <div className={styles.dpTime}>
            <div className={styles.dpCols}>
              <div className={styles.dpCol} role="listbox" aria-label="Hora" ref={(el) => el && (el.scrollTop = Math.max(0, hh * 30 - 60))}>
                {Array.from({ length: 24 }, (_, h) => (
                  <button key={h} type="button" role="option" aria-selected={h === hh} className={h === hh ? styles.dpColOn : ''} onClick={() => setTime(h, mm)}>{pad(h)}</button>
                ))}
              </div>
              <span className={styles.dpColon}>:</span>
              <div className={styles.dpCol} role="listbox" aria-label="Minutos">
                {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                  <button key={m} type="button" role="option" aria-selected={m === mm - (mm % 5)} className={m === mm - (mm % 5) ? styles.dpColOn : ''} onClick={() => setTime(hh, m)}>{pad(m)}</button>
                ))}
              </div>
            </div>
            <div className={styles.dpQuick}>
              {TIMES.map((t) => {
                const [h, m] = t.split(':').map(Number)
                return <button key={t} type="button" className={hh === h && mm === m ? styles.dpQOn : ''} onClick={() => setTime(h, m)}>{t}</button>
              })}
            </div>
          </div>
          <button type="button" className={styles.dpDone} onClick={() => setOpen(false)}>Confirmar</button>
        </div>
      )}
    </div>
  )
}

export default function DashGiveaways() {
  const [list, setList] = useState(null)
  const [entries, setEntries] = useState([])
  const [f, setF] = useState(EMPTY)
  const [tab, setTab] = useState('active')
  const [section, setSection] = useState('giveaways')
  const [dur, setDur] = useState(null)
  const [msg, setMsg] = useState(null)
  const [, tick] = useState(0)
  const say = (text, err) => { setMsg({ text, err }); setTimeout(() => setMsg(null), 3500) }
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const ok = f.prize.trim() && f.title.trim() && f.ends_at

  const load = useCallback(async () => {
    const [g, e] = await Promise.all([
      supabase.from('giveaways').select('*').order('created_at', { ascending: false }),
      supabase.from('giveaway_entries').select('giveaway_id,user_id,twitch_username,tickets'),
    ])
    setList(g.error ? [] : g.data || [])
    setEntries(e.error ? [] : e.data || [])
    if (g.error) say(g.error.message, true)
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t) }, [])

  const setDuration = (h) => {
    setDur(h)
    setF((s) => ({ ...s, ends_at: toLocalInput(new Date(Date.now() + h * 3600000)) }))
  }

  const create = async (e) => {
    e.preventDefault()
    if (!ok) return
    const { error } = await supabase.from('giveaways').insert({
      prize: f.prize.trim(), title: f.title.trim(), description: f.description.trim() || null, kind: f.kind,
      ends_at: new Date(f.ends_at).toISOString(), image_url: f.image_url.trim() || null,
      ticket_cost: Math.max(0, parseInt(f.ticket_cost, 10) || 0), max_tickets: parseInt(f.max_tickets, 10) || null,
    })
    if (error) return say(error.message, true)
    setF(EMPTY); setDur(null); say('Criado.'); load()
  }

  const draw = async (g) => {
    const pool = entries.filter((x) => x.giveaway_id === g.id).flatMap((x) => Array(x.tickets || 1).fill(x))
    if (!pool.length) return say('Sem participantes.', true)
    const w = pool[pick(pool.length)].twitch_username
    const { error } = await supabase.from('giveaways').update({ winner: w, status: 'ended' }).eq('id', g.id)
    if (error) return say(error.message, true)
    say(`Vencedor: ${w}`); load()
  }

  const end = async (g) => {
    const { error } = await supabase.from('giveaways').update({ status: 'ended' }).eq('id', g.id)
    if (error) return say(error.message, true)
    load()
  }

  const del = async (g) => {
    if (!window.confirm(`Apagar "${g.prize}"?`)) return
    const { error } = await supabase.from('giveaways').delete().eq('id', g.id)
    if (error) return say(error.message, true)
    load()
  }

  const stats = useCallback((id) => {
    const rows = entries.filter((x) => x.giveaway_id === id)
    return { tickets: rows.reduce((n, x) => n + (x.tickets || 1), 0), people: new Set(rows.map((x) => x.user_id)).size }
  }, [entries])

  const isOver = (g) => g.status === 'ended' || new Date(g.ends_at) <= new Date()
  const active = useMemo(() => (list || []).filter((g) => !isOver(g)), [list]) // eslint-disable-line
  const done = useMemo(() => (list || []).filter((g) => isOver(g)), [list]) // eslint-disable-line

  const totals = useMemo(() => {
    const ids = new Set(active.map((g) => g.id))
    const rows = entries.filter((x) => ids.has(x.giveaway_id))
    const spent = (list || []).reduce((n, g) => n + (g.ticket_cost || 0) * entries.filter((x) => x.giveaway_id === g.id).reduce((a, x) => a + (x.tickets || 1), 0), 0)
    return {
      tickets: rows.reduce((n, x) => n + (x.tickets || 1), 0),
      people: new Set(rows.map((x) => x.user_id)).size,
      spent,
    }
  }, [active, entries, list])

  const shown = tab === 'active' ? active : done
  const switcher = (
    <div className={styles.tabs}>
      <button type="button" className={section === 'giveaways' ? styles.tabOn : ''} onClick={() => setSection('giveaways')}>Giveaways</button>
      <button type="button" className={section === 'vouchers' ? styles.tabOn : ''} onClick={() => setSection('vouchers')}>Vouchers</button>
    </div>
  )
  if (section === 'vouchers') return <DashVouchers switcher={switcher} />

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Giveaways</h1>
        <p className={styles.sub}>Cria e gere os sorteios da página pública. Os bilhetes são pagos com pontos.</p>
      </div>
      {switcher}

      <div className={styles.stats}>
        <div className={styles.stat}><small>Ativos</small><b>{active.length}</b></div>
        <div className={styles.stat}><small>Bilhetes</small><b>{totals.tickets}</b></div>
        <div className={styles.stat}><small>Jogadores</small><b>{totals.people}</b></div>
        <div className={styles.stat}><small>Pontos gastos</small><b className={styles.gold}>{totals.spent.toLocaleString('pt-PT')}</b></div>
      </div>

      <div className={styles.layout}>
        <form className={styles.panel} onSubmit={create}>
          <div className={styles.panelTitle}>Novo giveaway</div>

          <div className={styles.seg}>
            <button type="button" className={f.kind === 'giveaway' ? styles.segOn : ''} onClick={() => setF((s) => ({ ...s, kind: 'giveaway' }))}>Giveaway</button>
            <button type="button" className={f.kind === 'raffle' ? styles.segOn : ''} onClick={() => setF((s) => ({ ...s, kind: 'raffle' }))}>Raffle</button>
          </div>

          <label className={styles.fld}><span>Prémio</span>
            <input placeholder="ex: PS5 + GTA VI" value={f.prize} onChange={set('prize')} /></label>
          <label className={styles.fld}><span>Título</span>
            <input placeholder="ex: Sorteio de outubro" value={f.title} onChange={set('title')} /></label>

          <div className={styles.fld}><span>Termina em</span>
            <div className={styles.chips}>
              {DURATIONS.map(([l, h]) => (
                <button key={h} type="button" className={dur === h ? styles.chipOn : ''} onClick={() => setDuration(h)}>{l}</button>
              ))}
            </div>
            <DatePick value={f.ends_at} onChange={(v) => { setDur(null); setF((s) => ({ ...s, ends_at: v })) }} />
          </div>

          <div className={styles.fld}><span>Custo do bilhete (pts)</span>
            <div className={styles.chips}>
              {COSTS.map(([l, v]) => (
                <button key={v} type="button" className={f.ticket_cost === v ? styles.chipOn : ''} onClick={() => setF((s) => ({ ...s, ticket_cost: v }))}>{l}</button>
              ))}
            </div>
            <input type="number" min="0" placeholder="Outro valor" value={f.ticket_cost} onChange={set('ticket_cost')} />
          </div>

          <div className={styles.two}>
            <label className={styles.fld}><span>Máx. bilhetes</span>
              <input type="number" min="1" placeholder="Sem limite" value={f.max_tickets} onChange={set('max_tickets')} /></label>
            <label className={styles.fld}><span>Imagem</span>
              <input placeholder="URL (opcional)" value={f.image_url} onChange={set('image_url')} /></label>
          </div>

          <label className={styles.fld}><span>Descrição</span>
            <input placeholder="Opcional" value={f.description} onChange={set('description')} /></label>

          <button type="submit" className={styles.cta} disabled={!ok}>Criar giveaway</button>
        </form>

        <div className={styles.stage}>
          <div className={styles.tabs}>
            <button type="button" className={tab === 'active' ? styles.tabOn : ''} onClick={() => setTab('active')}>Ativos <i>{active.length}</i></button>
            <button type="button" className={tab === 'done' ? styles.tabOn : ''} onClick={() => setTab('done')}>Terminados <i>{done.length}</i></button>
          </div>

          {list === null ? null : shown.length === 0 ? (
            <p className={styles.empty}>{tab === 'active' ? 'Sem giveaways ativos.' : 'Ainda não há giveaways terminados.'}</p>
          ) : shown.map((g) => {
            const st = stats(g.id)
            const over = isOver(g)
            const soon = !over && new Date(g.ends_at) - Date.now() < 3600000
            const pct = g.max_tickets ? Math.min(100, Math.round((st.tickets / g.max_tickets) * 100)) : null
            return over ? (
              <div className={styles.rowDone} key={g.id}>
                <div className={styles.thumbSm}>{g.image_url && <img src={g.image_url} alt="" />}</div>
                <div className={styles.rowMain}>
                  <div className={styles.rowName}>{g.prize}</div>
                  <div className={styles.rowSub}>{g.kind === 'raffle' ? 'Raffle' : 'Giveaway'} · terminou a {fmtDate(g.ends_at)} · {st.tickets} bilhetes</div>
                </div>
                {g.winner ? (
                  <div className={styles.winner}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5h4" /><path d="M18 9h2a2 2 0 0 0 2-2V5h-4" /><path d="M12 17v4M8 21h8M6 9a6 6 0 0 0 12 0V3H6v6z" /></svg>
                    {g.winner}
                  </div>
                ) : st.tickets > 0 ? (
                  <button type="button" className={styles.primary} onClick={() => draw(g)}>Sortear</button>
                ) : <span className={styles.muted}>Sem participantes</span>}
                <button type="button" className={styles.ghost} onClick={() => del(g)}>Apagar</button>
              </div>
            ) : (
              <div className={styles.card} key={g.id}>
                <div className={styles.thumb}>{g.image_url && <img src={g.image_url} alt="" />}</div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardInfo}>
                      <div className={styles.badges}>
                        <span className={styles.kind}>{g.kind === 'raffle' ? 'Raffle' : 'Giveaway'}</span>
                        <span className={`${styles.state} ${soon ? styles.stateSoon : ''}`}><i />{soon ? 'A terminar' : 'Ativo'}</span>
                      </div>
                      <div className={styles.cardPrize}>{g.prize}</div>
                      <div className={styles.cardTitle}>{g.title}</div>
                    </div>
                    <div className={styles.time}>
                      <b className={soon ? styles.gold : ''}>{left(g.ends_at) || '0h 00m'}</b>
                      <small>{fmtDate(g.ends_at)}</small>
                    </div>
                  </div>
                  <div>
                    <div className={styles.meter}>
                      <span><b>{st.tickets}</b> bilhetes · {st.people} jogadores</span>
                      <span>{g.ticket_cost > 0 ? `${g.ticket_cost} pts cada` : 'Grátis'}{g.max_tickets ? ` · máx ${g.max_tickets}` : ''}</span>
                    </div>
                    <div className={styles.bar}><div style={{ width: `${pct ?? (st.tickets ? 100 : 0)}%` }} className={pct === null ? styles.barFlat : ''} /></div>
                  </div>
                  <div className={styles.acts}>
                    {st.tickets > 0 && <button type="button" className={styles.primary} onClick={() => draw(g)}>Terminar e sortear</button>}
                    <button type="button" className={styles.ghost} onClick={() => end(g)}>Terminar</button>
                    <button type="button" className={`${styles.ghost} ${styles.push}`} onClick={() => del(g)}>Apagar</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {msg && <div className={`${styles.toast} ${msg.err ? styles.err : ''}`}>{msg.text}</div>}
    </div>
  )
}
