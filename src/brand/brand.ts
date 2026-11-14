/** Identidad visual de DirectoRadio: propuesta C2 «Ecualizador en directo» (docs/superpowers/specs/2026-11-14-logo-favicon-design.md). */
export const BRAND = {
  light: { bg: '#0f172a', bars: '#2dd4bf', live: '#a3e635', accent: '#0d9488' },
  dark: { bg: '#134e4a', bars: '#5eead4', live: '#bef264', accent: '#5eead4' },
} as const

export const TAGLINE = 'Radio en directo de todo el mundo'

const XMLNS = 'xmlns="http://www.w3.org/2000/svg"'

/** Favicon: 3 barras gruesas más la de «en directo», legible a 16 px. Siempre en colores claros. */
export function faviconSvg(): string {
  const c = BRAND.light
  return (
    `<svg ${XMLNS} viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="${c.bg}"/>` +
    `<g fill="${c.bars}"><rect x="7" y="19" width="7" height="10" rx="3"/><rect x="17" y="11" width="7" height="26" rx="3"/>` +
    `<rect x="27" y="6" width="7" height="36" rx="3"/></g><rect x="37" y="17" width="7" height="14" rx="3" fill="${c.live}"/></svg>`
  )
}

/** Símbolo grande (48×48): 4 barras más la de «en directo». */
export function symbolSvg(theme: 'light' | 'dark'): string {
  const c = BRAND[theme]
  return (
    `<svg ${XMLNS} viewBox="0 0 48 48"><rect x="2" y="2" width="44" height="44" rx="12" fill="${c.bg}"/>` +
    `<g fill="${c.bars}"><rect x="10" y="20" width="4" height="8" rx="2"/><rect x="17" y="14" width="4" height="20" rx="2"/>` +
    `<rect x="24" y="10" width="4" height="28" rx="2"/><rect x="31" y="15" width="4" height="18" rx="2"/></g>` +
    `<rect x="38" y="21" width="4" height="6" rx="2" fill="${c.live}"/></svg>`
  )
}
