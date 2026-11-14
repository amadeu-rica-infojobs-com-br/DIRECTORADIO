import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FilterBar } from '@/components/search/FilterBar'

const OPTIONS = { countries: ['PT', 'ES'], languages: ['es'], genres: ['rock' as const] }

describe('FilterBar', () => {
  it('renders the chip row and a no-JS fallback with the active filter count', () => {
    const criteria = { q: 'ser', country: 'PT', genre: 'rock' as const }
    render(<FilterBar criteria={criteria} options={OPTIONS} />)
    expect(screen.getByRole('group', { name: 'Filtros' })).toBeInTheDocument()
    // React deja vacío <noscript> al pintar en el cliente; quien no tiene JS recibe el HTML del servidor.
    const html = renderToStaticMarkup(<FilterBar criteria={criteria} options={OPTIONS} />)
    expect(html).toContain('<noscript>')
    expect(html).toContain('Filtros (2)')
    expect(html).toContain('name="pais"')
    expect(html).toContain('<input type="hidden" name="q" value="ser"/>')
  })
})
