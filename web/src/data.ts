import { cellToParent } from 'h3-js'
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

export const SAMPLE_ADDRESSES = fixtureAddresses as Address[]
