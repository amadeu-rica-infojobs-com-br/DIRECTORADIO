import Link from 'next/link'
import type { StationCardData } from '@/catalog/queries'
import { Stars } from '@/components/Stars'
import { StationLogo } from '@/components/StationLogo'
import { countryName, flagEmoji } from '@/lib/country'
import { genreLabel } from '@/lib/genres'

export function StationCard({ station }: { station: StationCardData }) {
  const country = countryName(station.countryCode)
  const flag = flagEmoji(station.countryCode)
  return (
    <Link
      href={`/emisora/${station.slug}`}
      className="flex h-full flex-col items-center gap-2 rounded-xl border border-neutral-200 p-3 text-center transition hover:border-neutral-400 hover:shadow-sm dark:border-neutral-800 dark:hover:border-neutral-600"
    >
      <StationLogo name={station.name} logoUrl={station.logoUrl} size={64} />
      <span data-testid="station-card-name" className="line-clamp-2 text-sm font-semibold">{station.name}</span>
      {country && (
        <span className="text-xs text-neutral-500">
          {flag} {country}
        </span>
      )}
      <span className="text-xs text-neutral-500">{genreLabel(station.genre)}</span>
      {station.ratingCount > 0 && <Stars avg={station.ratingAvg} />}
    </Link>
  )
}
