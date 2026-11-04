import Link from 'next/link'
import type { StationCardData } from '@/catalog/queries'
import { StationLogo } from '@/components/StationLogo'
import { t } from '@/i18n'
import { countryName, flagEmoji } from '@/lib/country'
import { GENRE_LABELS } from '@/lib/genres'

function Stars({ avg }: { avg: number }) {
  const rounded = Math.min(5, Math.max(0, Math.round(avg * 2) / 2))
  const label = t('station.ratingLabel', { avg: String(rounded).replace('.', ',') })
  return (
    <span role="img" aria-label={label} className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} aria-hidden="true" className="relative text-neutral-300">
          ★
          {rounded >= i - 0.5 && (
            <span
              className="absolute inset-y-0 left-0 overflow-hidden text-amber-500"
              style={{ width: rounded >= i ? '100%' : '50%' }}
            >
              ★
            </span>
          )}
        </span>
      ))}
    </span>
  )
}

export function StationCard({ station }: { station: StationCardData }) {
  const country = countryName(station.countryCode)
  const flag = flagEmoji(station.countryCode)
  return (
    <Link
      href={`/emisora/${station.slug}`}
      className="flex h-full flex-col items-center gap-2 rounded-xl border border-neutral-200 p-3 text-center transition hover:border-neutral-400 hover:shadow-sm dark:border-neutral-800 dark:hover:border-neutral-600"
    >
      <StationLogo name={station.name} logoUrl={station.logoUrl} size={64} />
      <span className="line-clamp-2 text-sm font-semibold">{station.name}</span>
      {country && (
        <span className="text-xs text-neutral-500">
          {flag} {country}
        </span>
      )}
      <span className="text-xs text-neutral-500">{GENRE_LABELS[station.genre]}</span>
      {station.ratingCount > 0 && <Stars avg={station.ratingAvg} />}
    </Link>
  )
}
