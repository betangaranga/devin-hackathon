import type { Status } from './types'

export function status(score: number | null | undefined): Status | null {
  if (score == null) return null
  if (score >= 67) return 'bien'
  if (score >= 34) return 'regular'
  return 'atencion'
}

export const STATUS_LABEL: Record<Status, string> = { bien: 'Bien', regular: 'Regular', atencion: 'Atención' }
