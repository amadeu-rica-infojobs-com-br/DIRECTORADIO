const languageNames = new Intl.DisplayNames(['es'], { type: 'language' })

/** Nombre en español de un código ISO 639 ("ca" → "Catalán"), o '' si no se conoce. */
export function languageName(code: string): string {
  try {
    const name = languageNames.of(code)
    if (!name || name.toLowerCase() === code.toLowerCase()) return ''
    return name.charAt(0).toLocaleUpperCase('es') + name.slice(1)
  } catch {
    return ''
  }
}
