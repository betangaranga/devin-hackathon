import { describe, expect, it } from 'vitest'
import addresses from '../../../fixtures/addresses.json'
import type { Address } from '../types'
import { buildReportUrl, parseReportState, shareUrl, whatsappLink, type ReportState } from '.'

const known = addresses as Address[]
const defaults: ReportState = { address: known[0], profile: 'equilibrado', topic: 'vial', compare: [] }
const BASE = 'https://example.org/app/?utm=x'

describe('URL state', () => {
  it('falls back to defaults on empty query', () => {
    expect(parseReportState('', defaults, known)).toEqual(defaults)
  })

  it('round-trips through the URL', () => {
    const state: ReportState = { address: known[1], profile: 'familia', topic: 'agua', compare: [known[0], known[2]] }
    const url = buildReportUrl(state, BASE)
    const u = new URL(url)
    expect(u.searchParams.get('utm')).toBe('x')
    expect(u.searchParams.get('comparar')).toBe('19.418,-99.165;19.357,-99.065')
    expect(parseReportState(u.search, defaults, known)).toEqual(state)
  })

  it('builds an Address with h3 for unknown coordinates', () => {
    const s = parseReportState('?lat=19.4326&lon=-99.1332&label=Z%C3%B3calo', defaults, known)
    expect(s.address).toMatchObject({ label: 'Zócalo', lat: 19.4326, lon: -99.1332 })
    expect(s.address.h3).toMatch(/^89[0-9a-f]{13}$/)
  })

  it('ignores invalid perfil, tema and coordinates', () => {
    const s = parseReportState('?lat=abc&lon=1&perfil=nope&tema=xyz&comparar=1,2;bad;999,0', defaults, known)
    expect(s.address).toBe(defaults.address)
    expect(s.profile).toBe('equilibrado')
    expect(s.topic).toBe('vial')
    expect(s.compare).toHaveLength(1)
  })

  it('omits comparar when empty', () => {
    expect(new URL(buildReportUrl(defaults, 'https://e.org/?comparar=1,2')).searchParams.has('comparar')).toBe(false)
  })

  it('builds share and WhatsApp links', () => {
    expect(shareUrl(defaults, BASE)).toContain('perfil=equilibrado')
    const wa = whatsappLink(defaults, BASE)
    expect(wa.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(wa.split('text=')[1])).toContain(known[0].label)
  })
})
