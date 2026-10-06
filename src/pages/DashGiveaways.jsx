import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './DashGiveaways.module.css'

const EMPTY = { prize: '', title: '', description: '', kind: 'giveaway', ends_at: '', image_url: '', ticket_cost: '0', max_tickets: '' }
const fmtDate = (d) => new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const pick = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n }

export default function DashGiveaways() {
  const [list, setList] = useState(null)
  const [entries, setEntries] = useState([])
  const [f, setF] = useState(EMPTY)
  const [msg, setMsg] = useState(null)
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

  const create = async (e) => {
    e.preventDefault()
    if (!ok) return
    const { error } = await supabase.from('giveaways').insert({
      prize: f.prize.trim(), title: f.title.trim(), description: f.description.trim() || null, kind: f.kind,
      ends_at: new Date(f.ends_at).toISOString(), image_url: f.image_url.trim() || null,
      ticket_cost: Math.max(0, parseInt(f.ticket_cost, 10) || 0), max_tickets: parseInt(f.max_tickets, 10) || null,
    })
    if (error) return say(error.message, true)
    setF(EMPTY); say('Criado.'); load()
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

  const stats = (id) => {
    const rows = entries.filter((x) => x.giveaway_id === id)
    return { tickets: rows.reduce((n, x) => n + (x.tickets || 1), 0), people: new Set(rows.map((x) => x.user_id)).size }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>GIVEAWAYS &amp; RAFFLES</div>
        <div className={styles.sub}>Criar e gerir os sorteios da página pública. Bilhetes pagos com pontos.</div>
      </div>

      <form className={styles.form} onSubmit={create}>
        <b>Novo giveaway</b>
        <input placeholder="Prémio (ex: PS5 + GTA VI)" value={f.prize} onChange={set('prize')} />
        <input placeholder="Título" value={f.title} onChange={set('title')} />
        <input placeholder="Descrição (opcional)" value={f.description} onChange={set('description')} />
        <select value={f.kind} onChange={set('kind')}><option value="giveaway">Giveaway</option><option value="raffle">Raffle</option></select>
        <input type="datetime-local" value={f.ends_at} onChange={set('ends_at')} />
        <input type="number" min="0" placeholder="Custo do bilhete (pts, 0 = grátis)" value={f.ticket_cost} onChange={set('ticket_cost')} />
        <input type="number" min="1" placeholder="Máx. bilhetes (vazio = ilimitado)" value={f.max_tickets} onChange={set('max_tickets')} />
        <input placeholder="URL da imagem (opcional)" value={f.image_url} onChange={set('image_url')} />
        <button type="submit" disabled={!ok}>Criar</button>
      </form>

      {list === null ? <p className={styles.empty}>A carregar…</p> : list.length === 0 ? <p className={styles.empty}>Ainda não há giveaways.</p> : (
        <div className={styles.table}>
          <div className={`${styles.row} ${styles.head}`}><span>Prémio</span><span>Tipo</span><span>Termina</span><span>Custo</span><span>Bilhetes</span><span>Estado</span><span /></div>
          {list.map((g) => {
            const st = stats(g.id)
            const over = g.status === 'ended' || new Date(g.ends_at) <= new Date()
            return (
              <div className={styles.row} key={g.id}>
                <span className={styles.prize}><b>{g.prize}</b><small>{g.title}</small></span>
                <span>{g.kind === 'raffle' ? 'Raffle' : 'Giveaway'}</span>
                <span>{fmtDate(g.ends_at)}</span>
                <span>{g.ticket_cost > 0 ? `${g.ticket_cost} pts` : 'Grátis'}{g.max_tickets ? ` · máx ${g.max_tickets}` : ''}</span>
                <span>{st.tickets} <small>({st.people} jogadores)</small></span>
                <span className={g.winner ? styles.won : over ? styles.ended : styles.live}>{g.winner ? `Vencedor: ${g.winner}` : over ? 'Terminado' : 'Ativo'}</span>
                <span className={styles.acts}>
                  {!g.winner && st.tickets > 0 && <button type="button" onClick={() => draw(g)}>{over ? 'Sortear' : 'Terminar e sortear'}</button>}
                  {!over && <button type="button" onClick={() => end(g)}>Terminar</button>}
                  <button type="button" className={styles.del} onClick={() => del(g)}>Apagar</button>
                </span>
              </div>
            )
          })}
        </div>
      )}
      {msg && <div className={`${styles.toast} ${msg.err ? styles.err : ''}`}>{msg.text}</div>}
    </div>
  )
}
