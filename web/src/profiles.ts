import type { Cell, ScoredTopicKey } from './types'
import { SCORED_TOPICS } from './topics'

export type ProfileKey = 'equilibrado' | 'familia' | 'homeoffice' | 'mayor' | 'sinauto'

export const PROFILES: Record<ProfileKey, { label: string; weights: Partial<Record<ScoredTopicKey, number>> }> = {
  equilibrado: { label: 'Equilibrado', weights: {} },
  familia: { label: 'Familia con niños', weights: { servicios: 2, vial: 2, agua: 1.5 } },
  homeoffice: { label: 'Trabajo en casa', weights: { ruido: 2.5, agua: 1.5, calor: 1.5 } },
  mayor: { label: 'Adulto mayor', weights: { servicios: 2, calor: 2, sismo: 1.5, vial: 1.5 } },
  sinauto: { label: 'Sin auto', weights: { servicios: 2.5, vial: 1.5, granizo: 0.3 } },
}

/** Weighted mean of available topic scores; topics without data are skipped. */
export function profileScore(cell: Cell, profile: ProfileKey): number | null {
  const w = PROFILES[profile].weights
  let num = 0
  let den = 0
  for (const t of SCORED_TOPICS) {
    const s = cell.topics[t.key]?.score
    if (s == null) continue
    const wt = w[t.key as ScoredTopicKey] ?? 1
    num += s * wt
    den += wt
  }
  return den ? Math.round(num / den) : null
}
