import { getHomeStations } from '@/catalog/queries'
import { Pagination } from '@/components/Pagination'
import { StationGrid } from '@/components/StationGrid'
import { getDb } from '@/db/client'
import { t } from '@/i18n'

export const revalidate = 300

const MAX_PAGE = 10000

function parsePage(value: string | string[] | undefined): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return 1
  const n = Number(value)
  return Number.isSafeInteger(n) && n >= 1 && n <= MAX_PAGE ? n : 1
}

export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const { pagina } = await searchParams
  const { items, page, pageCount } = await getHomeStations(getDb(), parsePage(pagina))

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">{t('home.title')}</h1>
      <StationGrid stations={items} />
      <Pagination page={page} pageCount={pageCount} />
    </>
  )
}
