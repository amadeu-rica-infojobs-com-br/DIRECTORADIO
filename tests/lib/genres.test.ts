// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { TAG_GENRE_SEED } from '@/catalog/seed/tag-genres'
import { genreLabel, GENRES, resolveGenre, type Genre } from '@/lib/genres'

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
      'religiosa',
      'latina',
      'country-folk',
      'hip-hop',
    ])
  })

  it('labels the new genres in Spanish', () => {
    expect(genreLabel('religiosa')).toBe('Religiosa')
    expect(genreLabel('latina')).toBe('Latina')
    expect(genreLabel('country-folk')).toBe('Country y folk')
    expect(genreLabel('hip-hop')).toBe('Hip hop')
  })
})

describe('TAG_GENRE_SEED', () => {
  const seed = new Map(Object.entries(TAG_GENRE_SEED)) as Map<string, Genre>

  it.each([
    [['christian', 'gospel'], 'religiosa'],
    [['regional mexicana'], 'latina'],
    [['folk'], 'country-folk'],
    [['rap'], 'hip-hop'],
    [['local news'], 'noticias'],
    [['music', 'radio'], 'variada'],
  ] as const)('maps %j to %s', (tags, genre) => {
    expect(resolveGenre([...tags], seed)).toBe(genre)
  })

  it('only holds normalized tags', () => {
    for (const tag of Object.keys(TAG_GENRE_SEED)) expect(tag).toBe(tag.trim().toLowerCase())
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
