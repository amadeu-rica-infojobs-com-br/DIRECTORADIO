import { eq, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { stations } from '@/db/schema'
import { isPublicHttpUrl, type Lookup } from '@/lib/net/public-url'

export const HEALTH_HIDE_THRESHOLD = 3

const MAX_REDIRECTS = 3
const OK_APPLICATION_TYPES = [
  'application/ogg',
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
]

function isStreamContentType(contentType: string | null): boolean {
  const type = (contentType ?? '').split(';')[0].trim().toLowerCase()
  return type.startsWith('audio/') || OK_APPLICATION_TYPES.includes(type)
}

export async function checkStream(
  url: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch; lookup?: Lookup } = {},
): Promise<boolean> {
  const { timeoutMs = 8000, fetchImpl = fetch, lookup } = opts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let current = url
    for (let redirects = 0; ; redirects++) {
      if (!(await isPublicHttpUrl(current, lookup))) return false

      const res = await fetchImpl(current, { method: 'GET', redirect: 'manual', signal: controller.signal })
      await res.body?.cancel().catch(() => {})

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        if (!location || redirects >= MAX_REDIRECTS) return false
        current = new URL(location, current).toString()
        continue
      }
      return res.status >= 200 && res.status < 300 && isStreamContentType(res.headers.get('content-type'))
    }
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export async function runHealthCheck(
  db: Db,
  opts: { concurrency?: number; check?: (url: string) => Promise<boolean> } = {},
): Promise<{ checked: number; ok: number; failed: number }> {
  const { concurrency = 20, check = checkStream } = opts

  const rows = await db
    .select({ id: stations.id, streamUrl: stations.streamUrl })
    .from(stations)
    .where(eq(stations.status, 'activa'))

  let next = 0
  let ok = 0
  let failed = 0

  async function worker() {
    while (next < rows.length) {
      const row = rows[next++]
      let healthy: boolean
      try {
        healthy = await check(row.streamUrl)
      } catch {
        healthy = false
      }

      await db
        .update(stations)
        .set({
          healthLastCheckedAt: new Date(),
          healthLastOk: healthy,
          healthConsecutiveFailures: healthy
            ? 0
            : sql`coalesce(${stations.healthConsecutiveFailures}, 0) + 1`,
        })
        .where(eq(stations.id, row.id))

      if (healthy) ok++
      else failed++
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker))
  return { checked: rows.length, ok, failed }
}
