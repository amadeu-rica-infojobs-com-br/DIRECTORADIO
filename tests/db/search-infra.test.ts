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

describe('space-insensitive name search', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>

  beforeAll(async () => {
    ctx = await createTestDb()
  })

  afterAll(async () => {
    await ctx?.close()
  })

  it('has a trigram index on the name without spaces, matching the search expression', async () => {
    const rows = await ctx.db.execute<{ indexdef: string }>(
      sql`select indexdef from pg_indexes where indexname = 'stations_name_nospace_search_idx'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].indexdef).toContain("replace(lower(f_unaccent(name)), ' '::text, ''::text) gin_trgm_ops")
  })

  it('lets the planner use it for the space-insensitive "contains"', async () => {
    await ctx.db.execute(sql`set enable_seqscan = off`)
    try {
      const plan = await ctx.db.execute<{ 'QUERY PLAN': string }>(
        sql`explain select 1 from stations s where replace(lower(f_unaccent(s.name)), ' ', '') like '%los40%'`,
      )
      expect(Array.from(plan, (r) => r['QUERY PLAN']).join('\n')).toContain('stations_name_nospace_search_idx')
    } finally {
      await ctx.db.execute(sql`set enable_seqscan = on`)
    }
  })
})
