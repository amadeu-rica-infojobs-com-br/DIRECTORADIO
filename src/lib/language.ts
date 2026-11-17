const languageNames = new Intl.DisplayNames(['es'], { type: 'language' })

/** Códigos que Intl no unifica pero que nombra igual (el twi y el fante salen como «Akan»). */
const ALIASES: Record<string, string> = { tw: 'ak' }

const CODE_RE = /^[a-z]{2,3}$/

/**
 * Código ISO 639 canónico: el de 2 letras cuando existe ("spa" → "es", "ger"/"deu" → "de").
 * Radio-Browser mezcla ambos y, sin esto, cada idioma saldría repetido en el filtro.
 */
export function canonicalLanguageCode(code: string): string {
  let canonical = code
  try {
    canonical = Intl.getCanonicalLocales(code)[0]?.toLowerCase() ?? code
  } catch {
    return code
  }
  if (!CODE_RE.test(canonical)) return code
  return ALIASES[canonical] ?? canonical
}

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
