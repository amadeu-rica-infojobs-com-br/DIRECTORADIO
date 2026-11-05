import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StationCard } from '@/components/StationCard'
import { Pagination } from '@/components/Pagination'
import { t, tn } from '@/i18n'
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

  it('renders http logos over https', () => {
    const { container } = render(
      <StationCard station={{ ...station, logoUrl: 'http://example.com/ser.png' }} />,
    )
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/ser.png')
  })

  it('shows initial without img for non-http(s) logo urls', () => {
    const { container } = render(
      <StationCard station={{ ...station, logoUrl: 'javascript:alert(1)' }} />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('shows initial when the image already failed before mount', () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
    const width = vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0)
    try {
      const { container } = render(<StationCard station={station} />)
      expect(container.querySelector('img')).toBeNull()
      expect(screen.getByText('C')).toBeInTheDocument()
    } finally {
      complete.mockRestore()
      width.mockRestore()
    }
  })

  it('keeps a loaded image', () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
    const width = vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(64)
    try {
      const { container } = render(<StationCard station={station} />)
      expect(container.querySelector('img')).not.toBeNull()
    } finally {
      complete.mockRestore()
      width.mockRestore()
    }
  })

  it('rounds rating to half stars with accessible label', () => {
    render(<StationCard station={station} />)
    expect(screen.getByLabelText(t('station.ratingLabel', { avg: '4,5' }))).toBeInTheDocument()
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

  it('labels the nav from i18n', () => {
    render(<Pagination page={1} pageCount={3} />)
    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Paginación')
    expect(t('pagination.label')).toBe('Paginación')
  })
})

describe('t', () => {
  it('replaces variables', () => {
    expect(tn('station.plays', 5)).toBe('5 reproducciones')
  })
})
