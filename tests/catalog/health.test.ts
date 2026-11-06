// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { stations } from '@/db/schema'
import { checkStream, runHealthCheck, STREAM_REQUEST_HEADERS } from '@/catalog/health'
import { createTestDb } from '../helpers/db'

const publicLookup = async () => ['93.184.216.34']

function response(status: number, headers: Record<string, string> = {}) {
  return new Response('x', { status, headers })
}

describe('checkStream', () => {
  it('never fetches private addresses', async () => {
    const spy = vi.fn()
    const fetchImpl = spy as unknown as typeof fetch

    expect(
      await checkStream('http://localhost:8000/s', { fetchImpl, lookup: async () => ['127.0.0.1'] }),
    ).toBe(false)
    expect(await checkStream('http://192.168.1.10/s', { fetchImpl })).toBe(false)
    expect(
      await checkStream('http://internal.example/s', { fetchImpl, lookup: async () => ['10.0.0.5'] }),
    ).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects redirect to private address', async () => {
    const fetchImpl = vi.fn(async () =>
      response(302, { location: 'http://127.0.0.1/' }),
    ) as unknown as typeof fetch
    expect(await checkStream('http://stream.example/s', { fetchImpl, lookup: publicLookup })).toBe(
      false,
    )
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('follows relative redirects to a public audio stream', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response(301, { location: '/live' }))
      .mockResolvedValueOnce(response(200, { 'content-type': 'audio/mpeg' })) as unknown as typeof fetch
    expect(await checkStream('http://stream.example/s', { fetchImpl, lookup: publicLookup })).toBe(
      true,
    )
    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[1][0]).toBe('http://stream.example/live')
  })

  it('gives up after 3 redirects', async () => {
    const fetchImpl = vi.fn(async () =>
      response(302, { location: 'http://stream.example/next' }),
    ) as unknown as typeof fetch
    expect(await checkStream('http://stream.example/s', { fetchImpl, lookup: publicLookup })).toBe(
      false,
    )
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('sends DirectoRadio headers', async () => {
    const fetchImpl = vi.fn(async () =>
      response(302, { location: '/live' }),
    ) as unknown as typeof fetch
    await checkStream('http://stream.example/s', { fetchImpl, lookup: publicLookup, timeoutMs: 1000 })
    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.length).toBeGreaterThan(1)
    for (const [, init] of calls) {
      expect(init.headers).toEqual(STREAM_REQUEST_HEADERS)
    }
    expect(STREAM_REQUEST_HEADERS).toEqual({
      'User-Agent': 'DirectoRadio/0.1 (+https://directoradio.com)',
      'Icy-MetaData': '0',
    })
  })

  it('accepts octet-stream', async () => {
    const fetchImpl = (async () =>
      response(200, { 'content-type': 'application/octet-stream' })) as unknown as typeof fetch
    expect(await checkStream('http://stream.example/s', { fetchImpl, lookup: publicLookup })).toBe(
      true,
    )
  })

  it('accepts audio content types', async () => {
    const check = (status: number, type?: string) =>
      checkStream('http://stream.example/s', {
        lookup: publicLookup,
        fetchImpl: (async () =>
          response(status, type ? { 'content-type': type } : {})) as unknown as typeof fetch,
      })
    expect(await check(200, 'audio/mpeg')).toBe(true)
    expect(await check(200, 'audio/aacp')).toBe(true)
    expect(await check(200, 'application/ogg')).toBe(true)
    expect(await check(200, 'text/html')).toBe(false)
    expect(await check(200)).toBe(false)
    expect(await check(404, 'audio/mpeg')).toBe(false)
  })

  it('only marks ok what the player can actually play', async () => {
    const check = (url: string, type: string) =>
      checkStream(url, {
        lookup: publicLookup,
        fetchImpl: (async () => response(200, { 'content-type': type })) as unknown as typeof fetch,
      })
    // El reproductor no proxia segmentos HLS, así que http + HLS no es reproducible.
    expect(await check('http://stream.example/live.m3u8', 'application/vnd.apple.mpegurl')).toBe(false)
    expect(await check('http://stream.example/s', 'application/x-mpegurl')).toBe(false)
    expect(await check('https://stream.example/live.m3u8', 'application/vnd.apple.mpegurl')).toBe(true)
    expect(await check('https://stream.example/s', 'application/x-mpegurl')).toBe(true)
    // Listas de reproducción: el reproductor no las interpreta.
    expect(await check('http://stream.example/lista.pls', 'audio/x-scpls')).toBe(false)
    expect(await check('https://stream.example/lista.m3u', 'audio/mpeg')).toBe(false)
    expect(await check('https://stream.example/s', 'audio/x-scpls')).toBe(false)
  })

  it('returns false on fetch errors and timeouts', async () => {
    const failing = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    expect(
      await checkStream('http://stream.example/s', { fetchImpl: failing, lookup: publicLookup }),
    ).toBe(false)

    const hanging = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })) as unknown as typeof fetch
    expect(
      await checkStream('http://stream.example/s', {
        fetchImpl: hanging,
        lookup: publicLookup,
        timeoutMs: 20,
      }),
    ).toBe(false)
  })

  it('cancels the response body after reading headers', async () => {
    const cancel = vi.fn(async () => {})
    const res = { status: 200, headers: new Headers({ 'content-type': 'audio/mpeg' }), body: { cancel } }
    const fetchImpl = (async () => res) as unknown as typeof fetch
    expect(await checkStream('http://stream.example/s', { fetchImpl, lookup: publicLookup })).toBe(
      true,
    )
    expect(cancel).toHaveBeenCalled()
  })
})

