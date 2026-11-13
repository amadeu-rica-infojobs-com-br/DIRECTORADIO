import type { SearchCriteria } from '@/catalog/search-params'
import type { FilterOptions } from '@/catalog/search'
import { t } from '@/i18n'
import { countryName } from '@/lib/country'
import { genreLabel } from '@/lib/genres'
import { languageName } from '@/lib/language'

type Option = { value: string; label: string }

const byLabel = (a: Option, b: Option) => a.label.localeCompare(b.label, 'es')

const field =
  'rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900'

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: Option[] }) {
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

export function SearchForm({ criteria, options }: { criteria: SearchCriteria; options: FilterOptions }) {
  // Sin nombre conocido, el código no se ofrece.
  const countries = options.countries
    .map((c) => ({ value: c, label: countryName(c) }))
    .filter((o) => o.label)
    .sort(byLabel)
  const languages = options.languages
    .map((l) => ({ value: l, label: languageName(l) }))
    .filter((o) => o.label)
    .sort(byLabel)
  const genres = options.genres.map((g) => ({ value: g, label: genreLabel(g) })).sort(byLabel)

  return (
    <form method="get" action="/buscar" role="search" className="mb-6 flex flex-wrap items-end gap-3">
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
