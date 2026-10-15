# Use Case 02: CU-04 Corregir flecha

## Summary
Segunda pieza de F1, construida sobre lo que entrega el caso de uso 01 (CU-03 Anotar flechas). Permite corregir y anotar fuera de orden: tocar cualquier celda de la tabla de puntuación (vacía o rellena, sea o no la primera vacía) la selecciona, y la siguiente pulsación del teclado escribe o sobrescribe su valor, que se guarda al instante. Después de escribir, la selección avanza con la misma regla que al anotar (`nextCell`). La selección por toque se conecta a `select(fila, flecha)` del composable `useScoring` (ya existente desde CU-03) y sustituye la restricción del criterio 21 de CU-03. En una sesión finalizada, tocar celdas no tiene efecto. Las celdas son accesibles con el dedo y con teclado. Incluye tests unitarios y un test de Playwright. Quedan fuera el reordenado de la tanda tras corregir (CU-06) y el borrado de flechas (CU-05).

## Acceptance Criteria
1. Tocar cualquier celda de la tabla —vacía o rellena, aunque no sea la primera vacía— la selecciona: queda resaltada y la anterior deja de estarlo.
2. Con una celda rellena seleccionada, pulsar una zona sustituye su valor por la nueva clave y el cambio se guarda al instante.
3. Tras escribir en la celda seleccionada (corrección o anotación fuera de orden), la selección avanza con `nextCell`: a la siguiente flecha; desde la última flecha de una tanda, a la primera de la tanda siguiente; en la última celda de la sesión no se mueve.
4. Las celdas miden al menos 48 px de alto, tienen un `aria-label` con serie, tanda, flecha y valor (o «vacía»), se pueden enfocar con Tab y seleccionar con Enter o Espacio, con foco visible.
5. En una sesión finalizada (`closed: true`), tocar o activar una celda no cambia la selección ni el valor.
6. La corrección persiste tras recargar la página.
7. El criterio 21 del caso de uso 01 («tocar una celda no cambia la selección») deja de aplicarse; los tests que lo comprobaban se actualizan.
8. Hay tests de Vitest para la selección y la sobrescritura en `useScoring` y en el store; la cobertura de `src/domain/**` y `src/composables/**` sigue siendo ≥ 90 % de líneas.
9. Un test de Playwright a 375 px anota una tanda, toca la segunda flecha, la cambia, comprueba el nuevo valor y la selección resultante, recarga y comprueba que la corrección se conserva.
10. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build` terminan sin errores.
11. Si quedan huecos en la tabla (p. ej. se anota la tanda 3 antes que la 2), al abrir o recargar la pantalla se selecciona el primer hueco, según `firstEmptyCell`.

## Potential Pitfalls & Open Questions
- **Assumption** — Al corregir una flecha de una tanda completa no se reordena nada en este caso de uso; el reordenado (también tras corrección) llega con CU-06.

## Original Description
Descripción redactada por Claude y aprobada por el usuario en la conversación:

Es pequeño: activa lo que en CU-03 dejamos fuera a propósito.

Lo que verás en el móvil:
- Tocar cualquier celda la selecciona, esté vacía o rellena, y queda resaltada como la seleccionada.
- La siguiente pulsación del teclado sobrescribe esa celda con la nueva zona.
- Después de corregir, la selección avanza igual que al anotar: a la siguiente flecha, o a la primera de la tanda siguiente.
- Si la sesión está finalizada, tocar una celda no hace nada (solo lectura).
- Las celdas se pueden tocar con el dedo con comodidad (al menos 48 px de alto) y también se pueden seleccionar con el teclado del ordenador, por accesibilidad.

Lo que hay por debajo:
- La función `select(fila, flecha)` de `useScoring` se conecta a las celdas de la tabla.
- Tests unitarios de la selección y la sobrescritura.
- Un test de Playwright: anotar una tanda, tocar la segunda flecha, cambiarla, comprobar el nuevo valor y que se conserva tras recargar.

Lo que NO entra: reordenar la tanda tras corregir una flecha de una tanda completa (va con CU-06, que trata el orden); borrar flechas (CU-05).

## Clarifications
- Q: Después de corregir una flecha, ¿adónde va la selección?
  A: Avanza a la siguiente (como en la app original y en el plan).
- Q: ¿Se puede tocar una celda vacía que no sea la primera vacía?
  A: Sí, cualquier celda (se puede anotar fuera de orden; pueden quedar huecos).
