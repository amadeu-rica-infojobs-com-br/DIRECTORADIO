// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { ratings, stations, verifiedEmails } from '@/db/schema'
import { confirmRating } from '@/ratings/confirm'
import { newToken } from '@/ratings/token'
import { createTestDb } from '../helpers/db'

describe('confirmRating', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>
  let stationId: string

  beforeEach(async () => {
    ctx ??= await createTestDb()
    await ctx.reset()
    const [s] = await ctx.db
      .insert(stations)
      .values({ slug: 'radio-a', name: 'Radio A', streamUrl: 'http://x/a', source: 'test', externalId: 'a' })
      .returning({ id: stations.id })
    stationId = s.id
  })

  afterAll(async () => {
    await ctx?.close()
  })

  async function pending(stars: number, now = new Date()) {
    const { token, hash } = newToken()
    await ctx.db.insert(ratings).values({
      stationId,
      email: 'ana@mail.com',
      stars,
      status: 'pending',
      tokenHash: hash,
      tokenExpiresAt: new Date(now.getTime() + 24 * 3600_000),
      privacyAcceptedAt: now,
    })
    return token
  }

  const rating = async () =>
    (await ctx.db.select({ avg: stations.ratingAvg, count: stations.ratingCount }).from(stations).where(eq(stations.id, stationId)))[0]

  it('verifies a pending vote, records the email and updates the average', async () => {
    const token = await pending(4)
    expect(await confirmRating(ctx.db, token)).toEqual({
      status: 'confirmed',
      email: 'ana@mail.com',
      stationSlug: 'radio-a',
      stationName: 'Radio A',
    })
    const [row] = await ctx.db.select().from(ratings)
    expect(row).toMatchObject({ status: 'verified', tokenHash: null, tokenExpiresAt: null })
    expect(await rating()).toEqual({ avg: '4.00', count: 1 })
    const [ve] = await ctx.db.select().from(verifiedEmails)
    expect(ve.email).toBe('ana@mail.com')
  })

  it('accepts a token only once', async () => {
    const token = await pending(4)
    await confirmRating(ctx.db, token)
    expect(await confirmRating(ctx.db, token)).toEqual({ status: 'invalid' })
  })

  it('rejects expired, unknown and non-string tokens', async () => {
    const token = await pending(4)
    expect(await confirmRating(ctx.db, token, new Date(Date.now() + 25 * 3600_000))).toEqual({ status: 'invalid' })
    expect(await confirmRating(ctx.db, 'desconocido')).toEqual({ status: 'invalid' })
    expect(await confirmRating(ctx.db, undefined)).toEqual({ status: 'invalid' })
  })

  it('replaces the previous verified vote and keeps the first verification date', async () => {
    await confirmRating(ctx.db, await pending(2))
    const [first] = await ctx.db.select().from(verifiedEmails)
    await confirmRating(ctx.db, await pending(5))
    const rows = await ctx.db.select().from(ratings)
    expect(rows).toHaveLength(1)
    expect(rows[0].stars).toBe(5)
    expect(await rating()).toEqual({ avg: '5.00', count: 1 })
    const [again] = await ctx.db.select().from(verifiedEmails)
    expect(again.firstVerifiedAt).toEqual(first.firstVerifiedAt)
  })
})
