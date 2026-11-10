// ============================================================
// SkillsNetwork.tsx — Skills Section Component
// Rendered by: App.tsx (page === 'skills' || isHome)
// Styles: styles.css → [SKILL-01] through [SKILL-17]
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// ------------------------------------------------------------
// Type Definition
// ------------------------------------------------------------

type SkillGroup = { name: string; items: string[] }

// ------------------------------------------------------------
// Skill Descriptions Map
// Used to populate the detail text in each leaf node.
// Displayed in: [SKILL-14] Skills Tree Leaf Copy → <small>
// ------------------------------------------------------------

const skillDescriptions: Record<string, string> = {
  Python: 'Purpose: clean support exports and automate Q&A extraction. Project: Support-to-Knowledge Pipeline during my Neopraxis internship.',
  Odoo: 'Purpose: adapt ERP workflows and application behavior. Experience: Python and Odoo development at AutoChip India.',
  'Odoo ORM': 'Purpose: work with Odoo models and business records. Experience: Python and Odoo development at AutoChip India.',
  XML: 'Purpose: configure Odoo views and module interfaces. Experience: Python and Odoo development at AutoChip India.',
  PostgreSQL: 'Purpose: store and query structured application records. Context: database-backed development; no specific portfolio project is listed for this tool.',
  'Workflow customization': 'Purpose: tailor business steps to real working needs. Context: Odoo ERP development at AutoChip India.',
  RAG: 'Purpose: make curated knowledge searchable for grounded answers. Project: a future direction for the Support-to-Knowledge Pipeline; production RAG is not claimed.',
  'Natural language processing': 'Purpose: organize and interpret customer-support conversations. Project: Support-to-Knowledge Pipeline at Neopraxis.',
  'LLM-assisted extraction': 'Purpose: extract representative questions and answers from support threads. Project: Support-to-Knowledge Pipeline at Neopraxis.',
  'Data pipelines': 'Purpose: clean, classify, and prepare support data for reuse. Project: Support-to-Knowledge Pipeline at Neopraxis.',
  'Question answering': 'Purpose: prepare useful answers for retrieval from support knowledge. Project: Support-to-Knowledge Pipeline at Neopraxis.',
  HTML: 'Purpose: structure web pages and local device portals. Projects: AutoChip India website and ESP32 Master Hub.',
  CSS: 'Purpose: style responsive pages and interfaces. Projects: portfolio and ESP32 Master Hub portal.',
  JavaScript: 'Purpose: add interactive behavior to web and device interfaces. Projects: web applications and ESP32 Master Hub portal.',
  React: 'Purpose: build reusable, interactive frontend screens. Projects: MyAtties Smart Attendance System and AutoChip India website.',
  TypeScript: 'Purpose: structure and type-check frontend code. Project: AutoChip India website redesign.',
  'REST APIs': 'Purpose: exchange data between interfaces and services. Context: API concepts in the ESP32 Master Hub and web application work.',
  ESP32: 'Purpose: host a local portal and connect software with devices. Project: ESP32 Master Hub.',
  'C++': 'Purpose: implement device-side behavior. Project: ESP32 Master Hub experiments.',
  Arduino: 'Purpose: prototype firmware and hardware interactions. Project: ESP32 Master Hub.',
  'Local network apps': 'Purpose: control and monitor devices without cloud access. Project: ESP32 Master Hub local portal.',
  'Hardware integration': 'Purpose: connect software controls with physical inputs and outputs. Project: ESP32 Master Hub experiments.',
  Git: 'Purpose: track code changes while building and refining projects. Context: used across my development work.',
  GitHub: 'Purpose: organize and share source code. Context: project development and portfolio work.',
  'VS Code': 'Purpose: write and refine application code. Context: used across my development projects.',
  Vite: 'Purpose: run and bundle frontend applications. Projects: MyAtties and the portfolio website.',
  'Framer Motion': 'Purpose: add interface transitions and animated reveals. Projects: portfolio and AutoChip India website.'
}

// ============================================================
// SkillsNetwork — Default Export
// Renders the interactive three-tier skill tree:
//   Root → Category → Leaf (technology detail)
// Styles: styles.css → [SKILL-01] through [SKILL-17]
// ============================================================

