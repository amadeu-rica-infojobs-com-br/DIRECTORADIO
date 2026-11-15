// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { verifiedEmails } from '@/db/schema'
import { parseVoterCookie, readVoter, signVoterCookie } from '@/ratings/voter-cookie'
import { createTestDb } from '../helpers/db'

describe('parseVoterCookie', () => {
  it('round-trips a signed cookie', () => {
    expect(parseVoterCookie(signVoterCookie('a@b.es', 1000, 's'), 's')).toEqual({ email: 'a@b.es', issuedAt: 1000 })
  })

  it('rejects another secret, a tampered signature and garbage', () => {
    const value = signVoterCookie('a@b.es', 1000, 's')
    expect(parseVoterCookie(value, 'otro')).toBeNull()
    const last = value.at(-1) === 'A' ? 'B' : 'A'
    expect(parseVoterCookie(value.slice(0, -1) + last, 's')).toBeNull()
    expect(parseVoterCookie('basura', 's')).toBeNull()
    expect(parseVoterCookie(undefined, 's')).toBeNull()
  })
})

describe('readVoter', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    ctx ??= await createTestDb()
    await ctx.reset()
  })

  afterAll(async () => {
    await ctx?.close()
  })

  it('needs a verified email and a cookie issued after the first verification', async () => {
    const cookie = (at: number) => signVoterCookie('a@b.es', at, 's')
    expect(await readVoter(ctx.db, cookie(3000), 's')).toBeNull()
    await ctx.db.insert(verifiedEmails).values({
      email: 'a@b.es',
      firstVerifiedAt: new Date(2000),
      verifiedAt: new Date(2000),
      privacyAcceptedAt: new Date(2000),
    })
    expect(await readVoter(ctx.db, cookie(1000), 's')).toBeNull()
    expect(await readVoter(ctx.db, cookie(3000), 's')).toBe('a@b.es')
  })
})
