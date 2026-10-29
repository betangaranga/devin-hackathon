import { latLngToCell } from 'h3-js'
import type { Address } from '../types'

export const H3_RES = 9

export type ResultKind = 'direccion' | 'colonia' | 'cp' | 'osm' | 'ubicacion'

export interface SearchResult {
  id: string
  kind: ResultKind
  label: string
  detail?: string
  lat: number
  lon: number
  colonia?: string
  cp?: string
}

export interface IndexEntry {
  type: 'colonia' | 'cp'
  label: string
  lat: number
  lon: number
}

// CDMX bounding box: [west, south, east, north]
export const CDMX_BBOX = [-99.37, 19.04, -98.94, 19.6] as const

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
export const NOMINATIM_DEBOUNCE_MS = 500
export const NOMINATIM_MIN_INTERVAL_MS = 1000

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function inCdmx(lat: number, lon: number): boolean {
  const [w, s, e, n] = CDMX_BBOX
  return lat >= s && lat <= n && lon >= w && lon <= e
}

export function toAddress(r: Pick<SearchResult, 'label' | 'lat' | 'lon' | 'colonia' | 'cp'> & { id?: string }): Address {
  const h3 = latLngToCell(r.lat, r.lon, H3_RES)
  return {
    id: r.id ?? `geo:${r.lat.toFixed(6)},${r.lon.toFixed(6)}`,
    label: r.label,
    lat: r.lat,
    lon: r.lon,
    h3,
    ...(r.colonia ? { colonia: r.colonia } : {}),
    ...(r.cp ? { cp: r.cp } : {}),
  }
}

function isIndexEntry(x: unknown): x is IndexEntry {
  const e = x as IndexEntry
  return !!e && (e.type === 'colonia' || e.type === 'cp') && typeof e.label === 'string' && Number.isFinite(e.lat) && Number.isFinite(e.lon)
}

export async function loadLocalIndex(url: string, fetchFn: typeof fetch = fetch): Promise<IndexEntry[]> {
  try {
    const r = await fetchFn(url)
    if (!r.ok) return []
    const data: unknown = await r.json()
    return Array.isArray(data) ? data.filter(isIndexEntry) : []
  } catch {
    return []
  }
}

function matchRank(haystack: string, q: string): number {
  if (!q) return -1
  if (haystack.startsWith(q)) return 0
  if (haystack.includes(` ${q}`)) return 1
  if (haystack.includes(q)) return 2
  const words = q.split(' ')
  return words.every((w) => haystack.includes(w)) ? 3 : -1
}

export function searchLocal(query: string, addresses: Address[], index: IndexEntry[], limit = 8): SearchResult[] {
  const q = normalize(query)
  if (!q) return []
  const scored: { r: SearchResult; rank: number }[] = []
  for (const a of addresses) {
    const rank = matchRank(normalize([a.label, a.colonia, a.cp].filter(Boolean).join(' ')), q)
    if (rank >= 0) {
      scored.push({ rank, r: { id: a.id, kind: 'direccion', label: a.label, detail: [a.colonia, a.cp && `CP ${a.cp}`].filter(Boolean).join(' · '), lat: a.lat, lon: a.lon, colonia: a.colonia, cp: a.cp } })
    }
  }
  const isCp = /^\d{1,5}$/.test(q)
  for (const e of index) {
    if (isCp && e.type !== 'cp') continue
    const rank = matchRank(normalize(e.label), q)
    if (rank >= 0) {
      scored.push({
        rank: rank + 0.5,
        r: {
          id: `${e.type}:${e.label}`,
          kind: e.type,
          label: e.type === 'cp' ? `CP ${e.label}` : e.label,
          detail: e.type === 'cp' ? 'Código postal' : 'Colonia',
          lat: e.lat,
          lon: e.lon,
          ...(e.type === 'cp' ? { cp: e.label } : { colonia: e.label }),
        },
      })
    }
  }
  return scored.sort((a, b) => a.rank - b.rank || a.r.label.localeCompare(b.r.label, 'es')).slice(0, limit).map((s) => s.r)
}

export function nominatimUrl(query: string, limit = 5): string {
  const [w, s, e, n] = CDMX_BBOX
  const u = new URL(NOMINATIM_URL)
  u.searchParams.set('q', query)
  u.searchParams.set('format', 'jsonv2')
  u.searchParams.set('countrycodes', 'mx')
  u.searchParams.set('viewbox', `${w},${n},${e},${s}`)
  u.searchParams.set('bounded', '1')
  u.searchParams.set('addressdetails', '1')
  u.searchParams.set('accept-language', 'es')
  u.searchParams.set('limit', String(limit))
  return u.toString()
}

interface NominatimItem {
  place_id: number
  lat: string
  lon: string
  display_name: string
  address?: Record<string, string>
}

export function parseNominatim(items: unknown): SearchResult[] {
  if (!Array.isArray(items)) return []
  const out: SearchResult[] = []
  for (const it of items as NominatimItem[]) {
    const lat = Number(it?.lat)
    const lon = Number(it?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inCdmx(lat, lon)) continue
    const a = it.address ?? {}
    const street = [a.road, a.house_number].filter(Boolean).join(' ')
    const colonia = a.neighbourhood ?? a.suburb ?? a.quarter
    const label = street ? [street, colonia].filter(Boolean).join(', ') : it.display_name.split(',').slice(0, 2).join(',').trim()
    out.push({
      id: `osm:${it.place_id}`,
      kind: 'osm',
      label,
      detail: it.display_name,
      lat,
      lon,
      ...(colonia ? { colonia } : {}),
      ...(a.postcode ? { cp: a.postcode } : {}),
    })
  }
  return out
}

/** Serializes requests so that at most one is sent per `minIntervalMs` (Nominatim usage policy). */
export function createGeocoder(fetchFn: typeof fetch = (...args) => fetch(...args), minIntervalMs = NOMINATIM_MIN_INTERVAL_MS, now: () => number = Date.now) {
  let last = -Infinity
  let chain: Promise<unknown> = Promise.resolve()
  const cache = new Map<string, SearchResult[]>()

  const wait = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      if (ms <= 0) return resolve()
      const t = setTimeout(resolve, ms)
      signal?.addEventListener('abort', () => {
        clearTimeout(t)
        reject(new DOMException('Aborted', 'AbortError'))
      }, { once: true })
    })

  return function geocode(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    const key = normalize(query)
    const hit = cache.get(key)
    if (hit) return Promise.resolve(hit)
    const run = async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      await wait(last + minIntervalMs - now(), signal)
      last = now()
      const r = await fetchFn(nominatimUrl(query), { signal, headers: { Accept: 'application/json' }, referrerPolicy: 'strict-origin-when-cross-origin' })
      if (!r.ok) throw new Error(`Nominatim ${r.status}`)
      const results = parseNominatim(await r.json())
      cache.set(key, results)
      return results
    }
    const p = chain.then(run, run)
    chain = p.catch(() => undefined)
    return p
  }
}
