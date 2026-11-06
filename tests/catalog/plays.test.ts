// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '@/db/schema'
import { plays, stations } from '@/db/schema'
import { hashIp, PLAYS_PER_IP_DAY, PLAYS_PER_IP_HOUR, pruneOldPlays, recordPlay } from '@/catalog/plays'
import { createTestDb } from '../helpers/db'
import { assertTestDbUrl } from '../helpers/assert-test-db'

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

  it('rate-limits counted plays per ip', async () => {
    const st = await addStation()
    const ip = hashIp('203.0.113.5', 'salt')
    expect(PLAYS_PER_IP_HOUR).toBe(30)
    for (let i = 0; i < PLAYS_PER_IP_HOUR; i++) {
      expect(await recordPlay(ctx.db, st.id, randomUUID(), ip)).toBe('counted')
    }
    expect(await recordPlay(ctx.db, st.id, randomUUID(), ip)).toBe('rate-limited')
    expect(await playCount(st.id)).toBe(PLAYS_PER_IP_HOUR)
  })

  it('daily cap', async () => {
    const st = await addStation()
    const ip = hashIp('203.0.113.6', 'salt')
    expect(PLAYS_PER_IP_DAY).toBe(200)
    const rows = Array.from({ length: PLAYS_PER_IP_DAY }, (_, i) => ({
      stationId: st.id,
      sessionId: randomUUID(),
      ipHash: ip,
      createdAt: new Date(Date.now() - (2 + (i % 20)) * 3600_000),
    }))
    await ctx.db.insert(plays).values(rows)
    expect(await recordPlay(ctx.db, st.id, randomUUID(), ip)).toBe('rate-limited')
  })

  it('other ips unaffected', async () => {
    const st = await addStation()
    const ip = hashIp('203.0.113.7', 'salt')
    for (let i = 0; i < PLAYS_PER_IP_HOUR; i++) await recordPlay(ctx.db, st.id, randomUUID(), ip)
    expect(await recordPlay(ctx.db, st.id, randomUUID(), hashIp('198.51.100.1', 'salt'))).toBe('counted')
    expect(await recordPlay(ctx.db, st.id, randomUUID(), null)).toBe('counted')
  })

  it('hashIp is sha256 hex of salt + ip', () => {
    expect(hashIp('1.2.3.4', 's')).toMatch(/^[0-9a-f]{64}$/)
    expect(hashIp('1.2.3.4', 's')).not.toBe(hashIp('1.2.3.4', 't'))
  })

  it('prunes plays older than 35 days', async () => {
    const st = await addStation()
    const day = 24 * 3600_000
    await ctx.db.insert(plays).values([
      { stationId: st.id, sessionId: randomUUID(), createdAt: new Date(Date.now() - 36 * day) },
      { stationId: st.id, sessionId: randomUUID(), createdAt: new Date(Date.now() - 10 * day) },
    ])
    expect(await pruneOldPlays(ctx.db)).toBe(1)
    expect(await ctx.db.select().from(plays)).toHaveLength(1)
  })

  it('caps per-ip plays under concurrency across stations', async () => {
    const ip = hashIp('203.0.113.9', 'salt')
    const sts = []
    for (let i = 0; i < 40; i++) sts.push(await addStation({ slug: `c-${i}`, name: `c-${i}`, externalId: `c-${i}` }))
    const client = postgres(assertTestDbUrl(process.env.DATABASE_URL_TEST), {
      max: 20,
      onnotice: () => {},
    })
    try {
      const db = drizzle(client, { schema })
      const results = await Promise.allSettled(sts.map((s) => recordPlay(db, s.id, randomUUID(), ip)))
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0)
      const values = results.map((r) => (r as PromiseFulfilledResult<string>).value)
      expect(values.filter((v) => v === 'counted')).toHaveLength(PLAYS_PER_IP_HOUR)
      expect(values.filter((v) => v === 'rate-limited')).toHaveLength(40 - PLAYS_PER_IP_HOUR)
      expect(await ctx.db.select().from(plays).where(eq(plays.ipHash, ip))).toHaveLength(PLAYS_PER_IP_HOUR)
    } finally {
      await client.end()
    }
  })

  it('handles concurrent plays without deadlock', async () => {
    const st = await addStation()
    const client = postgres(assertTestDbUrl(process.env.DATABASE_URL_TEST), {
      max: 15,
      onnotice: () => {},
    })
    try {
      const db = drizzle(client, { schema })
      const shared = randomUUID()
      const calls = [
        ...Array.from({ length: 10 }, () => recordPlay(db, st.id, randomUUID())),
        ...Array.from({ length: 5 }, () => recordPlay(db, st.id, shared)),
      ]
      const results = await Promise.allSettled(calls)
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0)
      const values = results.map((r) => (r as PromiseFulfilledResult<string>).value)
      expect(values.filter((v) => v === 'counted')).toHaveLength(11)
      expect(await playCount(st.id)).toBe(11)
    } finally {
      await client.end()
    }
  })
})
