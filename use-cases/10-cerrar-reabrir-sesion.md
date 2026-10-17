# Use Case 10: CU-10 Cerrar / reabrir sesión

## Summary
Tercera pieza de F2. Permite **finalizar** una sesión, que queda en solo lectura, y **reabrirla**. El bloqueo ya existe por dentro desde F1:
- `setArrow` y `deleteEnd` no hacen nada si `closed` es verdadero;
- `useScoring.isLocked` sale de `closed`;
- `ScoringView` ya muestra el candado «Sesión finalizada — solo lectura» en lugar del teclado.

Falta la forma de cambiar el estado:

- **Finalizar:** en la pantalla de puntuación de una sesión abierta, un botón **«Finalizar sesión»** debajo de las acciones de borrado. Abre el diálogo de confirmación de la app (`useConfirm` / `ConfirmDialog`). Al aceptar, la sesión pasa a `closed: true`: el teclado y los botones de borrar se sustituyen por el candado, y la tabla, los totales y el promedio siguen visibles pero sin poder seleccionar celdas.
- **Reabrir:** junto al candado, un botón **«Reabrir sesión»** que vuelve a abrirla al instante, sin confirmación, y devuelve el teclado con la primera celda vacía seleccionada.
- **Lista de inicio:** las tarjetas de sesiones finalizadas (`SessionCard`) muestran un candado pequeño y el texto «Finalizada».
- **Persistencia:** el estado se guarda al instante y sobrevive a recargar.

**Por debajo:** la acción `setClosed(id, closed)` del store, que el brief ya prevé, y pruebas unitarias y en el navegador a 375 px.

En ArcheryReg no hay botones para esto. Allí la sesión se abre y se cierra sola según el horario de la competición. En esta app no hay horario, así que el usuario decide.

**Fuera de alcance:** el resumen (CU-08), editar (CU-11), borrar (CU-12), exportar e importar (CU-15) y cualquier cierre automático.

## Acceptance Criteria
1. El store expone `setClosed(sessionId, closed)`:
   - fija `closed` y actualiza `updatedAt`;
   - no hace nada si la sesión no existe o si ya tiene ese valor, y entonces no cambia `updatedAt`;
   - el cambio se persiste con el mecanismo existente.
2. En la pantalla de puntuación de una sesión **abierta** aparece un botón «Finalizar sesión» debajo del teclado y de las acciones de borrado. No se confunde con «Borrar flecha» ni con «Borrar tanda»: tiene otro estilo, no es de color de peligro y tiene su propio `data-testid`. Mide al menos 48 px de alto y cabe a 375 px.
3. Al pulsar «Finalizar sesión» se abre el diálogo de confirmación de la app, nunca `window.confirm`, con título «¿Finalizar la sesión?», un mensaje que dice que quedará en solo lectura y que se podrá reabrir, y los botones «Finalizar» y «Cancelar». Al cancelar, o con Escape, no cambia nada y el foco vuelve al botón. Al confirmar, la sesión pasa a `closed: true`.
4. Con la sesión finalizada, la pantalla de puntuación:
   - oculta el teclado, «Borrar flecha», «Borrar tanda» y «Finalizar sesión»;
   - muestra el candado «Sesión finalizada — solo lectura»;
   - mantiene visibles la tabla, los totales por tanda, serie y general, y el promedio;
   - impide seleccionar o modificar celdas;
   - no muestra ninguna celda seleccionada.
