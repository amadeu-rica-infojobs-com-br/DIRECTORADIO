import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioPlayer } from '@/components/AudioPlayer'
import { t } from '@/i18n'
import { PlayerProvider } from '@/player/PlayerProvider'
import type { PlayableStation } from '@/player/source'

const STATION: PlayableStation = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  slug: 'radio-a',
  name: 'Radio A',
  logoUrl: null,
  streamUrl: 'https://cdn.example/a',
}

function renderPlayer(station: PlayableStation) {
  return render(
    <PlayerProvider>
      <AudioPlayer station={station} />
    </PlayerProvider>,
  )
}

function getAudio(): HTMLAudioElement {
  const audio = document.querySelector<HTMLAudioElement>('audio[data-testid="dr-audio"]')
  if (!audio) throw new Error('no audio element')
  return audio
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_AUDIO_PROXY_URL', '')
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
})

afterEach(() => {
  // Desmontar antes de restaurar: si no, la limpieza de RTL usa el audio real de jsdom.
  cleanup()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AudioPlayer', () => {
  it('shows notice when source unavailable', () => {
    renderPlayer({ ...STATION, streamUrl: 'http://cdn.example/a' })
    expect(screen.getByText(t('station.httpSoon'))).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows notice for invalid URLs', () => {
    renderPlayer({ ...STATION, streamUrl: 'not a url' })
    expect(screen.getByText(t('station.httpSoon'))).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('starts global player', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    renderPlayer(STATION)

    fireEvent.click(screen.getByRole('button', { name: t('station.listen') }))

    expect(play).toHaveBeenCalledTimes(1)
    expect(getAudio().getAttribute('src')).toBe(STATION.streamUrl)
    expect(screen.getByText(t('player.connecting'))).toBeInTheDocument()

    fireEvent(getAudio(), new Event('playing'))
    expect(screen.getByRole('button', { name: t('station.pause') })).toBeInTheDocument()
  })

  it('pauses the global player when this station is already playing', () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    renderPlayer(STATION)

    fireEvent.click(screen.getByRole('button', { name: t('station.listen') }))
    fireEvent(getAudio(), new Event('playing'))
    fireEvent.click(screen.getByRole('button', { name: t('station.pause') }))

    expect(pause).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: t('station.listen') })).toBeInTheDocument()
  })
})
