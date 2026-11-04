'use client'

import { useEffect, useRef, useState } from 'react'
import { toSafeLogoUrl } from '@/lib/logo'

type Props = { name: string; logoUrl: string | null; size?: number }

export function StationLogo({ name, logoUrl, size = 48 }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const safeUrl = toSafeLogoUrl(logoUrl)
  const style = { width: size, height: size }

  // El error pudo dispararse en el HTML del servidor antes de que React enganchara onError.
  useEffect(() => {
    const img = imgRef.current
    if (safeUrl && img && img.complete && img.naturalWidth === 0) setFailedUrl(safeUrl)
  }, [safeUrl])

  if (!safeUrl || failedUrl === safeUrl) {
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
      ref={imgRef}
      src={safeUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(safeUrl)}
      style={style}
      className="shrink-0 rounded-md object-contain"
    />
  )
}
