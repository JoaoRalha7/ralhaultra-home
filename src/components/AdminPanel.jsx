import { useState, useEffect, useCallback } from 'react'
import { supabase, supabaseDash } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import styles from './AdminPanel.module.css'

const BUCKET = 'images'

async function uploadImage(file, folder) {
  const ext  = file.name.split('.').pop()
  const path = `${folder}/${Date.now()}.${ext}`

  // Tenta no cliente público primeiro, depois no dashboard
  for (const client of [supabase, supabaseDash]) {
    const { error } = await client.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { data: pub } = client.storage.from(BUCKET).getPublicUrl(path)
      return pub.publicUrl
    }
  }
  throw new Error('Upload failed on both Supabase projects. Check bucket policies.')
}

// ── Icons ──────────────────────────────────────────────────
const IconEdit   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const IconTrash  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const IconClose  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const IconPlus   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const IconUpload = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const IconCheck  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>

// ── Toggle ─────────────────────────────────────────────────
function Toggle({ checked, onChange, label }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      <span className={styles.toggleTrack}><span className={styles.toggleThumb} /></span>
      {label && <span className={styles.toggleLabel}>{label}</span>}
    </label>
  )
}

// ── Image Upload Field ─────────────────────────────────────
function ImageField({ label, value, onChange, folder }) {
  const [uploading, setUploading] = useState(false)
  const [status,    setStatus]    = useState('')

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true); setStatus('')
    try {
      const url = await uploadImage(file, folder)
      onChange(url); setStatus('ok')
    } catch (err) {
      console.error('Upload error:', err)
      setStatus('error:' + (err?.message || 'Unknown error'))
    }
    finally { setUploading(false) }
  }

  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <div className={styles.imageFieldWrap}>
        <div className={styles.imagePreview}>
          {value
            ? <img src={value} alt="" onError={e => { e.target.style.display='none' }} />
            : <span className={styles.imageEmpty}><IconUpload /></span>}
        </div>
        <div className={styles.imageRight}>
          <input className={styles.input} value={value || ''} onChange={e => { onChange(e.target.value); setStatus('') }} placeholder="https://..." />
          <label className={`${styles.uploadBtn} ${uploading ? styles.uploadBtnLoading : ''}`}>
            {uploading ? <span className={styles.spinnerSm} /> : <IconUpload />}
            {uploading ? 'Uploading...' : 'Upload file'}
            <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
          </label>
          {status === 'ok'                   && <span className={styles.statusOk}><IconCheck /> Done</span>}
          {status.startsWith('error') && <span className={styles.statusErr}>{status.replace('error:', '') || 'Upload failed'}</span>}
        </div>
      </div>
    </div>
  )
}

