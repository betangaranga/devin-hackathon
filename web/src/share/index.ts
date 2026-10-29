import type { Address, TopicKey } from '../types'
import type { ProfileKey } from '../profiles'

export interface ReportState {
  address: Address
  profile: ProfileKey
  topic: TopicKey
  compare: Address[]
}

// Phase-0 stub; F3 implements URL state (?lat&lon&perfil&tema&comparar) and sharing.
export function shareUrl(state: ReportState): string {
  const u = new URL(window.location.href)
  u.searchParams.set('lat', String(state.address.lat))
  u.searchParams.set('lon', String(state.address.lon))
  u.searchParams.set('perfil', state.profile)
  u.searchParams.set('tema', state.topic)
  return u.toString()
}

export function whatsappLink(state: ReportState): string {
  return `https://wa.me/?text=${encodeURIComponent(`Reporte "Antes de rentar": ${shareUrl(state)}`)}`
}
