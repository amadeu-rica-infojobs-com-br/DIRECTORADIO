'use client'

import Link from 'next/link'
import { StationLogo } from '@/components/StationLogo'
import { t } from '@/i18n'
import { usePlayer } from '@/player/PlayerProvider'

export function MiniPlayer() {
  const { current, status, pause, resume, stop } = usePlayer()
  if (!current) return null

  const sounding = status === 'playing' || status === 'connecting'
  const toggleLabel = sounding ? t('station.pause') : t('station.listen')
  const isError = status === 'error'
  const statusText =
    status === 'connecting'
      ? t('player.connecting')
      : status === 'playing'
        ? t('player.live')
        : isError
          ? t('player.error')
          : null

  return (
    <div
      role="region"
      aria-label={t('player.label')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3">
        <StationLogo name={current.name} logoUrl={current.logoUrl} size={40} />
        <div className="min-w-0 flex-1">
          <Link href={`/emisora/${current.slug}`} className="block truncate font-semibold hover:underline">
            {current.name}
          </Link>
          {statusText && (
            <p
              role={isError ? 'alert' : 'status'}
              aria-live={isError ? undefined : 'polite'}
              className={
                isError
                  ? 'truncate text-sm text-amber-700 dark:text-amber-400'
                  : 'truncate text-sm text-neutral-500'
              }
            >
              {statusText}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={sounding ? pause : resume}
          aria-label={toggleLabel}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <span aria-hidden="true">{sounding ? '⏸' : '▶'}</span>
        </button>
        <button
          type="button"
          onClick={stop}
          aria-label={t('player.close')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </div>
  )
}
