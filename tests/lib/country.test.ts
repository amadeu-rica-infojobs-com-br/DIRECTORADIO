// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { countryName, flagEmoji } from '@/lib/country'

describe('country helpers', () => {
  it('returns the Spanish name for a country code', () => {
    expect(countryName('ES')).toBe('España')
  })

  it('returns empty string for null', () => {
    expect(countryName(null)).toBe('')
  })

  it('builds the flag emoji from a country code', () => {
    expect(flagEmoji('ES')).toBe('🇪🇸')
  })

  it('returns empty flag for null', () => {
    expect(flagEmoji(null)).toBe('')
  })
})
