const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Motivo del rechazo en el log (sin token ni secreto), para poder diagnosticar en producción. */
const rejected = (reason: string) => console.warn('[valoraciones] Turnstile rechazado:', reason)

/** Comprueba en el servidor el token del widget de Cloudflare Turnstile. */
export async function verifyTurnstile(
  token: unknown,
  ip: string | null,
  rawSecret: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  // Un espacio o salto de línea pegado al dar de alta la variable haría que Cloudflare la rechace.
  const secret = rawSecret?.trim()
  // Sin clave secreta solo se deja pasar fuera de producción (desarrollo y tests).
  if (!secret) return process.env.NODE_ENV !== 'production'
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
    rejected('missing-input-response')
    return false
  }
  const form = new URLSearchParams({ secret, response: token })
  if (ip) form.set('remoteip', ip)
  try {
    const res = await fetchImpl(SITEVERIFY, { method: 'POST', body: form, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) {
      rejected(`http-${res.status}`)
      return false
    }
    const data = (await res.json()) as { success?: unknown; 'error-codes'?: unknown }
    if (data.success === true) return true
    const codes = Array.isArray(data['error-codes']) ? data['error-codes'].map(String).join(',') : 'sin-codigo'
    rejected(codes || 'sin-codigo')
    return false
  } catch (err) {
    rejected(`fetch-error: ${(err as Error).name}`)
    return false
  }
}
