import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import styles from './Legal.module.css'

const TABS = [
  { id: 'terms',   label: 'Terms & Conditions', icon: 'bx-file' },
  { id: 'privacy', label: 'Privacy Policy',      icon: 'bx-shield' },
  { id: 'cookies', label: 'Cookies',             icon: 'bx-cookie' },
]

function Terms() {
  return (
    <div className={styles.doc}>
      <h2 className={styles.docTitle}>Terms & Conditions</h2>

      <div className={styles.section}>
        <h3>1. Introduction</h3>
        <p>Welcome to jralha.com. By using this site, you agree to these terms. This is an entertainment platform, not a real-money gambling site. We are not a casino — we provide information, stats and community tools for casino streaming content.</p>
      </div>

      <div className={styles.section}>
        <h3>2. Age Restriction (+18)</h3>
        <p>This site is strictly for users aged 18 and over. Gambling can be addictive. Please play responsibly. If you are under 18, leave immediately. We reserve the right to suspend accounts of users who misrepresent their age.</p>
      </div>

      <div className={styles.section}>
        <h3>3. Points & Shop</h3>
        <p>Points on this site are virtual and have no monetary value. They cannot be exchanged for real money or cash equivalents. We reserve the right to remove points in cases of cheating, bot usage or violation of these terms.</p>
      </div>

      <div className={styles.section}>
        <h3>4. Affiliate Links</h3>
        <p>Links to casinos on this site are affiliate links. We may earn a commission when you register through them. We are not responsible for losses on third-party sites. Always gamble only what you can afford to lose.</p>
      </div>

      <div className={styles.section}>
        <h3>5. Content</h3>
        <p>All stats, bonus hunt data and stream information are provided for entertainment purposes only. We make no guarantees regarding the accuracy or completeness of this data. Past results do not indicate future outcomes.</p>
      </div>

      <div className={styles.section}>
        <h3>6. Changes</h3>
        <p>We reserve the right to update these terms at any time. Continued use of the site after changes constitutes acceptance of the new terms.</p>
      </div>

      <div className={styles.helpBox}>
        <i className="bx bx-support" />
        <p>Need help with gambling? Visit <a href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware.org</a> or <a href="https://www.jogoresponsavel.pt" target="_blank" rel="noopener">Linha Vida (Portugal)</a> for professional support.</p>
      </div>
    </div>
  )
}

function Privacy() {
  return (
    <div className={styles.doc}>
      <h2 className={styles.docTitle}>Privacy Policy</h2>

      <div className={styles.section}>
        <h3>1. Data We Collect</h3>
        <p>When you log in with Twitch, we collect your Twitch username, profile picture and email address. This data is used solely to provide site features such as the leaderboard, shop and point tracking.</p>
      </div>

      <div className={styles.section}>
        <h3>2. How We Use Your Data</h3>
        <p>Your data is used to authenticate your account, display your points and rank on the leaderboard, and enable shop purchases. We do not sell your personal data to third parties.</p>
      </div>

      <div className={styles.section}>
        <h3>3. Data Storage</h3>
        <p>Your account data is stored securely via Supabase, a GDPR-compliant database provider. Authentication is handled by Twitch OAuth. We do not store passwords.</p>
      </div>

      <div className={styles.section}>
        <h3>4. Third Parties</h3>
        <p>We use Twitch for authentication and StreamElements for point tracking. Each of these services has their own privacy policies which govern their use of your data.</p>
      </div>

      <div className={styles.section}>
        <h3>5. Your Rights</h3>
        <p>You have the right to request deletion of your account and associated data at any time. To do so, contact us via Discord or social media. Data deletion requests are processed within 30 days.</p>
      </div>

      <div className={styles.section}>
        <h3>6. Contact</h3>
        <p>For any privacy-related questions, reach out through our Discord server or social media channels listed in the footer.</p>
      </div>

      <div className={styles.helpBox}>
        <i className="bx bx-lock" />
        <p>Your privacy matters to us. We only collect what is necessary to run the platform.</p>
      </div>
    </div>
  )
}

function Cookies() {
  return (
    <div className={styles.doc}>
      <h2 className={styles.docTitle}>Cookie Policy</h2>

      <div className={styles.section}>
        <h3>1. What Are Cookies</h3>
        <p>Cookies are small text files stored on your device when you visit a website. They help us remember your preferences and keep you logged in between sessions.</p>
      </div>

      <div className={styles.section}>
        <h3>2. Cookies We Use</h3>
        <div className={styles.cookieTable}>
          {[
            { name: 'sb-auth-token',       type: 'Essential',   purpose: 'Keeps you logged in via Supabase authentication' },
            { name: 'sidebarCollapsed',    type: 'Preference',  purpose: 'Remembers if you have the sidebar collapsed' },
            { name: 'ageVerified',         type: 'Essential',   purpose: 'Remembers that you confirmed your age (+18)' },
          ].map(c => (
            <div key={c.name} className={styles.cookieRow}>
              <div className={styles.cookieName}>{c.name}</div>
              <div className={`${styles.cookieType} ${styles['type' + c.type]}`}>{c.type}</div>
              <div className={styles.cookiePurpose}>{c.purpose}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h3>3. Third-Party Cookies</h3>
        <p>When you watch an embedded Twitch stream, Twitch may set their own cookies. These are governed by Twitch's privacy policy and are outside our control.</p>
      </div>

      <div className={styles.section}>
        <h3>4. Managing Cookies</h3>
        <p>You can disable cookies in your browser settings at any time. Note that disabling essential cookies will prevent you from logging in or using certain features of the site.</p>
      </div>

      <div className={styles.helpBox}>
        <i className="bx bx-cookie" />
        <p>We only use cookies that are necessary for the site to function. We do not use advertising or tracking cookies.</p>
      </div>
    </div>
  )
}

export default function Legal() {
  const navigate  = useNavigate()
  const location  = useLocation()

  const routeTab = location.pathname.includes('privacy') ? 'privacy'
                 : location.pathname.includes('cookies')  ? 'cookies'
                 : 'terms'

  const [tab, setTab] = useState(routeTab)

  useEffect(() => { setTab(routeTab) }, [location.pathname])

  return (
    <div className={styles.page}>

      {/* Back */}
      <button className={styles.backBtn} onClick={() => navigate('/')}>
        <i className="bx bx-arrow-back" /> Back to Home
      </button>

      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          LEGAL <span className={styles.titleAccent}>&amp; RULES</span>
        </h1>
        <p className={styles.sub}>Last updated: April 2026</p>
      </div>

      {/* Tab Nav */}
      <div className={styles.tabNav}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tabBtn} ${tab === t.id ? styles.tabBtnActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            <i className={`bx ${t.icon}`} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {tab === 'terms'   && <Terms />}
        {tab === 'privacy' && <Privacy />}
        {tab === 'cookies' && <Cookies />}
      </div>

    </div>
  )
}