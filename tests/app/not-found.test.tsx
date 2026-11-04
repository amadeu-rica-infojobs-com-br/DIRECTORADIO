import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NotFound from '@/app/not-found'

describe('app not-found', () => {
  it('renders the Spanish 404 with a link home', () => {
    render(<NotFound />)
    expect(screen.getByText('No hemos encontrado esta página')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a la portada' })).toHaveAttribute('href', '/')
  })
})
