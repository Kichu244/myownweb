import { useRef, useState, useCallback, type PointerEvent as ReactPointerEvent, type ReactNode, type KeyboardEvent as ReactKeyboardEvent, type FocusEvent as ReactFocusEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useInView, useReducedMotion } from 'framer-motion'
import type { ProjectVisualizationVariant } from '../data'

type ProjectVisualizationProps = {
  variant?: ProjectVisualizationVariant
  className?: string
  interactive?: boolean
}

type NodeDetail = { id: string; title: string; detail: string; technology?: string; connection?: string }

const labels: Record<ProjectVisualizationVariant, string> = {
  'erp-library': 'Illustrative Odoo library application and related data model.',
  'ai-processing': 'Support conversation processing pipeline with branching category outputs.',
  'iot-hub': 'Local ESP32 network with radial connections to its described interfaces and hardware.',
  'approval-flow': 'Layered software approval architecture from Windows client through gateway and review queue.',
  'attendance-flow': 'Attendance dashboard and session lifecycle described in the supplied project brief.',
  'evoting-flow': 'Legacy educational voting diagram.',
  'routewise-flow': 'Legacy route comparison diagram.',
  'secret-file': 'Legacy project identity diagram.',
  'concept-power': 'Proposed USB accessory power hub with three operating modes.',
  'concept-key': 'Proposed weight-activated key holder concept.',
  'corporate-web': 'Corporate website design and page structure described in project notes.',
  'android-monitor': 'Android application communicating with an ESP32 over local Wi-Fi.',
  'iot-switchboard': 'ESP32 local portal and proposed offline smart switchboard.',
  'system-overview': 'Project overview. Open the project details for its supplied description and current status.',
}

function Hotspot({ interactive, detail, children }: { interactive: boolean; detail: NodeDetail; children: ReactNode }) {
  if (!interactive) return <g aria-hidden="true">{children}</g>
  return <g
    className="diagram-hotspot"
    role="button"
    tabIndex={0}
    aria-label={`${detail.title}. ${detail.detail}`}
    data-visual-node="true"
    data-node-id={detail.id}
    data-node-title={detail.title}
    data-node-detail={detail.detail}
    data-node-technology={detail.technology ?? ''}
    data-node-connection={detail.connection ?? ''}
  >{children}</g>
}

