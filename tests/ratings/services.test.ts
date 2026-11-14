// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { brevoSender } from '@/ratings/brevo'
import { verifyTurnstile } from '@/ratings/turnstile'

const MSG = { to: 'ana@mail.com', stationName: 'Radio A', stars: 4, url: 'https://directoradio.com/valoraciones/verificar?token=abc' }

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('brevoSender', () => {
  it('sends the verification email through the Brevo API', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}', { status: 201 }))
    await brevoSender('k', fetchMock as unknown as typeof fetch)(MSG)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(new Headers(init?.headers).get('api-key')).toBe('k')
    const body = JSON.parse(String(init?.body))
    expect(body.sender.email).toBe('no-responder@directoradio.com')
    expect(body.to[0].email).toBe('ana@mail.com')
    expect(body.subject).toBe('Confirma tu valoración de Radio A')
    expect(body.htmlContent).toContain(MSG.url)
    expect(body.textContent).toContain(MSG.url)
  })

  it('throws when Brevo answers with an error', async () => {
    const fetchMock = vi.fn(async () => new Response('fail', { status: 500 }))
    await expect(brevoSender('k', fetchMock as unknown as typeof fetch)(MSG)).rejects.toThrow()
  })

  it('logs the link instead of sending without an API key', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    await brevoSender(undefined)(MSG)
    expect(info).toHaveBeenCalledWith('[valoraciones] enlace de verificación:', MSG.url)
  })
})

describe('verifyTurnstile', () => {
  it('posts secret, response and remote ip and returns success', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ success: true }))
    expect(await verifyTurnstile('tok', '1.2.3.4', 'sec', fetchMock as unknown as typeof fetch)).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    const form = init?.body as URLSearchParams
    expect(form.get('secret')).toBe('sec')
    expect(form.get('response')).toBe('tok')
    expect(form.get('remoteip')).toBe('1.2.3.4')
  })

  it('returns false for a non-string token without calling fetch', async () => {
    const fetchMock = vi.fn()
    expect(await verifyTurnstile(undefined, null, 'sec', fetchMock as unknown as typeof fetch)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('without a secret passes only outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    expect(await verifyTurnstile('tok', null, undefined)).toBe(true)
    vi.stubEnv('NODE_ENV', 'production')
    expect(await verifyTurnstile('tok', null, undefined)).toBe(false)
  })
})