export default function SkillsNetwork({ groups }: { groups: SkillGroup[] }) {
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [technology, setTechnology] = useState(groups[0]?.items[0] ?? '')
  const networkRef = useRef<HTMLDivElement>(null)
  const [connections, setConnections] = useState<{ path: string; key: string; delay: number }[]>([])
  const [connectionSize, setConnectionSize] = useState({ width: 0, height: 0 })
  const reduceMotion = useReducedMotion()
  const group = groups[categoryIndex]

  if (!group) return null

  // ------------------------------------------------------------
  // selectCategory — Switches active skill category
  // Resets the selected technology to the first in the new group
  // ------------------------------------------------------------
  const selectCategory = (index: number) => {
    setCategoryIndex(index)
    setTechnology(groups[index]?.items[0] ?? '')
  }

  // ------------------------------------------------------------
  // SVG Wire Connection Calculator
  // Computes bezier curve paths from parent → categories
  // and from active category → leaf technology items.
  // Used by: [SKILL-04] Skills Tree SVG Connections
  // ------------------------------------------------------------
  useEffect(() => {
    const network = networkRef.current
    if (!network) return
    const updateConnector = () => {
      const bounds = network.getBoundingClientRect()
      const root = network.querySelector<HTMLElement>('.skills-tree-parent')
      const activeCategory = network.querySelector<HTMLElement>('.skills-tree-category.is-active')
      const categories = Array.from(network.querySelectorAll<HTMLElement>('.skills-tree-category'))
      const leaves = Array.from(network.querySelectorAll<HTMLElement>('.skills-tree-leaf'))
      if (!root || !activeCategory || !bounds.width || !bounds.height) return
      const isNarrow = window.matchMedia('(max-width: 760px)').matches
      const rootBounds = root.getBoundingClientRect()
      const activeBounds = activeCategory.getBoundingClientRect()
      const startX = isNarrow ? rootBounds.left + rootBounds.width / 2 - bounds.left : rootBounds.right - bounds.left
      const startY = isNarrow ? rootBounds.bottom - bounds.top : rootBounds.top + rootBounds.height / 2 - bounds.top
      const paths = categories.map((category, index) => {
        const rect = category.getBoundingClientRect()
        const endX = isNarrow ? rect.left + rect.width / 2 - bounds.left : rect.left - bounds.left
        const endY = isNarrow ? rect.top - bounds.top : rect.top + rect.height / 2 - bounds.top
        const curve = Math.max(24, Math.abs(endX - startX) * .42, Math.abs(endY - startY) * .42)
        const path = isNarrow
          ? `M ${startX} ${startY} C ${startX} ${startY + curve}, ${endX} ${endY - curve}, ${endX} ${endY}`
          : `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`
        return { path, key: `category-${index}`, delay: index * .06 }
      })

      const branchStartX = isNarrow ? activeBounds.left + activeBounds.width / 2 - bounds.left : activeBounds.right - bounds.left
      const branchStartY = isNarrow ? activeBounds.bottom - bounds.top : activeBounds.top + activeBounds.height / 2 - bounds.top
      leaves.forEach((leaf, index) => {
        const rect = leaf.getBoundingClientRect()
        const endX = isNarrow ? rect.left + rect.width / 2 - bounds.left : rect.left - bounds.left
        const endY = isNarrow ? rect.top - bounds.top : rect.top + rect.height / 2 - bounds.top
        const curve = Math.max(24, Math.abs(endX - branchStartX) * .42, Math.abs(endY - branchStartY) * .42)
        const path = isNarrow
          ? `M ${branchStartX} ${branchStartY} C ${branchStartX} ${branchStartY + curve}, ${endX} ${endY - curve}, ${endX} ${endY}`
          : `M ${branchStartX} ${branchStartY} C ${branchStartX + curve} ${branchStartY}, ${endX - curve} ${endY}, ${endX} ${endY}`
        paths.push({ path, key: `leaf-${group.name}-${technology}-${index}`, delay: .12 + index * .1 })
      })
      setConnections(paths)
      setConnectionSize({ width: bounds.width, height: bounds.height })
    }
    updateConnector()
    const observer = new ResizeObserver(updateConnector)
    observer.observe(network)
    return () => observer.disconnect()
  }, [group.name, technology, categoryIndex])

  return (
    // [SKILL-01] Skills Section Wrapper
    // Styles: styles.css → [SKILL-01] (.skills, .section-pad)
    <section className="skills section-pad" id="skills" data-swarm-section="skills">

      {/* [SKILL-02] Skills Title — Section Heading
          Styles: styles.css → [SKILL-02] (.skills-title, .section-title) */}
      <div className="container" data-swarm="container">
        <div className="section-title skills-title"><h2 data-swarm="heading">The technologies I use and the skills I bring to every project.</h2></div>

        {/* [SKILL-03] Skills Network Grid Container — Three-Column Layout
            Ref: networkRef — used for connection path calculations
            Styles: styles.css → [SKILL-03] (.skills-network) */}
        <div className="skills-network" data-swarm="container" ref={networkRef}>

          {/* [SKILL-04] Skills Tree SVG Connections / Wires
              Bezier paths drawn from parent → categories → leaves.
              Styles: styles.css → [SKILL-04] (.skills-tree-connections, .skills-wire)
              Animation: styles.css → [SKILL-16] (@keyframes skill-wire-draw) */}
          <svg className="skills-tree-connections" data-swarm="style" viewBox={`0 0 ${connectionSize.width} ${connectionSize.height}`} preserveAspectRatio="none" aria-hidden="true">{connections.map((connection) => <path key={connection.key} className="skills-wire" d={connection.path} pathLength={1} style={{ animationDelay: reduceMotion ? '0s' : `${connection.delay}s` }} />)}</svg>

          {/* [SKILL-05] Skills Tree Parent Node — Root "My skills" Bubble
              Styles: styles.css → [SKILL-05] (.skills-tree-parent) */}
          <div className="skills-tree-parent" data-swarm="card" aria-label="Parent node: skills">
            <strong>My skills</strong>
          </div>

          {/* [SKILL-06] Skills Tree Panel — Two-Column Panel (Categories + Leaves)
              Styles: styles.css → [SKILL-06] (.skills-tree-panel) */}
          <div className="skills-tree-panel" aria-label="Interactive skill tree">

            {/* [SKILL-07] Skills Tree Category Stage — Left Panel (category buttons)
                Styles: styles.css → [SKILL-07] (.skills-tree-category-stage) */}
            <div className="skills-tree-category-stage">

              {/* [SKILL-11] Skills Tree Stage Label — "SKILL AREAS" eyebrow
                  Styles: styles.css → [SKILL-11] (.skills-tree-stage-label) */}
              <span className="skills-tree-stage-label" data-swarm="style">SKILL AREAS</span>

              {/* [SKILL-08] Skills Category List — Vertical List of Category Buttons
                  Styles: styles.css → [SKILL-08] (.skills-category-list) */}
              <div className="skills-category-list" role="group" aria-label="Skill categories">
                {/* [SKILL-09] Skills Category Button — Individual Category (Python, Web, IoT …)
                    Active state: .is-active
                    Styles: styles.css → [SKILL-09] (.skills-category, .skills-tree-category, .is-active) */}
                {groups.map((item, index) => <button className={`skills-category skills-tree-category${categoryIndex === index ? ' is-active' : ''}`} data-swarm="card" type="button" key={item.name} aria-pressed={categoryIndex === index} onClick={() => selectCategory(index)}>
                  <span>{item.name}</span>
                </button>)}
              </div>
            </div>

            {/* [SKILL-10] Skills Tree Detail Stage — Right Panel (leaf technology items)
                Styles: styles.css → [SKILL-10] (.skills-tree-detail-stage) */}
            <div className="skills-tree-detail-stage" aria-live="polite">

              {/* [SKILL-11] Skills Tree Stage Label — "PURPOSE / PROJECT · {group}" eyebrow
                  Styles: styles.css → [SKILL-11] (.skills-tree-stage-label) */}
              <span className="skills-tree-stage-label" data-swarm="style">PURPOSE / PROJECT · {group.name}</span>

              <AnimatePresence mode="wait" initial={false}>
                {/* [SKILL-12] Skills Tree Leaves Container — Grid of Leaf Items
                    Animated in/out when category changes.
                    Styles: styles.css → [SKILL-12] (.skills-tree-leaves) */}
                <motion.div className="skills-tree-leaves" key={group.name} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .3 }}>
                  {group.items.map((item, index) => <motion.button
                    type="button"
                    key={item}
                    // [SKILL-13] Skills Tree Leaf Item — Individual Technology Button
                    // Active state: .is-selected
                    // Styles: styles.css → [SKILL-13] (.skills-tree-leaf, .is-selected)
                    className={`skills-tree-leaf${technology === item ? ' is-selected' : ''}`}
                    data-swarm="card"
                    aria-pressed={technology === item}
                    onClick={() => setTechnology(item)}
                    initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: reduceMotion ? 0 : .35, delay: reduceMotion ? 0 : .1 + index * .08, ease: 'easeOut' }}
                  >
                    {/* [SKILL-15] Skills Tree Node Dot — Small Circular Indicator
                        Styles: styles.css → [SKILL-15] (.skills-tree-node-dot) */}
                    <span className="skills-tree-node-dot" aria-hidden="true" />

                    {/* [SKILL-14] Skills Tree Leaf Copy — Technology Name + Description
                        Styles: styles.css → [SKILL-14] (.skills-tree-leaf-copy) */}
                    <span className="skills-tree-leaf-copy"><strong>{item}</strong><small>{skillDescriptions[item] ?? `I use ${item} as part of my work in ${group.name}.`}</small></span>
                  </motion.button>)}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
