import { t } from '@/i18n'

/** Caja compacta de la cabecera: solo texto, envía a /buscar?q=… */
export function HeaderSearch() {
  return (
    <form method="get" action="/buscar" role="search" className="min-w-0 flex-1 sm:max-w-xs">
      <input
        type="search"
        name="q"
        maxLength={100}
        aria-label={t('search.label')}
        placeholder={t('search.placeholder')}
        className="w-full rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
    </form>
  )
}
