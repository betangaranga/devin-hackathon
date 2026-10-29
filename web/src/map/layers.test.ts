import { cellToLatLng, gridDisk } from 'h3-js'
import { describe, expect, it } from 'vitest'
import fixtureCells from '../../../fixtures/cells.json'
import type { Cell, TopicKey } from '../types'
import {
  calloutStats,
  circlePolygon,
  haversineM,
  hexCollection,
  HEX_RING,
  hotspotRadius,
  isCellTopic,
  pmtilesUrl,
  pointCollection,
  rand01,
  synthHexScores,
  synthPatrimonioOutline,
  topicPoints,
} from './layers'

const cells = fixtureCells as Cell[]
const cell = cells[0]
const ALL: TopicKey[] = ['agua', 'inundacion', 'granizo', 'calor', 'sismo', 'vial', 'ruido', 'servicios', 'patrimonio']

describe('synthHexScores', () => {
  it('is deterministic, keeps the center score and stays in 0..100', () => {
    const a = synthHexScores(cell.h3, 41, 'vial')
    const b = synthHexScores(cell.h3, 41, 'vial')
    expect(a).toEqual(b)
    expect(a[cell.h3]).toBe(41)
    expect(Object.keys(a)).toHaveLength(gridDisk(cell.h3, HEX_RING).length)
    for (const v of Object.values(a)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })

  it('varies by topic and keeps neighbours close to the center score', () => {
    const vial = synthHexScores(cell.h3, 90, 'vial', 1)
    const agua = synthHexScores(cell.h3, 90, 'agua', 1)
    expect(vial).not.toEqual(agua)
    for (const v of Object.values(vial)) expect(Math.abs(v - 90)).toBeLessThan(30)
  })
})

describe('geometry', () => {
  it('hexCollection builds closed lon/lat polygons with score properties', () => {
    const f = hexCollection({ [cell.h3]: 50 }).features[0]
    expect(f.properties).toEqual({ h3: cell.h3, score: 50, raw: null })
    const ring = (f.geometry as { coordinates: [number, number][][] }).coordinates[0]
    const [lat, lon] = cellToLatLng(cell.h3)
    expect(Math.abs(ring[0][0] - lon)).toBeLessThan(0.01)
    expect(Math.abs(ring[0][1] - lat)).toBeLessThan(0.01)
  })

  it('circlePolygon is a closed ring 500 m from the center', () => {
    const ring = (circlePolygon(19.418, -99.165) as { coordinates: [number, number][][] }).coordinates[0]
    expect(ring[0]).toEqual(ring[ring.length - 1])
    for (const p of ring) expect(haversineM([-99.165, 19.418], p)).toBeCloseTo(500, 0)
  })

  it('synthPatrimonioOutline is a deterministic multipolygon', () => {
    const g = synthPatrimonioOutline(cell.h3)
    expect(g.type).toBe('MultiPolygon')
    expect(g).toEqual(synthPatrimonioOutline(cell.h3))
  })
})

describe('topicPoints', () => {
  it('extracts sismo, servicios and vial points from extra', () => {
    expect(topicPoints(cell, 'sismo')).toHaveLength(6)
    const svc = topicPoints(cell, 'servicios')
    expect(svc.map((p) => p.kind)).toEqual(['salud', 'escuela', 'mercado', 'transporte', 'ecobici', 'wifi'])
    expect(svc[0].minutes).toBe(6)
    const vial = topicPoints(cell, 'vial')
    expect(vial.map((p) => p.n)).toEqual([23, 11, 7])
    expect(topicPoints(cell, 'agua')).toEqual([])
    expect(topicPoints(null, 'sismo')).toEqual([])
  })

  it('maps unknown service kinds to "otro" and drops points without coordinates', () => {
    const c: Cell = {
      h3: cell.h3,
      topics: { servicios: { score: 1, raw: 1, label: null, extra: { nearest: [{ kind: 'banco', name: 'x', lat: 1, lon: 2 }, { kind: 'salud', name: 'y' }] } } },
    }
    expect(topicPoints(c, 'servicios')).toEqual([{ kind: 'otro', name: 'x', lat: 1, lon: 2, n: undefined, minutes: undefined, status: undefined }])
  })

  it('pointCollection uses [lon, lat]', () => {
    const f = pointCollection(topicPoints(cell, 'vial')).features[0]
    expect(f.geometry).toEqual({ type: 'Point', coordinates: [-99.162224, 19.415348] })
    expect(f.properties).toMatchObject({ kind: 'vial', n: 23 })
  })

  it('hotspotRadius grows with n', () => {
    expect(hotspotRadius(23)).toBeGreaterThan(hotspotRadius(7))
    expect(hotspotRadius(undefined)).toBe(8)
  })
})

describe('calloutStats', () => {
  it('returns 3 stats for every topic in every fixture cell', () => {
    for (const c of cells) for (const k of ALL) {
      const s = calloutStats(c, k)
      expect(s).toHaveLength(3)
      for (const st of s) expect(st.v.length).toBeGreaterThan(0)
    }
  })

  it('formats topic-specific values', () => {
    expect(calloutStats(cell, 'vial')).toEqual([
      { v: '84', l: 'incidentes / año' },
      { v: '1.2×', l: 'vs. promedio CDMX' },
      { v: '41', l: 'percentil CDMX' },
    ])
    expect(calloutStats(cell, 'agua')[1]).toEqual({ v: 'Mar', l: 'mes más crítico' })
    expect(calloutStats(cell, 'ruido')[1]).toEqual({ v: '–', l: 'en tu cuadra' })
    expect(calloutStats(cell, 'servicios').slice(0, 2)).toEqual([
      { v: '6/6', l: 'servicios a < 15 min' },
      { v: '9′', l: 'el más lejano' },
    ])
    expect(calloutStats(cell, 'patrimonio')).toEqual([
      { v: 'Sí', l: 'área de conservación' },
      { v: '12', l: 'catalogados < 300 m' },
      { v: '–', l: 'no puntúa' },
    ])
  })

  it('handles missing data', () => {
    expect(calloutStats(null, 'agua')).toEqual([{ v: '–', l: 'sin datos para esta zona' }])
  })
})

describe('misc', () => {
  it('rand01 is in [0, 1) and stable', () => {
    expect(rand01('a')).toBe(rand01('a'))
    expect(rand01('a')).not.toBe(rand01('b'))
    for (let i = 0; i < 100; i++) {
      const r = rand01(String(i))
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(1)
    }
  })

  it('isCellTopic matches contracts/layer.md', () => {
    expect(ALL.filter(isCellTopic)).toEqual(['agua', 'inundacion', 'granizo', 'calor', 'vial', 'ruido'])
  })

  it('pmtilesUrl joins BASE_URL', () => {
    expect(pmtilesUrl('/', 'agua')).toBe('/data/layers/agua.pmtiles')
    expect(pmtilesUrl('/app', 'vial', 'https://x.io')).toBe('https://x.io/app/data/layers/vial.pmtiles')
  })
})