function Diagram({ variant, interactive }: { variant: ProjectVisualizationVariant; interactive: boolean }) {
  if (variant === 'concept-power' || variant === 'concept-key' || variant === 'corporate-web' || variant === 'android-monitor' || variant === 'iot-switchboard') {
    const cfg = {
      'concept-power': { eyebrow: 'PROPOSED / HARDWARE CONCEPT', title: 'POWERSYNC HUB', left: 'USB-A / USB-C', mid: 'OFF  ·  ON  ·  AUTO', right: 'PC SIGNAL (INTENDED)', info: 'AUTO MODE IS A PROPOSAL', detail: 'Accessory power hub concept; no hardware implementation is verified.' },
      'concept-key': { eyebrow: 'CONCEPT / MECHANICAL TRIGGER', title: 'SMART KEY HOLDER', left: 'KEY ON HOOK', mid: 'WEIGHT SWITCH', right: 'LIGHT / FAN', info: 'MECHANISM AND MAINS INTERFACE UNVERIFIED', detail: 'Key presence is intended to activate a connected appliance; key removal is intended to deactivate it.' },
      'corporate-web': { eyebrow: 'CORPORATE WEBSITE / PROJECT NOTES', title: 'AUTOCHIP INDIA', left: 'BUSINESS PAGES', mid: 'AUTOMOTIVE ERP', right: 'SERVICES + CAREERS', info: 'IMPLEMENTATION VERIFICATION PENDING', detail: 'Responsive React, TypeScript, and Vite website described in notes; this repository is the portfolio.' },
      'android-monitor': { eyebrow: 'ANDROID COMPANION / LOCAL NETWORK', title: 'DEVICE MONITOR', left: 'COMPOSE APP', mid: 'HTTP / WI-FI', right: 'ESP32 HUB', info: 'EVENT NOTIFICATION TEST PREVIOUSLY REPORTED', detail: 'Background notification and reconnection behavior remain unverified.' },
      'iot-switchboard': { eyebrow: 'LOCAL CONTROL / NO CLOUD', title: 'ESP32 MASTER HUB', left: 'PHONE BROWSER', mid: 'LOCAL PORTAL', right: 'LIGHTS / FANS', info: 'SWITCHBOARD HARDWARE VERIFICATION PENDING', detail: 'Local Wi-Fi switchboard is described as a concept; relay and appliance behavior are unverified.' },
    }[variant]
    return <svg className={`project-diagram-svg diagram-${variant}`} viewBox="0 0 720 430" aria-label={labels[variant]} role={interactive ? 'group' : 'img'} focusable="false">
      <rect className="concept-frame" x="22" y="22" width="676" height="386" rx="5" />
      <text className="diagram-kicker" x="48" y="60">{cfg.eyebrow}</text>
      <text className="diagram-title concept-title" x="48" y="108">{cfg.title}</text>
      {variant === 'iot-switchboard' && <g>
        <rect className="concept-card" x="54" y="145" width="236" height="220" rx="12" /><rect className="concept-screen" x="72" y="164" width="200" height="163" rx="7" />
        <text className="concept-small" x="88" y="191">ROOM CONTROLS</text>
        <rect className="concept-toggle is-on" x="88" y="208" width="166" height="44" rx="6" /><circle className="concept-lamp" cx="110" cy="230" r="10" /><text className="concept-label" x="132" y="236">LIGHTS</text><rect className="concept-switch is-on" x="220" y="218" width="24" height="12" rx="6" />
        <rect className="concept-toggle" x="88" y="267" width="166" height="44" rx="6" /><path className="concept-fan" d="M109 278q-9 8 0 17 9-9 0-17m0 17q-9 8 0 17 9-9 0-17m0-8q9-8 0-17-9 9 0 17m0 17q9 8 0 17 9-9 0-17" /><text className="concept-label" x="132" y="295">FAN</text><rect className="concept-switch" x="220" y="277" width="24" height="12" rx="6" />
        <path className="concept-link" d="M290 250h105" /><circle className="concept-router" cx="438" cy="250" r="55" /><text className="concept-wifi" x="438" y="244" textAnchor="middle">Wi-Fi</text><text className="concept-small" x="438" y="266" textAnchor="middle">ESP32 AP</text><path className="concept-link" d="M493 250h75" />
        <rect className="concept-device" x="568" y="191" width="80" height="118" rx="6" /><path className="concept-antenna" d="M591 181q17-18 34 0m-27 8q10-10 20 0" /><circle className="concept-led" cx="608" cy="219" r="5" /><text className="concept-small" x="608" y="278" textAnchor="middle">LOCAL</text>
      </g>}
      {variant === 'android-monitor' && <g>
        <rect className="concept-phone" x="100" y="135" width="190" height="245" rx="22" /><rect className="concept-screen" x="116" y="158" width="158" height="190" rx="8" /><text className="concept-small" x="132" y="183">MASTER HUB</text><circle className="concept-led" cx="146" cy="213" r="7" /><text className="concept-label" x="162" y="218">ONLINE</text><rect className="concept-notification" x="128" y="238" width="134" height="55" rx="5" /><text className="concept-small" x="138" y="258">BUTTON EVENT</text><text className="concept-copy" x="138" y="278">Notification test</text><rect className="concept-toggle is-on" x="128" y="306" width="134" height="27" rx="5" /><text className="concept-small" x="140" y="324">LED CONTROL</text>
        <path className="concept-radio" d="M344 190q-28 28 0 56m14-72q-45 44 0 88m15-105q-61 61 0 122" /><path className="concept-link" d="M290 250h84" /><rect className="concept-board" x="448" y="157" width="166" height="180" rx="12" /><rect className="concept-chip" x="489" y="198" width="84" height="74" rx="6" /><text className="concept-label" x="531" y="231" textAnchor="middle">ESP32</text><text className="concept-small" x="531" y="253" textAnchor="middle">LOCAL HTTP</text><path className="concept-link" d="M374 250h74" /><text className="concept-small" x="530" y="312" textAnchor="middle">HUB DEVICE</text>
      </g>}
      {variant === 'corporate-web' && <g>
        <rect className="concept-browser" x="58" y="139" width="604" height="230" rx="8" /><path className="concept-browserbar" d="M58 177h604" /><circle className="concept-dot" cx="80" cy="158" r="5" /><circle className="concept-dot" cx="98" cy="158" r="5" /><circle className="concept-dot" cx="116" cy="158" r="5" /><text className="concept-small" x="139" y="162">AUTOCHIP INDIA / CORPORATE WEB</text>
        <rect className="concept-hero" x="80" y="196" width="272" height="145" rx="5" /><text className="concept-small" x="102" y="226">AUTOMOTIVE ERP</text><text className="concept-web-title" x="102" y="260">Business, in motion.</text><path className="concept-underline" d="M102 279h108" /><rect className="concept-cta" x="102" y="300" width="96" height="23" rx="11" /><text className="concept-small" x="116" y="315">EXPLORE SERVICES</text>
        <rect className="concept-webcard" x="376" y="196" width="122" height="145" rx="5" /><path className="concept-webicon" d="M404 246h66m-55-15h44m-55 32h54" /><text className="concept-small" x="390" y="290">SOLUTIONS</text><text className="concept-small" x="390" y="312">ERP / SERVICES</text>
        <rect className="concept-webcard is-careers" x="516" y="196" width="124" height="145" rx="5" /><circle className="concept-person" cx="578" cy="237" r="17" /><path className="concept-webicon" d="M548 276h60m-48 15h48" /><text className="concept-small" x="535" y="321">CAREERS</text>
      </g>}
      {variant === 'concept-power' && <g>
        <rect className="concept-board" x="90" y="154" width="540" height="195" rx="24" /><text className="concept-small" x="118" y="187">ACCESSORY POWER / PROPOSED</text>
        <rect className="concept-usb" x="128" y="215" width="112" height="78" rx="8" /><rect className="concept-port" x="145" y="238" width="78" height="31" rx="4" /><text className="concept-label" x="184" y="322" textAnchor="middle">USB-A</text>
        <rect className="concept-usb is-c" x="260" y="215" width="112" height="78" rx="8" /><rect className="concept-port is-c" x="280" y="238" width="72" height="31" rx="14" /><text className="concept-label" x="316" y="322" textAnchor="middle">USB-C</text>
        <circle className="concept-mode" cx="474" cy="254" r="44" /><path className="concept-mode-mark" d="M474 223v31l22 14" /><text className="concept-label" x="474" y="322" textAnchor="middle">OFF / ON / AUTO</text>
        <path className="concept-link" d="M518 254h48" /><path className="concept-signal" d="M566 223q32 31 0 62m13-80q50 49 0 98" /><text className="concept-small" x="590" y="329" textAnchor="middle">PC SIGNAL*</text>
      </g>}
      {variant === 'concept-key' && <g>
        <path className="concept-hook-board" d="M116 168v166q0 24 24 24h174" /><path className="concept-hook" d="M246 184v84q0 33 31 33 30 0 30-31v-20" /><circle className="concept-keyring" cx="276" cy="266" r="12" /><path className="concept-key" d="M276 278v45m0-24h13m-13 12h10" /><text className="concept-label" x="152" y="209">KEY ON HOOK</text>
        <path className="concept-link" d="M310 277h92" /><rect className="concept-sensor" x="402" y="225" width="92" height="102" rx="8" /><path className="concept-scale" d="M420 252h56m-28-14v29m-22 0h44" /><text className="concept-small" x="448" y="307" textAnchor="middle">WEIGHT</text><path className="concept-link" d="M494 277h68" />
        <path className="concept-bulb" d="M587 216c-23 0-38 17-38 37 0 15 9 23 17 34h42c8-11 17-19 17-34 0-20-15-37-38-37z" /><path className="concept-bulb-base" d="M570 296h34m-30 12h26m-22 11h18" /><path className="concept-rays" d="M587 195v-13m-56 71h-15m127 0h15m-99-47-10-10m71 10 10-10" /><text className="concept-label" x="587" y="346" textAnchor="middle">LIGHT / FAN*</text>
      </g>}
      <text className="diagram-kicker concept-note" textAnchor="middle" x="360" y="386">{cfg.info}</text>
      {interactive && <Hotspot interactive detail={{ id: variant, title: cfg.title, detail: cfg.detail, technology: cfg.eyebrow, connection: `${cfg.left} → ${cfg.mid} → ${cfg.right}` }}><rect className="concept-hit" x="40" y="125" width="640" height="250" rx="4" /></Hotspot>}
    </svg>
  }
  if (variant === 'erp-library') return <svg className="project-diagram-svg diagram-odoo" viewBox="0 0 720 430" aria-label={labels[variant]} role={interactive ? 'group' : 'img'} focusable="false">
    <rect className="odoo-window" x="16" y="16" width="688" height="398" rx="4" />
    <path className="odoo-window-bar" d="M16 55h688" />
    <circle className="odoo-window-dot" cx="36" cy="36" r="3" /><circle className="odoo-window-dot" cx="49" cy="36" r="3" /><circle className="odoo-window-dot" cx="62" cy="36" r="3" />
    <text className="diagram-kicker" x="82" y="39">LIBRARY / BOOK RECORDS</text><text className="diagram-caption" x="615" y="39">ODOO 18</text>
    <rect className="odoo-pane" x="30" y="70" width="408" height="228" rx="3" /><text className="diagram-kicker" x="48" y="94">CATALOGUE</text>
    <path className="odoo-row-line" d="M46 109h375M46 153h375M46 197h375M46 241h375M46 285h375" />
    <text className="odoo-table-label" x="49" y="125">TITLE</text><text className="odoo-table-label" x="250" y="125">AUTHOR</text><text className="odoo-table-label" x="354" y="125">ISBN</text>
    <Hotspot interactive detail={{ id: 'book-record', title: 'Book record', detail: 'A book entry with title, author relationship, ISBN, publication date, type, tags, and pricing fields described in the brief.', technology: 'Odoo ORM', connection: 'Related to author, country, and book-type/tag data.' }}>
      <rect className="odoo-selected-row" x="46" y="133" width="375" height="40" rx="2" /><text className="odoo-book-title" x="58" y="158">Illustrative book record</text><text className="odoo-book-copy" x="250" y="158">Author relation</text><text className="odoo-book-copy" x="354" y="158">ISBN field</text>
    </Hotspot>
    <Hotspot interactive detail={{ id: 'book-row', title: 'Additional catalogue records', detail: 'The module is described as storing structured book information; these rows are visual placeholders, not portfolio data.', technology: 'Book model', connection: 'Catalogue records connect to shared author information.' }}>
      <rect className="odoo-table-row" x="46" y="177" width="375" height="40" rx="2" /><text className="odoo-book-copy" x="58" y="202">Book record</text><text className="odoo-book-copy" x="250" y="202">Author relation</text><text className="odoo-book-copy" x="354" y="202">ISBN field</text>
    </Hotspot>
    <text className="odoo-footnote" x="48" y="276">ILLUSTRATIVE INTERFACE / NO REAL RECORDS</text>
    <rect className="odoo-pane" x="452" y="70" width="238" height="228" rx="3" /><text className="diagram-kicker" x="470" y="94">RECORD DETAILS</text>
    <Hotspot interactive detail={{ id: 'author', title: 'Author relationship', detail: 'Book records are described as linked to author information.', technology: 'Odoo ORM relation', connection: 'Book record ↔ author record.' }}>
      <rect className="odoo-detail-card" x="468" y="110" width="206" height="48" rx="2" /><text className="odoo-table-label" x="480" y="128">AUTHOR</text><text className="odoo-book-copy" x="480" y="147">Related author record</text>
    </Hotspot>
    <Hotspot interactive detail={{ id: 'isbn-validation', title: 'ISBN uniqueness', detail: 'ISBN uniqueness is listed in the project notes; exact validation behavior awaits updated documentation.', technology: 'Odoo constraint / validation', connection: 'Applies to the book ISBN field.' }}>
      <rect className="odoo-validation" x="468" y="168" width="206" height="32" rx="2" /><circle className="odoo-check" cx="485" cy="184" r="6" /><text className="odoo-book-copy" x="500" y="188">ISBN uniqueness described</text>
    </Hotspot>
    <Hotspot interactive detail={{ id: 'pricing', title: 'Price and tax calculation', detail: 'Price, tax percentage, and a stored total-price field are described in the project notes; values shown here are intentionally omitted.', technology: 'Odoo computed/stored field', connection: 'Book price + tax → stored total.' }}>
      <rect className="odoo-price-card" x="468" y="210" width="206" height="68" rx="2" /><text className="odoo-table-label" x="480" y="230">PRICE + TAX</text><path className="odoo-math-line" d="M480 244h180" /><text className="odoo-book-copy" x="480" y="263">Calculated total field</text>
    </Hotspot>
    <text className="diagram-kicker" x="32" y="324">RELATED MODEL MAP</text>
    <path className="odoo-model-link" data-link-for="book-record author author-model related-fields" d="M210 369H257M360 369H410M312 350V331H520V350" />
    <Hotspot interactive detail={{ id: 'book-model', title: 'Book model', detail: 'Central catalogue record described for the library module.', technology: 'Odoo ORM model', connection: 'Relates to author, country, tags, book type, ISBN, and pricing.' }}><rect className="odoo-model-node is-main" x="105" y="348" width="105" height="42" rx="3" /><text className="diagram-title" x="128" y="374">BOOK</text></Hotspot>
    <Hotspot interactive detail={{ id: 'author-model', title: 'Author model', detail: 'Author information related to book records.', technology: 'Odoo ORM model', connection: 'Book ↔ author.' }}><rect className="odoo-model-node" x="257" y="348" width="103" height="42" rx="3" /><text className="diagram-title" x="278" y="374">AUTHOR</text></Hotspot>
    <Hotspot interactive detail={{ id: 'related-fields', title: 'Related fields', detail: 'Country, tags, publication date, and book-type fields are described in the project notes.', technology: 'Odoo fields', connection: 'Attached to book records.' }}><rect className="odoo-model-node" x="410" y="348" width="220" height="42" rx="3" /><text className="diagram-title" x="428" y="374">COUNTRY · TAGS · TYPE</text></Hotspot>
  </svg>

  if (variant === 'ai-processing') return <svg className="project-diagram-svg diagram-ai" viewBox="0 0 720 430" aria-label={labels[variant]} role={interactive ? 'group' : 'img'} focusable="false">
    <text className="diagram-kicker" x="25" y="32">SUPPORT-TO-KNOWLEDGE / PROCESS MAP</text><text className="diagram-caption" x="585" y="32">AMBIENT SIGNAL ONLY</text>
    <path className="ai-route" data-link-for="export cleaning separation extraction categories output" d="M75 153C117 153 126 95 176 95S234 153 284 153s58-58 108-58 58 58 108 58 57-58 105-58" />
    <path className="ai-route ai-route-flow" data-link-for="export cleaning separation extraction categories output" d="M75 153C117 153 126 95 176 95S234 153 284 153s58-58 108-58 58 58 108 58 57-58 105-58" />
    <Hotspot interactive detail={{ id: 'export', title: 'Conversation export', detail: 'The described workflow begins with exported customer-support conversations.', technology: 'Conversation export', connection: 'Feeds text cleaning.' }}><path className="ai-stage ai-stage-document" d="M31 119h74l18 18v58H31z" /><path className="ai-doc-fold" d="M105 119v18h18" /><text className="ai-index" x="42" y="145">01</text><text className="diagram-title" x="42" y="168">EXPORT</text><text className="diagram-copy" x="42" y="184">Conversation</text></Hotspot>
    <Hotspot interactive detail={{ id: 'cleaning', title: 'Text cleaning', detail: 'HTML, timestamps, signatures, and unnecessary headers are described as being removed.', technology: 'Python text processing', connection: 'Cleaned messages proceed to customer/agent separation.' }}><circle className="ai-stage ai-stage-clean" cx="176" cy="95" r="43" /><circle className="ai-stage-inner" cx="176" cy="95" r="31" /><text className="ai-index" x="167" y="89">02</text><text className="diagram-title" x="145" y="112">CLEAN</text><text className="diagram-copy" x="136" y="160">Normalize text</text></Hotspot>
    <Hotspot interactive detail={{ id: 'separation', title: 'Message separation', detail: 'Customer messages and agent responses are described as separate inputs for later extraction.', technology: 'Text-processing workflow', connection: 'Creates customer and agent message streams.' }}><path className="ai-stage ai-stage-split" d="M246 173l38-65 38 65z" /><text className="ai-index" x="280" y="145">03</text><text className="diagram-title" x="262" y="164">SPLIT</text><text className="diagram-copy" x="247" y="203">Customer / agent</text></Hotspot>
    <Hotspot interactive detail={{ id: 'extraction', title: 'Knowledge extraction', detail: 'An LLM-assisted workflow is described for extracting question-and-answer pairs. No model provider or accuracy claim is supplied.', technology: 'LLM-assisted workflow', connection: 'Separated messages → question-and-answer pairs.' }}><path className="ai-stage ai-stage-extract" d="M392 52l44 43-44 43-44-43z" /><text className="ai-index" x="383" y="91">04</text><text className="diagram-title" x="363" y="110">EXTRACT</text><text className="diagram-copy" x="361" y="160">Question + answer</text></Hotspot>
    <Hotspot interactive detail={{ id: 'categories', title: 'Knowledge categories', detail: 'Product, order tracking, shipping/logistics, payments/refunds, and technical support are categories named in the brief.', technology: 'Categorisation', connection: 'Extracted knowledge → support categories.' }}><circle className="ai-category-orbit" cx="500" cy="153" r="48" /><circle className="ai-category-node" cx="500" cy="105" r="5" /><circle className="ai-category-node" cx="545" cy="138" r="5" /><circle className="ai-category-node" cx="528" cy="190" r="5" /><circle className="ai-category-node" cx="472" cy="190" r="5" /><circle className="ai-category-node" cx="455" cy="138" r="5" /><text className="ai-index" x="491" y="157">05</text><text className="diagram-title" x="465" y="225">CATEGORISE</text></Hotspot>
    <Hotspot interactive detail={{ id: 'output', title: 'Structured output', detail: 'The workflow is described as preparing structured question-and-answer content and summary reports.', technology: 'Structured data', connection: 'Categorised knowledge → output and summaries.' }}><path className="ai-stage ai-stage-output" d="M603 64h70v93h-70z" /><path className="ai-output-lines" d="M615 88h43M615 102h43M615 116h31M615 138h43" /><text className="ai-index" x="613" y="82">06</text><text className="diagram-title" x="595" y="180">OUTPUT</text><text className="diagram-copy" x="590" y="197">Structured Q + A</text></Hotspot>
    <path className="ai-branch" data-link-for="categories output" d="M500 242v46m0-30h-76v24m76-24h76v24" />
    <text className="ai-branch-label" x="359" y="308">PRODUCT</text><text className="ai-branch-label" x="513" y="308">SUPPORT THEMES</text>
    <text className="diagram-caption" x="25" y="398">RAG / CONTEXT-AWARE TICKET ANALYSIS ARE SEPARATE EXPLORATIONS</text>
  </svg>

  if (variant === 'iot-hub') return <svg className="project-diagram-svg diagram-iot" viewBox="0 0 720 430" aria-label={labels[variant]} role={interactive ? 'group' : 'img'} focusable="false">
    <path className="iot-link iot-link-android" data-link-for="android esp32 local-wifi" d="M357 205Q242 92 146 102" /><path className="iot-link iot-link-portal" data-link-for="web-portal esp32 local-wifi" d="M363 205Q476 91 575 103" /><path className="iot-link iot-link-led" data-link-for="led-gpio esp32" d="M353 220Q229 290 145 316" /><path className="iot-link iot-link-button" data-link-for="button-gpio esp32" d="M367 220Q489 292 575 316" /><path className="iot-link iot-link-wifi" data-link-for="local-wifi android web-portal esp32" d="M360 231v99" />
    <path className="iot-link iot-signal iot-link-android" data-link-for="android esp32 local-wifi" d="M357 205Q242 92 146 102" /><path className="iot-link iot-signal iot-link-portal" data-link-for="web-portal esp32 local-wifi" d="M363 205Q476 91 575 103" /><path className="iot-link iot-signal iot-link-led" data-link-for="led-gpio esp32" d="M353 220Q229 290 145 316" /><path className="iot-link iot-signal iot-link-button" data-link-for="button-gpio esp32" d="M367 220Q489 292 575 316" /><path className="iot-link iot-signal iot-link-wifi" data-link-for="local-wifi android web-portal esp32" d="M360 231v99" />
    <Hotspot interactive detail={{ id: 'android', title: 'Android application', detail: 'Android Studio and Jetpack Compose are described for an app experiment that communicates with the ESP32 using HTTP.', technology: 'Android Studio · Jetpack Compose · HTTP', connection: 'Phone ↔ local Wi-Fi ↔ ESP32.' }}><rect className="iot-node iot-software" x="57" y="64" width="178" height="78" rx="18" /><rect className="iot-phone-screen" x="70" y="76" width="32" height="54" rx="5" /><circle className="iot-phone-dot" cx="86" cy="122" r="2" /><text className="diagram-title" x="113" y="96">ANDROID APP</text><text className="diagram-copy" x="113" y="116">HTTP experiment</text><text className="iot-node-type" x="113" y="132">SOFTWARE NODE</text></Hotspot>
    <Hotspot interactive detail={{ id: 'web-portal', title: 'Local web portal', detail: 'A local web portal at 192.168.4.1 is described in the project brief.', technology: 'Local web interface', connection: 'Browser → ESP32 access point.' }}><rect className="iot-node iot-software" x="485" y="64" width="178" height="78" rx="4" /><rect className="iot-browser-bar" x="498" y="77" width="152" height="11" rx="2" /><text className="diagram-title" x="505" y="108">WEB PORTAL</text><text className="diagram-copy" x="505" y="126">192.168.4.1 described</text></Hotspot>
    <Hotspot interactive detail={{ id: 'esp32', title: 'ESP32 hub', detail: 'The ESP32 is described as a local Wi-Fi access point and hub. The diagram does not imply cloud connectivity.', technology: 'ESP32 · Arduino/C++ described', connection: 'Local network joins the Android experiment, portal, and hardware concepts.' }}><circle className="iot-hub-aura" cx="360" cy="210" r="88" /><circle className="iot-hub-core" cx="360" cy="210" r="66" /><rect className="iot-chip" x="333" y="181" width="54" height="42" rx="4" /><path className="iot-chip-pin" d="M325 188h8m-8 10h8m-8 10h8m-8 10h8m54-30h8m-8 10h8m-8 10h8m-8 10h8m-40-33v-9m12 9v-9m-12 51v9m12-9v9" /><text className="diagram-title" x="332" y="249">ESP32 HUB</text><text className="diagram-copy" x="327" y="266">LOCAL NETWORK</text></Hotspot>
    <Hotspot interactive detail={{ id: 'led-gpio', title: 'LED / GPIO4', detail: 'An LED on GPIO4 is named in the project notes; current hardware and pin mapping await confirmation.', technology: 'GPIO · pin assignment to confirm', connection: 'ESP32 GPIO output → LED concept.' }}><circle className="iot-node iot-hardware" cx="139" cy="316" r="43" /><path className="iot-led" d="M130 303h18l-3 21h-12zM133 327h12m-10 5h8m-15-36-6-6m33 6 6-6m-28-1v-8m22 8 5-5" /><text className="diagram-title" x="93" y="374">LED / GPIO4*</text></Hotspot>
    <Hotspot interactive detail={{ id: 'button-gpio', title: 'Pushbutton / GPIO18', detail: 'A pushbutton on GPIO18 is named in the project notes; current hardware and pin mapping await confirmation.', technology: 'GPIO · pin assignment to confirm', connection: 'Pushbutton input → ESP32 hub concept.' }}><circle className="iot-node iot-hardware" cx="581" cy="316" r="43" /><circle className="iot-button" cx="581" cy="308" r="13" /><path className="iot-button-line" d="M565 331h32" /><text className="diagram-title" x="526" y="374">BUTTON / GPIO18*</text></Hotspot>
    <Hotspot interactive detail={{ id: 'local-wifi', title: 'Local Wi-Fi', detail: 'The brief describes a nearby access point and local HTTP communication; no cloud service is shown.', technology: 'Wi-Fi · HTTP', connection: 'Local phone and browser clients ↔ ESP32.' }}><rect className="iot-network-label" x="279" y="335" width="162" height="42" rx="21" /><path className="iot-wifi" d="M327 352q33-29 66 0m-54 9q21-18 42 0m-28 9q7-6 14 0" /><text className="diagram-caption" x="370" y="360">LOCAL WI-FI</text></Hotspot>
    <text className="diagram-caption" x="24" y="408">* PIN ASSIGNMENTS DESCRIBED / VERIFY AGAINST CURRENT BUILD</text><text className="diagram-caption" x="509" y="408">PLANNED GAME PORTAL OMITTED</text>
  </svg>

  if (variant === 'approval-flow') return <svg className="project-diagram-svg diagram-approval" viewBox="0 0 720 430" aria-label={labels[variant]} role={interactive ? 'group' : 'img'} focusable="false">
    <text className="diagram-kicker" x="24" y="31">REQUEST ARCHITECTURE / RESEARCH PROTOTYPE</text>
    <path className="approval-lane" d="M178 54v310M352 54v310M535 54v310" />
    <text className="approval-zone-title" x="26" y="70">01 / CLIENT DEVICE</text><text className="approval-zone-title" x="198" y="70">02 / GATEWAY</text><text className="approval-zone-title" x="372" y="70">03 / REQUEST QUEUE</text><text className="approval-zone-title" x="555" y="70">04 / ADMIN</text>
    <Hotspot interactive detail={{ id: 'windows-client', title: 'Windows client', detail: 'The research assignment concerns Windows laptops on a private network.', technology: 'Windows device', connection: 'Hosts the ClientAgent service.' }}><rect className="approval-device" x="34" y="111" width="116" height="72" rx="4" /><rect className="approval-screen" x="44" y="121" width="96" height="48" rx="2" /><text className="diagram-title" x="57" y="144">WINDOWS</text><text className="diagram-copy" x="59" y="160">CLIENT DEVICE</text></Hotspot>
    <Hotspot interactive detail={{ id: 'client-agent', title: 'ClientAgent', detail: 'A background service is described collecting computer name, network details, and an agent identifier, then communicating with the gateway over HTTP.', technology: 'C# · .NET · HTTP described', connection: 'ClientAgent → AdminGateway.' }}><rect className="approval-agent" x="31" y="209" width="121" height="67" rx="3" /><text className="diagram-title" x="49" y="236">CLIENT AGENT</text><text className="diagram-copy" x="49" y="255">Device + request</text></Hotspot>
    <path className="approval-flow" data-link-for="windows-client client-agent gateway request-queue admin-console" d="M150 242h67m102 0h46m115 0h38" />
    <Hotspot interactive detail={{ id: 'gateway', title: 'AdminGateway API', detail: 'The project brief describes an ASP.NET Minimal API with status, device registration, request tracking, and request-submission endpoints.', technology: 'ASP.NET Minimal API', connection: 'Receives device information and installation requests.' }}><rect className="approval-gateway" x="217" y="126" width="84" height="180" rx="5" /><rect className="approval-gateway-slot" x="229" y="146" width="60" height="14" rx="2" /><rect className="approval-gateway-slot" x="229" y="169" width="60" height="14" rx="2" /><circle className="approval-status-light" cx="239" cy="282" r="4" /><circle className="approval-status-light" cx="257" cy="282" r="4" /><text className="diagram-title" x="228" y="209">API</text><text className="diagram-copy" x="227" y="228">GATEWAY</text></Hotspot>
    <Hotspot interactive detail={{ id: 'request-queue', title: 'Request queue', detail: 'Installation-request tracking and pending-request display are described. Exact persisted state and transitions await documentation.', technology: 'Request handling', connection: 'Gateway → queue → administrator review.' }}><rect className="approval-queue" x="349" y="112" width="166" height="194" rx="4" /><text className="diagram-kicker" x="365" y="138">INSTALL REQUESTS</text><path className="approval-queue-line" d="M365 152h134" /><rect className="approval-request" x="362" y="167" width="140" height="38" rx="2" /><circle className="approval-pending-dot" cx="377" cy="186" r="4" /><text className="diagram-copy" x="390" y="184">Pending request</text><text className="approval-state" x="390" y="197">STATUS / REVIEW</text><rect className="approval-request" x="362" y="216" width="140" height="38" rx="2" /><circle className="approval-pending-dot" cx="377" cy="235" r="4" /><text className="diagram-copy" x="390" y="233">Device request</text><text className="approval-state" x="390" y="246">STATUS / DESCRIBED</text><text className="approval-state" x="365" y="285">ILLUSTRATIVE QUEUE</text></Hotspot>
    <Hotspot interactive detail={{ id: 'admin-console', title: 'Administrator review', detail: 'The brief describes an administrative interface with request search, status filtering, pending requests, and an approval-action UI.', technology: 'Admin interface · implementation to confirm', connection: 'Reviews requests from the queue; enforcement beyond the application is not claimed.' }}><rect className="approval-console" x="554" y="111" width="138" height="195" rx="4" /><path className="approval-console-top" d="M554 129h138" /><circle className="approval-console-dot" cx="567" cy="120" r="3" /><text className="diagram-kicker" x="568" y="151">ADMIN CONSOLE</text><rect className="approval-console-row" x="566" y="165" width="114" height="28" rx="2" /><text className="diagram-copy" x="574" y="183">Search / filter</text><rect className="approval-console-row" x="566" y="201" width="114" height="40" rx="2" /><text className="diagram-copy" x="574" y="218">Review request</text><text className="approval-state" x="574" y="232">ACTION UI DESCRIBED</text><rect className="approval-decision" x="566" y="254" width="51" height="23" rx="2" /><rect className="approval-decision is-secondary" x="625" y="254" width="55" height="23" rx="2" /><text className="approval-state" x="575" y="269">APPROVE</text><text className="approval-state" x="631" y="269">REJECT</text></Hotspot>
    <text className="diagram-caption" x="24" y="397">APPLICATION WORKFLOW ONLY / NO WINDOWS-WIDE ENFORCEMENT CLAIM</text>
  </svg>

  if (variant === 'attendance-flow') return <svg className="project-diagram-svg diagram-attendance" viewBox="0 0 720 430" aria-label={labels[variant]} role={interactive ? 'group' : 'img'} focusable="false">
    <rect className="attendance-shell" x="16" y="16" width="688" height="398" rx="4" /><path className="attendance-topbar" d="M16 60h688" />
    <text className="diagram-kicker" x="36" y="43">ATTENDANCE / OVERVIEW</text><text className="attendance-date" x="580" y="43">SESSION CONSOLE</text>
    <rect className="attendance-sidebar" x="31" y="76" width="125" height="317" rx="3" /><text className="attendance-nav is-current" x="47" y="108">Overview</text><text className="attendance-nav" x="47" y="141">Sessions</text><text className="attendance-nav" x="47" y="174">Records</text><text className="attendance-nav" x="47" y="207">Reports</text><text className="attendance-role" x="47" y="367">ROLE-BASED APP</text>
    <text className="diagram-kicker" x="178" y="91">SESSION STATE / DESCRIBED V1</text>
    <path className="attendance-state-link" data-link-for="closed-state open-state recorded-state" d="M233 156h102m98 0h102" />
    <Hotspot interactive detail={{ id: 'closed-state', title: 'Session closed', detail: 'The supplied description includes open and closed attendance session states.', technology: 'Session lifecycle', connection: 'Staff opens the session to allow attendance marking.' }}><rect className="attendance-state" x="178" y="118" width="157" height="75" rx="4" /><circle className="attendance-state-dot is-closed" cx="197" cy="140" r="5" /><text className="diagram-title" x="211" y="144">CLOSED</text><text className="diagram-copy" x="195" y="170">Staff can open</text></Hotspot>
    <Hotspot interactive detail={{ id: 'open-state', title: 'Session open', detail: 'Students are described as marking attendance while a session is open.', technology: 'Attendance session', connection: 'Open session → student attendance record.' }}><rect className="attendance-state is-open" x="335" y="118" width="196" height="75" rx="4" /><circle className="attendance-state-dot" cx="354" cy="140" r="5" /><text className="diagram-title" x="368" y="144">OPEN</text><text className="diagram-copy" x="352" y="170">Student marking enabled</text></Hotspot>
    <Hotspot interactive detail={{ id: 'recorded-state', title: 'Attendance recorded', detail: 'The description includes preventing a duplicate attendance record within one session.', technology: 'Attendance record', connection: 'Student mark → one record per session.' }}><rect className="attendance-state" x="531" y="118" width="155" height="75" rx="4" /><circle className="attendance-state-dot" cx="550" cy="140" r="5" /><text className="diagram-title" x="564" y="144">RECORDED</text><text className="diagram-copy" x="548" y="170">Duplicate prevented</text></Hotspot>
    <rect className="attendance-table" x="177" y="222" width="327" height="171" rx="3" /><text className="diagram-kicker" x="194" y="247">SESSION ACTIVITY</text><path className="attendance-table-line" d="M194 260h292M194 299h292M194 338h292M194 377h292" />
    <Hotspot interactive detail={{ id: 'session-report', title: 'Administrative reports', detail: 'Attendance reporting and user management through a developer role are described in the brief.', technology: 'Admin reporting', connection: 'Session and attendance records → reports.' }}><rect className="attendance-report" x="520" y="222" width="166" height="171" rx="3" /><text className="diagram-kicker" x="537" y="247">REPORTS</text><path className="attendance-bars" d="M542 356v-30m27 30v-57m27 57v-42m27 42v-76m27 76v-24" /><text className="diagram-copy" x="537" y="378">Administrative view</text></Hotspot>
    <text className="diagram-caption" x="178" y="410">INTERFACE / STATES FROM SUPPLIED DESCRIPTION</text>
  </svg>

  if (variant === 'evoting-flow') return <svg className="project-diagram-svg diagram-voting" viewBox="0 0 720 430" aria-label={labels[variant]} role={interactive ? 'group' : 'img'} focusable="false">
    <text className="diagram-kicker" x="24" y="33">ELECTION DEMONSTRATION / NO REAL VOTER DATA</text>
    <Hotspot interactive detail={{ id: 'verification', title: 'Voter verification', detail: 'The described demonstration includes voter profiles, verification sessions, and OTP records.', technology: 'Verification records described', connection: 'Voter profile → ballot access concept.' }}><rect className="voting-verification" x="26" y="81" width="146" height="256" rx="5" /><circle className="voting-seal" cx="99" cy="135" r="35" /><path className="voting-check" d="M83 135l11 11 22-25" /><text className="diagram-kicker" x="47" y="198">VOTER CHECK</text><text className="diagram-title" x="43" y="225">VERIFICATION</text><text className="diagram-copy" x="44" y="249">Profile + session</text><text className="diagram-copy" x="44" y="268">OTP record described</text><rect className="voting-status" x="45" y="291" width="108" height="24" rx="12" /><text className="voting-status-text" x="63" y="307">DEMO CONCEPT</text></Hotspot>
    <path className="voting-connection" data-link-for="verification ballot" d="M172 209h35" />
    <Hotspot interactive detail={{ id: 'ballot', title: 'Ballot interface', detail: 'Candidates and votes are named entities in the described educational demonstration. The ballot here is illustrative.', technology: 'Candidate and vote records described', connection: 'Election setup → candidate list → vote record concept.' }}><rect className="voting-ballot" x="207" y="57" width="285" height="305" rx="5" /><path className="voting-ballot-top" d="M207 101h285" /><text className="diagram-kicker" x="229" y="83">BALLOT / ILLUSTRATIVE</text><text className="diagram-title" x="230" y="130">ELECTION RECORD</text><text className="diagram-copy" x="230" y="152">Constituency + candidates</text><rect className="voting-option" x="228" y="176" width="243" height="54" rx="4" /><circle className="voting-radio" cx="249" cy="203" r="8" /><text className="diagram-title" x="269" y="200">Candidate entry</text><text className="diagram-copy" x="269" y="216">Example option / no real person</text><rect className="voting-option" x="228" y="241" width="243" height="54" rx="4" /><circle className="voting-radio" cx="249" cy="268" r="8" /><text className="diagram-title" x="269" y="265">Candidate entry</text><text className="diagram-copy" x="269" y="281">Example option / no real person</text><rect className="voting-submit" x="228" y="316" width="243" height="30" rx="3" /><text className="voting-submit-text" x="294" y="336">DEMO SUBMISSION UI</text></Hotspot>
    <path className="voting-connection voting-connection-result" data-link-for="ballot result-processing" d="M492 209h39" />
    <Hotspot interactive detail={{ id: 'result-processing', title: 'Result and audit records', detail: 'Votes, audit logs, fraud logs, and notifications are named data entities. No security guarantee or actual election result is implied.', technology: 'SQLite / better-sqlite3 named in brief', connection: 'Vote record → demonstration result processing and audit entities.' }}><rect className="voting-results" x="531" y="81" width="163" height="256" rx="5" /><text className="diagram-kicker" x="548" y="108">RESULTS / DEMO</text><path className="voting-result-line" d="M549 125h126M549 170h126M549 215h126M549 260h126M549 305h126" /><text className="diagram-copy" x="549" y="151">Vote records</text><text className="diagram-copy" x="549" y="196">Audit logs</text><text className="diagram-copy" x="549" y="241">Fraud logs</text><text className="diagram-copy" x="549" y="286">Notifications</text><text className="voting-result-warning" x="549" y="325">NOT CERTIFIED</text></Hotspot>
    <text className="diagram-caption" x="24" y="397">EDUCATIONAL PORTAL DEMONSTRATION / NOT FOR REAL ELECTIONS</text>
  </svg>

  if (variant === 'routewise-flow') return <svg className="project-diagram-svg diagram-routewise" viewBox="0 0 720 430" aria-label={labels[variant]} role={interactive ? 'group' : 'img'} focusable="false">
    <rect className="route-shell" x="16" y="16" width="688" height="398" rx="4" /><path className="route-header" d="M16 61h688" /><text className="diagram-kicker" x="35" y="43">ROUTEWISE / TRIP PLANNER</text><text className="route-live-label" x="564" y="43">DEMO / DATA SOURCE UNCONFIRMED</text>
    <Hotspot interactive detail={{ id: 'route-input', title: 'Route search', detail: 'Origin/destination search and route/fare lookup are described. No real geographic route is depicted.', technology: 'Search workflow', connection: 'Route input → trip options.' }}><rect className="route-search-panel" x="32" y="78" width="205" height="78" rx="4" /><circle className="route-stop-dot" cx="50" cy="101" r="5" /><circle className="route-stop-dot route-stop-end" cx="50" cy="133" r="5" /><path className="route-search-line" d="M50 106v22" /><text className="diagram-copy" x="65" y="105">ORIGIN</text><text className="diagram-title" x="65" y="120">Start location</text><text className="diagram-copy" x="65" y="139">DESTINATION / End location</text></Hotspot>
    <path className="route-map-grid" d="M267 78h420M267 125h420M267 172h420M267 219h420M267 266h420M267 313h420M267 360h420M267 78v282M327 78v282M387 78v282M447 78v282M507 78v282M567 78v282M627 78v282M687 78v282" />
    <path className="route-line route-line-a" data-link-for="route-input route-options fare-option-a" d="M281 320Q337 286 350 221t73-42q52 0 70-66t92-3q30 24 67 9" /><path className="route-line route-line-b" data-link-for="route-input route-options fare-option-b" d="M281 320q67-7 94-72t88 22q35 47 73 1t66-34q31 13 50-28" />
    <Hotspot interactive detail={{ id: 'route-options', title: 'Schematic route alternatives', detail: 'Route options and fare comparison are part of the described demonstration. Lines are schematic, not mapped geography.', technology: 'Route/fare comparison UI', connection: 'Origin/destination → alternative trip options.' }}><circle className="route-stop" cx="281" cy="320" r="7" /><circle className="route-stop" cx="350" cy="221" r="5" /><circle className="route-stop" cx="423" cy="179" r="5" /><circle className="route-stop" cx="493" cy="113" r="5" /><circle className="route-stop" cx="583" cy="110" r="5" /><circle className="route-stop route-stop-end" cx="653" cy="119" r="7" /><text className="route-map-note" x="273" y="347">SCHEMATIC ONLY</text></Hotspot>
    <text className="diagram-kicker" x="32" y="195">COMPARE OPTIONS</text>
    <Hotspot interactive detail={{ id: 'fare-option-a', title: 'Fare option A', detail: 'An illustrative alternative for comparing trip options. Fare values depend on the project data and are not invented here.', technology: 'Fare comparison', connection: 'Route alternative → fare display.' }}><rect className="route-option route-option-a" x="32" y="209" width="205" height="70" rx="4" /><path className="route-option-mark" d="M49 232h28m-28 11h18" /><text className="diagram-title" x="91" y="234">OPTION A</text><text className="diagram-copy" x="91" y="253">Route + fare details</text><text className="route-fare-placeholder" x="175" y="269">FARE</text></Hotspot>
    <Hotspot interactive detail={{ id: 'fare-option-b', title: 'Fare option B', detail: 'A second illustrative alternative in the comparison layout. No price or live operator data is shown.', technology: 'Fare comparison', connection: 'Route alternative → fare display.' }}><rect className="route-option route-option-b" x="32" y="291" width="205" height="70" rx="4" /><path className="route-option-mark is-blue" d="M49 314h28m-28 11h18" /><text className="diagram-title" x="91" y="316">OPTION B</text><text className="diagram-copy" x="91" y="335">Route + fare details</text><text className="route-fare-placeholder" x="175" y="351">FARE</text></Hotspot>
    <text className="diagram-caption" x="32" y="390">TRIP / BOOKING FLOW DESCRIBED AS A DEMONSTRATION</text>
  </svg>

  if (variant === 'secret-file') return <svg className="project-diagram-svg diagram-secret" viewBox="0 0 720 430" aria-label={labels['secret-file']} role={interactive ? 'group' : 'img'} focusable="false">
    <path className="secret-backdrop-lines" d="M24 70h672M24 360h672M74 24v382M646 24v382" />
    <Hotspot interactive detail={{ id: 'project-identity', title: 'MySecretFile', detail: 'The project name is supplied, but its purpose and user workflow are not yet described.', connection: 'Additional project information awaits documentation.' }}><rect className="secret-file-sheet" x="194" y="69" width="330" height="290" rx="5" /><path className="secret-fold" d="M462 69v65h62" /><circle className="secret-mark" cx="359" cy="182" r="39" /><path className="secret-file-glyph" d="M349 164h20l10 10v27h-30zM369 164v11h10" /><text className="diagram-kicker" x="279" y="244">PROJECT / EXPERIMENTAL</text><text className="secret-title" x="258" y="281">MYSECRETFILE</text><path className="secret-rule" d="M250 300h218" /><text className="diagram-copy" x="284" y="326">FEATURES TO DOCUMENT</text></Hotspot>
    <Hotspot interactive detail={{ id: 'python-flask', title: 'Python / Flask', detail: 'Python and Flask are named as potential implementation technologies in the supplied brief. Their use in the current code awaits confirmation.', technology: 'Python · Flask (to verify)', connection: 'Project technology description → source documentation needed.' }}><rect className="secret-tech-chip" x="42" y="153" width="122" height="43" rx="21" /><text className="secret-tech-text" x="64" y="179">PYTHON</text><rect className="secret-tech-chip is-flask" x="556" y="153" width="122" height="43" rx="21" /><text className="secret-tech-text" x="580" y="179">FLASK?</text></Hotspot>
    <Hotspot interactive detail={{ id: 'scope', title: 'Scope awaiting documentation', detail: 'No encryption, authentication, storage, privacy, or security capability has been described, so the diagram makes no claims about them.', connection: 'Updated documentation will define this area.' }}><circle className="secret-scope-ring" cx="359" cy="382" r="5" /><text className="diagram-caption" x="300" y="405">SCOPE NOT YET SPECIFIED</text></Hotspot>
  </svg>

  return <svg className="project-diagram-svg diagram-overview" viewBox="0 0 720 430" aria-label={labels['system-overview']} role={interactive ? 'group' : 'img'} focusable="false">
    <rect className="overview-panel" x="90" y="72" width="540" height="286" rx="5" />
    <path className="overview-route" d="M160 216h400" /><circle className="overview-node" cx="160" cy="216" r="8" /><circle className="overview-node" cx="360" cy="216" r="8" /><circle className="overview-node" cx="560" cy="216" r="8" />
    <text className="diagram-kicker" x="126" y="147">PROJECT</text><text className="diagram-title" x="126" y="178">OVERVIEW</text><text className="diagram-copy" x="126" y="196">Details from the supplied project brief</text>
    <text className="diagram-caption" x="126" y="315">OPEN THE EXPLORER FOR PURPOSE, STATUS, AND TECHNOLOGIES</text>
  </svg>
}

