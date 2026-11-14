import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { stations, stationTags, tags } from '@/db/schema'
import { HEALTH_HIDE_THRESHOLD } from '@/catalog/constants'
import { rankStations, type StationCardData, type StationPage } from '@/catalog/search'

export { HOME_PAGE_SIZE, OWN_RANKING_FULL_AT, RANKING_WINDOW_DAYS, type StationCardData } from '@/catalog/search'

export type StationDetailData = StationCardData & {
  id: string
  description: string | null
  streamUrl: string
  homepageUrl: string | null
  languages: string[]
  languageCodes: string[]
  tags: string[]
  playCount: number
  isHealthHidden: boolean
}

/** Portada: ranking de popularidad de todas las emisoras visibles. */
export function getHomeStations(db: Db, page: number): Promise<StationPage> {
  return rankStations(db, {}, page, { clamp: false })
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
    languageCodes: row.languageCodes,
    tags: tagRows.map((t) => t.name),
    playCount: row.playCount ?? 0,
    isHealthHidden: (row.healthConsecutiveFailures ?? 0) >= HEALTH_HIDE_THRESHOLD,
  }
}
