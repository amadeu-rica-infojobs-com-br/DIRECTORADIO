import { searchHref, type SearchCriteria } from '@/catalog/search-params'
import { t } from '@/i18n'
import { countryName } from '@/lib/country'
import { genreLabel } from '@/lib/genres'
import { languageName } from '@/lib/language'

/** value: el valor legible («Portugal»); label: «País: Portugal». */
export type CriterionChip = { key: keyof SearchCriteria; value: string; label: string; removeHref: string }

/** Un elemento por criterio activo, con su etiqueta («País: Portugal») y el enlace a la búsqueda sin él. */
export function criteriaChips(c: SearchCriteria): CriterionChip[] {
  const chips: CriterionChip[] = []
  const add = (key: keyof SearchCriteria, name: string, value: string) =>
    chips.push({ key, value, label: `${name}: ${value}`, removeHref: searchHref({ ...c, [key]: undefined }) })
  if (c.q) add('q', t('search.text'), c.q)
  if (c.country) add('country', t('search.country'), countryName(c.country) || c.country)
  if (c.language) add('language', t('search.language'), languageName(c.language) || c.language)
  if (c.genre) add('genre', t('search.genre'), genreLabel(c.genre))
  return chips
}
