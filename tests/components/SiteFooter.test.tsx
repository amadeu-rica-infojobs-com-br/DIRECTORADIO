import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SiteFooter } from '@/components/SiteFooter'
import { OPEN_CONSENT_EVENT } from '@/consent/consent'

describe('SiteFooter', () => {
  it('links to the cookie policy and reopens the banner', () => {
    const listener = vi.fn()
    window.addEventListener(OPEN_CONSENT_EVENT, listener)
    render(<SiteFooter showCookieSettings />)
    expect(screen.getByRole('link', { name: 'Política de cookies' })).toHaveAttribute('href', '/politica-de-cookies')
    fireEvent.click(screen.getByRole('button', { name: 'Configurar cookies' }))
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(OPEN_CONSENT_EVENT, listener)
  })

  it('hides the cookie settings button without analytics', () => {
    render(<SiteFooter showCookieSettings={false} />)
    expect(screen.getByRole('link', { name: 'Política de cookies' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Configurar cookies' })).not.toBeInTheDocument()
  })
})
