import { and, eq, isNotNull, lt } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { ratingAttempts, ratings, verifiedEmails } from '@/db/schema'
import { recomputeStationRating } from './aggregate'
import { normalizeEmail } from './email'

const HOUR = 3600_000
const DAY = 24 * HOUR

/** Fase ratings-prune de la tarea diaria (spec plan 4 §5.7). */
export async function pruneRatings(
  db: Db,
  now: Date = new Date(),
): Promise<{ pendingDeleted: number; attemptsDeleted: number; ipHashesCleared: number }> {
  const pending = await db
    .delete(ratings)
    .where(and(eq(ratings.status, 'pending'), lt(ratings.createdAt, new Date(now.getTime() - 7 * DAY))))
    .returning({ id: ratings.id })
  const attempts = await db
    .delete(ratingAttempts)
    .where(lt(ratingAttempts.createdAt, new Date(now.getTime() - 48 * HOUR)))
    .returning({ id: ratingAttempts.id })
  const cleared = await db
    .update(ratings)
    .set({ ipHash: null })
    .where(and(isNotNull(ratings.ipHash), lt(ratings.createdAt, new Date(now.getTime() - 35 * DAY))))
    .returning({ id: ratings.id })
  return { pendingDeleted: pending.length, attemptsDeleted: attempts.length, ipHashesCleared: cleared.length }
}

/**
 * Borrado a petición (RGPD): votos, intentos y email verificado de una dirección. Al desaparecer la fila
 * de verified_emails, sus cookies de votante dejan de valer (§5.3).
 */
export async function forgetEmail(
  db: Db,
  rawEmail: string,
): Promise<{ ratings: number; attempts: number; verifiedEmail: boolean; stations: number }> {
  const email = normalizeEmail(rawEmail)
  if (!email) throw new Error('Email no válido')
  return db.transaction(async (tx) => {
    const deleted = await tx.delete(ratings).where(eq(ratings.email, email)).returning({ stationId: ratings.stationId })
    const touched = [...new Set(deleted.map((r) => r.stationId))]
    for (const id of touched) await recomputeStationRating(tx, id)
    const attempts = await tx.delete(ratingAttempts).where(eq(ratingAttempts.email, email)).returning({ id: ratingAttempts.id })
    const verified = await tx.delete(verifiedEmails).where(eq(verifiedEmails.email, email)).returning({ email: verifiedEmails.email })
    return { ratings: deleted.length, attempts: attempts.length, verifiedEmail: verified.length > 0, stations: touched.length }
  })
}

