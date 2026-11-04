// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { stations } from '@/db/schema'
import { createTestDb } from '../helpers/db'

describe('stations schema', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    ctx ??= await createTestDb()
    await ctx.reset()
  })

  afterAll(async () => {
    await ctx?.close()
  })

  it('inserts and reads a station with defaults', async () => {
    await ctx.db.insert(stations).values({
      slug: 'cadena-ser',
      name: 'Cadena SER',
      streamUrl: 'https://x/ser',
      source: 'radio-browser',
      externalId: 'u1',
    })
    const [row] = await ctx.db.select().from(stations)
    expect(row.status).toBe('activa')
    expect(row.genre).toBe('variada')
    expect(row.healthConsecutiveFailures).toBe(0)
    expect(row.manualFields).toEqual([])
  })

  it('rejects duplicate source+externalId', async () => {
    const base = {
      name: 'Cadena SER',
      streamUrl: 'https://x/ser',
      source: 'radio-browser',
      externalId: 'u1',
    }
    await ctx.db.insert(stations).values({ ...base, slug: 'cadena-ser' })
    await expect(
      ctx.db.insert(stations).values({ ...base, slug: 'cadena-ser-2' }),
    ).rejects.toThrow()
  })
})