// ── Bonus Field (pct + up_to + fs) ────────────────────────
function BonusField({ value = [], onChange }) {
  const add    = () => onChange([...value, { pct: '', up_to: '', fs: '' }])
  const update = (i, k, v) => { const a = value.map((x, idx) => idx === i ? { ...x, [k]: v } : x); onChange(a) }
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i))

  return (
    <div className={styles.arrayField}>
      <div className={styles.arrayFieldHead}>
        <span className={styles.label}>Welcome Bonus</span>
        <button type="button" className={styles.addRowBtn} onClick={add}><IconPlus /> Add tier</button>
      </div>
      {value.length === 0
        ? <div className={styles.arrayEmpty}>No tiers — click Add tier</div>
        : <div className={styles.arrayList}>
            {value.map((item, i) => (
              <div key={i} className={styles.bonusTierRow}>
                <span className={styles.arrayIndex}>{i + 1}</span>
                <div className={styles.bonusTierFields}>
                  <div className={styles.field}>
                    <label className={styles.label}>% Match</label>
                    <input className={styles.input} value={item.pct || ''} onChange={e => update(i, 'pct', e.target.value)} placeholder="100%" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Up to</label>
                    <input className={styles.input} value={item.up_to || ''} onChange={e => update(i, 'up_to', e.target.value)} placeholder="€500" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Free Spins</label>
                    <input className={styles.input} value={item.fs || ''} onChange={e => update(i, 'fs', e.target.value)} placeholder="200 FS" />
                  </div>
                </div>
                <button type="button" className={styles.removeBtn} onClick={() => remove(i)}><IconTrash /></button>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ── Array Field ────────────────────────────────────────────
function ArrayField({ label, value = [], onChange, placeholder }) {
  const add    = () => onChange([...value, ''])
  const update = (i, v) => { const a = [...value]; a[i] = v; onChange(a) }
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i))
  return (
    <div className={styles.arrayField}>
      <div className={styles.arrayFieldHead}>
        <span className={styles.label}>{label}</span>
        <button type="button" className={styles.addRowBtn} onClick={add}><IconPlus /> Add</button>
      </div>
      {value.length === 0
        ? <div className={styles.arrayEmpty}>No items — click Add</div>
        : <div className={styles.arrayList}>
            {value.map((item, i) => (
              <div key={i} className={styles.arrayItem}>
                <span className={styles.arrayIndex}>{i + 1}</span>
                <input className={styles.input} value={item || ''} onChange={e => update(i, e.target.value)} placeholder={placeholder} />
                <button type="button" className={styles.removeBtn} onClick={() => remove(i)}><IconTrash /></button>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ── Casino Modal ───────────────────────────────────────────
function CasinoModal({ casino, methods, onSave, onClose }) {
  const isEdit = !!casino?.id
  const [tab,         setTab]         = useState('basic')
  const [form,        setForm]        = useState({})
  const [features,    setFeatures]    = useState([])
  const [bonus,       setBonus]       = useState([])
  const [vip,         setVip]         = useState([])
  const [howToClaim,  setHowToClaim]  = useState([])
  const [selMethods,  setSelMethods]  = useState([])
  const [saving,      setSaving]      = useState(false)
  const [errors,      setErrors]      = useState({})

  useEffect(() => {
    if (casino) {
      setForm({ ...casino })
      setFeatures(Array.isArray(casino.features)       ? casino.features       : [])
      setBonus(Array.isArray(casino.welcome_bonus)     ? casino.welcome_bonus  : [])
      setVip(Array.isArray(casino.vip_benefits)        ? casino.vip_benefits   : [])
      setHowToClaim(Array.isArray(casino.how_to_claim) ? casino.how_to_claim   : [])
      setSelMethods(Array.isArray(casino.payments)     ? casino.payments       : [])
    } else {
      setForm({ is_active: true, vpn_allowed: true, sort_order: 0 })
    }
  }, [casino])

  const set   = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }
  const ci    = form.casino_info || {}
  const setCi = (k, v) => set('casino_info', { ...ci, [k]: v })

  const validate = () => {
    const e = {}
    if (!form.name)      e.name      = 'Required'
    if (!form.claim_url) e.claim_url = 'Required'
    if (!form.logo_url)  e.logo_url  = 'Required'
    setErrors(e); return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) { setTab('basic'); return }
    setSaving(true)
    try {
      const payload = { ...form, payments: selMethods, features, welcome_bonus: bonus, vip_benefits: vip, how_to_claim: howToClaim, casino_info: form.casino_info || {} }
      delete payload.id

      // Só um casino pode estar em destaque ao mesmo tempo — desliga os outros primeiro.
      if (payload.is_featured) {
        const clearQuery = isEdit
          ? supabase.from('casinos').update({ is_featured: false }).eq('is_featured', true).neq('id', casino.id)
          : supabase.from('casinos').update({ is_featured: false }).eq('is_featured', true)
        const { error: clearError } = await clearQuery
        if (clearError) throw clearError
      }

      const q = isEdit
        ? supabase.from('casinos').update(payload).eq('id', casino.id).select('id').single()
        : supabase.from('casinos').insert(payload).select('id').single()
      const { error } = await q
      if (error) throw error
      onSave()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  const TABS = [
    { id: 'basic',    label: 'Basic',    err: !!(errors.name || errors.claim_url) },
    { id: 'media',    label: 'Media',    err: !!errors.logo_url },
    { id: 'info',     label: 'Info',     err: false },
    { id: 'featured', label: '⭐ Featured', err: false },
    { id: 'methods',  label: 'Methods',  err: false },
    { id: 'content',  label: 'Content',  err: false },
  ]

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <div className={styles.modalHeadLeft}>
            {form.logo_url && <img src={form.logo_url} alt="" className={styles.modalLogo} onError={e => e.target.style.display='none'} />}
            <div>
              <div className={styles.modalTitle}>{isEdit ? (form.name || 'Edit Casino') : 'New Casino'}</div>
              <div className={styles.modalSub}>{isEdit ? `Casino ID #${casino.id}` : 'Fill in the details below'}</div>
            </div>
          </div>
          <button className={styles.iconBtnSm} onClick={onClose}><IconClose /></button>
        </div>

        <div className={styles.modalTabs}>
          {TABS.map(t => (
            <button key={t.id} className={`${styles.modalTab} ${tab === t.id ? styles.modalTabActive : ''} ${t.err ? styles.modalTabError : ''}`} onClick={() => setTab(t.id)}>
              {t.label}{t.err && <span className={styles.errorDot} />}
            </button>
          ))}
        </div>

        <div className={styles.modalBody}>
          {/* BASIC */}
          {tab === 'basic' && (
            <div className={styles.tabContent}>
              <div className={styles.formRow2}>
                <div className={styles.field}>
                  <label className={styles.label}>Casino Name *</label>
                  <input className={`${styles.input} ${errors.name ? styles.inputError : ''}`} value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="BC.Game" />
                  {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Claim URL *</label>
                  <input className={`${styles.input} ${errors.claim_url ? styles.inputError : ''}`} value={form.claim_url || ''} onChange={e => set('claim_url', e.target.value)} placeholder="https://..." />
                  {errors.claim_url && <span className={styles.fieldError}>{errors.claim_url}</span>}
                </div>
              </div>
              <div className={styles.formRow2}>
                <div className={styles.field}>
                  <label className={styles.label}>Promo Code</label>
                  <input className={styles.input} value={form.promo_code || ''} onChange={e => set('promo_code', e.target.value)} placeholder="ralha" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Sort Order</label>
                  <input className={styles.input} type="number" value={form.sort_order ?? 0} onChange={e => set('sort_order', Number(e.target.value))} />
                </div>
              </div>
              <div className={styles.togglesGrid}>
                {[
                  { k: 'is_active',      label: 'Active',          sub: 'Visible to users',       val: !!form.is_active },
                  { k: 'is_featured',    label: '⭐ FEATURED',     sub: 'Shown in entry popup',     val: !!form.is_featured },
                  { k: 'is_hot',         label: '🔥 HOT',          sub: 'Shows HOT badge',         val: !!form.is_hot },
                  { k: 'is_new',         label: '✨ NEW',          sub: 'Shows NEW badge',         val: !!form.is_new },
                  { k: 'is_freespins',   label: '🎰 FREESPINS',    sub: 'Shows FREESPINS badge',   val: !!form.is_freespins },
                  { k: 'promo_required', label: 'Promo Required',  sub: 'Must use promo code',     val: !!form.promo_required },
                  { k: 'kyc_required',   label: 'KYC Required',    sub: 'Identity verification',   val: !!form.kyc_required },
                  { k: 'vpn_allowed',    label: 'VPN Allowed',     sub: 'VPN access permitted',    val: form.vpn_allowed !== false },
                ].map(({ k, label, sub, val }) => (
                  <div key={k} className={styles.toggleCard}>
                    <div className={styles.toggleCardInfo}>
                      <span className={styles.toggleCardLabel}>{label}</span>
                      <span className={styles.toggleCardSub}>{sub}</span>
                    </div>
                    <Toggle checked={val} onChange={v => set(k, v)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MEDIA */}
          {tab === 'media' && (
            <div className={styles.tabContent}>
              <ImageField label="Logo *" value={form.logo_url} onChange={v => set('logo_url', v)} folder="casinos" />
              {errors.logo_url && <span className={styles.fieldError}>{errors.logo_url}</span>}
              <ImageField label="Banner" value={form.banner_url} onChange={v => set('banner_url', v)} folder="casinos" />
              <div className={styles.field}>
                <label className={styles.label}>Background Color</label>
                <input className={styles.input} value={form.bg_color || ''} onChange={e => set('bg_color', e.target.value)} placeholder="#0f1118" />
              </div>
            </div>
          )}

          {/* INFO */}
          {tab === 'info' && (
            <div className={styles.tabContent}>
              <div className={styles.infoGrid}>
                {[['games','Games','Slots, Live...'],['min_deposit','Min Deposit','$10'],['cashback','Cashback','10%'],['withdraw','Withdraw Time','Instant'],['license','License','Curaçao'],['established','Established','2020']].map(([k,lbl,ph]) => (
                  <div key={k} className={styles.field}>
                    <label className={styles.label}>{lbl}</label>
                    <input className={styles.input} value={ci[k] || ''} onChange={e => setCi(k, e.target.value)} placeholder={ph} />
                  </div>
                ))}
              </div>
              <div className={styles.formRow2} style={{ marginTop: 16 }}>
                <div className={styles.field}>
                  <label className={styles.label}>Min Withdrawal</label>
                  <input className={styles.input} value={form.min_withdrawal || ''} onChange={e => set('min_withdrawal', e.target.value)} placeholder="$10" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Support</label>
                  <input className={styles.input} value={form.support || ''} onChange={e => set('support', e.target.value)} placeholder="24/7 Live Chat" />
                </div>
              </div>
            </div>
          )}

          {/* FEATURED */}
          {tab === 'featured' && (
            <div className={styles.tabContent}>
              <p className={styles.tabHint}>
                Shown as a popup the moment a user enters the site. Only one casino can be featured at a time —
                turning this on here will turn it off for any other casino.
              </p>

              <div className={styles.formRow2}>
                <div className={styles.field}>
                  <label className={styles.label}>Offer Title</label>
                  <input className={styles.input} value={form.featured_offer_title || ''} onChange={e => set('featured_offer_title', e.target.value)} placeholder="Free Spins" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Accent Color</label>
                  <div className={styles.colorFieldWrap}>
                    <input type="color" className={styles.colorSwatch} value={form.featured_accent_color || '#3b82f6'} onChange={e => set('featured_accent_color', e.target.value)} />
                    <input className={styles.input} value={form.featured_accent_color || ''} onChange={e => set('featured_accent_color', e.target.value)} placeholder="#3b82f6" />
                  </div>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Offer Amount</label>
                <input className={styles.input} value={form.featured_offer_amount || ''} onChange={e => set('featured_offer_amount', e.target.value)} placeholder="100FS  ·  or  ·  200% até €1000" />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Offer Details</label>
                <input className={styles.input} value={form.featured_offer_details || ''} onChange={e => set('featured_offer_details', e.target.value)} placeholder="Endorphina · The Emirates · €0.20 · Wagering x25 · 7 days" />
              </div>

              <p className={styles.tabHint} style={{ marginTop: 4 }}>
                Promo code and claim link reuse the <strong>Promo Code</strong> and <strong>Claim URL</strong> fields from the Basic tab.
              </p>

              {/* Live preview */}
              <div className={styles.featuredPreviewWrap} style={{ '--accent': form.featured_accent_color || '#3b82f6' }}>
                <div className={styles.featuredPreviewBar}>EXCLUSIVE OFFER PREVIEW</div>
                <div className={styles.featuredPreviewBody}>
                  {form.logo_url && <img src={form.logo_url} alt="" className={styles.featuredPreviewLogo} onError={e => e.target.style.display = 'none'} />}
                  <p className={styles.featuredPreviewAmount}>{form.featured_offer_amount || 'Offer amount'}</p>
                  <p className={styles.featuredPreviewDetails}>{form.featured_offer_details || 'Offer details will appear here'}</p>
                  {form.promo_code && <span className={styles.featuredPreviewCode}>{form.promo_code}</span>}
                </div>
              </div>
            </div>
          )}

          {/* METHODS */}
          {tab === 'methods' && (
            <div className={styles.tabContent}>
              <p className={styles.tabHint}>{selMethods.length} method{selMethods.length !== 1 ? 's' : ''} selected</p>
              <div className={styles.methodsGrid}>
                {methods.map(m => {
                  const active = selMethods.includes(m.slug)
                  return (
                    <button key={m.slug} type="button" className={`${styles.methodCard} ${active ? styles.methodCardActive : ''}`}
                      onClick={() => setSelMethods(ms => active ? ms.filter(s => s !== m.slug) : [...ms, m.slug])}>
                      <div className={styles.methodCardIcon}>
                        {m.icon_url ? <img src={m.icon_url} alt="" onError={e => e.target.style.display='none'} /> : m.name[0]}
                      </div>
                      <span className={styles.methodCardName}>{m.name}</span>
                      {active && <span className={styles.methodCardCheck}><IconCheck /></span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* CONTENT */}
          {tab === 'content' && (
            <div className={styles.tabContent}>
              <ArrayField label="Features"      value={features}   onChange={setFeatures}   placeholder="e.g. Fast withdrawals" />
              <BonusField value={bonus} onChange={setBonus} />
              <ArrayField label="VIP Benefits"  value={vip}        onChange={setVip}        placeholder="e.g. Personal manager" />
              <ArrayField label="How to Claim"  value={howToClaim} onChange={setHowToClaim} placeholder="e.g. Register with code" />
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? <><span className={styles.spinnerSm} /> Saving...</> : <><IconCheck /> {isEdit ? 'Save changes' : 'Create casino'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Method Modal ───────────────────────────────────────────
function MethodModal({ method, onSave, onClose }) {
  const isEdit = !!method?.id
  const [form,   setForm]   = useState(method || { is_active: true, sort_order: 0 })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name || !form.slug) { alert('Name and Slug are required'); return }
    setSaving(true)
    try {
      const payload = { ...form }; delete payload.id
      const q = isEdit
        ? supabase.from('deposit_methods').update(payload).eq('id', method.id)
        : supabase.from('deposit_methods').insert(payload)
      const { error } = await q
      if (error) throw error
      onSave()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ zIndex: 700 }}>
      <div className={styles.modal} style={{ maxWidth: 480 }}>
        <div className={styles.modalHead}>
          <div className={styles.modalHeadLeft}>
            <div>
              <div className={styles.modalTitle}>{isEdit ? 'Edit Method' : 'New Method'}</div>
              <div className={styles.modalSub}>Deposit / withdrawal method</div>
            </div>
          </div>
          <button className={styles.iconBtnSm} onClick={onClose}><IconClose /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.tabContent}>
            <div className={styles.formRow2}>
              <div className={styles.field}>
                <label className={styles.label}>Name *</label>
                <input className={styles.input} value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="Visa" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Slug *</label>
                <input className={styles.input} value={form.slug || ''} onChange={e => set('slug', e.target.value)} placeholder="visa" />
              </div>
            </div>
            <ImageField label="Icon" value={form.icon_url} onChange={v => set('icon_url', v)} folder="methods" />
            <div className={styles.formRow2}>
              <div className={styles.field}>
                <label className={styles.label}>Sort Order</label>
                <input className={styles.input} type="number" value={form.sort_order ?? 0} onChange={e => set('sort_order', Number(e.target.value))} />
              </div>
              <div className={styles.field} style={{ justifyContent: 'flex-end', paddingBottom: 4 }}>
                <Toggle checked={!!form.is_active} onChange={v => set('is_active', v)} label="Active" />
              </div>
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? <><span className={styles.spinnerSm} /> Saving...</> : <><IconCheck /> {isEdit ? 'Save changes' : 'Create method'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Casino Row ─────────────────────────────────────────────
function CasinoRow({ casino, onEdit, onDelete, onToggle }) {
  return (
    <div className={`${styles.itemRow} ${!casino.is_active ? styles.itemRowDim : ''}`}>
      <div className={styles.itemLogo}>
        {casino.logo_url
          ? <img src={casino.logo_url} alt={casino.name} onError={e => e.target.style.opacity='.2'} />
          : <span>{(casino.name||'?')[0]}</span>}
      </div>
      <div className={styles.itemMain}>
        <div className={styles.itemName}>{casino.name}</div>
        <div className={styles.itemMeta}>
          <span className={styles.metaChip}>#{casino.sort_order ?? 0}</span>
          {casino.promo_code && <span className={styles.metaChip} style={{ color: '#93c5fd', borderColor: 'rgba(59,130,246,.3)' }}>{casino.promo_code}</span>}
          {casino.is_featured && <span className={styles.metaChip} style={{ color: '#facc15', borderColor: 'rgba(250,204,21,.35)' }}>⭐ FEATURED</span>}
          {casino.is_hot && <span className={styles.metaChip} style={{ color: '#f87171', borderColor: 'rgba(239,68,68,.3)' }}>HOT</span>}
          {casino.is_new && <span className={styles.metaChip} style={{ color: '#4ade80', borderColor: 'rgba(34,197,94,.3)' }}>NEW</span>}
          {casino.is_freespins && <span className={styles.metaChip} style={{ color: '#93c5fd', borderColor: 'rgba(59,130,246,.3)' }}>FREESPINS</span>}
        </div>
      </div>
      <div className={styles.itemActions}>
        <Toggle checked={!!casino.is_active} onChange={v => onToggle(casino.id, v)} />
        <button className={styles.iconBtnSm} onClick={() => onEdit(casino)}><IconEdit /></button>
        <button className={`${styles.iconBtnSm} ${styles.iconBtnDanger}`} onClick={() => onDelete(casino.id)}><IconTrash /></button>
      </div>
    </div>
  )
}

// ── Method Row ─────────────────────────────────────────────
function MethodRow({ method, onEdit, onDelete, onToggle }) {
  return (
    <div className={`${styles.itemRow} ${!method.is_active ? styles.itemRowDim : ''}`}>
      <div className={styles.itemLogo} style={{ borderRadius: 10, background: 'rgba(255,255,255,.10)' }}>
        {method.icon_url
          ? <img src={method.icon_url} alt={method.name} style={{ objectFit: 'contain', padding: 4 }} onError={e => e.target.style.opacity='.2'} />
          : <span>{(method.name||'?')[0]}</span>}
      </div>
      <div className={styles.itemMain}>
        <div className={styles.itemName}>{method.name}</div>
        <div className={styles.itemMeta}>
          <span className={styles.metaChip} style={{ fontFamily: 'monospace', fontSize: 11 }}>{method.slug}</span>
          <span className={styles.metaChip}>pos {method.sort_order ?? 0}</span>
        </div>
      </div>
      <div className={styles.itemActions}>
        <Toggle checked={!!method.is_active} onChange={v => onToggle(method.id, v)} />
        <button className={styles.iconBtnSm} onClick={() => onEdit(method)}><IconEdit /></button>
        <button className={`${styles.iconBtnSm} ${styles.iconBtnDanger}`} onClick={() => onDelete(method.id)}><IconTrash /></button>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────
export default function AdminPanel({ onClose }) {
  const { signOut } = useAuth()
  const [section,    setSection]    = useState('casinos')
  const [casinos,    setCasinos]    = useState([])
  const [methods,    setMethods]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [editCasino, setEditCasino] = useState(null)
  const [newCasino,  setNewCasino]  = useState(false)
  const [editMethod, setEditMethod] = useState(null)
  const [newMethod,  setNewMethod]  = useState(false)
  const [search,     setSearch]     = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from('casinos').select('*').order('sort_order').order('created_at', { ascending: false }),
      supabase.from('deposit_methods').select('*').order('sort_order').order('created_at', { ascending: false }),
    ])
    setCasinos(c || [])
    setMethods(m || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const deleteCasino = async (id) => {
    if (!confirm('Delete this casino?')) return
    await supabase.from('casinos').delete().eq('id', id); loadAll()
  }
  const toggleCasino = async (id, val) => {
    await supabase.from('casinos').update({ is_active: val }).eq('id', id)
    setCasinos(cs => cs.map(c => c.id === id ? { ...c, is_active: val } : c))
  }
  const deleteMethod = async (id) => {
    if (!confirm('Delete this method?')) return
    await supabase.from('deposit_methods').delete().eq('id', id); loadAll()
  }
  const toggleMethod = async (id, val) => {
    await supabase.from('deposit_methods').update({ is_active: val }).eq('id', id)
    setMethods(ms => ms.map(m => m.id === id ? { ...m, is_active: val } : m))
  }

  const q = search.toLowerCase()
  const filteredCasinos = casinos.filter(c => !q || c.name?.toLowerCase().includes(q))
  const filteredMethods = methods.filter(m => !q || m.name?.toLowerCase().includes(q) || m.slug?.toLowerCase().includes(q))

  return (
    <>
      <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className={styles.panel}>

          {/* Sidebar */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarBrand}>
              <div className={styles.brandIcon}>⚙</div>
              <span>Admin</span>
            </div>

            <nav className={styles.sidebarNav}>
              {[
                { id: 'casinos', label: 'Casinos', count: casinos.length, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg> },
                { id: 'methods', label: 'Methods',  count: methods.length,  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M2 10h20" stroke="currentColor" strokeWidth="1.8"/></svg> },
              ].map(({ id, label, count, icon }) => (
                <button key={id} className={`${styles.navItem} ${section === id ? styles.navItemActive : ''}`}
                  onClick={() => { setSection(id); setSearch('') }}>
                  {icon}
                  <span>{label}</span>
                  <span className={styles.navBadge}>{count}</span>
                </button>
              ))}
            </nav>

            <button className={styles.logoutItem} onClick={async () => { await signOut(); onClose() }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              Logout
            </button>
          </aside>

          {/* Main */}
          <div className={styles.main}>
            <div className={styles.mainHead}>
              <div>
                <h2 className={styles.mainTitle}>{section === 'casinos' ? 'Casinos' : 'Deposit Methods'}</h2>
                {section === 'casinos' && (
                  <div className={styles.mainStats}>
                    <span style={{ color: '#4ade80' }}>{casinos.filter(c => c.is_active).length} active</span>
                    <span>·</span>
                    <span>{casinos.filter(c => !c.is_active).length} inactive</span>
                  </div>
                )}
              </div>
              <div className={styles.mainHeadRight}>
                <div className={styles.searchBox}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className={styles.searchInput} />
                  {search && <button className={styles.clearSearch} onClick={() => setSearch('')}><IconClose /></button>}
                </div>
                <button className={styles.btnPrimary} onClick={() => section === 'casinos' ? setNewCasino(true) : setNewMethod(true)}>
                  <IconPlus />{section === 'casinos' ? 'New Casino' : 'New Method'}
                </button>
                <button className={styles.iconBtnSm} onClick={onClose}><IconClose /></button>
              </div>
            </div>

            <div className={styles.mainBody}>
              {loading ? (
                <div className={styles.loadingState}><div className={styles.spinner} /><span>Loading...</span></div>
              ) : section === 'casinos' ? (
                filteredCasinos.length === 0
                  ? <div className={styles.emptyState}>{search ? 'No casinos match your search.' : 'No casinos yet.'}</div>
                  : <div className={styles.list}>{filteredCasinos.map(c => <CasinoRow key={c.id} casino={c} onEdit={setEditCasino} onDelete={deleteCasino} onToggle={toggleCasino} />)}</div>
              ) : (
                filteredMethods.length === 0
                  ? <div className={styles.emptyState}>{search ? 'No methods match.' : 'No methods yet.'}</div>
                  : <div className={styles.list}>{filteredMethods.map(m => <MethodRow key={m.id} method={m} onEdit={setEditMethod} onDelete={deleteMethod} onToggle={toggleMethod} />)}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {(newCasino || editCasino) && (
        <CasinoModal casino={editCasino || null} methods={methods}
          onSave={() => { setEditCasino(null); setNewCasino(false); loadAll() }}
          onClose={() => { setEditCasino(null); setNewCasino(false) }} />
      )}
      {(newMethod || editMethod) && (
        <MethodModal method={editMethod || null}
          onSave={() => { setEditMethod(null); setNewMethod(false); loadAll() }}
          onClose={() => { setEditMethod(null); setNewMethod(false) }} />
      )}
    </>
  )
}