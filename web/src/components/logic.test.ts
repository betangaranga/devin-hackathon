import { describe, expect, it } from 'vitest'
import cells from '../../../fixtures/cells.json'
import type { Cell } from '../types'
import { cardSummary, matrixSize, maxWalk, monthLabels, seriesLabels, petals, seriesSummary, verdict, walkList, wedge } from './logic'

const [a, b, c] = cells as Cell[]

describe('cardSummary', () => {
  it('formats each topic like the prototype', () => {
    expect(cardSummary('agua', a.topics.agua)).toEqual({ big: '2.1', unit: 'reportes / 1k hab.' })
    expect(cardSummary('inundacion', a.topics.inundacion).big).toBe('3/4')
    expect(cardSummary('calor', a.topics.calor).big).toBe('17.9°')
    expect(cardSummary('vial', a.topics.vial).big).toBe('84')
    expect(cardSummary('servicios', a.topics.servicios).big).toBe('9′')
    expect(cardSummary('servicios', c.topics.servicios).big).toBe('22′')
  })
  it('shows Sin datos for missing topics', () => {
    expect(cardSummary('ruido', undefined)).toEqual({ big: '–', unit: 'Sin datos' })
    expect(cardSummary('agua', { score: null, raw: null, label: null, extra: {} }).unit).toBe('Sin datos')
    expect(cardSummary('servicios', { score: null, raw: null, label: null, extra: {} }).unit).toBe('Sin datos')
  })
})

describe('petals', () => {
  it('splits 360° by profile weight', () => {
    const eq = petals(a, 'equilibrado')
    expect(eq).toHaveLength(8)
    expect(eq.every((p) => Math.abs(p.a2 - p.a1 - 45) < 1e-9)).toBe(true)
    const fam = petals(a, 'familia')
    const span = (k: string) => fam.find((p) => p.key === k)!.a2 - fam.find((p) => p.key === k)!.a1
    expect(span('vial')).toBeCloseTo(2 * span('ruido'))
    expect(fam[fam.length - 1].a2).toBeCloseTo(360)
  })
  it('carries null score for missing topics', () => {
    const p = petals({ h3: 'x', topics: { agua: a.topics.agua } }, 'equilibrado')
    expect(p.find((x) => x.key === 'agua')!.score).toBe(78)
    expect(p.find((x) => x.key === 'vial')!.score).toBeNull()
  })
})

describe('helpers', () => {
  it('wedge returns a closed path', () => {
    expect(wedge(50, 10, 40, 0, 90)).toMatch(/^M.*Z$/)
  })
  it('verdict picks best and worst topics', () => {
    expect(verdict(a)).toEqual({ best: ['servicios a pie', 'abasto de agua'], worst: ['sismo y reconstrucción', 'lluvia intensa'] })
    expect(verdict({ h3: 'x', topics: {} })).toEqual({ best: [], worst: [] })
  })
  it('month labels end at updated_at month, or November by default', () => {
    expect(monthLabels('fixture')).toEqual(['Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov'])
    expect(monthLabels('2026-03-15').at(-1)).toBe('Mar')
    expect(seriesLabels(['2023-02', '2023-03', '2023-04'], '2026-10-29', 3)).toEqual(['Feb', 'Mar', 'Abr'])
    expect(seriesLabels(undefined, '2026-03-15').at(-1)).toBe('Mar')
    expect(monthLabels('2026-03-15')[0]).toBe('Abr')
  })
  it('series summary finds the peak month and ratio vs city', () => {
    const s = seriesSummary(c.topics.agua!.extra.monthly as number[], monthLabels(), c.topics.agua!.extra.city_monthly as number[])
    expect(s.peakLabel).toBe('Abr')
    expect(s.ratio).toBeCloseTo(14.8 / 5.5)
    expect(seriesSummary([1, 2], ['a', 'b']).ratio).toBeNull()
  })
  it('walk list includes missing services and sorts by minutes', () => {
    const list = walkList(c.topics.servicios)
    expect(list[0].kind).toBe('wifi')
    expect(list.at(-1)).toMatchObject({ kind: 'ecobici', minutes: null })
    expect(maxWalk(b.topics.servicios)).toBe(11)
  })
  it('matrix circles grow with score', () => {
    expect(matrixSize(100)).toBeGreaterThan(matrixSize(10))
    expect(matrixSize(null)).toBe(8)
  })
})