function readHotspot(target: EventTarget | null): NodeDetail | null {
  if (!(target instanceof Element)) return null
  const node = target.closest<SVGGElement>('[data-visual-node="true"]')
  if (!node) return null
  return {
    id: node.dataset.nodeId ?? '',
    title: node.dataset.nodeTitle ?? 'Diagram element',
    detail: node.dataset.nodeDetail ?? '',
    technology: node.dataset.nodeTechnology || undefined,
    connection: node.dataset.nodeConnection || undefined,
  }
}

export default function ProjectVisualization({ variant, className = '', interactive = false }: ProjectVisualizationProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(rootRef, { amount: .05 })
  const reduceMotion = useReducedMotion()
  const [hovered, setHovered] = useState<NodeDetail | null>(null)
  const [selected, setSelected] = useState<NodeDetail | null>(null)

  const moveTooltip = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || event.pointerType !== 'mouse' || !tooltipRef.current) return
    const tip = tooltipRef.current
    const bounds = tooltipRef.current.getBoundingClientRect()
    const width = bounds.width || 270
    const height = bounds.height || 120
    const left = event.clientX + 18 + width > window.innerWidth ? event.clientX - width - 14 : event.clientX + 18
    const top = event.clientY + 18 + height > window.innerHeight ? event.clientY - height - 14 : event.clientY + 18
    tip.style.transform = `translate3d(${Math.max(8, left)}px, ${Math.max(8, top)}px, 0)`
  }, [interactive])

  const handlePointerOver = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || event.pointerType !== 'mouse') return
    const detail = readHotspot(event.target)
    if (detail) setHovered(detail)
  }
  const handlePointerOut = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || event.pointerType !== 'mouse') return
    const next = readHotspot(event.relatedTarget)
    if (next) { setHovered(next); return }
    setHovered(null)
  }
  const handleFocus = (event: ReactFocusEvent<HTMLDivElement>) => {
    if (!interactive) return
    const detail = readHotspot(event.target)
    if (detail) { setSelected(detail); setHovered(null) }
  }
  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!interactive) return
    const detail = readHotspot(event.target)
    if (detail) setSelected(detail)
  }
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return
    if (event.key === 'Escape') { setSelected(null); setHovered(null); return }
    if (event.key !== 'Enter' && event.key !== ' ') return
    const detail = readHotspot(event.target)
    if (detail) { event.preventDefault(); setSelected(detail) }
  }

  const activeVariant = variant ?? 'system-overview'
  const active = selected
  const classNames = ['project-visualization', `visual-${activeVariant}`, className, isInView ? 'is-in-view' : '', reduceMotion ? 'reduce-motion' : '', interactive ? 'is-interactive' : ''].filter(Boolean).join(' ')

  return <div
    ref={rootRef}
    className={classNames}
    aria-label={labels[activeVariant]}
    data-active-node={interactive ? hovered?.id ?? selected?.id : undefined}
    onPointerOver={handlePointerOver}
    onPointerOut={handlePointerOut}
    onPointerMove={moveTooltip}
    onFocusCapture={handleFocus}
    onClick={handleClick}
    onKeyDown={handleKeyDown}
  >
    <Diagram variant={activeVariant} interactive={interactive} />
    {interactive && <div className="diagram-inspector" aria-live="polite" aria-atomic="true">
      <div className="diagram-inspector-copy"><span className="diagram-inspector-kicker">{active ? 'SELECTED COMPONENT' : 'EXPLORE THE DIAGRAM'}</span><strong>{active?.title ?? 'Focus or tap a highlighted element'}</strong><p>{active?.detail ?? 'Each diagram element reveals its described role and relationships.'}</p>{active?.technology && <small>{active.technology}</small>}{active?.connection && <small>LINK / {active.connection}</small>}</div>
      {active && <button className="diagram-inspector-clear" type="button" onClick={() => setSelected(null)} aria-label="Clear selected diagram element">CLEAR</button>}
    </div>}
    {interactive && hovered && createPortal(<div ref={tooltipRef} className="diagram-cursor-tooltip" role="tooltip" aria-hidden="true"><span>{hovered.title}</span><p>{hovered.detail}</p>{hovered.technology && <small>{hovered.technology}</small>}</div>, document.body)}
  </div>
}
