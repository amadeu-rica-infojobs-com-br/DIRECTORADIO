// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { isPublicHttpUrl, isPublicIp } from '@/lib/net/public-url'

const publicLookup = async () => ['93.184.216.34']

describe('isPublicHttpUrl', () => {
  it('accepts public http and https urls', async () => {
    expect(await isPublicHttpUrl('http://stream.example/s', publicLookup)).toBe(true)
    expect(await isPublicHttpUrl('https://stream.example/s', publicLookup)).toBe(true)
    expect(await isPublicHttpUrl('http://93.184.216.34:8000/s')).toBe(true)
  })

  it('rejects non-http protocols and invalid urls', async () => {
    expect(await isPublicHttpUrl('ftp://stream.example/s', publicLookup)).toBe(false)
    expect(await isPublicHttpUrl('file:///etc/passwd', publicLookup)).toBe(false)
    expect(await isPublicHttpUrl('not a url', publicLookup)).toBe(false)
  })

  it.each([
    '127.0.0.1',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.10',
    '169.254.169.254',
    '0.0.0.0',
    '0.1.2.3',
    '100.64.0.1',
    '100.127.255.255',
    '224.0.0.1',
    '239.255.255.255',
    '240.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    'ff02::1',
    '::ffff:10.0.0.5',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
  ])('rejects resolved address %s', async (ip) => {
    expect(await isPublicHttpUrl('http://host.example/s', async () => [ip])).toBe(false)
  })

  it.each(['172.15.255.255', '172.32.0.1', '100.63.255.255', '100.128.0.1', '223.255.255.255'])(
    'accepts public edge address %s',
    async (ip) => {
      expect(await isPublicHttpUrl('http://host.example/s', async () => [ip])).toBe(true)
    },
  )

  it('accepts public ipv6 and mapped public ipv4', async () => {
    expect(await isPublicHttpUrl('http://host.example/s', async () => ['2606:4700::1111'])).toBe(
      true,
    )
    expect(await isPublicHttpUrl('http://host.example/s', async () => ['::ffff:93.184.216.34'])).toBe(
      true,
    )
  })

  it('rejects when any resolved address is non-public', async () => {
    expect(
      await isPublicHttpUrl('http://host.example/s', async () => ['93.184.216.34', '10.0.0.5']),
    ).toBe(false)
  })

  it('rejects when lookup throws or returns no addresses', async () => {
    const failing = async () => {
      throw new Error('ENOTFOUND')
    }
    expect(await isPublicHttpUrl('http://host.example/s', failing)).toBe(false)
    expect(await isPublicHttpUrl('http://host.example/s', async () => [])).toBe(false)
  })

  it('checks literal IPs without DNS', async () => {
    const lookup = vi.fn(publicLookup)
    expect(await isPublicHttpUrl('http://[::1]/', lookup)).toBe(false)
    expect(await isPublicHttpUrl('http://127.0.0.1/', lookup)).toBe(false)
    expect(await isPublicHttpUrl('http://[::ffff:10.0.0.5]/', lookup)).toBe(false)
    expect(await isPublicHttpUrl('http://[::ffff:127.0.0.1]:8000/', lookup)).toBe(false)
    expect(await isPublicHttpUrl('http://[2606:4700::1111]/', lookup)).toBe(true)
    expect(lookup).not.toHaveBeenCalled()
  })

  it('rejects transition ranges', () => {
    for (const ip of [
      '2002:0a00:0001::1',
      '2001:0:4136:e378::1',
      '::ffff:0:a00:5',
      '198.18.0.1',
      '198.19.255.255',
      '192.0.0.1',
      '192.0.2.10',
      '198.51.100.7',
      '203.0.113.9',
      '2001:db8::1',
    ]) {
      expect(isPublicIp(ip), ip).toBe(false)
    }
    expect(isPublicIp('2002:0808:0808::1')).toBe(true)
    expect(isPublicIp('::ffff:0:808:808')).toBe(true)
    expect(isPublicIp('2001:4860::1')).toBe(true)
    expect(isPublicIp('not an ip')).toBe(false)
  })

  it('uses the default lookup when none is given', async () => {
    expect(await isPublicHttpUrl('http://localhost:8000/')).toBe(false)
  })

  it('rejects localhost by resolution', async () => {
    expect(await isPublicHttpUrl('http://localhost:8000/s', async () => ['127.0.0.1'])).toBe(false)
    expect(await isPublicHttpUrl('http://localhost:8000/s', async () => ['::1'])).toBe(false)
  })
})
