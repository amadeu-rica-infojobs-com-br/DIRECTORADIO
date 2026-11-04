import Link from 'next/link'
import { t } from '@/i18n'

const linkClass =
  'rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'

export function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  return (
    <nav className="mt-8 flex items-center justify-center gap-4" aria-label="Paginación">
      {page > 1 && (
        <Link href={`/?pagina=${page - 1}`} className={linkClass}>
          {t('pagination.prev')}
        </Link>
      )}
      <span className="text-sm text-neutral-500">
        {page} / {pageCount}
      </span>
      {page < pageCount && (
        <Link href={`/?pagina=${page + 1}`} className={linkClass}>
          {t('pagination.next')}
        </Link>
      )}
    </nav>
  )
}
