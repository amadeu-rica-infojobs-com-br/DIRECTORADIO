import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { plays, stations } from '@/db/schema'

export type PlayResult = 'counted' | 'duplicate' | 'not-found'

export async function recordPlay(db: Db, stationId: string, sessionId: string): Promise<PlayResult> {
  return db.transaction(async (tx) => {
    const [station] = await tx
      .select({ id: stations.id })
      .from(stations)
      .where(and(eq(stations.id, stationId), eq(stations.status, 'activa')))
      .for('no key update')
    if (!station) return 'not-found'

    const inserted = await tx
      .insert(plays)
      .values({ stationId, sessionId })
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
