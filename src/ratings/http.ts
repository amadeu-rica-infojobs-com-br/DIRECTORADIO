import type { Db } from '@/db/client'
import { hashIp } from '@/catalog/plays'
import { clientIpFromHeaders } from '@/lib/client-ip'
import { ipKey } from '@/lib/ip-key'
import type { SendVerification } from './brevo'
import { submitRating } from './submit'
import { readVoter, VOTER_COOKIE } from './voter-cookie'

export const MAX_RATING_BODY_BYTES = 2048

export type RatingHttpConfig = {
  enabled: boolean
  secret: string
  salt: string | undefined
  siteUrl: string
  send: SendVerification
  verifyCaptcha: (token: unknown, ip: string | null) => Promise<boolean>
  revalidate: (path: string) => void
}

const empty = (status: number, headers?: HeadersInit) => new Response(null, { status, headers })

function cookieValue(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

/** POST /api/valoraciones (spec plan 4 §5.2). Lógica separada de la ruta para poder probarla. */
export async function handleRatingPost(db: Db, request: Request, cfg: RatingHttpConfig): Promise<Response> {
  if (!cfg.enabled) return empty(404)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return empty(400)
  if (Number(request.headers.get('content-length') ?? 0) > MAX_RATING_BODY_BYTES) return empty(400)
  const text = await request.text()
  if (Buffer.byteLength(text) > MAX_RATING_BODY_BYTES) return empty(400)

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return empty(400)
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return empty(400)
  const b = body as Record<string, unknown>

  const ip = clientIpFromHeaders(request.headers)
  const ipHash = ip && cfg.salt ? hashIp(ipKey(ip) ?? ip, cfg.salt) : null
  const voterEmail = await readVoter(db, cookieValue(request, VOTER_COOKIE), cfg.secret)

  const result = await submitRating(
    db,
    { stationId: b.stationId, stars: b.stars, email: b.email, acceptedPrivacy: b.acceptedPrivacy, turnstileToken: b.turnstileToken },
    { send: cfg.send, verifyCaptcha: (t) => cfg.verifyCaptcha(t, ip), voterEmail, ipHash, siteUrl: cfg.siteUrl },
  )

  switch (result.status) {
    case 'counted':
      cfg.revalidate(`/emisora/${result.stationSlug}`)
      return Response.json({ status: 'counted' }, { status: 200 })
    case 'pending':
      return Response.json({ status: 'pending', email: result.email }, { status: 202 })
    case 'captcha':
      return Response.json({ status: 'captcha' }, { status: 400 })
    case 'invalid':
      return empty(400)
    case 'not-found':
      return empty(404)
    case 'rate-limited':
      return empty(429, { 'Retry-After': String(result.retryAfter) })
    case 'send-failed':
      return empty(502)
  }
}

/** GET /api/valoraciones/yo: el email de la cookie de votante, para rellenar el formulario. */
export async function handleRatingMe(db: Db, request: Request, cfg: RatingHttpConfig): Promise<Response> {
  if (!cfg.enabled) return empty(404)
  const email = await readVoter(db, cookieValue(request, VOTER_COOKIE), cfg.secret)
  return Response.json({ email }, { headers: { 'Cache-Control': 'no-store' } })
}
