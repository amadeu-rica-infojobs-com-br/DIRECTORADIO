// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { ratingHttpConfig } from '@/ratings/http-config'

afterEach(() => vi.unstubAllEnvs())

describe('ratingHttpConfig', () => {
  it('keeps ratings off without the IP salt, so the per-IP limits can never be skipped', () => {
    vi.stubEnv('RATINGS_ENABLED', 'true')
    vi.stubEnv('RATINGS_SECRET', 's')
    vi.stubEnv('PLAYS_IP_SALT', '')
    expect(ratingHttpConfig().enabled).toBe(false)
    vi.stubEnv('PLAYS_IP_SALT', 'salt')
    expect(ratingHttpConfig().enabled).toBe(true)
  })
})
