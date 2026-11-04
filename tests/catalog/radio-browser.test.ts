// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { fetchAllStations, RADIO_BROWSER_USER_AGENT } from '@/catalog/radio-browser/client'
import { mapRbStation } from '@/catalog/radio-browser/map'
import type { RbStation } from '@/catalog/radio-browser/types'

function rb(overrides: Partial<RbStation> = {}): RbStation {
  return {
    stationuuid: 'uuid-1',
    name: 'Radio Uno',
    url: 'http://example.com/a',
    url_resolved: '',
    homepage: '',
    favicon: '',
    tags: '',
    countrycode: '',
    language: '',
    clickcount: 0,
    lastcheckok: 1,
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('fetchAllStations', () => {
  it('paginates until a short page', async () => {
    const pages = [[rb(), rb()], [rb(), rb()], [rb()]]
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(pages[fetchImpl.mock.calls.length - 1]))

    const result = await fetchAllStations({
      baseUrl: 'https://rb.test',
      pageSize: 2,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toHaveLength(5)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    const urls = fetchImpl.mock.calls.map((c) => new URL(String(c[0])))
    expect(urls.map((u) => u.searchParams.get('offset'))).toEqual(['0', '2', '4'])
    expect(urls[0].origin + urls[0].pathname).toBe('https://rb.test/json/stations')
    expect(urls[0].searchParams.get('hidebroken')).toBe('true')
    expect(urls[0].searchParams.get('order')).toBe('clickcount')
    expect(urls[0].searchParams.get('reverse')).toBe('true')
    expect(urls[0].searchParams.get('limit')).toBe('2')
  })

  it('sends the DirectoRadio user agent', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse([rb()]))

    await fetchAllStations({
      baseUrl: 'https://rb.test',
      pageSize: 2,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(RADIO_BROWSER_USER_AGENT).toBe('DirectoRadio/0.1 (+https://directoradio.com)')
    for (const call of fetchImpl.mock.calls as unknown as [string, RequestInit][]) {
      const headers = new Headers(call[1].headers)
      expect(headers.get('User-Agent')).toBe(RADIO_BROWSER_USER_AGENT)
    }
  })

  it('throws on non-2xx', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}, 503))

    await expect(
      fetchAllStations({
        baseUrl: 'https://rb.test',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/503/)
  })
})

describe('mapRbStation', () => {
  it('prefers url_resolved', () => {
    const mapped = mapRbStation(
      rb({
        url: 'http://example.com/a',
        url_resolved: 'https://example.com/resolved',
        homepage: 'https://example.com',
        favicon: '',
        countrycode: 'es',
        language: 'Spanish, Catalan',
        tags: 'Rock, pop',
        clickcount: 7,
      }),
    )

    expect(mapped).toEqual({
      externalId: 'uuid-1',
      name: 'Radio Uno',
      streamUrl: 'https://example.com/resolved',
      homepageUrl: 'https://example.com',
      logoUrl: null,
      countryCode: 'ES',
      languages: ['spanish', 'catalan'],
      tags: ['rock', 'pop'],
      rbClickCount: 7,
    })
  })

  it('returns null without name or http url', () => {
    expect(mapRbStation(rb({ name: '   ' }))).toBeNull()
    expect(mapRbStation(rb({ url: 'rtsp://x', url_resolved: '' }))).toBeNull()
  })
})
