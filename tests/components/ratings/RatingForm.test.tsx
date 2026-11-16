import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RatingForm } from '@/components/ratings/RatingForm'

const STATION = 'aaaaaaaa-0000-4000-8000-000000000001'

let fetchMock: ReturnType<typeof vi.fn>

function respond(postStatus: number, postBody: unknown = null, me: string | null = null) {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/valoraciones/yo') return Response.json({ email: me })
    return postBody === null ? new Response(null, { status: postStatus }) : Response.json(postBody, { status: postStatus })
  })
  vi.stubGlobal('fetch', fetchMock)
}

beforeEach(() => respond(202, { status: 'pending', email: 'ana@mail.com' }))
afterEach(() => vi.unstubAllGlobals())

async function fillAndSend(container: HTMLElement) {
  fireEvent.click(screen.getByRole('radio', { name: '4 estrellas' }))
  fireEvent.change(await screen.findByLabelText('Tu email'), { target: { value: 'ana@mail.com' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /He leído y acepto la política de privacidad/ }))
  // Turnstile rellena este campo oculto en el navegador.
  const hidden = document.createElement('input')
  hidden.name = 'cf-turnstile-response'
  hidden.value = 'tok'
  container.querySelector('form')!.appendChild(hidden)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Enviar valoración' }))
  })
}

describe('RatingForm', () => {
  it('shows only the stars until one is chosen', () => {
    render(<RatingForm stationId={STATION} stationName="Radio A" />)
    expect(screen.getByRole('radiogroup', { name: 'Valora esta emisora' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(screen.queryByLabelText('Tu email')).not.toBeInTheDocument()
  })

  it('moves the selection with the arrow keys', () => {
    render(<RatingForm stationId={STATION} stationName="Radio A" />)
    fireEvent.click(screen.getByRole('radio', { name: '3 estrellas' }))
    fireEvent.keyDown(screen.getByRole('radio', { name: '3 estrellas' }), { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: '4 estrellas' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.keyDown(screen.getByRole('radio', { name: '4 estrellas' }), { key: 'ArrowLeft' })
    expect(screen.getByRole('radio', { name: '3 estrellas' })).toHaveAttribute('aria-checked', 'true')
  })

  it('prefills the email of a remembered voter', async () => {
    respond(200, { status: 'counted' }, 'ana@mail.com')
    render(<RatingForm stationId={STATION} stationName="Radio A" />)
    fireEvent.click(screen.getByRole('radio', { name: '5 estrellas' }))
    await waitFor(() => expect(screen.getByLabelText('Tu email')).toHaveValue('ana@mail.com'))
  })

  it('sends the vote as JSON and shows the pending message', async () => {
    const { container } = render(<RatingForm stationId={STATION} stationName="Radio A" />)
    await fillAndSend(container)
    const post = fetchMock.mock.calls.find((c) => c[0] === '/api/valoraciones')!
    expect(JSON.parse(String(post[1].body))).toEqual({
      stationId: STATION,
      stars: 4,
      email: 'ana@mail.com',
      acceptedPrivacy: true,
      turnstileToken: 'tok',
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Te hemos enviado un email a ana@mail.com. Pulsa el enlace para que tu valoración cuente (caduca en 24 horas).',
    )
  })

  it.each([
    [200, { status: 'counted' }, '¡Gracias! Tu valoración ya cuenta.'],
    [429, null, 'Has hecho demasiados intentos. Vuelve a probar más tarde.'],
    [400, { status: 'captcha' }, 'No hemos podido comprobar que no eres un robot. Recarga la página e inténtalo de nuevo.'],
    [502, null, 'No hemos podido enviar el email. Inténtalo de nuevo en unos minutos.'],
    [500, null, 'Algo ha fallado. Inténtalo de nuevo.'],
  ])('shows the message for a %i answer', async (code, body, message) => {
    respond(code, body)
    const { container } = render(<RatingForm stationId={STATION} stationName="Radio A" />)
    await fillAndSend(container)
    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  it('does not send without accepting the privacy policy', async () => {
    render(<RatingForm stationId={STATION} stationName="Radio A" />)
    fireEvent.click(screen.getByRole('radio', { name: '4 estrellas' }))
    fireEvent.change(await screen.findByLabelText('Tu email'), { target: { value: 'ana@mail.com' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar valoración' }))
    })
    expect(fetchMock.mock.calls.filter((c) => c[0] === '/api/valoraciones')).toHaveLength(0)
  })

  it('explains what is missing and focuses the first invalid field', async () => {
    render(<RatingForm stationId={STATION} stationName="Radio A" />)
    fireEvent.click(screen.getByRole('radio', { name: '4 estrellas' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar valoración' }))
    })
    expect(screen.getByText('Escribe un email válido.')).toBeInTheDocument()
    expect(screen.getByText('Tienes que aceptar la política de privacidad para enviar tu valoración.')).toBeInTheDocument()
    expect(screen.getByLabelText('Tu email')).toHaveFocus()
  })

  it('renders Turnstile explicitly, resets it after each submit and removes it on unmount', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key')
    // Como Cloudflare, el widget entrega su token por callback al pintarse.
    const api = {
      render: vi.fn((_el: HTMLElement, opts: { callback?: (t: string) => void }) => {
        setTimeout(() => opts.callback?.('tok'), 0)
        return 'w1'
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    }
    ;(window as unknown as { turnstile: typeof api }).turnstile = api
    const { container, unmount } = render(<RatingForm stationId={STATION} stationName="Radio A" />)
    fireEvent.click(screen.getByRole('radio', { name: '4 estrellas' }))
    await waitFor(() => expect(api.render).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ sitekey: 'site-key' })))
    await screen.findByRole('button', { name: 'Enviar valoración' })
    await fillAndSend(container)
    await screen.findByRole('status')
    expect(api.reset).toHaveBeenCalledWith('w1')
    unmount()
    expect(api.remove).toHaveBeenCalledWith('w1')
    delete (window as unknown as { turnstile?: unknown }).turnstile
    vi.unstubAllEnvs()
  })

  it('keeps the send button disabled until Turnstile hands over a token', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key')
    let callback: ((token: string) => void) | undefined
    const api = {
      render: vi.fn((_el: HTMLElement, opts: { callback?: (t: string) => void }) => {
        callback = opts.callback
        return 'w1'
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    }
    ;(window as unknown as { turnstile: typeof api }).turnstile = api
    render(<RatingForm stationId={STATION} stationName="Radio A" />)
    fireEvent.click(screen.getByRole('radio', { name: '4 estrellas' }))
    const button = await screen.findByRole('button', { name: 'Comprobando…' })
    expect(button).toBeDisabled()
    await waitFor(() => expect(callback).toBeDefined())
    act(() => callback!('tok'))
    expect(screen.getByRole('button', { name: 'Enviar valoración' })).toBeEnabled()
    delete (window as unknown as { turnstile?: unknown }).turnstile
    vi.unstubAllEnvs()
  })
})
