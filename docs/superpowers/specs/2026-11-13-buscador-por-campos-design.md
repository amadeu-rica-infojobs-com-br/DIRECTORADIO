# Plan 3 — Buscador por campos y emisoras similares (sin IA) — Diseño

Fecha: 2026-11-13
Cambia: [spec v1](2026-11-04-directoradio-v1-design.md), §6.5 (buscador con IA), §6.6 (emisoras similares) y §6.9 (descripciones con IA).

## 1. Por qué

La spec v1 preveía un buscador con IA (un modelo de lenguaje que interpreta la frase, embeddings, voz) y descripciones generadas con IA. El responsable ha decidido que, **por ahora, la web no use ningún servicio de IA**, para no tener costes por uso. Cualquiera debe poder encontrar una emisora en pocos segundos de otra forma: **buscando por el nombre o filtrando por país, idioma y género**. Las emisoras similares de la ficha se mantienen, calculadas sin IA.

## 2. Alcance

**Incluido**
- Búsqueda por nombre y filtros por país, idioma y género, en una página `/buscar`.
- Formulario completo arriba de la portada y caja compacta en la cabecera de todas las páginas.
- Normalización del idioma a códigos ISO (`languagecodes` de Radio-Browser).
- Ampliación de la tabla de correspondencias tag → género.
- Emisoras similares en la ficha de cada emisora.

**Fuera (se retira de la v1 por ahora)**
- Buscador con IA: interpretación de frases, filtros deducidos y "He entendido:".
- Búsqueda por voz: Web Speech API y transcripción con Whisper.
- Embeddings y pgvector. La extensión sigue disponible en la imagen y en Neon, pero no se usa.
- Descripciones generadas con IA. La columna `description` se mantiene vacía y la ficha no muestra el bloque.
- Límite de búsquedas por IP y caché de búsquedas pensados para el coste de la IA. Sin IA no hay coste por búsqueda.

## 3. Objetivos, no-objetivos y anti-objetivos

**Objetivos**
- Encontrar una emisora por su nombre aunque falten tildes, sobren palabras o haya una errata pequeña ("cadena ser" → "Cadena SER España", "los 40" → "LOS40").
- Filtrar el catálogo por país, idioma y género, y combinar filtros.
- Que la ficha de una emisora ofrezca otras parecidas para seguir escuchando.

**No-objetivos**
- Buscar por tags libres, ciudad o región.
- Ordenar a elección del usuario (por nombre, por valoración…). El orden es fijo (§5.4).
- Indexar en Google las páginas de búsqueda. El posicionamiento por género y país es cosa del plan 5 (`/genero/{slug}`, `/pais/{slug}`).

**Anti-objetivos**
- Una pantalla de resultados vacía sin salida: si no hay resultados, se explica y se ofrece quitar filtros (§5.5).
- Que el buscador muestre emisoras caídas, desactivadas o eliminadas.
- Que Google indexe miles de combinaciones de filtros como contenido pobre.
- Listas de filtros con opciones que no tienen ninguna emisora visible. Las listas son las mismas en todas las búsquedas; no dependen de los otros filtros elegidos (decisión del builder, §5.3). Una combinación sin resultados se resuelve con §5.5.

## 4. Enfoques considerados

| Decisión | Opciones | Elegida y por qué |
|---|---|---|
| Dónde vive la búsqueda | **A.** Página `/buscar` con los filtros en la dirección (GET). B. Filtrar la propia portada | **A.** Funciona sin JavaScript, se puede compartir, se genera en el servidor y se puede marcar `noindex` sin tocar la portada, que conserva su ranking de "más escuchadas". |
| Búsqueda por nombre | **`pg_trgm` + `unaccent` en Postgres**. Búsqueda de texto completo de Postgres. Motor externo (Meilisearch) | **`pg_trgm` + `unaccent`**: tolera tildes y erratas y ordena por parecido. El texto completo funciona peor con nombres propios. Un motor externo sería otra pieza que desplegar, sin necesidad con unas 52.000 emisoras. |
| Idioma | **Códigos ISO de Radio-Browser (`languagecodes`)**. Tabla de correspondencias de nombres libres | **ISO**: en las 10.000 emisoras más populares, el 94 % de las que tienen idioma traen código (144 códigos limpios). Los nombres en español salen de `Intl.DisplayNames`. Las emisoras con solo el nombre libre (~6 %) no aparecen al filtrar por idioma. |
| Emisoras similares | **Consulta SQL al generar la ficha** (que ya se regenera cada 5 minutos). Precalcularlas en la tarea diaria | **Consulta al generar la ficha**. Se precalculan solo si la consulta resulta lenta (§5.7). |

