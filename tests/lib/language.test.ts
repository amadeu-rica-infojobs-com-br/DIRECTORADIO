// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { canonicalLanguageCode, languageName } from '@/lib/language'

describe('languageName', () => {
  it('names languages in Spanish with a capital letter', () => {
    expect(languageName('es')).toBe('Español')
    expect(languageName('ca')).toBe('Catalán')
  })

  it('returns an empty string for unknown codes', () => {
    expect(languageName('zz')).toBe('')
  })
})

describe('canonicalLanguageCode', () => {
  it.each([
    ['spa', 'es'],
    ['eng', 'en'],
    ['ger', 'de'],
    ['deu', 'de'],
    ['cmn', 'zh'],
    ['chi', 'zh'],
    ['gre', 'el'],
    ['tl', 'fil'],
    ['tw', 'ak'],
    ['fat', 'ak'],
    ['es', 'es'],
    ['ca', 'ca'],
  ])('%s → %s', (code, canonical) => {
    expect(canonicalLanguageCode(code)).toBe(canonical)
  })

  it('keeps codes it does not know', () => {
    expect(canonicalLanguageCode('zz')).toBe('zz')
  })
})
