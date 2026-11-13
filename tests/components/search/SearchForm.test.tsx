import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SearchForm } from '@/components/search/SearchForm'

const OPTIONS = { countries: ['PT', 'ES', 'AD'], languages: ['pt', 'es'], genres: ['rock' as const, 'latina' as const] }

describe('SearchForm', () => {
  it('submits with GET to /buscar', () => {
    const { container } = render(<SearchForm criteria={{}} options={OPTIONS} />)
    const form = container.querySelector('form')!
    expect(form).toHaveAttribute('method', 'get')
    expect(form).toHaveAttribute('action', '/buscar')
  })

  it('offers "Todos" first and names countries in Spanish alphabetical order', () => {
    render(<SearchForm criteria={{}} options={OPTIONS} />)
    const country = screen.getByRole('combobox', { name: 'País' })
    const labels = within(country).getAllByRole('option').map((o) => o.textContent)
    expect(labels).toEqual(['Todos', 'Andorra', 'España', 'Portugal'])
    expect(within(country).getAllByRole('option')[0]).toHaveValue('')
  })

  it('names languages and genres', () => {
    render(<SearchForm criteria={{}} options={OPTIONS} />)
    const language = within(screen.getByRole('combobox', { name: 'Idioma' })).getAllByRole('option')
    expect(language.map((o) => o.textContent)).toEqual(['Todos', 'Español', 'Portugués'])
    const genre = within(screen.getByRole('combobox', { name: 'Género' })).getAllByRole('option')
    expect(genre.map((o) => o.textContent)).toEqual(['Todos', 'Latina', 'Rock'])
  })

  it('resets the fields when the criteria change without remounting (client navigation)', () => {
    const { rerender } = render(<SearchForm criteria={{ q: 'ser', country: 'PT' }} options={OPTIONS} />)
    rerender(<SearchForm criteria={{ q: 'ser' }} options={OPTIONS} />)
    expect(screen.getByRole('combobox', { name: 'País' })).toHaveValue('')
    rerender(<SearchForm criteria={{}} options={OPTIONS} />)
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('keeps a current value selected even if the (cached) options lack it', () => {
    render(<SearchForm criteria={{ country: 'FR', language: 'ca', genre: 'jazz' }} options={OPTIONS} />)
    expect(screen.getByRole('combobox', { name: 'País' })).toHaveValue('FR')
    expect(screen.getByRole('combobox', { name: 'Idioma' })).toHaveValue('ca')
    expect(screen.getByRole('combobox', { name: 'Género' })).toHaveValue('jazz')
  })

  it('keeps the current criteria selected', () => {
    render(<SearchForm criteria={{ q: 'ser', country: 'PT', language: 'pt', genre: 'latina' }} options={OPTIONS} />)
    expect(screen.getByRole('searchbox')).toHaveValue('ser')
    expect(screen.getByRole('combobox', { name: 'País' })).toHaveValue('PT')
    expect(screen.getByRole('combobox', { name: 'Idioma' })).toHaveValue('pt')
    expect(screen.getByRole('combobox', { name: 'Género' })).toHaveValue('latina')
  })
})
