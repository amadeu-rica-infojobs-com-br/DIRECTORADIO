export type ConsentChoice = 'granted' | 'denied'

export const CONSENT_STORAGE_KEY = 'dr.consent'
/** La elección se vuelve a pedir pasados 12 meses. */
export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000
/** Evento de ventana que vuelve a abrir el banner ("Configurar cookies"). */
export const OPEN_CONSENT_EVENT = 'dr:open-consent'

// `window.dataLayer` ya lo declara @next/third-parties; aquí solo falta `gtag`.
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

const GTM_ID_RE = /^GTM-[A-Z0-9]+$/

export function getGtmId(raw: string | undefined): string | null {
  const id = raw?.trim() ?? ''
  return GTM_ID_RE.test(id) ? id : null
}

function isChoice(value: unknown): value is ConsentChoice {
  return value === 'granted' || value === 'denied'
}

export function readConsent(now: number = Date.now()): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { choice, at } = parsed as { choice?: unknown; at?: unknown }
    if (!isChoice(choice) || typeof at !== 'number' || !Number.isFinite(at)) return null
    if (now - at > CONSENT_MAX_AGE_MS) return null
    return choice
  } catch {
    // localStorage bloqueado o JSON roto: como si no hubiera elección.
    return null
  }
}

export function saveConsent(choice: ConsentChoice, now: number = Date.now()): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ choice, at: now }))
  } catch {
    // localStorage bloqueado: la elección vale solo para esta página.
  }
}

export function sendConsentUpdate(choice: ConsentChoice): void {
  window.gtag?.('consent', 'update', { analytics_storage: choice })
}
