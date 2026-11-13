import { GoogleTagManager } from '@next/third-parties/google'
import { consentDefaultsScript } from './defaults-script'

/** Va dentro de `<head>`: se ejecuta antes que GTM, que carga tras la hidratación. */
export function ConsentDefaults() {
  return <script id="consent-defaults" dangerouslySetInnerHTML={{ __html: consentDefaultsScript() }} />
}

export function Analytics({ gtmId }: { gtmId: string }) {
  return <GoogleTagManager gtmId={gtmId} />
}
