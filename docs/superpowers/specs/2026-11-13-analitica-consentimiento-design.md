# Analítica con Google Tag Manager y consentimiento de cookies — Diseño

Fecha: 2026-11-13
Cambia: [spec v1](2026-11-04-directoradio-v1-design.md), §4 ("Sin publicidad ni analítica en v1").

## Por qué

El responsable quiere medir el tráfico de la web con su contenedor de Google Tag Manager (`GTM-K6V4M9J6`) en todas las páginas, las actuales y las que vengan. La analítica de Google usa cookies que no están exentas: en España (RGPD, LOPDGDD y la guía de cookies de la AEPD) hace falta el consentimiento previo del usuario. Por eso se añaden un banner de cookies y una política de cookies.

## Objetivos, no-objetivos y anti-objetivos

- **Objetivo:** GTM cargado en todas las páginas de producción. Analytics solo mide con cookies cuando el usuario ha aceptado.
- **No-objetivos:** publicidad, remarketing o un gestor de consentimiento de terceros (Cookiebot, CookieYes…). No se configuran etiquetas dentro del contenedor de GTM; eso lo gestiona el responsable desde la interfaz de GTM.
- **Anti-objetivos:** que se pongan cookies de analítica antes de aceptar; que rechazar sea más difícil que aceptar; que el banner tape el mini-reproductor o impida usar la web; que se cuenten las visitas de desarrollo (`localhost`).

## Enfoques considerados

| Opción | Descripción | Decisión |
|---|---|---|
| **A** | GTM con Consent Mode v2 (todo denegado por defecto) y un banner propio con "Aceptar" y "Rechazar" | **Elegida.** Cumple sin añadir servicios de terceros. |
| B | GTM tal cual, sin banner | Descartada: incumple la normativa y la spec. |
| C | Analítica sin cookies (Vercel Web Analytics, Plausible…) | Descartada: el responsable quiere su GTM. |

## Decisiones

1. **Carga de GTM.** Se usa el componente `GoogleTagManager` de `@next/third-parties/google` en el layout raíz (`src/app/layout.tsx`), que es lo que recomienda la documentación de esta versión de Next.js. Así aparece en todas las páginas presentes y futuras. Sustituye al fragmento pegado por el responsable, que mezclaba `gtag.js` con `gtm.js`.
2. **Solo en producción.** El ID se lee de `NEXT_PUBLIC_GTM_ID`. Si la variable no existe, no se carga GTM ni se muestra el banner. Se configura solo en el entorno de producción de Vercel.
3. **Consent Mode v2.** Un script en línea, que se ejecuta antes que GTM, define en `dataLayer` el consentimiento por defecto: `analytics_storage`, `ad_storage`, `ad_user_data` y `ad_personalization` denegados. Si el usuario ya había aceptado, el mismo script envía `analytics_storage: 'granted'` antes de que cargue GTM, para que la primera página vista ya se mida. Los tres `ad_*` quedan siempre denegados: no hay publicidad en v1.
4. **Banner.**
   - Aparece abajo, encima del mini-reproductor y sin taparlo, mientras el usuario no haya elegido.
   - Tiene un texto breve, un enlace a la política de cookies y los botones "Aceptar" y "Rechazar", con el mismo tamaño y estilo.
   - No bloquea la navegación: se puede seguir usando la web sin contestar, y mientras tanto no se mide con cookies.
   - Aceptar envía `gtag('consent', 'update', { analytics_storage: 'granted' })`. Rechazar no envía nada, porque la denegación ya es el valor por defecto. Las dos opciones cierran el banner.
5. **Dónde se guarda la elección.** En `localStorage`, junto a la fecha. Pasados 12 meses se vuelve a preguntar. Si `localStorage` no está disponible, el banner se muestra en cada visita y la elección vale solo para esa página. Es almacenamiento técnico, exento de consentimiento, y se menciona en la política.
6. **Cambiar de opinión.** Se añade un pie de página con los enlaces "Política de cookies" y "Configurar cookies". Este último vuelve a abrir el banner. Si el usuario pasa de aceptar a rechazar, se envía `analytics_storage: 'denied'`; las cookies `_ga` ya creadas no se pueden borrar desde nuestro dominio con garantías, así que la política explica cómo borrarlas en el navegador.
7. **Política de cookies** en `/politica-de-cookies`, en español. Incluye:
   - Las técnicas: el identificador de sesión de reproducción, que va en `sessionStorage`, y la elección de cookies.
   - Las de analítica de Google (`_ga`, `_ga_*`): para qué sirven y cuánto duran.
   - Cómo cambiar la elección y cómo borrar cookies.

   La redacta el equipo de desarrollo, como el resto de textos legales (spec §4). Se recomienda que la revise un abogado.
8. **Textos** en `src/i18n/es-ES.ts`, como el resto de la interfaz.
9. **Spec.** Se actualiza la §4 de la spec v1: hay analítica con consentimiento y, por tanto, banner.

## Lo que queda en manos del builder

- El texto exacto del banner y de la política, dentro de lo indicado.
- Los detalles visuales del banner y del pie, coherentes con el diseño actual y con el modo oscuro.
- Los tests: banner (aparece sin elección, aceptar y rechazar, no reaparece y se puede reabrir), el script de consentimiento por defecto, que GTM no se cargue sin `NEXT_PUBLIC_GTM_ID`, y la página de la política.

## Tareas del responsable (fuera del código)

- En GTM, comprobar que la etiqueta de Google Analytics 4 respeta el consentimiento. Las etiquetas de Google lo hacen de serie con Consent Mode. Opcionalmente, activar "Configuración de consentimiento" en el contenedor.
- Dar de alta `NEXT_PUBLIC_GTM_ID=GTM-K6V4M9J6` en las variables de producción de Vercel. Si la CLI de Vercel tiene la sesión iniciada, lo puede hacer el builder.
