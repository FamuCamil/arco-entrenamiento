# Use Case 14: CU-12 Borrar sesión

## Summary
Última pieza de F2. Permite **eliminar una sesión** con todas sus flechas.

- **Acceso:** en la pantalla «Editar sesión» (CU-11, `EditSessionView`), al final del formulario y separado de «Guardar cambios» / «Cancelar», hay un botón **«Borrar sesión»** con estilo de peligro.
- **Confirmación:** al pulsarlo se abre el diálogo de confirmación de la app (`useConfirm` / `ConfirmDialog`), con estilo de peligro (`danger: true`) y nunca `window.confirm`:
  - título «¿Borrar la sesión?»;
  - mensaje con la fecha de la sesión, por ejemplo «Se eliminarán la sesión del 17/10/2026 y todas sus flechas. No se puede deshacer.»;
  - botones «Borrar» y «Cancelar».
- **Al confirmar:** la sesión se elimina del store, se persiste y la app va al inicio. La tarjeta ya no aparece.
- **Al cancelar:** no cambia nada.
- Las sesiones finalizadas también se pueden borrar.
- No hay «Deshacer», por decisión del usuario. La única forma de recuperarla es importar una copia de seguridad (CU-15).

**Por debajo:** la acción `deleteSession(id)` del store, que el brief ya prevé, y pruebas unitarias y en el navegador a 375 px.

**Fuera de alcance:**
- Borrar varias sesiones a la vez.
- Papelera o «Deshacer».
- Borrar desde la lista, el resumen o la pantalla de anotar.
- Borrar arqueros.

## Acceptance Criteria
1. **`deleteSession(id)` en el store.**
   - Elimina la sesión con ese `id` de `sessions`.
   - Una sesión inexistente no hace nada.
   - El resto de sesiones no cambia.
   - El cambio se persiste con el mecanismo existente.
2. **Botón «Borrar sesión».**
   - Está en `EditSessionView`, al final, separado visualmente de las acciones del formulario, por ejemplo en su propia sección.
   - Tiene estilo de peligro (`--color-danger`), mide al menos 48 px de alto, tiene `data-testid` propio y `type="button"`, así que no envía el formulario.
   - Aparece con la sesión abierta y también con la finalizada, y cabe a 375 px.
   - No aparece en la pantalla de «Nueva sesión».
3. **Confirmación.**
   - Al pulsarlo se abre el diálogo de la app con `danger: true`, título «¿Borrar la sesión?», un mensaje con la fecha de la sesión en formato «DD/MM/AAAA» y que advierte de que no se puede deshacer, y los botones «Borrar» y «Cancelar».
   - Nunca se llama a `window.confirm`.
   - Al cancelar, o con Escape, no cambia nada, se sigue en la pantalla de edición y el foco vuelve al botón.
4. **Borrar.**
   - Al confirmar, se llama a `deleteSession` y se navega al inicio con `router.replace`, para que Atrás no vuelva a una sesión borrada.
   - La tarjeta desaparece y, si era la única, se ve el texto vacío.
   - Tras recargar, la sesión sigue sin estar.
   - Los cambios sin guardar del formulario se descartan; no se guardan antes de borrar.
5. **Rutas de una sesión borrada.** Abrir después `/session/<id>/score/...`, `/summary` o `/edit` de la sesión borrada muestra los mensajes de «no encontrada» que ya existen, sin errores en consola.
6. **Copia de seguridad.** Exportar después de borrar ya no incluye la sesión. Importar una copia antigua que la contenga la vuelve a añadir como «nueva», con la fusión existente de CU-15. No se cambia la lógica de la copia de seguridad.
7. **Tests.**
   - **Vitest:** `deleteSession` (borra, inexistente sin efecto, persistencia, resto intacto); la vista de edición (botón presente en sesión abierta y finalizada, diálogo con los textos exactos y estilo de peligro, cancelar y Escape sin cambios y con el foco de vuelta, confirmar borra y navega con `replace`).
    - **Playwright a 375 px:**
      1. Crear dos sesiones.
      2. En una: Resumen → «Editar datos» → «Borrar sesión» → «Cancelar». Sigue existiendo.
      3. «Borrar sesión» → «Borrar». Inicio con una sola tarjeta.
      4. Recargar: sigue una.
      5. Atrás no lleva a la sesión borrada, o si llega muestra «no encontrada».
      6. Comprobar el ajuste del botón a 375 px.
    - Las pruebas existentes se adaptan si hace falta. `offline.spec` sigue sin reintentos y con sus guardas de consola.
8. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build` terminan sin errores. La cobertura de `src/domain/**` y `src/composables/**` sigue ≥ 90 % de líneas.

## Potential Pitfalls & Open Questions
- **Riesgo:** al borrar mientras `EditSessionView` está montada, sus `computed` pasan a `undefined` antes de navegar. No debe mostrarse un parpadeo de «No se encontró la sesión.» ni haber errores. El orden entre navegar y borrar lo decide el plan.
- **Riesgo:** el `returnFocusTo` de `useConfirm` apunta al botón, que desaparece al navegar. Ya existe la comprobación `isConnected` de CU-10/CU-08. Al llegar al inicio, el foco debe quedar en un sitio lógico.
- **Caso límite:** pulsar «Borrar» dos veces muy rápido no debe dar errores.
- **Caso límite:** el formulario tiene cambios sin guardar y está en estado inválido. «Borrar sesión» sigue funcionando, porque no depende de la validación.
- **Supuesto:** el historial del navegador puede tener entradas viejas de la sesión borrada (anotar, resumen). Si el usuario vuelve atrás hasta ellas, se muestran las pantallas de «no encontrada» que ya existen. No se reescribe el historial.

## Original Description
Descripción redactada por Claude y aprobada por el usuario en la conversación:

Borrar sesión (CU-12). Sirve para eliminar una sesión que no quieres guardar: una de prueba, una duplicada o una creada por error.

Según la especificación, se pide confirmación con el diálogo propio de la app, el de «Borrar tanda», en rojo porque es destructivo. Nunca se usa la ventana del navegador.

Lo que verás: un botón rojo «Borrar sesión» y un diálogo «¿Borrar la sesión? Se eliminarán la sesión del 17/10/2026 y todas sus flechas. No se puede deshacer.» con «Borrar» y «Cancelar». Al borrar vuelves al inicio y la tarjeta ya no aparece.

Por debajo: la acción `deleteSession(id)` del store y las pruebas.

Fuera: borrar varias a la vez, una papelera y recuperar sesiones borradas (salvo importando una copia de seguridad).

## Clarifications
- Q: ¿Dónde va el botón «Borrar sesión»?
  A: En la pantalla de editar, al final del formulario y separado de «Guardar».
- Q: Tras borrar, ¿quieres poder deshacerlo un momento?
  A: No. Solo la confirmación, como dice la especificación.
