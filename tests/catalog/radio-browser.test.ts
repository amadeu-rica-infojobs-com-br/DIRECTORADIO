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

  it('passes an abort signal to every page request', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse([rb()]))

    await fetchAllStations({
      baseUrl: 'https://rb.test',
      pageSize: 2,
      timeoutMs: 1234,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const init = fetchImpl.mock.calls[0][1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('rejects when the request times out', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )

    await expect(
      fetchAllStations({
        baseUrl: 'https://rb.test',
        timeoutMs: 20,
        retries: 1,
        retryDelayMs: 0,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ name: 'TimeoutError' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('throws on non-2xx once retries are exhausted', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}, 503))

    await expect(
      fetchAllStations({
        baseUrl: 'https://rb.test',
        retries: 2,
        retryDelayMs: 0,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/503/)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('retries a page after a connection reset and keeps paginating', async () => {
    const reset = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
    })
    const outcomes: (Response | Error)[] = [
      reset,
      reset,
      jsonResponse([rb(), rb()]),
      jsonResponse([rb()]),
    ]
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => {
      const next = outcomes.shift()!
      if (next instanceof Error) throw next
      return next
    })
    const onRetry = vi.fn()

    const result = await fetchAllStations({
      baseUrl: 'https://rb.test',
      pageSize: 2,
      retryDelayMs: 0,
      onRetry,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toHaveLength(3)
    const offsets = fetchImpl.mock.calls.map((c) => new URL(String(c[0])).searchParams.get('offset'))
    expect(offsets).toEqual(['0', '0', '0', '2'])
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.objectContaining({ offset: 0, attempt: 1, error: reset }))
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.objectContaining({ offset: 0, attempt: 2, error: reset }))
  })

  it('retries when the body stream breaks mid-download', async () => {
    let calls = 0
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => {
      calls++
      if (calls === 1) {
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('[{"stationuuid":'))
            controller.error(new Error('read ECONNRESET'))
          },
        })
        return new Response(body, { status: 200 })
      }
      return jsonResponse([rb()])
    })

    const result = await fetchAllStations({
      baseUrl: 'https://rb.test',
      pageSize: 2,
      retryDelayMs: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('retries 429 responses', async () => {
    const outcomes = [jsonResponse({}, 429), jsonResponse([rb()])]
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => outcomes.shift()!)

    const result = await fetchAllStations({
      baseUrl: 'https://rb.test',
      retryDelayMs: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not retry other 4xx responses', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}, 404))

    await expect(
      fetchAllStations({
        baseUrl: 'https://rb.test',
        retryDelayMs: 0,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/404/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('waits with exponential backoff between attempts', async () => {
    vi.useFakeTimers()
    try {
      const outcomes: (Response | Error)[] = [new TypeError('fetch failed'), new TypeError('fetch failed'), jsonResponse([rb()])]
      const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => {
        const next = outcomes.shift()!
        if (next instanceof Error) throw next
        return next
      })
      const onRetry = vi.fn()

      const promise = fetchAllStations({
        baseUrl: 'https://rb.test',
        retryDelayMs: 1000,
        onRetry,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })

      await vi.advanceTimersByTimeAsync(999)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(fetchImpl).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1999)
      expect(fetchImpl).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(fetchImpl).toHaveBeenCalledTimes(3)

      await expect(promise).resolves.toHaveLength(1)
      expect(onRetry.mock.calls.map((c) => c[0].delayMs)).toEqual([1000, 2000])
    } finally {
      vi.useRealTimers()
    }
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
