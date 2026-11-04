import type { Db } from '@/db/client'
import { tagGenres } from '@/db/schema'
import type { Genre } from '@/lib/genres'

const GROUPS: Record<Genre, string[]> = {
  pop: ['pop', 'top 40', 'hits', 'charts', 'pop music', 'latin pop'],
  electronica: ['electronic', 'electronica', 'dance', 'house', 'techno', 'trance', 'edm', 'chillout', 'lounge'],
  rock: ['rock', 'classic rock', 'hard rock', 'metal', 'heavy metal', 'indie', 'alternative', 'punk'],
  jazz: ['jazz', 'smooth jazz', 'blues', 'soul', 'swing'],
  clasica: ['classical', 'clasica', 'clásica', 'opera', 'baroque', 'symphony'],
  variada: ['variety', 'oldies', '80s', '90s', 'adult contemporary', 'misc'],
  noticias: ['news', 'noticias', 'information', 'informativos', 'news talk'],
  deportes: ['sports', 'sport', 'deportes', 'football', 'futbol', 'fútbol'],
  generalista: ['talk', 'generalista', 'public radio', 'community radio', 'culture'],
}

export const TAG_GENRE_SEED: Record<string, Genre> = Object.fromEntries(
  Object.entries(GROUPS).flatMap(([genre, list]) => list.map((tag) => [tag, genre as Genre])),
)

export async function seedTagGenres(db: Db): Promise<void> {
  const rows = Object.entries(TAG_GENRE_SEED).map(([tag, genre]) => ({ tag, genre }))
  await db.insert(tagGenres).values(rows).onConflictDoNothing()
}
