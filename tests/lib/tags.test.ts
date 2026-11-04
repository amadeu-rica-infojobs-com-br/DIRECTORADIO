// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { normalizeTags } from '@/lib/tags'

describe('normalizeTags', () => {
  it('splits, trims, lowercases, collapses spaces, drops empties and duplicates', () => {
    expect(normalizeTags(' Pop, top 40 ,POP,,  news  talk ')).toEqual([
      'pop',
      'top 40',
      'news talk',
    ])
  })

  it('returns [] for null', () => {
    expect(normalizeTags(null)).toEqual([])
  })
})
