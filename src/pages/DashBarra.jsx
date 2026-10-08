import { useState, useRef } from 'react'
import { supabaseDash } from '../lib/supabase'
import styles from './DashBarra.module.css'

const DASHBOARD_ID = 'aa9660ca-4c53-4d4d-b81b-b3d231660420'
const BUCKET = 'images'

const MODOS = [
  { value: 'raw',   label: 'RAW',   hint: 'Slots a dinheiro real' },
  { value: 'wager', label: 'WAGER', hint: 'Wager / bónus de casino' },
  { value: 'demo',  label: 'DEMO',  hint: 'Demo / fake money' },
]

const svg = (d) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
const ACTIVITIES = [
  { value: 'hunting',  label: 'Hunting',  icon: svg(<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>) },
  { value: 'opening',  label: 'Opening',  icon: svg(<><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></>) },
  { value: 'chill',    label: 'Chill',    icon: svg(<><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M7 2v3M11 2v3"/></>) },
  { value: 'torneios', label: 'Torneios', icon: svg(<><path d="M6 9H4a2 2 0 0 1-2-2V5h4M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M12 17v4M8 21h8M6 9a6 6 0 0 0 12 0V3H6z"/></>) },
]

async function uploadLogo(file, path) {
  const ext = file.name.split('.').pop()
  const fullPath = `${path}.${ext}`
  const { error } = await supabaseDash.storage.from(BUCKET).upload(fullPath, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabaseDash.storage.from(BUCKET).getPublicUrl(fullPath)
  return data.publicUrl + '?v=' + Date.now()
}

async function dbUpdate(payload) {
  return supabaseDash.from('dashboard_state').update(payload).eq('id', DASHBOARD_ID)
}

export default function DashBarra({ state, onStateChange }) {
  const [uploading,  setUploading]  = useState('')
  const [addName,    setAddName]    = useState('')
  const [addFile,    setAddFile]    = useState(null)
  const [addPreview, setAddPreview] = useState('')
  const [saving,     setSaving]     = useState(false)

  const mainFileRef = useRef(null)
  const addFileRef  = useRef(null)

  if (!state) return (
    <div className={styles.loading}>
      <div className={styles.spinner} /> A carregar...
    </div>
  )

  const casinos   = state.casinos || {}
  const casinoKeys = Object.keys(casinos)

  // ── Set casino ──
  const setCasino = async (key) => {
    const logoUrl = casinos[key]?.url || ''
    onStateChange(s => ({ ...s, casino: key, casino_logo: logoUrl }))
    await dbUpdate({ casino: key, casino_logo: logoUrl })
  }

  // ── Set modo ──
  const setModo = async (modo) => {
    onStateChange(s => ({ ...s, modo }))
    await dbUpdate({ modo })
  }

  // ── Set activity ──
  const setActivity = async (activity) => {
    const next = state.activity === activity ? '' : activity
    onStateChange(s => ({ ...s, activity: next }))
    await dbUpdate({ activity: next })
  }

  // ── Upload logo principal ──
  const handleMainLogo = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading('main')
    try {
      const url = await uploadLogo(file, 'main_logo')
      onStateChange(s => ({ ...s, main_logo: url }))
      await dbUpdate({ main_logo: url })
    } catch (err) { alert('Erro: ' + err.message) }
    finally { setUploading('') }
  }

  // ── Add casino ──
  const handleAddFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAddFile(file)
    setAddPreview(URL.createObjectURL(file))
  }

  const handleAddSave = async () => {
    if (!addName.trim() || !addFile) return
    setSaving(true)
    try {
      const key = 'casino_' + addName.toLowerCase().replace(/[^a-z0-9]/g, '_')
      const url = await uploadLogo(addFile, key)
      const newCasinos = { ...casinos, [key]: { name: addName.trim(), url } }
      onStateChange(s => ({ ...s, casinos: newCasinos, casino: key, casino_logo: url }))
      await dbUpdate({ casinos: newCasinos, casino: key, casino_logo: url })
      setAddName(''); setAddFile(null); setAddPreview('')
      if (addFileRef.current) addFileRef.current.value = ''
    } catch (err) { alert('Erro: ' + err.message) }
    finally { setSaving(false) }
  }

  // ── Remove casino ──
  const handleRemoveCasino = async (key) => {
    if (!confirm(`Remover "${casinos[key]?.name}"?`)) return
    const newCasinos = { ...casinos }
    delete newCasinos[key]
    const nextCasino = state.casino === key ? (Object.keys(newCasinos)[0] || '') : state.casino
    const nextLogo   = newCasinos[nextCasino]?.url || ''
    onStateChange(s => ({ ...s, casinos: newCasinos, casino: nextCasino, casino_logo: nextLogo }))
    await dbUpdate({ casinos: newCasinos, casino: nextCasino, casino_logo: nextLogo })
  }

  const activeAct = ACTIVITIES.find(a => a.value === state.activity)
  const IUp = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
  const IX = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
  const IOk = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7"/></svg>

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Barra OBS</h1>
        <p className={styles.sub}>Controlo em tempo real da overlay. As alterações aparecem logo na barra.</p>
      </div>

      <div className={styles.now}>
        <div className={styles.nowCard}>
          <span>Casino</span>
          <div className={styles.nowVal}>
            {state.casino_logo
              ? <img src={state.casino_logo} alt="" onError={e => e.target.style.opacity = '.2'} />
              : <b>{casinos[state.casino]?.name || '—'}</b>}
          </div>
        </div>
        <div className={styles.nowCard}>
          <span>Modo</span>
          <div className={styles.nowVal}><b className={`${styles.modoText} ${styles['mt_' + state.modo]}`}>{state.modo?.toUpperCase() || '—'}</b></div>
        </div>
        <div className={styles.nowCard}>
          <span>Activity</span>
          <div className={styles.nowVal}>{activeAct ? <b className={styles.actText}>{activeAct.icon}{activeAct.label}</b> : <b className={styles.dim}>Nenhuma</b>}</div>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Adicionar casino</div>
          <label className={styles.fld}><span>Nome</span>
            <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Ex: BC.Game" />
          </label>
          <div className={styles.fld}><span>Logo</span>
            {addPreview ? (
              <div className={styles.addPrev}>
                <img src={addPreview} alt="" />
                <em>{addFile?.name}</em>
                <button onClick={() => { setAddFile(null); setAddPreview('') }} aria-label="Remover">{IX}</button>
              </div>
            ) : (
              <label className={styles.zone}>{IUp}Escolher imagem
                <input type="file" accept="image/*" ref={addFileRef} onChange={handleAddFile} hidden />
              </label>
            )}
          </div>
          <button className={styles.cta} onClick={handleAddSave} disabled={!addName.trim() || !addFile || saving}>
            {saving ? 'A guardar…' : 'Adicionar casino'}
          </button>
        </div>

        <div className={styles.stage}>
          <div className={styles.block}>
            <div className={styles.blockHead}><b>Modo</b><small>{MODOS.find(m => m.value === state.modo)?.hint}</small></div>
            <div className={styles.seg3}>
              {MODOS.map(m => (
                <button key={m.value} className={state.modo === m.value ? styles.segOn : ''} onClick={() => setModo(m.value)}>{m.label}</button>
              ))}
            </div>
          </div>

          <div className={styles.block}>
            <div className={styles.blockHead}><b>Activity</b><small>Clica outra vez para limpar</small></div>
            <div className={styles.seg4}>
              {ACTIVITIES.map(a => (
                <button key={a.value} className={state.activity === a.value ? styles.segOn : ''} onClick={() => setActivity(a.value)}>
                  {a.icon}{a.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.block}>
            <div className={styles.blockHead}><b>Casino ativo</b><small>{casinoKeys.length} casinos</small></div>
            {casinoKeys.length === 0
              ? <p className={styles.empty}>Sem casinos. Adiciona um à esquerda.</p>
              : casinoKeys.map(key => {
                  const c = casinos[key]
                  const on = state.casino === key
                  return (
                    <div key={key} className={`${styles.item} ${on ? styles.itemOn : ''}`}>
                      <div className={styles.logo}><img src={c.url} alt="" onError={e => e.target.style.opacity = '.2'} /></div>
                      <span className={styles.name}>{c.name}</span>
                      <button className={`${styles.setBtn} ${on ? styles.setBtnOn : ''}`} onClick={() => setCasino(key)} disabled={on}>
                        {on ? <>{IOk}Ativo</> : 'Ativar'}
                      </button>
                      <button className={styles.rm} onClick={() => handleRemoveCasino(key)} aria-label="Remover">{IX}</button>
                    </div>
                  )
                })}
          </div>
        </div>
      </div>
    </div>
  )
}
