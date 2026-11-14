import { sql } from 'drizzle-orm'
import type { Db } from '@/db/client'

/** Transacción o conexión: las dos sirven para ejecutar consultas. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0] | Db

/** Recalcula la media (2 decimales) y el número de valoraciones de una emisora desde sus votos verificados. */
export async function recomputeStationRating(tx: Tx, stationId: string): Promise<void> {
  await tx.execute(sql`
    UPDATE stations s SET
      rating_avg = coalesce((SELECT round(avg(r.stars)::numeric, 2) FROM ratings r WHERE r.station_id = s.id AND r.status = 'verified'), 0),
      rating_count = (SELECT count(*)::int FROM ratings r WHERE r.station_id = s.id AND r.status = 'verified')
    WHERE s.id = ${stationId}
  `)
}
