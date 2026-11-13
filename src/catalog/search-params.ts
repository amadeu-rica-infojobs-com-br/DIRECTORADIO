import { GENRES, type Genre } from '@/lib/genres'

export type SearchCriteria = { q?: string; country?: string; language?: string; genre?: Genre }

type RawParams = Record<string, string | string[] | undefined>

const MAX_Q = 100
const MAX_PAGE = 10000
const HAS_WORD = /[\p{L}\p{N}]/u
const COUNTRY_RE = /^[A-Z]{2}$/
const LANGUAGE_RE = /^[a-z]{2,3}$/

const values = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v])

/** Primer valor del parámetro que, normalizado, sea válido; los no válidos se ignoran sin error. */
function firstValid<T>(v: string | string[] | undefined, normalize: (s: string) => T | undefined): T | undefined {
  for (const raw of values(v)) {
    const out = normalize(raw)
    if (out !== undefined) return out
  }
  return undefined
}

const normQ = (s: string) => {
  const q = s.trim().slice(0, MAX_Q).trim()
  return q && HAS_WORD.test(q) ? q : undefined
}
const normCountry = (s: string) => {
  const c = s.trim().toUpperCase()
  return COUNTRY_RE.test(c) ? c : undefined
}
const normLanguage = (s: string) => {
  const l = s.trim().toLowerCase()
  return LANGUAGE_RE.test(l) ? l : undefined
}
const normGenre = (s: string) => (GENRES as readonly string[]).includes(s) ? (s as Genre) : undefined
const normPage = (s: string) => {
  if (!/^\d+$/.test(s)) return undefined
  const n = Number(s)
  return Number.isSafeInteger(n) && n >= 1 && n <= MAX_PAGE ? n : undefined
}

export function parseSearchParams(raw: RawParams): { criteria: SearchCriteria; page: number } {
  const criteria: SearchCriteria = {}
  const q = firstValid(raw.q, normQ)
  const country = firstValid(raw.pais, normCountry)
  const language = firstValid(raw.idioma, normLanguage)
  const genre = firstValid(raw.genero, normGenre)
  if (q) criteria.q = q
  if (country) criteria.country = country
  if (language) criteria.language = language
  if (genre) criteria.genre = genre
  return { criteria, page: firstValid(raw.pagina, normPage) ?? 1 }
}

export function hasCriteria(c: SearchCriteria): boolean {
  return Boolean(c.q || c.country || c.language || c.genre)
}

export function searchHref(criteria: SearchCriteria, page = 1): string {
  const params = new URLSearchParams()
  if (criteria.q) params.set('q', criteria.q)
  if (criteria.country) params.set('pais', criteria.country)
  if (criteria.language) params.set('idioma', criteria.language)
  if (criteria.genre) params.set('genero', criteria.genre)
  if (page > 1) params.set('pagina', String(page))
  const qs = params.toString()
  return qs ? `/buscar?${qs}` : '/buscar'
}
