import { statusColor, statusLabel, statusText } from '../status'
import type { TopicMeta, TopicValue } from '../types'
import { Icon } from './icons'
import { cardSummary } from './logic'

export function TopicCard({
  meta,
  value,
  selected,
  onClick,
}: {
  meta: TopicMeta
  value: TopicValue | undefined
  selected: boolean
  onClick: () => void
}) {
  const c = cardSummary(meta.key, value)
  const score = value?.score
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={`${meta.name} · ${statusLabel(score)}${score != null ? ` (${score}/100)` : ''}`}
      className={`flex w-full min-w-[112px] flex-col items-start gap-3 rounded-2xl border p-3 text-left transition-colors ${
        selected ? 'border-ink bg-ink text-white' : 'border-black/10 bg-white hover:border-black/30'
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${selected ? 'bg-white/15' : 'bg-panel'} ${statusText(score)}`}>
          <Icon name={meta.key} size={16} />
        </span>
        <span className="h-2 w-2 rounded-full" style={{ background: statusColor(score) }} />
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] opacity-70">{meta.short}</span>
        <span className="text-2xl font-light leading-none">{c.big}</span>
        <span className="mt-1 text-[10px] leading-tight opacity-60">{c.unit}</span>
      </div>
    </button>
  )
}
