import { and, asc, eq, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { stations, stationTags, tags } from '@/db/schema'
import type { Genre } from '@/lib/genres'
import { HEALTH_HIDE_THRESHOLD } from '@/catalog/constants'

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

export type StationDetailData = StationCardData & {
  id: string
  description: string | null
  streamUrl: string
  homepageUrl: string | null
  languages: string[]
  tags: string[]
  playCount: number
  isHealthHidden: boolean
}

const failures = sql`coalesce(${stations.healthConsecutiveFailures}, 0)`

export async function getHomeStations(
  db: Db,
  page: number,
): Promise<{ items: StationCardData[]; total: number; page: number; pageCount: number }> {
  const currentPage = Number.isInteger(page) && page >= 1 ? page : 1
  const visible = and(
    eq(stations.status, 'activa'),
    sql`${failures} < ${HEALTH_HIDE_THRESHOLD}`,
  )

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(stations)
    .where(visible)

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
    visible AS (
      SELECT s.*, coalesce(wp.n, 0) AS plays30d, coalesce(s.rb_click_count, 0) AS clicks
      FROM stations s
      LEFT JOIN window_plays wp ON wp.station_id = s.id
      WHERE s.status = 'activa' AND coalesce(s.health_consecutive_failures, 0) < ${HEALTH_HIDE_THRESHOLD}
    ),
    maxes AS (
      SELECT coalesce(max(plays30d), 0)::float8 AS max_plays, coalesce(max(clicks), 0)::float8 AS max_clicks
      FROM visible
    ),
    ranked AS (
      SELECT v.*,
        (CASE WHEN coalesce(v.country_code = 'ES', false) THEN 0.5 ELSE 0 END
           + CASE WHEN maxes.max_clicks > 0
                  THEN 0.49 * ln(1 + v.clicks::float8) / ln(1 + maxes.max_clicks) ELSE 0 END) AS legacy,
        (least(1, total.p / ${OWN_RANKING_FULL_AT}::float8)
          * CASE WHEN maxes.max_plays > 0 THEN v.plays30d / maxes.max_plays ELSE 0 END) AS own_part,
        least(1, total.p / ${OWN_RANKING_FULL_AT}::float8) AS w
      FROM visible v, total, maxes
    )
    SELECT r.slug, r.name, r.logo_url AS "logoUrl", r.country_code AS "countryCode", r.genre,
           r.rating_avg AS "ratingAvg", r.rating_count AS "ratingCount"
    FROM ranked r
    ORDER BY (r.own_part + (1 - r.w) * r.legacy) DESC, r.legacy DESC, r.name ASC, r.slug ASC
    LIMIT ${HOME_PAGE_SIZE} OFFSET ${(currentPage - 1) * HOME_PAGE_SIZE}
  `)

  return {
    items: Array.from(rows, (r) => ({
      ...r,
      ratingAvg: Number(r.ratingAvg ?? 0),
      ratingCount: r.ratingCount ?? 0,
    })),
    total,
    page: currentPage,
    pageCount: Math.max(1, Math.ceil(total / HOME_PAGE_SIZE)),
  }
}

export async function getStationBySlug(db: Db, slug: string): Promise<StationDetailData | null> {
  const [row] = await db
    .select()
    .from(stations)
    .where(and(eq(stations.slug, slug), eq(stations.status, 'activa')))
    .limit(1)
  if (!row) return null

  const tagRows = await db
    .select({ name: tags.name })
    .from(stationTags)
    .innerJoin(tags, eq(tags.id, stationTags.tagId))
    .where(eq(stationTags.stationId, row.id))
    .orderBy(asc(tags.name))

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logoUrl,
    countryCode: row.countryCode,
    genre: row.genre,
    ratingAvg: Number(row.ratingAvg ?? 0),
    ratingCount: row.ratingCount ?? 0,
    description: row.description,
    streamUrl: row.streamUrl,
    homepageUrl: row.homepageUrl,
    languages: row.languages ?? [],
    tags: tagRows.map((t) => t.name),
    playCount: row.playCount ?? 0,
    isHealthHidden: (row.healthConsecutiveFailures ?? 0) >= HEALTH_HIDE_THRESHOLD,
  }
}
