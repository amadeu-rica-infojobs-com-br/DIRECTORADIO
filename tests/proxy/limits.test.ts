// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ConnectionLimiter } from '@/proxy/limits'

describe('ConnectionLimiter', () => {
  it('acquires up to the per-ip limit then reports per-ip', () => {
    const l = new ConnectionLimiter(2, 10)
    expect(l.tryAcquire('a')).toBe('ok')
    expect(l.tryAcquire('a')).toBe('ok')
    expect(l.tryAcquire('a')).toBe('per-ip')
    expect(l.count('a')).toBe(2)
    expect(l.count()).toBe(2)
  })

  it('tracks ips independently', () => {
    const l = new ConnectionLimiter(1, 10)
    expect(l.tryAcquire('a')).toBe('ok')
    expect(l.tryAcquire('b')).toBe('ok')
    expect(l.count('a')).toBe(1)
    expect(l.count('b')).toBe(1)
  })

  it('releases a slot so it can be acquired again', () => {
    const l = new ConnectionLimiter(1, 10)
    l.tryAcquire('a')
    l.release('a')
    expect(l.count('a')).toBe(0)
    expect(l.count()).toBe(0)
    expect(l.tryAcquire('a')).toBe('ok')
  })

  it('enforces the global limit', () => {
    const l = new ConnectionLimiter(5, 2)
    expect(l.tryAcquire('a')).toBe('ok')
    expect(l.tryAcquire('b')).toBe('ok')
    expect(l.tryAcquire('c')).toBe('total')
    expect(l.count()).toBe(2)
  })

  it('ignores release of an unknown ip', () => {
    const l = new ConnectionLimiter(1, 1)
    l.release('x')
    expect(l.count()).toBe(0)
    expect(l.count('x')).toBe(0)
  })
})
