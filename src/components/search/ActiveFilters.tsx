import Link from 'next/link'
import type { SearchCriteria } from '@/catalog/search-params'
import { t } from '@/i18n'
import { criteriaChips } from './chips'

export function ActiveFilters({ criteria }: { criteria: SearchCriteria }) {
  const chips = criteriaChips(criteria)
  if (chips.length === 0) return null
  return (
    <ul aria-label={t('search.activeFilters')} className="mb-4 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li
          key={chip.key}
          className="flex items-center gap-2 rounded-full bg-neutral-100 py-1 pr-2 pl-3 text-sm dark:bg-neutral-800"
        >
          {chip.label}
          <Link
            href={chip.removeHref}
            aria-label={t('search.remove', { label: chip.label })}
            className="rounded-full px-1 hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            <span aria-hidden="true">✕</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
