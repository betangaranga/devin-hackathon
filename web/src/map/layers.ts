import { cellsToMultiPolygon, cellToBoundary, gridDisk, gridDistance } from 'h3-js'
import type { Cell, TopicKey, TopicValue } from '../types'

// Pure helpers for CityMap (no maplibre/DOM imports so they run under vitest in node).

export const RADIUS_M = 500
export const HEX_RING = 7
export const CELL_TOPICS: readonly TopicKey[] = ['agua', 'inundacion', 'granizo', 'calor', 'ruido', 'vial']
export const isCellTopic = (k: TopicKey) => CELL_TOPICS.includes(k)

type Position = [number, number]
interface Feature<G, P> { type: 'Feature'; geometry: G; properties: P }
export interface FeatureCollection<G = Geometry, P = Record<string, unknown>> { type: 'FeatureCollection'; features: Feature<G, P>[] }
export type Geometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] }

const fc = <G, P>(features: Feature<G, P>[]): FeatureCollection<G, P> => ({ type: 'FeatureCollection', features })

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic value in [0, 1) for a string seed. */
export function rand01(seed: string): number {
  let t = (hashString(seed) + 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v))

/**
 * Plausible fixture-mode scores for the cells around `center`: the center keeps the real score and
 * neighbours drift towards the city median with distance, plus deterministic per-cell noise.
 */
export function synthHexScores(center: string, score: number, topic: string, ring = HEX_RING): Record<string, number> {
  const out: Record<string, number> = {}
  for (const h of gridDisk(center, ring)) {
    if (h === center) {
      out[h] = Math.round(clamp(score))
      continue
    }
    const d = gridDistance(center, h)
    const pull = Math.min(1, d / (ring + 2))
    const noise = (rand01(`${topic}:${h}`) - 0.5) * (18 + 4 * d)
    out[h] = Math.round(clamp(score * (1 - pull) + 50 * pull + noise))
  }
  return out
}

export type HexProps = { h3: string; score: number; raw: number | null }

export function hexCollection(scores: Record<string, number>): FeatureCollection<Geometry, HexProps> {
  return fc(
    Object.entries(scores).map(([h3, score]) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [cellToBoundary(h3, true) as Position[]] },
      properties: { h3, score, raw: null },
    })),
  )
}

/** Geodesic circle approximated as a polygon (enough precision at city scale). */
export function circlePolygon(lat: number, lon: number, radiusM = RADIUS_M, steps = 72): Geometry {
  const R = 6371008.8
  const d = radiusM / R
  const φ1 = (lat * Math.PI) / 180
  const λ1 = (lon * Math.PI) / 180
  const ring: Position[] = []
  for (let i = 0; i <= steps; i++) {
    const θ = (2 * Math.PI * (i % steps)) / steps
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ))
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2))
    ring.push([(λ2 * 180) / Math.PI, (φ2 * 180) / Math.PI])
  }
  return { type: 'Polygon', coordinates: [ring] }
}

export function haversineM(a: Position, b: Position): number {
  const R = 6371008.8
  const toRad = (x: number) => (x * Math.PI) / 180
  const dφ = toRad(b[1] - a[1])
  const dλ = toRad(b[0] - a[0])
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dλ / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Fixture-mode conservation-area outline: a deterministic blob of cells containing the address. */
export function synthPatrimonioOutline(center: string): Geometry {
  const disk = gridDisk(center, 2).filter((h) => h === center || rand01(`patrimonio:${h}`) > 0.25)
  const coordinates = cellsToMultiPolygon(disk, true) as Position[][][]
  return { type: 'MultiPolygon', coordinates }
}

export type PointKind = 'sismo' | 'vial' | 'salud' | 'escuela' | 'mercado' | 'transporte' | 'ecobici' | 'wifi' | 'otro'
export type MapPoint = { kind: PointKind; name: string; lat: number; lon: number; n?: number; minutes?: number; status?: string }

const SERVICE_KINDS = new Set<PointKind>(['salud', 'escuela', 'mercado', 'transporte', 'ecobici', 'wifi'])

function list(v: TopicValue | undefined, field: string): Record<string, unknown>[] {
  const x = v?.extra?.[field]
  return Array.isArray(x) ? (x as Record<string, unknown>[]) : []
}

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)

