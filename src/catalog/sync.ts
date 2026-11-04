import { and, eq, inArray } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { stations, stationTags, tagGenres, tags } from '@/db/schema'
import { resolveGenre, type Genre } from '@/lib/genres'
import { slugify, uniqueSlug } from '@/lib/slug'
import { mapRbStation, type MappedStation } from './radio-browser/map'
import type { RbStation } from './radio-browser/types'

export type SyncReport = {
  inserted: number
  updated: number
  deactivated: number
  skippedDuplicates: number
  skippedInvalid: number
  deactivationSkipped: boolean
}

const SOURCE = 'radio-browser'
const BATCH_SIZE = 500
const MIN_BATCH_RATIO = 0.5

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

const streamKey = (url: string) => url.replace(/\/+$/, '').toLowerCase()

export async function syncCatalog(db: Db, rbStations: RbStation[]): Promise<SyncReport> {
  const report: SyncReport = {
    inserted: 0,
    updated: 0,
    deactivated: 0,
    skippedDuplicates: 0,
    skippedInvalid: 0,
    deactivationSkipped: false,
  }

  const mapped: MappedStation[] = []
  for (const raw of rbStations) {
    const m = mapRbStation(raw)
    if (m) mapped.push(m)
    else report.skippedInvalid++
  }

  const byStream = new Map<string, MappedStation>()
  const byExternalId = new Set<string>()
  for (const m of mapped) {
    if (byExternalId.has(m.externalId)) {
      report.skippedDuplicates++
      continue
    }
    byExternalId.add(m.externalId)
    const key = streamKey(m.streamUrl)
    const prev = byStream.get(key)
    if (!prev) {
      byStream.set(key, m)
    } else {
      report.skippedDuplicates++
      if (m.rbClickCount > prev.rbClickCount) byStream.set(key, m)
    }
  }
  const valid = [...byStream.values()]
  const batchIds = new Set(valid.map((m) => m.externalId))

  const genreMap = new Map<string, Genre>(
    (await db.select().from(tagGenres)).map((r) => [r.tag, r.genre]),
  )

  const activeBefore = (
    await db
      .select({ externalId: stations.externalId })
      .from(stations)
      .where(and(eq(stations.source, SOURCE), eq(stations.status, 'activa')))
  ).map((r) => r.externalId as string)

  const usedSlugs = new Set((await db.select({ slug: stations.slug }).from(stations)).map((r) => r.slug))
  const slugExists = async (s: string) => usedSlugs.has(s)

  for (const batch of chunk(valid, BATCH_SIZE)) {
    await db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(stations)
        .where(
          and(
            eq(stations.source, SOURCE),
            inArray(
              stations.externalId,
              batch.map((m) => m.externalId),
            ),
          ),
        )
      const existing = new Map(existingRows.map((r) => [r.externalId as string, r]))

      const stationIdByExternal = new Map<string, string>()
      const toInsert: (typeof stations.$inferInsert)[] = []

      for (const m of batch) {
        const genre = resolveGenre(m.tags, genreMap)
        const row = existing.get(m.externalId)
        if (row) {
          const manual = row.manualFields ?? []
          await tx
            .update(stations)
            .set({
              name: m.name,
              streamUrl: m.streamUrl,
              homepageUrl: m.homepageUrl,
              countryCode: m.countryCode,
              languages: m.languages,
              rbClickCount: m.rbClickCount,
              updatedAt: new Date(),
              ...(manual.includes('logoUrl') ? {} : { logoUrl: m.logoUrl }),
              ...(manual.includes('genre') ? {} : { genre }),
            })
            .where(eq(stations.id, row.id))
          stationIdByExternal.set(m.externalId, row.id)
          report.updated++
        } else {
          const slug = await uniqueSlug(
            slugify(m.name),
            'emisora-' + m.externalId.slice(0, 8),
            slugExists,
          )
          usedSlugs.add(slug)
          toInsert.push({
            slug,
            name: m.name,
            streamUrl: m.streamUrl,
            homepageUrl: m.homepageUrl,
            logoUrl: m.logoUrl,
            countryCode: m.countryCode,
            languages: m.languages,
            genre,
            status: 'activa',
            source: SOURCE,
            externalId: m.externalId,
            rbClickCount: m.rbClickCount,
          })
        }
      }

      if (toInsert.length > 0) {
        const inserted = await tx
          .insert(stations)
          .values(toInsert)
          .returning({ id: stations.id, externalId: stations.externalId })
        for (const r of inserted) stationIdByExternal.set(r.externalId as string, r.id)
        report.inserted += inserted.length
      }

      const tagNames = [...new Set(batch.flatMap((m) => m.tags))]
      const tagIds = new Map<string, number>()
      for (const names of chunk(tagNames, 5000)) {
        await tx
          .insert(tags)
          .values(names.map((name) => ({ name })))
          .onConflictDoNothing()
        const rows = await tx.select().from(tags).where(inArray(tags.name, names))
        for (const r of rows) tagIds.set(r.name, r.id)
      }

      await tx.delete(stationTags).where(inArray(stationTags.stationId, [...stationIdByExternal.values()]))
      const links = batch.flatMap((m) => {
        const stationId = stationIdByExternal.get(m.externalId)
        if (!stationId) return []
        return m.tags.map((t) => ({ stationId, tagId: tagIds.get(t) as number }))
      })
      for (const part of chunk(links, 10000)) {
        await tx.insert(stationTags).values(part).onConflictDoNothing()
      }
    })
  }

  if (activeBefore.length > 0 && valid.length < activeBefore.length * MIN_BATCH_RATIO) {
    report.deactivationSkipped = true
  } else {
    const missing = activeBefore.filter((id) => !batchIds.has(id))
    for (const ids of chunk(missing, BATCH_SIZE)) {
      await db
        .update(stations)
        .set({ status: 'desactivada', updatedAt: new Date() })
        .where(and(eq(stations.source, SOURCE), inArray(stations.externalId, ids)))
    }
    report.deactivated = missing.length
  }

  return report
}
