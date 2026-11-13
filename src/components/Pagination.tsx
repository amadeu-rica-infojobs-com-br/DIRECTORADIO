import Link from 'next/link'
import { t } from '@/i18n'

const linkClass =
  'rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'

const homeHref = (page: number) => `/?pagina=${page}`

export function Pagination({
  page,
  pageCount,
  hrefForPage = homeHref,
}: {
  page: number
  pageCount: number
  hrefForPage?: (page: number) => string
}) {
  return (
    <nav className="mt-8 flex items-center justify-center gap-4" aria-label={t('pagination.label')}>
      {page > 1 && (
        <Link href={hrefForPage(page - 1)} className={linkClass}>
          {t('pagination.prev')}
        </Link>
      )}
      <span className="text-sm text-neutral-500">
        {page} / {pageCount}
      </span>
      {page < pageCount && (
        <Link href={hrefForPage(page + 1)} className={linkClass}>
          {t('pagination.next')}
        </Link>
      )}
    </nav>
  )
}
