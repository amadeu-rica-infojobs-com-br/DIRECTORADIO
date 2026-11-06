// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ipKey } from '@/lib/ip-key'

describe('ipKey', () => {
  it('groups ipv6 by /64', () => {
    expect(ipKey('2001:db8:1:2::5')).toBe('2001:db8:1:2::/64')
    expect(ipKey('2001:db8:1:2:ffff::1')).toBe('2001:db8:1:2::/64')
    expect(ipKey('2001:db8:1:3::1')).toBe('2001:db8:1:3::/64')
  })

  it('normalises case and leading zeros in ipv6', () => {
    expect(ipKey('2001:0DB8:0001:0002:0:0:0:5')).toBe('2001:db8:1:2::/64')
  })

  it('maps ipv4-mapped addresses to dotted ipv4', () => {
    expect(ipKey('::ffff:203.0.113.9')).toBe('203.0.113.9')
  })

  it('returns plain ipv4 unchanged', () => {
    expect(ipKey('198.51.100.7')).toBe('198.51.100.7')
  })

  it('returns null for anything that is not an ip', () => {
    expect(ipKey('garbage')).toBeNull()
    expect(ipKey('')).toBeNull()
    expect(ipKey('203.0.113.9, 10.0.0.1')).toBeNull()
  })
})
