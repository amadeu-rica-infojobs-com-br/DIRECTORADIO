import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web'
import { pipeline } from 'node:stream'
import { STREAM_REQUEST_HEADERS } from '@/catalog/health'
import { isProxyableAudioContentType } from '@/lib/stream-policy'
import type { ConnectionLimiter } from '@/proxy/limits'

export type ProxyDeps = {
  findStreamUrl(id: string): Promise<string | null>
  fetchImpl: typeof fetch
  isAllowedUrl(url: string): Promise<boolean>
  limiter: ConnectionLimiter
  webOrigin: string
  headersTimeoutMs: number
  lookupTimeoutMs: number
  clientKey(req: IncomingMessage): string
  log(entry: { status: number; stationId: string | null; reason: string }): void
}

const MAX_REDIRECTS = 3
const RETRY_AFTER_SECONDS = '30'
const STREAM_PATH = /^\/stream\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

class LookupTimeoutError extends Error {}

function safeOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function createProxyHandler(deps: ProxyDeps) {
  const {
    findStreamUrl,
    fetchImpl,
    isAllowedUrl,
    limiter,
    webOrigin,
    headersTimeoutMs,
    lookupTimeoutMs,
    log,
  } = deps
  const allowedOrigin = safeOrigin(webOrigin)

  const baseHeaders = {
    'Access-Control-Allow-Origin': webOrigin,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  }

  function fail(
    res: ServerResponse,
    status: number,
    reason: string | null,
    stationId: string | null,
    extra: Record<string, string> = {},
  ) {
    if (res.headersSent) {
      res.destroy()
      return
    }
    if (reason) log({ status, stationId, reason })
    const retry = status === 429 || status === 503 ? { 'Retry-After': RETRY_AFTER_SECONDS } : {}
    res.writeHead(status, { ...baseHeaders, 'Content-Length': '0', ...retry, ...extra })
    res.end()
  }

  async function lookup(id: string): Promise<string | null> {
    let timer: NodeJS.Timeout | undefined
    const pending = findStreamUrl(id)
    // A lookup that loses the race must not surface as an unhandled rejection.
    pending.catch(() => {})
    try {
      return await Promise.race([
        pending,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new LookupTimeoutError()), lookupTimeoutMs)
        }),
      ])
    } finally {
      clearTimeout(timer)
    }
  }

  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? ''
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    const match = STREAM_PATH.exec(pathname)
    const stationId = match ? match[1] : null

    if (method !== 'GET' && method !== 'OPTIONS') {
      return fail(res, 405, 'method', stationId, { Allow: 'GET, OPTIONS' })
    }

    if (method === 'GET' && pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' })
      res.end('ok')
      return
    }

    if (!match) return fail(res, 404, 'not_found', null)

    if (method === 'OPTIONS') {
      return fail(res, 204, null, stationId, { 'Access-Control-Allow-Methods': 'GET' })
    }

    const referer = req.headers.referer
    if (referer && (allowedOrigin === null || safeOrigin(referer) !== allowedOrigin)) {
      return fail(res, 403, 'foreign_referer', stationId)
    }

    const key = deps.clientKey(req)
    const acquired = limiter.tryAcquire(key)
    if (acquired === 'per-ip') return fail(res, 429, 'per_ip_limit', stationId)
    if (acquired === 'total') return fail(res, 503, 'total_limit', stationId)

    let released = false
    const release = () => {
      if (released) return
      released = true
      limiter.release(key)
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
      let streamUrl: string | null
      try {
        streamUrl = await lookup(match[1])
      } catch (err) {
        return fail(
          res,
          503,
          err instanceof LookupTimeoutError ? 'lookup_timeout' : 'lookup_error',
          stationId,
        )
      }
      if (!streamUrl) return fail(res, 404, 'not_found', stationId)

      timer = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, headersTimeoutMs)

      let current = streamUrl
      let upstream: Response
      for (let redirects = 0; ; redirects++) {
        if (!(await isAllowedUrl(current))) return fail(res, 502, 'blocked_url', stationId)

        upstream = await fetchImpl(current, {
          method: 'GET',
          redirect: 'manual',
          headers: STREAM_REQUEST_HEADERS,
          signal: controller.signal,
        })

        if (upstream.status >= 300 && upstream.status < 400) {
          await upstream.body?.cancel().catch(() => {})
          const location = upstream.headers.get('location')
          if (!location || redirects >= MAX_REDIRECTS) {
            return fail(res, 502, 'too_many_redirects', stationId)
          }
          current = new URL(location, current).toString()
          continue
        }
        break
      }
      clearTimeout(timer)

      if (upstream.status < 200 || upstream.status >= 300 || !upstream.body) {
        await upstream.body?.cancel().catch(() => {})
        return fail(res, 502, 'upstream_status', stationId)
      }

      const contentType = upstream.headers.get('content-type')
      if (!isProxyableAudioContentType(contentType)) {
        await upstream.body.cancel().catch(() => {})
        return fail(res, 415, 'unsupported_type', stationId)
      }

      if (res.destroyed) return
      res.writeHead(200, { ...baseHeaders, 'Content-Type': contentType as string })
      pipeline(Readable.fromWeb(upstream.body as unknown as NodeWebReadableStream), res, (err) => {
        if (err) res.destroy()
      })
    } catch {
      if (res.destroyed) return
      if (timedOut) fail(res, 504, 'headers_timeout', stationId)
      else fail(res, 502, 'upstream_error', stationId)
    }
  }
}
