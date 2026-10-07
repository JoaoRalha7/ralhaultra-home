import { useState, useEffect, useCallback } from 'react'
import { supabase, supabaseDash } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import OfferRow from './OfferRow'
import { FeaturedOfferModal } from './HomeModals'
import { autoFeatured } from '../data/featuredOffer'
import { STAT_DEFS, selectedStatKeys } from '../data/offerStats'
import { casinoToOffer } from '../data/casinoToOffer'
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

const IconUp     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IconDown   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IconCopy   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const IconStar   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7 7 .6-5.3 4.7 1.7 7.2L12 17.8 5.6 21.5l1.7-7.2L2 9.6 9 9z"/></svg>

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
                <input className={styles.input} value={(item && typeof item === 'object' ? (item.value ?? item.title ?? item.text ?? item.label ?? '') : item) || ''} onChange={e => update(i, e.target.value)} placeholder={placeholder} />
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
  const [open,        setOpen]        = useState({ basic: true, media: true, info: false, featured: false, methods: false, content: false })
  const [form,        setForm]        = useState({})
  const [features,    setFeatures]    = useState([])
  const [bonus,       setBonus]       = useState([])
  const [vip,         setVip]         = useState([])
  const [howToClaim,  setHowToClaim]  = useState([])
  const [selMethods,  setSelMethods]  = useState([])
  const [saving,      setSaving]      = useState(false)
  const [errors,      setErrors]      = useState({})
  const [pv,          setPv]          = useState(0)

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
    if (!validate()) { setOpen(o => ({ ...o, basic: true, media: true })); return }
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

  const filled = (o) => Object.values(o || {}).filter(v => String(v?.value ?? v ?? '').trim()).length
  const SUM = {
    basic: [form.name, form.promo_code && `code ${form.promo_code}`].filter(Boolean).join(' · ') || 'Name, link and code',
    media: form.logo_url ? (form.banner_url ? 'Logo + banner' : 'Logo set') : 'Logo missing',
    info: `${filled(ci) - (Array.isArray(ci.card_stats) ? 1 : 0)} of 6 filled`,
    featured: form.is_featured ? 'On - shown in the entry popup' : 'Off',
    methods: `${selMethods.length} selected`,
    content: `${features.length} features · ${bonus.length} bonus tiers · ${vip.length} VIP · ${howToClaim.length} steps`,
  }
  const ERR = { basic: !!(errors.name || errors.claim_url), media: !!errors.logo_url }
  const Sec = ({ id, title }) => (
    <button type="button" className={`${styles.secHead} ${open[id] ? styles.secHeadOpen : ''} ${ERR[id] ? styles.secHeadErr : ''}`} onClick={() => setOpen(o => ({ ...o, [id]: !o[id] }))} aria-expanded={!!open[id]}>
      <span className={styles.secChev}><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
      <span className={styles.secTitle}>{title}</span>
      <span className={styles.secSum}>{SUM[id]}</span>
    </button>
  )
  const allOpen = Object.values(open).every(Boolean)

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

        <div className={styles.modalSplit}>
        <div className={styles.modalBody}>
          <div className={styles.secBar}>
            <span>Click a section to open or close it</span>
            <button type="button" onClick={() => setOpen({ basic: !allOpen, media: !allOpen, info: !allOpen, featured: !allOpen, methods: !allOpen, content: !allOpen })}>{allOpen ? 'Collapse all' : 'Expand all'}</button>
          </div>
          {/* BASIC */}
          <div className={styles.sec}><Sec id="basic" title="Essentials" />
          {open.basic && (
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
              {[
                ['Badges', [['is_hot', 'Hot'], ['is_new', 'New'], ['is_freespins', 'Free spins'], ['is_featured', 'Featured popup']]],
                ['Rules', [['promo_required', 'Promo required'], ['kyc_required', 'KYC required'], ['vpn_allowed', 'VPN allowed']]],
                ['Visibility', [['is_active', 'Active (visible to users)']]],
              ].map(([grp, items]) => (
                <div key={grp} className={styles.field}>
                  <label className={styles.label}>{grp}</label>
                  <div className={styles.pillRow}>
                    {items.map(([k, lbl]) => {
                      const on = k === 'vpn_allowed' ? form.vpn_allowed !== false : !!form[k]
                      return (
                        <button key={k} type="button" aria-pressed={on} className={`${styles.pill} ${on ? styles.pillOn : ''}`} onClick={() => set(k, !on)}>
                          {on && <IconCheck />}{lbl}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>

          <div className={styles.sec}><Sec id="media" title="Images" />
          {open.media && (
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
          </div>

          <div className={styles.sec}><Sec id="info" title="Casino info" />
          {open.info && (
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
              {(() => {
                const cur = { ...form, casino_info: ci }
                const sel = selectedStatKeys(cur)
                const toggle = (k) => setCi('card_stats', sel.includes(k) ? sel.filter(x => x !== k) : [...sel, k])
                return (
                  <div className={styles.statPick}>
                    <div className={styles.statPickHead}>
                      <div>
                        <b>Show on the offer card</b>
                        <span>Tick what appears in the chips of the card ({sel.length} selected). Empty fields are skipped.</span>
                      </div>
                      <button type="button" className={styles.autoReset} onClick={() => setCi('card_stats', undefined)}>Reset</button>
                    </div>
                    <div className={styles.statGrid}>
                      {STAT_DEFS.map(d => {
                        const v = d.get(cur)
                        const on = sel.includes(d.key)
                        return (
                          <label key={d.key} className={`${styles.statOpt} ${on ? styles.statOptOn : ''} ${!v ? styles.statOptEmpty : ''}`}>
                            <input type="checkbox" checked={on} onChange={() => toggle(d.key)} />
                            <span className={styles.statBox}>{on && <IconCheck />}</span>
                            <span className={styles.statTxt}><b>{d.label}</b><small>{v || 'empty'}</small></span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
          </div>

          <div className={styles.sec}><Sec id="featured" title="Featured popup" />
          {open.featured && (() => {
            const cur = { ...form, features, casino_info: ci, welcome_bonus: bonus }
            const auto = autoFeatured(cur)
            const COLORS = ['#3b82f6', '#2ee6a6', '#f5c542', '#ff8a2b', '#ef4444', '#ec4899', '#a855f7', '#22d3ee']
            const Ov = ({ k, label, ph }) => (
              <div className={styles.field}>
                <label className={styles.label}>
                  {label}
                  {form[k] ? <button type="button" className={styles.autoReset} onClick={() => set(k, '')}>Reset to auto</button> : <span className={styles.autoTag}>Auto</span>}
                </label>
                <input className={styles.input} value={form[k] || ''} onChange={e => set(k, e.target.value)} placeholder={ph || 'Auto'} />
              </div>
            )
            return (
              <div className={styles.tabContent}>
                <div className={styles.featHero}>
                  <div>
                    <b>Show this casino in the entry popup</b>
                    <span>Only one casino is featured at a time. Turning this on turns it off for the others.</span>
                  </div>
                  <Toggle checked={!!form.is_featured} onChange={v => set('is_featured', v)} />
                </div>
                <p className={styles.tabHint}>
                  Everything is built from what you already filled in (welcome bonus, info, features, promo code and claim link).
                  Only fill the fields below if you want to override something.
                </p>
                <Ov k="featured_offer_title" label="Title" ph={auto.title} />
                <Ov k="featured_offer_amount" label="Big text" ph={auto.amount || 'Add a Welcome Bonus in Content'} />
                <Ov k="featured_offer_details" label="Chips (separate with ·)" ph={auto.details || 'Fill Info to get chips'} />
                <div className={styles.field}>
                  <label className={styles.label}>Accent color{form.featured_accent_color && <button type="button" className={styles.autoReset} onClick={() => set('featured_accent_color', '')}>Reset to auto</button>}</label>
                  <div className={styles.swatches}>
                    {COLORS.map(c => <button key={c} type="button" aria-label={c} className={`${styles.swatch} ${(form.featured_accent_color || auto.accent) === c ? styles.swatchOn : ''}`} style={{ background: c }} onClick={() => set('featured_accent_color', c)} />)}
                    <input type="color" className={styles.colorSwatch} value={form.featured_accent_color || auto.accent} onChange={e => set('featured_accent_color', e.target.value)} />
                  </div>
                </div>
                <div className={styles.featPreview}>
                  <div className={styles.pvHead}><span>Popup preview</span></div>
                  <FeaturedOfferModal inline casino={{ ...cur }} onClose={() => {}} onRedirect={() => {}} />
                </div>
              </div>
            )
          })()}
          </div>

          <div className={styles.sec}><Sec id="methods" title="Payment methods" />
          {open.methods && (
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
          </div>

          <div className={styles.sec}><Sec id="content" title="Bonus & content" />
          {open.content && (
            <div className={styles.tabContent}>
              <ArrayField label="Features"      value={features}   onChange={setFeatures}   placeholder="e.g. Fast withdrawals" />
              <BonusField value={bonus} onChange={setBonus} />
              <ArrayField label="VIP Benefits"  value={vip}        onChange={setVip}        placeholder="e.g. Personal manager" />
              <ArrayField label="How to Claim"  value={howToClaim} onChange={setHowToClaim} placeholder="e.g. Register with code" />
            </div>
          )}
          </div>
        </div>

        <aside className={styles.pvPane}>
          <div className={styles.pvHead}>
            <span>Live preview</span>
            <div className={styles.pvSw}>
              {[0, 1, 2].map((i) => <button key={i} type="button" aria-label={`Preview color ${i + 1}`} className={`${styles.pvDot} ${pv === i ? styles.pvDotOn : ''}`} data-i={i} onClick={() => setPv(i)} />)}
            </div>
          </div>
          <div className={styles.pvCard}>
            <OfferRow o={casinoToOffer({ ...form, features, casino_info: ci, welcome_bonus: bonus }, pv)} rank={form.is_featured ? 1 : null} />
          </div>
          <p className={styles.pvNote}>This is how the card looks in Top Offers on the Home page. Headline and sub-line come from the first two Features.</p>
        </aside>
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
function Tag({ tone, children }) {
  return <span className={`${styles.tag} ${styles['tag_' + tone]}`}>{children}</span>
}

function CasinoRow({ casino, index, last, canReorder, onEdit, onDelete, onToggle, onMove, onDuplicate }) {
  const ci = casino.casino_info || {}
  const f0 = Array.isArray(casino.features) && casino.features[0] ? String(casino.features[0].value ?? casino.features[0]) : ''
  return (
    <div className={`${styles.cRow} ${!casino.is_active ? styles.itemRowDim : ''}`}>
      <div className={styles.cOrder}>
        <button className={styles.ordBtn} disabled={!canReorder || index === 0} onClick={() => onMove(casino.id, -1)} aria-label="Move up"><IconUp /></button>
        <span>{index + 1}</span>
        <button className={styles.ordBtn} disabled={!canReorder || last} onClick={() => onMove(casino.id, 1)} aria-label="Move down"><IconDown /></button>
      </div>
      <div className={styles.cLogo}>
        {casino.logo_url
          ? <img src={casino.logo_url} alt={casino.name} onError={e => e.target.style.opacity='.2'} />
          : <span>{(casino.name||'?')[0]}</span>}
      </div>
      <div className={styles.itemMain}>
        <div className={styles.cTop}>
          <span className={styles.itemName}>{casino.name}</span>
          {casino.is_featured && <Tag tone="gold"><IconStar /> Featured</Tag>}
          {casino.is_hot && <Tag tone="red">Hot</Tag>}
          {casino.is_new && <Tag tone="green">New</Tag>}
          {casino.is_freespins && <Tag tone="blue">Free spins</Tag>}
        </div>
        <div className={styles.cSub}>
          {f0 && <span className={styles.cBonus}>{f0}</span>}
          {casino.promo_code && <span className={styles.cCode}>{casino.promo_code}</span>}
          {ci.min_deposit && <span>Min {String(ci.min_deposit.value ?? ci.min_deposit)}</span>}
          {ci.license && <span>{String(ci.license.value ?? ci.license)}</span>}
        </div>
      </div>
      <div className={styles.itemActions}>
        <Toggle checked={!!casino.is_active} onChange={v => onToggle(casino.id, v)} />
        <button className={styles.iconBtnSm} title="Duplicate" onClick={() => onDuplicate(casino)}><IconCopy /></button>
        <button className={styles.iconBtnSm} title="Edit" onClick={() => onEdit(casino)}><IconEdit /></button>
        <button className={`${styles.iconBtnSm} ${styles.iconBtnDanger}`} title="Delete" onClick={() => onDelete(casino.id)}><IconTrash /></button>
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
  const [filter,     setFilter]     = useState('all')

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
  const moveCasino = async (id, dir) => {
    const list = [...casinos]
    const i = list.findIndex(c => c.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    const next = list.map((c, idx) => ({ ...c, sort_order: idx }))
    setCasinos(next)
    const old = new Map(casinos.map(c => [c.id, c.sort_order]))
    await Promise.all(next.filter(c => old.get(c.id) !== c.sort_order)
      .map(c => supabase.from('casinos').update({ sort_order: c.sort_order }).eq('id', c.id)))
  }
  const duplicateCasino = async (c) => {
    const copy = { ...c, name: `${c.name} (copy)`, is_featured: false, is_active: false, sort_order: casinos.length }
    delete copy.id; delete copy.created_at; delete copy.updated_at
    const { error } = await supabase.from('casinos').insert(copy)
    if (error) { alert(error.message); return }
    loadAll()
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
  const FILTERS = [
    ['all', 'All', () => true],
    ['active', 'Active', c => c.is_active],
    ['inactive', 'Inactive', c => !c.is_active],
    ['featured', 'Featured', c => c.is_featured],
    ['hot', 'Hot / New', c => c.is_hot || c.is_new],
  ]
  const fn = FILTERS.find(f => f[0] === filter)[2]
  const filteredCasinos = casinos.filter(c => (!q || c.name?.toLowerCase().includes(q)) && fn(c))
  const canReorder = !q && filter === 'all'
  const filteredMethods = methods.filter(m => !q || m.name?.toLowerCase().includes(q) || m.slug?.toLowerCase().includes(q))

  return (
    <>
      <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className={styles.panel}>

          {/* Sidebar */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarBrand}>
              <div className={styles.brandIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></div>
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

            {section === 'casinos' && !loading && (
              <div className={styles.filterBar}>
                {FILTERS.map(([id, label, f]) => (
                  <button key={id} type="button" className={`${styles.fChip} ${filter === id ? styles.fChipOn : ''}`} onClick={() => setFilter(id)}>
                    {label}<b>{casinos.filter(f).length}</b>
                  </button>
                ))}
                {!canReorder && <span className={styles.fHint}>Clear search and filter to reorder</span>}
              </div>
            )}
            <div className={styles.mainBody}>
              {loading ? (
                <div className={styles.loadingState}><div className={styles.spinner} /><span>Loading...</span></div>
              ) : section === 'casinos' ? (
                filteredCasinos.length === 0
                  ? <div className={styles.emptyState}>{search ? 'No casinos match your search.' : 'No casinos yet.'}</div>
                  : <div className={styles.list}>{filteredCasinos.map((c, i) => <CasinoRow key={c.id} casino={c} index={i} last={i === filteredCasinos.length - 1} canReorder={canReorder} onEdit={setEditCasino} onDelete={deleteCasino} onToggle={toggleCasino} onMove={canReorder ? moveCasino : () => {}} onDuplicate={duplicateCasino} />)}</div>
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