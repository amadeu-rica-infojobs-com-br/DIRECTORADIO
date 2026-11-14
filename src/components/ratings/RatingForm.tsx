'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { t } from '@/i18n'
import { Turnstile } from './Turnstile'

type Message = { kind: 'status' | 'alert'; text: string } | null

const STAR_LABELS = ['1 estrella', '2 estrellas', '3 estrellas', '4 estrellas', '5 estrellas']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Valoración en dos pasos (spec plan 4 §5.2 y §5.9): estrellas y, después, email y privacidad. */
export function RatingForm({ stationId, stationName }: { stationId: string; stationName: string }) {
  const [stars, setStars] = useState(0)
  const [email, setEmail] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [invalid, setInvalid] = useState<{ email?: boolean; privacy?: boolean }>({})
  const radios = useRef<(HTMLButtonElement | null)[]>([])
  const asked = useRef(false)

  // Al desplegar el formulario, rellena el email si este navegador ya verificó uno.
  useEffect(() => {
    if (stars === 0 || asked.current) return
    asked.current = true
    fetch('/api/valoraciones/yo')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { email?: string | null } | null) => {
        if (data?.email) setEmail((current) => current || data.email!)
      })
      .catch(() => {})
  }, [stars])

  const choose = (value: number) => {
    setStars(value)
    setMessage(null)
  }

  const onKey = (e: KeyboardEvent, value: number) => {
    const next = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? value + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? value - 1 : 0
    if (next < 1 || next > 5) return
    e.preventDefault()
    choose(next)
    radios.current[next - 1]?.focus()
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const errors = { email: !EMAIL_RE.test(email.trim()), privacy: !accepted }
    setInvalid(errors)
    if (errors.email || errors.privacy) return

    const turnstileToken = new FormData(e.currentTarget).get('cf-turnstile-response')
    setSending(true)
    setMessage(null)
    try {
      const res = await fetch('/api/valoraciones', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stationId, stars, email: email.trim(), acceptedPrivacy: true, turnstileToken }),
      })
      const body = (await res.json().catch(() => null)) as { status?: string; email?: string } | null
      if (res.status === 202) setMessage({ kind: 'status', text: t('ratings.pending', { email: body?.email ?? email.trim() }) })
      else if (res.status === 200) setMessage({ kind: 'status', text: t('ratings.counted') })
      else if (res.status === 429) setMessage({ kind: 'alert', text: t('ratings.rateLimited') })
      else if (res.status === 400 && body?.status === 'captcha') setMessage({ kind: 'alert', text: t('ratings.captcha') })
      else if (res.status === 502) setMessage({ kind: 'alert', text: t('ratings.sendFailed') })
      else setMessage({ kind: 'alert', text: t('ratings.error') })
    } catch {
      setMessage({ kind: 'alert', text: t('ratings.error') })
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-label={t('ratings.title', { name: stationName })}>
      <h2 className="text-lg font-semibold">{t('ratings.heading')}</h2>
      <div role="radiogroup" aria-label={t('ratings.heading')} className="flex gap-1">
        {STAR_LABELS.map((label, i) => {
          const value = i + 1
          const on = value <= stars
          return (
            <button
              key={value}
              ref={(el) => {
                radios.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={stars === value}
              aria-label={label}
              tabIndex={stars === value || (stars === 0 && value === 1) ? 0 : -1}
              onClick={() => choose(value)}
              onKeyDown={(e) => onKey(e, value)}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-3xl leading-none transition hover:scale-110 ${
                on ? 'text-amber-500' : 'text-neutral-300 dark:text-neutral-600'
              }`}
            >
              <span aria-hidden="true">{on ? '★' : '☆'}</span>
            </button>
          )
        })}
      </div>

      {stars > 0 && (
        <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {t('ratings.email')}
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={invalid.email || undefined}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 aria-[invalid=true]:border-red-600 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                aria-invalid={invalid.privacy || undefined}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                {t('ratings.acceptPrefix')}{' '}
                <Link href="/privacidad" className="underline">
                  {t('ratings.privacyPolicy')}
                </Link>
              </span>
            </label>
            <p className="pl-6 text-xs text-neutral-500">{t('ratings.privacyNote')}</p>
          </div>
          <Turnstile />
          <button
            type="submit"
            disabled={sending}
            className="self-start rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {t('ratings.send')}
          </button>
        </form>
      )}

      {message && (
        <p
          role={message.kind}
          className={message.kind === 'alert' ? 'text-sm text-amber-800 dark:text-amber-300' : 'text-sm text-neutral-700 dark:text-neutral-300'}
        >
          {message.text}
        </p>
      )}
    </section>
  )
}
