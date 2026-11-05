'use client'

import { t } from '@/i18n'
import { usePlayer } from '@/player/PlayerProvider'
import { audioProxyBase, resolveSource, type PlayableStation } from '@/player/source'

export function AudioPlayer({ station }: { station: PlayableStation }) {
  const { current, status, play, pause } = usePlayer()

  if (!resolveSource(station.streamUrl, audioProxyBase(), station.id)) {
    return <p className="text-sm text-neutral-500">{t('station.httpSoon')}</p>
  }

  const active = current?.id === station.id
  const sounding = active && (status === 'playing' || status === 'connecting')
  const label = sounding ? t('station.pause') : t('station.listen')

  return (
    <button
      type="button"
      onClick={() => (sounding ? pause() : play(station))}
      aria-label={label}
      className="inline-flex w-fit items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
    >
      <span aria-hidden="true">{sounding ? '⏸' : '▶'}</span>
      <span>{active && status === 'connecting' ? t('player.connecting') : label}</span>
    </button>
  )
}
