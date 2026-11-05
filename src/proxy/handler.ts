import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web'
import { pipeline } from 'node:stream'
import { STREAM_REQUEST_HEADERS } from '@/catalog/health'
import type { ConnectionLimiter } from '@/proxy/limits'

export type ProxyDeps = {
  findStreamUrl(id: string): Promise<string | null>
  fetchImpl: typeof fetch
  isAllowedUrl(url: string): Promise<boolean>
  limiter: ConnectionLimiter
  webOrigin: string
  headersTimeoutMs: number
}

const MAX_REDIRECTS = 3
const STREAM_PATH = /^\/stream\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
const ACCEPTED_APPLICATION_TYPES = ['application/ogg', 'application/octet-stream']
// audio/* also covers playlist formats (.pls/.m3u/.asx), which are not audio streams.
const PLAYLIST_SUBTYPE = /mpegurl|scpls|x-pls|playlist|x-ms-asx|x-pn-realaudio/

function isAcceptedContentType(contentType: string | null): boolean {
  const type = (contentType ?? '').split(';')[0].trim().toLowerCase()
  if (ACCEPTED_APPLICATION_TYPES.includes(type)) return true
  return type.startsWith('audio/') && !PLAYLIST_SUBTYPE.test(type)
}

export function createProxyHandler(deps: ProxyDeps) {
  const { findStreamUrl, fetchImpl, isAllowedUrl, limiter, webOrigin, headersTimeoutMs } = deps

  const baseHeaders = {
    'Access-Control-Allow-Origin': webOrigin,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  }

  function fail(res: ServerResponse, status: number, extra: Record<string, string> = {}) {
    if (res.headersSent) {
      res.destroy()
      return
    }
    res.writeHead(status, { ...baseHeaders, 'Content-Length': '0', ...extra })
    res.end()
  }

  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? ''
    if (method !== 'GET' && method !== 'OPTIONS') {
      return fail(res, 405, { Allow: 'GET, OPTIONS' })
    }

    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname

    if (method === 'GET' && pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' })
      res.end('ok')
      return
    }

    const match = STREAM_PATH.exec(pathname)
    if (!match) return fail(res, 404)

    if (method === 'OPTIONS') {
      return fail(res, 204, { 'Access-Control-Allow-Methods': 'GET' })
    }

    const ip = req.socket.remoteAddress ?? 'unknown'
    const acquired = limiter.tryAcquire(ip)
    if (acquired === 'per-ip') return fail(res, 429)
    if (acquired === 'total') return fail(res, 503)

    let released = false
    const release = () => {
      if (released) return
      released = true
      limiter.release(ip)
    }

    const controller = new AbortController()
    let timedOut = false
    let timer: NodeJS.Timeout | undefined
    const cleanup = () => {
      clearTimeout(timer)
      controller.abort()
      release()
    }
    // 'close' fires on completion and on client disconnect, so every path ends here.
    res.on('close', cleanup)

    try {
      const streamUrl = await findStreamUrl(match[1])
      if (!streamUrl) return fail(res, 404)

      timer = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, headersTimeoutMs)

      let current = streamUrl
      let upstream: Response
      for (let redirects = 0; ; redirects++) {
        if (!(await isAllowedUrl(current))) return fail(res, 502)

        upstream = await fetchImpl(current, {
          method: 'GET',
          redirect: 'manual',
          headers: STREAM_REQUEST_HEADERS,
          signal: controller.signal,
        })

        if (upstream.status >= 300 && upstream.status < 400) {
          await upstream.body?.cancel().catch(() => {})
          const location = upstream.headers.get('location')
          if (!location || redirects >= MAX_REDIRECTS) return fail(res, 502)
          current = new URL(location, current).toString()
          continue
        }
        break
      }
      clearTimeout(timer)

      if (upstream.status < 200 || upstream.status >= 300 || !upstream.body) {
        await upstream.body?.cancel().catch(() => {})
        return fail(res, 502)
      }

      const contentType = upstream.headers.get('content-type')
      if (!isAcceptedContentType(contentType)) {
        await upstream.body.cancel().catch(() => {})
        return fail(res, 415)
      }

      if (res.destroyed) return
      res.writeHead(200, { ...baseHeaders, 'Content-Type': contentType as string })
      pipeline(Readable.fromWeb(upstream.body as unknown as NodeWebReadableStream), res, (err) => {
        if (err) res.destroy()
      })
    } catch {
      if (res.destroyed) return
      fail(res, timedOut ? 504 : 502)
    }
  }
}
