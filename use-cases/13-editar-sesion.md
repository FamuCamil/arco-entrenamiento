# Use Case 13: CU-11 Editar sesión

## Summary
Sexta pieza de F2. Permite **corregir los datos de una sesión ya creada**.

- **Acceso:** un botón «Editar datos» en la pantalla de resumen (CU-08). Abre la ruta `/session/:id/edit`.
- **Formulario:** el mismo de «Nueva sesión» (CU-01/02, `NewSessionView` y `src/domain/sessionForm.ts`), en modo edición y con los valores actuales ya rellenados. Fecha, lugar, distancia (o «Variable»), diana, estructura y notas. **Sin plantillas.**
- **Reglas de la especificación:**
  - Fecha, lugar, distancia y notas se pueden cambiar **siempre**.
  - La **diana** y la **estructura** (series, tandas por serie y flechas por tanda) solo se pueden cambiar **si la sesión no tiene ninguna flecha anotada**. Si hay flechas, esos campos se muestran deshabilitados con una explicación.
- **Sesiones finalizadas:** se pueden editar sus datos. Las flechas siguen bloqueadas y el estado `closed` no cambia.
- **Botones:**
  - «Guardar cambios» valida, guarda y vuelve al resumen.
  - «Cancelar» vuelve al resumen sin cambiar nada.
- **Notas:** se muestran también en la pantalla de resumen cuando no están vacías.

**Por debajo:**
- La acción `updateSession(id, patch)` del store, que el brief ya prevé. Actualiza `updatedAt` y protege la diana y la estructura cuando hay flechas.
- Funciones de dominio para pasar de sesión a formulario.
- Pruebas unitarias y en el navegador a 375 px.

En ArcheryReg no existe, porque los datos los pone la organización.

**Fuera de alcance:**
- Borrar la sesión (CU-12).
- Editar flechas (eso ya se hace en la pantalla de anotar).
- Arqueros: añadir, quitar o renombrar.
- Plantillas en modo edición.
- Cambiar `closed` desde el formulario.

## Acceptance Criteria
1. **Acceso.**
   - La pantalla de resumen tiene un enlace o botón «Editar datos» (`data-testid` propio, ≥ 48 px) que lleva a `/session/:id/edit` (ruta con nombre `edit-session`, carga diferida).
   - Aparece con la sesión abierta y también con la finalizada.
   - El resumen sigue cabiendo a 375 px, también en el peor caso de CU-08.
2. **Formulario pre-rellenado.** La pantalla de edición, con el título «Editar sesión», muestra los valores actuales:
   - fecha;
   - lugar;
   - distancia, o «Variable» marcado si es 0;
   - diana;
   - series, tandas y flechas;
   - notas.

   No muestra los botones de plantillas. Reutiliza los campos, las etiquetas, los límites (`SESSION_LIMITS`) y la validación de `NewSessionView` / `sessionForm.ts` sin duplicar reglas. Puede ser un componente de formulario compartido o un modo de la misma vista; lo decide el plan.
3. **Bloqueo por flechas.** Si algún arquero de la sesión tiene al menos una flecha anotada (cualquier celda no nula):
   - los campos de diana, series, tandas y flechas por tanda están deshabilitados;
   - se muestra el texto «La diana y la estructura no se pueden cambiar porque la sesión ya tiene flechas anotadas.», asociado a esos campos con `aria-describedby`.

   Si no hay ninguna flecha, se pueden cambiar.
4. **Guardar.**
   - «Guardar cambios» valida con las mismas reglas que al crear. Los errores se muestran igual que en «Nueva sesión» y no se guarda nada mientras haya errores.
   - Si es válido, llama a `updateSession`, guarda (persistencia existente) y vuelve al resumen de la sesión.
   - El resumen muestra los datos nuevos, y la lista del inicio también.
5. **`updateSession(id, patch)` en el store.**
   - Aplica `date`, `location` (recortado), `distance`, `notes` y, si no hay flechas, `faceId`, `seriesCount`, `endsPerSeries` y `arrowsPerEnd`.
   - Si cambia la estructura sin flechas, las tandas de cada arquero se regeneran vacías con el nuevo tamaño.
   - Si hay flechas y el patch intenta cambiar la diana o la estructura, esos campos se ignoran o la acción falla sin modificar nada; lo decide el plan y se testea. Nunca se descuadran las tandas existentes.
   - Actualiza `updatedAt` solo si algo cambia de verdad.
   - No toca `id`, `createdAt`, `closed` ni las flechas.
   - Una sesión inexistente no hace nada.
