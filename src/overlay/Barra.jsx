import { useState, useEffect, useRef } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

const DASHBOARD_ID   = 'aa9660ca-4c53-4d4d-b81b-b3d231660420'
const SUPABASE_TABLE = 'dashboard_state'

const SOCIALS = [
  { type: 'instagram', username: '@JOTARALHA7' },
  { type: 'instagram', username: '@CLIPSDORALHA' },
  { type: 'x',         username: '@JOAORALHA7' },
  { type: 'telegram',  username: '@JOAORALHA7' },
]

const SITE_TEXT    = 'JRALHA.COM'
const LETTER_DELAY = 1500 / SITE_TEXT.length
const ERASE_DELAY  = 120

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;900&display=swap');
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css');

.barra-body {
  background: transparent;
  margin: 0;
  padding: 12px 20px 0;
}
.overlay-topbar {
  display: flex; align-items: center;
  background: #07090f;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 18px; min-height: 52px;
  box-shadow: 0 4px 28px rgba(0,0,0,.8);
  font-family: 'Rubik', 'Segoe UI', sans-serif;
  padding: 0 22px; margin: 0;
  gap: 20px; flex-wrap: nowrap;
}
.topbar-brand { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.topbar-brand-text {
  font-size: 1.3em; font-weight: 900; letter-spacing: .08em;
  background: linear-gradient(135deg, #a78bfa 0%, #7c6fff 50%, #6d5ce7 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.topbar-brand-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #7c6fff; box-shadow: 0 0 8px rgba(124,111,255,.8);
  animation: brand-pulse 2s ease-in-out infinite; flex-shrink: 0;
}
@keyframes brand-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.7)} }
.topbar-casino { height: 30px; margin-right: 8px; object-fit: contain; }
.topbar-hour {
  font-size: 1.15em; font-weight: 700; color: #eeeef5;
  letter-spacing: 0.5px; padding: 0 10px 0 0;
  min-width: 160px; text-align: left; white-space: nowrap;
}
.topbar-divider {
  width: 1px; height: 36px; min-height: 22px;
  background: rgba(255,255,255,0.07);
  margin: 0 6px; border-radius: 1.5px; align-self: center; flex-shrink: 0;
}
.topbar-mode {
  padding: 6px 17px; border-radius: 10px; font-weight: 700;
  font-size: 1.05em; color: #fff;
  background: linear-gradient(90deg, #18dd8a 45%, #0aa171 100%);
  box-shadow: 0 1.5px 10px rgba(24,221,138,.35); letter-spacing: 0.06em; white-space: nowrap;
}
.topbar-mode-wager { background: linear-gradient(90deg, #7c6fff 40%, #a78bfa 100%) !important; box-shadow: 0 1.5px 10px rgba(124,111,255,.3) !important; }
.topbar-mode-demo  { background: rgba(255,255,255,.08) !important; box-shadow: none !important; color: rgba(255,255,255,.5) !important; }
.topbar-activity { display: flex; align-items: center; gap: 15px; }
.activity-icon { font-size: 1.6em; opacity: 0.25; transition: 0.25s; color: #fff; }
.activity-icon.active { opacity: 1; color: #7c6fff; text-shadow: 0 0 8px rgba(124,111,255,.7); transform: scale(1.15); }
.topbar-song { flex: 1; }
.topbar-socials {
  display: flex; align-items: center; gap: 7px; color: #fff;
  font-weight: bold; font-size: 1em; min-width: 180px; width: 180px;
  box-sizing: border-box; justify-content: flex-start; overflow: hidden;
}
.insta-gradient {
  font-size: 1.35em;
  background: radial-gradient(circle at 30% 110%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  filter: drop-shadow(0 0 2px #d6249f44);
}
.x-gradient {
  font-size: 1.35em;
  background: linear-gradient(90deg, #fff 0%, #24292f 90%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  filter: drop-shadow(0 0 1px #24292f66);
}
.tg-gradient {
  font-size: 1.35em;
  background: linear-gradient(135deg, #2AABEE 40%, #229ED9 90%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  filter: drop-shadow(0 0 2px #229ED955);
}
.topbar-site {
  color: rgba(255,255,255,.5); font-weight: 600; font-size: 1.01em;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.07);
  padding: 5px 12px; border-radius: 10px;
  display: flex; align-items: center; gap: 4px;
  min-width: 120px; width: 185px; box-sizing: border-box;
  justify-content: flex-start; overflow: hidden;
}
.site-typewriter { font-family: 'Rubik', sans-serif; font-weight: 600; font-size: 1.07em; letter-spacing: 0.05em; color: #ffffff; }
.site-cursor { display: inline-block; font-size: 1.1em; color: #7c6fff; animation: blink-cursor 0.85s steps(1) infinite; vertical-align: middle; }
@keyframes blink-cursor { 0%, 80% { opacity: 1; } 81%, 100% { opacity: 0; } }
.topbar-aware {
  color: rgba(255,255,255,.4); font-weight: 600; letter-spacing: 0.04em;
  font-size: .95em; white-space: nowrap; min-width: 180px; text-align: right; margin-left: auto;
}
`

function useHour() {
  const [label, setLabel] = useState('')
  useEffect(() => {
    const wd = ['SUN','MON','TUE','WED','THU','FRI','SAT']
    const mo = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
    const upd = () => {
      const n = new Date()
      setLabel(`${wd[n.getDay()]} ${String(n.getDate()).padStart(2,'0')} ${mo[n.getMonth()]} ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`)
    }
    upd()
    const t = setInterval(upd, 1000)
    return () => clearInterval(t)
  }, [])
  return label
}

function useSocials() {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false)
      setTimeout(() => { setIdx(i => (i + 1) % SOCIALS.length); setVisible(true) }, 700)
    }, 3400)
    return () => clearInterval(t)
  }, [])
  return { social: SOCIALS[idx], visible }
}

function useTypewriter() {
  const [text, setText] = useState('')
  useEffect(() => {
    let i = 0, dir = 1, timer
    function tick() {
      if (dir === 1) {
        setText(SITE_TEXT.slice(0, i + 1)); i++
        if (i < SITE_TEXT.length) timer = setTimeout(tick, LETTER_DELAY)
        else timer = setTimeout(() => { dir = -1; tick() }, 2000)
      } else {
        if (i > 0) { setText(SITE_TEXT.slice(0, i - 1)); i--; timer = setTimeout(tick, ERASE_DELAY) }
        else timer = setTimeout(() => { dir = 1; tick() }, 1200)
      }
    }
    tick()
    return () => clearTimeout(timer)
  }, [])
  return text
}

function useDashboard() {
  const [state, setState] = useState({ modo: 'raw', activity: '', casino_logo: '' })

  async function load() {
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select('casino_logo, modo, activity')
      .eq('id', DASHBOARD_ID)
      .single()
    if (error || !data) return
    setState({
      modo:        data.modo        || 'raw',
      activity:    data.activity    || '',
      casino_logo: data.casino_logo || '',
    })
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 1500)
    const ch = supabase.channel('barra-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: SUPABASE_TABLE }, load)
      .subscribe()
    return () => { clearInterval(t); supabase.removeChannel(ch) }
  }, [])

  return state
}

export default function Barra() {
  const hour                        = useHour()
  const { social, visible }         = useSocials()
  const siteText                    = useTypewriter()
  const { modo, activity, casino_logo } = useDashboard()

  const socialIconClass =
    social.type === 'instagram' ? 'fa-brands fa-instagram insta-gradient' :
    social.type === 'x'         ? 'fa-brands fa-x-twitter x-gradient' :
                                  'fa-brands fa-telegram tg-gradient'

  const modeClass = `topbar-mode${modo === 'wager' ? ' topbar-mode-wager' : modo === 'demo' ? ' topbar-mode-demo' : ''}`

  const activities = [
    { key: 'hunting',  icon: 'fa-solid fa-bullseye' },
    { key: 'opening',  icon: 'fa-solid fa-gift' },
    { key: 'chill',    icon: 'fa-solid fa-mug-hot' },
    { key: 'torneios', icon: 'fa-solid fa-trophy' },
  ]

  return (
    <div className="barra-body">
      <style>{CSS}</style>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />

      <div className="overlay-topbar">

        <div className="topbar-brand">
          <div className="topbar-brand-dot" />
          <div className="topbar-brand-text">RALHA</div>
        </div>

        <div className="topbar-hour">{hour}</div>

        <div className="topbar-divider" />

        {casino_logo && <img src={casino_logo} alt="Casino" className="topbar-casino" />}

        {modo !== 'demo' && (
          <div className={modeClass}>
            {modo === 'raw' ? 'RAW' : modo === 'wager' ? 'WAGER' : modo.toUpperCase()}
          </div>
        )}

        <div className="topbar-divider" />

        <div className="topbar-activity">
          {activities.map(a => (
            <i
              key={a.key}
              className={`${a.icon} activity-icon${activity.toLowerCase() === a.key ? ' active' : ''}`}
              title={a.key}
            />
          ))}
        </div>

        <div className="topbar-divider" />
        <div className="topbar-song" />
        <div className="topbar-divider" />

        <div className="topbar-socials" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.4s' }}>
          <i className={socialIconClass} />
          <span>{social.username}</span>
        </div>

        <div className="topbar-divider" />

        <div className="topbar-site">
          <span>🌐</span>
          <span className="site-typewriter">{siteText}</span>
          <span className="site-cursor">|</span>
        </div>

        <div className="topbar-divider" />
        <div className="topbar-aware">BE GAMBLE AWARE +18</div>

      </div>
    </div>
  )
}