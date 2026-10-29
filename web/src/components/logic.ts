import { topicWeight, type ProfileKey } from '../profiles'
import { SCORED_TOPICS, TOPIC_BY_KEY } from '../topics'
import type { Cell, ScoredTopicKey, TopicKey, TopicValue } from '../types'

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
/** Prototype default when the cell has no parseable `updated_at` (12 months ending in November). */
const DEFAULT_LAST_MONTH = 10

export function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function numArray(v: unknown): number[] | null {
  return Array.isArray(v) && v.length > 0 && v.every((x) => num(x) != null) ? (v as number[]) : null
}

export function objArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as T[]) : []
}

/** Labels for a 12-month series that ends in the month of `updatedAt` (or the month before when unknown). */
export function monthLabels(updatedAt?: string | null, n = 12): string[] {
  const d = updatedAt ? new Date(updatedAt) : null
  const last = d && !Number.isNaN(d.getTime()) ? d.getUTCMonth() : DEFAULT_LAST_MONTH
  return Array.from({ length: n }, (_, i) => MONTH_NAMES[(((last - n + 1 + i) % 12) + 12) % 12])
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export interface ServiceItem {
  kind: string
  name: string
  minutes: number | null
  lat?: number
  lon?: number
}

export function services(v: TopicValue | undefined): ServiceItem[] {
  return objArray<ServiceItem>(v?.extra?.nearest)
}

export function maxWalk(v: TopicValue | undefined): number | null {
  const mins = services(v).map((s) => num(s.minutes)).filter((m): m is number => m != null)
  return mins.length ? Math.max(...mins) : null
}

const fmt = (x: number, digits = 1) => (Number.isInteger(x) ? String(x) : x.toFixed(digits))

/** Big number + unit shown on each topic card. */
export function cardSummary(key: TopicKey, v: TopicValue | undefined): { big: string; unit: string } {
  const raw = num(v?.raw)
  if (!v || (raw == null && key !== 'servicios')) return { big: '–', unit: 'Sin datos' }
  switch (key) {
    case 'agua':
      return { big: fmt(raw!), unit: 'reportes / 1k hab.' }
    case 'inundacion':
    case 'granizo':
      return { big: `${fmt(raw!, 0)}/4`, unit: 'nivel de peligro' }
    case 'sismo':
      return { big: fmt(raw!, 0), unit: 'edif. en reconstrucción' }
    case 'vial':
      return { big: fmt(raw!, 0), unit: 'incidentes / año' }
    case 'ruido':
      return { big: fmt(raw!, 0), unit: 'dB de día' }
    case 'calor':
      return { big: `${fmt(raw!)}°`, unit: 'media anual' }
    case 'servicios': {
      const m = maxWalk(v) ?? raw
      return m == null ? { big: '–', unit: 'Sin datos' } : { big: `${fmt(m, 0)}′`, unit: 'máx. a pie' }
    }
    case 'patrimonio':
      return { big: raw ? 'Sí' : 'No', unit: 'zona patrimonial' }
  }
}

export interface Petal {
  key: ScoredTopicKey
  a1: number
  a2: number
  mid: number
  weight: number
  score: number | null
}

/** Flower petals: angular width proportional to the profile weight, one per scored topic. */
export function petals(cell: Cell | null, profile: ProfileKey): Petal[] {
  const keys = SCORED_TOPICS.map((t) => t.key as ScoredTopicKey)
  const ws = keys.map((k) => topicWeight(profile, k))
  const tot = sum(ws)
  let a = 0
  return keys.map((key, i) => {
    const span = (360 * ws[i]) / tot
    const p = { key, a1: a, a2: a + span, mid: a + span / 2, weight: ws[i], score: cell?.topics[key]?.score ?? null }
    a += span
    return p
  })
}

export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

/** SVG path for an annular wedge between radii r0..r1 and angles a1..a2 (degrees, clockwise from north). */
export function wedge(c: number, r0: number, r1: number, a1: number, a2: number): string {
  const large = a2 - a1 > 180 ? 1 : 0
  const [x1, y1] = polar(c, c, r0, a1)
  const [x2, y2] = polar(c, c, r1, a1)
  const [x3, y3] = polar(c, c, r1, a2)
  const [x4, y4] = polar(c, c, r0, a2)
  const r = (x: number) => Math.round(x * 100) / 100
  return `M${r(x1)},${r(y1)} L${r(x2)},${r(y2)} A${r1},${r1} 0 ${large} 1 ${r(x3)},${r(y3)} L${r(x4)},${r(y4)} A${r0},${r0} 0 ${large} 0 ${r(x1)},${r(y1)} Z`
}

/** Two strongest (score ≥ 67) and two weakest (score < 50) topics. */
export function verdict(cell: Cell): { best: string[]; worst: string[] } {
  const scored = SCORED_TOPICS.map((t) => ({ t, s: cell.topics[t.key]?.score })).filter(
    (x): x is { t: (typeof SCORED_TOPICS)[number]; s: number } => x.s != null,
  )
  scored.sort((a, b) => a.s - b.s)
  const worst = scored.slice(0, 2).filter((x) => x.s < 50).map((x) => x.t.name.toLowerCase())
  const best = scored.slice(-2).reverse().filter((x) => x.s >= 67).map((x) => x.t.name.toLowerCase())
  return { best, worst }
}

/** Diameter (px) of a Comparar matrix circle. */
export function matrixSize(score: number | null | undefined): number {
  return score == null ? 8 : Math.round(8 + score / 4)
}

export const topicName = (k: TopicKey) => TOPIC_BY_KEY[k]?.name ?? k

/** Month label of the series peak and the ratio of totals vs. a reference series. */
export function seriesSummary(series: number[], labels: string[], reference?: number[] | null) {
  const peak = series.indexOf(Math.max(...series))
  const ref = reference && reference.length === series.length ? sum(reference) : 0
  return { peakLabel: labels[peak] ?? '', ratio: ref > 0 ? sum(series) / ref : null }
}

export const SERVICE_LABEL: Record<string, string> = {
  salud: 'Centro de salud',
  escuela: 'Escuela pública',
  mercado: 'Mercado',
  transporte: 'Metro / Metrobús',
  ecobici: 'Ecobici',
  wifi: 'WiFi gratuito',
}

export const SERVICE_KINDS = Object.keys(SERVICE_LABEL)

/** One row per expected service kind (missing kinds → minutes null), sorted by walking time. */
export function walkList(v: TopicValue | undefined): ServiceItem[] {
  const got = services(v)
  const kinds = [...new Set([...SERVICE_KINDS, ...got.map((s) => s.kind)])]
  return kinds
    .map((kind) => got.find((s) => s.kind === kind) ?? { kind, name: SERVICE_LABEL[kind] ?? kind, minutes: null })
    .sort((a, b) => (num(a.minutes) ?? Infinity) - (num(b.minutes) ?? Infinity))
}

export const HAZARD_LEVELS = ['Bajo', 'Medio', 'Medio-alto', 'Alto']
