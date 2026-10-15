# Use Case 06: CU-14 Instalar en el móvil

## Summary
Primera pieza de F0. Hace que la app se pueda instalar en el móvil como una app más. En Android, Chrome ofrece «Instalar app». En iPhone se instala desde Safari con Compartir → «Añadir a pantalla de inicio». Una vez instalada, la app aparece con su propio icono y el nombre corto «Arco», y se abre a pantalla completa, sin la barra del navegador.

El icono es minimalista: solo el centro de la diana, con el amarillo `#FFE552` y el anillo rojo `#F65058`, en grande, con estilo plano, sobre el fondo oscuro de la app (`#111827`). Debe seguir reconociéndose en tamaño pequeño.

Por debajo:
- El icono se dibuja en un SVG fuente que vive en el repositorio.
- A partir de él se generan los PNG que piden Android e iOS: 192 px, 512 px, una variante *maskable* de 512 px con el dibujo dentro de la zona segura y un `apple-touch-icon` de 180 px. También un favicon.
- Se completa el manifest de `vite-plugin-pwa` (hoy `icons: []`) y se enlazan los iconos en `index.html`.

La app sigue servida bajo la subruta `/arco-entrenamiento/` de GitHub Pages (`base: './'`), así que todas las rutas de iconos y del manifest deben funcionar ahí.

Quedan fuera:
- La verificación del funcionamiento sin conexión, que es CU-13 (caso de uso 07).
- Cualquier aviso de actualización o de «lista para usar sin conexión»: el usuario eligió que no haya avisos.
- Publicar en tiendas de apps.

## Acceptance Criteria
1. Existe un SVG fuente del icono en el repositorio: el centro de la diana con amarillo `#FFE552` y anillo rojo `#F65058` en estilo plano, sobre fondo `#111827`. No incluye flecha ni los anillos exteriores.
2. Existen y se publican en `dist/` los PNG `192×192`, `512×512` y `512×512` *maskable* (con el dibujo dentro del 80 % central), un `apple-touch-icon` de `180×180` y un favicon. Cada PNG tiene exactamente las dimensiones que declara.
3. El manifest generado (`dist/manifest.webmanifest`) declara:
   - `name` «Arco · Entrenamientos», `short_name` «Arco» y `lang` `es`.
   - `display` `standalone`, con `start_url` y `scope` relativos.
   - `theme_color` y `background_color` coherentes con el icono y la app.
   - Al menos un icono de 192 px y uno de 512 px con `purpose` `any`, y uno de 512 px con `purpose` `maskable`.
4. `index.html` enlaza el favicon, el `apple-touch-icon` y las metas de iOS para modo app (`apple-mobile-web-app-capable` o equivalente moderno, título «Arco» y estilo de la barra de estado).
5. Todas las rutas de iconos y del manifest son relativas y funcionan servidas bajo la subruta de GitHub Pages: ninguna devuelve 404 en `vite preview` ni en el despliegue.
6. Chromium considera la app instalable. Un test de Playwright a 375 px comprueba que:
   - el manifest se carga;
   - cada icono declarado responde 200 con tipo `image/png`;
   - hay un service worker registrado que controla la página.
7. Si hace falta un script para generar los PNG a partir del SVG, el script está en el repositorio con un comando `npm run` documentado, y los PNG generados también se suben al repositorio, de modo que el build y el CI no dependen de regenerarlos. No se instala nada fuera del proyecto. Una dependencia de desarrollo nueva solo está justificada si no basta con las herramientas que ya tiene el proyecto, como Playwright.
8. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build` terminan sin errores. `npm audit --omit=dev --audit-level=high` no empeora.

## Potential Pitfalls & Open Questions
- **Risk** — iOS ignora parte del manifest y necesita `apple-touch-icon` y metas propias. iOS no rellena la transparencia del icono, así que el PNG de iOS debe ir con fondo opaco.
- **Edge case** — Con `base: './'` y el router por hash, un enlace absoluto (`/icon.png`) rompería la app en GitHub Pages. Todo debe ser relativo.
- **Assumption** — El fondo del icono es el oscuro de la app (`#111827`) en los dos temas, porque el icono del sistema no cambia con el tema.
- **Missing input** — No se puede automatizar la prueba de instalación real en un móvil. Tras el despliegue, el usuario la comprueba a mano en su teléfono.

## Original Description
Descripción redactada por Claude y aprobada por el usuario en la conversación:

Instalar en el móvil (CU-14).

Lo que verás:
- En Android, Chrome te ofrecerá «Instalar app» o «Añadir a pantalla de inicio».
- En iPhone se instala desde Safari con Compartir → «Añadir a pantalla de inicio».
- La app aparece con su propio icono y nombre («Arco») y se abre a pantalla completa, sin la barra del navegador.

Por debajo:
- Los iconos en todos los tamaños necesarios (192 px, 512 px, versión «maskable» para Android y versión para iPhone).
- El manifest completo, que es la ficha de la app con nombre, icono y colores.
- Las metas de color de la barra de estado.

Fuera: publicar en tiendas de apps.

## Clarifications
- Q: ¿Qué dibujo quieres para el icono de la app?
  A: Solo amarillo/rojo minimal: solo el centro (amarillo y rojo) en grande, estilo plano y simple.
- Q: Cuando haya una versión nueva o la app quede lista para usarse sin red, ¿quieres un aviso?
  A: Sin avisos: todo ocurre en silencio y la app se actualiza sola al abrirla con conexión.
