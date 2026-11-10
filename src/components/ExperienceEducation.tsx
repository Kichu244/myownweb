// ============================================================
// ExperienceEducation.tsx — Journey Section Component
// Rendered by: App.tsx (page === 'experience' || isHome)
// Styles: styles.css → [EXP-01] through [EXP-16]
// ============================================================

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, ArrowUpRight } from 'lucide-react'
import { education, experience } from '../data'
import { withBasePath } from '../navigation'

// Type definition for career entry item
type CareerItem = (typeof experience)[number]

// ============================================================
// CareerProjectDisclosure — Collapsible Internship Project Block
// Minimized by default, expands on click with smooth animation
// ============================================================
function CareerProjectDisclosure({
  item,
  homePage = false
}: {
  item: CareerItem
  homePage?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const reduceMotion = useReducedMotion()

  return (
    <div className={`career-project-accordion${isExpanded ? ' is-expanded' : ' is-collapsed'}`}>
      <button
        type="button"
        className="career-project-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={`project-details-${item.projectId || 'details'}`}
      >
        <div className="career-project-toggle-left">
          <span className="career-project-label">INTERNSHIP PROJECT</span>
          <h5 className="career-project-toggle-title">{item.projectTitle}</h5>
        </div>
        <div className="career-project-toggle-right">
          <span className="career-project-action-text">{isExpanded ? 'Hide details' : 'View details'}</span>
          <ChevronDown
            size={16}
            className={`career-project-chevron${isExpanded ? ' is-rotated' : ''}`}
            aria-hidden="true"
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={`project-details-${item.projectId || 'details'}`}
            className="career-project-body"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="career-project-body-inner">
              <p className="career-project-desc">{item.projectDescription}</p>

              {item.projectId && (
                <a
                  className="career-project-link"
                  href={homePage ? `#${item.projectId}` : `${withBasePath('/projects')}#${item.projectId}`}
                >
                  <span>View full S2K project details</span>
                  <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              )}

              {item.projectHighlights && item.projectHighlights.length > 0 && (
                <ul className="career-project-highlights">
                  {item.projectHighlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              )}

              {item.projectStack && item.projectStack.length > 0 && (
                <div className="career-project-stack-wrap">
                  {item.projectStack.map((tech) => (
                    <span key={tech} className="career-project-stack-tag">
                      {tech}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================
// ExperienceEducation — Default Export
// ============================================================
export default function ExperienceEducation({ homePage = false }: { homePage?: boolean }) {
  const reduceMotion = useReducedMotion()

  return (
    <section className="experience section-pad" id="experience" data-swarm-section="experience">
      <div className="container" data-swarm="container">
        <motion.div
          className="experience-heading"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: reduceMotion ? 0 : 0.45 }}
        >
          <h2 data-swarm="heading">
            My <span>Journey</span>
          </h2>
          <p data-swarm="text">Professional experience, project work, and the education behind my path.</p>
        </motion.div>

        <div className="career-panels">
          {/* Experience Column */}
          <section className="journey-column" aria-labelledby="journey-experience-heading">
            <h3 className="journey-column-title" data-swarm="heading" id="journey-experience-heading">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
                <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 12h20m-13 0v2h6v-2" />
              </svg>
              Experience
            </h3>
            <div className="career-timeline">
              {experience.map((item) => (
                <article className="career-entry" data-swarm="card" key={`${item.organization}-${item.role}`}>
                  <span className="career-entry-marker" aria-hidden="true" />
                  <div className="career-entry-content">
                    <div className="career-entry-top">
                      <h4 data-swarm="heading">{item.role}</h4>
                      <span className="career-period" data-swarm="text">
                        {item.period}
                      </span>
                    </div>
                    <p className="career-organization">{item.organization}</p>
                    <p className="career-description" data-swarm="text">
                      {item.description}
                    </p>

                    {/* Minimized / Expandable Project Disclosure */}
                    {item.projectTitle && (
                      <CareerProjectDisclosure item={item} homePage={homePage} />
                    )}

                    <span className="career-location">
                      <i aria-hidden="true" />
                      {item.location}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Education Column */}
          <section className="journey-column" aria-labelledby="journey-education-heading">
            <h3 className="journey-column-title" data-swarm="heading" id="journey-education-heading">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m2 9 10-5 10 5-10 5L2 9Z" />
                <path d="M6 11v5c3.5 3 8.5 3 12 0v-5M22 9v6" />
              </svg>
              Education
            </h3>
            <div className="career-timeline">
              {education.map((item) => (
                <article
                  className="career-entry"
                  data-swarm="card"
                  key={`${item.institution}-${item.qualification}`}
                >
                  <span className="career-entry-marker" aria-hidden="true" />
                  <div className="career-entry-content">
                    <div className="career-entry-top">
                      <h4 data-swarm="heading">{item.qualification}</h4>
                      <span className="career-period" data-swarm="text">
                        {item.period}
                      </span>
                    </div>
                    <p className="career-organization">{item.institution}</p>
                    <p className="career-description" data-swarm="text">
                      {item.description}
                    </p>
                    <span className="education-field">
                      <i aria-hidden="true" />
                      {item.field}
                    </span>
                    <span className="career-location">
                      <i aria-hidden="true" />
                      {item.dateNote}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
