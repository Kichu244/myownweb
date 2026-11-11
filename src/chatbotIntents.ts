export type ChatIntent = {
  id: string
  category: 'social' | 'about' | 'work' | 'navigation' | 'contact' | 'fallback'
  patterns?: string[]
  keywordGroups?: string[][]
  priority: number
  reply: string
  link?: { label: string; path: string }
  tour?: string[]
  suggestions?: string[]
  followUps?: string[]
}

// Facts below are drawn from profile, experience, projects, and skills in data.ts.
export const intents: ChatIntent[] = [
  { id: 'greeting', category: 'social', patterns: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'], priority: 8, reply: 'Hi! I can help you explore Christopher’s portfolio, projects, experience, skills, and contact page.', suggestions: ['What projects are featured?', 'Tell me about his experience', 'How can I get in touch?'] },
  { id: 'thanks', category: 'social', patterns: ['thanks', 'thank you', 'that helps'], priority: 8, reply: 'You’re welcome! What else would you like to explore?' },
  { id: 'help', category: 'social', patterns: ['help', 'what can you do', 'what can i ask'], priority: 8, reply: 'I can point you to portfolio information about projects, skills, education, experience, and the contact page. I’m a local guide and don’t send messages or create leads.', suggestions: ['Show me the projects', 'What skills are listed?', 'Open contact options'] },
  { id: 'identity', category: 'social', patterns: ['who are you', 'are you a bot', 'what is your name'], priority: 8, reply: 'I’m the portfolio’s local website guide. I use a small set of predefined answers and don’t send your messages anywhere.' },
  { id: 'about', category: 'about', patterns: ['tell me about christopher', 'who is christopher', 'about christopher'], keywordGroups: [['christopher', 'him', 'person'], ['about', 'bio', 'background']], priority: 7, reply: 'Christopher Sam Saji is a Python & Odoo Developer based in Bengaluru, India. The portfolio shares his projects, skills, experience, and education.', link: { label: 'About Christopher', path: '/about' }, tour: ['Who am I'] },
  { id: 'company', category: 'work', patterns: ['what is autochip', 'where does he work', 'tell me about autochip'], keywordGroups: [['autochip', 'company', 'work'], ['experience', 'about', 'role']], priority: 8, reply: 'The portfolio lists Christopher’s current role as Trainee Python Odoo Developer at Autochip India in Bengaluru. It does not describe Autochip’s products or services.', link: { label: 'View experience', path: '/experience' }, tour: ['Experience', 'Education'] },
  { id: 'projects', category: 'work', patterns: ['show me the projects', 'what projects are featured', 'tell me about his projects'], keywordGroups: [['project', 'work', 'build'], ['show', 'list', 'feature', 'about']], priority: 7, reply: 'Featured work includes MyAtties Smart Attendance System, a support-to-knowledge pipeline from an internship, and ESP32 local-network experiments. Some project capabilities are concepts or planned work; each project page gives its status.', link: { label: 'Explore projects', path: '/projects' }, tour: ['Built to Solve'], followUps: ['pricing'], suggestions: ['Tell me about his experience', 'What skills are listed?'] },
  { id: 'experience', category: 'work', patterns: ['tell me about his experience', 'what is his experience', 'where has he worked'], keywordGroups: [['experience', 'career', 'work'], ['tell', 'show', 'about', 'where']], priority: 7, reply: 'The experience section lists a current Trainee Python Odoo Developer role at Autochip India and an internship at Neopraxis Private Limited, where he worked on support conversation data workflows.', link: { label: 'View experience', path: '/experience' }, tour: ['Experience', 'Education'], suggestions: ['What is Autochip?', 'What did he study?'] },
  { id: 'skills', category: 'work', patterns: ['what skills are listed', 'what technologies does he use', 'show me his skills'], keywordGroups: [['skill', 'technology', 'tech', 'tools'], ['list', 'show', 'use', 'have']], priority: 6, reply: 'The portfolio groups skills around Python and ERP, AI and data workflows, web and APIs, IoT and embedded systems, and development tools.', link: { label: 'Explore skills', path: '/skills' }, tour: ['technologies'] },
  { id: 'education', category: 'work', patterns: ['what did he study', 'where did he study', 'tell me about his education'], keywordGroups: [['education', 'study', 'degree', 'college'], ['christopher', 'he', 'his', 'about']], priority: 6, reply: 'The portfolio lists a Bachelor of Computer Applications with a Cyber Security specialisation at Koshys Group of Institutions / KIMS (2023–2026).', link: { label: 'View education', path: '/experience' }, tour: ['Education'] },
  { id: 'pricing', category: 'work', patterns: ['what are your prices', 'how much does it cost', 'pricing'], keywordGroups: [['price', 'pricing', 'cost', 'rate', 'budget']], priority: 6, reply: 'This is a personal portfolio, and it does not list service pricing. You can review the project details or use the contact page to find the available contact options.', link: { label: 'Contact options', path: '/contact' }, suggestions: ['Explore projects', 'Open contact options'] },
  { id: 'careers', category: 'work', patterns: ['are you hiring', 'any job openings', 'career opportunities'], keywordGroups: [['career', 'job', 'hiring', 'vacancy', 'opening'], ['available', 'open', 'opportunity', 'have', 'are']], priority: 7, reply: 'I don’t see any vacancies or hiring information in this portfolio. The experience section lists the roles and education currently presented.', link: { label: 'View experience', path: '/experience' } },
  { id: 'contact', category: 'contact', patterns: ['how can i get in touch', 'how do i contact him', 'open contact options', 'contact details'], keywordGroups: [['contact', 'email', 'reach', 'message'], ['christopher', 'him', 'options', 'details', 'page']], priority: 8, reply: 'Open the contact page to see the contact options available on the site. I don’t submit forms or create leads for you.', link: { label: 'Open contact page', path: '/contact' }, tour: ['Let’s make'] },
  { id: 'navigation', category: 'navigation', patterns: ['go to about', 'open skills', 'go to projects', 'open experience', 'open contact'], priority: 5, reply: 'I’ll open that section for you.', suggestions: ['Go to about', 'Open projects', 'Open contact'] },
]

export function normalizeMessage(input: string) {
  return input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim()
}

function hasPhrase(text: string, phrase: string) {
  return ` ${text} `.includes(` ${normalizeMessage(phrase)} `)
}

export function matchIntent(input: string) {
  const text = normalizeMessage(input)
  if (!text) return null
  const matches = intents.map((intent) => {
    const direct = intent.patterns?.some((pattern) => hasPhrase(text, pattern)) ?? false
    const groups = intent.keywordGroups ?? []
    const groupsMatched = groups.filter((group) => group.some((keyword) => hasPhrase(text, keyword))).length
    if (!direct && (groups.length === 0 || groupsMatched !== groups.length)) return null
    return { intent, score: (direct ? 5 : 0) + groupsMatched * 2 + intent.priority / 10 }
  }).filter((item): item is { intent: ChatIntent; score: number } => item !== null).sort((a, b) => b.score - a.score)
  if (!matches.length || matches[0].score < 1) return null
  if (matches[1] && matches[0].score - matches[1].score < .15) return null
  return matches[0].intent
}
