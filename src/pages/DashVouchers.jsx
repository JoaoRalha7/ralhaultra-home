import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './DashGiveaways.module.css'

const POINTS = [['500', '500'], ['1 000', '1000'], ['5 000', '5000'], ['10 000', '10000']]
const fmtDate = (d) => new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })
const randCode = () => { const a = new Uint32Array(2); crypto.getRandomValues(a); return (a[0].toString(36) + a[1].toString(36)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) }
const EMPTY = { code: '', points: '1000', max_uses: '100', expires: '' }

export default function DashVouchers({ switcher }) {
  const [list, setList] = useState(null)
  const [f, setF] = useState(EMPTY)
  const [msg, setMsg] = useState(null)
  const say = (text, err) => { setMsg({ text, err }); setTimeout(() => setMsg(null), 3500) }
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const ok = f.code.trim().length >= 3 && Number(f.points) > 0 && Number(f.max_uses) > 0

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('vouchers').select('*').order('created_at', { ascending: false })
    if (error) { say('Erro ao carregar. Já correste o vouchers.sql?', true); setList([]); return }
    setList(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const create = async (e) => {
    e.preventDefault()
    if (!ok) return
    const row = { code: f.code.trim().toUpperCase().replace(/\s+/g, ''), points: Number(f.points), max_uses: Number(f.max_uses), expires_at: f.expires ? new Date(f.expires + 'T23:59:59').toISOString() : null }
    const { error } = await supabase.from('vouchers').insert(row)
    if (error) { say(error.code === '23505' ? 'Esse código já existe.' : 'Erro ao criar o voucher.', true); return }
    setF(EMPTY); say('Voucher criado.'); load()
  }
  const toggle = async (v) => { await supabase.from('vouchers').update({ active: !v.active }).eq('code', v.code); load() }
  const remove = async (v) => {
    if (!window.confirm(`Apagar o voucher ${v.code}?`)) return
    await supabase.from('vouchers').delete().eq('code', v.code); load()
  }
  const copy = (code) => { navigator.clipboard?.writeText(code); say(`${code} copiado.`) }

  const rows = list || []
  const active = rows.filter((v) => v.active && v.uses < v.max_uses && (!v.expires_at || new Date(v.expires_at) > new Date()))
  const paid = rows.reduce((s, v) => s + v.uses * v.points, 0)

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Giveaways</h1>
        <p className={styles.sub}>Cria códigos de pontos. Cada pessoa só pode usar cada código uma vez.</p>
      </div>
      {switcher}

      <div className={styles.stats}>
        <div className={styles.stat}><small>Códigos</small><b>{rows.length}</b></div>
        <div className={styles.stat}><small>Ativos</small><b>{active.length}</b></div>
        <div className={styles.stat}><small>Usos</small><b>{rows.reduce((s, v) => s + v.uses, 0)}</b></div>
        <div className={styles.stat}><small>Pontos dados</small><b className={styles.gold}>{paid.toLocaleString('pt-PT')}</b></div>
      </div>

      <div className={styles.layout}>
        <form className={styles.panel} onSubmit={create}>
          <div className={styles.panelTitle}>Novo voucher</div>
          <label className={styles.fld}><span>Código</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="ex: WELCOME" value={f.code} maxLength={40} onChange={(e) => setF((s) => ({ ...s, code: e.target.value.toUpperCase().replace(/\s+/g, '') }))} />
              <button type="button" className={styles.chips} style={{ display: 'block', flex: '0 0 auto' }} onClick={() => setF((s) => ({ ...s, code: randCode() }))}>
                <span style={{ display: 'grid', placeItems: 'center', height: 44, padding: '0 14px', borderRadius: 12, border: '1px solid #1c1f27', background: '#08090c', color: '#7b8190', fontWeight: 700, fontSize: 13 }}>Gerar</span>
              </button>
            </div>
          </label>
          <div className={styles.fld}><span>Pontos</span>
            <div className={styles.chips}>
              {POINTS.map(([l, v]) => <button key={v} type="button" className={f.points === v ? styles.chipOn : ''} onClick={() => setF((s) => ({ ...s, points: v }))}>{l}</button>)}
            </div>
            <input type="number" min="1" placeholder="Outro valor" value={f.points} onChange={set('points')} />
          </div>
          <div className={styles.two}>
            <label className={styles.fld}><span>Máx. usos</span>
              <input type="number" min="1" value={f.max_uses} onChange={set('max_uses')} /></label>
            <label className={styles.fld}><span>Validade</span>
              <input type="date" value={f.expires} onChange={set('expires')} /></label>
          </div>
          <button type="submit" className={styles.cta} disabled={!ok}>Criar voucher</button>
          {msg && <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: msg.err ? '#f87171' : '#22e07a' }}>{msg.text}</p>}
        </form>

        <div className={styles.stage}>
          {list === null ? null : rows.length === 0 ? (
            <p className={styles.empty}>Ainda não há vouchers.</p>
          ) : rows.map((v) => {
            const expired = v.expires_at && new Date(v.expires_at) < new Date()
            const used = v.uses >= v.max_uses
            const state = !v.active ? 'Desativado' : expired ? 'Expirado' : used ? 'Esgotado' : 'Ativo'
            return (
              <div key={v.code} className={styles.card} style={{ alignItems: 'center', opacity: state === 'Ativo' ? 1 : 0.6 }}>
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardInfo}>
                      <div className={styles.cardPrize} style={{ letterSpacing: '.06em' }}>{v.code}</div>
                      <div className={styles.cardTitle}>
                        <b className={styles.gold}>{Number(v.points).toLocaleString('pt-PT')} pts</b> · {v.uses}/{v.max_uses} usos{v.expires_at ? ` · até ${fmtDate(v.expires_at)}` : ''} · {state}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className={styles.chips} style={{ display: 'block' }} onClick={() => copy(v.code)}><span style={{ display: 'grid', placeItems: 'center', height: 34, padding: '0 12px', borderRadius: 10, border: '1px solid #1c1f27', background: '#08090c', color: '#eef1f7', fontWeight: 700, fontSize: 13 }}>Copiar</span></button>
                  <button type="button" className={styles.chips} style={{ display: 'block' }} onClick={() => toggle(v)}><span style={{ display: 'grid', placeItems: 'center', height: 34, padding: '0 12px', borderRadius: 10, border: '1px solid #1c1f27', background: '#08090c', color: '#eef1f7', fontWeight: 700, fontSize: 13 }}>{v.active ? 'Desativar' : 'Ativar'}</span></button>
                  <button type="button" className={styles.chips} style={{ display: 'block' }} onClick={() => remove(v)}><span style={{ display: 'grid', placeItems: 'center', height: 34, padding: '0 12px', borderRadius: 10, border: '1px solid #1c1f27', background: '#08090c', color: '#f87171', fontWeight: 700, fontSize: 13 }}>Apagar</span></button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
