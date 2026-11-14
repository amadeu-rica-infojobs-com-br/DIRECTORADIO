import { searchHref, type SearchCriteria } from '@/catalog/search-params'
import { t } from '@/i18n'
import { countryName } from '@/lib/country'
import { genreLabel } from '@/lib/genres'
import { languageName } from '@/lib/language'

export type CriterionChip = { key: keyof SearchCriteria; label: string; removeHref: string }

/** Un elemento por criterio activo, con su etiqueta («País: Portugal») y el enlace a la búsqueda sin él. */
export function criteriaChips(c: SearchCriteria): CriterionChip[] {
  const chips: CriterionChip[] = []
  const without = (key: keyof SearchCriteria) => searchHref({ ...c, [key]: undefined })
  if (c.q) chips.push({ key: 'q', label: `${t('search.text')}: ${c.q}`, removeHref: without('q') })
  if (c.country)
    chips.push({
      key: 'country',
      label: `${t('search.country')}: ${countryName(c.country) || c.country}`,
      removeHref: without('country'),
    })
  if (c.language)
    chips.push({
      key: 'language',
      label: `${t('search.language')}: ${languageName(c.language) || c.language}`,
      removeHref: without('language'),
    })
  if (c.genre)
    chips.push({ key: 'genre', label: `${t('search.genre')}: ${genreLabel(c.genre)}`, removeHref: without('genre') })
  return chips
}
