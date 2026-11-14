import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ pathname: '/', params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.params,
}))

import { HeaderSearch } from '@/components/search/HeaderSearch'

afterEach(() => {
  nav.pathname = '/'
  nav.params = new URLSearchParams()
})

describe('HeaderSearch', () => {
  it('on /buscar keeps the current text and active filters', () => {
    nav.pathname = '/buscar'
    nav.params = new URLSearchParams('q=ser&pais=PT&genero=rock')
    const { container } = render(<HeaderSearch />)
    expect(screen.getByRole('searchbox')).toHaveValue('ser')
    const hidden = [...container.querySelectorAll('input[type="hidden"]')].map(
      (i) => `${i.getAttribute('name')}=${(i as HTMLInputElement).value}`,
    )
    expect(hidden).toEqual(['pais=PT', 'genero=rock'])
  })

  it('elsewhere starts an empty search without filters', () => {
    const { container } = render(<HeaderSearch />)
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(container.querySelectorAll('input[type="hidden"]')).toHaveLength(0)
  })
})