El responsable eligió A y las demás recomendaciones el 2026-11-13.

## 5. Decisiones

### 5.1 Datos

- **Columna nueva `language_codes text[]`** en `stations`, con índice GIN.
  - La rellena la sincronización desde `languagecodes` de Radio-Browser: se separa por comas, se recorta, se pasa a minúsculas, se quitan duplicados y solo se conservan los valores que cumplen `^[a-z]{2,3}$`.
  - Entra en la detección de cambios de la sincronización, como `languages`. Es dato de Radio-Browser, no editorial: no se protege con `manual_fields`.
  - La migración añade la columna vacía. Se llena con la siguiente sincronización, la diaria de Fly o un `job:sync` manual.
- **`languages`** (los nombres libres) se conserva. La ficha muestra los idiomas a partir de los códigos, con nombres en español; si no hay códigos, muestra los nombres libres como hoy.
- **Búsqueda por nombre:**
  - Extensiones `pg_trgm` y `unaccent`, activadas en una migración. Neon las admite.
  - Una función envoltorio `IMMUTABLE` sobre `unaccent` (la de serie es `STABLE` y no sirve en un índice).
  - Un índice GIN de trigramas sobre el nombre normalizado (sin tildes y en minúsculas).
- **Índice en `station_tags(tag_id)`**, para la consulta de similares.
- **Cuatro géneros nuevos** (decisión del responsable, 2026-11-13). La lista cerrada pasa de 9 a 13:

  | Valor (enum y dirección) | Etiqueta | Emisoras que salen de "Variada" (medición local) |
  |---|---|---|
  | `religiosa` | Religiosa | ~1.410 |
  | `latina` | Latina | ~980 |
  | `country-folk` | Country y folk | ~930 |
  | `hip-hop` | Hip hop | ~490 |

  - Se añaden al enum `genre` de Postgres con una migración (`ALTER TYPE … ADD VALUE`). Un valor nuevo no se puede usar en la misma transacción en la que se crea, así que la migración solo los añade y no actualiza filas.
  - Se añaden también a `GENRES` en `src/lib/genres.ts`, al final de la lista, y sus etiquetas a `src/i18n/es-ES.ts`.
  - El plan 5 (`/genero/{slug}`) usará esta misma lista.
- **Tabla tag → género (`tag_genres`):** se amplía en `src/catalog/seed/tag-genres.ts`:
  - con los tags de los géneros nuevos, como `christian`, `gospel`, `islamic`, `quran` y `worship` (Religiosa); `regional mexicana`, `grupera`, `banda`, `salsa`, `cumbia` y `reggaeton` (Latina); `country`, `folk`, `folklore` y `celtic` (Country y folk); `rap`, `hip hop`, `r&b` y `trap` (Hip hop);
  - y con tags de los 9 géneros existentes que hoy no tienen correspondencia, por ejemplo `local news` → Noticias.

  La sincronización ya recalcula el género de las emisoras sin edición manual en cada pasada, así que el cambio se aplica solo en la siguiente sincronización.
  - **Límite conocido:** 17.427 de las 34.819 emisoras en "Variada" no tienen ningún tag, y seguirán ahí.

### 5.2 Direcciones y parámetros

