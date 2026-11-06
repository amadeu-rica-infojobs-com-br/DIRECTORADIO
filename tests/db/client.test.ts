// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { dbOptions } from '@/db/client'

describe('dbOptions', () => {
  it('disables prepared statements for pooled urls', () => {
    const opts = dbOptions('postgres://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/db')
    expect(opts.prepare).toBe(false)
    expect(opts.ssl).toBe('require')
  })

  it('keeps defaults locally', () => {
    const opts = dbOptions('postgres://u:p@localhost:5432/db')
    expect(opts.prepare).not.toBe(false)
    expect(opts.ssl).toBeUndefined()
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
})
