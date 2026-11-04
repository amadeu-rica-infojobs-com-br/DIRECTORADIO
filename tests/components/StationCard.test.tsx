import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StationCard } from '@/components/StationCard'
import { Pagination } from '@/components/Pagination'
import { t } from '@/i18n'
import type { StationCardData } from '@/catalog/queries'

const station: StationCardData = {
  slug: 'cadena-ser',
  name: 'Cadena SER',
  logoUrl: 'https://example.com/ser.png',
  countryCode: 'ES',
  genre: 'generalista',
  ratingAvg: 4.3,
  ratingCount: 10,
}

describe('StationCard', () => {
  it('renders name, country and genre', () => {
    render(<StationCard station={station} />)
    expect(screen.getByText('Cadena SER')).toBeInTheDocument()
    expect(screen.getByText(/España/)).toBeInTheDocument()
    expect(screen.getByText('Generalista')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/emisora/cadena-ser')
  })

  it('shows initial when logo fails', () => {
    const { container } = render(<StationCard station={station} />)
    const img = container.querySelector('img')!
    fireEvent.error(img)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('shows initial when logo missing', () => {
    const { container } = render(<StationCard station={{ ...station, logoUrl: null }} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('rounds rating to half stars with accessible label', () => {
    render(<StationCard station={station} />)
    expect(screen.getByLabelText('Valoración 4,5 de 5')).toBeInTheDocument()
  })

  it('renders no stars without ratings', () => {
    render(<StationCard station={{ ...station, ratingCount: 0, ratingAvg: 0 }} />)
    expect(screen.queryByLabelText(/Valoración/)).toBeNull()
  })
})

describe('Pagination', () => {
  it('hides prev on first page and next on last page', () => {
    const { rerender } = render(<Pagination page={1} pageCount={3} />)
    expect(screen.queryByText(t('pagination.prev'))).toBeNull()
    expect(screen.getByText(t('pagination.next'))).toHaveAttribute('href', '/?pagina=2')
    rerender(<Pagination page={3} pageCount={3} />)
    expect(screen.queryByText(t('pagination.next'))).toBeNull()
    expect(screen.getByText(t('pagination.prev'))).toHaveAttribute('href', '/?pagina=2')
  })
})

describe('t', () => {
  it('replaces variables', () => {
    expect(t('station.plays', { count: 5 })).toBe('5 reproducciones')
  })
})
