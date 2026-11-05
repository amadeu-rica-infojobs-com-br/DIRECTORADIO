import { describe, expect, it } from 'vitest'
import { tn } from '@/i18n'
import { genreLabel } from '@/lib/genres'

describe('tn', () => {
  it('uses the singular form for 1', () => {
    expect(tn('station.plays', 1)).toBe('1 reproducción')
  })

  it('uses the plural form for 0', () => {
    expect(tn('station.plays', 0)).toBe('0 reproducciones')
  })

  it('formats the count with es-ES grouping', () => {
    expect(tn('station.plays', 12450)).toBe('12.450 reproducciones')
  })

  it('keeps extra vars alongside the singular form', () => {
    expect(tn('station.ratings', 1, { avg: '4,0' })).toBe('4,0 (1 valoración)')
  })

  it('keeps extra vars alongside the plural form', () => {
    expect(tn('station.ratings', 3, { avg: '4,0' })).toBe('4,0 (3 valoraciones)')
  })
})

describe('genreLabel', () => {
  it('returns the Spanish label for a genre', () => {
    expect(genreLabel('electronica')).toBe('Electrónica')
  })
})
