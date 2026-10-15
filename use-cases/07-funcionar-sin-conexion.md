# Use Case 07: CU-13 Funcionar sin conexión

## Summary
Segunda pieza de F0. La app debe funcionar sin red después de abrirla una sola vez con conexión:
- Se puede abrir y recargar en modo avión.
- Se puede navegar y anotar flechas.
- Los datos siguen ahí al cerrar la app y volver a abrirla.

El *service worker* de `vite-plugin-pwa` (Workbox, `registerType: 'autoUpdate'`) ya está activado desde el scaffold, pero nunca se ha comprobado que precachee todo lo necesario ni que funcione bajo la subruta de GitHub Pages.

Este caso de uso cubre tres cosas:
- Revisar y ajustar la configuración de Workbox: precache de todos los recursos del build, incluidos los iconos de CU-14, y fallback de navegación a `index.html`.
- Confirmar que la actualización a una versión nueva ocurre sola y en silencio al abrir la app con conexión. El usuario eligió que no haya avisos.
- Añadir una prueba automática de Playwright que demuestre el funcionamiento sin conexión y la persistencia de los datos.

Quedan fuera:
- La sincronización entre dispositivos (no hay servidor).
- La copia de seguridad en JSON (CU-15, en F2).
- Cualquier aviso o banner de estado.

## Acceptance Criteria
1. El build genera un service worker que precachea el app shell completo: `index.html`, todos los JS y CSS con hash, el manifest y los iconos. Un test verifica que el manifest de precache de `dist/` incluye cada fichero JS y CSS de `dist/assets/`.
2. La navegación sin red vuelve a `index.html` (navigation fallback), de modo que recargar la app sin conexión en cualquier ruta por hash muestra la app y no la página de error del navegador.
3. `registerType` sigue siendo `autoUpdate`. Cuando hay una versión nueva, el service worker nuevo toma el control sin intervención del usuario y sin mostrar ningún aviso. No hay ningún banner ni toast de «lista sin conexión» ni de «actualizada».
4. El service worker no cachea respuestas de otros orígenes ni rompe nada si el navegador no admite service workers: la app sigue funcionando online.
5. Un test de Playwright a 375 px, contra el build servido con `vite preview` bajo una ruta que imita la de producción:
   - abre la app con red y espera a que un service worker controle la página;
   - crea la sesión de prueba y anota una tanda;
   - corta la red (`context.setOffline(true)`) y recarga;
   - comprueba que la pantalla de puntuación carga con la tanda anotada;
   - anota otra flecha sin red y recarga de nuevo sin red;
   - comprueba que las dos flechas persisten;
   - comprueba que no hay errores en consola, aparte de los fallos de red esperables.
6. El mismo test, o uno aparte, abre una página nueva en el mismo contexto sin red, como si la app se cerrara y se volviera a abrir, y comprueba que la app y los datos siguen disponibles.
7. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build` terminan sin errores, también en CI (Linux).

## Potential Pitfalls & Open Questions
- **Risk** — Hoy `vite preview` sirve en `/`, mientras que producción vive en `/arco-entrenamiento/`. Un fallo de alcance (`scope`) o de rutas podría pasar los tests y fallar en Pages. Por eso conviene probar bajo una subruta, o al menos verificar que todas las rutas son relativas.
- **Risk** — En Playwright, `setOffline` y los service workers tienen matices: la primera carga aún no está controlada por el SW, y hay que esperar a `navigator.serviceWorker.ready` y a `controller` antes de cortar la red. Si no, el test es inestable, sobre todo en CI.
- **Edge case** — Al desplegar una versión nueva, una pestaña abierta con la versión anterior podría pedir un chunk antiguo. El precache completo más `autoUpdate` debe evitarlo. No se añade aviso.
- **Assumption** — Los datos ya persisten en `localStorage` (`archery-training:v1`) y se pide `navigator.storage.persist()` desde F1. Este caso de uso no cambia el almacenamiento, solo verifica que funciona sin red.
- **Missing input** — La prueba real en modo avión en el teléfono la hace el usuario a mano tras el despliegue.

## Original Description
Descripción redactada por Claude y aprobada por el usuario en la conversación:

Funcionar sin conexión (CU-13).

Lo que verás: basta con abrir la app una vez con internet. Después funciona en modo avión: abre, anotas y tus datos siguen ahí al cerrarla y volver a abrirla.

Por debajo:
- El *service worker* es un pequeño programa que el navegador guarda y que sirve la app desde el móvil cuando no hay red. Ya está activado, pero nunca se ha comprobado.
- Se añade una prueba automática: carga la app, corta la red, recarga y comprueba que todo funciona y que los datos persisten.
- Cuando publique una versión nueva, la app se actualiza sola la siguiente vez que la abras con conexión.

Fuera:
- Sincronizar entre dispositivos (no hay servidor).
- La copia de seguridad en JSON (CU-15, F2).

## Clarifications
- Q: Cuando haya una versión nueva o la app quede lista para usarse sin red, ¿quieres un aviso?
  A: Sin avisos: todo ocurre en silencio y la app se actualiza sola al abrirla con conexión.
