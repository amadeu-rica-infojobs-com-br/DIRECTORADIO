import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { ratingAttempts, ratings, stations } from '@/db/schema'
import { isUuid } from '@/lib/uuid'
import { recomputeStationRating } from './aggregate'
import type { SendVerification } from './brevo'
import { normalizeEmail } from './email'
import { newToken } from './token'

export const RATING_LIMITS = { ipHour: 10, ipDay: 30, emailDay: 5 } as const
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

export type SubmitInput = {
  stationId: unknown
  stars: unknown
  email: unknown
  acceptedPrivacy: unknown
  turnstileToken: unknown
}

export type SubmitDeps = {
  send: SendVerification
  verifyCaptcha: (token: unknown) => Promise<boolean>
  /** Email de una cookie de votante válida (readVoter), o null. */
  voterEmail: string | null
  ipHash: string | null
  siteUrl: string
  now?: Date
}

export type SubmitResult =
  | { status: 'counted'; stationSlug: string }
  | { status: 'pending'; email: string }
  | { status: 'invalid' }
  | { status: 'captcha' }
  | { status: 'not-found' }
  | { status: 'rate-limited'; retryAfter: number }
  | { status: 'send-failed' }

type Pending = { attemptId: number; tokenHash: string; token: string; stationId: string; stationName: string; email: string; stars: number }

/** Envío de una valoración (spec plan 4 §5.2 y §5.4). El orden de las comprobaciones es parte del diseño. */
export async function submitRating(db: Db, input: SubmitInput, deps: SubmitDeps): Promise<SubmitResult> {
  const email = normalizeEmail(input.email)
  const stars = input.stars
  if (
    !isUuid(input.stationId) ||
    typeof stars !== 'number' ||
    !Number.isInteger(stars) ||
    stars < 1 ||
    stars > 5 ||
    !email ||
    input.acceptedPrivacy !== true
  ) {
    return { status: 'invalid' }
  }
  const stationId = input.stationId
  if (!(await deps.verifyCaptcha(input.turnstileToken))) return { status: 'captcha' }

  const now = deps.now ?? new Date()
  // En SQL crudo, Date se enviaría como texto de toString(): se pasa en ISO.
  const nowIso = now.toISOString()
  const direct = deps.voterEmail === email

  const outcome = await db.transaction(async (tx): Promise<SubmitResult | Pending> => {
    // Serializa por IP (o por email si no hay IP) la cuenta y el registro del intento.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'rating:' + (deps.ipHash ?? email)}))`)

    if (deps.ipHash) {
      const [c] = await tx
        .select({
          hour: sql<number>`count(*) filter (where ${ratingAttempts.createdAt} > ${nowIso}::timestamptz - interval '1 hour')`.mapWith(Number),
          day: sql<number>`count(*)`.mapWith(Number),
        })
        .from(ratingAttempts)
        .where(and(eq(ratingAttempts.ipHash, deps.ipHash), sql`${ratingAttempts.createdAt} > ${nowIso}::timestamptz - interval '24 hours'`))
      if (c.hour >= RATING_LIMITS.ipHour || c.day >= RATING_LIMITS.ipDay) return { status: 'rate-limited', retryAfter: 3600 }
    }

    const [station] = await tx
      .select({ id: stations.id, slug: stations.slug, name: stations.name })
      .from(stations)
      .where(and(eq(stations.id, stationId), eq(stations.status, 'activa')))
      .for('no key update')
    if (!station) return { status: 'not-found' }

    if (direct) {
      await tx.insert(ratingAttempts).values({ ipHash: deps.ipHash, email, sentEmail: false, createdAt: now })
      await tx.delete(ratings).where(and(eq(ratings.stationId, stationId), eq(ratings.email, email)))
      await tx.insert(ratings).values({
        stationId,
        email,
        stars,
        status: 'verified',
        privacyAcceptedAt: now,
        ipHash: deps.ipHash,
        createdAt: now,
        updatedAt: now,
      })
      await recomputeStationRating(tx, stationId)
      return { status: 'counted', stationSlug: station.slug }
    }

    // El límite de emails por dirección se serializa por email, porque puede llegar desde varias IP.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'rating-email:' + email}))`)
    const [sent] = await tx
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(ratingAttempts)
      .where(
        and(
          eq(ratingAttempts.email, email),
          eq(ratingAttempts.sentEmail, true),
          sql`${ratingAttempts.createdAt} > ${nowIso}::timestamptz - interval '24 hours'`,
        ),
      )
    if (sent.n >= RATING_LIMITS.emailDay) return { status: 'rate-limited', retryAfter: 3600 }

    const [attempt] = await tx
      .insert(ratingAttempts)
      .values({ ipHash: deps.ipHash, email, sentEmail: true, createdAt: now })
      .returning({ id: ratingAttempts.id })
    const { token, hash } = newToken()
    await tx
      .insert(ratings)
      .values({
        stationId,
        email,
        stars,
        status: 'pending',
        tokenHash: hash,
        tokenExpiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
        privacyAcceptedAt: now,
        ipHash: deps.ipHash,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [ratings.stationId, ratings.email, ratings.status],
        set: {
          stars,
          tokenHash: hash,
          tokenExpiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
          privacyAcceptedAt: now,
          ipHash: deps.ipHash,
          updatedAt: now,
        },
      })
    return { attemptId: attempt.id, tokenHash: hash, token, stationId, stationName: station.name, email, stars }
  })

  if ('status' in outcome) return outcome

  const url = `${deps.siteUrl}/valoraciones/verificar?token=${encodeURIComponent(outcome.token)}`
  try {
    await deps.send({ to: outcome.email, stationName: outcome.stationName, stars: outcome.stars, url })
    return { status: 'pending', email: outcome.email }
  } catch {
    // Sin email no hay forma de verificar: se borra el pendiente (si nadie lo ha sustituido) y el intento
    // deja de contar como email enviado, aunque sigue contando para el límite por IP.
    await db
      .delete(ratings)
      .where(and(eq(ratings.stationId, outcome.stationId), eq(ratings.email, outcome.email), eq(ratings.tokenHash, outcome.tokenHash)))
    await db.update(ratingAttempts).set({ sentEmail: false }).where(eq(ratingAttempts.id, outcome.attemptId))
    return { status: 'send-failed' }
  }
}
