export const profile = {
  name: 'Christopher Sam Saji',
  role: 'Python & Odoo Developer',
  linkedin: 'https://in.linkedin.com/in/christopher-sam-saji-41ba67377',
  github: '',
  email: '',
}

export const skills = [
  { name: 'Python & ERP', items: ['Python', 'Odoo', 'Odoo ORM', 'XML', 'PostgreSQL', 'Workflow customization'] },
  { name: 'AI & Data Workflows', items: ['RAG', 'Natural language processing', 'LLM-assisted extraction', 'Data pipelines', 'Question answering'] },
  { name: 'Web & APIs', items: ['HTML', 'CSS', 'JavaScript', 'React', 'TypeScript', 'REST APIs'] },
  { name: 'IoT & Embedded Systems', items: ['ESP32', 'C++', 'Arduino', 'Local network apps', 'Hardware integration'] },
  { name: 'Development Tools', items: ['Git', 'GitHub', 'VS Code', 'Vite', 'Framer Motion'] },
]

type CareerEntry = {
  role: string
  organization: string
  period: string
  description: string
  location: string
  projectTitle?: string
  projectId?: string
  projectDescription?: string
  projectHighlights?: string[]
  projectStack?: string[]
}

export const experience: CareerEntry[] = [
  {
    role: 'Trainee Python Odoo Developer',
    organization: 'Autochip India',
    period: 'Current role',
    description: 'Current role focused on Python and Odoo development.',
    location: 'Bengaluru, India',
  },
  {
    role: 'Internship',
    organization: 'Neopraxis Private Limited',
    period: 'Internship',
    description: 'Worked on a workflow that turns customer-support conversations into structured, searchable knowledge.',
    location: 'Kalpetta, Wayanad, Kerala',
    projectTitle: 'Automated Support-to-Knowledge Pipeline (S2K)',
    projectId: 's2k-pipeline',
    projectDescription: 'Internship project that transformed Gorgias support exports into cleaned, categorised Q&A records prepared for search and possible future RAG use.',
    projectHighlights: [
      'Cleaned conversation exports and separated customer messages from agent replies.',
      'Extracted and categorised question-and-answer pairs with an LLM-assisted workflow.',
      'Prepared structured knowledge outputs and summary reports.',
    ],
    projectStack: ['Python', 'Text processing', 'LLM-assisted extraction'],
  },
]

export const education = [
  {
    qualification: 'Bachelor of Computer Applications',
    institution: 'Koshys Group of Institutions / KIMS',
    period: '2023-2026',
    dateNote: 'GRADUATED',
    description: 'BCA with a Cyber Security specialisation. Bengaluru, Karnataka, India.',
    field: 'Cyber Security',
  },
]

