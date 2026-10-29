import type { Status } from './types'

export function status(score: number | null | undefined): Status | null {
  if (score == null) return null
  if (score >= 67) return 'bien'
  if (score >= 34) return 'regular'
  return 'atencion'
}

export const STATUS_LABEL: Record<Status, string> = { bien: 'Bien', regular: 'Regular', atencion: 'Atención' }

/** Literal class names so Tailwind can see them (no `text-${st}` templates). */
export const STATUS_TEXT: Record<Status, string> = { bien: 'text-bien', regular: 'text-regular', atencion: 'text-atencion' }
export const STATUS_COLOR: Record<Status, string> = { bien: '#16a34a', regular: '#ea580c', atencion: '#dc2626' }
export const NO_DATA_COLOR = '#a3a3a3'

export function statusColor(score: number | null | undefined): string {
  const st = status(score)
  return st ? STATUS_COLOR[st] : NO_DATA_COLOR
}

export function statusText(score: number | null | undefined): string {
  const st = status(score)
  return st ? STATUS_TEXT[st] : 'text-neutral-400'
}

export function statusLabel(score: number | null | undefined): string {
  const st = status(score)
  return st ? STATUS_LABEL[st] : 'Sin datos'
}
