// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildFilterLists, matchesQuery } from '@/components/search/filter-lists'

describe('buildFilterLists', () => {
  it('names, sorts and keeps the current value even if missing from the options', () => {
    const lists = buildFilterLists({ countries: ['PT', 'ES'], languages: ['es'], genres: ['rock'] }, { country: 'FR' })
    expect(lists.country.map((o) => o.label)).toEqual(['España', 'Francia', 'Portugal'])
    expect(lists.language).toEqual([{ value: 'es', label: 'Español' }])
    expect(lists.genre).toEqual([{ value: 'rock', label: 'Rock' }])
  })
})

describe('matchesQuery', () => {
  it.each([
    ['Portugués', 'portugues', true],
    ['España', 'ESPAÑ', true],
    ['Francia', 'port', false],
    ['X', '  ', true],
  ] as const)('%s ~ %j → %s', (label, query, expected) => {
    expect(matchesQuery(label, query)).toBe(expected)
  })
})