export type ProjectVisualizationVariant = 'erp-library' | 'ai-processing' | 'iot-hub' | 'approval-flow' | 'attendance-flow' | 'evoting-flow' | 'routewise-flow' | 'secret-file' | 'system-overview' | 'concept-power' | 'concept-key' | 'corporate-web' | 'android-monitor' | 'iot-switchboard'
export type Project = {
  id: string
  title: string
  category: string
  description: string
  problem: string
  solution: string
  stack: string[]
  status: string
  number: string
  visualization?: ProjectVisualizationVariant
  features?: string[]
  architecture?: string
  contribution?: string
  documentationNote?: string
  githubUrl?: string
  liveUrl?: string
  previewImage?: string
}
export const projects: Project[] = [
  {
    id: 'myatties',
    title: 'MyAtties — Smart Attendance System',
    category: 'Web Apps',
    description: 'A role-based attendance application with session control, student attendance, duplicate-submission prevention, and administrative reporting.',
    problem: 'Institutions need attendance records tied to the right user role and an active class session.',
    solution: 'The earlier application foundation is described with open and closed attendance sessions, student attendance submission, duplicate prevention within a session, and administrative reporting. The wider campus platform adds planned roles and capabilities.',
    stack: ['React', 'Vite', 'Node.js', 'Express', 'MongoDB', 'Mongoose', 'JWT', 'bcrypt'],
    status: 'Foundation described; broader features planned',
    number: '01',
    visualization: 'attendance-flow',
    features: ['Role concepts for student, staff, institutional administrator, and developer/system manager', 'Staff-managed open and closed attendance sessions', 'Student attendance with duplicate-submission prevention described', 'Administrative reporting described', 'Planned: device binding, OTP, biometrics, geofencing, BLE, security alerts, timetable, announcements, emergency management, and plugin dashboards'],
    architecture: 'The earlier stack is described as React/Vite with Node.js/Express and MongoDB/Mongoose. The advanced verification and campus-management roadmap is not represented as implemented.',
    documentationNote: 'Core workflows are described in project notes. Advanced verification and platform capabilities are planned; current implementation has not been checked in a MyAtties source repository.',
    githubUrl: 'https://github.com',
    liveUrl: ''
  },
  {
    id: 's2k-pipeline',
    title: 'Automated Support-to-Knowledge Pipeline (S2K)',
    category: 'AI & Data',
    description: 'An internship workflow for turning Gorgias support exports into cleaned, classified Q&A and summaries prepared for search or future RAG use.',
    problem: 'Support answers are embedded in long ticket threads mixed with markup, metadata, and repeated boilerplate.',
    solution: 'The described workflow cleans HTML, timestamps, signatures, and unnecessary headers; separates customer and agent messages; uses LLM-assisted representative Q&A extraction; classifies results; and produces structured outputs and summaries.',
    stack: ['Python-based processing', 'Text cleaning', 'LLM-assisted extraction', 'Classification'],
    status: 'Internship project · described in notes',
    number: '02',
    visualization: 'ai-processing',
    features: ['Gorgias support exports as input', 'Cleaning and customer/agent message separation', 'LLM-assisted representative question-and-answer extraction', 'Categories: product information, order tracking, shipping/logistics, payments/refunds, and technical support', 'Structured outputs and processing summaries', 'Search or future RAG preparation; a production RAG system is not claimed'],
    architecture: 'Gorgias exports → cleaning → message separation → Q&A extraction → category classification → structured outputs and summaries. Search and RAG are downstream possibilities.',
    contribution: 'Project notes place this work within the Neopraxis Private Limited internship in Kalpetta, Wayanad.',
    documentationNote: 'Source notes describe the workflow. Model provider, exact implementation, deployment, and production RAG status are unverified.',
    githubUrl: 'https://github.com',
    liveUrl: ''
  },
  {
    id: 'esp32-master-hub',
    title: 'ESP32 Master Hub — Offline Wi-Fi Portal & Smart Switchboard',
    category: 'IoT',
    description: 'An ESP32 local-network hub concept combining a browser portal and a proposed offline lights/fans switchboard.',
    problem: 'A local portal can provide browser-based device status and control when an external router or internet connection is unavailable.',
    solution: 'Project notes describe an ESP32-created Wi-Fi access point and local browser portal with HTTP API concepts, device monitoring/control, and configuration persistence. Local appliance switching is included as a described concept; hardware and relay operation remain unverified.',
    stack: ['ESP32', 'Arduino framework', 'C++', 'HTML', 'CSS', 'JavaScript', 'Local Wi-Fi', 'HTTP API concepts'],
    status: 'Experimental; switchboard hardware verification pending',
    number: '03',
    visualization: 'iot-switchboard',
    features: ['ESP32 access point and local browser portal described', 'HTTP API concepts for status, events, and configuration', 'Device monitoring/control and configuration persistence described in project notes', 'Offline switchboard concept: browser control of lights/fans through the ESP32 network', 'No external router, internet, or cloud service needed for the described local concept', 'Game portal/multiplayer, distribution, host migration, relays, sensors, and further hardware are planned or partially implemented'],
    architecture: 'Phone or computer browser → ESP32-created local Wi-Fi → local portal/API concepts → device state and proposed switching output. Exact hardware and relay behavior are unverified.',
    documentationNote: 'The notes treat this as a local ESP32 project. Game, multiplayer, relay, and sensor capabilities are not represented as complete; physical switchboard behavior awaits verification.',
    githubUrl: 'https://github.com',
    liveUrl: ''
  },
  {
    id: 'smart-key-holder',
    title: 'Smart Key Holder — Weight-Activated Switch',
    category: 'Hardware Concepts',
    description: 'Proposed key-hook concept where placing or removing a key changes the state of a connected light or fan.',
    problem: 'A key holder could act as a simple physical trigger for a connected appliance.',
    solution: 'The concept uses the presence or weight of a key on a hook to activate a light/fan, and removing the key to deactivate it.',
    stack: ['Mechanical concept', 'Weight-activated switch'],
    status: 'Concept / proposed',
    number: '04',
    visualization: 'concept-key',
    features: ['Key placed on hook → activate connected light/fan (concept)', 'Key removed → deactivate (concept)', 'Mechanism, appliance interface, and electrical implementation are unverified'],
    architecture: 'Proposed key/hook trigger → switching interface → connected appliance. Implementation and safe mains switching are not verified.',
    documentationNote: 'Concept only. No finished or safety-certified mains-powered device is claimed.',
    githubUrl: 'https://github.com',
    liveUrl: ''
  },
]
