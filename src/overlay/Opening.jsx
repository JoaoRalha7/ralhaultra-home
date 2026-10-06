import { useState, useEffect, useRef, useCallback } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

function parseBet(val) {
  if (!val) return 0
  return parseFloat(String(val).replace(',', '.')) || 0
}
function fmtPay(v) {
  if (v === null || v === undefined) return '—'
  return v >= 100 ? Math.floor(v).toLocaleString('pt-PT') + '€' : v.toFixed(2) + '€'
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3) }

function getPos(idx, currentIndex) {
  const d = idx - currentIndex
  if (d === 0)  return 'pos-center'
  if (d === -1) return 'pos-prev1'
  if (d === 1)  return 'pos-next1'
  if (d === -2) return 'pos-prev2'
  if (d === 2)  return 'pos-next2'
  if (d === -3) return 'pos-prev3'
  if (d === 3)  return 'pos-next3'
  return d < 0 ? 'pos-hidden-left' : 'pos-hidden-right'
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;900&family=Sora:wght@700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
html, body { background: transparent !important; margin: 0; padding: 0; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0d0f18; --surface: #12141f; --surface2: #1a1d2e; --surface3: #22253a;
  --border: rgba(255,255,255,0.07); --border2: rgba(255,255,255,0.12);
  --text: #eeeef5; --muted: #6b7280; --muted2: #9090b0;
  --accent: #7c6fff; --accent-dim: rgba(124,111,255,0.15);
  --green: #22c55e; --green-dim: rgba(34,197,94,0.12);
  --red: #ef4444; --red-dim: rgba(239,68,68,0.12);
  --amber: #f59e0b; --gold: #fbbf24;
  --font: 'Rubik', system-ui, sans-serif; --mono: 'JetBrains Mono', monospace;
  --display: 'Sora', sans-serif;
}

/* ── OVERLAY: 640 × 1600 ── */
.overlay {
  width: 640px; height: 1600px; background: #07090f;
  border-radius: 20px; border: 1px solid var(--border2);
  display: flex; flex-direction: column; gap: 8px; padding: 8px;
  overflow: hidden; margin: 0 auto; font-family: var(--font);
  animation: fadeUp .4s ease;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
}
@keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
.header, .prog-wrap, .carousel-wrap,
.section-divider, .slots-list-wrap, .footer {
  border-radius: 20px; border: 1px solid var(--border); flex-shrink: 0;
}

/* ── HEADER: 72px ── */
.header { height: 72px; background: var(--surface); display: flex; align-items: center; padding: 0 22px; gap: 14px; }
.header-title { font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: .06em; }
.header-pill {
  background: rgba(124,111,255,.15); border: 1px solid rgba(124,111,255,.45);
  border-radius: 100px; padding: 4px 18px;
  font-size: 24px; font-weight: 800; color: #a78bfa;
  font-family: var(--display); letter-spacing: -.01em;
}
.live-dot {
  width: 14px; height: 14px; border-radius: 50%; background: var(--red);
  box-shadow: 0 0 14px rgba(239,68,68,.7);
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

/* ── STATS GRID: 3 cols ── */
.stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; flex-shrink: 0; }
.stat-box {
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: 18px; padding: 12px 16px;
  display: flex; align-items: center; gap: 12px;
}
.stat-box-icon {
  width: 50px; height: 50px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.stat-box-icon.purple { background: rgba(124,111,255,.15); color: var(--accent); }
.stat-box-icon.gold   { background: rgba(251,191,36,.15);  color: var(--gold); }
.stat-box-icon.amber  { background: rgba(245,158,11,.15);  color: var(--amber); }
.stat-box-icon.green  { background: rgba(34,197,94,.15);   color: var(--green); }
.stat-box-icon.blue   { background: rgba(59,130,246,.15);  color: #60a5fa; }
.stat-box-icon.red    { background: rgba(239,68,68,.15);   color: var(--red); }
.stat-box-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.stat-box-lbl  { font-size: 16px; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: .06em; line-height: 1; white-space: nowrap; }
.stat-box-val  { font-size: 24px; font-weight: 800; font-family: var(--display); color: var(--text); line-height: 1.1; letter-spacing: -.02em; }
.stat-box-val.purple { color: var(--accent); }
.stat-box-val.gold   { color: var(--gold); }
.stat-box-val.amber  { color: var(--amber); }
.stat-box-val.green  { color: var(--green); }
.stat-box-val.blue   { color: #60a5fa; }
.stat-box-val.red    { color: var(--red); }

/* ── TOTALS ROW ── */
.totals-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; flex-shrink: 0; padding: 8px; }
.total-box {
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: 18px; padding: 12px 22px; display: flex; align-items: center; gap: 14px;
}
.total-box-icon {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.total-box-icon.green  { background: rgba(34,197,94,.15);   color: var(--green); }
.total-box-icon.red    { background: rgba(239,68,68,.15);   color: var(--red); }
.total-box-icon.accent { background: rgba(124,111,255,.15); color: var(--accent); }
.total-box-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.total-box-lbl  { font-size: 16px; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: .06em; line-height: 1; }
.total-box-val  { font-size: 24px; font-weight: 800; font-family: var(--display); color: var(--text); line-height: 1.1; letter-spacing: -.02em; }
.total-box-val.green { color: var(--green); }
.total-box-val.red   { color: var(--red); }

/* ── PROGRESS BAR: 40px ── */
.prog-wrap { height: 40px; background: var(--surface); position: relative; display: flex; align-items: center; }
.prog-fill {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: linear-gradient(90deg, var(--accent), #a78bfa);
  transition: width .5s cubic-bezier(.4,0,.2,1); width: 0%; border-radius: 20px;
  animation: prog-pulse 2s ease-in-out infinite;
}
@keyframes prog-pulse {
  0%,100% { box-shadow: 0 0 14px rgba(124,111,255,.4); filter: brightness(1); }
  50%      { box-shadow: 0 0 36px rgba(124,111,255,.8); filter: brightness(1.2); }
}
.prog-label {
  position: relative; z-index: 1; width: 100%; text-align: center;
  font-size: 20px; font-weight: 800; font-family: var(--display);
  color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,.75);
}

/* ── CAROUSEL: 368px ── */
.carousel-wrap {
  height: 368px; overflow: hidden; display: flex; align-items: center;
  position: relative; perspective: 2300px; background: var(--bg);
}
.carousel-wrap::after {
  content: ''; position: absolute; left: 50%; top: 50%;
  transform: translate(-50%,-50%); width: 252px; height: 252px;
  background: radial-gradient(circle, rgba(124,111,255,.10) 0%, transparent 70%);
  pointer-events: none; border-radius: 50%;
}
.carousel { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; position: relative; transform-style: preserve-3d; }
.slot-item {
  position: absolute; display: flex; flex-direction: column; align-items: center; gap: 6px;
  transition: all .55s cubic-bezier(.34,1.3,.64,1); transform-origin: center; transform-style: preserve-3d;
}
.slot-item.pos-center  { transform: translateX(0) translateZ(0) rotateY(0deg) scale(1.05); opacity:1; z-index:5; }
.slot-item.pos-prev1   { transform: translateX(-206px) translateZ(-96px) rotateY(22deg) scale(0.77); opacity:.6; z-index:4; }
.slot-item.pos-next1   { transform: translateX(206px) translateZ(-96px) rotateY(-22deg) scale(0.77); opacity:.6; z-index:4; }
.slot-item.pos-prev2   { transform: translateX(-366px) translateZ(-192px) rotateY(38deg) scale(0.57); opacity:.25; z-index:3; }
.slot-item.pos-next2   { transform: translateX(366px) translateZ(-192px) rotateY(-38deg) scale(0.57); opacity:.25; z-index:3; }
.slot-item.pos-prev3, .slot-item.pos-next3 { opacity:0; z-index:0; pointer-events:none; }
.slot-item.pos-hidden-left  { transform: translateX(-446px) scale(0.3); opacity:0; z-index:0; pointer-events:none; }
.slot-item.pos-hidden-right { transform: translateX(446px) scale(0.3); opacity:0; z-index:0; pointer-events:none; }
.slot-img-wrap { position: relative; border-radius: 26px; overflow: hidden; box-shadow: 0 14px 40px rgba(0,0,0,.75); }
.slot-img {
  width: 196px; height: 274px; border-radius: 26px;
  object-fit: cover; background: var(--surface2); display: block;
  border: 4px solid rgba(255,255,255,.15); transition: border-color .3s, box-shadow .3s;
}
.slot-item.pos-center .slot-img        { border-color: var(--accent); box-shadow: 0 0 48px rgba(124,111,255,.5); }
.slot-item.pos-center.opened .slot-img { border-color: var(--green);  box-shadow: 0 0 48px rgba(34,197,94,.5); }
.slot-item.pos-center.best-slot .slot-img  { border-color: var(--green); box-shadow: 0 0 60px rgba(34,197,94,.6); }
.slot-item.pos-center.worst-slot .slot-img { border-color: var(--red);   box-shadow: 0 0 60px rgba(239,68,68,.6); }
.slot-item.super .slot-img { border-color: var(--gold) !important; box-shadow: 0 0 48px rgba(251,191,36,.5) !important; }
.slot-overlay-top {
  position: absolute; top: 0; left: 0; right: 0;
  display: flex; align-items: center; justify-content: space-between; padding: 16px 22px;
  background: linear-gradient(to bottom, rgba(0,0,0,.45) 0%, transparent 100%);
}
.slot-num {
  font-size: 18px; font-weight: 800; font-family: var(--display); color: #fff;
  background: rgba(0,0,0,.75); padding: 4px 12px; border-radius: 20px; line-height: 1;
}
.slot-item.pos-center .slot-num { background: rgba(124,111,255,.7); font-size: 20px; }
.slot-super-tag {
  font-size: 14px; font-weight: 700; letter-spacing: .5px; padding: 2px 10px; border-radius: 6px;
  background: rgba(251,191,36,.3); color: var(--gold); border: 1px solid rgba(251,191,36,.6); text-transform: uppercase;
}
.slot-overlay-bottom {
  position: absolute; bottom: 0; left: 0; right: 0; padding: 50px 20px 20px;
  background: linear-gradient(to top, rgba(0,0,0,.75) 0%, rgba(0,0,0,.15) 60%, transparent 100%);
}
.slot-bottom-row { display: flex; justify-content: center; align-items: flex-end; width: 100%; gap: 5px; }
.slot-bottom-row.has-pay { justify-content: space-between; }
.slot-bottom-col { display: flex; align-items: center; gap: 3px; }
.slot-bet-val {
  font-size: 18px; font-weight: 800; font-family: var(--display); color: rgba(255,255,255,.9); line-height: 1;
  background: rgba(0,0,0,.72); padding: 4px 12px; border-radius: 20px; display: flex; align-items: center; gap: 4px;
}
.slot-payment-val {
  font-size: 18px; font-weight: 800; font-family: var(--display); color: #fff; line-height: 1;
  background: rgba(0,0,0,.72); padding: 4px 12px; border-radius: 20px; display: none; align-items: center; gap: 4px;
}
.slot-payment-val.visible { display: flex; }
@keyframes colorBlink { 0%{opacity:1} 20%{opacity:0} 40%{opacity:1} 60%{opacity:0} 80%{opacity:1} 100%{opacity:1} }
.slot-payment-val.blink { animation: colorBlink .5s ease; }
.slot-label { font-size: 18px; font-weight: 600; color: var(--muted2); text-align: center; max-width: 206px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
.slot-item.pos-center .slot-label { color: var(--text); font-size: 20px; font-weight: 700; }

/* ── SECTION DIVIDER: 46px ── */
.section-divider { height: 46px; display: flex; align-items: center; justify-content: center; gap: 6px; background: var(--surface2); }
.section-divider::before, .section-divider::after { content: ''; flex: 1; height: 1px; background: var(--border2); margin: 0 14px; }
.section-divider span { font-size: 18px; font-weight: 700; color: var(--muted2); letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; }

/* ── SLOTS LIST ── */
.slots-list-wrap { flex: 1; overflow: hidden; background: var(--bg); scrollbar-width: none; min-height: 0; position: relative; }
.slots-list-wrap::-webkit-scrollbar { display: none; }
.slots-list { display: flex; flex-direction: column; }
.list-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.list-row.current  { background: var(--accent-dim); }
.list-row.opened   { opacity: 1; }
.list-row.unopened { opacity: .5; }
.list-num { font-size: 18px; font-weight: 800; font-family: var(--display); color: var(--muted2); min-width: 40px; text-align: center; flex-shrink: 0; }
.list-img { width: 64px; height: 64px; border-radius: 14px; object-fit: cover; background: var(--surface3); flex-shrink: 0; }
.list-info { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.list-name-row { display: flex; align-items: center; gap: 3px; min-width: 0; }
.list-name { font-size: 20px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.list-super-tag { font-size: 14px; font-weight: 700; letter-spacing: .5px; padding: 2px 8px; border-radius: 6px; flex-shrink: 0; background: rgba(251,191,36,.15); color: var(--gold); border: 1px solid rgba(251,191,36,.3); text-transform: uppercase; }
.list-provider { font-size: 18px; color: var(--muted2); }
.list-picker { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; color: #60a5fa; background: rgba(59,130,246,.12); border: 1px solid rgba(59,130,246,.25); border-radius: 999px; padding: 1px 5px; margin-top: 1px; width: fit-content; }
.list-cols { display: flex; flex-direction: column; gap: 2px; align-items: flex-end; flex-shrink: 0; }
.list-col-row { display: flex; align-items: center; gap: 3px; }
.list-col-lbl { font-size: 16px; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: .4px; min-width: 40px; text-align: right; }
.list-col-val { font-size: 18px; font-weight: 800; font-family: var(--display); color: var(--muted2); min-width: 92px; text-align: right; }
.list-col-val.good  { color: var(--green); }
.list-col-val.bad   { color: var(--red); }
.list-col-val.white { color: var(--text); }
.list-col-val.empty { color: var(--muted); }

/* ── FOOTER ── */
.footer { flex-shrink: 0; background: var(--surface); display: flex; flex-direction: column; }
.flip-container { width: 100%; height: 0; overflow: hidden; perspective: 1000px; transition: height .6s cubic-bezier(.4,0,.2,1), opacity .4s; opacity: 0; }
.flip-container.visible { height: 120px; opacity: 1; border-bottom: 1px solid var(--border); }
.flip-inner { width: 100%; height: 100%; position: relative; transform-style: preserve-3d; transition: transform .7s cubic-bezier(.4,0,.2,1); }
.flip-inner.flipped { transform: rotateY(180deg); }
.flip-face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; display: flex; align-items: center; gap: 16px; padding: 14px 24px; border-radius: 18px; }
.flip-back { transform: rotateY(180deg); }
.flip-face.flip-front { background: linear-gradient(90deg, rgba(34,197,94,.12), transparent); border-left: 6px solid var(--green); }
.flip-face.flip-back  { background: linear-gradient(90deg, rgba(239,68,68,.12), transparent); border-left: 6px solid var(--red); }
.flip-badge { font-size: 16px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; padding: 4px 14px; border-radius: 100px; flex-shrink: 0; }
.flip-badge.best  { background: var(--green-dim); color: var(--green); border: 1px solid rgba(34,197,94,.3); }
.flip-badge.worst { background: var(--red-dim);   color: var(--red);   border: 1px solid rgba(239,68,68,.3); }
.flip-img { width: 82px; height: 82px; border-radius: 16px; object-fit: cover; flex-shrink: 0; }
.flip-face.flip-front .flip-img { border: 4px solid rgba(34,197,94,.5); }
.flip-face.flip-back  .flip-img { border: 4px solid rgba(239,68,68,.5); }
.flip-details { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.flip-name { font-size: 20px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.flip-provider { font-size: 16px; color: var(--muted2); }
.flip-bets { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
.flip-bet-block { display: flex; flex-direction: column; }
.flip-bet-lbl { font-size: 16px; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: .4px; }
.flip-bet-val { font-size: 22px; font-weight: 800; font-family: var(--display); color: var(--text); }
.flip-bet-val.bet { color: var(--amber); }
.flip-bet-val.win { color: var(--green); }
.flip-bet-val.red { color: var(--red); }
.flip-arrow { font-size: 18px; color: var(--muted); margin-top: 8px; }
.flip-multi { font-size: 34px; font-weight: 800; font-family: var(--display); flex-shrink: 0; }
.flip-multi.best  { color: var(--green); }
.flip-multi.worst { color: var(--red); }
`

function useAnimatedValue(target, duration = 800) {
  const [val, setVal] = useState(target)
  const prev = useRef(target)
  const raf  = useRef(null)
  useEffect(() => {
    if (prev.current === target) return
    const from = prev.current
    prev.current = target
    const t0 = performance.now()
    cancelAnimationFrame(raf.current)
    function tick(now) {
      const p = Math.min((now - t0) / duration, 1)
      setVal(from + (target - from) * easeOut(p))
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else setVal(target)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return val
}

function CarouselItem({ entry, index, currentIndex, bestId, worstId, isAnimatingIdx, onPaymentDone }) {
  const slot     = entry.slot || {}
  const bet      = parseBet(entry.bet)
  const pay      = entry.payment ? parseFloat(entry.payment) : null
  const multi    = pay && bet ? pay / bet : null
  const position = getPos(index, currentIndex)
  const isCenter = position === 'pos-center'
  const payRef   = useRef(null)
  const didAnim  = useRef(false)

  useEffect(() => {
    if (!isCenter || !pay || !isAnimatingIdx || didAnim.current) return
    didAnim.current = true
    const el = payRef.current
    if (!el) return
    const dur = Math.min(3500, Math.max(1200, pay * 2.5))
    const t0  = performance.now()
    el.textContent = '0.00€'
    el.style.color = '#fff'
    el.classList.add('visible')
    function tick(now) {
      const p = Math.min((now - t0) / dur, 1)
      const v = easeOut(p) * pay
      el.textContent = pay >= 100 ? Math.floor(v).toLocaleString('pt-PT') + '€' : v.toFixed(2) + '€'
      if (p < 1) { requestAnimationFrame(tick); return }
      el.textContent = fmtPay(pay)
      el.classList.remove('blink')
      void el.offsetWidth
      el.classList.add('blink')
      el.style.color = multi >= 100 ? 'var(--green)' : 'var(--red)'
      setTimeout(onPaymentDone, 2000)
    }
    requestAnimationFrame(tick)
  }, [isCenter, isAnimatingIdx])

  useEffect(() => { didAnim.current = false }, [entry.id, entry.payment])

  const classes = [
    'slot-item', position,
    entry.opened ? 'opened' : '',
    entry.is_super ? 'super' : '',
    entry.id === bestId  ? 'best-slot'  : '',
    entry.id === worstId ? 'worst-slot' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <div className="slot-img-wrap">
        <img className="slot-img" src={slot.image_url || ''} alt={slot.name || ''} onError={e => { e.target.style.opacity = '.3' }} />
        <div className="slot-overlay-top">
          <span className="slot-num">#{index + 1}</span>
          {entry.is_super && <span className="slot-super-tag">SUPER</span>}
        </div>
        <div className="slot-overlay-bottom">
          <div className={`slot-bottom-row${entry.opened && pay ? ' has-pay' : ''}`}>
            {entry.opened && pay && (
              <div className="slot-bottom-col">
                <span
                  ref={payRef}
                  className={`slot-payment-val${(!isAnimatingIdx || !isCenter) ? ' visible' : ''}`}
                  style={{ color: multi >= 100 ? 'var(--green)' : 'var(--red)' }}
                >
                  {fmtPay(pay)}
                </span>
              </div>
            )}
            <div className="slot-bottom-col">
              <span className="slot-bet-val">{bet > 0 ? bet.toFixed(2) + '€' : '—'}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="slot-label">{slot.name || '—'}</div>
    </div>
  )
}

function ListRow({ entry, index, isCurrent, picker }) {
  const slot  = entry.slot || {}
  const bet   = parseBet(entry.bet)
  const pay   = entry.payment ? parseFloat(entry.payment) : null
  const multi = pay && bet ? pay / bet : null
  const mc    = multi === null ? 'empty' : multi >= 100 ? 'good' : 'bad'
  const winRef  = useRef(null)
  const prevPay = useRef(null)

  useEffect(() => {
    if (!pay) { prevPay.current = null; return }
    if (pay === prevPay.current || !winRef.current) return
    const el  = winRef.current
    const old = prevPay.current
    prevPay.current = pay
    if (old !== null) return
    const dur = Math.min(2500, Math.max(800, pay * 2))
    const t0  = performance.now()
    el.textContent = '0.00€'
    function tick(now) {
      const p = Math.min((now - t0) / dur, 1)
      const v = easeOut(p) * pay
      el.textContent = pay >= 100 ? Math.floor(v).toLocaleString('pt-PT') + '€' : v.toFixed(2) + '€'
      if (p < 1) { requestAnimationFrame(tick); return }
      el.textContent = fmtPay(pay)
    }
    requestAnimationFrame(tick)
  }, [pay])

  const cls = 'list-row ' + (isCurrent ? 'current' : entry.opened ? 'opened' : 'unopened')

  return (
    <div className={cls}>
      <div className="list-num">#{index + 1}</div>
      <img className="list-img" src={slot.image_url || ''} alt={slot.name || ''} onError={e => { e.target.style.opacity = '.3' }} />
      <div className="list-info">
        <div className="list-name-row">
          <div className="list-name">{slot.name || '—'}</div>
          {entry.is_super && <span className="list-super-tag">SUPER</span>}
        </div>
        <div className="list-provider">{slot.provider || ''}</div>
        {picker && (
          <div className="list-picker">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            {picker}
          </div>
        )}
      </div>
      <div className="list-cols">
        {pay ? <>
          <div className="list-col-row">
            <span className="list-col-lbl">BET</span>
            <span className="list-col-val">{bet ? bet.toFixed(2) + '€' : '—'}</span>
          </div>
          <div className="list-col-row">
            <span className="list-col-lbl">X</span>
            <span className={`list-col-val ${mc}`}>{multi ? multi.toFixed(1) + 'x' : '—'}</span>
          </div>
          <div className="list-col-row">
            <span className="list-col-lbl">WIN</span>
            <span className="list-col-val white" ref={winRef}>{fmtPay(pay)}</span>
          </div>
        </> : <>
          <div className="list-col-row">
            <span className="list-col-lbl">BET</span>
            <span className="list-col-val">{bet ? bet.toFixed(2) + '€' : '—'}</span>
          </div>
        </>}
      </div>
    </div>
  )
}

function FlipCard({ best, worst }) {
  const [flipped, setFlipped] = useState(false)
  const hasData = !!(best && worst)

  useEffect(() => {
    if (!hasData) return
    const t = setInterval(() => setFlipped(f => !f), 4000)
    return () => clearInterval(t)
  }, [hasData])

  const Face = ({ entry, type }) => {
    const slot  = entry.slot || {}
    const bet   = parseBet(entry.bet)
    const pay   = parseFloat(entry.payment)
    const multi = pay / bet
    return (
      <div className={`flip-face ${type === 'best' ? 'flip-front' : 'flip-back'}`}>
        <div className={`flip-badge ${type}`}>{type === 'best' ? 'Best' : 'Worst'}</div>
        <img className="flip-img" src={slot.image_url || ''} alt={slot.name || ''} onError={e => { e.target.style.opacity = '.3' }} />
        <div className="flip-details">
          <div className="flip-name">{slot.name || '—'}</div>
          <div className="flip-provider">{slot.provider || ''}</div>
          <div className="flip-bets">
            <div className="flip-bet-block">
              <span className="flip-bet-lbl">BET</span>
              <span className="flip-bet-val bet">{bet.toFixed(2)}€</span>
            </div>
            <div className="flip-arrow">→</div>
            <div className="flip-bet-block">
              <span className="flip-bet-lbl">WIN</span>
              <span className={`flip-bet-val ${type === 'worst' ? 'red' : 'win'}`}>{pay.toFixed(2)}€</span>
            </div>
          </div>
        </div>
        <div className={`flip-multi ${type}`}>{multi.toFixed(1)}x</div>
      </div>
    )
  }

  return (
    <div className={`flip-container${hasData ? ' visible' : ''}`}>
      <div className={`flip-inner${flipped ? ' flipped' : ''}`}>
        {best  && <Face entry={best}  type="best"  />}
        {worst && <Face entry={worst} type="worst" />}
      </div>
    </div>
  )
}

function AnimBoxVal({ value, format, className = '' }) {
  const v = useAnimatedValue(value)
  return <div className={`stat-box-val${className ? ' ' + className : ''}`}>{format(v)}</div>
}
function AnimTotalVal({ value, format, className = '' }) {
  const v = useAnimatedValue(value)
  return <div className={`total-box-val${className ? ' ' + className : ''}`}>{format(v)}</div>
}

function useListScroll(wrapRef, listRef) {
  const posRef     = useRef(0)
  const rafRef     = useRef(null)
  const cloneRef   = useRef(null)
  const obsRef     = useRef(null)
  const resRef     = useRef(null)
  const startedRef = useRef(false)

  useEffect(() => {
    const wrap = wrapRef.current
    const list = listRef.current
    if (!wrap || !list) return

    function startScroll() {
      if (startedRef.current) return
      if (list.scrollHeight <= wrap.clientHeight) return
      startedRef.current = true
      const clone = list.cloneNode(true)
      clone.setAttribute('aria-hidden', 'true')
      cloneRef.current = clone
      wrap.appendChild(clone)
      let lastTs = 0
      function tick(ts) {
        const dt = lastTs ? Math.min(ts - lastTs, 33) : 16.7
        lastTs = ts
        const h = list.scrollHeight
        if (h > 0) {
          posRef.current += 0.5 * (dt / 16.7)
          if (posRef.current >= h) posRef.current -= h
          const y = posRef.current
          list.style.transform = `translateY(${-y}px)`
          if (cloneRef.current) cloneRef.current.style.transform = `translateY(${-y}px)`
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
      const mutOpts = { childList: true, subtree: true, characterData: true, attributes: true }
      const observer = new MutationObserver(() => {
        if (!cloneRef.current) return
        observer.disconnect()
        const updated = list.cloneNode(true)
        updated.setAttribute('aria-hidden', 'true')
        wrap.replaceChild(updated, cloneRef.current)
        cloneRef.current = updated
        observer.observe(list, mutOpts)
      })
      obsRef.current = observer
      observer.observe(list, mutOpts)
    }

    const ro = new ResizeObserver(() => startScroll())
    resRef.current = ro
    ro.observe(list)
    startScroll()

    return () => {
      if (resRef.current) { resRef.current.disconnect(); resRef.current = null }
      if (obsRef.current) { obsRef.current.disconnect(); obsRef.current = null }
      cancelAnimationFrame(rafRef.current)
      if (cloneRef.current) { cloneRef.current.remove(); cloneRef.current = null }
      startedRef.current = false
    }
  }, [])
}

export default function Opening() {
  const [entries,      setEntries]      = useState([])
  const [hunt,         setHunt]         = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [animatingIdx, setAnimatingIdx] = useState(null)
  const [picksMap,     setPicksMap]     = useState({})

  const isAnimating = useRef(false)
  const firstLoad   = useRef(true)
  const prevEntries = useRef([])
  const wrapRef     = useRef(null)
  const listRef     = useRef(null)

  useListScroll(wrapRef, listRef)

  const loadData = useCallback(async () => {
    const { data: h } = await supabase.from('bonus_hunts').select('*').eq('active', true).limit(1).single()
    if (!h) return
    setHunt(h)

    const [{ data }, { data: pgData }] = await Promise.all([
      supabase.from('bonus_entries').select('*, slot:slots(*)').eq('hunt_id', h.id).order('created_at', { ascending: true }),
      supabase.from('pick_games').select('id, status').eq('hunt_id', h.id).in('status', ['open','closed','finished']).order('created_at', { ascending: false }).limit(1),
    ])
    if (!data) return

    if (pgData?.[0]) {
      const { data: ps } = await supabase.from('picks').select('entry_id, twitch_username').eq('game_id', pgData[0].id)
      const map = {}
      for (const p of (ps || [])) map[p.entry_id] = p.twitch_username
      setPicksMap(map)
    }

    if (firstLoad.current) {
      firstLoad.current = false
      const idx = data.findIndex(e => !e.opened)
      const ci  = idx >= 0 ? idx : data.length - 1
      setCurrentIndex(ci)
      setEntries(data)
      prevEntries.current = data
      return
    }

    const prevMap = new Map(prevEntries.current.map(e => [e.id, e]))
    const paymentRemoved = data.find(e => {
      const prev = prevMap.get(e.id)
      return prev?.payment && !e.payment
    })
    if (paymentRemoved) {
      const idx = data.findIndex(e => e.id === paymentRemoved.id)
      isAnimating.current = false
      setAnimatingIdx(null)
      setCurrentIndex(idx)
      setEntries(data)
      prevEntries.current = data
      return
    }
    if (!isAnimating.current) {
      const newlyOpened = data.find(e => {
        const prev = prevMap.get(e.id)
        return e.opened && e.payment && (!prev || !prev.payment)
      })
      if (newlyOpened) {
        const idx = data.findIndex(e => e.id === newlyOpened.id)
        isAnimating.current = true
        setAnimatingIdx(idx)
        setCurrentIndex(idx)
        setEntries(data)
        prevEntries.current = data
      } else {
        setEntries(data)
        prevEntries.current = data
      }
    }
  }, [])

  function handlePaymentDone() {
    isAnimating.current = false
    setAnimatingIdx(null)
    setEntries(prev => {
      const idx = prev.findIndex(e => !e.opened)
      setCurrentIndex(idx >= 0 ? idx : prev.length - 1)
      return prev
    })
  }

  useEffect(() => {
    loadData()
    const ch = supabase.channel('opening-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_entries' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_hunts'   }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'picks'         }, loadData)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadData])

  const balStart   = parseFloat(hunt?.balance_start) || 0
  const balEnd     = parseFloat(hunt?.balance_end)
  const hasBalEnd  = !isNaN(balEnd) && hunt?.balance_end != null
  const target     = hasBalEnd ? Math.max(0, balStart - balEnd) : balStart
  const allWithBet = entries.filter(e => parseBet(e.bet) > 0)
  const totalBets  = allWithBet.reduce((a, e) => a + parseBet(e.bet), 0)
  const opened = entries.filter(e =>
    e.opened && e.payment != null && !isNaN(parseFloat(e.payment)) &&
    parseBet(e.bet) > 0 && e.slot
  )
  const unopened  = entries.filter(e => !e.opened && parseBet(e.bet) > 0)
  const totalPay  = opened.reduce((a, e) => a + parseFloat(e.payment), 0)
  const sumUnop   = unopened.reduce((a, e) => a + parseBet(e.bet), 0)
  const supers    = entries.filter(e => e.is_super).length
  const nOpened   = entries.filter(e => e.opened).length
  const beInicial = totalBets > 0 ? target / totalBets : 0
  const beAtual   = sumUnop   > 0 ? (target - totalPay) / sumUnop : 0
  const avg       = opened.length > 0
    ? opened.reduce((a, e) => a + parseFloat(e.payment) / parseBet(e.bet), 0) / opened.length : 0
  const profit    = hasBalEnd ? balEnd + totalPay - balStart : totalPay - balStart
  const pct       = entries.length > 0 ? (nOpened / entries.length * 100) : 0
  const withMulti = opened.map(e => ({ ...e, multi: parseFloat(e.payment) / parseBet(e.bet) }))
  const sorted    = [...withMulti].sort((a, b) => b.multi - a.multi)
  const best      = sorted[0] || null
  const worst     = sorted[sorted.length - 1] || null
  const match       = (hunt?.title || '').match(/#?(\d+)/)
  const huntNum     = match ? `#${match[1]}` : '#—'
  const profitColor = opened.length > 0 ? (profit >= 0 ? 'green' : 'red') : ''

  return (
    <div className="overlay">
      <style>{CSS}</style>

      <div className="header">
        <div className="header-pill">{huntNum}</div>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
        </svg>
        <div className="header-title">BONUS OPENING</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="live-dot" />
          <span style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,.35)', letterSpacing: '.08em', textTransform: 'uppercase' }}>live</span>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-box-icon blue">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="stat-box-body">
            <div className="stat-box-lbl">Start</div>
            <div className="stat-box-val blue">{balStart > 0 ? balStart.toFixed(0) + '€' : '—'}</div>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-box-icon amber">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 4-1 7-1s5 1 7 1h2"/></svg>
          </div>
          <div className="stat-box-body">
            <div className="stat-box-lbl">BE INIT</div>
            <AnimBoxVal value={beInicial} format={v => v > 0 ? v.toFixed(1) + 'x' : '—'} className="amber" />
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-box-icon amber">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 4-1 7-1s5 1 7 1h2"/></svg>
          </div>
          <div className="stat-box-body">
            <div className="stat-box-lbl">Breakeven</div>
            <AnimBoxVal value={beAtual} format={v => v > 0 ? v.toFixed(1) + 'x' : '—'} className="amber" />
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-box-icon purple">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
          <div className="stat-box-body">
            <div className="stat-box-lbl">Average</div>
            <AnimBoxVal value={avg} format={v => v > 0 ? v.toFixed(1) + 'x' : '—'} className="purple" />
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-box-icon purple">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
          </div>
          <div className="stat-box-body">
            <div className="stat-box-lbl">Bonus</div>
            <div className="stat-box-val purple">{entries.length}</div>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-box-icon gold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div className="stat-box-body">
            <div className="stat-box-lbl">Supers</div>
            <div className="stat-box-val gold">{supers}</div>
          </div>
        </div>
      </div>

      <div className="prog-wrap">
        <div className="prog-fill" style={{ width: pct + '%' }} />
        <div className="prog-label">{nOpened} / {entries.length}</div>
      </div>

      <div className="carousel-wrap">
        <div className="carousel">
          {entries.map((entry, idx) => (
            <CarouselItem
              key={entry.id} entry={entry} index={idx}
              currentIndex={currentIndex} bestId={best?.id} worstId={worst?.id}
              isAnimatingIdx={animatingIdx === idx} onPaymentDone={handlePaymentDone}
            />
          ))}
        </div>
      </div>

      <div className="section-divider"><span>BONUS LIST</span></div>

      <div className="slots-list-wrap" ref={wrapRef}>
        <div className="slots-list" ref={listRef}>
          {entries.map((entry, idx) => (
            <ListRow
              key={entry.id} entry={entry} index={idx}
              isCurrent={idx === currentIndex && !entry.opened}
              picker={picksMap[entry.id] || null}
            />
          ))}
        </div>
      </div>

      <div className="footer">
        <FlipCard best={best} worst={worst} />
        <div className="totals-row">
          <div className="total-box">
            <div className="total-box-icon green">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div className="total-box-body">
              <div className="total-box-lbl">Total Won</div>
              <AnimTotalVal value={totalPay} format={v => fmtPay(v)} className="green" />
            </div>
          </div>
          <div className="total-box">
            <div className={`total-box-icon ${opened.length > 0 ? (profit >= 0 ? 'green' : 'red') : 'accent'}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            </div>
            <div className="total-box-body">
              <div className="total-box-lbl">Profit</div>
              <AnimTotalVal
                value={opened.length > 0 ? profit : 0}
                format={v => opened.length > 0 ? (v >= 0 ? '+' : '') + v.toFixed(2) + '€' : '—'}
                className={profitColor}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}