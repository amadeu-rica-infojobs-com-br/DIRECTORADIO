import type { Db } from '@/db/client'
import { recordPlay } from '@/catalog/plays'
import { isUuid } from '@/lib/uuid'

export const MAX_BODY_BYTES = 1024

const status = (code: number) => new Response(null, { status: code })

export async function handlePlay(db: Db, request: Request): Promise<Response> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return status(400)
  }

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return status(400)
  const text = await request.text()
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return status(400)

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return status(400)
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return status(400)

  const { stationId, sessionId } = body as Record<string, unknown>
  if (!isUuid(stationId) || !isUuid(sessionId)) return status(400)

  const result = await recordPlay(db, stationId, sessionId)
  return status(result === 'not-found' ? 404 : 204)
}
