'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { t } from '@/i18n'
import { confirmAction } from './actions'

export function ConfirmForm({ token }: { token: string }) {
  const [result, action, pending] = useActionState(confirmAction, null)

  if (result?.status === 'confirmed') {
    return (
      <div role="status" className="flex flex-col gap-3">
        <p>{t('ratings.confirmed', { name: result.stationName })}</p>
        <Link href={`/emisora/${result.stationSlug}`} className="underline">
          {t('ratings.backToStation')}
        </Link>
      </div>
    )
  }
  if (result?.status === 'invalid') {
    return (
      <p role="alert" className="text-amber-800 dark:text-amber-300">
        {t('ratings.invalidLink')}
      </p>
    )
  }

  return (
    <form action={action} className="flex flex-col items-start gap-3">
      <input type="hidden" name="token" value={token} />
      <p>{t('ratings.confirmIntro')}</p>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-5 py-2.5 font-semibold text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {t('ratings.confirm')}
      </button>
    </form>
  )
}