6. **Sesión finalizada.** Se puede editar y guardar. Sigue `closed: true` después de guardar, y la pantalla de anotar sigue en solo lectura.
7. **Cancelar.** «Cancelar» vuelve al resumen sin guardar nada. Atrás del navegador hace lo mismo. No se pregunta si hay cambios sin guardar; se deja así a propósito por simplicidad.
8. **Sesión inexistente.** `/session/<id-desconocido>/edit` muestra un mensaje claro en español y un enlace al inicio, sin errores en consola.
9. **Notas en el resumen.** Si la sesión tiene notas, que no estén vacías tras recortar, el resumen las muestra en un bloque «Notas» que conserva los saltos de línea y se ajusta a 375 px. Si no hay notas, el bloque no aparece.
10. **Accesibilidad y ajuste.**
    - Los campos tienen etiquetas.
    - Los botones miden ≥ 48 px.
    - Al entrar, el foco va al título o al primer campo.
    - La pantalla cabe a 375 px sin scroll horizontal, en tema claro y oscuro.
11. **Tests.**
    - **Vitest:** `updateSession`, en todos los casos de AC5 y AC6; las funciones de sesión a formulario; la vista de edición (pre-relleno, bloqueo con y sin flechas, guardar, errores, cancelar, sesión inexistente); el enlace «Editar datos» y el bloque de notas del resumen.
    - **Playwright a 375 px:**
      1. Crear una sesión sin flechas, ir a «Resumen» y luego a «Editar datos», y cambiar la fecha, el lugar, las notas y las flechas por tanda. Guardar: el resumen muestra los datos nuevos y la pantalla de anotar tiene el nuevo número de flechas.
      2. Anotar una flecha y volver a «Editar»: la estructura y la diana están bloqueadas, el lugar se puede cambiar y se guarda.
      3. Finalizar, ir a «Editar» y cambiar las notas: se guarda y sigue finalizada.
      4. «Cancelar» no cambia nada.
      5. Ajuste a 375 px.
    - Las pruebas e2e existentes se adaptan si hace falta. `offline.spec` sigue sin reintentos y con sus guardas de consola.
12. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build` terminan sin errores. La cobertura de `src/domain/**` y `src/composables/**` sigue ≥ 90 % de líneas.

## Potential Pitfalls & Open Questions
- **Riesgo:** cambiar la estructura con flechas descuadraría `ends`, que debe medir `series × tandas` y cada tanda `flechas`. El store debe protegerlo aunque la vista ya deshabilite los campos (defensa en profundidad).
- **Riesgo:** reutilizar `NewSessionView` sin romper CU-01/02. Las pruebas existentes de nueva sesión deben seguir pasando sin cambios de comportamiento.
- **Caso límite:** una sesión antigua cuyos valores superan `SESSION_LIMITS`, porque los límites solo aplican al formulario. Con flechas, los campos bloqueados no se validan contra los límites, para no impedir guardar el lugar o las notas. Sin flechas, sí se validan. El plan lo confirma.
- **Caso límite:** una diana desconocida en el catálogo, en datos antiguos o editados a mano. El formulario debe mostrarla de forma segura y no romperse.
- **Caso límite:** al guardar sin cambios reales, no se actualiza `updatedAt`. Así la fusión de la copia de seguridad (CU-15) no considera más nueva una sesión que no ha cambiado.
- **Supuesto:** la vista vuelve al resumen con `router.push` o `replace`; el plan decide para que Atrás tenga sentido.
- **Supuesto:** la estructura con flechas no se puede cambiar. Si el usuario quiere otra estructura, crea una sesión nueva.

## Original Description
Descripción redactada por Claude y aprobada por el usuario en la conversación:

Editar sesión (CU-11). Sirve para corregir los datos de una sesión ya creada: una fecha mal puesta, añadir el lugar o apuntar notas.

Según la especificación, la fecha, el lugar, la distancia y las notas se pueden cambiar siempre. La diana y la estructura (series, tandas y flechas) solo si aún no hay ninguna flecha anotada, para que nunca se descuadren puntuaciones ya hechas. Si ya hay flechas, esos campos se ven bloqueados con una explicación.

Lo que verás: un formulario con los datos actuales, como el de «Nueva sesión», con «Guardar cambios» y «Cancelar». Las notas también aparecen en el resumen.

Fuera: borrar la sesión (CU-12), editar flechas y varios arqueros.

## Clarifications
- Q: ¿Desde dónde se abre «Editar»?
  A: Desde el resumen, con un botón «Editar datos». La pantalla de anotar no cambia.
- Q: Si la sesión está finalizada, ¿se pueden editar sus datos?
  A: Sí. Fecha, lugar, distancia y notas se pueden corregir aunque esté finalizada, y las flechas siguen bloqueadas.
