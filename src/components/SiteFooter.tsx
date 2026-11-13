import Link from 'next/link'
import { CookieSettingsButton } from '@/consent/CookieSettingsButton'
import { t } from '@/i18n'

export function SiteFooter({ showCookieSettings }: { showCookieSettings: boolean }) {
  return (
    // pb-20: deja hueco al mini-reproductor fijo para que no tape el pie.
    <footer className="border-t border-neutral-200 pb-20 dark:border-neutral-800">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap gap-x-6 gap-y-2 px-4 py-4 text-sm text-neutral-500">
        <Link href="/politica-de-cookies" className="hover:underline">
          {t('footer.cookiePolicy')}
        </Link>
        {showCookieSettings && <CookieSettingsButton />}
      </div>
    </footer>
  )
}
