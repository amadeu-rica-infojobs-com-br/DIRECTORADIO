import type { Db } from '@/db/client'
import { tagGenres } from '@/db/schema'
import type { Genre } from '@/lib/genres'

const GROUPS: Record<Genre, string[]> = {
  pop: ['pop', 'top 40', 'hits', 'charts', 'pop music', 'latin pop', 'schlager', 'hot adult contemporary'],
  electronica: ['electronic', 'electronica', 'dance', 'house', 'techno', 'trance', 'edm', 'chillout', 'lounge'],
  rock: ['rock', 'classic rock', 'hard rock', 'metal', 'heavy metal', 'indie', 'alternative', 'punk'],
  jazz: ['jazz', 'smooth jazz', 'blues', 'soul', 'swing'],
  clasica: ['classical', 'clasica', 'clásica', 'opera', 'baroque', 'symphony'],
  variada: ['variety', 'oldies', '80s', '90s', 'adult contemporary', 'misc'],
  noticias: ['news', 'noticias', 'information', 'informativos', 'news talk', 'local news', 'noticias locales'],
  deportes: ['sports', 'sport', 'deportes', 'football', 'futbol', 'fútbol'],
  generalista: ['talk', 'generalista', 'public radio', 'community radio', 'culture'],
  religiosa: [
    'christian',
    'christian music',
    'gospel',
    'religious',
    'religion',
    'worship',
    'catholic',
    'católica',
    'cristiana',
    'evangélica',
    'islamic',
    'islam',
    'quran',
    'bible',
    'church',
  ],
  latina: [
    'latin',
    'latina',
    'latino',
    'regional mexican',
    'regional mexicana',
    'música regional mexicana',
    'mexican music',
    'grupera',
    'grupero',
    'banda',
    'norteña',
    'ranchera',
    'mariachi',
    'salsa',
    'cumbia',
    'tropical',
    'bachata',
    'merengue',
    'reggaeton',
    'reggaetón',
    'vallenato',
  ],
  'country-folk': ['country', 'folk', 'folklore', 'folclore', 'bluegrass', 'americana', 'celtic'],
  'hip-hop': ['rap', 'hip hop', 'hip-hop', 'hiphop', 'r&b', 'rnb', 'trap', 'urban'],
}

export const TAG_GENRE_SEED: Record<string, Genre> = Object.fromEntries(
  Object.entries(GROUPS).flatMap(([genre, list]) => list.map((tag) => [tag, genre as Genre])),
)

export async function seedTagGenres(db: Db): Promise<void> {
  const rows = Object.entries(TAG_GENRE_SEED).map(([tag, genre]) => ({ tag, genre }))
  await db.insert(tagGenres).values(rows).onConflictDoNothing()
}
