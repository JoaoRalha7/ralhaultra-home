import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './Legal.module.css'

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
const ORDER = ['terms', 'privacy', 'cookies', 'rules']
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export default function Legal() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const tab = ORDER.find(k => pathname.includes(k)) || 'terms'
  const doc = DOCS[tab]
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
                <p>{p}</p>
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
