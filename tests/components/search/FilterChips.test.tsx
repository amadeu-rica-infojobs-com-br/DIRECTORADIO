import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import type { SearchCriteria } from '@/catalog/search-params'
import { criteriaChips } from '@/components/search/chips'
import { FilterChips } from '@/components/search/FilterChips'
import type { FilterLists } from '@/components/search/filter-lists'

const LISTS: FilterLists = {
  country: [
    { value: 'ES', label: 'España' },
    { value: 'FR', label: 'Francia' },
    { value: 'PT', label: 'Portugal' },
  ],
  language: [{ value: 'es', label: 'Español' }],
  genre: [
    { value: 'latina', label: 'Latina' },
    { value: 'rock', label: 'Rock' },
  ],
}

// En la web, FilterBar (servidor) prepara las etiquetas con criteriaChips y las pasa como prop.
const renderChips = (criteria: SearchCriteria) =>
  render(<FilterChips criteria={criteria} chips={criteriaChips(criteria)} lists={LISTS} />)

beforeAll(() => {
  // jsdom no implementa <dialog>.showModal/close.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
})

describe('FilterChips', () => {
  it('shows one button per filter and no remove links without criteria', () => {
    renderChips({})
    const group = screen.getByRole('group', { name: 'Filtros' })
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['País ▾', 'Idioma ▾', 'Género ▾'])
    expect(within(group).queryByRole('link')).not.toBeInTheDocument()
  })

  it('shows the text chip first and active chips with change and remove', () => {
    renderChips({ q: 'ser', country: 'PT' })
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAccessibleName('Quitar «Texto: ser»')
    expect(links[0]).toHaveAttribute('href', '/buscar?pais=PT')
    expect(screen.getByRole('button', { name: 'País: Portugal, cambiar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Quitar «País: Portugal»' })).toHaveAttribute('href', '/buscar?q=ser')
  })

  it('colors the active chip with the brand teal, light and dark', () => {
    renderChips({ country: 'PT' })
    expect(screen.getByRole('button', { name: 'País: Portugal, cambiar' })).toHaveClass(
      'bg-[#ccfbf1]',
      'dark:bg-[#134e4a]',
    )
  })

  it('opens the option list with links that apply the filter', () => {
    renderChips({})
    fireEvent.click(screen.getByRole('button', { name: 'País ▾' }))
    const dialog = screen.getByRole('dialog', { name: 'País' }) as HTMLDialogElement
    expect(dialog.open).toBe(true)
    expect(within(dialog).getByRole('link', { name: 'Portugal' })).toHaveAttribute('href', '/buscar?pais=PT')
    expect(within(dialog).getByRole('link', { name: 'Todos' })).toHaveAttribute('href', '/buscar')
  })

  it('marks the current value', () => {
    renderChips({ country: 'PT' })
    fireEvent.click(screen.getByRole('button', { name: 'País: Portugal, cambiar' }))
    expect(within(screen.getByRole('dialog')).getByRole('link', { name: 'Portugal' })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('filters long lists ignoring accents; genre has no filter box', () => {
    renderChips({})
    fireEvent.click(screen.getByRole('button', { name: 'País ▾' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filtrar País' }), { target: { value: 'port' } })
    const names = within(screen.getByRole('dialog')).getAllByRole('link').map((l) => l.textContent)
    expect(names).toEqual(['Todos', 'Portugal'])
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Género ▾' }))
    expect(within(screen.getByRole('dialog')).queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('closes and returns focus to the chip', () => {
    renderChips({})
    const chip = screen.getByRole('button', { name: 'País ▾' })
    fireEvent.click(chip)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect((screen.getByRole('dialog', { hidden: true }) as HTMLDialogElement).open).toBe(false)
    expect(chip).toHaveFocus()
  })

  it('shows the chip values prepared by the server, without recomputing names in the browser', () => {
    const chips = [{ key: 'country' as const, value: 'Portugalia', label: 'País: Portugalia', removeHref: '/buscar' }]
    render(<FilterChips criteria={{ country: 'PT' }} chips={chips} lists={LISTS} />)
    expect(screen.getByRole('button', { name: 'País: Portugalia, cambiar' })).toHaveTextContent('Portugalia')
  })

  it('focuses the list filter only on desktop, so phones do not pop the keyboard over the sheet', () => {
    const width = window.innerWidth
    try {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 })
      const { unmount } = renderChips({})
      fireEvent.click(screen.getByRole('button', { name: 'País ▾' }))
      expect(screen.getByRole('searchbox', { name: 'Filtrar País' })).not.toHaveFocus()
      unmount()
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
      renderChips({})
      fireEvent.click(screen.getByRole('button', { name: 'País ▾' }))
      expect(screen.getByRole('searchbox', { name: 'Filtrar País' })).toHaveFocus()
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    }
  })
})
