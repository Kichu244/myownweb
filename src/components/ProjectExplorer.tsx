import { type RefObject } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { Project } from '../data'
import ProjectVisualization from './ProjectVisualization'

type ProjectExplorerProps = {
  project: Project
  dialogRef: RefObject<HTMLElement | null>
  closeRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
  reduceMotion: boolean | null
}

export default function ProjectExplorer({ project, dialogRef, closeRef, onClose, reduceMotion }: ProjectExplorerProps) {
  return <motion.div className="modal-backdrop project-explorer-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .16 }} onClick={onClose}>
    <motion.section
      ref={dialogRef}
      className="project-modal project-explorer glass-deep"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: .985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
      transition={{ duration: reduceMotion ? 0 : .22 }}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="project-explorer-header">
        <div><span className="eyebrow">PROJECT {project.number} / {project.category}</span><span className="modal-status">{project.status}</span></div>
        <button ref={closeRef} className="modal-close" aria-label="Close project explorer" onClick={onClose}><X /></button>
      </header>
      <div className="project-explorer-title"><h2 id="modal-title">{project.title}</h2><p>{project.description}</p></div>
      <div className="project-explorer-layout">
        <div className="project-explorer-visual-column">
          <ProjectVisualization className="project-modal-visual glass-deep" variant={project.visualization} interactive />
        </div>
        <aside className="project-explorer-details" aria-label={`${project.title} project details`}>
          <section className="explorer-detail-block"><span className="explorer-kicker">PURPOSE</span><p>{project.problem}</p></section>
          <section className="explorer-detail-block"><span className="explorer-kicker">APPROACH DESCRIBED</span><p>{project.solution}</p></section>
          {project.features?.length ? <section className="explorer-detail-block"><span className="explorer-kicker">FEATURES IN PROJECT BRIEF</span><ul>{project.features.map((feature) => <li key={feature}>{feature}</li>)}</ul></section> : null}
          {project.architecture && <section className="explorer-detail-block"><span className="explorer-kicker">ARCHITECTURE / WORKFLOW</span><p>{project.architecture}</p></section>}
          {project.contribution && <section className="explorer-detail-block"><span className="explorer-kicker">CONTRIBUTION DESCRIBED</span><p>{project.contribution}</p></section>}
          <section className="explorer-technologies"><span className="explorer-kicker">TECHNOLOGIES NAMED IN BRIEF</span><div>{project.stack.map((tech) => <i key={tech}>{tech}</i>)}</div></section>
          <section className="explorer-status"><span className="explorer-kicker">IMPLEMENTATION STATUS</span><p>{project.status}</p>{project.documentationNote && <small>{project.documentationNote}</small>}</section>
        </aside>
      </div>
    </motion.section>
  </motion.div>
}
