# Filtros del buscador como fila de etiquetas — Diseño

Fecha: 2026-11-14
Cambia: [diseño del buscador por campos](2026-11-13-buscador-por-campos-design.md), §5.3 (interfaz).

## Por qué

El formulario completo del buscador (texto, País, Idioma, Género y «Buscar») se muestra siempre en la portada y en `/buscar`. En un móvil de 360 px ocupa casi toda la pantalla: la primera emisora empieza a 527 px en la portada y a 607 px en `/buscar`. Además, el campo de texto sale dos veces en la portada, en la cabecera y en el formulario. El responsable quiere que los filtros no se vean desplegados de primeras.

## Objetivos, no-objetivos y anti-objetivos

- **Objetivos:**
  - los filtros ocupan una sola línea;
  - las emisoras suben a la parte alta de la pantalla en móvil;
  - elegir o quitar un filtro sigue siendo rápido.
- **No-objetivos:**
  - cambiar qué se filtra o cómo se busca (`searchStations`, parámetros de la dirección, opciones en caché, pantalla sin resultados);
  - gestos de arrastre en la hoja.
- **Anti-objetivos:**
  - que el filtro quede tan escondido que no se encuentre;
  - perder lo que ya funciona: navegación sin JavaScript, botón «atrás», teclado y lectores de pantalla;
  - añadir dependencias.

## Enfoques considerados

Entre tres propuestas (A: botón «Filtros» con panel desplegable; **B: fila de etiquetas**; C: icono junto al título con hoja de filtros), el responsable eligió **B**.

| Cómo construirlo | Decisión |
|---|---|
| **Componente propio con `<dialog>` del navegador; cada opción es un enlace** | **Elegido.** Foco, Esc y fondo oscurecido los da el navegador; cada elección es una navegación normal (botón «atrás», enlaces compartibles), y no hay dependencias. |
| Librería de componentes (Radix, Vaul) | Descartado: añade dependencias para lo que ya hace el navegador. |
| Solo CSS (`:target`) | Descartado: mal foco, teclado y botón «atrás». |

## Diseño

### Fila de etiquetas

Sustituye al `SearchForm` de la portada y de `/buscar`, y a `ActiveFilters`.

- **Etiquetas, en este orden:**
  - texto buscado, solo si hay `q`;
  - País;
  - Idioma;
  - Género.
- **Inactiva:** muestra el nombre del filtro y una flecha («País ▾»). Abre la lista de ese filtro.
- **Activa:** se rellena con el color de la marca y muestra el valor y una ✕ («España ✕»).
  - Pulsar el valor abre la lista para cambiarlo.
  - La ✕ es un enlace a la misma búsqueda sin ese filtro, con un área táctil de al menos 32 px.
- **Etiqueta del texto:** «“ser” ✕». La ✕ quita el texto; no abre ninguna lista.
- **En móvil,** la fila no salta de línea: se desliza en horizontal.
- **Colores de la etiqueta activa:**
  - claro: fondo `#ccfbf1`, borde `#0d9488` y texto `#115e59`;
  - oscuro: fondo `#134e4a`, borde `#5eead4` y texto `#ccfbf1`.

  Son tonos del verde azulado del logo.

### Lista de opciones

- **En móvil (menos de 640 px),** sale una hoja desde abajo (`<dialog>` modal) con el título del filtro, la lista y un botón para cerrar.
- **En escritorio,** la misma lista sale en un desplegable bajo la etiqueta. Es el mismo `<dialog>` colocado bajo la etiqueta, con una altura máxima y desplazamiento propio.
- **Primera opción:** «Todos», que quita el filtro. El valor actual va marcado.
- **País e Idioma** llevan arriba un campo para filtrar la lista mientras se escribe. Ignora tildes y mayúsculas: «port» encuentra «Portugal» y «Portugués». Género (13 opciones) no lo lleva.
- **Cada opción es un enlace** a `searchHref(...)` con ese filtro y página 1. Elegir navega al momento y cierra la lista.
- **Se cierra** con Esc, con el botón de cerrar o pulsando fuera.

### Cabecera

`HeaderSearch` sigue siendo el único campo de texto.

- En `/buscar`, muestra el texto actual y conserva los filtros activos (`pais`, `idioma` y `genero` como campos ocultos). Así, cambiar el texto no borra los filtros.
- Fuera de `/buscar` se comporta como hoy.

### Sin JavaScript

La fila se muestra como un `<details>` con «Filtros (n)»: un panel plegable con los desplegables de siempre y el botón «Buscar». Es la propuesta A, y reutiliza `SearchForm` sin el campo de texto.

### Accesibilidad

- Las etiquetas son `<button>` con `aria-haspopup="dialog"` y un nombre como «País: España, cambiar».
- La lista es un `<dialog>` con `aria-labelledby` apuntando a su título.
- El campo de filtro de la lista tiene su etiqueta.
- La fila tiene `aria-label="Filtros"`.

### Lo que no cambia

- La pantalla sin resultados (`NoResults`) sigue igual, con sus enlaces «Quitar «…»».
- El contador de resultados, la paginación y las opciones en caché siguen igual.

## Lo que queda en manos del builder

- Las animaciones (aparición de la hoja), siempre que respeten `prefers-reduced-motion`.
- Cómo se reparte el código entre componentes de servidor y de cliente: las listas de opciones ya traducidas llegan del servidor como props.
- Los tests:
  - etiquetas inactivas, activas y del texto;
  - enlaces de las opciones y de la ✕;
  - filtro de la lista sin tildes;
  - cabecera que conserva los filtros;
  - versión sin JavaScript;
  - y un e2e a 360 px que comprueba que la primera emisora queda por encima de los 300 px.
