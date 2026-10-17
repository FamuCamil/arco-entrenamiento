# Use Case 08: CU-01 + CU-02 Crear sesión (plantilla o personalizada)

## Summary
Primera pieza de F2. Junta CU-01 (crear una sesión desde una plantilla) y CU-02 (crear una sesión personalizada), porque los dos usan el mismo formulario. Sustituye al botón provisional «Sesión de prueba».

**Pantalla de inicio**
- Un botón «Nueva sesión» lleva a la nueva ruta `/new` (`NewSessionView`).
- Debajo, una **lista provisional** de las sesiones guardadas, de la más reciente a la más antigua. Cada fila muestra la fecha y el lugar, o «Sin lugar». Al tocar una fila se abre la pantalla de puntuación de esa sesión.
- CU-09 sustituirá esta lista por las tarjetas completas.

**Pantalla de nueva sesión**
- Es una sola pantalla. Arriba están las plantillas del catálogo (`SESSION_TEMPLATES`) como botones. Debajo, el formulario:
  - fecha, por defecto la de hoy en hora local;
  - lugar, opcional;
  - distancia en metros, que en campo y 3D es «Variable»;
  - diana, una de las 8 del catálogo, mostrada por su nombre;
  - series, tandas por serie y flechas por tanda;
  - notas, opcionales.
- **Plantillas:** al tocar una, el formulario se rellena con su distancia, su diana y su estructura. Todo sigue siendo editable. «Personalizada» deja elegir libremente:
  - series ≥ 1;
  - tandas por serie ≥ 1;
  - de 1 a 12 flechas por tanda;
  - cualquier diana.
- **Crear:** al pulsar «Crear» se guarda la sesión con `createSession` del store y se abre directamente la pantalla de puntuación, con la primera flecha seleccionada.

**Por debajo**
- La validación vive en funciones puras con tests.
- Hay una prueba de Playwright a 375 px.

**Fuera de alcance**
- Las tarjetas completas de la lista (CU-09).
- El dibujo de cada diana (`TargetIcon`, llega con CU-09).
- Editar o borrar sesiones (CU-11 y CU-12).
- Cerrar y reabrir sesiones (CU-10).
- El nombre del arquero, que sigue siendo «Yo» (CU-21).

## Acceptance Criteria
1. La pantalla de inicio ya no muestra el botón «Sesión de prueba». Se eliminan su código y su `TODO(CU-01)`. Muestra un botón «Nueva sesión» que navega a `/new`.
2. La pantalla de inicio muestra una lista provisional de todas las sesiones guardadas, ordenadas de la más reciente a la más antigua por fecha y, a igual fecha, por `createdAt` descendente.
   - Cada fila muestra la fecha y el lugar, o «Sin lugar» si está vacío.
   - Al tocar una fila se navega a `/session/:id/score/:archerId` con el primer arquero.
   - Sin sesiones, se ve el texto vacío actual («Todavía no hay sesiones de entrenamiento.»).
   - El código lleva un `TODO(CU-09)` que marca la lista como provisional.
3. En `/new` se muestran como botones todas las plantillas de `SESSION_TEMPLATES`, con su etiqueta en español e incluida «Personalizada». La plantilla seleccionada se distingue visualmente y se anuncia con `aria-pressed`.
4. Al entrar en `/new` está preseleccionada «Sala 18 m» con sus valores: 18 m, WA 40, 2 × 10 × 3. La fecha es la de hoy en hora local (`localIsoDate`), y el lugar y las notas están vacíos.
5. Al tocar una plantilla con valores (`preset` no nulo), se sobrescriben la distancia, la diana, las series, las tandas por serie y las flechas por tanda con los de la plantilla. La fecha, el lugar y las notas que ya hubiera escrito el usuario se conservan.
6. Al tocar «Personalizada» se conservan los valores actuales del formulario y todos los campos quedan editables. Si el usuario edita un campo de estructura o la diana después de elegir otra plantilla, la edición se respeta: la plantilla no se vuelve a aplicar sola.
7. El campo de diana permite elegir cualquiera de las 8 dianas del catálogo (`targetFaces`), mostrada por su nombre en español.
8. La distancia es un número entero de metros. El valor 0 significa «Variable» y se presenta así en la interfaz, que es lo que ponen las plantillas Campo y 3D. El usuario puede elegir «Variable» o escribir una distancia.
9. La validación es una función pura de dominio con tests de Vitest:
   - fecha válida (`YYYY-MM-DD`);
   - distancia entera ≥ 0;
   - series y tandas por serie enteras ≥ 1, con el límite superior razonable que fije el plan (ver Pitfalls);
   - flechas por tanda enteras entre 1 y 12;
   - diana existente en el catálogo.

   El lugar y las notas son opcionales. Se guardan sin espacios sobrantes al principio ni al final.
