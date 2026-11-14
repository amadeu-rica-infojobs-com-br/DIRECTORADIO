'use client'

import Script from 'next/script'

/**
 * Widget invisible de Cloudflare Turnstile. El script rellena un campo oculto «cf-turnstile-response»
 * dentro del formulario que lo contiene. Sin clave de sitio (desarrollo), no pinta nada.
 */
export function Turnstile() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  if (!siteKey) return null
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={siteKey} data-size="invisible" data-language="es" />
    </>
  )
}
