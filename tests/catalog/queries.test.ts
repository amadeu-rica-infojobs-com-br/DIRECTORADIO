// @vitest-environment node
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { stations, stationTags, tags } from '@/db/schema'
import { getHomeStations, getStationBySlug, HOME_PAGE_SIZE } from '@/catalog/queries'
import { createTestDb } from '../helpers/db'

describe('catalog queries', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    ctx ??= await createTestDb()
    await ctx.reset()
  })

  afterAll(async () => {
    await ctx?.close()
  })

  function station(slug: string, extra: Partial<typeof stations.$inferInsert> = {}) {
    return {
      slug,
      name: slug,
      streamUrl: `http://stream.example/${slug}`,
      source: 'test',
      externalId: slug,
      ...extra,
    }
  }

  it('orders Spanish stations first then by clicks', async () => {
    await ctx.db.insert(stations).values([
      station('es-10', { countryCode: 'ES', rbClickCount: 10 }),
      station('fr-1000', { countryCode: 'FR', rbClickCount: 1000 }),
      station('es-500', { countryCode: 'ES', rbClickCount: 500 }),
      station('pt-50', { countryCode: 'PT', rbClickCount: 50 }),
    ])
    const { items, total } = await getHomeStations(ctx.db, 1)
    expect(items.map((s) => s.slug)).toEqual(['es-500', 'es-10', 'fr-1000', 'pt-50'])
    expect(total).toBe(4)
  })

  async function seedRankingStations() {
    await ctx.db.insert(stations).values([
      station('es-10', { countryCode: 'ES', rbClickCount: 10 }),
      station('fr-1000', { countryCode: 'FR', rbClickCount: 1000 }),
      station('es-500', { countryCode: 'ES', rbClickCount: 500 }),
      station('pt-50', { countryCode: 'PT', rbClickCount: 50 }),
    ])
  }

  async function insertPlays(slug: string, count: number, ageDays = 0) {
    await ctx.db.execute(sql`
      INSERT INTO plays (station_id, session_id, created_at)
      SELECT s.id, gen_random_uuid(), now() - make_interval(days => ${ageDays})
      FROM stations s, generate_series(1, ${count})
      WHERE s.slug = ${slug}
    `)
  }

  it('orders by plays30d once own data is full', async () => {
    await seedRankingStations()
    await insertPlays('fr-1000', 600)
    await insertPlays('pt-50', 400)
    const { items } = await getHomeStations(ctx.db, 1)
    // w = 1: the legacy score is ignored, so zero-play ties fall back to name ASC.
    expect(items.map((s) => s.slug)).toEqual(['fr-1000', 'pt-50', 'es-10', 'es-500'])
  })

  it('ignores plays older than 30 days', async () => {
    await seedRankingStations()
    await insertPlays('fr-1000', 1000, 31)
    const { items } = await getHomeStations(ctx.db, 1)
    expect(items.map((s) => s.slug)).toEqual(['es-500', 'es-10', 'fr-1000', 'pt-50'])
  })

  it('blends own plays and legacy score when partial', async () => {
    await seedRankingStations()
    await insertPlays('pt-50', 500)
    const { items } = await getHomeStations(ctx.db, 1)
    expect(items.map((s) => s.slug)).toEqual(['pt-50', 'es-500', 'es-10', 'fr-1000'])
  })

  it('hides inactive and unhealthy stations from home', async () => {
    await ctx.db.insert(stations).values([
      station('ok'),
      station('off', { status: 'desactivada' }),
      station('gone', { status: 'eliminada' }),
      station('sick', { healthConsecutiveFailures: 3 }),
    ])
    const { items, total } = await getHomeStations(ctx.db, 1)
    expect(items.map((s) => s.slug)).toEqual(['ok'])
    expect(total).toBe(1)
  })

  it('paginates by 48', async () => {
    expect(HOME_PAGE_SIZE).toBe(48)
    await ctx.db
      .insert(stations)
      .values(Array.from({ length: 50 }, (_, i) => station(`s${String(i).padStart(2, '0')}`)))
    const p2 = await getHomeStations(ctx.db, 2)
    expect(p2.items).toHaveLength(2)
    expect(p2.pageCount).toBe(2)
    expect(p2.total).toBe(50)
    expect((await getHomeStations(ctx.db, 1)).items).toHaveLength(48)
    const p3 = await getHomeStations(ctx.db, 3)
    expect(p3.items).toEqual([])
    expect(p3.page).toBe(3)
    expect((await getHomeStations(ctx.db, Number.NaN)).page).toBe(1)
    expect((await getHomeStations(ctx.db, 0)).page).toBe(1)
  })

  it('returns detail for unhealthy active station', async () => {
    const [row] = await ctx.db
      .insert(stations)
      .values(
        station('sick', {
          healthConsecutiveFailures: 3,
          ratingAvg: '4.50',
          ratingCount: 2,
          languages: ['spanish'],
        }),
      )
      .returning()
    const inserted = await ctx.db.insert(tags).values([{ name: 'rock' }, { name: 'dance' }]).returning()
    await ctx.db
      .insert(stationTags)
      .values(inserted.map((t) => ({ stationId: row.id, tagId: t.id })))

    const detail = await getStationBySlug(ctx.db, 'sick')
    expect(detail).not.toBeNull()
    expect(detail!.id).toBe(row.id)
    expect(detail!.isHealthHidden).toBe(true)
    expect(detail!.tags).toEqual(['dance', 'rock'])
    expect(detail!.ratingAvg).toBe(4.5)
    expect(detail!.ratingCount).toBe(2)
    expect(detail!.playCount).toBe(0)
    expect(detail!.languages).toEqual(['spanish'])
  })

  it('returns null for desactivada', async () => {
    await ctx.db.insert(stations).values(station('off', { status: 'desactivada' }))
    expect(await getStationBySlug(ctx.db, 'off')).toBeNull()
    expect(await getStationBySlug(ctx.db, 'missing')).toBeNull()
  })
})
