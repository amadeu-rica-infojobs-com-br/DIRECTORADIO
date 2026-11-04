export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function uniqueSlug(
  base: string,
  fallback: string,
  exists: (s: string) => Promise<boolean>,
): Promise<string> {
  const root = base || fallback
  let candidate = root
  for (let n = 2; await exists(candidate); n++) {
    candidate = `${root}-${n}`
  }
  return candidate
}
