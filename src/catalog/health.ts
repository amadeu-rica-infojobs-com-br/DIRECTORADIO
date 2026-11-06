import { eq, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { stations } from '@/db/schema'
import { isPublicHttpUrl, type Lookup } from '@/lib/net/public-url'
import { pinnedFetch } from '@/lib/net/pinned-dispatcher'
import { isPlayableByPlayer } from '@/lib/stream-policy'

export { HEALTH_HIDE_THRESHOLD } from '@/catalog/constants'

// Por encima de esta tasa de fallos se asume un problema de red propio y no se actualiza nada.
export const HEALTH_ABORT_FAILURE_RATE = 0.5

const MAX_REDIRECTS = 3
export const STREAM_REQUEST_HEADERS = {
  'User-Agent': 'DirectoRadio/0.1 (+https://directoradio.com)',
  'Icy-MetaData': '0',
} as const

export async function checkStream(
  url: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch; lookup?: Lookup } = {},
): Promise<boolean> {
  const { timeoutMs = 8000, fetchImpl = pinnedFetch, lookup } = opts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let current = url
    for (let redirects = 0; ; redirects++) {
      if (!(await isPublicHttpUrl(current, lookup))) return false

      const res = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        headers: STREAM_REQUEST_HEADERS,
        signal: controller.signal,
      })
      await res.body?.cancel().catch(() => {})

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        if (!location || redirects >= MAX_REDIRECTS) return false
        current = new URL(location, current).toString()
        continue
      }
      // El reproductor decide por la URL guardada, así que la salud se mide con esa misma URL.
      return res.status >= 200 && res.status < 300 && isPlayableByPlayer(url, res.headers.get('content-type'))
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
): Promise<{ checked: number; ok: number; failed: number; dbErrors: number; aborted: boolean }> {
  const { concurrency = 20, check = checkStream } = opts
  const workers = Math.max(1, concurrency)

  const rows = await db
    .select({ id: stations.id, streamUrl: stations.streamUrl })
    .from(stations)
    .where(eq(stations.status, 'activa'))

  // Fase 1: comprobar todas las emisoras sin tocar la base de datos.
  const results: Array<{ id: (typeof rows)[number]['id']; healthy: boolean }> = []
  let next = 0

  async function checkWorker() {
    while (next < rows.length) {
      const row = rows[next++]
      let healthy: boolean
      try {
        healthy = await check(row.streamUrl)
      } catch {
        healthy = false
      }
      results.push({ id: row.id, healthy })
    }
  }

  await Promise.all(Array.from({ length: workers }, checkWorker))

  const checked = results.length
  const failed = results.filter((r) => !r.healthy).length
  const ok = checked - failed

  if (checked > 0 && failed / checked > HEALTH_ABORT_FAILURE_RATE) {
    return { checked, ok, failed, dbErrors: 0, aborted: true }
  }

  // Fase 2: aplicar los resultados.
  let dbErrors = 0
  let applied = 0

  async function applyWorker() {
    while (applied < results.length) {
      const { id, healthy } = results[applied++]
      try {
        await db
          .update(stations)
          .set({
            healthLastCheckedAt: new Date(),
            healthLastOk: healthy,
            healthConsecutiveFailures: healthy
              ? 0
              : sql`coalesce(${stations.healthConsecutiveFailures}, 0) + 1`,
          })
          .where(eq(stations.id, id))
      } catch {
        dbErrors++
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, applyWorker))
  return { checked, ok, failed, dbErrors, aborted: false }
}
