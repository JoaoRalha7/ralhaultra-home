import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './DashBot.module.css'

const ACCESS = [['everyone', 'Everyone'], ['sub', 'Subs'], ['vip', 'VIPs'], ['mod', 'Mods'], ['broadcaster', 'Só eu']]
const EMPTY_CMD = { name: '', response: '', enabled: true, global_cooldown: 5, user_cooldown: 15, access: 'everyone' }
const EMPTY_TIMER = { name: '', message: '', enabled: true, interval_online: 10, interval_offline: 0, min_lines: 5 }

function Toggle({ on, onChange }) {
  return <button type="button" role="switch" aria-checked={on} className={`${styles.tg} ${on ? styles.tgOn : ''}`} onClick={() => onChange(!on)}><i /></button>
}

function Editor({ kind, row, onSave, onCancel, busy, error }) {
  const [f, setF] = useState(row)
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const num = (k) => (e) => set(k, e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value)) || 0))
  const isCmd = kind === 'cmd'
  const ok = isCmd ? f.name.trim() && f.response.trim() : f.name.trim() && f.message.trim()
  return (
    <div className={styles.editor}>
      <div className={styles.grid}>
        <label className={styles.fld}><span>{isCmd ? 'Comando' : 'Nome'}</span>
          <input value={f.name} maxLength={40} placeholder={isCmd ? 'loja  (sem !)' : 'Site - Ralha.pt'} onChange={(e) => set('name', isCmd ? e.target.value.replace(/^!/, '').replace(/\s/g, '').toLowerCase() : e.target.value)} />
        </label>
        {isCmd ? (
          <label className={styles.fld}><span>Quem pode usar</span>
            <select value={f.access} onChange={(e) => set('access', e.target.value)}>{ACCESS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
        ) : (
          <label className={styles.fld}><span>Mín. linhas de chat</span><input type="number" min="0" value={f.min_lines} onChange={num('min_lines')} /></label>
        )}
      </div>
      <label className={styles.fld}><span>{isCmd ? 'Resposta' : 'Mensagem'}</span>
        <textarea rows={3} maxLength={450} value={isCmd ? f.response : f.message} onChange={(e) => set(isCmd ? 'response' : 'message', e.target.value)} placeholder={isCmd ? 'Olá {user}! ...' : 'TODAS AS OFERTAS EM -> jralha.com'} />
      </label>
      {isCmd ? (
        <div className={styles.grid}>
          <label className={styles.fld}><span>Cooldown global (s)</span><input type="number" min="0" value={f.global_cooldown} onChange={num('global_cooldown')} /></label>
          <label className={styles.fld}><span>Cooldown por pessoa (s)</span><input type="number" min="0" value={f.user_cooldown} onChange={num('user_cooldown')} /></label>
        </div>
      ) : (
        <div className={styles.grid}>
          <label className={styles.fld}><span>Intervalo online (min)</span><input type="number" min="0" value={f.interval_online} onChange={num('interval_online')} /></label>
          <label className={styles.fld}><span>Intervalo offline (min, 0 = desligado)</span><input type="number" min="0" value={f.interval_offline} onChange={num('interval_offline')} /></label>
        </div>
      )}
      {isCmd && <p className={styles.hint}>Variáveis: <b>{'{user}'}</b> quem escreveu, <b>{'{touser}'}</b> a pessoa mencionada, <b>{'{args}'}</b> o texto a seguir ao comando.</p>}
      {error && <p className={`${styles.msg} ${styles.err}`}>{error}</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.ghost} onClick={onCancel}>Cancelar</button>
        <button type="button" className={styles.primary} disabled={!ok || busy} onClick={() => onSave(isCmd
            ? { name: f.name.trim(), response: f.response.trim(), enabled: f.enabled, access: f.access, global_cooldown: Number(f.global_cooldown) || 0, user_cooldown: Number(f.user_cooldown) || 0 }
            : { name: f.name.trim(), message: f.message.trim(), enabled: f.enabled, interval_online: Number(f.interval_online) || 0, interval_offline: Number(f.interval_offline) || 0, min_lines: Number(f.min_lines) || 0 })}>{busy ? 'A guardar...' : 'Guardar'}</button>
      </div>
    </div>
  )
}

