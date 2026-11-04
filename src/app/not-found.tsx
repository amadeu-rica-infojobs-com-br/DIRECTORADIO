import Link from 'next/link'
import { t } from '@/i18n'

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-bold">{t('notFound.page')}</h1>
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        {t('notFound.home')}
      </Link>
    </div>
  )
}
