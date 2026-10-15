# Use Case 04: CU-06 Orden automático

## Summary
Cuarta pieza de F1, construida sobre los casos de uso 01 (CU-03 Anotar flechas), 02 (CU-04 Corregir flecha) y 03 (CU-05 Borrar flecha / borrar tanda). Cuando una tanda queda completa, sus flechas se reordenan automáticamente de mejor a peor zona según el campo `order` de cada zona en la diana de la sesión (nunca según el texto de la clave), tanto al rellenar su última flecha vacía como al corregir una flecha de una tanda ya completa. Las tandas incompletas no se ordenan. Se implementa con la función pura `sortEnd(tanda, diana)` en `src/domain/scoring.ts`, con tests, aplicada dentro de `setArrow` del store `useSessionsStore`. El reordenado es instantáneo, sin animación, y la selección sigue avanzando con `nextCell` desde la posición tocada aunque la flecha corregida cambie de sitio. Incluye tests unitarios y de Playwright. Quedan fuera ordenar tandas incompletas y cualquier opción para desactivar el orden.

## Acceptance Criteria
1. `sortEnd(tanda, diana)` devuelve una nueva tanda con las claves ordenadas por `order` ascendente de su zona en esa diana y los vacíos (`null`) al final; no modifica el array de entrada y es estable para claves iguales.
2. `sortEnd(['7','M','X','10'], wa-40)` devuelve `['X','10','7','M']`; en 3D, `sortEnd(['5','11','M','8'])` devuelve `['11','8','5','M']`; en campo, `sortEnd(['3','X','6'])` devuelve `['X','6','3']`.
3. Al rellenar la última flecha vacía de una tanda, `setArrow` deja la tanda ordenada con `sortEnd` y el resultado ordenado es lo que se guarda en `localStorage`.
4. Al corregir (sobrescribir) una flecha de una tanda ya completa, la tanda se vuelve a ordenar y se guarda ordenada.
5. Las tandas incompletas nunca se reordenan; borrar una flecha de una tanda completa (CU-05) deja la tanda incompleta y sin reordenar.
6. Tras una corrección que reordena la tanda, la selección avanza con `nextCell` desde la posición (fila, flecha) que se tocó, aunque la flecha corregida haya cambiado de posición.
7. El reordenado es instantáneo: no hay animación ni transición, y la siguiente pulsación del teclado responde sin retraso.
8. En una sesión finalizada no se ordena nada (`setArrow` no tiene efecto).
9. Hay tests de Vitest para `sortEnd` y para `setArrow` (completar una tanda, corregir en una tanda completa, modificar una tanda incompleta, sesión cerrada); la cobertura de `src/domain/**` y `src/composables/**` sigue siendo ≥ 90 % de líneas.
10. Un test de Playwright a 375 px anota una tanda desordenada y comprueba el orden final, corrige una flecha y comprueba el nuevo orden, recarga y comprueba que se conserva.
11. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build` terminan sin errores.

## Original Description
Descripción redactada por Claude y aprobada por el usuario en la conversación:

Lo que verás en el móvil:
- Cuando completas una tanda (rellenas su última flecha vacía), sus flechas se reordenan solas de mejor a peor zona. Por ejemplo, `7, M, X` pasa a ser `X, 7, M`.
- El orden sigue la diana, no el texto: en WA 40 va `X, 10, 9 … 1, M`; en 3D va `11, 10, 8, 5, M`.
- Si corriges una flecha de una tanda ya completa, la tanda se vuelve a ordenar.
- Las tandas incompletas no se ordenan: las flechas quedan donde las pusiste mientras anotas.
- La selección sigue avanzando con normalidad después de ordenar. Ordenar no cambia a qué celda vas.

Lo que hay por debajo:
- La función pura `sortEnd(tanda, diana)` en `scoring.ts`, con tests. Incluye el caso del plan: `['7','M','X','10']` → `['X','10','7','M']`.
- `setArrow` del almacén aplica `sortEnd` solo cuando la tanda queda completa, tanto al terminarla como al corregir una flecha de una tanda ya completa.
- Un test de Playwright: anotar una tanda desordenada, ver que se ordena, corregir una flecha y ver que se reordena.

Lo que NO entra: ordenar tandas incompletas, y una opción para desactivar el orden.

## Clarifications
- Q: Corriges una flecha de una tanda completa y la tanda se reordena. ¿Adónde va la selección?
  A: Siguiente posición (`nextCell` desde la celda tocada, aunque la flecha corregida se haya movido).
- Q: ¿Cómo se ve el reordenado?
  A: Instantáneo, sin animación.
