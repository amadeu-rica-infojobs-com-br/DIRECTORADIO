import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Db = PostgresJsDatabase<typeof schema>

/** Per-connection settings that no environment variable should be able to override. */
export type DbOverrides = { statementTimeoutMs?: number }

const cache = new Map<string, Db>()

export function dbOptions(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
  overrides: DbOverrides = {},
): postgres.Options<Record<string, postgres.PostgresType>> {
  const host = new URL(url).hostname
  const isLocal = host === 'localhost' || host === '127.0.0.1'
  const isPooled = host.includes('-pooler') || env.DB_POOLED === 'true'
  const opts: postgres.Options<Record<string, postgres.PostgresType>> = {}
  // Pooled endpoints (e.g. Neon -pooler) do not support prepared statements.
  if (isPooled) {
    opts.prepare = false
    opts.idle_timeout = 20
  }
  if (env.DB_POOL_MAX) opts.max = Number(env.DB_POOL_MAX)
  // PgBouncer rejects unknown startup parameters, so pooled URLs rely on the role timeout in Neon.
  if (!isPooled) {
    const timeout =
      overrides.statementTimeoutMs ??
      (env.DB_STATEMENT_TIMEOUT_MS ? Number(env.DB_STATEMENT_TIMEOUT_MS) : undefined)
    if (timeout !== undefined) opts.connection = { statement_timeout: timeout }
  }
  if (!isLocal) opts.ssl = 'verify-full'
  return opts
}

export function getDb(
  url: string | undefined = process.env.DATABASE_URL,
  overrides: DbOverrides = {},
): Db {
  if (!url) throw new Error('DATABASE_URL is not set')
  const key = `${url}\u0000${overrides.statementTimeoutMs ?? ''}`
  let db = cache.get(key)
  if (!db) {
    db = drizzle(postgres(url, dbOptions(url, process.env, overrides)), { schema })
    cache.set(key, db)
  }
  return db
}
