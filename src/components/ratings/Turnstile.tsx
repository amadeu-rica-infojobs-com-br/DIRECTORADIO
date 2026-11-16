'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef } from 'react'

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string
      language?: string
      callback?: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
    },
  ) => string | undefined
  reset: (id: string) => void
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/**
 * Widget de Cloudflare Turnstile con renderizado explícito: se pinta al montar (también tras navegar
 * en el cliente a otra ficha), se reinicia cuando cambia `resetKey` (los tokens son de un solo uso)
 * y se quita al desmontar. Deja su token en un campo oculto «cf-turnstile-response» dentro del
 * formulario. Sin clave de sitio (desarrollo), no pinta nada.
 */
export function Turnstile({ resetKey, onToken }: { resetKey: number; onToken?: (token: string | null) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | undefined>(undefined)
  // Ref para no volver a pintar el widget si cambia la función del padre.
  const tokenListener = useRef(onToken)
  useEffect(() => {
    tokenListener.current = onToken
  }, [onToken])

  const renderWidget = useCallback(() => {
    if (!siteKey || !box.current || widget.current || !window.turnstile) return
    widget.current = window.turnstile.render(box.current, {
      sitekey: siteKey,
      language: 'es',
      callback: (token) => tokenListener.current?.(token),
      'expired-callback': () => tokenListener.current?.(null),
      'error-callback': () => tokenListener.current?.(null),
    })
  }, [siteKey])

  // Si el script ya estaba cargado (otra ficha), se pinta al montar.
  useEffect(() => {
    renderWidget()
    return () => {
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = undefined
    }
  }, [renderWidget])

  useEffect(() => {
    if (resetKey > 0 && widget.current) {
      tokenListener.current?.(null)
      window.turnstile?.reset(widget.current)
    }
  }, [resetKey])

  if (!siteKey) return null
  return (
    <>
      <Script src={SCRIPT} strategy="afterInteractive" onReady={renderWidget} />
      <div ref={box} />
    </>
  )
}
