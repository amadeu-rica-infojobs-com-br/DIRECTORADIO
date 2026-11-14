# Logotipo y favicon — Diseño

Fecha: 2026-11-14

## Por qué

La web no tiene identidad visual propia: el favicon es el de Next.js por defecto y la cabecera solo muestra el texto «DirectoRadio». El responsable quiere un logotipo y un favicon que transmitan **«tecnología para descubrir emisoras de todo el mundo»**.

## Objetivos, no-objetivos y anti-objetivos

- **Objetivos:**
  - logotipo en la cabecera de todas las páginas;
  - favicon reconocible a 16 px;
  - icono para guardar la web en el móvil;
  - imagen para compartir enlaces (WhatsApp, redes).
- **No-objetivos:** cambiar los colores del resto de la web (botones, enlaces, filtros). Si se quiere, irá en una propuesta aparte.
- **Anti-objetivos:** un logo que se vea mal en modo oscuro, borroso en pantallas de alta densidad, o un favicon que a 16 px sea una mancha.

## Enfoques considerados

| Opción | Descripción | Decisión |
|---|---|---|
| **A** | SVG en el código: componente `Logo` con el SVG en línea, y las convenciones de archivos de metadatos de Next.js (`icon.svg`, `favicon.ico`, `apple-icon.png`, `opengraph-image`) | **Elegida.** Nítido a cualquier tamaño, con modo oscuro, y Next.js genera las etiquetas del `<head>` solo. |
| B | Solo `favicon.ico` y el logo como imagen | Descartada: peor en modo oscuro, sin icono de móvil ni imagen para compartir. |

## Diseño elegido: C2 «Ecualizador en directo»

El responsable eligió esta propuesta entre tres direcciones (globo de ondas, pin de señal y ecualizador) y tres variantes del ecualizador.

- **Símbolo:** un cuadrado redondeado (radio 12 sobre 48) con cuatro barras de ecualizador de alturas crecientes y decrecientes en verde azulado, y una quinta barra corta en verde lima como luz de «en directo».
- **Logotipo:** el símbolo y el nombre **«DirectoRadio»**, con mayúsculas: «Directo» en el color del texto y «Radio» en verde azulado. Tipografía del sistema, peso 700 e interletraje -0,02 em.
- **Colores:**

  | Uso | Claro | Oscuro |
  |---|---|---|
  | Fondo del símbolo | `#0f172a` | `#134e4a` |
  | Barras | `#2dd4bf` | `#5eead4` |
  | Barra «en directo» | `#a3e635` | `#bef264` |
  | «Radio» en el nombre | `#0d9488` | `#5eead4` |

- **Favicon:** el mismo símbolo, con las barras más gruesas y solo 3 barras más la de «en directo», para que se lea a 16 px. Usa siempre los colores de modo claro, porque su fondo oscuro contrasta con pestañas claras y oscuras.

SVG de referencia del símbolo grande (48×48) y del favicon, tal como se aprobaron:

```svg
<!-- logo: claro -->
<svg viewBox="0 0 48 48"><rect x="2" y="2" width="44" height="44" rx="12" fill="#0f172a"/><g fill="#2dd4bf"><rect x="10" y="20" width="4" height="8" rx="2"/><rect x="17" y="14" width="4" height="20" rx="2"/><rect x="24" y="10" width="4" height="28" rx="2"/><rect x="31" y="15" width="4" height="18" rx="2"/></g><rect x="38" y="21" width="4" height="6" rx="2" fill="#a3e635"/></svg>
<!-- favicon -->
<svg viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#0f172a"/><g fill="#2dd4bf"><rect x="7" y="19" width="7" height="10" rx="3"/><rect x="17" y="11" width="7" height="26" rx="3"/><rect x="27" y="6" width="7" height="36" rx="3"/></g><rect x="37" y="17" width="7" height="14" rx="3" fill="#a3e635"/></svg>
```

## Piezas

1. **`src/components/Logo.tsx`:**
   - SVG en línea con el símbolo y el nombre, con los colores claros y oscuros de la tabla (variantes `dark:` de Tailwind);
   - sustituye al texto «DirectoRadio» de la cabecera, enlazado a `/`;
   - nombre accesible «DirectoRadio».
2. **`src/app/icon.svg`:** el favicon en SVG.
3. **`src/app/favicon.ico`:** sustituye al de Next.js, con 16, 32 y 48 px generados desde el SVG del favicon.
4. **`src/app/apple-icon.png`:** 180×180, el símbolo con un margen interior para que iOS no lo recorte.
5. **`src/app/opengraph-image`:** 1200×630, el logotipo y el lema «Radio en directo de todo el mundo», sobre fondo `#0f172a`. Texto alternativo: «DirectoRadio · Radio en directo de todo el mundo».
6. La metadata del layout no cambia a mano: Next.js enlaza los archivos anteriores solo.

## Lo que queda en manos del builder

- Las herramientas para generar el `.ico` y los PNG desde los SVG. No deben quedar como dependencias de la web: basta un script puntual o los archivos generados.
- El tamaño del logo en la cabecera, entre 28 y 36 px de alto, y en móvil junto a la caja de búsqueda.
- Si la imagen para compartir se genera con `ImageResponse` (`opengraph-image.tsx`) o se guarda como PNG estático.
- Los tests: el logo en la cabecera con su nombre accesible y enlace a `/`, y que los archivos de iconos existan con el tamaño correcto.
