'use client'

import { useState } from 'react'

type Props = { name: string; logoUrl: string | null; size?: number }

export function StationLogo({ name, logoUrl, size = 48 }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const style = { width: size, height: size }

  if (!logoUrl || failedUrl === logoUrl) {
    const initial = [...name.trim()][0]?.toUpperCase() ?? '?'
    return (
      <span
        aria-hidden="true"
        style={style}
        className="flex shrink-0 items-center justify-center rounded-full bg-neutral-200 font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
      >
        {initial}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- logos de dominios externos arbitrarios
    <img
      src={logoUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(logoUrl)}
      style={style}
      className="shrink-0 rounded-md object-contain"
    />
  )
}
