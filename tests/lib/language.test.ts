// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { languageName } from '@/lib/language'

describe('languageName', () => {
  it('names languages in Spanish with a capital letter', () => {
    expect(languageName('es')).toBe('Español')
    expect(languageName('ca')).toBe('Catalán')
  })

  it('returns an empty string for unknown codes', () => {
    expect(languageName('zz')).toBe('')
  })
})
