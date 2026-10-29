import { describe, expect, it } from 'vitest'
import cells from '../../fixtures/cells.json'
import { profileScore } from './profiles'
import { TOPICS } from './topics'
import type { Cell } from './types'

describe('topics registry', () => {
  it('discovers all 9 topics in order', () => {
    expect(TOPICS.map((t) => t.key)).toEqual(['agua', 'inundacion', 'sismo', 'vial', 'ruido', 'calor', 'granizo', 'servicios', 'patrimonio'])
  })
})

describe('profileScore', () => {
  const [a] = cells as Cell[]
  it('matches the prototype balanced score', () => {
    expect(profileScore(a, 'equilibrado')).toBe(54)
  })
  it('skips topics without data', () => {
    expect(profileScore({ h3: 'x', topics: { agua: { score: 80, raw: 1, label: '', extra: {} } } }, 'familia')).toBe(80)
  })
})
