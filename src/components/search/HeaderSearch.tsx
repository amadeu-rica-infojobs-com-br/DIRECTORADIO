'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { t } from '@/i18n'

const FORM = 'min-w-0 flex-1 sm:max-w-xs'
const INPUT =
  'w-full rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900'

const KEPT_FILTERS = ['pais', 'idioma', 'genero'] as const

/**
 * Caja de la cabecera, único campo de texto de la web. En /buscar muestra el texto actual y conserva
 * los filtros activos como campos ocultos, para que cambiar el texto no los borre.
 */
export function HeaderSearch() {
  const pathname = usePathname()
  const params = useSearchParams()
  const onSearch = pathname === '/buscar'
  const q = onSearch ? (params.get('q') ?? '') : ''
  const kept = onSearch ? KEPT_FILTERS.flatMap((name) => (params.get(name) ? [[name, params.get(name)!]] : [])) : []

  return (
    // key: defaultValue solo se aplica al montar; se remonta al cambiar la búsqueda.
    <form key={onSearch ? params.toString() : 'home'} method="get" action="/buscar" role="search" className={FORM}>
      <input
        type="search"
        name="q"
        defaultValue={q}
        maxLength={100}
        aria-label={t('search.label')}
        placeholder={t('search.placeholder')}
        className={INPUT}
      />
      {kept.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </form>
  )
}

/** Lo que se ve mientras se resuelven los parámetros de la dirección (Suspense en el layout). */
export function HeaderSearchFallback() {
  return (
    <form method="get" action="/buscar" role="search" className={FORM}>
      <input type="search" name="q" maxLength={100} aria-label={t('search.label')} placeholder={t('search.placeholder')} className={INPUT} />
    </form>
  )
}
