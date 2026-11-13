'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { t } from '@/i18n'
import { usePlayer } from '@/player/PlayerProvider'
import { OPEN_CONSENT_EVENT, readConsent, saveConsent, sendConsentUpdate, type ConsentChoice } from './consent'

const BUTTON =
  'rounded-full border border-neutral-900 px-5 py-2 text-sm font-semibold transition hover:bg-neutral-900 hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-neutral-900'

export function CookieBanner() {
  const { current } = usePlayer()
  const [open, setOpen] = useState(false)
  // Última elección conocida en esta página, por si localStorage está bloqueado.
  const lastChoice = useRef<ConsentChoice | null>(null)
  const bannerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    // Reserva la altura del banner al final de la página para que nunca tape el contenido (en móvil ocupa varias líneas).
    const el = bannerRef.current
    if (!open || !el) return
    setHeight(el.offsetHeight)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [open])

  useEffect(() => {
    // Tras el montaje, para no desajustar la hidratación (el HTML se genera sin elección).
    lastChoice.current = readConsent()
    setOpen(lastChoice.current === null)
    const reopen = () => setOpen(true)
    window.addEventListener(OPEN_CONSENT_EVENT, reopen)
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen)
  }, [])

  if (!open) return null

  const choose = (choice: ConsentChoice) => {
    const previous = lastChoice.current ?? readConsent()
    saveConsent(choice)
    lastChoice.current = choice
    // Denegar ya es el valor por defecto: solo se avisa si se concede o si cambia una elección previa.
    if (choice === 'granted' || (previous !== null && previous !== choice)) sendConsentUpdate(choice)
    setOpen(false)
  }

  return (
    <>
      <div data-testid="consent-spacer" aria-hidden="true" style={{ height }} />
      <div
        ref={bannerRef}
        role="region"
        aria-label={t('consent.label')}
        className={`fixed inset-x-0 z-50 ${current ? 'bottom-20' : 'bottom-0'} border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95`}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
          <p className="flex-1 text-xs sm:text-sm">
            {t('consent.text')}{' '}
            <Link href="/politica-de-cookies" className="underline">
              {t('consent.policy')}
            </Link>
          </p>
          <div className="flex gap-2">
            <button type="button" className={BUTTON} onClick={() => choose('granted')}>
              {t('consent.accept')}
            </button>
            <button type="button" className={BUTTON} onClick={() => choose('denied')}>
              {t('consent.reject')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
