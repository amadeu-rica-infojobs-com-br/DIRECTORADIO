// @vitest-environment node
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createProxyHandler, type ProxyDeps } from '@/proxy/handler'
import { ConnectionLimiter } from '@/proxy/limits'

const WEB_ORIGIN = 'http://localhost:3000'
const ID_AUDIO = '11111111-1111-4111-8111-111111111111'
const ID_HTML = '22222222-2222-4222-8222-222222222222'
const ID_PLS = '33333333-3333-4333-8333-333333333333'
const ID_REDIRECT = '44444444-4444-4444-8444-444444444444'
const ID_500 = '55555555-5555-4555-8555-555555555555'
const ID_HANG = '66666666-6666-4666-8666-666666666666'
const ID_UNKNOWN = '77777777-7777-4777-8777-777777777777'

const servers: http.Server[] = []
const sockets = new Set<import('node:net').Socket>()
let upstreamClosed: Promise<void>
let markUpstreamClosed: () => void

function listen(server: http.Server): Promise<number> {
  servers.push(server)
  server.on('connection', (s) => {
    sockets.add(s)
    s.on('close', () => sockets.delete(s))
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port))
  })
}

async function startUpstream(): Promise<string> {
  upstreamClosed = new Promise((resolve) => {
    markUpstreamClosed = resolve
  })
  const upstream = http.createServer((req, res) => {
    switch (req.url) {
      case '/audio': {
        res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Set-Cookie': 'a=b', 'icy-name': 'x' })
        const timer = setInterval(() => res.write(Buffer.alloc(64, 1)), 50)
        res.on('close', () => {
          clearInterval(timer)
          markUpstreamClosed()
        })
        res.write(Buffer.alloc(64, 1))
        return
      }
      case '/html':
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html></html>')
        return
      case '/pls':
        res.writeHead(200, { 'Content-Type': 'audio/x-scpls' })
        res.end('[playlist]')
        return
      case '/redirect-private':
        res.writeHead(302, { Location: 'http://10.0.0.1/' })
        res.end()
        return
      case '/500':
        res.writeHead(500)
        res.end()
        return
      case '/hang':
        return
      default:
        res.writeHead(404)
        res.end()
    }
  })
  const port = await listen(upstream)
  return `http://127.0.0.1:${port}`
}

async function startProxy(overrides: Partial<ProxyDeps> = {}) {
  const base = await startUpstream()
  const urls: Record<string, string> = {
    [ID_AUDIO]: `${base}/audio`,
    [ID_HTML]: `${base}/html`,
    [ID_PLS]: `${base}/pls`,
    [ID_REDIRECT]: `${base}/redirect-private`,
    [ID_500]: `${base}/500`,
    [ID_HANG]: `${base}/hang`,
  }
  const limiter = overrides.limiter ?? new ConnectionLimiter(3, 200)
  const deps: ProxyDeps = {
    findStreamUrl: async (id) => urls[id] ?? null,
    fetchImpl: fetch,
    isAllowedUrl: async (url) => new URL(url).hostname !== '10.0.0.1',
    limiter,
    webOrigin: WEB_ORIGIN,
    headersTimeoutMs: 10000,
    ...overrides,
  }
  const port = await listen(http.createServer(createProxyHandler(deps)))
  return { proxy: `http://127.0.0.1:${port}`, limiter }
}

afterEach(async () => {
  for (const s of sockets) s.destroy()
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))))
})

