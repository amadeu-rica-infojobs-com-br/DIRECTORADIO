// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { isPublicHttpUrl } from '@/lib/net/public-url'

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

  it('rejects localhost by resolution', async () => {
    expect(await isPublicHttpUrl('http://localhost:8000/s', async () => ['127.0.0.1'])).toBe(false)
    expect(await isPublicHttpUrl('http://localhost:8000/s', async () => ['::1'])).toBe(false)
  })
})
