import { cellToParent, gridDisk, latLngToCell } from 'h3-js'
import type { Address, Cell } from './types'
import fixtureCells from '../../fixtures/cells.json'
import fixtureAddresses from '../../fixtures/addresses.json'

export const SHARD_RES = 6
export const USE_FIXTURES = import.meta.env.VITE_DATA_SOURCE !== 'cells'

const shardCache = new Map<string, Promise<Record<string, Cell>>>()

function loadShard(parent: string): Promise<Record<string, Cell>> {
  if (!shardCache.has(parent)) {
    shardCache.set(parent, fetch(`${import.meta.env.BASE_URL}data/cells/${parent}.json`).then((r) => (r.ok ? r.json() : {})))
  }
  return shardCache.get(parent)!
}

export async function getCell(h3: string): Promise<Cell | null> {
  if (USE_FIXTURES) return (fixtureCells as Cell[]).find((c) => c.h3 === h3) ?? null
  const shard = await loadShard(cellToParent(h3, SHARD_RES))
  return shard[h3] ?? null
}

export async function getCellsAround(h3: string, ring: number): Promise<Record<string, Cell>> {
  const ids = gridDisk(h3, ring)
  const parents = [...new Set(ids.map((id) => cellToParent(id, SHARD_RES)))]
  const shards = await Promise.all(parents.map(loadShard))
  const all = Object.assign({}, ...shards) as Record<string, Cell>
  return Object.fromEntries(ids.filter((id) => all[id]).map((id) => [id, all[id]]))
}

const REAL_SAMPLES = [
  { id: 'roma', label: 'Roma Norte, Cuauhtémoc', lat: 19.4194, lon: -99.1617 },
  { id: 'coyoacan', label: 'Del Carmen, Coyoacán', lat: 19.3497, lon: -99.1617 },
  { id: 'iztapalapa', label: 'San Lorenzo Tezonco, Iztapalapa', lat: 19.3086, lon: -99.0659 },
].map((a) => ({ ...a, h3: latLngToCell(a.lat, a.lon, 9) }))

export const SAMPLE_ADDRESSES = (USE_FIXTURES ? fixtureAddresses : REAL_SAMPLES) as Address[]
