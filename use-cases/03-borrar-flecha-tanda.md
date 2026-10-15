# Use Case 03: CU-05 Borrar flecha / borrar tanda

## Summary
Tercera pieza de F1, construida sobre los casos de uso 01 (CU-03 Anotar flechas) y 02 (CU-04 Corregir flecha). Añade dos acciones bajo el teclado de la pantalla de puntuación: «Borrar flecha», que vacía la celda seleccionada y deja la selección en ella para anotar el valor correcto, y «Borrar tanda», que, tras confirmación en un diálogo propio de la app, vacía todas las flechas de la tanda de la celda seleccionada y lleva la selección a su primera flecha. Por debajo añade la acción `deleteEnd` al store `useSessionsStore` (borrar una flecha usa `setArrow` con `null`), `deleteArrow()` y `deleteEnd()` a `useScoring`, y los componentes `ScoreActions.vue` y `ConfirmDialog.vue` con el composable `useConfirm`, un diálogo accesible y reutilizable (lo usará CU-12 para eliminar sesiones). Los botones se desactivan cuando no hay nada que borrar y no se muestran si la sesión está finalizada. Incluye tests unitarios y de Playwright. Quedan fuera eliminar sesiones (CU-12) y deshacer.

## Acceptance Criteria
1. «Borrar flecha» vacía la celda seleccionada, el cambio se guarda al instante y la selección permanece en esa misma celda.
2. «Borrar tanda» abre un diálogo de confirmación propio de la app (nunca `window.confirm`); al confirmar, vacía todas las flechas de la tanda de la celda seleccionada, guarda al instante y selecciona la primera flecha de esa tanda; al cancelar, no cambia nada (ni valores ni selección).
3. El diálogo tiene `role="dialog"` y `aria-modal="true"`, un título y texto en español, botones «Cancelar» y «Borrar», mantiene el foco dentro mientras está abierto, lo devuelve al botón que lo abrió al cerrarse, se cancela con Escape y se usa cómodamente con una mano a 375 px.
4. `ConfirmDialog.vue` + `useConfirm` son genéricos: `useConfirm` devuelve una promesa que resuelve `true`/`false` y acepta título, mensaje y texto del botón de confirmación, para poder reutilizarse en CU-12.
5. «Borrar flecha» está desactivado si la celda seleccionada está vacía; «Borrar tanda» está desactivado si toda la tanda de la celda seleccionada está vacía.
6. En una sesión finalizada (`closed: true`) los botones no se muestran, y `deleteEnd` / `setArrow` del store no modifican nada.
7. Los botones miden al menos 48×48 px, tienen texto visible en español, `aria-label` y foco visible.
8. Lo borrado sigue borrado tras recargar la página.
9. Hay tests de Vitest para `deleteEnd` del store y para `deleteArrow` / `deleteEnd` de `useScoring` (incluidos los casos con sesión cerrada y la posición de la selección resultante); la cobertura de `src/domain/**` y `src/composables/**` sigue siendo ≥ 90 % de líneas.
10. Un test de Playwright a 375 px borra una flecha, intenta borrar una tanda cancelando y luego confirmando, recarga y comprueba el estado final.
11. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build` terminan sin errores.

## Potential Pitfalls & Open Questions
- **Assumption** — Borrar una flecha de una tanda completa ya ordenada (CU-06) no reordena nada: la tanda queda incompleta con el hueco en la posición borrada.

## Original Description
Descripción redactada por Claude y aprobada por el usuario en la conversación:

Lo que verás en el móvil:
- Dos botones debajo del teclado:
  - «Borrar flecha»: vacía la celda seleccionada. La selección se queda en esa celda, para que puedas anotar el valor correcto.
  - «Borrar tanda»: vacía todas las flechas de la tanda de la celda seleccionada y vuelve a su primera flecha.
- «Borrar tanda» pide confirmación con un diálogo propio de la app, no con la ventana del navegador, porque borra varias flechas a la vez. «Borrar flecha» no pide confirmación: es una sola flecha y se rehace con una pulsación.
- Los botones se desactivan cuando no hay nada que borrar (celda o tanda vacía) y no aparecen si la sesión está finalizada.
- Mismo tamaño mínimo (48 px), `aria-label` y foco visible que el resto.

Lo que hay por debajo:
- La acción `deleteEnd` del almacén de sesiones. Borrar una flecha usa `setArrow` con valor vacío.
- `deleteArrow()` y `deleteEnd()` en `useScoring`.
- Los componentes `ScoreActions.vue` (los dos botones) y `ConfirmDialog.vue` con `useConfirm`. El diálogo se reutilizará después para eliminar sesiones (CU-12).
- Tests unitarios y un test de Playwright: borrar una flecha, borrar una tanda confirmando y cancelando, recargar y comprobar.

Lo que NO entra: eliminar sesiones enteras (CU-12, en F2); deshacer lo borrado.

## Clarifications
- Q: ¿«Borrar tanda» pide confirmación?
  A: Sí, con diálogo propio de la app.
- Q: Después de «Borrar flecha», ¿dónde queda la selección?
  A: En la misma celda.
