import { motion, useReducedMotion } from 'framer-motion'
import { education, experience } from '../data'

export default function ExperienceEducation() {
  const reduceMotion = useReducedMotion()

  return <section className="experience section-pad" id="experience">
    <div className="container">
      <motion.div className="experience-heading" initial={reduceMotion ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: reduceMotion ? 0 : .45 }}>
        <h2>My <span>Journey</span></h2>
        <p>Professional experience, project work, and the education behind my path.</p>
      </motion.div>

      <div className="career-panels">
        <section className="journey-column" aria-labelledby="journey-experience-heading">
          <h3 className="journey-column-title" id="journey-experience-heading"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 12h20m-13 0v2h6v-2" /></svg>Experience</h3>
          <div className="career-timeline">
            {experience.map((item) => <article className="career-entry" key={`${item.organization}-${item.role}`}>
              <span className="career-entry-marker" aria-hidden="true" />
              <div className="career-entry-content">
                <div className="career-entry-top"><h4>{item.role}</h4><span className="career-period">{item.period}</span></div>
                <p className="career-organization">{item.organization}</p>
                <p className="career-description">{item.description}</p>
                {item.projectTitle && <div className="career-project">
                  <span className="career-project-label">INTERNSHIP PROJECT</span>
                  <h5>{item.projectTitle}</h5>
                  <p>{item.projectDescription}</p>
                  {item.projectId && <a className="career-project-link" href={`/projects#${item.projectId}`}>View full S2K project details <span aria-hidden="true">↗</span></a>}
                  <ul>{item.projectHighlights?.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
                  <span className="career-project-stack">{item.projectStack?.join(' / ')}</span>
                </div>}
                <span className="career-location"><i aria-hidden="true" />{item.location}</span>
              </div>
            </article>)}
          </div>
        </section>

        <section className="journey-column" aria-labelledby="journey-education-heading">
          <h3 className="journey-column-title" id="journey-education-heading"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 9 10-5 10 5-10 5L2 9Z" /><path d="M6 11v5c3.5 3 8.5 3 12 0v-5M22 9v6" /></svg>Education</h3>
          <div className="career-timeline">
            {education.map((item) => <article className="career-entry" key={`${item.institution}-${item.qualification}`}>
              <span className="career-entry-marker" aria-hidden="true" />
              <div className="career-entry-content">
                <div className="career-entry-top"><h4>{item.qualification}</h4><span className="career-period">{item.period}</span></div>
                <p className="career-organization">{item.institution}</p>
                <p className="career-description">{item.description}</p>
                <span className="education-field"><i aria-hidden="true" />{item.field}</span>
                <span className="career-location"><i aria-hidden="true" />{item.dateNote}</span>
              </div>
            </article>)}
          </div>
        </section>
      </div>
    </div>
  </section>
}
