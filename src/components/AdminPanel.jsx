import { useState, useEffect, useCallback } from 'react'
import { supabase, supabaseDash } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import OfferRow from './OfferRow'
import { FeaturedOfferModal } from './HomeModals'
import { autoFeatured } from '../data/featuredOffer'
import { STAT_DEFS, selectedStatKeys } from '../data/offerStats'
import { offerOf, txt } from '../data/offerText'
import { casinoToOffer, PALETTE, PALETTE_NAMES } from '../data/casinoToOffer'
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
                <input className={styles.input} value={(item && typeof item === 'object' ? (item.value ?? item.title ?? item.text ?? item.label ?? item.name ?? item.feature ?? Object.values(item).find(v => typeof v === 'string') ?? '') : item) || ''} onChange={e => update(i, e.target.value)} placeholder={placeholder} />
                <button type="button" className={styles.removeBtn} onClick={() => remove(i)}><IconTrash /></button>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ── Casino Modal ───────────────────────────────────────────
const OFFER_LABELS = ['Welcome bonus', 'Free spins', 'No deposit bonus', 'Cashback', 'Reload bonus', 'Deposit match']
const BADGES = [['is_hot', 'Hot'], ['is_new', 'New'], ['is_freespins', 'Free spins badge']]
const COPY_KEYS = ['casino_info', 'features', 'welcome_bonus', 'vip_benefits', 'how_to_claim', 'payments', 'min_withdrawal', 'support', 'kyc_required', 'vpn_allowed', 'promo_required', 'is_freespins', 'is_hot', 'is_new', 'bg_color']

function Card({ n, title, hint, children, right }) {
  return (
    <section className={styles.card2}>
      <header className={styles.card2Head}>
        <span className={styles.card2N}>{n}</span>
        <div className={styles.card2T}><b>{title}</b>{hint && <span>{hint}</span>}</div>
        {right}
      </header>
      <div className={styles.card2Body}>{children}</div>
    </section>
  )
}

