import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Db = PostgresJsDatabase<typeof schema>

const cache = new Map<string, Db>()

export function getDb(url: string | undefined = process.env.DATABASE_URL): Db {
  if (!url) throw new Error('DATABASE_URL is not set')
  let db = cache.get(url)
  if (!db) {
    db = drizzle(postgres(url), { schema })
    cache.set(url, db)
  }
  return db
}
