import { normalizeTags } from '@/lib/tags'
import type { RbStation } from './types'

export type MappedStation = {
  externalId: string
  name: string
  streamUrl: string
  homepageUrl: string | null
  logoUrl: string | null
  countryCode: string | null
  languages: string[]
  languageCodes: string[]
  tags: string[]
  rbClickCount: number
}

const orNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function mapRbStation(rb: RbStation): MappedStation | null {
  const name = rb.name?.trim()
  if (!name) return null

  const streamUrl = (rb.url_resolved?.trim() || rb.url?.trim() || '')
  if (!/^https?:\/\//i.test(streamUrl)) return null

  return {
    externalId: rb.stationuuid,
    name,
    streamUrl,
    homepageUrl: orNull(rb.homepage),
    logoUrl: orNull(rb.favicon),
    countryCode: orNull(rb.countrycode)?.toUpperCase() ?? null,
    languages: normalizeTags(rb.language),
    languageCodes: normalizeLanguageCodes(rb.languagecodes),
    tags: normalizeTags(rb.tags),
    rbClickCount: rb.clickcount ?? 0,
  }
}

const LANGUAGE_CODE_RE = /^[a-z]{2,3}$/

/** `languagecodes` de Radio-Browser ("es,ca") → códigos ISO 639 en minúsculas, sin duplicados. */
export function normalizeLanguageCodes(raw: string | undefined): string[] {
  const codes = (raw ?? '').split(',').map((c) => c.trim().toLowerCase())
  return [...new Set(codes.filter((c) => LANGUAGE_CODE_RE.test(c)))]
}
