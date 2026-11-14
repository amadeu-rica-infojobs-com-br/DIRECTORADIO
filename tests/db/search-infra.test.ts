// @vitest-environment node
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb } from '../helpers/db'

describe('name search infrastructure', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>

  beforeAll(async () => {
    ctx = await createTestDb()
  })

  afterAll(async () => {
    await ctx?.close()
  })

  it('normalizes accents and case with f_unaccent', async () => {
    const [row] = await ctx.db.execute<{ v: string }>(sql`select lower(f_unaccent('Ñandú CÁDIZ')) as v`)
    expect(row.v).toBe('nandu cadiz')
  })

  it('creates the trigram name index and the tag index', async () => {
    const rows = await ctx.db.execute<{ indexname: string }>(
      sql`select indexname from pg_indexes where indexname in ('stations_name_search_idx', 'station_tags_tag_id_idx')`,
    )
    expect(Array.from(rows, (r) => r.indexname).sort()).toEqual(['station_tags_tag_id_idx', 'stations_name_search_idx'])
  })
})
