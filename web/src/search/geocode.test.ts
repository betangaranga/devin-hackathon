import { describe, expect, it, vi } from 'vitest'
import addresses from '../../../fixtures/addresses.json'
import type { Address } from '../types'
import { createGeocoder, loadLocalIndex, nominatimUrl, normalize, parseNominatim, searchLocal, toAddress, type IndexEntry } from './geocode'

const known = addresses as Address[]
const index: IndexEntry[] = [
  { type: 'colonia', label: 'Roma Norte', lat: 19.419, lon: -99.162 },
  { type: 'colonia', label: 'Narvarte Poniente', lat: 19.396, lon: -99.156 },
  { type: 'cp', label: '06700', lat: 19.418, lon: -99.163 },
]

describe('searchLocal', () => {
  it('normalizes accents and case', () => {
    expect(normalize('  Álvaro   OBREGÓN ')).toBe('alvaro obregon')
  })
  it('finds fixture addresses by colonia', () => {
    expect(searchLocal('arboledas', known, [])[0].id).toBe('a')
  })
  it('finds colonias in the index', () => {
    const r = searchLocal('roma', known, index)
    expect(r[0]).toMatchObject({ kind: 'colonia', label: 'Roma Norte', colonia: 'Roma Norte' })
  })
  it('restricts numeric queries to CP entries and fixture CPs', () => {
    const r = searchLocal('067', known, index)
    expect(r.map((x) => x.kind).sort()).toEqual(['cp', 'direccion'])
  })
  it('returns nothing for empty query', () => {
    expect(searchLocal('  ', known, index)).toEqual([])
  })
})

describe('toAddress', () => {
  it('computes h3 at res 9 matching fixtures', () => {
    expect(toAddress({ label: 'x', lat: known[0].lat, lon: known[0].lon }).h3).toBe(known[0].h3)
  })
})

describe('loadLocalIndex', () => {
  it('tolerates 404 and network errors', async () => {
    expect(await loadLocalIndex('/x', (async () => new Response('', { status: 404 })) as typeof fetch)).toEqual([])
    expect(await loadLocalIndex('/x', (async () => { throw new Error('offline') }) as typeof fetch)).toEqual([])
  })
  it('drops malformed entries', async () => {
    const f = (async () => Response.json([...index, { type: 'x' }, { type: 'cp', label: 1 }])) as typeof fetch
    expect(await loadLocalIndex('/x', f)).toHaveLength(3)
  })
})

describe('Nominatim', () => {
  it('builds a bounded CDMX query', () => {
    const u = new URL(nominatimUrl('Orizaba 1'))
    expect(u.origin + u.pathname).toBe('https://nominatim.openstreetmap.org/search')
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ q: 'Orizaba 1', format: 'jsonv2', countrycodes: 'mx', bounded: '1', viewbox: '-99.37,19.6,-98.94,19.04' })
  })
  it('parses results and drops ones outside CDMX', () => {
    const r = parseNominatim([
      { place_id: 1, lat: '19.41', lon: '-99.16', display_name: 'Orizaba 1, Roma Norte, CDMX', address: { road: 'Orizaba', house_number: '1', neighbourhood: 'Roma Norte', postcode: '06700' } },
      { place_id: 2, lat: '20.5', lon: '-100', display_name: 'Querétaro' },
    ])
    expect(r).toEqual([expect.objectContaining({ id: 'osm:1', label: 'Orizaba 1, Roma Norte', colonia: 'Roma Norte', cp: '06700' })])
  })
  it('spaces requests at least 1 s apart and caches', async () => {
    vi.useFakeTimers()
    const calls: number[] = []
    const f = vi.fn(async () => {
      calls.push(Date.now())
      return Response.json([])
    }) as unknown as typeof fetch
    const geocode = createGeocoder(f)
    const p = Promise.all([geocode('uno'), geocode('dos'), geocode('tres')])
    await vi.runAllTimersAsync()
    await p
    expect(calls).toHaveLength(3)
    expect(calls[1] - calls[0]).toBeGreaterThanOrEqual(1000)
    expect(calls[2] - calls[1]).toBeGreaterThanOrEqual(1000)
    await geocode('UNO')
    expect(f).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })
})
