import { t } from '@/i18n'

export function Stars({ avg }: { avg: number }) {
  const rounded = Math.min(5, Math.max(0, Math.round(avg * 2) / 2))
  const label = t('station.ratingLabel', { avg: String(rounded).replace('.', ',') })
  return (
    <span role="img" aria-label={label} className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} aria-hidden="true" className="relative text-neutral-300">
          ★
          {rounded >= i - 0.5 && (
            <span
              className="absolute inset-y-0 left-0 overflow-hidden text-amber-500"
              style={{ width: rounded >= i ? '100%' : '50%' }}
            >
              ★
            </span>
          )}
        </span>
      ))}
    </span>
  )
}
