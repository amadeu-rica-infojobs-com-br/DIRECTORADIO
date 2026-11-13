import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { cache } from 'react'
import { getStationBySlug } from '@/catalog/queries'
import { getSimilarStations } from '@/catalog/similar'
import { StationDetail } from '@/components/StationDetail'
import { getDb } from '@/db/client'
import { t } from '@/i18n'

export const revalidate = 300

const loadStation = cache((slug: string) => getStationBySlug(getDb(), slug))

export async function generateMetadata({ params }: PageProps<'/emisora/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const station = await loadStation(slug)
  if (!station) return { title: t('notFound.title') }
  return {
    title: t('station.metaTitle', { name: station.name }),
    description: station.description ?? undefined,
  }
}

export default async function StationPage({ params }: PageProps<'/emisora/[slug]'>) {
  const { slug } = await params
  const station = await loadStation(slug)
  if (!station) notFound()
  const similar = await getSimilarStations(getDb(), station.id)
  return <StationDetail station={station} similar={similar} />
}
