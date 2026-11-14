import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AvisoLegal from '@/app/aviso-legal/page'
import CookiePolicyPage from '@/app/politica-de-cookies/page'
import Privacidad from '@/app/privacidad/page'
import { assertLegalReady } from '@/legal/guard'
import { OWNER, ownerMissing } from '@/legal/owner'

describe('legal pages', () => {
  it('legal notice shows the owner', () => {
    const { container } = render(<AvisoLegal />)
    expect(screen.getByRole('heading', { level: 1, name: 'Aviso legal' })).toBeInTheDocument()
    expect(container.textContent).toContain(OWNER.email)
    expect(container.textContent).toContain(OWNER.nif)
  })

  it('privacy policy covers processors, retention and the AEPD', () => {
    const { container } = render(<Privacidad />)
    expect(screen.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeInTheDocument()
    for (const text of ['Brevo', '48 horas', '7 días', '35 días', 'Agencia Española de Protección de Datos', OWNER.email]) {
      expect(container.textContent).toContain(text)
    }
  })

  it('cookie policy lists the voter cookie and the owner', () => {
    const { container } = render(<CookiePolicyPage />)
    expect(container.textContent).toContain('dr_voter')
    expect(container.textContent).toContain(OWNER.email)
  })
})

describe('owner data guard', () => {
  it('lists the missing owner fields', () => {
    expect(ownerMissing()).toEqual(['name', 'nif', 'address'])
  })

  it('refuses to enable ratings with missing owner data unless explicitly allowed', () => {
    expect(() => assertLegalReady({ RATINGS_ENABLED: 'true' })).toThrow(/name, nif, address/)
    expect(() => assertLegalReady({})).not.toThrow()
    expect(() => assertLegalReady({ RATINGS_ENABLED: 'true', ALLOW_PENDING_LEGAL: 'true' })).not.toThrow()
  })
})
