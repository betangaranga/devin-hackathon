import { useCallback, useEffect, useState } from 'react'
import { latLngToCell } from 'h3-js'
import type { Address, TopicKey } from '../types'
import { PROFILES, type ProfileKey } from '../profiles'
import { TOPIC_BY_KEY } from '../topics'

export interface ReportState {
  address: Address
  profile: ProfileKey
  topic: TopicKey
  compare: Address[]
}

const H3_RES = 9
const MAX_COMPARE = 3

const round = (n: number) => Number(n.toFixed(6))

function validCoord(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
}

function addressAt(lat: number, lon: number, label: string | null, known: Address[]): Address {
  const h3 = latLngToCell(lat, lon, H3_RES)
  const match = known.find((a) => a.h3 === h3 && (!label || a.label === label)) ?? (label ? undefined : known.find((a) => a.h3 === h3))
  if (match) return match
  return { id: `geo:${round(lat)},${round(lon)}`, label: label || `${round(lat)}, ${round(lon)}`, lat, lon, h3 }
}

function parsePair(s: string): [number, number] | null {
  const [a, b] = s.split(',').map((x) => Number(x.trim()))
  return validCoord(a, b) ? [a, b] : null
}

/** Reads `?lat&lon&label&perfil&tema&comparar=lat,lon;lat,lon`, falling back to `defaults` for missing/invalid values. */
export function parseReportState(search: string, defaults: ReportState, known: Address[] = []): ReportState {
  const p = new URLSearchParams(search)
  const lat = Number(p.get('lat'))
  const lon = Number(p.get('lon'))
  const address = p.has('lat') && p.has('lon') && validCoord(lat, lon) ? addressAt(lat, lon, p.get('label'), known) : defaults.address
  const perfil = p.get('perfil')
  const tema = p.get('tema')
  const comparar = p.get('comparar')
  const compare = comparar === null
    ? defaults.compare
    : comparar
        .split(';')
        .map(parsePair)
        .filter((x): x is [number, number] => x !== null)
        .slice(0, MAX_COMPARE)
        .map(([la, lo]) => addressAt(la, lo, null, known))
  return {
    address,
    profile: perfil && perfil in PROFILES ? (perfil as ProfileKey) : defaults.profile,
    topic: tema && tema in TOPIC_BY_KEY ? (tema as TopicKey) : defaults.topic,
    compare,
  }
}

/** Writes the report state into the query string of `base`, preserving unrelated params. */
export function buildReportUrl(state: ReportState, base: string): string {
  const u = new URL(base)
  u.hash = ''
  const p = u.searchParams
  p.set('lat', String(round(state.address.lat)))
  p.set('lon', String(round(state.address.lon)))
  p.set('label', state.address.label)
  p.set('perfil', state.profile)
  p.set('tema', state.topic)
  if (state.compare.length) p.set('comparar', state.compare.map((a) => `${round(a.lat)},${round(a.lon)}`).join(';'))
  else p.delete('comparar')
  return u.toString()
}

export function shareUrl(state: ReportState, base: string = window.location.href): string {
  return buildReportUrl(state, base)
}

export function shareText(state: ReportState, base?: string): string {
  return `Reporte "Antes de rentar" para ${state.address.label}: ${shareUrl(state, base)}`
}

export function whatsappLink(state: ReportState, base?: string): string {
  return `https://wa.me/?text=${encodeURIComponent(shareText(state, base))}`
}

/** Copies the share URL; resolves to false if the clipboard is unavailable or denied. */
export async function copyLink(state: ReportState, base?: string): Promise<boolean> {
  const url = shareUrl(state, base)
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return true
    }
  } catch {
    // fall through to legacy copy
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = url
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

/** Uses the Web Share API when available (mobile), otherwise copies the link. */
export async function nativeShare(state: ReportState): Promise<'shared' | 'copied' | 'failed'> {
  const url = shareUrl(state)
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Antes de rentar', text: `Reporte para ${state.address.label}`, url })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'failed'
    }
  }
  return (await copyLink(state)) ? 'copied' : 'failed'
}

/**
 * Report state synced with the URL. Initial value comes from the URL (or `defaults`);
 * updates replace the history entry and back/forward navigation re-reads the URL.
 */
export function useReportUrlState(defaults: ReportState, known: Address[] = []): [ReportState, (patch: Partial<ReportState>) => void] {
  const [state, setState] = useState<ReportState>(() => parseReportState(window.location.search, defaults, known))

  useEffect(() => {
    const next = buildReportUrl(state, window.location.href)
    if (next !== window.location.href) window.history.replaceState(window.history.state, '', next)
  }, [state])

  useEffect(() => {
    const onPop = () => setState(parseReportState(window.location.search, defaults, known))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // defaults/known are only used as fallbacks; re-subscribing on identity change is unnecessary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = useCallback((patch: Partial<ReportState>) => setState((s) => ({ ...s, ...patch })), [])
  return [state, update]
}
