import type { FilterOptions } from '@/catalog/search'
import type { SearchCriteria } from '@/catalog/search-params'
import { t } from '@/i18n'
import { buildFilterLists } from './filter-lists'
import { FilterChips } from './FilterChips'
import { SearchForm } from './SearchForm'

/**
 * Filtros de la portada y de /buscar: fila de etiquetas. Sin JavaScript, las etiquetas no abren
 * su lista, así que un <noscript> ofrece el formulario de siempre (sin texto) en un panel plegable.
 */
export function FilterBar({ criteria, options }: { criteria: SearchCriteria; options: FilterOptions }) {
  const active = [criteria.country, criteria.language, criteria.genre].filter(Boolean).length
  return (
    <>
      <FilterChips criteria={criteria} lists={buildFilterLists(options, criteria)} />
      <noscript>
        <details className="mb-6">
          <summary className="cursor-pointer text-sm font-semibold">
            {`${t('search.filters')} (${active})`}
          </summary>
          <div className="mt-3">
            <SearchForm criteria={criteria} options={options} showText={false} />
          </div>
        </details>
      </noscript>
    </>
  )
}
