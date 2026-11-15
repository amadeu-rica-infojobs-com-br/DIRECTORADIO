import type { Metadata } from 'next'
import { t } from '@/i18n'
import { ratingsEnabled } from '@/ratings/config'
import { ConfirmForm } from './ConfirmForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: t('ratings.verifyTitle'),
  robots: { index: false, follow: false },
}

export default async function VerifyPage({ searchParams }: PageProps<'/valoraciones/verificar'>) {
  const { token } = await searchParams
  const value = typeof token === 'string' ? token : ''

  return (
    <article className="max-w-prose">
      <h1 className="mb-6 text-2xl font-bold">{t('ratings.verifyHeading')}</h1>
      {!ratingsEnabled() ? (
        <p>{t('ratings.unavailable')}</p>
      ) : value ? (
        <ConfirmForm token={value} />
      ) : (
        <p role="alert">{t('ratings.invalidLink')}</p>
      )}
    </article>
  )
}
