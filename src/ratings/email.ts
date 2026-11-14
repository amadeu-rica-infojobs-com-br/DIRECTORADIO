const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL = 254

/** Email recortado y en minúsculas, o null si no es válido. No se deducen alias (+, puntos de Gmail). */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  return email.length <= MAX_EMAIL && EMAIL_RE.test(email) ? email : null
}
