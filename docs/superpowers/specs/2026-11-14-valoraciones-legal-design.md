# Plan 4 — Valoraciones con email verificado y textos legales — Diseño

Fecha: 2026-11-14
Desarrolla: [spec v1](2026-11-04-directoradio-v1-design.md) §6.8 (valoraciones), §4 (RGPD y textos legales) y §8 (modelo de datos).

## 1. Por qué

Las fichas ya muestran una valoración media y el número de valoraciones, pero nadie puede votar. La spec v1 define unas valoraciones de 1 a 5 estrellas **difíciles de inflar o hundir**: cada voto exige un email verificado.

Al guardar emails, la web necesita textos legales:
- política de privacidad;
- aviso legal;
- texto de aceptación del voto.

Además, la política de cookies (PR #7) tiene pendiente el apartado «Responsable».

## 2. Objetivos, no-objetivos y anti-objetivos

**Objetivos**
- Votar una emisora en dos pasos (estrellas y, después, email), con un email de verificación.
- Que el segundo voto desde el mismo navegador sea inmediato.
- Que la media y el número de valoraciones de la ficha reflejen solo votos verificados.
- Publicar la política de privacidad y el aviso legal con los datos reales del titular, y completar la política de cookies.

**No-objetivos**
- Cuentas de usuario, comentarios de texto, o editar y borrar el propio voto desde la web.
- Un panel de administración. El borrado de los datos de un email a petición lo hace a mano la persona técnica (spec §6.8), siguiendo un procedimiento documentado.

**Anti-objetivos**
- Que un mismo email cuente más de un voto por emisora.
- Que alguien vote con el email de otra persona.
- Que la web sirva para enviar emails masivos a direcciones ajenas: hay límites por IP y por email y un CAPTCHA.
- Abrir las valoraciones antes de que los textos legales estén revisados.
- Guardar más datos o durante más tiempo de lo necesario.

## 3. Restricciones

- Las del proyecto:
  - Next.js 16.4.5: leer `node_modules/next/dist/docs/` antes de escribir código;
  - Drizzle y migraciones en `drizzle/`, aplicadas en Neon **antes de fusionar**, como en el plan 3;
  - textos en `src/i18n/es-ES.ts`;
  - Vitest y Playwright.
- **Sin dependencias nuevas.** Brevo y Turnstile se llaman con `fetch` a sus API HTTP.
- **Titular:** persona física; email de contacto `amadeurm@gmail.com`. Nombre completo, NIF y domicilio los facilita el responsable antes de activar las valoraciones (§5.8).
- **Tráfico:** unos 100 usuarios al día. El plan gratuito de Brevo (unos 300 emails al día) basta.

## 4. Enfoques considerados

| Decisión | Opciones | Elegida y por qué |
|---|---|---|
| Envío de emails | **Brevo**; Resend; Gmail por SMTP | **Brevo** (elección del responsable): empresa de la UE con datos en Francia y Alemania, y un plan gratuito de unos 300 emails al día. Resend se queda en 100 al día y su residencia de datos en la UE no está clara sin pagar. Gmail expondría el email personal y acabaría en spam. |
| CAPTCHA | **Cloudflare Turnstile** | Gratuito, invisible y con la cuenta de Cloudflare que ya existe. |
| Activación | **Interruptor por variable de entorno** (`RATINGS_ENABLED`) | Permite fusionar el código sin abrir los votos hasta revisar los textos legales (decisión del builder, aceptada por el responsable). |

## 5. Decisiones

### 5.1 Datos

Hay tres tablas nuevas, más los campos que ya existen en `stations`.

- **`verified_emails`:**
  - `email` (clave primaria, normalizado: recortado y en minúsculas);
  - `first_verified_at`: no cambia mientras exista la fila; la cookie de votante tiene que ser posterior (§5.3);
  - `verified_at`: la última verificación;
  - `privacy_accepted_at`.
- **`ratings`:**
  - `id`;
  - `station_id`, que se borra en cascada con la emisora;
  - `email`, normalizado;
  - `stars`, un entero de 1 a 5 con `CHECK`;
  - `status`: `pending` o `verified`;
  - `token_hash` (SHA-256 del token) y `token_expires_at`, ambos nulos una vez verificado;
  - `privacy_accepted_at`;
  - `ip_hash`, con la misma sal y la misma función que las reproducciones (`PLAYS_IP_SALT`, `hashIp`/`ipKey`). Se borra (pasa a nulo) a los 35 días, como en las reproducciones (§5.7);
  - `created_at` y `updated_at`.
- **Índices de `ratings`:** índice único `(station_id, email, status)` e índice en `token_hash`.
- **`rating_attempts`**, un registro de intentos para los límites de §5.4 (decisión del builder):
  - `id`, `ip_hash`, `email` normalizado, `sent_email` (si se envió email de verificación) y `created_at`;
  - índices `(ip_hash, created_at)` y `(email, created_at)`.

  Hace falta porque las filas de `ratings` se sustituyen y se borran, y contar sobre ellas daría límites demasiado bajos: reenviar al mismo email y emisora nunca superaría el límite. Las filas se borran a las 48 horas (§5.7).
- **`stations.rating_avg` y `stations.rating_count`:** se recalculan desde los votos `verified` de la emisora, en la misma transacción que la verificación.
- **Un voto por email y emisora:**
  - como máximo un voto `verified` y uno `pending` por email y emisora;
  - al verificar un voto pendiente, sustituye al verificado anterior, si lo hay: se borra el antiguo y el pendiente pasa a verificado;
  - mientras tanto, el voto verificado anterior sigue contando (decisión del builder).
- **Normalización del email:** recortar y pasar a minúsculas. Se valida con un formato razonable y un máximo de 254 caracteres. No se intenta deducir alias (`+`, puntos de Gmail).

### 5.2 Flujo

1. **Ficha de la emisora,** bloque «Valora esta emisora»:
   - Primero, solo 5 estrellas, que se pueden elegir con teclado y ratón.
   - Al elegir una, se despliegan:
     - el campo de email;
     - la casilla «He leído y acepto la política de privacidad», con enlace a `/privacidad`;
     - el widget invisible de Turnstile;
     - el botón «Enviar valoración».
2. **Envío:** `POST /api/valoraciones` con `{ stationId, stars, email, acceptedPrivacy, turnstileToken }`. El servidor, en este orden:
   1. comprueba el interruptor; si está apagado, responde 404;
   2. valida el cuerpo (como máximo 2 KB, igual que las reproducciones);
   3. verifica Turnstile en el servidor (`siteverify`, con la IP);
   4. aplica los límites (§5.4);
   5. comprueba que la emisora existe y está activa;
   6. decide:
      - si el navegador trae una cookie de votante válida **con el mismo email** (§5.3), el voto se guarda directamente como `verified` y se recalcula la media. Respuesta: `{ status: 'counted' }`;
      - si no, se guarda o sustituye el voto `pending` de ese email y emisora, con un token nuevo de 24 horas, y se envía el email (§5.5). Respuesta: `{ status: 'pending' }`.
3. **Verificación:** la página `/valoraciones/verificar?token=…`:
   - busca el voto por el hash del token;
   - si es válido y no ha caducado, en una transacción:
     - pasa el voto a `verified` y sustituye al anterior;
     - inserta o actualiza `verified_emails`;
     - recalcula la media;
   - pone la cookie de votante en el navegador;
   - revalida la ficha (`revalidatePath('/emisora/<slug>')`);
   - y muestra «Tu valoración de <Emisora> ya cuenta», con un enlace a la ficha.

   Si el token es inválido, se ha usado ya o ha caducado, se muestra un mensaje claro, sin decir cuál de los tres casos es, y un enlace para volver a votar. La página lleva `noindex`.

   Al ser una página (GET), el token de un solo uso se consume al abrirla. Los escáneres de enlaces de algunos correos podrían consumirlo antes de que lo abra el usuario. Por eso la página **no** verifica en el GET: muestra un botón «Confirmar mi valoración» que hace POST a la misma ruta con un Server Action, y la verificación ocurre ahí (decisión del builder).
4. **Mensajes en la ficha tras enviar:**
   - pendiente: «Te hemos enviado un email a <email>. Pulsa el enlace para que tu valoración cuente (caduca en 24 horas).»;
   - contado: «¡Gracias! Tu valoración ya cuenta.» La media que se ve se actualiza al recargar.

### 5.3 Cookie de votante

- **Nombre** `dr_voter`. Valor: `base64url(email) + "." + issuedAt + "." + HMAC-SHA256(secret, email + "." + issuedAt)`, con `RATINGS_SECRET`.
- **Atributos:** `HttpOnly`, `Secure` en producción, `SameSite=Lax`, `Path=/` y 365 días.
- **Rellenar el email:**
  - al desplegar el formulario, el cliente pide `GET /api/valoraciones/yo` y recibe `{ email }` si la cookie es válida;
  - la ficha es estática (ISR), por eso esta consulta es aparte;
  - la respuesta lleva `Cache-Control: no-store`.
- **Validez:** la firma no basta. La cookie solo vale si el email sigue en `verified_emails` y su `issuedAt` es igual o posterior a `first_verified_at`. Así, tras un borrado a petición (§5.7), las cookies antiguas dejan de valer aunque estén bien firmadas. Por eso el voto directo y `GET /api/valoraciones/yo` consultan la base de datos.
- **Si alguien escribe un email verificado desde otro navegador** sin la cookie de ese email, se le pide verificar de nuevo.
- La cookie es técnica: se incluye en la política de cookies.

### 5.4 Límites contra el abuso

- **Por IP** (`ip_hash`): 10 envíos por hora y 30 por día, contados en `rating_attempts`.
- **Por email:** 5 emails de verificación al día, contados en `rating_attempts` con `sent_email = true`. Con la cookie válida no se envía email, pero el intento cuenta igual para el límite por IP.
- **Simultaneidad:** el registro del intento y la comprobación de los límites se hacen en una transacción con un bloqueo de asesoramiento por `ip_hash`, como en `recordPlay`, para que dos envíos simultáneos no se salten el límite.
- **Al superarlos:** 429 con `Retry-After`. El formulario muestra «Has hecho demasiados intentos. Vuelve a probar más tarde.»
- **Turnstile obligatorio:** si falla, 400. Mensaje: «No hemos podido comprobar que no eres un robot. Recarga la página e inténtalo de nuevo.»
- **En desarrollo y en los tests** se usan las claves de prueba oficiales de Turnstile, que siempre aceptan o siempre rechazan.

### 5.5 Email de verificación (Brevo)

- **Envío:** `POST https://api.brevo.com/v3/smtp/email` con `BREVO_API_KEY`.
- **Remitente:** «DirectoRadio <no-responder@directoradio.com>». Para que llegue, el dominio se autentica en Brevo con registros DNS (SPF, DKIM y DMARC) en Cloudflare, **en modo «DNS only»**. Lo hace el responsable, con ayuda.
- **Contenido:** asunto «Confirma tu valoración de <Emisora>». Cuerpo en HTML y en texto plano, en español:
  - la emisora y las estrellas;
  - el botón o enlace `https://directoradio.com/valoraciones/verificar?token=…`;
  - «caduca en 24 horas»;
  - «si no has sido tú, ignora este email»;
  - un enlace a la política de privacidad.
- **Si Brevo falla,** el voto pendiente se borra, se responde 502 y el formulario muestra «No hemos podido enviar el email. Inténtalo de nuevo en unos minutos.»
- **Sin `BREVO_API_KEY`** (desarrollo y tests), el enlace se escribe en el log del servidor en lugar de enviarse.

### 5.6 Interruptor

- **`RATINGS_ENABLED=true`** activa el bloque de la ficha y la API. Con cualquier otro valor:
  - la ficha no muestra el bloque;
  - `POST /api/valoraciones` y `GET /api/valoraciones/yo` responden 404;
  - la página de verificación muestra «Las valoraciones no están disponibles».
- **Las páginas legales se publican siempre,** con o sin el interruptor.
- **Variables nuevas:** `RATINGS_ENABLED`, `RATINGS_SECRET`, `BREVO_API_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`.

### 5.7 Limpieza y derechos RGPD

- **Fase `ratings-prune` de la tarea diaria de Fly:**
  - borra los votos `pending` con más de 7 días;
  - borra las filas de `rating_attempts` con más de 48 horas;
  - y vacía `ip_hash` en los votos con más de 35 días.
- **Borrado a petición:** se documenta en `docs/superpowers/HANDOFF.md`, con un script `npm run ratings:forget -- <email>`. El script:
  - borra los votos de ese email, sus intentos y su fila en `verified_emails`, lo que invalida sus cookies (§5.3);
  - recalcula la media de las emisoras afectadas;
  - e imprime cuántas filas ha borrado.

### 5.8 Textos legales

- **Datos del titular** en un único archivo, `src/legal/owner.ts`:
  - nombre completo, NIF, domicilio, email de contacto (`amadeurm@gmail.com`) y dominio;
  - mientras falten datos, contienen `PENDIENTE`;
  - un test impide activar las valoraciones (`RATINGS_ENABLED=true` en el build de producción) si queda algún `PENDIENTE`. El build falla con un mensaje claro.
- **`/aviso-legal`** (LSSI):
  - titular, NIF, domicilio y contacto;
  - objeto de la web;
  - condiciones de uso;
  - propiedad intelectual: los logotipos y las marcas de las emisoras son de sus titulares, y los datos del catálogo proceden de Radio-Browser;
  - exclusión de responsabilidad sobre los streams de terceros;
  - legislación aplicable.
- **`/privacidad`** (RGPD):
  - responsable;
  - datos que se tratan: email, valoración, fecha de aceptación, IP cifrada (hash), identificador de sesión de reproducción y analítica con consentimiento;
  - finalidades y base jurídica:
    - consentimiento para la valoración y la analítica;
    - interés legítimo para la prevención del abuso;
  - conservación:
    - votos pendientes, 7 días;
    - registro de intentos (email e IP cifrada), 48 horas;
    - IP cifrada de los votos, 35 días;
    - votos verificados, mientras la web exista o hasta que se pida su borrado;
    - IP cifrada de las reproducciones, 35 días, como hoy;
  - encargados del tratamiento: Brevo (Francia), Neon (Fráncfort), Vercel, Fly.io (Fráncfort), Cloudflare (Turnstile y DNS) y Google (analítica, solo con consentimiento). Se indican las transferencias fuera de la UE donde las haya;
  - derechos y cómo ejercerlos (email de contacto) y derecho a reclamar ante la AEPD.
- **Texto de aceptación del voto:** junto a la casilla, «He leído y acepto la política de privacidad», enlazada. Debajo, en pequeño:

  > Usaremos tu email solo para verificar tu valoración y evitar votos duplicados. No lo publicaremos ni lo usaremos para otra cosa.
- **Política de cookies:** el apartado «Responsable» pasa a mostrar los datos de `owner.ts`, y se añade la cookie `dr_voter`.
- **Pie de página:** enlaces a «Aviso legal» y «Privacidad», junto a los de cookies.
- **Aviso permanente** (spec §4): los textos los redacta el equipo y conviene que los revise un abogado antes de activar las valoraciones.

### 5.9 Interfaz

- **Bloque «Valora esta emisora»** en la ficha, después del reproductor y antes de las emisoras similares. Las estrellas grandes, con un área táctil de al menos 40 px y con `role="radiogroup"`.
- **El formulario** se despliega bajo las estrellas. No es un modal.
- **Textos** en `src/i18n/es-ES.ts`.

Boceto:

```
Valora esta emisora
☆ ☆ ☆ ☆ ☆                     ← paso 1

★ ★ ★ ★ ☆                     ← paso 2, tras pulsar
[ tu@email.com              ]
[✓] He leído y acepto la política de privacidad
    Usaremos tu email solo para verificar tu valoración…
[ Enviar valoración ]
```

## 6. Lo que queda en manos del builder

- El diseño visual exacto del bloque, coherente con la web y con el modo oscuro.
- La estructura de los componentes y si el envío es un Server Action o una ruta `POST`. La API de §5.2 es la referencia; un Server Action equivalente vale, siempre que respete el orden de comprobaciones.
- La redacción final de los textos legales, dentro de lo que dice §5.8.
- Los tests:
  - flujo completo con Brevo y Turnstile simulados;
  - límites;
  - un voto por email y emisora con sustitución;
  - cookie válida e inválida;
  - token caducado o reutilizado;
  - recálculo de la media;
  - interruptor apagado;
  - test de `PENDIENTE` con el interruptor encendido;
  - e2e del flujo con el enlace del log.
