/**
 * Datos del titular de la web (persona física), para el aviso legal, la privacidad y las cookies.
 * Rellena los campos PENDIENTE antes de activar las valoraciones: el build de producción falla si
 * RATINGS_ENABLED=true y queda alguno (src/legal/guard.ts).
 */
export const OWNER = {
  name: 'Amadeu Rica',
  nif: '46587808C',
  address: 'Calle Goya, 50, Vilanova del Camí (Barcelona)',
  email: 'amadeurm@gmail.com',
  domain: 'directoradio.com',
} as const

const PENDING = 'PENDIENTE'

export type Owner = { name: string; nif: string; address: string }

export function ownerMissing(owner: Owner = OWNER): string[] {
  return (['name', 'nif', 'address'] as const).filter((key) => owner[key] === PENDING)
}
