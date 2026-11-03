import type { CSSProperties } from 'react'

export type CircuitGraphicVariant = 'hero' | 'handoff' | 'project'

type CircuitGraphicProps = {
  variant: CircuitGraphicVariant
  className?: string
  style?: CSSProperties
}

const graphics: Record<CircuitGraphicVariant, { viewBox: string; paths: string[]; nodes: [number, number][] }> = {
  hero: {
    viewBox: '0 0 1440 760',
    paths: [
      'M0 182h145l52 52h92m-289 93h192l42 42h115',
      'M1440 142h-162l-54 54h-64m280 192h-180l-44 44h-104',
      'M102 760V641l67-67v-48m1126 234V624l-62-62v-58',
    ],
    nodes: [[289, 234], [157, 327], [1160, 196], [1096, 432], [169, 574], [1166, 562]],
  },
  handoff: {
    viewBox: '0 0 640 56',
    paths: ['M0 28h194l22-14h208l22 14h194', 'M320 14v28'],
    nodes: [[194, 28], [320, 14], [446, 28]],
  },
  project: {
    viewBox: '0 0 200 142',
    paths: [
      'M0 28h34l18 18h28',
      'M200 24h-28l-18 18h-26',
      'M18 142v-34l18-18h22',
      'M182 142v-27l-16-16h-20',
      'M82 46h40l18 18-18 19H80l-18-19z',
    ],
    nodes: [[34, 28], [80, 46], [120, 46], [54, 90], [146, 99], [182, 115]],
  },
}

export default function CircuitGraphic({ variant, className, style }: CircuitGraphicProps) {
  const graphic = graphics[variant]

  return (
    <svg
      className={className}
      style={style}
      viewBox={graphic.viewBox}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <g className="circuit-paths">
        {graphic.paths.map((path, index) => (
          <path className={index === 0 ? 'circuit-pulse' : undefined} d={path} key={path} />
        ))}
      </g>
      <g className="circuit-nodes">
        {graphic.nodes.map(([cx, cy], index) => (
          <circle className={index === 0 ? 'circuit-node circuit-node-emphasis' : 'circuit-node'} cx={cx} cy={cy} r={index === 0 ? 2.8 : 2} key={`${cx}-${cy}`} />
        ))}
      </g>
    </svg>
  )
}
