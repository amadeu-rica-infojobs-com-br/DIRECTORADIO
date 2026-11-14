const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Comprueba en el servidor el token del widget de Cloudflare Turnstile. */
export async function verifyTurnstile(
  token: unknown,
  ip: string | null,
  secret: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  // Sin clave secreta solo se deja pasar fuera de producción (desarrollo y tests).
  if (!secret) return process.env.NODE_ENV !== 'production'
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false
  const form = new URLSearchParams({ secret, response: token })
  if (ip) form.set('remoteip', ip)
  try {
    const res = await fetchImpl(SITEVERIFY, { method: 'POST', body: form, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: unknown }
    return data.success === true
  } catch {
    return false
  }
}
