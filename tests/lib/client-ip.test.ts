import { describe, expect, it } from 'vitest'
import { clientIpFromHeaders } from '@/lib/client-ip'

describe('clientIpFromHeaders', () => {
  it('uses the first x-forwarded-for entry', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5')
  })

  it('falls back to x-real-ip', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
  })

  it('returns null without headers', () => {
    expect(clientIpFromHeaders(new Headers())).toBeNull()
  })
})
