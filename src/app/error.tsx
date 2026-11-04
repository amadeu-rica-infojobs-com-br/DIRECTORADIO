'use client'

import { t } from '@/i18n'

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-bold">{t('error.title')}</h1>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100"
      >
        {t('error.retry')}
      </button>
    </div>
  )
}
