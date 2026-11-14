'use client'

import Link from 'next/link'
import { useRef, useState, type CSSProperties } from 'react'
import { searchHref, type SearchCriteria } from '@/catalog/search-params'
import { t } from '@/i18n'
import type { CriterionChip } from './chips'
import { matchesQuery, type FilterLists } from './filter-lists'

type Key = 'country' | 'language' | 'genre'

const FILTERS: { key: Key; label: string; searchable: boolean }[] = [
  { key: 'country', label: t('search.country'), searchable: true },
  { key: 'language', label: t('search.language'), searchable: true },
  { key: 'genre', label: t('search.genre'), searchable: false },
]

const CHIP = 'flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-sm whitespace-nowrap'
const IDLE = 'border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'
const ACTIVE =
  'bg-[#ccfbf1] border-[#0d9488] text-[#115e59] font-semibold dark:bg-[#134e4a] dark:border-[#5eead4] dark:text-[#ccfbf1]'
// ✕ con área táctil de al menos 32 px.
const REMOVE = 'flex h-8 min-w-8 items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10'

const SHEET =
  'fixed inset-x-0 bottom-0 top-auto m-0 max-h-[75vh] w-full max-w-none rounded-t-2xl bg-white p-0 text-neutral-900 ' +
  'shadow-2xl backdrop:bg-black/40 dark:bg-neutral-900 dark:text-neutral-100 ' +
  'sm:inset-auto sm:max-h-80 sm:w-72 sm:rounded-xl sm:border sm:border-neutral-200 sm:dark:border-neutral-700 sm:backdrop:bg-transparent'

const DESKTOP = 640

export function FilterChips({
  criteria,
  chips,
  lists,
}: {
  criteria: SearchCriteria
  /** Etiquetas activas ya traducidas en el servidor (criteriaChips): el navegador no recalcula nombres. */
  chips: CriterionChip[]
  lists: FilterLists
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState<Key | null>(null)
  const [query, setQuery] = useState('')
  // Foco en el filtro solo en escritorio: en el móvil abriría el teclado encima de la hoja.
  const [focusFilter, setFocusFilter] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({})

  const chipsByKey = new Map(chips.map((c) => [c.key, c]))
  const textChip = chipsByKey.get('q')

  const openList = (key: Key, button: HTMLButtonElement, anchor: HTMLElement = button) => {
    openerRef.current = button
    setOpen(key)
    setQuery('')
    // En escritorio, desplegable bajo la etiqueta; en móvil, hoja anclada abajo (solo clases).
    setFocusFilter(window.innerWidth >= DESKTOP)
    if (window.innerWidth >= DESKTOP) {
      const r = anchor.getBoundingClientRect()
      setPosition({ position: 'fixed', top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 300) })
    } else {
      setPosition({})
    }
    dialogRef.current?.showModal()
  }

  const close = () => dialogRef.current?.close()

  const onClosed = () => {
    setOpen(null)
    openerRef.current?.focus()
  }

  const current = open ? FILTERS.find((f) => f.key === open)! : null
  const items = open ? lists[open].filter((o) => matchesQuery(o.label, query)) : []
  const titleId = 'filter-sheet-title'

  return (
    <>
      <div role="group" aria-label={t('search.filters')} className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {textChip && (
          <Link href={textChip.removeHref} aria-label={t('search.remove', { label: textChip.label })} className={`${CHIP} ${ACTIVE}`}>
            “{criteria.q}” <span aria-hidden="true">✕</span>
          </Link>
        )}
        {FILTERS.map((f) => {
          const chip = chipsByKey.get(f.key)
          if (!chip) {
            return (
              <button
                key={f.key}
                type="button"
                aria-haspopup="dialog"
                onClick={(e) => openList(f.key, e.currentTarget)}
                className={`${CHIP} ${IDLE}`}
              >
                {f.label} ▾
              </button>
            )
          }
          return (
            <span key={f.key} className={`${CHIP} ${ACTIVE} pr-0.5`}>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={t('search.change', { label: chip.label })}
                onClick={(e) => openList(f.key, e.currentTarget, e.currentTarget.parentElement ?? e.currentTarget)}
                className={`${ACTIVE} border-0 bg-transparent p-0 dark:bg-transparent`}
              >
                {chip.value}
              </button>
              <Link href={chip.removeHref} aria-label={t('search.remove', { label: chip.label })} className={REMOVE}>
                <span aria-hidden="true">✕</span>
              </Link>
            </span>
          )
        })}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={onClosed}
        onClick={(e) => {
          if (e.target === dialogRef.current) close()
        }}
        style={position}
        className={SHEET}
      >
        {current && (
          <div className="flex max-h-[inherit] flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
              <h2 id={titleId} className="font-semibold">
                {current.label}
              </h2>
              <button type="button" onClick={close} className="rounded-full px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
                {t('search.close')}
              </button>
            </div>
            {current.searchable && (
              <div className="px-4 pt-3">
                <input
                  type="search"
                  aria-label={t('search.filterList', { name: current.label })}
                  placeholder={t('search.filterList', { name: current.label })}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus={focusFilter}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>
            )}
            <ul className="overflow-y-auto px-2 py-2">
              <li>
                <Link
                  href={searchHref({ ...criteria, [current.key]: undefined })}
                  onClick={close}
                  aria-current={criteria[current.key] ? undefined : 'true'}
                  className="block rounded-lg px-3 py-2 hover:bg-neutral-100 aria-[current=true]:font-semibold dark:hover:bg-neutral-800"
                >
                  {t('search.all')}
                </Link>
              </li>
              {items.map((o) => (
                <li key={o.value}>
                  <Link
                    href={searchHref({ ...criteria, [current.key]: o.value })}
                    onClick={close}
                    aria-current={criteria[current.key] === o.value ? 'true' : undefined}
                    className="block rounded-lg px-3 py-2 hover:bg-neutral-100 aria-[current=true]:font-semibold aria-[current=true]:text-[#0d9488] dark:hover:bg-neutral-800 dark:aria-[current=true]:text-[#5eead4]"
                  >
                    {o.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </dialog>
    </>
  )
}
