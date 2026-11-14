import Link from 'next/link'
import type { SearchCriteria } from '@/catalog/search-params'
import { t } from '@/i18n'
import { criteriaChips } from './chips'

export function NoResults({ criteria }: { criteria: SearchCriteria }) {
  const chips = criteriaChips(criteria)
  const onlyText = chips.length === 1 && chips[0].key === 'q'
  return (
    <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
      <p className="font-semibold">{t('search.noResults')}</p>
      {onlyText && <p className="mt-1 text-sm text-neutral-500">{t('search.noResultsText')}</p>}
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {!onlyText &&
          chips.map((chip) => (
            <li key={chip.key}>
              <Link href={chip.removeHref} className="underline">
                {t('search.remove', { label: chip.label })}
              </Link>
            </li>
          ))}
        <li>
          <Link href="/buscar" className="underline">
            {t('search.seeAll')}
          </Link>
        </li>
      </ul>
    </div>
  )
}
