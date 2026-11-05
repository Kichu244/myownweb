import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, Check, ExternalLink, UserRound } from 'lucide-react'
import { profile } from '../data'
import { withBasePath } from '../navigation'

const footerLinks = [['About', '/about'], ['Skills', '/skills'], ['Projects', '/projects'], ['Experience', '/experience'], ['Contact', '/contact']]

export function ContactSection() {
  const [copyStatus, setCopyStatus] = useState('')
  const reduceMotion = useReducedMotion()

  const copyProfile = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(profile.linkedin)
      setCopyStatus('LinkedIn profile link copied.')
    } catch {
      setCopyStatus('Could not copy the link. Use the LinkedIn profile button instead.')
    }
  }

  return <section className="contact section-pad" id="contact" data-swarm-section="contact">
    <div className="container contact-container" data-swarm="container">
      <motion.div className="contact-heading" initial={reduceMotion ? false : { opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: reduceMotion ? 0 : .5 }}>
        <h2 data-swarm="heading">Let’s make<br /><span>something useful.</span></h2>
        <p data-swarm="text">I’m interested in building useful software, exploring new technologies, and collaborating on meaningful projects.</p>
      </motion.div>

      <div className="contact-interface glass-crystal" data-swarm="card">
        <div className="contact-signal-panel" data-swarm="image" aria-hidden="true">
          <span className="contact-signal-label">CONNECTION / AVAILABLE</span>
          <svg className="contact-signal-graphic" viewBox="0 0 560 250" focusable="false">
            <circle className="contact-signal-orbit" cx="132" cy="125" r="76" />
            <circle className="contact-signal-orbit contact-signal-orbit-inner" cx="132" cy="125" r="52" />
            <path className="contact-signal-path" d="M132 49V20H250l30 30h85l28-28h142M208 125h97l24 27h115l25-27h66M132 201v29h99l26-26h94" />
            <path className="contact-signal-path contact-signal-path-active" d="M132 125h85l20-20h75l20 20h185" />
            <circle className="contact-signal-node" cx="132" cy="125" r="5" />
            <circle className="contact-signal-node" cx="280" cy="105" r="3" />
            <circle className="contact-signal-node" cx="517" cy="125" r="4" />
            <text className="contact-signal-monogram" x="132" y="122" textAnchor="middle">CS</text>
            <text className="contact-signal-caption" x="132" y="139" textAnchor="middle">DEVELOPER</text>
            <text className="contact-signal-endpoint" x="427" y="110">LINKEDIN</text>
            <text className="contact-signal-caption" x="427" y="128">PROFESSIONAL PROFILE</text>
            <text className="contact-signal-coordinate" x="30" y="235">BENGALURU / INDIA</text>
            <text className="contact-signal-coordinate" x="450" y="235">CHANNEL 01</text>
          </svg>
          <span className="contact-signal-foot">A DIRECT LINE TO THE PROFESSIONAL PROFILE</span>
        </div>

        <div className="contact-actions" data-swarm="card">
          <span className="eyebrow">CURRENT CONTACT ROUTE</span>
          <a className="contact-primary-action" data-swarm="layout" href={profile.linkedin} target="_blank" rel="noopener noreferrer" aria-label="Open Christopher Sam Saji’s LinkedIn profile in a new tab">
            <span><small>PROFESSIONAL PROFILE</small><strong>Connect on LinkedIn</strong><i>Open professional profile</i></span><ArrowUpRight aria-hidden="true" />
          </a>
          <button className="contact-copy-action" type="button" onClick={copyProfile}>
            <span className="contact-copy-icon" aria-hidden="true">{copyStatus.startsWith('LinkedIn') ? <Check /> : <ExternalLink />}</span>
            <span><strong>{copyStatus.startsWith('LinkedIn') ? 'Profile link copied' : 'Copy profile link'}</strong><small>linkedin.com/in/christopher-sam-saji-41ba67377</small></span>
            <ExternalLink className="contact-copy-arrow" aria-hidden="true" />
          </button>
          <span className="contact-copy-status" role="status" aria-live="polite">{copyStatus}</span>
        </div>
      </div>
    </div>
  </section>
}

export function ContactFooter({ homePage = false }: { homePage?: boolean }) {
  return <footer className="footer contact-footer">
    <div className="container footer-inner">
      <a className="footer-brand" href={homePage ? '#home' : withBasePath('/')} aria-label={`${profile.name}, back to home`}><span className="brand-mark"><UserRound aria-hidden="true" /></span><span>{profile.name}</span></a>
      <nav className="footer-nav" aria-label="Footer navigation">{footerLinks.map(([label, href]) => <a href={homePage ? `#${href.slice(1)}` : withBasePath(href)} key={href}>{label}</a>)}</nav>
      <a className="footer-linkedin" href={profile.linkedin} target="_blank" rel="noopener noreferrer">LINKEDIN <ArrowUpRight aria-hidden="true" size={13} /></a>
      <span className="footer-copyright">© {new Date().getFullYear()}</span>
      <a className="back-top" href={homePage ? '#home' : withBasePath('/')}>BACK TO HOME <ArrowUpRight size={14} aria-hidden="true" /></a>
    </div>
  </footer>
}
