import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CookiePolicyPage, { metadata } from '@/app/politica-de-cookies/page'

describe('cookie policy page', () => {
  it('has the Spanish title and metadata', () => {
    render(<CookiePolicyPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Política de cookies' })).toBeInTheDocument()
    expect(metadata.title).toBe('Política de cookies · DirectoRadio')
  })

  it.each(['_ga', 'dr.consent', 'dr.session', '12 meses', 'Configurar cookies'])('mentions %s', (text) => {
    const { container } = render(<CookiePolicyPage />)
    expect(container.textContent).toContain(text)
  })
})
