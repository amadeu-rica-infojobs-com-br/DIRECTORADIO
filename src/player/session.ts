const KEY = 'dr.session'

let memoryId: string | null = null

export function getSessionId(): string {
  try {
    const stored = sessionStorage.getItem(KEY)
    if (stored) return stored
    const id = crypto.randomUUID()
    sessionStorage.setItem(KEY, id)
    return id
  } catch {
    // sessionStorage bloqueado (modo privado, cookies de terceros): id solo en memoria.
    memoryId ??= crypto.randomUUID()
    return memoryId
  }
}
