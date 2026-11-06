// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { dbOptions, getDb } from '@/db/client'

const POOLED = 'postgres://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/db'
const DIRECT = 'postgres://u:p@ep-x.eu-central-1.aws.neon.tech/db'

describe('dbOptions', () => {
  it('disables prepared statements for pooled urls', () => {
    const opts = dbOptions(POOLED)
    expect(opts.prepare).toBe(false)
    expect(opts.ssl).toBe('verify-full')
    expect(opts.idle_timeout).toBe(20)
  })

  it('keeps defaults locally', () => {
    const opts = dbOptions('postgres://u:p@localhost:5432/db')
    expect(opts.prepare).not.toBe(false)
    expect(opts.ssl).toBeUndefined()
    expect(opts.idle_timeout).toBeUndefined()
  })

  it('reads pool size and statement timeout', () => {
    const opts = dbOptions('postgres://u:p@localhost:5432/db', {
      NODE_ENV: 'test',
      DB_POOL_MAX: '1',
      DB_STATEMENT_TIMEOUT_MS: '5000',
    })
    expect(opts.max).toBe(1)
    expect(opts.connection?.statement_timeout).toBe(5000)
  })

  it('never sends statement_timeout as a startup parameter through a pooler', () => {
    const env = { NODE_ENV: 'test', DB_STATEMENT_TIMEOUT_MS: '5000' } as NodeJS.ProcessEnv
    expect(dbOptions(POOLED, env).connection?.statement_timeout).toBeUndefined()
    expect(dbOptions(DIRECT, { ...env, DB_POOLED: 'true' }).connection?.statement_timeout).toBeUndefined()
    expect(dbOptions(POOLED, env, { statementTimeoutMs: 0 }).connection?.statement_timeout).toBeUndefined()
  })

  it('applies an explicit statement timeout override on direct urls', () => {
    const opts = dbOptions(DIRECT, { NODE_ENV: 'test' } as NodeJS.ProcessEnv, { statementTimeoutMs: 0 })
    expect(opts.connection?.statement_timeout).toBe(0)
    expect(opts.prepare).not.toBe(false)
    expect(opts.ssl).toBe('verify-full')
  })
})

describe('getDb', () => {
  it('caches per url and per overrides', () => {
    const url = 'postgres://u:p@localhost:5432/db'
    expect(getDb(url)).toBe(getDb(url))
    expect(getDb(url, { statementTimeoutMs: 0 })).toBe(getDb(url, { statementTimeoutMs: 0 }))
    expect(getDb(url, { statementTimeoutMs: 0 })).not.toBe(getDb(url))
  })
})
