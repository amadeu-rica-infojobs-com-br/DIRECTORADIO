'use client'

import { t } from '@/i18n'
import { OPEN_CONSENT_EVENT } from './consent'

export function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className="hover:underline"
    >
      {t('footer.cookieSettings')}
    </button>
  )
}