export function topicPoints(cell: Cell | null, topic: TopicKey): MapPoint[] {
  const v = cell?.topics[topic]
  const rows =
    topic === 'sismo' ? list(v, 'nearby') : topic === 'servicios' ? list(v, 'nearest') : topic === 'vial' ? list(v, 'hotspots') : []
  return rows
    .filter((r) => num(r.lat) != null && num(r.lon) != null)
    .map((r) => {
      const kind: PointKind =
        topic === 'servicios' ? (SERVICE_KINDS.has(r.kind as PointKind) ? (r.kind as PointKind) : 'otro') : (topic as 'sismo' | 'vial')
      return {
        kind,
        name: String(r.name ?? ''),
        lat: r.lat as number,
        lon: r.lon as number,
        n: num(r.n),
        minutes: num(r.minutes),
        status: typeof r.status === 'string' ? r.status : undefined,
      }
    })
}

export function pointCollection(points: MapPoint[]): FeatureCollection<Geometry, Omit<MapPoint, 'lat' | 'lon'>> {
  return fc(
    points.map(({ lat, lon, ...p }) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: p })),
  )
}

/** Circle radius in px for a vial hotspot with `n` incidents. */
export const hotspotRadius = (n: number | undefined) => Math.round(8 + Math.sqrt(Math.max(0, n ?? 0)) * 4)

export interface Stat { v: string; l: string }

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const nums = (x: unknown): number[] => (Array.isArray(x) ? x.filter((n): n is number => typeof n === 'number') : [])
const sum = (a: number[]) => a.reduce((s, n) => s + n, 0)
const fmt = (n: number, d = 1) => (Number.isInteger(n) ? String(n) : n.toFixed(d))

/** The 3 numbers shown in the black callout over the pin: main value, one extra stat, percentile. */
export function calloutStats(cell: Cell | null, topic: TopicKey): Stat[] {
  const v = cell?.topics[topic]
  if (!v) return [{ v: '–', l: 'sin datos para esta zona' }]
  const e = v.extra ?? {}
  const raw = v.raw
  const pct: Stat = v.score != null ? { v: `${v.score}`, l: 'percentil CDMX' } : { v: '–', l: 'no puntúa' }
  const main = (l: string, unit = ''): Stat => ({ v: raw != null ? `${fmt(raw)}${unit}` : '–', l })

  switch (topic) {
    case 'agua': {
      const m = nums(e.monthly)
      const city = nums(e.city_monthly)
      const extra: Stat =
        m.length && sum(city) > 0
          ? { v: `${(sum(m) / sum(city)).toFixed(1)}×`, l: 'vs. promedio CDMX' }
          : { v: '–', l: 'vs. promedio CDMX' }
      const peak = m.length ? MONTHS[m.indexOf(Math.max(...m))] : '–'
      return [main('reportes / 1k hab.'), m.length ? { v: peak, l: 'mes más crítico' } : extra, pct]
    }
    case 'inundacion':
      return [main('nivel de peligro', '/4'), { v: 'Jun–Sep', l: 'temporada' }, pct]
    case 'granizo':
      return [main('nivel de peligro', '/4'), { v: 'May–Ago', l: 'temporada' }, pct]
    case 'calor': {
      const lo = num(e.city_min)
      const hi = num(e.city_max)
      const extra: Stat = lo != null && hi != null ? { v: `${fmt(lo)}–${fmt(hi)}°`, l: 'rango CDMX' } : { v: '–', l: 'rango CDMX' }
      return [main('media anual', '°'), extra, pct]
    }
    case 'sismo':
      return [main('inmuebles dañados'), { v: `${RADIUS_M} m`, l: 'radio' }, pct]
    case 'vial': {
      const r = num(e.city_ratio)
      return [main('incidentes / año'), { v: r != null ? `${r.toFixed(1)}×` : '–', l: 'vs. promedio CDMX' }, pct]
    }
    case 'ruido': {
      const lvl = typeof e.level_label === 'string' ? e.level_label : null
      return [main('nivel de denuncias (0–2)'), { v: lvl ?? '–', l: 'en tu cuadra' }, pct]
    }
    case 'servicios': {
      const mins = list(v, 'nearest').map((s) => num(s.minutes)).filter((x): x is number => x != null)
      const near = mins.filter((m) => m <= 15).length
      return [
        { v: mins.length ? `${near}/${mins.length}` : '–', l: 'servicios a < 15 min' },
        { v: mins.length ? `${Math.max(...mins)}′` : '–', l: 'el más lejano' },
        pct,
      ]
    }
    case 'patrimonio': {
      const cat = num(e.catalogados_300m)
      return [
        { v: raw === 1 ? 'Sí' : raw === 0 ? 'No' : '–', l: 'área de conservación' },
        { v: cat != null ? `${cat}` : '–', l: 'catalogados < 300 m' },
        pct,
      ]
    }
  }
}

export const pmtilesUrl = (base: string, key: TopicKey, origin = '') => `${origin}${base.endsWith('/') ? base : `${base}/`}data/layers/${key}.pmtiles`
