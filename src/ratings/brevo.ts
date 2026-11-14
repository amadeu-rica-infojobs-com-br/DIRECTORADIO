import { writeFileSync } from 'node:fs'

export type VerificationMessage = { to: string; stationName: string; stars: number; url: string }
export type SendVerification = (msg: VerificationMessage) => Promise<void>

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const SENDER = { name: 'DirectoRadio', email: 'no-responder@directoradio.com' }
const PRIVACY_URL = 'https://directoradio.com/privacidad'

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function content({ stationName, stars, url }: VerificationMessage) {
  const starsText = `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`
  const name = escapeHtml(stationName)
  const text = [
    `Has valorado ${stationName} con ${stars} de 5 estrellas (${starsText}).`,
    '',
    'Para que tu valoración cuente, abre este enlace y pulsa «Confirmar mi valoración»:',
    url,
    '',
    'El enlace caduca en 24 horas. Si no has sido tú, ignora este email.',
    `Política de privacidad: ${PRIVACY_URL}`,
  ].join('\n')
  const html = `<p>Has valorado <strong>${name}</strong> con ${stars} de 5 estrellas (${starsText}).</p>
<p>Para que tu valoración cuente, abre este enlace y pulsa «Confirmar mi valoración»:</p>
<p><a href="${escapeHtml(url)}">Confirmar mi valoración</a></p>
<p>El enlace caduca en 24 horas. Si no has sido tú, ignora este email.</p>
<p><a href="${PRIVACY_URL}">Política de privacidad</a></p>`
  return { text, html }
}

/** Envío del email de verificación con Brevo. Sin clave (desarrollo y tests), el enlace va al log. */
export function brevoSender(apiKey: string | undefined, fetchImpl: typeof fetch = fetch): SendVerification {
  return async (msg) => {
    if (!apiKey) {
      console.info('[valoraciones] enlace de verificación:', msg.url)
      // Solo en los e2e: Playwright no ve el log del servidor, así que el enlace se deja en un archivo.
      if (process.env.RATINGS_DEV_LINK_FILE) writeFileSync(process.env.RATINGS_DEV_LINK_FILE, msg.url)
      return
    }
    const { text, html } = content(msg)
    const res = await fetchImpl(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email: msg.to }],
        subject: `Confirma tu valoración de ${msg.stationName}`,
        htmlContent: html,
        textContent: text,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Brevo respondió ${res.status}`)
  }
}