- `/buscar?q=&pais=&idioma=&genero=&pagina=`
  - `q`: texto libre, recortado, como máximo 100 caracteres.
  - `pais`: código ISO 3166-1 alfa-2 en mayúsculas (`ES`).
  - `idioma`: código ISO 639 en minúsculas (`es`, `ca`, `yue`).
  - `genero`: uno de los 13 valores del enum (`pop`, `electronica`, `rock`, `jazz`, `clasica`, `variada`, `noticias`, `deportes`, `generalista`, `religiosa`, `latina`, `country-folk`, `hip-hop`).
  - `pagina`: como en la portada.
- **Un parámetro con un valor no válido se ignora**, como si no estuviera, sin error. Así no se rompen los enlaces viejos o manipulados.
- Los parámetros vacíos (`?pais=`) no se escriben en los enlaces que genera la web.
- `/buscar` lleva `robots: noindex, follow` y una etiqueta canónica a `/buscar`.

### 5.3 Interfaz

- **Formulario completo** (texto, País, Idioma y Género) arriba de la portada y arriba de `/buscar`, con los valores actuales ya puestos.
  - Es un `<form method="get" action="/buscar">` normal, con botón "Buscar".
  - Sin JavaScript, funciona igual.
  - Elegir una opción en un desplegable no lanza la búsqueda sola en v1; se pulsa "Buscar".
- **Caja compacta en la cabecera** de todas las páginas: solo texto, envía a `/buscar?q=…`. En móvil cabe en la cabecera junto al nombre del sitio.
- **Opciones de los desplegables:**
  - Solo valores con al menos una emisora visible (activa y con stream sano), ordenados alfabéticamente en español. La primera opción es "Todos" o "Todas".
  - Los países usan `countryName()`, como hoy; los idiomas, `Intl.DisplayNames(['es'], { type: 'language' })`. Se descarta cualquier código que no tenga nombre.
  - Las listas se calculan con una consulta y se guardan en caché una hora.
  - **Son las mismas en todas las búsquedas**, en la portada y en `/buscar`: no se reducen según los otros filtros elegidos. Así basta con una consulta en caché y las búsquedas siguen siendo rápidas. Que una combinación concreta no tenga resultados se resuelve con §5.5. Es una decisión del builder.
- **Filtros activos** en `/buscar`, como etiquetas con ✕ encima de los resultados ("País: Portugal ✕"). Cada ✕ es un enlace a la misma búsqueda sin ese filtro.
- **Resultados:**
  - La misma cuadrícula de tarjetas (`StationGrid`) y la misma paginación (48 por página) que la portada.
  - Encima, el número de resultados ("1.234 emisoras").
  - El título de la página describe la búsqueda ("Emisoras de Portugal en portugués").
- **`/buscar` sin ningún criterio:** muestra el formulario y el mismo listado que la portada, ordenado por popularidad.
- Todos los textos van en `src/i18n/es-ES.ts`.

Boceto de `/buscar`:

```
[DirectoRadio]                      [ Buscar emisora…  🔍 ]
─────────────────────────────────────────────────────────
[ cadena ser          ] [País ▾] [Idioma ▾] [Género ▾] [Buscar]

País: España ✕   Género: Noticias ✕
12 emisoras
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ logo │ │ logo │ │ logo │ │ logo │   ← misma tarjeta que la portada
└──────┘ └──────┘ └──────┘ └──────┘
              ‹ Anterior  1 2  Siguiente ›
```

### 5.4 Qué se encuentra y en qué orden

- **Siempre** solo emisoras visibles: `status = 'activa'` y fallos de salud seguidos por debajo de `HEALTH_HIDE_THRESHOLD`, igual que la portada.
- **Filtros:** se combinan con Y. País = `country_code`; idioma = `language_codes` contiene el código; género = `genre`.
- **Texto:**
  - Se compara con el nombre normalizado (sin tildes y en minúsculas).
  - Una emisora coincide si el nombre contiene el texto o si el parecido por trigramas supera un umbral.
  - Con textos de 1 o 2 caracteres solo cuenta "contiene", porque los trigramas no funcionan bien con textos tan cortos.
