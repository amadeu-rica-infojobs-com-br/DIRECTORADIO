import { sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import type { Genre } from '@/lib/genres'
import { visibleSql, type StationCardData } from './search'

export const SIMILAR_LIMIT = 8

/**
 * Emisoras parecidas sin IA (spec §5.6). Puntuación:
 *  +3 mismo género (+1 si ambas son "Variada"); por tag compartido 2 / ln(e + n/100), con n = emisoras
 *  visibles con ese tag, para que los tags muy frecuentes pesen menos; +2 mismo país; +1 algún idioma común.
 * Candidatas: comparten un tag, o el mismo género distinto de "Variada", o el mismo país.
 * "Variada" o el idioma por sí solos no bastan. A igualdad, la más popular.
 */
export async function getSimilarStations(db: Db, stationId: string, limit = SIMILAR_LIMIT): Promise<StationCardData[]> {
  const rows = await db.execute<{
    slug: string
    name: string
    logoUrl: string | null
    countryCode: string | null
    genre: Genre
    ratingAvg: string | null
    ratingCount: number | null
  }>(sql`
    WITH me AS (
      SELECT id, genre, country_code, language_codes FROM stations WHERE id = ${stationId}
    ),
    my_tags AS (SELECT tag_id FROM station_tags WHERE station_id = ${stationId}),
    tag_weight AS (
      SELECT st.tag_id, 2 / ln(exp(1) + count(*)::float8 / 100) AS w
      FROM station_tags st
      JOIN stations s ON s.id = st.station_id
      WHERE st.tag_id IN (SELECT tag_id FROM my_tags) AND ${visibleSql('s')}
      GROUP BY st.tag_id
    ),
    shared AS (
      SELECT st.station_id, sum(tw.w) AS tag_score
      FROM station_tags st
      JOIN tag_weight tw ON tw.tag_id = st.tag_id
      WHERE st.station_id <> ${stationId}
      GROUP BY st.station_id
    ),
    candidates AS (
      SELECT s.*,
        coalesce(sh.tag_score, 0)
          + CASE WHEN s.genre = me.genre THEN CASE WHEN s.genre = 'variada' THEN 1 ELSE 3 END ELSE 0 END
          + CASE WHEN s.country_code = me.country_code THEN 2 ELSE 0 END
          + CASE WHEN s.language_codes && me.language_codes THEN 1 ELSE 0 END AS score
      FROM stations s
      CROSS JOIN me
      LEFT JOIN shared sh ON sh.station_id = s.id
      WHERE ${visibleSql('s')}
        AND s.id <> me.id
        AND (
          sh.station_id IS NOT NULL
          OR (s.genre = me.genre AND s.genre <> 'variada')
          OR s.country_code = me.country_code
        )
    )
    SELECT c.slug, c.name, c.logo_url AS "logoUrl", c.country_code AS "countryCode", c.genre,
           c.rating_avg AS "ratingAvg", c.rating_count AS "ratingCount"
    FROM candidates c
    ORDER BY c.score DESC, coalesce(c.play_count, 0) DESC, coalesce(c.rb_click_count, 0) DESC, c.slug ASC
    LIMIT ${limit}
  `)
  return Array.from(rows, (r) => ({ ...r, ratingAvg: Number(r.ratingAvg ?? 0), ratingCount: r.ratingCount ?? 0 }))
}
