import { useState, useRef } from 'react'
import { supabaseDash } from '../lib/supabase'
import styles from './DashBarra.module.css'

const DASHBOARD_ID = 'aa9660ca-4c53-4d4d-b81b-b3d231660420'
const BUCKET = 'images'

const MODOS = [
  { value: 'raw',   label: 'RAW',   color: 'green' },
  { value: 'wager', label: 'WAGER', color: 'blue' },
  { value: 'demo',  label: 'DEMO',  color: 'slate' },
]

const ACTIVITIES = [
  { value: 'hunting',  label: 'Hunting',  icon: '🎯' },
  { value: 'opening',  label: 'Opening',  icon: '🎁' },
  { value: 'chill',    label: 'Chill',    icon: '☕' },
  { value: 'torneios', label: 'Torneios', icon: '🏆' },
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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Barra OBS</h2>
        <p className={styles.sub}>Controlo em tempo real da overlay</p>
      </div>

      <div className={styles.grid}>

        {/* ── CASINO ── */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Casino Ativo</span>
          </div>

          {/* Logo principal */}
          <div className={styles.mainLogoRow}>
            <div className={styles.mainLogoPreview}>
              {state.main_logo
                ? <img src={state.main_logo} alt="logo" onError={e => e.target.style.opacity='.2'} />
                : <span>—</span>}
            </div>
            <div className={styles.mainLogoInfo}>
              <span className={styles.mainLogoLabel}>Logo Principal (barra)</span>
              <label className={styles.uploadBtn}>
                {uploading === 'main' ? <><span className={styles.spinnerSm} /> A carregar...</> : '📁 Upload'}
                <input type="file" accept="image/*" ref={mainFileRef} onChange={handleMainLogo} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          <div className={styles.divider} />

          {/* Lista casinos */}
          <div className={styles.casinoList}>
            {casinoKeys.length === 0
              ? <div className={styles.emptySmall}>Sem casinos — adiciona um abaixo</div>
              : casinoKeys.map(key => {
                  const c = casinos[key]
                  const isActive = state.casino === key
                  return (
                    <div key={key} className={`${styles.casinoItem} ${isActive ? styles.casinoItemActive : ''}`}>
                      <div className={styles.casinoItemLogo}>
                        <img src={c.url} alt={c.name} onError={e => e.target.style.opacity='.2'} />
                      </div>
                      <span className={styles.casinoItemName}>{c.name}</span>
                      <button
                        className={`${styles.casinoSetBtn} ${isActive ? styles.casinoSetBtnActive : ''}`}
                        onClick={() => setCasino(key)}
                      >
                        {isActive ? '✓ Ativo' : 'Ativar'}
                      </button>
                      <button className={styles.casinoRemoveBtn} onClick={() => handleRemoveCasino(key)}>✕</button>
                    </div>
                  )
                })
            }
          </div>

          <div className={styles.divider} />

          {/* Adicionar casino */}
          <div className={styles.addCasino}>
            <span className={styles.addLabel}>Adicionar Casino</span>
            <input
              className={styles.input}
              value={addName}
              onChange={e => setAddName(e.target.value)}
              placeholder="Nome (ex: BC.Game)"
            />
            {addPreview
              ? <div className={styles.addPreview}>
                  <img src={addPreview} alt="preview" />
                  <span>{addFile?.name}</span>
                  <button className={styles.clearPreviewBtn} onClick={() => { setAddFile(null); setAddPreview('') }}>✕</button>
                </div>
              : <label className={styles.uploadZone}>
                  📁 Upload do logo
                  <input type="file" accept="image/*" ref={addFileRef} onChange={handleAddFile} style={{ display: 'none' }} />
                </label>
            }
            <button
              className={styles.addSaveBtn}
              onClick={handleAddSave}
              disabled={!addName.trim() || !addFile || saving}
            >
              {saving ? <><span className={styles.spinnerSm} /> A guardar...</> : '+ Adicionar'}
            </button>
          </div>
        </div>

        {/* ── MODO ── */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Modo</span>
          </div>
          <div className={styles.modoGrid}>
            {MODOS.map(m => (
              <button
                key={m.value}
                className={`${styles.modoBtn} ${styles['modoBtn_' + m.color]} ${state.modo === m.value ? styles.modoBtnActive : ''}`}
                onClick={() => setModo(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className={styles.modoHint}>
            {state.modo === 'raw'   && 'Slots a dinheiro real'}
            {state.modo === 'wager' && 'Modo wager / bónus de casino'}
            {state.modo === 'demo'  && 'Modo demo / fake money'}
          </p>
        </div>

        {/* ── ACTIVITY ── */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Activity</span>
            <span className={styles.cardSub}>Aparece na barra OBS</span>
          </div>
          <div className={styles.activityGrid}>
            {ACTIVITIES.map(a => (
              <button
                key={a.value}
                className={`${styles.activityBtn} ${state.activity === a.value ? styles.activityBtnActive : ''}`}
                onClick={() => setActivity(a.value)}
              >
                <span className={styles.activityIcon}>{a.icon}</span>
                <span className={styles.activityLabel}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── PREVIEW ── */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Estado Atual</span>
          </div>
          <div className={styles.previewRows}>
            <div className={styles.previewRow}>
              <span className={styles.previewKey}>Casino</span>
              <span className={styles.previewVal}>
                {state.casino_logo
                  ? <img src={state.casino_logo} alt="" className={styles.previewLogo} onError={e => e.target.style.opacity='.2'} />
                  : casinos[state.casino]?.name || '—'}
              </span>
            </div>
            <div className={styles.previewRow}>
              <span className={styles.previewKey}>Modo</span>
              <span className={`${styles.previewBadge} ${styles['previewBadge_' + state.modo]}`}>
                {state.modo?.toUpperCase() || '—'}
              </span>
            </div>
            <div className={styles.previewRow}>
              <span className={styles.previewKey}>Activity</span>
              <span className={styles.previewVal}>
                {ACTIVITIES.find(a => a.value === state.activity)
                  ? `${ACTIVITIES.find(a => a.value === state.activity).icon} ${ACTIVITIES.find(a => a.value === state.activity).label}`
                  : '—'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}