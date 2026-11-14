import Link from 'next/link'

// Colores de src/brand/brand.ts como clases literales de Tailwind (claro / oscuro).
const BARS = 'fill-[#2dd4bf] dark:fill-[#5eead4]'
const LIVE = 'fill-[#a3e635] dark:fill-[#bef264]'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" aria-label="DirectoRadio" className={`flex shrink-0 items-center gap-2 ${className}`}>
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden="true">
        <rect x="2" y="2" width="44" height="44" rx="12" className="fill-[#0f172a] dark:fill-[#134e4a]" />
        <rect x="10" y="20" width="4" height="8" rx="2" className={BARS} />
        <rect x="17" y="14" width="4" height="20" rx="2" className={BARS} />
        <rect x="24" y="10" width="4" height="28" rx="2" className={BARS} />
        <rect x="31" y="15" width="4" height="18" rx="2" className={BARS} />
        <rect x="38" y="21" width="4" height="6" rx="2" className={LIVE} />
      </svg>
      <span className="text-xl font-bold tracking-[-0.02em]">
        Directo<span className="text-[#0d9488] dark:text-[#5eead4]">Radio</span>
      </span>
    </Link>
  )
}
