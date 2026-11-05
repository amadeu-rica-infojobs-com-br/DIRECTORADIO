import { and, asc, desc, eq, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { stations, stationTags, tags } from '@/db/schema'
import type { Genre } from '@/lib/genres'
import { HEALTH_HIDE_THRESHOLD } from '@/catalog/health'

export const HOME_PAGE_SIZE = 48

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

  const rows = await db
    .select({
      slug: stations.slug,
      name: stations.name,
      logoUrl: stations.logoUrl,
      countryCode: stations.countryCode,
      genre: stations.genre,
      ratingAvg: stations.ratingAvg,
      ratingCount: stations.ratingCount,
    })
    .from(stations)
    .where(visible)
    .orderBy(
      desc(sql`coalesce(${stations.countryCode} = 'ES', false)`),
      desc(sql`coalesce(${stations.rbClickCount}, 0)`),
      asc(stations.name),
      asc(stations.slug),
    )
    .limit(HOME_PAGE_SIZE)
    .offset((currentPage - 1) * HOME_PAGE_SIZE)

  return {
    items: rows.map((r) => ({
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
