import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NoResults } from '@/components/search/NoResults'

describe('NoResults', () => {
  it('explains and offers to remove each filter or see everything', () => {
    render(<NoResults criteria={{ country: 'PT', language: 'ca' }} />)
    expect(screen.getByText('No hemos encontrado emisoras con estos criterios.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Quitar «País: Portugal»' })).toHaveAttribute('href', '/buscar?idioma=ca')
    expect(screen.getByRole('link', { name: 'Quitar «Idioma: Catalán»' })).toHaveAttribute('href', '/buscar?pais=PT')
    expect(screen.getByRole('link', { name: 'Ver todas las emisoras' })).toHaveAttribute('href', '/buscar')
  })

  it('suggests checking the spelling when only text was given', () => {
    render(<NoResults criteria={{ q: 'zzzz' }} />)
    expect(screen.getByText('Revisa cómo está escrito el nombre.')).toBeInTheDocument()
  })
})
