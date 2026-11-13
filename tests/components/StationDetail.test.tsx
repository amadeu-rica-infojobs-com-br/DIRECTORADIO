import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { StationCardData, StationDetailData } from '@/catalog/queries'
import { StationDetail } from '@/components/StationDetail'
import { PlayerProvider } from '@/player/PlayerProvider'

const BASE: StationDetailData = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  slug: 'radio-a',
  name: 'Radio A',
  logoUrl: null,
  countryCode: 'ES',
  genre: 'pop',
  ratingAvg: 0,
  ratingCount: 0,
  description: null,
  streamUrl: 'https://cdn.example/a',
  homepageUrl: null,
  languages: ['spanish'],
  languageCodes: ['es', 'ca'],
  tags: [],
  playCount: 0,
  isHealthHidden: false,
}

function renderDetail(station: StationDetailData, similar: StationCardData[] = []) {
  return render(
    <PlayerProvider>
      <StationDetail station={station} similar={similar} />
    </PlayerProvider>,
  )
}

const card = (slug: string): StationCardData => ({
  slug,
  name: slug,
  logoUrl: null,
  countryCode: 'ES',
  genre: 'rock',
  ratingAvg: 0,
  ratingCount: 0,
})

describe('StationDetail similar stations', () => {
  it('hides the section without similar stations', () => {
    renderDetail(BASE)
    expect(screen.queryByRole('heading', { name: 'Emisoras similares' })).not.toBeInTheDocument()
  })

  it('shows the section with the similar stations', () => {
    renderDetail(BASE, [card('a'), card('b')])
    expect(screen.getByRole('heading', { name: 'Emisoras similares' })).toBeInTheDocument()
    expect(screen.getAllByTestId('station-card-name')).toHaveLength(2)
  })
})

describe('StationDetail languages', () => {
  it('shows Spanish names from ISO codes', () => {
    renderDetail(BASE)
    expect(screen.getByText('Idiomas: Español, Catalán')).toBeInTheDocument()
  })

  it('falls back to free-text names without codes', () => {
    renderDetail({ ...BASE, languageCodes: [] })
    expect(screen.getByText('Idiomas: spanish')).toBeInTheDocument()
  })
})
