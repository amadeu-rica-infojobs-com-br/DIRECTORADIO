// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { normalizeEmail } from '@/ratings/email'
import { hashToken, newToken } from '@/ratings/token'

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Ana@Mail.COM ')).toBe('ana@mail.com')
  })

  it.each(['sin-arroba', '', 42, null, `${'a'.repeat(250)}@b.es`])('rejects %j', (raw) => {
    expect(normalizeEmail(raw)).toBeNull()
  })
})

describe('tokens', () => {
  it('creates a 32-byte base64url token and its SHA-256 hash', () => {
    const { token, hash } = newToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken(token)).toBe(hash)
    expect(newToken().token).not.toBe(token)
  })
})
