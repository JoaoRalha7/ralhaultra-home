import { useState, useEffect } from 'react'
import { supabaseDash as supabase } from '../lib/supabase.js'

function fmt(n) {
  if (!n && n !== 0) return '—'
  return n >= 1000
    ? n.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '€'
    : n.toFixed(2) + '€'
}

function hslFromName(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return `hsl(${h % 360}, 55%, 58%)`
}

const TrophyIcon = ({ color }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
    <path d="M12 17v4"/><path d="M8 21h8"/>
    <path d="M6 9a6 6 0 0 0 12 0V3H6v6z"/>
  </svg>
)

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;900&family=Sora:wght@700;800&display=swap');
html, body { background: transparent !important; margin: 0; padding: 0; overflow: hidden; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.root { width: 400px; font-family: 'Rubik', sans-serif; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
.card { background: #07090f; border: 1px solid rgba(255,255,255,.07); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,.85); }

.hd { display: flex; align-items: center; gap: 10px; padding: 13px 18px; border-bottom: 1px solid rgba(255,255,255,.06); }
.hd-title { font-size: 12px; font-weight: 700; color: rgba(255,255,255,.45); letter-spacing: .1em; text-transform: uppercase; }
.hd-date  { margin-left: auto; font-size: 11px; color: rgba(255,255,255,.2); font-weight: 600; }

.row { display: flex; align-items: center; gap: 12px; padding: 11px 18px; border-bottom: 1px solid rgba(255,255,255,.04); }
.row:last-child { border-bottom: none; }
.row.r0 { background: rgba(251,191,36,.05); }
.row.r1 { background: rgba(200,200,200,.03); }
.row.r2 { background: rgba(180,100,50,.03); }

.pos { width: 26px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pos-num { font-size: 12px; font-weight: 800; color: rgba(255,255,255,.22); font-family: 'Sora', sans-serif; }

.slot-img { width: 46px; height: 46px; border-radius: 10px; object-fit: cover; flex-shrink: 0; background: #1a1d2e; border: 1px solid rgba(255,255,255,.07); }
.slot-ph  { width: 46px; height: 46px; border-radius: 10px; flex-shrink: 0; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06); display: flex; align-items: center; justify-content: center; }

.user-block { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.user-av { width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: 2px solid; }
.user-name { font-size: 14px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-sub  { font-size: 10px; color: rgba(255,255,255,.28); margin-top: 2px; font-weight: 600; }

.amt { font-size: 16px; font-weight: 900; font-family: 'Sora', sans-serif; white-space: nowrap; flex-shrink: 0; }
.amt.r0 { color: #fbbf24; }
.amt.r1 { color: #cbd5e1; }
.amt.r2 { color: #cd7c4d; }
.amt.rn { color: #fff; }
`

export default function MinigameRanking() {
  const [ranking, setRanking] = useState([])
  const [slots,   setSlots]   = useState({})

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data: rk } = await supabase.from('minigame_ranking')
        .select('*').eq('stream_date', today)
        .order('total_won', { ascending: false }).limit(10)
      setRanking(rk || [])

      if (rk?.length) {
        const { data: sess } = await supabase.from('minigame_sessions')
          .select('username, slot:slots(image_url, name)')
          .eq('stream_date', today).eq('status', 'done')
          .order('created_at', { ascending: false })
        if (sess) {
          const map = {}
          for (const s of sess) { if (!map[s.username]) map[s.username] = s.slot }
          setSlots(map)
        }
      }
    }
    load()
    const ch = supabase.channel('mg-ranking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'minigame_ranking' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'minigame_sessions' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // Não renderiza nada se não houver entradas no ranking
  if (ranking.length === 0) return null

  const today  = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
  const tColors = ['#fbbf24', '#cbd5e1', '#cd7c4d']
  const rowCls  = ['r0', 'r1', 'r2']

  return (
    <>
      <style>{CSS}</style>
      <div className="root">
        <div className="card">
          <div className="hd">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            <div className="hd-title">Ranking</div>
            <div className="hd-date">{today}</div>
          </div>

          {ranking.map((r, i) => {
            const color = hslFromName(r.username)
            const slot  = slots[r.username]
            const rc    = rowCls[i] || ''
            const ac    = rowCls[i] ? rc : 'rn'
            return (
              <div key={r.id} className={`row ${rc}`}>
                <div className="pos">
                  {i < 3
                    ? <TrophyIcon color={tColors[i]} />
                    : <div className="pos-num">#{i + 1}</div>}
                </div>
                {slot?.image_url
                  ? <img className="slot-img" src={slot.image_url} alt="" onError={e => e.target.style.opacity = '.3'} />
                  : <div className="slot-ph">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>
                      </svg>
                    </div>
                }
                <div className="user-block">
                  <div className="user-av" style={{ background: `${color}20`, borderColor: `${color}50` }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <div>
                    <div className="user-name">{r.username}</div>
                  </div>
                </div>
                <div className={`amt ${ac}`}>{fmt(r.total_won)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}