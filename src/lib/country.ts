const regionNames = new Intl.DisplayNames(['es'], { type: 'region' })

export function countryName(code: string | null): string {
  if (!code) return ''
  try {
    const name = regionNames.of(code.toUpperCase())
    return !name || name.toUpperCase() === code.toUpperCase() ? '' : name
  } catch {
    return ''
  }
}

export function flagEmoji(code: string | null): string {
  if (!code || !/^[a-zA-Z]{2}$/.test(code)) return ''
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}
