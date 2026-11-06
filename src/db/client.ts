import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Db = PostgresJsDatabase<typeof schema>

const cache = new Map<string, Db>()

export function dbOptions(url: string, env: NodeJS.ProcessEnv = process.env): postgres.Options<Record<string, postgres.PostgresType>> {
  const host = new URL(url).hostname
  const isLocal = host === 'localhost' || host === '127.0.0.1'
  const opts: postgres.Options<Record<string, postgres.PostgresType>> = {}
  // Pooled endpoints (e.g. Neon -pooler) do not support prepared statements.
  if (host.includes('-pooler') || env.DB_POOLED === 'true') opts.prepare = false
  if (env.DB_POOL_MAX) opts.max = Number(env.DB_POOL_MAX)
  if (env.DB_STATEMENT_TIMEOUT_MS) {
    opts.connection = { statement_timeout: Number(env.DB_STATEMENT_TIMEOUT_MS) }
  }
  if (!isLocal) opts.ssl = 'require'
  return opts
}

export function getDb(url: string | undefined = process.env.DATABASE_URL): Db {
  if (!url) throw new Error('DATABASE_URL is not set')
  let db = cache.get(url)
  if (!db) {
    db = drizzle(postgres(url, dbOptions(url)), { schema })
    cache.set(url, db)
  }
  return db
}
