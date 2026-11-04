import { describe, expect, it } from 'vitest'
import { toSafeLogoUrl } from '@/lib/logo'

describe('toSafeLogoUrl', () => {
  it('keeps https urls', () => {
    expect(toSafeLogoUrl('https://example.com/a/logo.png?x=1')).toBe(
      'https://example.com/a/logo.png?x=1',
    )
  })

  it('rewrites http to https keeping host and path', () => {
    expect(toSafeLogoUrl('http://example.com/a/logo.png?x=1')).toBe(
      'https://example.com/a/logo.png?x=1',
    )
  })

  it('returns null for null, empty and garbage', () => {
    expect(toSafeLogoUrl(null)).toBeNull()
    expect(toSafeLogoUrl('')).toBeNull()
    expect(toSafeLogoUrl('not a url')).toBeNull()
  })

  it('returns null for non-http(s) schemes', () => {
    expect(toSafeLogoUrl('data:image/png;base64,AAAA')).toBeNull()
    expect(toSafeLogoUrl('javascript:alert(1)')).toBeNull()
    expect(toSafeLogoUrl('ftp://example.com/logo.png')).toBeNull()
  })
})
