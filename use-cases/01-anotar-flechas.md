# Use Case 01: CU-03 Anotar flechas

## Summary
Primera pieza de F1 (núcleo de anotación), base sobre la que se construyen CU-04 a CU-07. Entrega la pantalla de puntuación (`/session/:id/score/:archerId`) con la tabla de la sesión: un bloque por serie, una fila por tanda y una celda por flecha. Al entrar se selecciona la primera celda vacía (o la última si no queda ninguna); un teclado con una tecla por zona de la diana de la sesión, coloreada según el catálogo, rellena la celda seleccionada y avanza la selección automáticamente; la fila activa se desplaza a la vista; cada flecha se guarda al instante en `localStorage`. Por debajo incluye el catálogo completo de dianas (`src/domain/targetFaces.ts`), las plantillas (`src/domain/templates.ts`), las funciones puras `zonePoints`, `firstEmptyCell` y `nextCell` con tests (`src/domain/scoring.ts`), el store Pinia `useSessionsStore` (`createSession`, `getSession`, `getArcher`, `setArrow`), la persistencia versionada (`usePersistence`), el composable `useScoring` y un generador de IDs que funciona por HTTP en la red local. Como la creación real de sesiones es de F2 (CU-01), la pantalla de inicio tiene un botón provisional «Sesión de prueba» (Sala 18 m: WA 40, 2×10×3). Incluye tests end-to-end con Playwright y la actualización de las acciones de GitHub Actions. Quedan fuera: corregir tocando una celda (CU-04), borrar (CU-05), ordenar la tanda (CU-06), totales y media (CU-07) y la creación real de sesiones (F2).

