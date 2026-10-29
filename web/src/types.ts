// Mirrors contracts/cell.schema.json and contracts/topics.md.
export type TopicKey = 'agua' | 'inundacion' | 'granizo' | 'calor' | 'sismo' | 'vial' | 'ruido' | 'servicios' | 'patrimonio'
export type ScoredTopicKey = Exclude<TopicKey, 'patrimonio'>

export interface TopicValue {
  score: number | null
  raw: number | null
  label: string | null
  extra: Record<string, unknown>
}

export interface Cell {
  h3: string
  colonia?: string | null
  cp?: string | null
  alcaldia?: string | null
  updated_at?: string
  topics: Partial<Record<TopicKey, TopicValue>>
}

export interface Address {
  id: string
  label: string
  colonia?: string
  cp?: string
  lat: number
  lon: number
  h3: string
}

export type Status = 'bien' | 'regular' | 'atencion'

export interface TopicMeta {
  key: TopicKey
  name: string
  short: string
  unit: string
  scored: boolean
  color: string
  order: number
  why: string
  ask: string[]
  source: string
  grain: string
}