function CasinoModal({ casino, methods, all = [], onSave, onClose, onRefresh }) {
  const isEdit = !!casino?.id
  const blank = { is_active: true, vpn_allowed: true, sort_order: 0 }
  const [form,       setForm]       = useState(blank)
  const [offer,      setOffer]      = useState({ big: '', label: '', sub: '' })
  const [more,       setMore]       = useState([])
  const [bonus,      setBonus]      = useState([])
  const [vip,        setVip]        = useState([])
  const [howToClaim, setHowToClaim] = useState([])
  const [selMethods, setSelMethods] = useState([])
  const [saving,     setSaving]     = useState(false)
  const [errors,     setErrors]     = useState({})
  const [pvTab,      setPvTab]      = useState('card')
  const [adv,        setAdv]        = useState(false)
  const [det,        setDet]        = useState(false)
  const [flash,      setFlash]      = useState('')

  const load = (c) => {
    const T = (x) => txt(x)
    const f = Array.isArray(c?.features) ? c.features : []
    setForm(c ? { ...c } : blank)
    setOffer(c ? offerOf(c) : { big: '', label: '', sub: '' })
    setMore(f.slice(2).map(T))
    setBonus(Array.isArray(c?.welcome_bonus) ? c.welcome_bonus : [])
    setVip(Array.isArray(c?.vip_benefits) ? c.vip_benefits : [])
    setHowToClaim(Array.isArray(c?.how_to_claim) ? c.how_to_claim : [])
    setSelMethods(Array.isArray(c?.payments) ? c.payments : [])
    setErrors({})
  }
  useEffect(() => { load(casino) }, [casino]) // eslint-disable-line react-hooks/exhaustive-deps

  const set   = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }
  const ci    = form.casino_info || {}
  const setCi = (k, v) => set('casino_info', { ...ci, [k]: v })
  const setOf = (k, v) => setOffer(o => ({ ...o, [k]: v }))

  // everything the public site will read, assembled from the editor state
  const offerText = [offer.big, offer.label].filter(Boolean).join(' ')
  const cur = {
    ...form,
    features: [offerText, offer.sub, ...more],
    welcome_bonus: bonus,
    casino_info: { ...ci, offer },
  }

  const copyFrom = (id) => {
    const src = all.find(c => String(c.id) === String(id))
    if (!src) return
    const next = { ...form }
    COPY_KEYS.forEach(k => { if (src[k] !== undefined) next[k] = src[k] })
    next.casino_info = { ...(src.casino_info || {}) }
    setForm(next)
    setOffer(offerOf(src))
    setMore((Array.isArray(src.features) ? src.features : []).slice(2).map(txt))
    setBonus(Array.isArray(src.welcome_bonus) ? src.welcome_bonus : [])
    setVip(Array.isArray(src.vip_benefits) ? src.vip_benefits : [])
    setHowToClaim(Array.isArray(src.how_to_claim) ? src.how_to_claim : [])
    setSelMethods(Array.isArray(src.payments) ? src.payments : [])
  }

  const fillFromBonus = () => {
    const b = bonus[0] || {}
    const upTo = String(b.up_to || '').replace(/^up\s*to\s*/i, '')
    if (b.pct) setOffer({ big: b.pct, label: 'Welcome bonus', sub: [upTo && `Up to ${upTo}`, b.fs && `+ ${b.fs}`].filter(Boolean).join(' ') })
    else if (b.fs) { const m = String(b.fs).match(/^(\d+)\s*(.*)$/); setOffer({ big: m ? m[1] : b.fs, label: 'Free spins', sub: offer.sub }) }
  }

  const validate = () => {
    const e = {}
    if (!form.name)      e.name      = 'Required'
    if (!form.claim_url) e.claim_url = 'Required'
    if (!form.logo_url)  e.logo_url  = 'Required'
    setErrors(e); return Object.keys(e).length === 0
  }

  const handleSave = async (again = false) => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = { ...form, payments: selMethods, welcome_bonus: bonus, vip_benefits: vip, how_to_claim: howToClaim, features: cur.features, casino_info: cur.casino_info }
      delete payload.id
      delete payload.created_at
      delete payload.updated_at
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
      if (again) {
        onRefresh?.()
        load(null)
        setFlash('Saved. Add the next one.')
        setTimeout(() => setFlash(''), 3000)
      } else onSave()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  const sel = selectedStatKeys(cur)
  const toggleStat = (k) => setCi('card_stats', sel.includes(k) ? sel.filter(x => x !== k) : [...sel, k])
  const STAT_INPUT = {
    min_deposit:    { get: () => ci.min_deposit,  put: v => setCi('min_deposit', v),  ph: '€20' },
    withdraw:       { get: () => ci.withdraw,     put: v => setCi('withdraw', v),     ph: 'Up to 24h' },
    license:        { get: () => ci.license,      put: v => setCi('license', v),      ph: 'Curaçao' },
    cashback:       { get: () => ci.cashback,     put: v => setCi('cashback', v),     ph: '10%' },
    min_withdrawal: { get: () => form.min_withdrawal, put: v => set('min_withdrawal', v), ph: '€10' },
    games:          { get: () => ci.games,        put: v => setCi('games', v),        ph: 'Slots, Live' },
    established:    { get: () => ci.established,  put: v => setCi('established', v),  ph: '2020' },
    support:        { get: () => form.support,    put: v => set('support', v),        ph: '24/7 Live Chat' },
  }

  const featuredNow = !!form.is_featured
  const overrideCount = ['featured_offer_title', 'featured_offer_amount', 'featured_offer_details', 'featured_accent_color'].filter(k => form[k]).length

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <div className={styles.modalHeadLeft}>
            {form.logo_url && <img src={form.logo_url} alt="" className={styles.modalLogo} onError={e => e.target.style.display='none'} />}
            <div>
              <div className={styles.modalTitle}>{isEdit ? (form.name || 'Edit casino') : 'New casino'}</div>
              <div className={styles.modalSub}>{flash || (isEdit ? `Casino ID #${casino.id}` : 'Fill 1 and 2 and you are done. The rest is optional.')}</div>
            </div>
          </div>
          <button className={styles.iconBtnSm} onClick={onClose}><IconClose /></button>
        </div>

        <div className={styles.modalSplit}>
          <div className={styles.modalBody}>

            {!isEdit && all.length > 0 && (
              <div className={styles.startFrom}>
                <span>Start from</span>
                <select className={styles.input} value="" onChange={e => copyFrom(e.target.value)}>
                  <option value="">Blank casino</option>
                  {all.map(c => <option key={c.id} value={c.id}>Copy settings of {c.name}</option>)}
                </select>
              </div>
            )}

            <Card n="1" title="Casino" hint="Who it is and where it links">
              <div className={styles.formRow2}>
                <div className={styles.field}>
                  <label className={styles.label}>Name *</label>
                  <input className={`${styles.input} ${errors.name ? styles.inputError : ''}`} value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="Kings Game" />
                  {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Promo code</label>
                  <input className={styles.input} value={form.promo_code || ''} onChange={e => set('promo_code', e.target.value)} placeholder="Jralha" />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Claim link *</label>
                <input className={`${styles.input} ${errors.claim_url ? styles.inputError : ''}`} value={form.claim_url || ''} onChange={e => set('claim_url', e.target.value)} placeholder="https://..." />
                {errors.claim_url && <span className={styles.fieldError}>{errors.claim_url}</span>}
              </div>
              <ImageField label="Logo *" value={form.logo_url} onChange={v => set('logo_url', v)} folder="casinos" />
              {errors.logo_url && <span className={styles.fieldError}>{errors.logo_url}</span>}
              <div className={styles.field}>
                <label className={styles.label}>Status</label>
                <div className={styles.pillRow}>
                  <button type="button" aria-pressed={!!form.is_active} className={`${styles.pill} ${form.is_active ? styles.pillOn : ''}`} onClick={() => set('is_active', !form.is_active)}>{form.is_active && <IconCheck />}Visible</button>
                  {BADGES.map(([k, lbl]) => (
                    <button key={k} type="button" aria-pressed={!!form[k]} className={`${styles.pill} ${form[k] ? styles.pillOn : ''}`} onClick={() => set(k, !form[k])}>{form[k] && <IconCheck />}{lbl}</button>
                  ))}
                  <button type="button" aria-pressed={featuredNow} className={`${styles.pill} ${featuredNow ? styles.pillGold : ''}`} onClick={() => set('is_featured', !featuredNow)}>{featuredNow ? <IconCheck /> : <IconStar />}Entry popup</button>
                </div>
              </div>
            </Card>

            <Card n="2" title="Offer on the card" hint="Big text, label and pill. This is also what the entry popup shows."
              right={bonus.length > 0 && <button type="button" className={styles.autoReset} onClick={fillFromBonus}>Fill from bonus tiers</button>}>
              <div className={styles.formRow2}>
                <div className={styles.field}>
                  <label className={styles.label}>Big text</label>
                  <input className={styles.input} value={offer.big} onChange={e => setOf('big', e.target.value)} placeholder="500%" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Label</label>
                  <input className={styles.input} value={offer.label} onChange={e => setOf('label', e.target.value)} placeholder="Welcome bonus" />
                </div>
              </div>
              <div className={styles.pillRow}>
                {OFFER_LABELS.map(l => (
                  <button key={l} type="button" className={`${styles.pill} ${styles.pillSm} ${offer.label === l ? styles.pillOn : ''}`} onClick={() => setOf('label', l)}>{l}</button>
                ))}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Pill under it</label>
                <input className={styles.input} value={offer.sub} onChange={e => setOf('sub', e.target.value)} placeholder="Up to 4000$ + 77 FS" />
              </div>
            </Card>

            <Card n="3" title="Chips on the card" hint={`Tick what shows (${sel.length} selected) and type the value right here.`}
              right={<button type="button" className={styles.autoReset} onClick={() => setCi('card_stats', undefined)}>Reset</button>}>
              <div className={styles.statGrid2}>
                {STAT_DEFS.map(d => {
                  const inp = STAT_INPUT[d.key]
                  const on = sel.includes(d.key)
                  return (
                    <div key={d.key} className={`${styles.statRow} ${on ? styles.statRowOn : ''}`}>
                      <button type="button" role="checkbox" aria-checked={on} aria-label={d.label} className={styles.statCheck} onClick={() => toggleStat(d.key)}>{on && <IconCheck />}</button>
                      <span className={styles.statName}>{d.label}</span>
                      {inp
                        ? <input className={styles.statInput} value={txt(inp.get())} onChange={e => inp.put(e.target.value)} placeholder={inp.ph} />
                        : <span className={styles.statAuto}>{d.get(cur)} · from rules</span>}
                    </div>
                  )
                })}
              </div>
            </Card>

            <div className={styles.moreWrap}>
              <button type="button" className={`${styles.moreBtn} ${det ? styles.moreBtnOpen : ''}`} onClick={() => setDet(v => !v)} aria-expanded={det}>
                <span className={styles.secChev}><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                <b>Casino page details</b>
                <span>{bonus.length} bonus tiers · {more.length} features · {selMethods.length} methods · {vip.length} VIP · {howToClaim.length} steps</span>
              </button>
              {det && (
                <div className={styles.moreBody}>
                  <BonusField value={bonus} onChange={setBonus} />
                  <ArrayField label="Features" value={more} onChange={setMore} placeholder="e.g. Fast withdrawals" />
                  <ArrayField label="VIP benefits" value={vip} onChange={setVip} placeholder="e.g. Personal manager" />
                  <ArrayField label="How to claim" value={howToClaim} onChange={setHowToClaim} placeholder="e.g. Register with the code" />
                  <div className={styles.field}>
                    <label className={styles.label}>Payment methods ({selMethods.length})</label>
                    <div className={styles.methodsGrid}>
                      {methods.map(m => {
                        const active = selMethods.includes(m.slug)
                        return (
                          <button key={m.slug} type="button" className={`${styles.methodCard} ${active ? styles.methodCardActive : ''}`}
                            onClick={() => setSelMethods(ms => active ? ms.filter(s => s !== m.slug) : [...ms, m.slug])}>
                            <div className={styles.methodCardIcon}>{m.icon_url ? <img src={m.icon_url} alt="" onError={e => e.target.style.display='none'} /> : m.name[0]}</div>
                            <span className={styles.methodCardName}>{m.name}</span>
                            {active && <span className={styles.methodCardCheck}><IconCheck /></span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <ImageField label="Banner" value={form.banner_url} onChange={v => set('banner_url', v)} folder="casinos" />
                  <div className={styles.field}>
                    <label className={styles.label}>Rules</label>
                    <div className={styles.pillRow}>
                      {[['promo_required', 'Promo required', !!form.promo_required], ['kyc_required', 'KYC required', !!form.kyc_required], ['vpn_allowed', 'VPN allowed', form.vpn_allowed !== false]].map(([k, l, on]) => (
                        <button key={k} type="button" aria-pressed={on} className={`${styles.pill} ${on ? styles.pillOn : ''}`} onClick={() => set(k, !on)}>{on && <IconCheck />}{l}</button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.formRow2}>
                    <div className={styles.field}>
                      <label className={styles.label}>Background color</label>
                      <input className={styles.input} value={form.bg_color || ''} onChange={e => set('bg_color', e.target.value)} placeholder="#0f1118" />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Position (use the arrows in the list)</label>
                      <input className={styles.input} type="number" value={form.sort_order ?? 0} onChange={e => set('sort_order', Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              )}
              <button type="button" className={`${styles.moreBtn} ${adv ? styles.moreBtnOpen : ''}`} onClick={() => setAdv(v => !v)} aria-expanded={adv}>
                <span className={styles.secChev}><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                <b>Customize the entry popup</b>
                <span>{overrideCount ? `${overrideCount} custom` : 'Automatic (built from step 2)'}</span>
              </button>
              {adv && (
                <div className={styles.moreBody}>
                  <p className={styles.tabHint}>The popup copies the offer from step 2. Fill only what you want to change.</p>
                  {[['featured_offer_title', 'Title', autoFeatured(cur).title], ['featured_offer_amount', 'Big text', autoFeatured(cur).amount], ['featured_offer_details', 'Chips (separate with ·)', autoFeatured(cur).details]].map(([k, l, ph]) => (
                    <div key={k} className={styles.field}>
                      <label className={styles.label}>{l}{form[k] ? <button type="button" className={styles.autoReset} onClick={() => set(k, '')}>Reset to auto</button> : <span className={styles.autoTag}>Auto</span>}</label>
                      <input className={styles.input} value={form[k] || ''} onChange={e => set(k, e.target.value)} placeholder={ph || 'Auto'} />
                    </div>
                  ))}
                  <div className={styles.field}>
                    <label className={styles.label}>Popup color{form.featured_accent_color ? <button type="button" className={styles.autoReset} onClick={() => set('featured_accent_color', '')}>Reset to auto</button> : <span className={styles.autoTag}>Same as card</span>}</label>
                    <div className={styles.swatches}>
                      {PALETTE.map(([ac], i) => <button key={i} type="button" aria-label={PALETTE_NAMES[i]} className={`${styles.swatch} ${form.featured_accent_color === ac ? styles.swatchOn : ''}`} style={{ background: ac }} onClick={() => set('featured_accent_color', ac)} />)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className={styles.pvPane}>
            <div className={styles.pvTabs}>
              <button type="button" className={pvTab === 'card' ? styles.pvTabOn : ''} onClick={() => setPvTab('card')}>Card</button>
              <button type="button" className={pvTab === 'popup' ? styles.pvTabOn : ''} onClick={() => setPvTab('popup')}>Entry popup</button>
            </div>
            <div className={styles.pvColors}>
              <button type="button" className={`${styles.pvAuto} ${Number.isInteger(ci.card_color) ? '' : styles.pvAutoOn}`} onClick={() => setCi('card_color', undefined)} title="Color by position in the list">Auto</button>
              {PALETTE.map(([ac], i) => (
                <button key={i} type="button" title={PALETTE_NAMES[i]} aria-label={PALETTE_NAMES[i]} className={`${styles.pvDot} ${ci.card_color === i ? styles.pvDotOn : ''}`} style={{ background: ac }} onClick={() => setCi('card_color', i)} />
              ))}
            </div>
            <div className={styles.pvCard}>
              {pvTab === 'card'
                ? <OfferRow o={casinoToOffer(cur, 0)} rank={featuredNow ? 1 : null} />
                : <FeaturedOfferModal inline casino={cur} onClose={() => {}} onRedirect={() => {}} />}
            </div>
            <p className={styles.pvNote}>{pvTab === 'card' ? 'Top Offers on the Home page.' : featuredNow ? 'Shown to visitors when they enter the site.' : 'Not shown yet: switch on "Entry popup" in step 1.'}</p>
          </aside>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose}>Cancel</button>
          {!isEdit && <button className={styles.btnGhost} onClick={() => handleSave(true)} disabled={saving}>Save and add another</button>}
          <button className={styles.btnPrimary} onClick={() => handleSave(false)} disabled={saving}>
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
        <CasinoModal casino={editCasino || null} methods={methods} all={casinos} onRefresh={loadAll}
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