## Acceptance Criteria
1. En `/`, el botón «Sesión de prueba» crea, solo la primera vez, una sesión con fecha de hoy, diana `wa-40`, 2 series × 10 tandas × 3 flechas y un arquero, y navega a su pantalla de puntuación. Si la sesión de prueba ya existe, navega a ella sin crear otra. La sesión de prueba se reconoce por una marca estable (p. ej. `location: 'Sesión de prueba'`) sin añadir campos al modelo de datos.
2. La tabla muestra 2 bloques («Serie 1», «Serie 2») de 10 filas con 3 celdas cada uno, con el número de tanda en cada fila.
3. Al abrir la pantalla queda seleccionada y resaltada la primera celda vacía; si la sesión está completa, la última celda.
4. El teclado tiene exactamente una tecla por zona de la diana de la sesión, en el orden del catálogo (en WA 40: `X, 10, 9 … 1, M`).
5. El color de fondo y de texto de cada tecla sale de los campos `bg`/`fg` de la zona en el catálogo, nunca del texto de la tecla.
6. Las teclas miden al menos 48×48 px, tienen `aria-label` y se ven enteras a 375 px de ancho, sin scroll horizontal y respetando `env(safe-area-inset-*)`.
7. Pulsar una zona escribe su clave en la celda seleccionada y mueve la selección: a la siguiente flecha; desde la última flecha de una tanda, a la primera de la tanda siguiente; en la última celda de la sesión, la selección no se mueve (y una nueva pulsación la sobrescribe).
8. Cuando cambia la fila seleccionada, esa fila queda visible sin scroll manual (`scrollIntoView({ block: 'nearest' })`).
9. Tras recargar la página, las flechas anotadas siguen ahí y la selección vuelve a la primera celda vacía.
10. El estado se guarda en `localStorage` con la clave `archery-training:v1` con la forma `{ version: 1, sessions, profileName }`, a través de `usePersistence`, que tiene un punto de entrada para migraciones.
11. Si `localStorage` no está disponible, lanza una excepción o contiene datos corruptos, la app arranca vacía sin romperse.
12. Al arrancar se pide `navigator.storage.persist()`, tolerando que la API no exista.
13. `setArrow` no hace nada si la sesión está cerrada (`closed: true`); en ese caso el teclado se sustituye por un candado con el texto «Sesión finalizada — solo lectura».
14. Si la URL apunta a una sesión o arquero inexistente, se muestra un mensaje claro con enlace al inicio, sin errores en la consola.
15. Los IDs se generan con `crypto.randomUUID()` y, si no está disponible (HTTP por IP local), con una alternativa propia que produce IDs únicos.
16. `targetFaces.ts` contiene las 8 dianas del brief con `key`, `points`, `order`, `bg` y `fg` por zona (incluidos los colores especiales de campo); `templates.ts` contiene las 9 plantillas del brief.
17. Hay tests de Vitest para `zonePoints`, `firstEmptyCell` y `nextCell`, incluidos estos casos de puntos por zona: `X`, `9`, `M` en WA 40 suman 19; `X`, `6` en campo suman 12; `11`, `5` en 3D suman 16. La cobertura de `src/domain/**` y `src/composables/**` es ≥ 90 % de líneas.
18. Un test de Playwright a 375 px crea la sesión de prueba, anota una tanda completa comprobando que la selección avanza, recarga y comprueba que las flechas persisten.
19. `.github/workflows/deploy.yml` usa las versiones mayores actuales de sus acciones y deja de mostrar avisos de deprecación de Node 20.
20. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build` terminan sin errores.
21. Tocar una celda no cambia la selección en este caso de uso (la selección por toque llega con CU-04).
22. El arquero por defecto se llama «Yo», posición `A`; la cabecera de la pantalla de puntuación muestra «A - Yo».

## Potential Pitfalls & Open Questions
- **Assumption** — En F1 no existe forma de finalizar una sesión desde la interfaz (CU-10); el candado del criterio 13 solo se puede verificar con datos preparados en los tests.
- **Risk** — El botón «Sesión de prueba» es provisional: debe quedar marcado en el código (`TODO CU-01`) para retirarlo en F2 sin dejar restos.
- **Risk** — `src/**` en `paths.production` solapa con los tests co-ubicados `src/**/*.test.ts` que escribe QA; el orquestador debe tener en cuenta ese solapamiento al repartir el trabajo.

## Original Description
Descripción redactada por Claude y aprobada por el usuario en la conversación:

Es el más grande porque monta la base que usan los otros cuatro.

Lo que verás en el móvil:
- En la pantalla de inicio, un botón provisional «Sesión de prueba». Crea una sesión Sala 18 m (diana WA 40, 2 series × 10 tandas × 3 flechas) y te lleva a la pantalla de puntuación. Hace falta porque crear sesiones de verdad (CU-01) es de F2. Cuando llegue F2, este botón se sustituye por el formulario real.
- La tabla de puntuación: un bloque por serie («Serie 1», «Serie 2»), una fila por tanda y una celda por flecha.
- Al entrar, la primera celda vacía queda seleccionada y resaltada.
- El teclado de zonas `X, 10, 9 … 1, M`, con botones de al menos 48×48 px y colores de anillo: amarillo, rojo, azul, negro, blanco y gris.
- Al pulsar una zona, la celda se rellena y la selección avanza sola a la siguiente flecha, o a la primera flecha de la tanda siguiente. En la última celda de la sesión se queda quieta.
- La tabla se desplaza sola para que la fila activa siempre se vea.
- Lo que anotas se guarda al instante en el móvil: si recargas o cierras la app, sigue ahí.

Lo que hay por debajo:
- Catálogo de dianas: las 8 del plan (WA 122, 80, 80 reducida, 60, 40, 40 triple, campo y 3D). Cada zona lleva sus puntos y sus colores. Así no se repiten los errores de la app original, que adivinaba los colores por el texto de la tecla.
- Plantillas: la lista de plantillas del plan (Sala 18 m, Aire libre 70 m…). La sesión de prueba usa una; la elección de plantilla llega en F2.
- Reglas de navegación con tests: primera celda vacía (`firstEmptyCell`), siguiente celda (`nextCell`) y puntos de cada zona (`zonePoints`).
- El almacén de sesiones: guarda en `localStorage` con versión de esquema, ignora las escrituras si la sesión está finalizada y genera IDs que funcionan también cuando pruebas en el móvil por la red local.
- Pruebas end-to-end con Playwright a 375 px de ancho: crear la sesión de prueba, anotar una tanda, recargar y comprobar que se conserva.

Lo que NO entra (va en los casos siguientes): tocar una celda ya rellena para corregirla (CU-04); borrar (CU-05); ordenar la tanda (CU-06); totales y media (CU-07); crear o elegir sesiones de verdad (F2).

Una cosa que meteré también aquí: actualizar las acciones `@v4` de GitHub Actions, para quitar los avisos de Node 20 que vimos.

## Clarifications
- Q: ¿Qué hace el botón «Sesión de prueba» si ya existe una sesión de prueba?
  A: Reabrir la existente (una sola sesión de prueba; no se acumulan sesiones invisibles).
- Q: ¿Se puede tocar una celda para seleccionarla ya en este caso de uso?
  A: No, eso es CU-04 (en CU-03 la selección solo avanza sola).
- Q: ¿Qué nombre lleva el arquero por defecto en la sesión?
  A: «Yo» (cuando llegue el perfil, CU-21, se usará el nombre del perfil).