describe('audio proxy handler', () => {
  it('streams audio with safe headers', async () => {
    const { proxy } = await startProxy()
    const ac = new AbortController()
    const res = await fetch(`${proxy}/stream/${ID_AUDIO}`, { signal: ac.signal })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('audio/mpeg')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('access-control-allow-origin')).toBe(WEB_ORIGIN)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('set-cookie')).toBeNull()
    expect([...res.headers.keys()].some((k) => k.startsWith('icy-'))).toBe(false)

    const reader = res.body!.getReader()
    let chunks = 0
    while (chunks < 2) {
      const { done } = await reader.read()
      if (done) break
      chunks++
    }
    expect(chunks).toBeGreaterThanOrEqual(2)
    ac.abort()
  })

  it('rejects non-audio upstream', async () => {
    const { proxy } = await startProxy()
    for (const id of [ID_HTML, ID_PLS]) {
      const res = await fetch(`${proxy}/stream/${id}`)
      expect(res.status).toBe(415)
      expect(await res.text()).toBe('')
    }
  })

  it('returns 404 for unknown or inactive station', async () => {
    const { proxy } = await startProxy()
    expect((await fetch(`${proxy}/stream/${ID_UNKNOWN}`)).status).toBe(404)
  })

  it('returns 404 for malformed id', async () => {
    const { proxy } = await startProxy()
    expect((await fetch(`${proxy}/stream/abc`)).status).toBe(404)
    expect((await fetch(`${proxy}/other`)).status).toBe(404)
  })

  it('blocks redirect to private address', async () => {
    const { proxy } = await startProxy()
    expect((await fetch(`${proxy}/stream/${ID_REDIRECT}`)).status).toBe(502)
  })

  it('returns 502 when upstream is not 2xx', async () => {
    const { proxy } = await startProxy()
    expect((await fetch(`${proxy}/stream/${ID_500}`)).status).toBe(502)
  })

  it('returns 502 when the stored url is not public', async () => {
    const { proxy } = await startProxy({ isAllowedUrl: async () => false })
    expect((await fetch(`${proxy}/stream/${ID_AUDIO}`)).status).toBe(502)
  })

  it('aborts upstream when client disconnects', async () => {
    const { proxy, limiter } = await startProxy()
    const ac = new AbortController()
    const res = await fetch(`${proxy}/stream/${ID_AUDIO}`, { signal: ac.signal })
    const reader = res.body!.getReader()
    await reader.read()
    expect(limiter.count()).toBe(1)
    ac.abort()
    reader.cancel().catch(() => {})
    const started = Date.now()
    await Promise.race([
      upstreamClosed,
      new Promise((_, reject) => setTimeout(() => reject(new Error('upstream not closed')), 500)),
    ])
    while (limiter.count() !== 0 && Date.now() - started < 500) {
      await new Promise((r) => setTimeout(r, 10))
    }
    expect(limiter.count()).toBe(0)
  })

  it('enforces per-ip limit', async () => {
    const { proxy } = await startProxy({ limiter: new ConnectionLimiter(1, 200) })
    const ac = new AbortController()
    const first = await fetch(`${proxy}/stream/${ID_AUDIO}`, { signal: ac.signal })
    expect(first.status).toBe(200)
    const second = await fetch(`${proxy}/stream/${ID_AUDIO}`)
    expect(second.status).toBe(429)
    ac.abort()
  })

  it('returns 503 when the global limit is reached', async () => {
    const { proxy } = await startProxy({ limiter: new ConnectionLimiter(5, 1) })
    const ac = new AbortController()
    const first = await fetch(`${proxy}/stream/${ID_AUDIO}`, { signal: ac.signal })
    expect(first.status).toBe(200)
    expect((await fetch(`${proxy}/stream/${ID_AUDIO}`)).status).toBe(503)
    ac.abort()
  })

  it('times out waiting for headers', async () => {
    const { proxy, limiter } = await startProxy({ headersTimeoutMs: 200 })
    const res = await fetch(`${proxy}/stream/${ID_HANG}`)
    expect(res.status).toBe(504)
    expect(limiter.count()).toBe(0)
  })

  it('rejects methods other than GET and OPTIONS', async () => {
    const { proxy } = await startProxy()
    expect((await fetch(`${proxy}/stream/${ID_AUDIO}`, { method: 'POST' })).status).toBe(405)
    expect((await fetch(`${proxy}/stream/${ID_AUDIO}`, { method: 'HEAD' })).status).toBe(405)
  })

  it('answers CORS preflight', async () => {
    const { proxy } = await startProxy()
    const res = await fetch(`${proxy}/stream/${ID_AUDIO}`, { method: 'OPTIONS' })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe(WEB_ORIGIN)
    expect(res.headers.get('access-control-allow-methods')).toBe('GET')
  })

  it('answers /healthz', async () => {
    const { proxy } = await startProxy()
    const res = await fetch(`${proxy}/healthz`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })
})
