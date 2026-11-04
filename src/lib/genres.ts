export const GENRES = [
  'pop',
  'electronica',
  'rock',
  'jazz',
  'clasica',
  'variada',
  'noticias',
  'deportes',
  'generalista',
] as const

export type Genre = (typeof GENRES)[number]

export const GENRE_LABELS: Record<Genre, string> = {
  pop: 'Pop',
  electronica: 'Electrónica',
  rock: 'Rock',
  jazz: 'Jazz',
  clasica: 'Clásica',
  variada: 'Variada',
  noticias: 'Noticias',
  deportes: 'Deportes',
  generalista: 'Generalista',
}

export function resolveGenre(tags: string[], mapping: Map<string, Genre>): Genre {
  const votes = new Map<Genre, number>()
  for (const tag of tags) {
    const genre = mapping.get(tag)
    if (genre) votes.set(genre, (votes.get(genre) ?? 0) + 1)
  }
  let best: Genre = 'variada'
  let bestVotes = 0
  for (const genre of GENRES) {
    const count = votes.get(genre) ?? 0
    if (count > bestVotes) {
      best = genre
      bestVotes = count
    }
  }
  return best
}
