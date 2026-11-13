import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { StationDetailData } from '@/catalog/queries'
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

function renderDetail(station: StationDetailData) {
  return render(
    <PlayerProvider>
      <StationDetail station={station} />
    </PlayerProvider>,
  )
}

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
