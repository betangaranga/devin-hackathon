import { profileScore, type ProfileKey } from '../profiles'
import { statusColor } from '../status'
import { TOPIC_BY_KEY } from '../topics'
import type { Cell, TopicKey } from '../types'
import { petals, wedge } from './logic'

/** Radial chart: petal length = topic score, petal width = profile weight. */
export function Flower({
  cell,
  profile,
  size = 96,
  selected,
  onSelect,
  showScore = true,
}: {
  cell: Cell | null
  profile: ProfileKey
  size?: number
  selected?: TopicKey
  onSelect?: (k: TopicKey) => void
  showScore?: boolean
}) {
  const c = size / 2
  const r0 = size * 0.17
  const R = size * 0.48
  const score = cell ? profileScore(cell, profile) : null
  const gap = 1.4
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Puntaje ${score ?? 'sin datos'}`} className="shrink-0">
      {petals(cell, profile).map((p) => {
        const sel = selected === p.key
        const len = p.score == null ? 0 : r0 + ((R - r0) * Math.max(p.score, 6)) / 100
        return (
          <g key={p.key} onClick={onSelect ? () => onSelect(p.key) : undefined} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
            <title>{`${TOPIC_BY_KEY[p.key].short}: ${p.score ?? 'Sin datos'} · peso ×${p.weight}`}</title>
            <path
              d={wedge(c, r0, R, p.a1 + gap, p.a2 - gap)}
              fill={p.score == null ? 'none' : '#0b0b0c'}
              fillOpacity={0.06}
              stroke={p.score == null ? '#a3a3a3' : 'none'}
              strokeDasharray="2 2"
            />
            {p.score != null && (
              <path
                d={wedge(c, r0, len, p.a1 + gap, p.a2 - gap)}
                fill={statusColor(p.score)}
                fillOpacity={sel || !selected ? 0.9 : 0.55}
                stroke={sel ? '#0b0b0c' : 'none'}
                strokeWidth={1.5}
              />
            )}
          </g>
        )
      })}
      <circle cx={c} cy={c} r={R} fill="none" stroke="#0b0b0c" strokeOpacity={0.2} strokeDasharray="2 4" />
      {showScore && (
        <text x={c} y={c + size * 0.045} textAnchor="middle" fontSize={size * 0.15} fontWeight={600} fill={statusColor(score)}>
          {score ?? '–'}
        </text>
      )}
    </svg>
  )
}
