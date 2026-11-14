import type { FilterOptions } from '@/catalog/search'
import type { SearchCriteria } from '@/catalog/search-params'
import { countryName } from '@/lib/country'
import { genreLabel } from '@/lib/genres'
import { languageName } from '@/lib/language'

export type FilterOption = { value: string; label: string }
export type FilterLists = { country: FilterOption[]; language: FilterOption[]; genre: FilterOption[] }

const byLabel = (a: FilterOption, b: FilterOption) => a.label.localeCompare(b.label, 'es')

/** Añade el valor actual si las opciones (en caché hasta una hora) no lo incluyen, para que se vea seleccionado. */
const withCurrent = <T extends string>(list: T[], current: T | undefined): T[] =>
  current && !list.includes(current) ? [...list, current] : list

/** Opciones de los filtros con nombre en español y en orden alfabético; los códigos sin nombre conocido no se ofrecen. */
export function buildFilterLists(options: FilterOptions, criteria: SearchCriteria): FilterLists {
  return {
    country: withCurrent(options.countries, criteria.country)
      .map((c) => ({ value: c, label: countryName(c) }))
      .filter((o) => o.label)
      .sort(byLabel),
    language: withCurrent(options.languages, criteria.language)
      .map((l) => ({ value: l, label: languageName(l) }))
      .filter((o) => o.label)
      .sort(byLabel),
    genre: withCurrent(options.genres, criteria.genre)
      .map((g) => ({ value: g, label: genreLabel(g) }))
      .sort(byLabel),
  }
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es')
    .trim()

/** «Contiene», sin tildes ni mayúsculas: «portugues» encuentra «Portugués». */
export function matchesQuery(label: string, query: string): boolean {
  const q = fold(query)
  return q === '' || fold(label).includes(q)
}
