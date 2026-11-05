import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { runMigrations } from '@/db/migrate'
import * as schema from '@/db/schema'
import type { Db } from '@/db/client'
import { assertTestDbUrl } from './assert-test-db'

const migrated = new Set<string>()

export async function createTestDb(): Promise<{
  db: Db
  reset(): Promise<void>
  close(): Promise<void>
}> {
  const url = assertTestDbUrl(process.env.DATABASE_URL_TEST)

  if (!migrated.has(url)) {
    await runMigrations(url)
    migrated.add(url)
  }

  const client = postgres(url, { max: 1, onnotice: () => {} })
  const db = drizzle(client, { schema })

  return {
    db,
    async reset() {
      await client.unsafe(
        'TRUNCATE stations, tags, station_tags, tag_genres, plays RESTART IDENTITY CASCADE',
      )
    },
    async close() {
      await client.end()
    },
  }
}
