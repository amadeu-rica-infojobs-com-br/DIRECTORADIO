'use client'

import { useEffect, useRef, useState } from 'react'
import { t } from '@/i18n'

type Status = 'idle' | 'playing' | 'error'

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

// Removing src alone keeps the live connection open; load() aborts it.
function releaseStream(audio: HTMLAudioElement) {
  audio.pause()
  audio.removeAttribute('src')
  try {
    audio.load()
  } catch {
    // No media loader (e.g. jsdom): nothing to abort.
  }
}

export function AudioPlayer({ streamUrl, stationName }: { streamUrl: string; stationName: string }) {
  const [status, setStatus] = useState<Status>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playable = isHttps(streamUrl)

  function release() {
    const audio = audioRef.current
    if (!audio) return
    audioRef.current = null
    releaseStream(audio)
  }

  useEffect(() => {
    return () => {
      const audio = audioRef.current
      audioRef.current = null
      if (audio) releaseStream(audio)
    }
  }, [])

  if (!playable) {
    return <p className="text-sm text-neutral-500">{t('station.httpSoon')}</p>
  }

  function toggle() {
    if (status === 'playing') {
      release()
      setStatus('idle')
      return
    }

    release()
    const audio = document.createElement('audio')
    audio.preload = 'none'
    audio.addEventListener('error', () => {
      if (audioRef.current !== audio) return
      release()
      setStatus('error')
    })
    audio.addEventListener('ended', () => {
      if (audioRef.current !== audio) return
      release()
      setStatus('idle')
    })
    audio.src = streamUrl
    audioRef.current = audio
    setStatus('playing')
    audio.play().catch(() => {
      if (audioRef.current !== audio) return
      release()
      setStatus('error')
    })
  }

  const playing = status === 'playing'
  return (
    <div role="group" aria-label={stationName} className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t('station.pause') : t('station.listen')}
        className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        <span aria-hidden="true">{playing ? '⏸' : '▶'}</span>
        <span>{playing ? t('station.pause') : t('station.listen')}</span>
      </button>
      {status === 'error' && (
        <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
          {t('station.unhealthy')}
        </p>
      )}
    </div>
  )
}
