// @vitest-environment node
import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { clientKey } from '@/proxy/client-key'

function fakeReq(remoteAddress: string | undefined, headers: Record<string, string> = {}) {
  return { socket: { remoteAddress }, headers } as unknown as IncomingMessage
}

describe('clientKey', () => {
  it('groups ipv6 by /64', () => {
    const a = clientKey(fakeReq('2001:db8:1:2::5'))
    expect(a).toBe('2001:db8:1:2::/64')
    expect(clientKey(fakeReq('2001:db8:1:2:ffff::1'))).toBe(a)
    expect(clientKey(fakeReq('2001:db8:1:3::1'))).not.toBe(a)
  })

  it('normalises case and leading zeros in ipv6', () => {
    expect(clientKey(fakeReq('2001:0DB8:0001:0002:0:0:0:5'))).toBe('2001:db8:1:2::/64')
  })

  it('maps ipv4-mapped addresses', () => {
    expect(clientKey(fakeReq('::ffff:203.0.113.9'))).toBe('203.0.113.9')
  })

  it('returns plain ipv4 and unknown', () => {
    expect(clientKey(fakeReq('198.51.100.7'))).toBe('198.51.100.7')
    expect(clientKey(fakeReq(undefined))).toBe('unknown')
  })

  it('prefers the trusted header, first value trimmed', () => {
    const req = fakeReq('10.0.0.1', { 'fly-client-ip': ' 198.51.100.1 , 10.0.0.2' })
    expect(clientKey(req, 'fly-client-ip')).toBe('198.51.100.1')
    expect(clientKey(req)).toBe('10.0.0.1')
  })

  it('falls back to the socket when the trusted header is missing or invalid', () => {
    expect(clientKey(fakeReq('10.0.0.1'), 'fly-client-ip')).toBe('10.0.0.1')
    expect(clientKey(fakeReq('10.0.0.1', { 'fly-client-ip': 'garbage' }), 'fly-client-ip')).toBe(
      '10.0.0.1',
    )
  })
})
