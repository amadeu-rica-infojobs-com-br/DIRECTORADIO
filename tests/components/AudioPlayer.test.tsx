import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioPlayer } from '@/components/AudioPlayer'
import { t } from '@/i18n'

let srcAtLoad: (string | null)[] = []

beforeEach(() => {
  srcAtLoad = []
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function (this: HTMLMediaElement) {
    srcAtLoad.push(this.getAttribute('src'))
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AudioPlayer', () => {
  it('shows notice for http streams', () => {
    const { container } = render(<AudioPlayer streamUrl="http://x/s" stationName="Radio HTTP" />)
    expect(screen.getByText(t('station.httpSoon'))).toBeInTheDocument()
    expect(container.querySelector('audio')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('treats invalid URLs as not playable', () => {
    render(<AudioPlayer streamUrl="not a url" stationName="X" />)
    expect(screen.getByText(t('station.httpSoon'))).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('toggles play/pause for https', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const { container } = render(<AudioPlayer streamUrl="https://x/s" stationName="Radio" />)

    expect(container.querySelector('audio')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('station.listen')) }))

    expect(play).toHaveBeenCalledTimes(1)
    expect(container.querySelector('audio')).toBeNull()
    expect(await screen.findByText('⏸')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: t('station.pause') }))
    expect(pause).toHaveBeenCalled()
    expect(srcAtLoad).toEqual([null])
    expect(screen.getByText('▶')).toBeInTheDocument()
  })

  it('plays again after pause', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    render(<AudioPlayer streamUrl="https://x/s" stationName="Radio" />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('station.listen')) }))
    fireEvent.click(screen.getByRole('button', { name: t('station.pause') }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('station.listen')) }))
    expect(play).toHaveBeenCalledTimes(2)
    expect(srcAtLoad).toEqual([null])
  })

  it('pauses audio on unmount', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const { unmount } = render(<AudioPlayer streamUrl="https://x/s" stationName="Radio" />)
    fireEvent.click(screen.getByRole('button'))
    unmount()
    expect(pause).toHaveBeenCalledTimes(1)
    expect(srcAtLoad).toEqual([null])
  })

  it('shows unhealthy notice when audio errors', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event('error'))
      return Promise.resolve()
    })
    render(<AudioPlayer streamUrl="https://x/s" stationName="Radio" />)
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByText(t('station.unhealthy'))).toBeInTheDocument()
  })
})
