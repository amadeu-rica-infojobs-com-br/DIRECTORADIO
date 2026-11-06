import { createHash } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { plays, stations } from '@/db/schema'

export type PlayResult = 'counted' | 'duplicate' | 'not-found' | 'rate-limited'

export const PLAYS_PER_IP_HOUR = 30
export const PLAYS_PER_IP_DAY = 200

export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(salt + ip).digest('hex')
}

// Limits are checked before the insert, so a repeated (station, session) from an over-limit IP is rate-limited, not duplicate.
export async function recordPlay(
  db: Db,
  stationId: string,
  sessionId: string,
  ipHash?: string | null,
): Promise<PlayResult> {
  return db.transaction(async (tx) => {
    const [station] = await tx
      .select({ id: stations.id })
      .from(stations)
      .where(and(eq(stations.id, stationId), eq(stations.status, 'activa')))
      .for('no key update')
    if (!station) return 'not-found'

    if (ipHash) {
      const [counts] = await tx
        .select({
          hour: sql<number>`count(*) filter (where ${plays.createdAt} > now() - interval '1 hour')`.mapWith(Number),
          day: sql<number>`count(*)`.mapWith(Number),
        })
        .from(plays)
        .where(and(eq(plays.ipHash, ipHash), sql`${plays.createdAt} > now() - interval '24 hours'`))
      if (counts.hour >= PLAYS_PER_IP_HOUR || counts.day >= PLAYS_PER_IP_DAY) return 'rate-limited'
    }

    const inserted = await tx
      .insert(plays)
      .values({ stationId, sessionId, ipHash: ipHash ?? null })
      .onConflictDoNothing()
      .returning({ id: plays.id })
    if (inserted.length === 0) return 'duplicate'

    await tx
      .update(stations)
      .set({ playCount: sql`coalesce(${stations.playCount}, 0) + 1` })
      .where(eq(stations.id, stationId))
    return 'counted'
  })
}

export async function pruneOldPlays(db: Db, days = 35): Promise<number> {
  const deleted = await db
    .delete(plays)
    .where(sql`${plays.createdAt} < now() - make_interval(days => ${days})`)
    .returning({ id: plays.id })
  return deleted.length
}