- **Orden:**
  - Con texto: primero las emisoras cuyo nombre contiene el texto entero; luego por parecido, de mayor a menor; a igualdad, por la popularidad de la portada.
  - Sin texto: la popularidad de la portada (la misma fórmula de `getHomeStations`).

### 5.5 Sin resultados

- Mensaje: "No hemos encontrado emisoras con estos criterios."
- Debajo, un enlace por cada filtro activo para quitarlo ("Quitar «Idioma: catalán»") y uno para "Ver todas las emisoras". Si solo había texto, se sugiere revisar cómo está escrito.
- No se relajan filtros automáticamente. Lo que hace el usuario es explícito, y una búsqueda por campos que devolviera otra cosa confundiría.

### 5.6 Emisoras similares (ficha)

- Bloque "Emisoras similares" al final de la ficha, con **hasta 8 tarjetas** (`StationGrid`).
- **Candidatas:** emisoras visibles, distintas de la actual.
- **Puntuación:**
  - +3 por mismo género, salvo si ambas son "Variada" (+1).
  - +2 por cada tag compartido; los tags muy frecuentes pesan menos, de forma que `music`, `radio` o `fm` no hagan parecidas a dos emisoras cualesquiera.
  - +2 por mismo país.
  - +1 por compartir algún código de idioma.
  - A igualdad, por popularidad.
- Solo entran candidatas con puntuación positiva **y algo en común más allá del idioma**.
- Si no hay ninguna, el bloque no se muestra.
- La ficha se sigue regenerando cada 5 minutos (`revalidate = 300`), y las similares van incluidas.

### 5.7 Rendimiento

- Referencia: unas 52.000 emisoras y unos 100 usuarios al día.
- Objetivo: una búsqueda o la consulta de similares por debajo de **300 ms** en la base de datos de producción (Neon, Fráncfort). Hay que medirlo con `EXPLAIN ANALYZE` sobre el catálogo real.
- `/buscar` se genera en cada petición, porque depende de los parámetros. No se añade caché de resultados.
- El `statement_timeout` de 5 s del rol de Neon es el techo.
- Si las similares no llegan al objetivo, se precalculan en la tarea diaria en una tabla `station_similar`. Esa decisión se documenta en el plan.

## 6. Restricciones

- Las del proyecto: Next.js 16.4.5 (leer `node_modules/next/dist/docs/` antes de escribir código), Drizzle con migraciones en `drizzle/`, Vitest y Playwright, textos en `src/i18n/es-ES.ts`.
- La caché sigue el modelo actual sin Cache Components (`caching-without-cache-components.md`).
- Las migraciones se aplican en producción con la máquina temporal de Fly, como en el plan 2b. Las extensiones necesitan permisos de creación; el rol de Neon propietario de la base de datos los tiene.
- La spec v1 se actualiza:
  - §6.5, §6.6 y §6.9 remiten a este documento;
  - §2 ("Incluido en v1") deja de mencionar el buscador con IA, la voz y las descripciones con IA;
  - §6.1 recoge los 13 géneros.

## 7. Lo que queda en manos del builder

- El umbral exacto de parecido por trigramas y la función (`similarity` o `word_similarity`), ajustados con nombres reales (Cadena SER, LOS40, COPE, Radio Nacional…).
- El peso exacto de los tags frecuentes en las similares.
- Si las similares se precalculan, según la medición de §5.7.
- La lista concreta de tags nuevos en `tag_genres`, dentro de la regla de §5.1.
- El diseño visual del formulario, las etiquetas de filtros activos y la caja de la cabecera, coherente con el actual y con el modo oscuro.
- Cómo se cachean las listas de opciones, dentro de una hora.

## 8. Decisiones del responsable tras la revisión

- **Géneros:** se añaden Religiosa, Latina, Country y folk, y Hip hop (§5.1).
