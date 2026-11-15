/** Interruptor de las valoraciones: solo "true" las activa (spec plan 4 §5.6). */
export function ratingsEnabled(): boolean {
  return process.env.RATINGS_ENABLED === 'true'
}

/** Base de los enlaces de verificación. */
export function siteUrl(): string {
  return (process.env.SITE_URL || 'https://directoradio.com').replace(/\/+$/, '')
}
