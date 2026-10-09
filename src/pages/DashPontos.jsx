import { useEffect, useState } from 'react'
import { adminPoints, workerPost, WORKER } from '../lib/points'
import styles from './DashPontos.module.css'

const fmt = (n) => Number(n || 0).toLocaleString('pt-PT')
const CHIPS = [100, 500, 1000, 5000, 10000]
const cleanName = (v) => v.trim().replace(/^@/, '').toLowerCase()

export default function DashPontos() {
  // ── individual ──
  const [user, setUser] = useState('')
  const [amt, setAmt] = useState('')
  const [bal, setBal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  // ── everybody ──
  const [allAmt, setAllAmt] = useState('')
  const [allWhy, setAllWhy] = useState('')
  const [ask, setAsk] = useState(null) // { sign } while waiting for the second click
  const [allBusy, setAllBusy] = useState(false)
  const [allMsg, setAllMsg] = useState(null)

  const name = cleanName(user)
  const n = Math.floor(Number(amt)) || 0
  const nAll = Math.floor(Number(allAmt)) || 0

  // current balance of the typed viewer
  useEffect(() => {
    setBal(null)
    if (!/^[a-z0-9_]{2,30}$/.test(name)) return undefined
    let alive = true
    const t = setTimeout(() => {
      fetch(`${WORKER}/?username=${encodeURIComponent(name)}`).then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive) setBal(d && d.points != null ? Number(d.points) : -1) }).catch(() => { if (alive) setBal(-1) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [name])

  const apply = async (sign) => {
    if (!name || n <= 0 || busy) return
    setBusy(true); setMsg(null)
    const { ok, data } = await adminPoints(name, sign * n)
    setBusy(false)
    if (!ok) { setMsg({ err: true, text: data?.error === 'insufficient points' ? 'Esse jogador não tem pontos suficientes.' : (data?.error || 'Erro ao atualizar.') }); return }
    setBal(data.newPoints ?? null)
    setMsg({ text: `${sign > 0 ? '+' : '-'}${fmt(n)} pts para ${name}. Saldo: ${fmt(data.newPoints)}` })
    setAmt('')
  }

  const applyAll = async () => {
    if (!ask || nAll <= 0 || allBusy) return
    setAllBusy(true); setAllMsg(null)
    const { ok, data } = await workerPost('/admin/points-all', { amount: ask.sign * nAll, reason: allWhy.trim() })
    setAllBusy(false); setAsk(null)
    if (!ok) { setAllMsg({ err: true, text: data?.error || 'Erro ao atualizar.' }); return }
    setAllMsg({ text: `${ask.sign > 0 ? '+' : '-'}${fmt(nAll)} pts aplicados a ${fmt(data.changed)} membros.` })
    setAllAmt(''); setAllWhy('')
  }

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Pontos</h1>
        <p className={styles.sub}>Adicionar ou retirar pontos a um jogador, ou a todos os membros com login no site.</p>
      </div>

      <div className={styles.cols}>
        <section className={styles.panel}>
          <div className={styles.panelTitle}>Um jogador</div>
          <label className={styles.fld}><span>Username</span>
            <input value={user} onChange={(e) => { setUser(e.target.value); setMsg(null) }} placeholder="ex: the__unknowned" autoComplete="off" spellCheck={false} />
          </label>
          {name && bal != null && <div className={styles.bal}>{bal < 0 ? 'Jogador não encontrado' : <>Saldo atual <b>{fmt(bal)}</b> pts</>}</div>}
          <label className={styles.fld}><span>Pontos</span>
            <input type="number" min="1" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="ex: 1000" />
          </label>
          <div className={styles.chips}>{CHIPS.map((c) => <button key={c} type="button" onClick={() => setAmt(String(c))}>{fmt(c)}</button>)}</div>
          <div className={styles.two}>
            <button type="button" className={styles.add} disabled={!name || n <= 0 || busy} onClick={() => apply(1)}>Adicionar</button>
            <button type="button" className={styles.sub2} disabled={!name || n <= 0 || busy} onClick={() => apply(-1)}>Retirar</button>
          </div>
          {msg && <p className={`${styles.msg} ${msg.err ? styles.err : ''}`}>{msg.text}</p>}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelTitle}>Todos os membros com login</div>
          <label className={styles.fld}><span>Pontos para cada um</span>
            <input type="number" min="1" value={allAmt} onChange={(e) => { setAllAmt(e.target.value); setAsk(null) }} placeholder="ex: 500" />
          </label>
          <div className={styles.chips}>{CHIPS.map((c) => <button key={c} type="button" onClick={() => { setAllAmt(String(c)); setAsk(null) }}>{fmt(c)}</button>)}</div>
          <label className={styles.fld}><span>Motivo (opcional, fica no registo)</span>
            <input value={allWhy} onChange={(e) => setAllWhy(e.target.value)} placeholder="ex: evento de aniversário" maxLength={60} />
          </label>
          {!ask ? (
            <div className={styles.two}>
              <button type="button" className={styles.add} disabled={nAll <= 0 || allBusy} onClick={() => setAsk({ sign: 1 })}>Dar a todos</button>
              <button type="button" className={styles.sub2} disabled={nAll <= 0 || allBusy} onClick={() => setAsk({ sign: -1 })}>Retirar a todos</button>
            </div>
          ) : (
            <div className={styles.confirm}>
              <p>{ask.sign > 0 ? 'Dar' : 'Retirar'} <b>{fmt(nAll)}</b> pts {ask.sign > 0 ? 'a' : 'de'} <b>todos</b> os membros com login no site? Isto não se desfaz com um clique.</p>
              <div className={styles.two}>
                <button type="button" className={styles.cancel} onClick={() => setAsk(null)} disabled={allBusy}>Cancelar</button>
                <button type="button" className={ask.sign > 0 ? styles.add : styles.sub2} onClick={applyAll} disabled={allBusy}>{allBusy ? 'A aplicar…' : 'Confirmar'}</button>
              </div>
            </div>
          )}
          {allMsg && <p className={`${styles.msg} ${allMsg.err ? styles.err : ''}`}>{allMsg.text}</p>}
          <p className={styles.hint}>Retirar nunca deixa o saldo abaixo de 0.</p>
        </section>
      </div>
    </div>
  )
}
