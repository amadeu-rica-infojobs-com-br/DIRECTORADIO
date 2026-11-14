import { ownerMissing } from './owner'

/**
 * Impide activar las valoraciones (que guardan emails) sin los datos del titular en el aviso legal.
 * ALLOW_PENDING_LEGAL=true solo se usa en los tests de Playwright.
 */
export function assertLegalReady(env: Record<string, string | undefined> = process.env): void {
  if (env.RATINGS_ENABLED !== 'true' || env.ALLOW_PENDING_LEGAL === 'true') return
  const missing = ownerMissing()
  if (missing.length > 0) {
    throw new Error(`Faltan datos del titular en src/legal/owner.ts: ${missing.join(', ')}. Rellénalos antes de activar las valoraciones.`)
  }
}
