import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ErrorPage from '@/app/error'

describe('app error', () => {
  it('renders the Spanish message and retries on click', () => {
    const retry = vi.fn()
    render(<ErrorPage error={new Error('boom')} retry={retry} />)
    expect(screen.getByText('Algo ha fallado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