10. Si algún valor no es válido, el botón «Crear» está deshabilitado y el campo muestra un mensaje en español junto a él, por ejemplo «Entre 1 y 12 flechas». El mensaje está asociado al campo con `aria-describedby`.
11. Al pulsar «Crear» se llama una sola vez a `createSession` con los valores del formulario y se navega a la pantalla de puntuación de la sesión nueva. Allí la primera celda está seleccionada y la estructura y la diana coinciden con lo elegido. La sesión persiste tras recargar.
12. Desde `/new` se puede volver al inicio sin crear nada, con un enlace o botón «Cancelar» o «Volver».
13. Todos los controles tienen etiqueta visible y una zona táctil de al menos 48 px de alto, y caben a 375 px sin scroll horizontal. El formulario usa controles nativos (`input type="date"`, `select`, `input inputmode="numeric"`) para que en iPhone salga el teclado o selector adecuado.
14. Las sesiones ya guardadas, incluida la antigua «Sesión de prueba», siguen abriéndose y apareciendo en la lista provisional. No hace falta ninguna migración de datos.
15. Tests:
    - **Vitest:** la validación y las reglas de aplicar plantilla (AC 5 y 6), y las vistas nuevas o modificadas.
    - **Playwright a 375 px, crear desde plantilla:** se crea «Aire libre 70 m», se comprueba que la pantalla de puntuación tiene 6 flechas por tanda y el teclado de WA 122, se anota una flecha, se vuelve al inicio y se reabre la sesión desde la lista.
    - **Playwright a 375 px, crear personalizada:** 1 serie × 2 tandas × 12 flechas en diana de campo.
    - **Playwright a 375 px, validación:** con 13 flechas, «Crear» está deshabilitado y aparece el mensaje.
    - Los e2e que usaban «Sesión de prueba» se adaptan al flujo nuevo.
16. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build` terminan sin errores. La cobertura de `src/domain/**` y `src/composables/**` sigue ≥ 90 % de líneas.

## Potential Pitfalls & Open Questions
- **Assumption** — Límites superiores de series y tandas: la especificación solo pide ≥ 1. Un error de tecleo, como 100 × 100, crearía una matriz enorme y una tabla inmanejable. El plan fija un máximo razonable, del orden de 20 series y 30 tandas por serie, y lo documenta.
- **Edge case** — La fecha por defecto debe ser la local, no la UTC, para no saltar de día por la noche. Ya existe `localIsoDate`.
- **Edge case** — En iPhone, `input type="number"` acepta texto y valores vacíos. La validación debe tratar el vacío como inválido, no como 0, salvo la distancia «Variable».
- **Risk** — La lista provisional del inicio solo es un puente hasta CU-09. Hay que mantenerla mínima para no adelantar trabajo de CU-09.
- **Risk** — Varias pruebas e2e existentes (`scoring.spec.ts` y `offline.spec.ts`) dependen del botón «Sesión de prueba» o de su sesión. Hay que adaptarlas sin perder lo que verifican. Lo más sencillo es sembrar los datos o usar el flujo nuevo.
- **Assumption** — La plantilla elegida no se guarda en la sesión, porque `Session` no tiene `templateId`. Es solo un punto de partida para el formulario.

## Original Description
Descripción redactada por Claude y aprobada por el usuario en la conversación:

Crear sesión desde plantilla (CU-01) y personalizada (CU-02), en un solo caso de uso porque usan el mismo formulario.

Lo que verás en el móvil:
- Desaparece el botón «Sesión de prueba» y aparece **«Nueva sesión»**.
- Se abre una pantalla con dos partes:
  1. **Plantillas** arriba: Sala 18 m, Sala 18 m triple, Sala 25 m, Aire libre 70 m, Aire libre 50 m compuesto, Aire libre 30 m, Campo, 3D y Personalizada.
  2. **Formulario** debajo, que se rellena solo al tocar una plantilla: fecha (hoy), lugar, distancia en metros («Variable» en campo/3D), diana (cualquiera de las 8 del catálogo), series, tandas por serie, flechas por tanda y notas opcionales.
- Todo se puede cambiar antes de crear.
- Con «Personalizada» eliges tú los valores: al menos 1 serie y 1 tanda, y de 1 a 12 flechas.
- Si algo no es válido, el botón «Crear» no se activa y el campo te dice qué pasa.

Por debajo: la ruta `/new`, la validación en funciones puras con pruebas, `createSession` del store y una prueba de Playwright a 375 px.

Fuera: la lista de sesiones con tarjetas (CU-09), editar o borrar (CU-11 y CU-12) y el dibujo de cada diana.

## Clarifications
- Q: Hasta que llegue la lista de sesiones (CU-09), ¿cómo se vuelve a una sesión desde el inicio?
  A: Con una lista sencilla provisional (fecha y lugar) debajo de «Nueva sesión». CU-09 la sustituye por las tarjetas completas.
- Q: Al pulsar «Crear», ¿adónde vas?
  A: Directo a anotar: se abre la pantalla de puntuación con la primera flecha seleccionada.
- Q: ¿El lugar es obligatorio?
  A: Opcional. En ArcheryReg el lugar siempre viene relleno por la competición (no hay creación de sesiones), así que no hay referencia. Si está vacío se muestra «Sin lugar» y se podrá rellenar después (CU-11).
- Q: ¿Cómo es la pantalla de nueva sesión?
  A: Una sola pantalla: plantillas arriba como botones y el formulario debajo.
