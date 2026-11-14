import { searchHref, type SearchCriteria } from '@/catalog/search-params'
import type { FilterOptions } from '@/catalog/search'
import { t } from '@/i18n'
import { buildFilterLists, type FilterOption } from './filter-lists'

const field =
  'rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900'

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: FilterOption[] }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-500">
      {label}
      <select name={name} defaultValue={value ?? ''} className={field}>
        <option value="">{t('search.any')}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function SearchForm({
  criteria,
  options,
  showText = true,
}: {
  criteria: SearchCriteria
  options: FilterOptions
  /** Con false no se pinta el campo de texto (lo da la cabecera), pero se conserva el texto actual. */
  showText?: boolean
}) {
  const { country: countries, language: languages, genre: genres } = buildFilterLists(options, criteria)

  return (
    // key: los campos usan defaultValue, que React solo aplica al montar. Al navegar en el cliente
    // (quitar un filtro con la ✕) hay que remontar el formulario para que muestre los criterios nuevos.
    <form
      key={searchHref(criteria)}
      method="get"
      action="/buscar"
      role="search"
      className="mb-6 flex flex-wrap items-end gap-3"
    >
      {showText ? (
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-neutral-500">
          {t('search.label')}
          <input
            type="search"
            name="q"
            defaultValue={criteria.q ?? ''}
            maxLength={100}
            placeholder={t('search.placeholder')}
            className={field}
          />
        </label>
      ) : (
        criteria.q && <input type="hidden" name="q" value={criteria.q} />
      )}
      <Select name="pais" label={t('search.country')} value={criteria.country} options={countries} />
      <Select name="idioma" label={t('search.language')} value={criteria.language} options={languages} />
      <Select name="genero" label={t('search.genre')} value={criteria.genre} options={genres} />
      <button
        type="submit"
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {t('search.submit')}
      </button>
    </form>
  )
}
