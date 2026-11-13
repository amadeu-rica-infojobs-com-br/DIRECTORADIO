import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioPlayer } from '@/components/AudioPlayer'
import { OPEN_CONSENT_EVENT, readConsent, saveConsent } from '@/consent/consent'
import { CookieBanner } from '@/consent/CookieBanner'
import { PlayerProvider } from '@/player/PlayerProvider'

const STATION = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  slug: 'radio-a',
  name: 'Radio A',
  logoUrl: null,
  streamUrl: 'https://cdn.example/a',
}

type Gtag = (...args: unknown[]) => void
let gtag: ReturnType<typeof vi.fn<Gtag>>

function renderBanner(withPlayer = false) {
  return render(
    <PlayerProvider>
      {withPlayer && <AudioPlayer station={STATION} />}
      <CookieBanner />
    </PlayerProvider>,
  )
}

const banner = () => screen.queryByRole('region', { name: 'Aviso de cookies' })

beforeEach(() => {
  localStorage.clear()
  gtag = vi.fn<Gtag>()
  window.gtag = gtag
})

afterEach(() => {
  cleanup()
  delete window.gtag
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('CookieBanner', () => {
  it('shows accept, reject and the policy link when there is no choice', () => {
    renderBanner()
    expect(banner()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Política de cookies' })).toHaveAttribute('href', '/politica-de-cookies')
  })

  it('accepting grants analytics, stores the choice and closes', () => {
    renderBanner()
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(gtag).toHaveBeenCalledWith('consent', 'update', { analytics_storage: 'granted' })
    expect(readConsent()).toBe('granted')
    expect(banner()).not.toBeInTheDocument()
  })

  it('rejecting stores the choice without calling gtag the first time', () => {
    renderBanner()
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }))
    expect(readConsent()).toBe('denied')
    expect(gtag).not.toHaveBeenCalled()
    expect(banner()).not.toBeInTheDocument()
  })

  it('reserves space at the end of the page while open, so it never hides content', () => {
    renderBanner()
    expect(screen.getByTestId('consent-spacer')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(screen.queryByTestId('consent-spacer')).not.toBeInTheDocument()
  })

  it('stays hidden when a choice is stored', () => {
    saveConsent('granted')
    renderBanner()
    expect(banner()).not.toBeInTheDocument()
  })

  it('reopens on the open event and lets the user withdraw consent', () => {
    saveConsent('granted')
    renderBanner()
    act(() => {
      window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))
    })
    expect(banner()).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }))
    expect(gtag).toHaveBeenCalledWith('consent', 'update', { analytics_storage: 'denied' })
    expect(readConsent()).toBe('denied')
  })

  it('styles both buttons the same', () => {
    renderBanner()
    expect(screen.getByRole('button', { name: 'Aceptar' }).className).toBe(
      screen.getByRole('button', { name: 'Rechazar' }).className,
    )
  })

  it('works with a blocked localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    renderBanner()
    expect(banner()).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(banner()).not.toBeInTheDocument()
  })

  it('sits above the mini player while a station is playing', async () => {
    vi.stubEnv('NEXT_PUBLIC_AUDIO_PROXY_URL', '')
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    renderBanner(true)
    expect(banner()).toHaveClass('bottom-0')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Escuchar en directo/ }))
    })
    expect(banner()).toHaveClass('bottom-20')
    expect(banner()).not.toHaveClass('bottom-0')
  })
})
