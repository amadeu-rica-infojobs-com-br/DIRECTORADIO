import type { Metadata } from 'next'
import { getCachedFilterOptions } from '@/catalog/filter-options-cached'
import { searchStations } from '@/catalog/search'
import { parseSearchParams, searchHref, searchTitle } from '@/catalog/search-params'
import { Pagination } from '@/components/Pagination'
import { NoResults } from '@/components/search/NoResults'
import { FilterBar } from '@/components/search/FilterBar'
import { StationGrid } from '@/components/StationGrid'
import { getDb } from '@/db/client'
import { t, tn } from '@/i18n'

export async function generateMetadata({ searchParams }: PageProps<'/buscar'>): Promise<Metadata> {
  const { criteria } = parseSearchParams(await searchParams)
  return {
    title: t('search.metaTitle', { title: searchTitle(criteria) }),
    // Miles de combinaciones de filtros: no se indexan (el posicionamiento es cosa de /genero y /pais).
    robots: { index: false, follow: true },
    alternates: { canonical: '/buscar' },
  }
}

export default async function SearchPage({ searchParams }: PageProps<'/buscar'>) {
  const { criteria, page } = parseSearchParams(await searchParams)
  const [result, options] = await Promise.all([
    searchStations(getDb(), criteria, page),
    getCachedFilterOptions(),
  ])

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">{searchTitle(criteria)}</h1>
      <FilterBar criteria={criteria} options={options} />
      {result.total === 0 ? (
        <NoResults criteria={criteria} />
      ) : (
        <>
          <p className="mb-4 text-sm text-neutral-500">{tn('search.results', result.total)}</p>
          <StationGrid stations={result.items} />
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefForPage={(p) => searchHref(criteria, p)}
          />
        </>
      )}
    </>
  )
}
