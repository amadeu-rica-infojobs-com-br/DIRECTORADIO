// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { GENRES, resolveGenre } from '@/lib/genres'

describe('GENRES', () => {
  it('lists genres in priority order', () => {
    expect(GENRES).toEqual([
      'pop',
      'electronica',
      'rock',
      'jazz',
      'clasica',
      'variada',
      'noticias',
      'deportes',
      'generalista',
    ])
  })
})

describe('resolveGenre', () => {
  it('picks the genre with the most votes', () => {
    const map = new Map([
      ['news', 'noticias'],
      ['noticias', 'noticias'],
      ['rock', 'rock'],
    ] as const)
    expect(resolveGenre(['fado', 'news', 'noticias', 'rock'], new Map(map))).toBe('noticias')
  })

  it('breaks ties by GENRES priority order', () => {
    const map = new Map([
      ['rock', 'rock'],
      ['pop', 'pop'],
    ] as const)
    expect(resolveGenre(['rock', 'pop'], new Map(map))).toBe('pop')
  })

  it("returns 'variada' when no tag is mapped", () => {
    expect(resolveGenre(['fado'], new Map())).toBe('variada')
  })
})
