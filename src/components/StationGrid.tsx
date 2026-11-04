import type { StationCardData } from '@/catalog/queries'
import { StationCard } from '@/components/StationCard'

export function StationGrid({ stations }: { stations: StationCardData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {stations.map((s) => (
        <li key={s.slug}>
          <StationCard station={s} />
        </li>
      ))}
    </ul>
  )
}
