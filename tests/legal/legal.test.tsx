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

  it('privacy policy matches what the code actually does', () => {
    const { container } = render(<Privacidad />)
    const text = container.textContent ?? ''
    // Cloudflare recibe la IP real y señales del navegador para Turnstile.
    expect(text).toMatch(/Turnstile[^.]*dirección IP/)
    // Hash con sal de la IP: seudonimizada, no «irreversible».
    expect(text).toContain('seudonimizada')
    expect(text).not.toContain('irreversible')
    // Los plazos se aplican en la limpieza diaria.
    expect(text).toContain('limpieza diaria')
    // Brevo guarda sus propios registros de envío.
    expect(text).toMatch(/Brevo conserva/)
    // No se afirma un plazo de Google Analytics que el código no controla.
    expect(text).not.toContain('14 meses')
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
