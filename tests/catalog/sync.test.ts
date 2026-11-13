// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { stations, stationTags, tags } from '@/db/schema'
import { seedTagGenres } from '@/catalog/seed/tag-genres'
import { syncCatalog } from '@/catalog/sync'
import type { RbStation } from '@/catalog/radio-browser/types'
import { createTestDb } from '../helpers/db'

let counter = 0
function rb(overrides: Partial<RbStation> = {}): RbStation {
  counter++
  return {
    stationuuid: `uuid-${counter}`,
    name: `Station ${counter}`,
    url: `https://stream.example/${counter}`,
    url_resolved: `https://stream.example/${counter}`,
    homepage: '',
    favicon: '',
    tags: '',
    countrycode: 'ES',
    language: 'spanish',
    clickcount: 0,
    lastcheckok: 1,
    ...overrides,
  }
}

async function tagNamesOf(db: Awaited<ReturnType<typeof createTestDb>>['db'], stationId: string) {
  const rows = await db
    .select({ name: tags.name })
    .from(stationTags)
    .innerJoin(tags, eq(tags.id, stationTags.tagId))
    .where(eq(stationTags.stationId, stationId))
  return rows.map((r) => r.name).sort()
}

describe('syncCatalog', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    ctx ??= await createTestDb()
    await ctx.reset()
    await seedTagGenres(ctx.db)
  })

  afterAll(async () => {
    await ctx?.close()
  })

  it('inserts new stations with genre from tags', async () => {
    const report = await syncCatalog(ctx.db, [
      rb({ stationuuid: 'u-ser', name: 'Cadena SER', tags: 'news,talk' }),
    ])
    expect(report.inserted).toBe(1)
    const [row] = await ctx.db.select().from(stations)
    expect(row.genre).toBe('noticias')
    expect(row.status).toBe('activa')
    expect(row.slug).toBe('cadena-ser')
    expect(row.source).toBe('radio-browser')
    expect(await tagNamesOf(ctx.db, row.id)).toEqual(['news', 'talk'])
  })

  it('stores ISO language codes', async () => {
    await syncCatalog(ctx.db, [rb({ stationuuid: 'u-lang', languagecodes: 'es,CA' })])
    const [row] = await ctx.db.select().from(stations)
    expect(row.languageCodes).toEqual(['es', 'ca'])
  })

  it('updates when language codes change, ignoring order', async () => {
    await syncCatalog(ctx.db, [rb({ stationuuid: 'u-lang2', name: 'Radio L', url: 'https://s.example/l', url_resolved: 'https://s.example/l', languagecodes: 'es,ca' })])
    const same = await syncCatalog(ctx.db, [rb({ stationuuid: 'u-lang2', name: 'Radio L', url: 'https://s.example/l', url_resolved: 'https://s.example/l', languagecodes: 'ca,es' })])
    expect(same.updated).toBe(0)
    const changed = await syncCatalog(ctx.db, [rb({ stationuuid: 'u-lang2', name: 'Radio L', url: 'https://s.example/l', url_resolved: 'https://s.example/l', languagecodes: 'pt' })])
    expect(changed.updated).toBe(1)
    const [row] = await ctx.db.select().from(stations)
    expect(row.languageCodes).toEqual(['pt'])
  })

  it('falls back when slug is empty', async () => {
    await syncCatalog(ctx.db, [
      rb({ stationuuid: '1a2b3c4d-0000-0000-0000-000000000000', name: 'Радио Рекорд' }),
    ])
    const [row] = await ctx.db.select().from(stations)
    expect(row.slug).toBe('emisora-1a2b3c4d')
  })

  it('keeps slugs unique', async () => {
    await syncCatalog(ctx.db, [
      rb({ stationuuid: 'a', name: 'Los 40', url_resolved: 'https://x/a' }),
      rb({ stationuuid: 'b', name: 'Los 40', url_resolved: 'https://x/b' }),
    ])
    const rows = await ctx.db.select({ slug: stations.slug }).from(stations)
    expect(rows.map((r) => r.slug).sort()).toEqual(['los-40', 'los-40-2'])
  })

  it('does not overwrite manual fields', async () => {
    await ctx.db.insert(stations).values({
      slug: 'mi-radio',
      name: 'Old name',
      streamUrl: 'https://x/old',
      source: 'radio-browser',
      externalId: 'u-manual',
      logoUrl: 'https://logo/manual.png',
      genre: 'jazz',
      manualFields: ['logoUrl', 'genre'],
    })
    const report = await syncCatalog(ctx.db, [
      rb({
        stationuuid: 'u-manual',
        name: 'New name',
        url_resolved: 'https://x/new',
        favicon: 'https://logo/rb.png',
        tags: 'rock,metal',
      }),
    ])
    expect(report.updated).toBe(1)
    const [row] = await ctx.db.select().from(stations)
    expect(row.logoUrl).toBe('https://logo/manual.png')
    expect(row.genre).toBe('jazz')
    expect(row.name).toBe('New name')
    expect(row.streamUrl).toBe('https://x/new')
    expect(row.slug).toBe('mi-radio')
    expect(await tagNamesOf(ctx.db, row.id)).toEqual(['metal', 'rock'])
  })

  it('deactivates stations missing from the batch', async () => {
    const batch = [rb(), rb(), rb(), rb()]
    await syncCatalog(ctx.db, batch)
    const report = await syncCatalog(ctx.db, batch.slice(0, 3))
    expect(report.deactivated).toBe(1)
    expect(report.deactivationSkipped).toBe(false)
    const rows = await ctx.db.select().from(stations)
    const missing = rows.find((r) => r.externalId === batch[3].stationuuid)
    expect(missing?.status).toBe('desactivada')
    expect(rows.filter((r) => r.status === 'activa')).toHaveLength(3)
  })

  it('does not touch eliminada stations when missing from the batch', async () => {
    const batch = [rb(), rb(), rb(), rb()]
    await syncCatalog(ctx.db, batch)
    await ctx.db.insert(stations).values({
      slug: 'gone',
      name: 'Gone',
      streamUrl: 'https://x/gone',
      source: 'radio-browser',
      externalId: 'gone',
      status: 'eliminada',
      deactivatedBySync: false,
    })
    const report = await syncCatalog(ctx.db, batch)
    expect(report.deactivationSkipped).toBe(false)
    expect(report.deactivated).toBe(0)
    const [row] = await ctx.db.select().from(stations).where(eq(stations.externalId, 'gone'))
    expect(row.status).toBe('eliminada')
    expect(row.deactivatedBySync).toBe(false)
  })

  it('skips deactivation when batch is suspiciously small', async () => {
    const batch = Array.from({ length: 10 }, () => rb())
    await syncCatalog(ctx.db, batch)
    const report = await syncCatalog(ctx.db, batch.slice(0, 4))
    expect(report.deactivated).toBe(0)
    expect(report.deactivationSkipped).toBe(true)
    const rows = await ctx.db.select().from(stations)
    expect(rows.every((r) => r.status === 'activa')).toBe(true)
  })

  it('drops duplicate stream urls keeping the most clicked', async () => {
    const report = await syncCatalog(ctx.db, [
      rb({ stationuuid: 'low', name: 'Low', url_resolved: 'https://dup.example/live/', clickcount: 5 }),
      rb({ stationuuid: 'high', name: 'High', url_resolved: 'https://DUP.example/live', clickcount: 50 }),
    ])
    expect(report.skippedDuplicates).toBe(1)
    expect(report.inserted).toBe(1)
    const rows = await ctx.db.select().from(stations)
    expect(rows).toHaveLength(1)
    expect(rows[0].externalId).toBe('high')
  })

  it('does not deactivate duplicate losers', async () => {
    await ctx.db.insert(stations).values({
      slug: 'a',
      name: 'A',
      streamUrl: 'https://dup.example/live',
      source: 'radio-browser',
      externalId: 'a',
      rbClickCount: 5,
    })
    const report = await syncCatalog(ctx.db, [
      rb({ stationuuid: 'a', name: 'A', url_resolved: 'https://dup.example/live', clickcount: 5 }),
      rb({ stationuuid: 'b', name: 'B', url_resolved: 'https://dup.example/live', clickcount: 50 }),
    ])
    expect(report.deactivated).toBe(0)
    const rows = await ctx.db.select().from(stations)
    expect(rows).toHaveLength(1)
    expect(rows[0].externalId).toBe('a')
    expect(rows[0].status).toBe('activa')
    expect(report.inserted).toBe(0)
    expect(report.skippedDuplicates).toBe(1)
  })

  it('reactivates stations deactivated by sync when they reappear', async () => {
    const batch = [rb(), rb(), rb(), rb()]
    await syncCatalog(ctx.db, batch)
    await syncCatalog(ctx.db, batch.slice(0, 3))
    const x = batch[3].stationuuid
    const [off] = await ctx.db.select().from(stations).where(eq(stations.externalId, x))
    expect(off.status).toBe('desactivada')
    expect(off.deactivatedBySync).toBe(true)

    const report = await syncCatalog(ctx.db, batch)
    expect(report.reactivated).toBe(1)
    const [on] = await ctx.db.select().from(stations).where(eq(stations.externalId, x))
    expect(on.status).toBe('activa')
    expect(on.deactivatedBySync).toBe(false)
  })

  it('does not touch updatedAt when nothing changed', async () => {
    const batch = [rb({ tags: 'news,talk', homepage: 'https://h.example', favicon: 'https://l/x.png' }), rb()]
    await syncCatalog(ctx.db, batch)
    const before = await ctx.db.select().from(stations)
    await new Promise((r) => setTimeout(r, 20))
    const report = await syncCatalog(ctx.db, batch)
    expect(report.updated).toBe(0)
    const after = await ctx.db.select().from(stations)
    for (const b of before) {
      expect(after.find((a) => a.id === b.id)?.updatedAt).toEqual(b.updatedAt)
    }
  })

  it('updates updatedAt when click count changes', async () => {
    const a = rb({ clickcount: 1 })
    await syncCatalog(ctx.db, [a])
    const [before] = await ctx.db.select().from(stations)
    await new Promise((r) => setTimeout(r, 20))
    const report = await syncCatalog(ctx.db, [{ ...a, clickcount: 2 }])
    expect(report.updated).toBe(1)
    const [after] = await ctx.db.select().from(stations)
    expect(after.rbClickCount).toBe(2)
    expect(after.updatedAt!.getTime()).toBeGreaterThan(before.updatedAt!.getTime())
  })

  it('updates when only tags change', async () => {
    const a = rb({ tags: 'rock,metal' })
    await syncCatalog(ctx.db, [a])
    const report = await syncCatalog(ctx.db, [{ ...a, tags: 'rock,jazz' }])
    expect(report.updated).toBe(1)
    const [row] = await ctx.db.select().from(stations)
    expect(await tagNamesOf(ctx.db, row.id)).toEqual(['jazz', 'rock'])
  })

  it('never reactivates editorial deactivations', async () => {
    await ctx.db.insert(stations).values({
      slug: 'x',
      name: 'X',
      streamUrl: 'https://x/x',
      source: 'radio-browser',
      externalId: 'x',
      status: 'desactivada',
      deactivatedBySync: false,
    })
    const report = await syncCatalog(ctx.db, [rb({ stationuuid: 'x', name: 'X', url_resolved: 'https://x/x' })])
    expect(report.reactivated).toBe(0)
    const [row] = await ctx.db.select().from(stations).where(eq(stations.externalId, 'x'))
    expect(row.status).toBe('desactivada')
  })
})
