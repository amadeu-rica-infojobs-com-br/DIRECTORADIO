import type { Metadata } from 'next'
import Link from 'next/link'
import { t } from '@/i18n'
import './globals.css'

export const metadata: Metadata = {
  title: t('site.title'),
  description: t('site.description'),
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto w-full max-w-7xl px-4 py-4">
            <Link href="/" className="text-xl font-bold">
              {t('site.name')}
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
