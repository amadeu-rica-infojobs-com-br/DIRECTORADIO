import { unstable_cache } from 'next/cache'
import { getDb } from '@/db/client'
import { getFilterOptions } from './search'

/** Opciones de los desplegables, las mismas en todas las búsquedas; se recalculan cada hora. */
export const getCachedFilterOptions = unstable_cache(() => getFilterOptions(getDb()), ['filter-options'], {
  revalidate: 3600,
  tags: ['filter-options'],
})
