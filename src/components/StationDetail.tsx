import Link from 'next/link'
import type { StationDetailData } from '@/catalog/queries'
import { AudioPlayer } from '@/components/AudioPlayer'
import { Stars } from '@/components/Stars'
import { StationLogo } from '@/components/StationLogo'
import { t, tn } from '@/i18n'
import { countryName, flagEmoji } from '@/lib/country'
import { genreLabel } from '@/lib/genres'

function isHttpUrl(url: string | null): url is string {
  if (!url) return false
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function StationDetail({ station }: { station: StationDetailData }) {
  const country = countryName(station.countryCode)
  const flag = flagEmoji(station.countryCode)
  return (
    <article className="flex flex-col gap-6">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        {t('station.back')}
      </Link>

      <header className="flex items-center gap-4">
        <StationLogo name={station.name} logoUrl={station.logoUrl} size={96} />
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">{station.name}</h1>
          <p className="text-sm text-neutral-500">
            {country && (
              <>
                {flag} {country} ·{' '}
              </>
            )}
            {genreLabel(station.genre)}
          </p>
          {station.languages.length > 0 && (
            <p className="text-sm text-neutral-500">
              {t('station.languages')}: {station.languages.join(', ')}
            </p>
          )}
        </div>
      </header>

      {station.tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {station.tags.map((tag) => (
            <li key={tag} className="rounded-full bg-neutral-100 px-3 py-1 text-xs dark:bg-neutral-800">
              #{tag}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-500">
        {station.ratingCount > 0 && (
          <span className="flex items-center gap-2">
            <Stars avg={station.ratingAvg} />
            {tn('station.ratings', station.ratingCount, {
              avg: station.ratingAvg.toFixed(1).replace('.', ','),
            })}
          </span>
        )}
        <span>{tn('station.plays', station.playCount)}</span>
      </div>

      {station.isHealthHidden && (
        <p className="rounded-md bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {t('station.unhealthy')}
        </p>
      )}

      <AudioPlayer
        station={{
          id: station.id,
          slug: station.slug,
          name: station.name,
          logoUrl: station.logoUrl,
          streamUrl: station.streamUrl,
        }}
      />

      {isHttpUrl(station.homepageUrl) && (
        <a
          href={station.homepageUrl}
          target="_blank"
          rel="noopener nofollow"
          className="text-sm text-blue-700 hover:underline dark:text-blue-400"
        >
          {t('station.website')}
        </a>
      )}

      {station.description && <p className="max-w-prose">{station.description}</p>}
    </article>
  )
}