export default function DashBot() {
  const [tab, setTab] = useState('cmd')
  const [cmds, setCmds] = useState([])
  const [timers, setTimers] = useState([])
  const [editing, setEditing] = useState(null) // { id|null, row }
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [loadErr, setLoadErr] = useState('')
  const table = tab === 'cmd' ? 'bot_commands' : 'bot_timers'

  const load = useCallback(async () => {
    const [c, t] = await Promise.all([
      supabase.from('bot_commands').select('*').order('name'),
      supabase.from('bot_timers').select('*').order('name'),
    ])
    if (c.error || t.error) setLoadErr('Não consegui carregar. Corre o supabase/bot_commands.sql no Supabase.')
    else setLoadErr('')
    setCmds(c.data || []); setTimers(t.data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const save = async (row) => {
    setBusy(true); setErr('')
    const payload = row
    const q = editing.id ? supabase.from(table).update(payload).eq('id', editing.id) : supabase.from(table).insert(payload)
    const { error } = await q
    setBusy(false)
    if (error) { setErr(/duplicate|unique/i.test(error.message) ? 'Já existe um comando com esse nome.' : error.message); return }
    setEditing(null); load()
  }
  const toggle = async (r, on) => {
    const set = tab === 'cmd' ? setCmds : setTimers
    set((l) => l.map((x) => (x.id === r.id ? { ...x, enabled: on } : x)))
    const { error } = await supabase.from(table).update({ enabled: on }).eq('id', r.id)
    if (error) load()
  }
  const remove = async (r) => {
    if (!window.confirm(`Apagar "${r.name}"?`)) return
    await supabase.from(table).delete().eq('id', r.id)
    load()
  }
  const start = (id, row) => { setErr(''); setEditing({ id, row }) }
  const list = tab === 'cmd' ? cmds : timers

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Bot</h1>
        <p className={styles.sub}>Comandos e timers do chat. As alterações chegam ao bot em ~30 segundos, sem deploy.</p>
      </div>
      <div className={styles.tabs}>
        <button type="button" className={tab === 'cmd' ? styles.tabOn : ''} onClick={() => { setTab('cmd'); setEditing(null) }}>Comandos <b>{cmds.length}</b></button>
        <button type="button" className={tab === 'timer' ? styles.tabOn : ''} onClick={() => { setTab('timer'); setEditing(null) }}>Timers <b>{timers.length}</b></button>
        <button type="button" className={styles.add} onClick={() => start(null, tab === 'cmd' ? EMPTY_CMD : EMPTY_TIMER)}>{tab === 'cmd' ? 'Novo comando' : 'Novo timer'}</button>
      </div>
      {loadErr && <p className={`${styles.msg} ${styles.err}`}>{loadErr}</p>}
      {editing && !editing.id && <Editor key="new" kind={tab} row={editing.row} onSave={save} onCancel={() => setEditing(null)} busy={busy} error={err} />}
      <div className={styles.list}>
        {list.length === 0 && !loadErr && <p className={styles.hint}>Ainda não há nada aqui.</p>}
        {list.map((r) => (
          <div key={r.id} className={styles.item}>
            <div className={styles.row}>
              <Toggle on={r.enabled} onChange={(v) => toggle(r, v)} />
              <b className={styles.name}>{tab === 'cmd' ? `!${r.name}` : r.name}</b>
              <span className={styles.text}>{tab === 'cmd' ? r.response : r.message}</span>
              <span className={styles.meta}>{tab === 'cmd'
                ? `${ACCESS.find((a) => a[0] === r.access)?.[1] || r.access} · ${r.global_cooldown}s / ${r.user_cooldown}s`
                : `${r.interval_online || '-'} min online · ${r.interval_offline || '-'} min offline · ${r.min_lines} linhas`}</span>
              <button type="button" className={styles.ghost} onClick={() => start(r.id, r)}>Editar</button>
              <button type="button" className={styles.del} aria-label="Apagar" onClick={() => remove(r)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
            {editing?.id === r.id && <Editor key={r.id} kind={tab} row={editing.row} onSave={save} onCancel={() => setEditing(null)} busy={busy} error={err} />}
          </div>
        ))}
      </div>
      <p className={styles.hint}>Comandos do sistema (!points, !watchtime, !level, !top, !addpoints) já existem e não se editam aqui.</p>
    </div>
  )
}
