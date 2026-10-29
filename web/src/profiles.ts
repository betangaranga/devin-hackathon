import type { Cell, ScoredTopicKey } from './types'
import { SCORED_TOPICS } from './topics'

export type ProfileKey = 'equilibrado' | 'familia' | 'homeoffice' | 'mayor' | 'sinauto'

export const PROFILES: Record<ProfileKey, { label: string; short: string; weights: Partial<Record<ScoredTopicKey, number>> }> = {
  equilibrado: { label: 'Equilibrado', short: 'Equilibrado', weights: {} },
  familia: { label: 'Familia con niños', short: 'Familia', weights: { servicios: 2, vial: 2, agua: 1.5 } },
  homeoffice: { label: 'Trabajo en casa', short: 'Home office', weights: { ruido: 2.5, agua: 1.5, calor: 1.5 } },
  mayor: { label: 'Adulto mayor', short: 'Adulto mayor', weights: { servicios: 2, calor: 2, sismo: 1.5, vial: 1.5 } },
  sinauto: { label: 'Sin auto', short: 'Sin auto', weights: { servicios: 2.5, vial: 1.5, granizo: 0.3 } },
}

export const PROFILE_KEYS = Object.keys(PROFILES) as ProfileKey[]

export function isProfileKey(v: unknown): v is ProfileKey {
  return typeof v === 'string' && v in PROFILES
}

export function topicWeight(profile: ProfileKey, key: ScoredTopicKey): number {
  return PROFILES[profile].weights[key] ?? 1
}

/** Weighted mean of available topic scores; topics without data are skipped. */
export function profileScore(cell: Cell, profile: ProfileKey): number | null {
  let num = 0
  let den = 0
  for (const t of SCORED_TOPICS) {
    const s = cell.topics[t.key]?.score
    if (s == null) continue
    const wt = topicWeight(profile, t.key as ScoredTopicKey)
    num += s * wt
    den += wt
  }
  return den ? Math.round(num / den) : null
}
