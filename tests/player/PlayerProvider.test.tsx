import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerProvider, usePlayer } from '@/player/PlayerProvider'
import type { PlayableStation } from '@/player/source'

const hls = vi.hoisted(() => ({ created: 0, sources: [] as string[], attached: 0, destroyed: 0 }))

vi.mock('hls.js', () => {
  class FakeHls {
    static isSupported(): boolean {
      return true
    }
    constructor() {
      hls.created += 1
    }
    loadSource(src: string): void {
      hls.sources.push(src)
    }
    attachMedia(): void {
      hls.attached += 1
    }
    destroy(): void {
      hls.destroyed += 1
    }
  }
  return { default: FakeHls }
})

const A: PlayableStation = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  slug: 'radio-a',
  name: 'Radio A',
  logoUrl: null,
  streamUrl: 'https://cdn.example/a',
}
const B: PlayableStation = {
  id: 'bbbbbbbb-0000-4000-8000-000000000002',
  slug: 'radio-b',
  name: 'Radio B',
  logoUrl: null,
  streamUrl: 'https://cdn.example/b',
}
const HLS: PlayableStation = { ...A, streamUrl: 'https://cdn.example/live.m3u8' }

let srcAtLoad: (string | null)[] = []
let fetchMock: ReturnType<typeof vi.fn>

function Harness() {
  const { current, status, play, pause, resume, stop } = usePlayer()
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="current">{current?.id ?? 'none'}</span>
      <button type="button" onClick={() => play(A)}>
        play A
      </button>
      <button type="button" onClick={() => play(B)}>
        play B
      </button>
      <button type="button" onClick={() => play(HLS)}>
        play HLS
      </button>
      <button type="button" onClick={pause}>
        pause
      </button>
      <button type="button" onClick={resume}>
        resume
      </button>
      <button type="button" onClick={stop}>
        stop
      </button>
    </div>
  )
}

// El provider crea su único <audio> fuera del árbol de React y lo cuelga de <body>.
function getAudio(): HTMLAudioElement {
  const audio = document.querySelector<HTMLAudioElement>('audio[data-testid="dr-audio"]')
  if (!audio) throw new Error('no audio element')
  return audio
}

function click(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
}

function status(): string {
  return screen.getByTestId('status').textContent ?? ''
}

beforeEach(() => {
  srcAtLoad = []
  hls.created = 0
  hls.sources = []
  hls.attached = 0
  hls.destroyed = 0
  sessionStorage.clear()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function (this: HTMLMediaElement) {
    srcAtLoad.push(this.getAttribute('src'))
  })
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  // Desmontar antes de restaurar: si no, la limpieza de RTL usa el audio real de jsdom.
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('PlayerProvider', () => {
  it('switching station releases previous stream', () => {
    render(
      <PlayerProvider>
        <Harness />
      </PlayerProvider>,
    )

    click('play A')
    expect(getAudio().getAttribute('src')).toBe(A.streamUrl)

    click('play B')
    expect(srcAtLoad).toEqual([null])
    expect(getAudio().getAttribute('src')).toBe(B.streamUrl)
    expect(screen.getByTestId('current')).toHaveTextContent(B.id)
    expect(document.querySelectorAll('audio')).toHaveLength(1)
  })

  it('records play once per station per session', () => {
    render(
      <PlayerProvider>
        <Harness />
      </PlayerProvider>,
    )

    click('play A')
    fireEvent(getAudio(), new Event('playing'))
    click('pause')
    click('resume')
    fireEvent(getAudio(), new Event('playing'))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/reproducciones')
    expect(init.method).toBe('POST')
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(String(init.body))).toEqual({
      stationId: A.id,
      sessionId: sessionStorage.getItem('dr.session'),
    })
  })

  it('records a play for each new station', () => {
    render(
      <PlayerProvider>
        <Harness />
      </PlayerProvider>,
    )

    click('play A')
    fireEvent(getAudio(), new Event('playing'))
    click('play B')
    fireEvent(getAudio(), new Event('playing'))

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('status goes connecting -> playing -> paused', () => {
    render(
      <PlayerProvider>
        <Harness />
      </PlayerProvider>,
    )

    expect(status()).toBe('idle')
    click('play A')
    expect(status()).toBe('connecting')
    fireEvent(getAudio(), new Event('playing'))
    expect(status()).toBe('playing')
    click('pause')
    expect(status()).toBe('paused')
    expect(srcAtLoad).toEqual([null])
    expect(screen.getByTestId('current')).toHaveTextContent(A.id)
  })

  it('error status on media error', () => {
    render(
      <PlayerProvider>
        <Harness />
      </PlayerProvider>,
    )

    click('play A')
    fireEvent(getAudio(), new Event('error'))
    expect(status()).toBe('error')
  })

  it('ignores stale media events after stopping', () => {
    render(
      <PlayerProvider>
        <Harness />
      </PlayerProvider>,
    )

    click('play A')
    click('stop')
    fireEvent(getAudio(), new Event('playing'))

    expect(status()).toBe('idle')
    expect(screen.getByTestId('current')).toHaveTextContent('none')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses hls.js for m3u8 streams and destroys it on switch', async () => {
    render(
      <PlayerProvider>
        <Harness />
      </PlayerProvider>,
    )

    click('play HLS')
    await waitFor(() => expect(hls.sources).toEqual([HLS.streamUrl]))
    expect(hls.attached).toBe(1)
    expect(getAudio().getAttribute('src')).toBeNull()

    click('play B')
    expect(hls.destroyed).toBe(1)
  })
})
