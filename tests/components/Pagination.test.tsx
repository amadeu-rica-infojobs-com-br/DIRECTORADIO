import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { searchHref } from '@/catalog/search-params'
import { Pagination } from '@/components/Pagination'

describe('Pagination', () => {
  it('links to the home pages by default', () => {
    render(<Pagination page={2} pageCount={3} />)
    expect(screen.getByRole('link', { name: 'Anterior' })).toHaveAttribute('href', '/?pagina=1')
    expect(screen.getByRole('link', { name: 'Siguiente' })).toHaveAttribute('href', '/?pagina=3')
  })

  it('uses hrefForPage when given', () => {
    render(<Pagination page={2} pageCount={3} hrefForPage={(p) => searchHref({ q: 'ser' }, p)} />)
    expect(screen.getByRole('link', { name: 'Anterior' })).toHaveAttribute('href', '/buscar?q=ser')
    expect(screen.getByRole('link', { name: 'Siguiente' })).toHaveAttribute('href', '/buscar?q=ser&pagina=3')
  })
})
