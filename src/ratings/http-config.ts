import { revalidatePath } from 'next/cache'
import { brevoSender } from './brevo'
import { ratingsEnabled, siteUrl } from './config'
import type { RatingHttpConfig } from './http'
import { verifyTurnstile } from './turnstile'

/** Configuración real de las rutas de valoraciones, desde las variables de entorno. */
export function ratingHttpConfig(): RatingHttpConfig {
  return {
    // Sin secreto no hay cookie de votante segura, y sin sal de IP no hay límites por IP: las valoraciones
    // quedan apagadas antes que funcionar a medias (spec plan 4 §5.4).
    enabled: ratingsEnabled() && Boolean(process.env.RATINGS_SECRET) && Boolean(process.env.PLAYS_IP_SALT),
    secret: process.env.RATINGS_SECRET ?? '',
    salt: process.env.PLAYS_IP_SALT || undefined,
    siteUrl: siteUrl(),
    send: brevoSender(process.env.BREVO_API_KEY || undefined),
    verifyCaptcha: (token, ip) => verifyTurnstile(token, ip, process.env.TURNSTILE_SECRET_KEY || undefined),
    revalidate: (path) => revalidatePath(path),
  }
}
