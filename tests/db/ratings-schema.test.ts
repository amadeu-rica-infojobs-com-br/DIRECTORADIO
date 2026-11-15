// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { ratings, stations } from '@/db/schema'
import { createTestDb } from '../helpers/db'

describe('ratings schema', () => {
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

  const vote = (extra: Partial<typeof ratings.$inferInsert> = {}) => ({
    stationId,
    email: 'ana@mail.com',
    stars: 4,
    status: 'pending' as const,
    privacyAcceptedAt: new Date(),
    ...extra,
  })

  it('stores and reads a rating', async () => {
    await ctx.db.insert(ratings).values(vote())
    const [row] = await ctx.db.select().from(ratings)
    expect(row.stars).toBe(4)
    expect(row.status).toBe('pending')
  })

  it.each([0, 6])('rejects %i stars', async (stars) => {
    // Drizzle envuelve el error de Postgres: la restricción violada está en cause.
    await expect(ctx.db.insert(ratings).values(vote({ stars }))).rejects.toMatchObject({
      cause: { constraint_name: 'ratings_stars_check' },
    })
  })

  it('allows one pending and one verified vote per email and station', async () => {
    await ctx.db.insert(ratings).values(vote())
    await ctx.db.insert(ratings).values(vote({ status: 'verified' }))
    await expect(ctx.db.insert(ratings).values(vote())).rejects.toThrow()
  })

  it('deletes ratings with their station', async () => {
    await ctx.db.insert(ratings).values(vote())
    await ctx.db.delete(stations).where(eq(stations.id, stationId))
    expect(await ctx.db.select().from(ratings)).toHaveLength(0)
  })
})
