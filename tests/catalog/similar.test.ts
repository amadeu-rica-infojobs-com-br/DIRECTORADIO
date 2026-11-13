// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { HEALTH_HIDE_THRESHOLD } from '@/catalog/constants'
import { getSimilarStations } from '@/catalog/similar'
import { stations, stationTags, tags } from '@/db/schema'
import { createTestDb } from '../helpers/db'

describe('getSimilarStations', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    ctx ??= await createTestDb()
    await ctx.reset()
  })

  afterAll(async () => {
    await ctx?.close()
  })

  let n = 0
  async function add(
    name: string,
    extra: Partial<typeof stations.$inferInsert> = {},
    tagNames: string[] = [],
  ): Promise<string> {
    n++
    const [row] = await ctx.db
      .insert(stations)
      .values({ slug: `s-${n}`, name, streamUrl: `http://x/${n}`, source: 'test', externalId: `e-${n}`, ...extra })
      .returning({ id: stations.id })
    for (const t of tagNames) {
      await ctx.db.insert(tags).values({ name: t }).onConflictDoNothing()
      const [tag] = await ctx.db.select({ id: tags.id }).from(tags).where(eq(tags.name, t))
      await ctx.db.insert(stationTags).values({ stationId: row.id, tagId: tag.id })
    }
    return row.id
  }

  const similarNames = async (id: string, limit?: number) =>
    (await getSimilarStations(ctx.db, id, limit)).map((s) => s.name)

  it('ranks shared tags, then genre, then country', async () => {
    const me = await add('Me', { genre: 'rock', countryCode: 'ES' }, ['classic rock', '80s'])
    await add('Rock ES tag', { genre: 'rock', countryCode: 'ES' }, ['classic rock'])
    await add('Rock FR', { genre: 'rock', countryCode: 'FR' })
    await add('Variada ES', { genre: 'variada', countryCode: 'ES' })
    expect(await similarNames(me)).toEqual(['Rock ES tag', 'Rock FR', 'Variada ES'])
  })

  it('never includes itself or hidden stations', async () => {
    const me = await add('Me', { genre: 'rock', countryCode: 'ES' })
    await add('Off', { genre: 'rock', countryCode: 'ES', status: 'desactivada' })
    await add('Broken', { genre: 'rock', countryCode: 'ES', healthConsecutiveFailures: HEALTH_HIDE_THRESHOLD })
    await add('Ok', { genre: 'rock', countryCode: 'ES' })
    expect(await similarNames(me)).toEqual(['Ok'])
  })

  it('does not treat "Variada" alone as something in common', async () => {
    const me = await add('Me', { genre: 'variada' })
    await add('Other 1', { genre: 'variada' })
    await add('Other 2', { genre: 'variada' })
    expect(await similarNames(me)).toEqual([])
  })

  it('does not treat a shared language alone as something in common', async () => {
    const me = await add('Me', { genre: 'pop', languageCodes: ['es'] })
    await add('Rock es', { genre: 'rock', languageCodes: ['es'] })
    expect(await similarNames(me)).toEqual([])
  })

  it('weighs a rare shared tag above a very common one', async () => {
    const me = await add('Me', { genre: 'pop' }, ['common', 'rare'])
    await add('Shares rare', { genre: 'rock' }, ['rare'])
    await add('Shares common', { genre: 'rock', rbClickCount: 1000 }, ['common'])
    const commonTag = (await ctx.db.select({ id: tags.id }).from(tags).where(eq(tags.name, 'common')))[0].id
    const filler = await ctx.db
      .insert(stations)
      .values(
        Array.from({ length: 500 }, (_, i) => ({
          slug: `f-${i}`,
          name: `Filler ${i}`,
          streamUrl: `http://f/${i}`,
          source: 'test',
          externalId: `f-${i}`,
          genre: 'jazz' as const,
        })),
      )
      .returning({ id: stations.id })
    await ctx.db.insert(stationTags).values(filler.map((f) => ({ stationId: f.id, tagId: commonTag })))
    expect((await similarNames(me))[0]).toBe('Shares rare')
  })

  it('respects the limit (8 by default)', async () => {
    const me = await add('Me', { genre: 'rock' })
    for (let i = 0; i < 20; i++) await add(`Rock ${i}`, { genre: 'rock' })
    expect(await similarNames(me)).toHaveLength(8)
    expect(await similarNames(me, 3)).toHaveLength(3)
  })
})
