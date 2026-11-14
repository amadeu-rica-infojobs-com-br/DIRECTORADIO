import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Logo } from '@/components/Logo'

describe('Logo', () => {
  it('links home with the accessible name DirectoRadio', () => {
    render(<Logo />)
    expect(screen.getByRole('link', { name: 'DirectoRadio' })).toHaveAttribute('href', '/')
  })

  it('hides the symbol from assistive technology', () => {
    const { container } = render(<Logo />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('writes DirectoRadio with "Radio" in the accent color, light and dark', () => {
    const { container } = render(<Logo />)
    expect(container.textContent).toBe('DirectoRadio')
    const accent = screen.getByText('Radio')
    expect(accent).toHaveClass('text-[#0d9488]', 'dark:text-[#5eead4]')
  })

  it('colors the symbol background per theme', () => {
    const { container } = render(<Logo />)
    expect(container.querySelector('svg rect')).toHaveClass('fill-[#0f172a]', 'dark:fill-[#134e4a]')
  })
})
