const MAX_TAG_LENGTH = 50

export function normalizeTags(raw: string | null | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  for (const part of raw.split(',')) {
    const tag = part.trim().toLowerCase().replace(/\s+/g, ' ')
    if (tag && tag.length <= MAX_TAG_LENGTH) seen.add(tag)
  }
  return [...seen]
}
