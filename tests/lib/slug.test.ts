// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { slugify, uniqueSlug } from '@/lib/slug'

describe('slugify', () => {
  it('slugifies plain names', () => {
    expect(slugify('Cadena SER')).toBe('cadena-ser')
  })

  it('removes diacritics and turns apostrophes into dashes', () => {
    expect(slugify("Ràdio Nacional d'Andorra")).toBe('radio-nacional-d-andorra')
  })

  it('returns empty string when nothing is ASCII', () => {
    expect(slugify('Радио Рекорд')).toBe('')
  })
})

describe('uniqueSlug', () => {
  it('falls back when slug is empty', async () => {
    await expect(uniqueSlug('', 'emisora-1a2b3c4d', async () => false)).resolves.toBe(
      'emisora-1a2b3c4d',
    )
  })

  it('appends the first free numeric suffix', async () => {
    const taken = new Set(['los-40', 'los-40-2'])
    await expect(uniqueSlug('los-40', 'x', async (s) => taken.has(s))).resolves.toBe('los-40-3')
  })
})
