// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { plays, stations } from '@/db/schema'
import { recordPlay } from '@/catalog/plays'
import { createTestDb } from '../helpers/db'

describe('recordPlay', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    ctx ??= await createTestDb()
    await ctx.reset()
  })

  afterAll(async () => {
    await ctx?.close()
  })

  async function addStation(extra: Partial<typeof stations.$inferInsert> = {}) {
    const [row] = await ctx.db
      .insert(stations)
      .values({
        slug: 's',
        name: 's',
        streamUrl: 'http://stream.example/s',
        source: 'test',
        externalId: 's',
        ...extra,
      })
      .returning()
    return row
  }

  async function playCount(id: string) {
    const [row] = await ctx.db.select().from(stations).where(eq(stations.id, id))
    return row.playCount
  }

  it('counts once per session', async () => {
    const st = await addStation()
    const session = randomUUID()
    expect(await recordPlay(ctx.db, st.id, session)).toBe('counted')
    expect(await recordPlay(ctx.db, st.id, session)).toBe('duplicate')
    expect(await recordPlay(ctx.db, st.id, session)).toBe('duplicate')
    expect(await playCount(st.id)).toBe(1)
  })

  it('counts different sessions', async () => {
    const st = await addStation()
    await recordPlay(ctx.db, st.id, randomUUID())
    await recordPlay(ctx.db, st.id, randomUUID())
    expect(await playCount(st.id)).toBe(2)
  })

  it('does not touch updated_at', async () => {
    const st = await addStation()
    await recordPlay(ctx.db, st.id, randomUUID())
    const [after] = await ctx.db.select().from(stations).where(eq(stations.id, st.id))
    expect(after.updatedAt).toEqual(st.updatedAt)
  })

  it('ignores inactive station', async () => {
    const st = await addStation({ status: 'desactivada' })
    expect(await recordPlay(ctx.db, st.id, randomUUID())).toBe('not-found')
    expect(await ctx.db.select().from(plays)).toHaveLength(0)
    expect(await playCount(st.id)).toBe(0)
  })

  it('returns not-found for an unknown station', async () => {
    expect(await recordPlay(ctx.db, randomUUID(), randomUUID())).toBe('not-found')
  })
})
