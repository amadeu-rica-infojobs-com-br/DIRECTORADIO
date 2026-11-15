import { and, eq, gt, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { ratings, stations, verifiedEmails } from '@/db/schema'
import { recomputeStationRating } from './aggregate'
import { hashToken } from './token'

export type ConfirmResult =
  | { status: 'confirmed'; email: string; stationSlug: string; stationName: string }
  | { status: 'invalid' }

/**
 * Confirma un voto pendiente (spec plan 4 §5.2): pasa a verificado, sustituye al verificado anterior
 * del mismo email y emisora, registra el email verificado y recalcula la media.
 * Token inválido, usado o caducado → invalid, sin decir cuál de los tres.
 */
export async function confirmRating(db: Db, token: unknown, now: Date = new Date()): Promise<ConfirmResult> {
  if (typeof token !== 'string' || token.length === 0 || token.length > 200) return { status: 'invalid' }
  const tokenHash = hashToken(token)

  return db.transaction(async (tx) => {
    const [vote] = await tx
      .select({ id: ratings.id, stationId: ratings.stationId, email: ratings.email, privacyAcceptedAt: ratings.privacyAcceptedAt })
      .from(ratings)
      .where(and(eq(ratings.tokenHash, tokenHash), eq(ratings.status, 'pending'), gt(ratings.tokenExpiresAt, now)))
      .for('update')
    if (!vote) return { status: 'invalid' } as const

    const [station] = await tx
      .select({ slug: stations.slug, name: stations.name })
      .from(stations)
      .where(eq(stations.id, vote.stationId))
    if (!station) return { status: 'invalid' } as const

    await tx
      .delete(ratings)
      .where(and(eq(ratings.stationId, vote.stationId), eq(ratings.email, vote.email), eq(ratings.status, 'verified')))
    await tx
      .update(ratings)
      .set({ status: 'verified', tokenHash: null, tokenExpiresAt: null, updatedAt: now })
      .where(eq(ratings.id, vote.id))
    await tx
      .insert(verifiedEmails)
      .values({ email: vote.email, firstVerifiedAt: now, verifiedAt: now, privacyAcceptedAt: vote.privacyAcceptedAt })
      .onConflictDoUpdate({
        target: verifiedEmails.email,
        // first_verified_at no cambia mientras exista la fila (la cookie de votante depende de ello).
        set: { verifiedAt: now, privacyAcceptedAt: sql`excluded.privacy_accepted_at` },
      })
    await recomputeStationRating(tx, vote.stationId)

    return { status: 'confirmed', email: vote.email, stationSlug: station.slug, stationName: station.name } as const
  })
}
