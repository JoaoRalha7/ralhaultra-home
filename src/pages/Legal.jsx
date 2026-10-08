import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './Legal.module.css'
import { WORKER } from '../lib/points'

const Svg = ({ children }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const ICONS = {
  terms: <Svg><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></Svg>,
  privacy: <Svg><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></Svg>,
  cookies: <Svg><path d="M21 12a9 9 0 1 1-9-9c0 2.5 2 4 4 4 0 2 1.5 4 5 5z" /><circle cx="9" cy="11" r=".8" fill="currentColor" /><circle cx="13" cy="16" r=".8" fill="currentColor" /><circle cx="8" cy="15" r=".8" fill="currentColor" /></Svg>,
  rules: <Svg><path d="M5 4h14v16H5z" /><path d="M9 9l1.5 1.5L13 8M9 15h6" /></Svg>,
  help: <Svg><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></Svg>,
  lock: <Svg><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>,
}

const DOCS = {
  terms: {
    label: 'Terms & Conditions', path: '/terms', title: 'Terms & Conditions',
    intro: 'The basics of using jralha.com.',
    sections: [
    ["Introduction", "Welcome to jralha.com. By using this site, you agree to these terms. This is an entertainment platform, not a real-money gambling site. We are not a casino \u2014 we provide information, stats and community tools for casino streaming content."],
    ["Age Restriction (+18)", "This site is strictly for users aged 18 and over. Gambling can be addictive. Please play responsibly. If you are under 18, leave immediately. We reserve the right to suspend accounts of users who misrepresent their age."],
    ["Points & Shop", "Points on this site are virtual and have no monetary value. They cannot be exchanged for real money or cash equivalents. We reserve the right to remove points in cases of cheating, bot usage or violation of these terms."],
    ["Affiliate Links", "Links to casinos on this site are affiliate links. We may earn a commission when you register through them. We are not responsible for losses on third-party sites. Always gamble only what you can afford to lose."],
    ["Content", "All stats, bonus hunt data and stream information are provided for entertainment purposes only. We make no guarantees regarding the accuracy or completeness of this data. Past results do not indicate future outcomes."],
    ["Changes", "We reserve the right to update these terms at any time. Continued use of the site after changes constitutes acceptance of the new terms."],
  ],
    note: { icon: 'help', node: <>Need help with gambling? Visit <a href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware.org</a> or <a href="https://www.jogoresponsavel.pt" target="_blank" rel="noopener">Linha Vida (Portugal)</a> for professional support.</> },
  },
  privacy: {
    label: 'Privacy Policy', path: '/privacy', title: 'Privacy Policy',
    intro: 'What we collect, and why.',
    sections: [
    ["Data We Collect", "When you log in with Twitch, we collect your Twitch username, profile picture and email address. This data is used solely to provide site features such as the leaderboard, shop and point tracking."],
    ["How We Use Your Data", "Your data is used to authenticate your account, display your points and rank on the leaderboard, and enable shop purchases. We do not sell your personal data to third parties."],
    ["Data Storage", "Your account data is stored securely via Supabase, a GDPR-compliant database provider. Authentication is handled by Twitch OAuth. We do not store passwords."],
    ["Third Parties", "We use Twitch for authentication and StreamElements for point tracking. Each of these services has their own privacy policies which govern their use of your data."],
    ["Your Rights", "You have the right to request deletion of your account and associated data at any time. To do so, contact us via Discord or social media. Data deletion requests are processed within 30 days."],
    ["Contact", "For any privacy-related questions, reach out through our Discord server or social media channels listed in the footer."],
  ],
    note: { icon: 'lock', node: <>Your privacy matters to us. We only collect what is necessary to run the platform.</> },
  },
  cookies: {
    label: 'Cookies', path: '/cookies', title: 'Cookie Policy',
    intro: 'The small files this site stores on your device.',
    sections: [
    ["What Are Cookies", "Cookies are small text files stored on your device when you visit a website. They help us remember your preferences and keep you logged in between sessions."],
    ["Cookies We Use", "These are the cookies and local storage entries the site sets:"],
    ["Third-Party Cookies", "When you watch an embedded Twitch stream, Twitch may set their own cookies. These are governed by Twitch's privacy policy and are outside our control."],
    ["Managing Cookies", "You can disable cookies in your browser settings at any time. Note that disabling essential cookies will prevent you from logging in or using certain features of the site."],
  ],
    table: [
      { name: 'sb-auth-token',    type: 'Essential',  purpose: 'Keeps you logged in via Supabase authentication' },
      { name: 'sidebarCollapsed', type: 'Preference', purpose: 'Remembers if you have the sidebar collapsed' },
      { name: 'ageVerified',      type: 'Essential',  purpose: 'Remembers that you confirmed your age (+18)' },
    ],
    note: { icon: 'lock', node: <>We only use cookies that are necessary for the site to function. We do not use advertising or tracking cookies.</> },
  },
  rules: {
    label: 'Site Rules', path: '/rules', title: 'Site Rules',
    intro: 'How we keep the community fair for everyone.',
    sections: [
      ['One account per person', 'Each viewer may use a single account. Duplicate or shared accounts used to claim extra points, giveaway entries or rewards may be removed.'],
      ['No cheating or bots', 'Automation, exploits and any attempt to manipulate points, mini-games, giveaways or the leaderboard are not allowed and can lead to a points reset or a ban.'],
      ['Fair play in giveaways and games', 'Winners are picked by the site or on stream. Prizes that are not claimed within the stated time may be re-drawn. Decisions on stream are final.'],
      ['Be respectful', 'Harassment, hate speech, spam and promotion of other communities are not tolerated on stream, on Discord or on the site.'],
      ['18+ only', 'The community is for adults. Accounts that misrepresent their age will be suspended.'],
    ],
    note: { icon: 'help', node: <>Questions about a rule or a decision? Reach out through our Discord server.</> },
  },
}

const n = (v) => Number(v || 0).toLocaleString('en-US')
const L = ({ items }) => <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>{items.map((i, k) => <li key={k}>{i}</li>)}</ul>

// Detailed rules. Numbers come from the live VIP table so this page never goes out of date.
function richRules(levels) {
  const rows = levels.length ? levels : []
  return [
    ['The basics', <>
      <p>Points are virtual and have no cash value. You earn them by watching the stream, claiming rewards and playing, and you spend them in the Originals games, mini-games and the shop. Everything is calculated on our servers, never in your browser.</p>
    </>],
    ['How you earn points', <>
      <p>There are four ways to earn points:</p>
      <L items={[
        <><b>Watchtime:</b> you earn points every minute while the stream is live and you are in chat. Subscribers earn a higher multiplier, and your VIP rank adds a bonus on top (total multiplier is capped at 2.5x).</>,
        <><b>Daily reward:</b> claim once every 24 hours. The reward grows with your streak (day 1 to day 7) and is boosted by your VIP rank. Miss a day and the streak restarts.</>,
        <><b>Daily wheel:</b> a free spin with random prizes, once per cycle.</>,
        <><b>Vouchers, giveaways and level-up rewards:</b> codes shared on stream or Discord, prizes, and the one-time bonus when you reach a new rank.</>,
      ]} />
    </>],
    ['VIP ranks', <>
      <p>Your rank depends on two things at the same time: how many points you have wagered in the Originals games and how many hours you have watched. You need <b>both</b> to reach the next rank. Wagered points count every bet you place, win or lose, and they never go down. Your rank is checked every hour and also right after you bet, so it updates fast.</p>
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 560 }}>
          <thead><tr style={{ textAlign: 'left', opacity: .7 }}>{['Rank', 'Wagered', 'Hours', 'Watch bonus', 'Cashback', 'Daily boost', 'Level-up reward'].map((h) => <th key={h} style={{ padding: '6px 8px' }}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((l) => (
            <tr key={l.level} style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
              <td style={{ padding: '8px', fontWeight: 700 }}>{l.name}</td>
              <td style={{ padding: '8px' }}>{n(l.min_wagered)}</td>
              <td style={{ padding: '8px' }}>{l.min_watch_hours}h</td>
              <td style={{ padding: '8px' }}>{Number(l.bonus_mult) ? `+${Number(l.bonus_mult)}x` : '-'}</td>
              <td style={{ padding: '8px' }}>{Number(l.cashback_pct)}%</td>
              <td style={{ padding: '8px' }}>{Number(l.daily_boost_pct) ? `+${l.daily_boost_pct}%` : '-'}</td>
              <td style={{ padding: '8px' }}>{Number(l.levelup_reward) ? n(l.levelup_reward) : '-'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p style={{ marginTop: 12 }}>Ranks never change the odds of any game. They only reward time and activity.</p>
    </>],
    ['Level-up rewards', <>
      <p>Each rank above Member has a one-time reward. Open your rewards (menu, then VIP) and press <b>Claim</b>. Each rank can be claimed only once per person, even if your rank changes later. If you skip several ranks, you can claim every one you have reached.</p>
    </>],
    ['Weekly cashback', <>
      <p>Every Monday at 03:30 UTC we pay you back a percentage of your <b>net losses</b> from the previous week (Monday to Sunday). Net loss means total bet minus total paid out. If you won more than you lost, there is no cashback, and wins reduce it. The percentage depends on your rank, and the payout has a weekly cap of 50,000 points. You can follow your estimate live in the Cashback tab of your rewards.</p>
    </>],
    ['Bets and limits', <>
      <p>The minimum bet is 10 points. The maximum bet is the same in every game and every mode: 1,000 points (in Roulette it is the total of all your chips on the table, not per spot; the Jackpot has its own limits: up to 1,000 per deposit and 5,000 in total per round). Each round also has a maximum payout. If you type a bigger amount, or press 2x past the limit, it is set to the maximum automatically.</p>
    </>],
    ['Provably fair', <>
      <p>Every Originals game is provably fair. Before you play, we publish a hash of our secret seed. Your client seed and a round counter are combined with it to produce each result, and the seed is revealed afterwards, so you can check that nothing was changed. Your recent rounds and their fair data are in your profile.</p>
    </>],
    ['Mini-games', <>
      <p>The viewer mini-games (Pick &amp; Win, Guess the Balance, Average Multi) cost 100 points per entry, charged when you enter. Entries are only open while the round is open. Prizes are given by the streamer after the round ends.</p>
      <p><b>Average Multi:</b> you pick the range you think the hunt's average multiplier will land in. Only the correct range wins, and everyone who picked it shares the pool equally. The pool is made of all the points staked by the players in that round (plus a bonus the streamer may add). If nobody picked the correct range, nobody wins.</p>
    </>],
    ['Vouchers', <>
      <p>Voucher codes give a set amount of points. Each code can be used <b>once per person</b>, may have a limited number of total uses and may expire. Enter them in your profile, in the Vouchers tab. Sharing or reselling codes is not allowed.</p>
    </>],
    ['Shop and giveaways', <>
      <p>Shop items have limited stock and are reserved the moment you buy. Some items are delivered by the streamer, so their status stays <i>pending</i> until fulfilled. If something goes wrong, points are refunded, never double-charged. Giveaway winners are drawn on stream or by the site, and prizes not claimed in time may be re-drawn.</p>
    </>],
    ['Fair use and bans', <>
      <p>One account per person. Bots, scripts, exploits, multi-accounting, tampering with the site (including opening developer tools to change data) and any attempt to manipulate points, games or the leaderboard are not allowed. We can remove points, reset balances or ban accounts, and our decisions are final. All movements are logged and audited.</p>
    </>],
    ['Be respectful, 18+', <>
      <p>Harassment, hate speech, spam and promotion of other communities are not tolerated on stream, Discord or the site. The community is for adults only (18+). Gambling can be addictive: play responsibly and only with money you can afford to lose.</p>
    </>],
  ]
}
const ORDER = ['terms', 'privacy', 'cookies', 'rules']
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export default function Legal() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const tab = ORDER.find(k => pathname.includes(k)) || 'terms'
  const [levels, setLevels] = useState([])
  useEffect(() => {
    let alive = true
    fetch(`${WORKER}/vip`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive && d?.levels) setLevels(d.levels) }).catch(() => {})
    return () => { alive = false }
  }, [])
  const doc = useMemo(() => (tab === 'rules' ? { ...DOCS.rules, intro: 'Everything explained in detail: points, VIP, cashback, limits and fair play.', sections: richRules(levels) } : DOCS[tab]), [tab, levels])
  const [active, setActive] = useState(null)

  const ids = useMemo(() => doc.sections.map(([t]) => slug(t)), [doc])

  useEffect(() => {
    setActive(ids[0])
    const els = ids.map(id => document.getElementById(id)).filter(Boolean)
    if (!els.length || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver((es) => {
      const vis = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (vis) setActive(vis.target.id)
    }, { rootMargin: '-90px 0px -60%' })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [ids])

  const jump = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Legal &amp; Rules</h1>
        <p className={styles.sub}>Last updated: April 2026</p>
      </header>

      <div className={styles.layout}>
        <aside className={styles.side}>
          <nav className={styles.docNav} aria-label="Documents">
            {ORDER.map(k => (
              <button key={k} className={`${styles.docBtn} ${tab === k ? styles.docOn : ''}`} onClick={() => navigate(DOCS[k].path)} aria-current={tab === k ? 'page' : undefined}>
                {ICONS[k]}<span>{DOCS[k].label}</span>
              </button>
            ))}
          </nav>
          <nav className={styles.toc} aria-label="On this page">
            <span className={styles.tocTitle}>On this page</span>
            {doc.sections.map(([t], i) => (
              <a key={t} href={'#' + ids[i]} onClick={jump(ids[i])} className={active === ids[i] ? styles.tocOn : ''}>
                <b>{i + 1}</b>{t}
              </a>
            ))}
          </nav>
        </aside>

        <article className={styles.doc} key={tab}>
          <div className={styles.docHead}>
            <span className={styles.docIcon}>{ICONS[tab]}</span>
            <div>
              <h2>{doc.title}</h2>
              <p>{doc.intro}</p>
            </div>
          </div>

          {doc.sections.map(([t, p], i) => (
            <section key={t} id={ids[i]} className={styles.section}>
              <span className={styles.num}>{i + 1}</span>
              <div>
                <h3>{t}</h3>
                {typeof p === 'string' ? <p>{p}</p> : p}
                {doc.table && t === 'Cookies We Use' && (
                  <div className={styles.cookieTable}>
                    {doc.table.map(c => (
                      <div key={c.name} className={styles.cookieRow}>
                        <code className={styles.cookieName}>{c.name}</code>
                        <span className={`${styles.cookieType} ${c.type === 'Essential' ? styles.typeEssential : styles.typePreference}`}>{c.type}</span>
                        <span className={styles.cookiePurpose}>{c.purpose}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}

          <div className={styles.helpBox}>
            {ICONS[doc.note.icon]}
            <p>{doc.note.node}</p>
          </div>
        </article>
      </div>
    </div>
  )
}
