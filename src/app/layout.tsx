import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Logo } from '@/components/Logo'
import { Analytics, ConsentDefaults } from '@/consent/Analytics'
import { getGtmId } from '@/consent/consent'
import { CookieBanner } from '@/consent/CookieBanner'
import { SiteFooter } from '@/components/SiteFooter'
import { HeaderSearch, HeaderSearchFallback } from '@/components/search/HeaderSearch'
import { t } from '@/i18n'
import { MiniPlayer } from '@/player/MiniPlayer'
import { PlayerProvider } from '@/player/PlayerProvider'
import './globals.css'

export const metadata: Metadata = {
  // Base de las URL absolutas (og:image, canónicas). Sin ella, Next.js usa localhost o una variable
  // implícita de Vercel que puede apuntar a *.vercel.app.
  metadataBase: new URL('https://directoradio.com'),
  title: t('site.title'),
  description: t('site.description'),
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  const gtmId = getGtmId(process.env.NEXT_PUBLIC_GTM_ID)
  return (
    <html lang="es" className="h-full antialiased">
      {gtmId && (
        <head>
          <ConsentDefaults />
        </head>
      )}
      <body className="flex min-h-full flex-col">
        <PlayerProvider>
          <header className="border-b border-neutral-200 dark:border-neutral-800">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-4">
              <Logo />
              <Suspense fallback={<HeaderSearchFallback />}>
                <HeaderSearch />
              </Suspense>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-10">{children}</main>
          <SiteFooter showCookieSettings={gtmId !== null} />
          <MiniPlayer />
          {gtmId && <CookieBanner />}
        </PlayerProvider>
      </body>
      {gtmId && <Analytics gtmId={gtmId} />}
    </html>
  )
}
