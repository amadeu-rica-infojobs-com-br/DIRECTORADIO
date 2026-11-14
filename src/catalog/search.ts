import { sql, type SQL } from 'drizzle-orm'
import type { Db } from '@/db/client'
import type { Genre } from '@/lib/genres'
import { HEALTH_HIDE_THRESHOLD } from './constants'
import type { SearchCriteria } from './search-params'

export const HOME_PAGE_SIZE = 48
export const OWN_RANKING_FULL_AT = 1000
export const RANKING_WINDOW_DAYS = 30

export type StationCardData = {
  slug: string
  name: string
  logoUrl: string | null
  countryCode: string | null
  genre: Genre
  ratingAvg: number
  ratingCount: number
}

export type StationPage = { items: StationCardData[]; total: number; page: number; pageCount: number }

export type FilterOptions = { countries: string[]; languages: string[]; genres: Genre[] }

/** Visible: activa y con el stream sano. Misma condición en portada, búsqueda, opciones y similares. */
export const visibleSql = (alias: string): SQL =>
  sql.raw(`${alias}.status = 'activa' AND coalesce(${alias}.health_consecutive_failures, 0) < ${HEALTH_HIDE_THRESHOLD}`)

/** Expresión normalizada del nombre: debe coincidir con el índice stations_name_search_idx. */
const NAME_NORM = sql.raw('lower(f_unaccent(s.name))')

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

function criteriaSql(c: SearchCriteria): SQL {
  const parts: SQL[] = [visibleSql('s')]
  if (c.country) parts.push(sql`s.country_code = ${c.country}`)
  if (c.language) parts.push(sql`s.language_codes @> ARRAY[${c.language}]::text[]`)
  if (c.genre) parts.push(sql`s.genre = ${c.genre}::genre`)
  if (c.q) {
    const contains = sql`${NAME_NORM} LIKE '%' || lower(f_unaccent(${escapeLike(c.q)})) || '%' ESCAPE '\\'`
    // Con 1-2 caracteres los trigramas no sirven: solo "contiene".
    if (c.q.length < 3) {
      parts.push(contains)
    } else {
      // "Contiene" sin espacios: «los 40» → «LOS40», «rock fm» → «RockFM». Los trigramas (umbral por
      // defecto de pg_trgm, 0,6) no llegan a estos casos: word_similarity('los 40', 'los40') = 0,44.
      const noSpaces = escapeLike(c.q.replace(/\s+/g, ''))
      const containsNoSpaces = sql`replace(${NAME_NORM}, ' ', '') LIKE '%' || lower(f_unaccent(${noSpaces})) || '%' ESCAPE '\\'`
      parts.push(sql`(${contains} OR ${containsNoSpaces} OR lower(f_unaccent(${c.q})) <% ${NAME_NORM})`)
    }
  }
  return sql.join(parts, sql` AND `)
}

/**
 * Ranking de la portada (popularidad: reproducciones propias de 30 días mezcladas con el legado de
 * Radio-Browser, España primero) aplicado a las emisoras que cumplen los criterios.
 * `clamp`: una página por encima de la última muestra la última (búsqueda); sin él, lista vacía (portada).
 */
export async function rankStations(
  db: Db,
  criteria: SearchCriteria,
  page: number,
  { clamp }: { clamp: boolean },
): Promise<StationPage> {
  const where = criteriaSql(criteria)
  const [{ total }] = await db.execute<{ total: number }>(
    sql`SELECT count(*)::int AS total FROM stations s WHERE ${where}`,
  )
  const pageCount = Math.max(1, Math.ceil(total / HOME_PAGE_SIZE))
  let current = Number.isInteger(page) && page >= 1 ? page : 1
  if (clamp) current = Math.min(current, pageCount)

  const q = criteria.q
  const textOrder = q
    ? sql`(${NAME_NORM} LIKE '%' || lower(f_unaccent(${escapeLike(q)})) || '%' ESCAPE '\\') DESC,
          word_similarity(lower(f_unaccent(${q})), ${NAME_NORM}) DESC,`
    : sql``

  const rows = await db.execute<{
    slug: string
    name: string
    logoUrl: string | null
    countryCode: string | null
    genre: Genre
    ratingAvg: string | null
    ratingCount: number | null
  }>(sql`
    WITH window_plays AS (
      SELECT station_id, count(*)::int AS n
      FROM plays
      WHERE created_at > now() - make_interval(days => ${RANKING_WINDOW_DAYS})
      GROUP BY station_id
    ),
    total AS (SELECT coalesce(sum(n), 0)::float8 AS p FROM window_plays),
    maxes AS (
      SELECT coalesce(max(coalesce(wp.n, 0)), 0)::float8 AS max_plays,
             coalesce(max(coalesce(s.rb_click_count, 0)), 0)::float8 AS max_clicks
      FROM stations s LEFT JOIN window_plays wp ON wp.station_id = s.id
      WHERE ${visibleSql('s')}
    ),
    matched AS (
      SELECT s.*, coalesce(wp.n, 0) AS plays30d, coalesce(s.rb_click_count, 0) AS clicks
      FROM stations s
      LEFT JOIN window_plays wp ON wp.station_id = s.id
      WHERE ${where}
    ),
    ranked AS (
      SELECT s.*,
        (CASE WHEN coalesce(s.country_code = 'ES', false) THEN 0.5 ELSE 0 END
           + CASE WHEN maxes.max_clicks > 0
                  THEN 0.49 * ln(1 + s.clicks::float8) / ln(1 + maxes.max_clicks) ELSE 0 END) AS legacy,
        (least(1, total.p / ${OWN_RANKING_FULL_AT}::float8)
          * CASE WHEN maxes.max_plays > 0 THEN s.plays30d / maxes.max_plays ELSE 0 END) AS own_part,
        least(1, total.p / ${OWN_RANKING_FULL_AT}::float8) AS w
      FROM matched s, total, maxes
    )
    SELECT s.slug, s.name, s.logo_url AS "logoUrl", s.country_code AS "countryCode", s.genre,
           s.rating_avg AS "ratingAvg", s.rating_count AS "ratingCount"
    FROM ranked s
    ORDER BY ${textOrder} (s.own_part + (1 - s.w) * s.legacy) DESC, s.legacy DESC, s.name ASC, s.slug ASC
    LIMIT ${HOME_PAGE_SIZE} OFFSET ${(current - 1) * HOME_PAGE_SIZE}
  `)

  return {
    items: Array.from(rows, (r) => ({ ...r, ratingAvg: Number(r.ratingAvg ?? 0), ratingCount: r.ratingCount ?? 0 })),
    total,
    page: current,
    pageCount,
  }
}

export function searchStations(db: Db, criteria: SearchCriteria, page: number): Promise<StationPage> {
  return rankStations(db, criteria, page, { clamp: true })
}

export async function getFilterOptions(db: Db): Promise<FilterOptions> {
  const visible = visibleSql('s')
  const [countries, languages, genres] = await Promise.all([
    db.execute<{ v: string }>(
      sql`SELECT DISTINCT s.country_code AS v FROM stations s WHERE ${visible} AND s.country_code IS NOT NULL`,
    ),
    db.execute<{ v: string }>(sql`SELECT DISTINCT unnest(s.language_codes) AS v FROM stations s WHERE ${visible}`),
    db.execute<{ v: Genre }>(sql`SELECT DISTINCT s.genre::text AS v FROM stations s WHERE ${visible}`),
  ])
  return {
    countries: Array.from(countries, (r) => r.v),
    languages: Array.from(languages, (r) => r.v),
    genres: Array.from(genres, (r) => r.v),
  }
}