5. Junto al candado aparece un botón «Reabrir sesión», de al menos 48 px de alto. Al pulsarlo, la sesión pasa a `closed: false` al instante, sin confirmación. Vuelven el teclado y los botones de borrar, la selección queda en la primera celda vacía (`firstEmptyCell`, o la última si no hay vacías) y el foco va a un elemento lógico, por ejemplo la celda seleccionada o el teclado, no al `body`.
6. Al anotar la última flecha de la sesión no pasa nada especial. La sesión sigue abierta hasta que el usuario pulse «Finalizar sesión».
7. En la lista de inicio, la tarjeta de una sesión finalizada muestra un candado pequeño decorativo y el texto «Finalizada». Su nombre accesible incluye «finalizada». Las tarjetas de sesiones abiertas no muestran ningún indicador. La tarjeta finalizada sigue cabiendo a 375 px, también en el peor caso de CU-09, y al tocarla se abre la pantalla de puntuación en solo lectura.
8. El estado sobrevive a recargar: una sesión finalizada sigue finalizada tras recargar, tanto en la pantalla de puntuación como en la lista, y una sesión reabierta sigue abierta.
9. Las sesiones antiguas sin cambios siguen abiertas, porque `closed: false` ya se guarda desde F1. No hace falta migrar datos.
10. Tests:
    - **Vitest:** `setClosed` en el store (cambio, `updatedAt`, valor sin cambios, sesión inexistente, persistencia).
    - **Vitest:** la vista de puntuación (finalizar con confirmación y cancelación, reabrir, qué se muestra en cada estado) y `SessionCard` (indicador y nombre accesible).
    - **Playwright a 375 px:**
      1. Crear una sesión, anotar una tanda, «Finalizar sesión» → «Cancelar» (sigue abierta) → «Finalizar sesión» → «Finalizar» (candado, sin teclado, celdas sin interacción).
      2. Volver al inicio: la tarjeta muestra «Finalizada».
      3. Recargar: sigue finalizada.
      4. Abrir la tarjeta → «Reabrir sesión»: vuelve el teclado y se puede anotar.
      5. Volver al inicio: sin indicador.
    - Las pruebas e2e existentes que dependan de la pantalla de puntuación o de las tarjetas se adaptan si hace falta. `offline.spec` sigue sin reintentos.
11. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build` terminan sin errores. La cobertura de `src/domain/**` y `src/composables/**` sigue ≥ 90 % de líneas.

## Potential Pitfalls & Open Questions
- **Risk** — Con el teclado oculto, «Finalizar sesión» y «Reabrir sesión» ocupan sitio en la parte de abajo de la pantalla de puntuación. El diseño debe seguir dejando ver la fila activa y no empujar la tabla de forma molesta a 375 px.
- **Edge case** — Al reabrir, la celda que estaba seleccionada antes de finalizar puede no ser la primera vacía. Se usa siempre `firstEmptyCell` para que el comportamiento sea predecible.
- **Edge case** — Si el diálogo de confirmación de finalizar está abierto y la sesión cambia por otra vía (otra pestaña), al confirmar se fija `closed: true` igualmente, porque `setClosed` es idempotente.
- **Risk** — Las fuentes del CI (Linux) son más anchas: el indicador «Finalizada» en la tarjeta no debe desbordar con el peor caso de CU-09.
- **Assumption** — El indicador de la tarjeta es solo informativo. Para reabrir hay que entrar en la sesión; la tarjeta no tiene botones propios, de acuerdo con CU-09 (sin controles anidados).

## Original Description
Descripción redactada por Claude y aprobada por el usuario en la conversación:

Cerrar y reabrir sesión (CU-10). Ya existe por dentro desde F1: si una sesión está cerrada, la app no deja anotar ni borrar, y en lugar del teclado sale el candado «Sesión finalizada — solo lectura». Lo que falta son los botones para cambiar ese estado.

Lo que verás:
- En la pantalla de puntuación, debajo de los botones de borrar, un botón «Finalizar sesión». Al pulsarlo, el teclado y los botones de borrar se cambian por el candado. La tabla, los totales y el promedio siguen visibles, pero no se pueden tocar las celdas.
- Junto al candado, un botón «Reabrir sesión» que devuelve el teclado, con la selección en la primera celda vacía.
- En la lista del inicio, las tarjetas de las sesiones cerradas muestran un candado pequeño y el texto «Finalizada».
- El estado se guarda al instante y se mantiene al recargar.

Por debajo: la acción `setClosed` del store y pruebas unitarias y en el navegador a 375 px.

Fuera: el resumen (CU-08), editar y borrar (CU-11 y CU-12) y la copia de seguridad (CU-15).

## Clarifications
- Q: ¿Pedimos confirmación al finalizar y al reabrir?
  A: Primero se preguntó cómo lo hace el original. En ArcheryReg no hay botones: la sesión se abre y se cierra sola por el horario del turno (`start_at` / `end_at`), con mensajes como «Puntuación bloqueada», «Sesión finalizada — solo lectura» o «Sesión cerrada el…». Decisión para esta app: confirmación solo al finalizar, con el diálogo de la app. Reabrir es inmediato.
- Q: Cuando anotas la última flecha de la sesión, ¿qué pasa?
  A: Nada especial. La sesión sigue abierta hasta que se pulse «Finalizar sesión».