describe('runHealthCheck', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    ctx ??= await createTestDb()
    await ctx.reset()
  })

  afterAll(async () => {
    await ctx?.close()
  })

  function station(slug: string, extra: Partial<typeof stations.$inferInsert> = {}) {
    return {
      slug,
      name: slug,
      streamUrl: `https://stream.example/${slug}`,
      source: 'radio-browser',
      externalId: slug,
      ...extra,
    }
  }

  it('updates counters', async () => {
    await ctx.db.insert(stations).values([
      station('failing', { healthConsecutiveFailures: 2 }),
      station('recovering', { healthConsecutiveFailures: 2 }),
      station('inactive', { status: 'desactivada', healthConsecutiveFailures: 2 }),
    ])

    const report = await runHealthCheck(ctx.db, {
      concurrency: 2,
      check: async (url) => url.endsWith('/recovering'),
    })

    expect(report).toEqual({ checked: 2, ok: 1, failed: 1, dbErrors: 0, aborted: false })
    const get = async (slug: string) =>
      (await ctx.db.select().from(stations).where(eq(stations.slug, slug)))[0]

    const failing = await get('failing')
    expect(failing.healthConsecutiveFailures).toBe(3)
    expect(failing.healthLastOk).toBe(false)
    expect(failing.healthLastCheckedAt).toBeInstanceOf(Date)

    const recovering = await get('recovering')
    expect(recovering.healthConsecutiveFailures).toBe(0)
    expect(recovering.healthLastOk).toBe(true)
    expect(recovering.healthLastCheckedAt).toBeInstanceOf(Date)

    const inactive = await get('inactive')
    expect(inactive.healthConsecutiveFailures).toBe(2)
    expect(inactive.healthLastCheckedAt).toBeNull()
  })

  it('treats a throwing check as a failure and respects the concurrency bound', async () => {
    await ctx.db.insert(stations).values(['a', 'b', 'c', 'd', 'e'].map((s) => station(s)))
    let running = 0
    let peak = 0
    const report = await runHealthCheck(ctx.db, {
      concurrency: 2,
      check: async (url) => {
        running++
        peak = Math.max(peak, running)
        await new Promise((r) => setTimeout(r, 10))
        running--
        if (url.endsWith('/a')) throw new Error('boom')
        return true
      },
    })
    expect(report).toEqual({ checked: 5, ok: 4, failed: 1, dbErrors: 0, aborted: false })
    expect(peak).toBeLessThanOrEqual(2)
  })

  it('continues after a db error', async () => {
    await ctx.db.insert(stations).values(['a', 'b', 'c'].map((s) => station(s)))
    let updates = 0
    const flakyDb = new Proxy(ctx.db, {
      get(target, prop, receiver) {
        if (prop !== 'update') return Reflect.get(target, prop, receiver)
        return (table: typeof stations) => {
          if (++updates === 2) throw new Error('db down')
          return target.update(table)
        }
      },
    })

    const report = await runHealthCheck(flakyDb, { concurrency: 1, check: async () => true })

    expect(report).toEqual({ checked: 3, ok: 3, failed: 0, dbErrors: 1, aborted: false })
    const rows = await ctx.db.select().from(stations)
    const updated = rows.filter((r) => r.healthLastCheckedAt !== null).map((r) => r.slug).sort()
    expect(updated).toEqual(['a', 'c'])
  })

  it('aborts when failure rate is too high', async () => {
    await ctx.db.insert(stations).values(['a', 'b', 'c', 'd'].map((s) => station(s)))

    const report = await runHealthCheck(ctx.db, {
      concurrency: 2,
      check: async (url) => url.endsWith('/a'),
    })

    expect(report).toEqual({ checked: 4, ok: 1, failed: 3, dbErrors: 0, aborted: true })
    const rows = await ctx.db.select().from(stations)
    for (const r of rows) {
      expect(r.healthConsecutiveFailures ?? 0).toBe(0)
      expect(r.healthLastCheckedAt).toBeNull()
    }
  })

  it('applies when failure rate is acceptable', async () => {
    await ctx.db.insert(stations).values(['a', 'b', 'c', 'd'].map((s) => station(s)))

    const report = await runHealthCheck(ctx.db, {
      concurrency: 2,
      check: async (url) => !url.endsWith('/a'),
    })

    expect(report).toEqual({ checked: 4, ok: 3, failed: 1, dbErrors: 0, aborted: false })
    const a = (await ctx.db.select().from(stations).where(eq(stations.slug, 'a')))[0]
    expect(a.healthConsecutiveFailures).toBe(1)
    expect(a.healthLastCheckedAt).toBeInstanceOf(Date)
  })

  it('does not abort when there is nothing to check', async () => {
    const report = await runHealthCheck(ctx.db, { check: async () => false })
    expect(report).toEqual({ checked: 0, ok: 0, failed: 0, dbErrors: 0, aborted: false })
  })
})
