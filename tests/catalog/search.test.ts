// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { HEALTH_HIDE_THRESHOLD } from '@/catalog/constants'
import { getHomeStations } from '@/catalog/queries'
import { getFilterOptions, searchStations } from '@/catalog/search'
import { stations } from '@/db/schema'
import { createTestDb } from '../helpers/db'

describe('searchStations', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    ctx ??= await createTestDb()
    await ctx.reset()
  })

  afterAll(async () => {
    await ctx?.close()
  })

  let n = 0
  function station(name: string, extra: Partial<typeof stations.$inferInsert> = {}) {
    n++
    return {
      slug: `s-${n}`,
      name,
      streamUrl: `http://stream.example/${n}`,
      source: 'test',
      externalId: `e-${n}`,
      ...extra,
    }
  }

  const names = async (criteria: Parameters<typeof searchStations>[1], page = 1) =>
    (await searchStations(ctx.db, criteria, page)).items.map((s) => s.name)

  it('ignores accents and case', async () => {
    await ctx.db.insert(stations).values([station('Radio Cádiz'), station('Onda Cero')])
    expect(await names({ q: 'CADIZ' })).toEqual(['Radio Cádiz'])
  })

  it('tolerates a small typo', async () => {
    await ctx.db.insert(stations).values([station('Cadena SER'), station('Kiss FM')])
    expect(await names({ q: 'cadena sr' })).toEqual(['Cadena SER'])
  })

  it('puts names that contain the whole text first', async () => {
    await ctx.db
      .insert(stations)
      .values([
        station('Radio Clásica', { rbClickCount: 900 }),
        station('Los 40 Classic', { rbClickCount: 800 }),
        station('LOS40', { rbClickCount: 1 }),
      ])
    expect((await names({ q: 'los40' }))[0]).toBe('LOS40')
  })

  it('ignores spaces when matching ("los 40" finds "LOS40")', async () => {
    await ctx.db.insert(stations).values([station('LOS40'), station('RockFM'), station('Kiss FM')])
    expect(await names({ q: 'los 40' })).toEqual(['LOS40'])
    expect(await names({ q: 'rock fm' })).toEqual(['RockFM'])
  })

  it('uses only "contains" for 1-2 character texts', async () => {
    await ctx.db.insert(stations).values([station('Abc Radio'), station('Radio Xab'), station('Radio Ac')])
    expect((await names({ q: 'ab' })).sort()).toEqual(['Abc Radio', 'Radio Xab'])
  })

  it('treats LIKE wildcards and quotes literally', async () => {
    await ctx.db.insert(stations).values([station('Abc Radio'), station('Radio 100%')])
    expect(await names({ q: 'a_c' })).toEqual([])
    expect((await names({ q: '100%' }))[0]).toBe('Radio 100%')
    await expect(searchStations(ctx.db, { q: "o'clock" }, 1)).resolves.toBeDefined()
  })

  it('combines filters with AND', async () => {
    await ctx.db.insert(stations).values([
      station('Match', { countryCode: 'PT', languageCodes: ['pt'], genre: 'latina' }),
      station('Wrong genre', { countryCode: 'PT', languageCodes: ['pt'], genre: 'pop' }),
      station('Wrong language', { countryCode: 'PT', languageCodes: ['es'], genre: 'latina' }),
      station('Wrong country', { countryCode: 'ES', languageCodes: ['pt'], genre: 'latina' }),
    ])
    expect(await names({ country: 'PT', language: 'pt', genre: 'latina' })).toEqual(['Match'])
  })

  it('never returns hidden stations', async () => {
    await ctx.db.insert(stations).values([
      station('Radio Visible'),
      station('Radio Off', { status: 'desactivada' }),
      station('Radio Broken', { healthConsecutiveFailures: HEALTH_HIDE_THRESHOLD }),
    ])
    expect(await names({ q: 'radio' })).toEqual(['Radio Visible'])
    expect(await names({})).toEqual(['Radio Visible'])
  })

  it('without criteria orders like the home page', async () => {
    await ctx.db.insert(stations).values([
      station('ES 10', { countryCode: 'ES', rbClickCount: 10 }),
      station('FR 1000', { countryCode: 'FR', rbClickCount: 1000 }),
      station('ES 500', { countryCode: 'ES', rbClickCount: 500 }),
    ])
    const home = (await getHomeStations(ctx.db, 1)).items.map((s) => s.name)
    expect(await names({})).toEqual(home)
    expect(home).toEqual(['ES 500', 'ES 10', 'FR 1000'])
  })

  it('clamps a page beyond the last one', async () => {
    await ctx.db.insert(stations).values(Array.from({ length: 50 }, (_, i) => station(`Radio ${i}`)))
    const result = await searchStations(ctx.db, {}, 9)
    expect(result.page).toBe(2)
    expect(result.pageCount).toBe(2)
    expect(result.total).toBe(50)
    expect(result.items).toHaveLength(2)
  })
})

describe('getFilterOptions', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    ctx ??= await createTestDb()
    await ctx.reset()
  })

  afterAll(async () => {
    await ctx?.close()
  })

  it('lists only values of visible stations, without duplicates', async () => {
    const base = { streamUrl: 'http://x', source: 'test' }
    await ctx.db.insert(stations).values([
      { ...base, slug: 'a', name: 'A', externalId: 'a', countryCode: 'ES', languageCodes: ['es', 'ca'], genre: 'pop' },
      { ...base, slug: 'b', name: 'B', externalId: 'b', countryCode: 'ES', languageCodes: ['es'], genre: 'pop' },
      {
        ...base,
        slug: 'c',
        name: 'C',
        externalId: 'c',
        countryCode: 'FR',
        languageCodes: ['fr'],
        genre: 'rock',
        status: 'desactivada',
      },
    ])
    const options = await getFilterOptions(ctx.db)
    expect(options.countries).toEqual(['ES'])
    expect([...options.languages].sort()).toEqual(['ca', 'es'])
    expect(options.genres).toEqual(['pop'])
  })
})
