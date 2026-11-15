// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { ratingAttempts, ratings, stations, verifiedEmails } from '@/db/schema'
import { recomputeStationRating } from '@/ratings/aggregate'
import { forgetEmail, pruneRatings } from '@/ratings/maintenance'
import { readVoter, signVoterCookie } from '@/ratings/voter-cookie'
import { createTestDb } from '../helpers/db'

const DAY = 24 * 3600_000
const NOW = new Date('2026-11-14T12:00:00Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms)

describe('ratings maintenance', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>
  let a: string
  let b: string

  beforeEach(async () => {
    ctx ??= await createTestDb()
    await ctx.reset()
    const rows = await ctx.db
      .insert(stations)
      .values([
        { slug: 'a', name: 'A', streamUrl: 'http://x/a', source: 'test', externalId: 'a' },
        { slug: 'b', name: 'B', streamUrl: 'http://x/b', source: 'test', externalId: 'b' },
      ])
      .returning({ id: stations.id })
    ;[a, b] = rows.map((r) => r.id)
  })

  afterAll(async () => {
    await ctx?.close()
  })

  const vote = (stationId: string, email: string, status: 'pending' | 'verified', createdAt: Date, stars = 4) => ({
    stationId,
    email,
    stars,
    status,
    privacyAcceptedAt: createdAt,
    ipHash: 'ip',
    createdAt,
    updatedAt: createdAt,
  })

  it('prunes old pending votes and attempts and clears old ip hashes', async () => {
    await ctx.db.insert(ratings).values([
      vote(a, 'old@x.es', 'pending', ago(8 * DAY)),
      vote(a, 'new@x.es', 'pending', ago(6 * DAY)),
      vote(b, 'kept@x.es', 'verified', ago(40 * DAY)),
      vote(b, 'recent@x.es', 'verified', ago(10 * DAY)),
    ])
    await ctx.db.insert(ratingAttempts).values([
      { ipHash: 'ip', email: 'x@x.es', createdAt: ago(49 * 3600_000) },
      { ipHash: 'ip', email: 'y@x.es', createdAt: ago(47 * 3600_000) },
    ])
    expect(await pruneRatings(ctx.db, NOW)).toEqual({ pendingDeleted: 1, attemptsDeleted: 1, ipHashesCleared: 1 })
    const left = await ctx.db.select({ email: ratings.email, ipHash: ratings.ipHash }).from(ratings)
    expect(left.map((r) => r.email).sort()).toEqual(['kept@x.es', 'new@x.es', 'recent@x.es'])
    expect(left.find((r) => r.email === 'kept@x.es')?.ipHash).toBeNull()
    expect(left.find((r) => r.email === 'recent@x.es')?.ipHash).toBe('ip')
  })

  it('forgets an email everywhere, recomputes averages and invalidates old cookies', async () => {
    await ctx.db.insert(ratings).values([
      vote(a, 'ana@mail.com', 'verified', NOW, 5),
      vote(b, 'ana@mail.com', 'verified', NOW, 1),
      vote(a, 'otro@mail.com', 'verified', NOW, 3),
    ])
    await recomputeStationRating(ctx.db, a)
    await recomputeStationRating(ctx.db, b)
    await ctx.db.insert(ratingAttempts).values({ ipHash: 'ip', email: 'ana@mail.com' })
    await ctx.db.insert(verifiedEmails).values({ email: 'ana@mail.com', firstVerifiedAt: ago(DAY), verifiedAt: ago(DAY), privacyAcceptedAt: ago(DAY) })
    const cookie = signVoterCookie('ana@mail.com', NOW.getTime(), 's')
    expect(await readVoter(ctx.db, cookie, 's')).toBe('ana@mail.com')

    expect(await forgetEmail(ctx.db, ' Ana@Mail.com ')).toEqual({ ratings: 2, attempts: 1, verifiedEmail: true, stations: 2 })

    const left = await ctx.db.select({ email: ratings.email }).from(ratings)
    expect(left).toEqual([{ email: 'otro@mail.com' }])
    const rating = async (id: string) =>
      (await ctx.db.select({ avg: stations.ratingAvg, count: stations.ratingCount }).from(stations).where(eq(stations.id, id)))[0]
    expect(await rating(a)).toEqual({ avg: '3.00', count: 1 })
    expect(await rating(b)).toEqual({ avg: '0.00', count: 0 })
    expect(await readVoter(ctx.db, cookie, 's')).toBeNull()
  })
})
