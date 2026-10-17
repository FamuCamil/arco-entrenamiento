# Use Case 12: CU-08 Resumen de la sesión

## Summary
Quinta pieza de F2. Una pantalla de **resumen de solo lectura** para ver el resultado de una sesión de un vistazo, sin el teclado. Ruta `/session/:id/summary`, con `?archer=<id>` opcional según el brief y por defecto el primer arquero. La vista es `SummaryView` y la tabla `SummaryTable`.

**Lo que verás**
- **Cabecera:** fecha («DD/MM/AAAA»), lugar o «Sin lugar», distancia o «Variable», nombre de la diana y el arquero.
- **Tabla al estilo de ArcheryReg:**
  - un bloque por serie y una fila por tanda, con el número de tanda, el total de la tanda y el acumulado de la serie;
  - **dos columnas de desempate**, que cuentan las flechas en las dos mejores zonas numéricas de la diana (en WA, «10» con la X sumada y «9»);
  - una fila «Total Serie n» por serie con su total frente al máximo y los conteos;
  - una fila «TOTAL GENERAL» con el total frente al máximo y los conteos.
- **Pie:** la media por flecha, igual que en la pantalla de anotar, y el **reparto por zonas** (cuántas flechas en cada zona: X, 10, 9 … M, con los colores de cada zona).

**Cómo se llega**
- **Desde anotar:** un botón «Resumen» en la pantalla de anotar, con la sesión abierta o finalizada.
- **Al finalizar:** al confirmar «Finalizar» en el diálogo de CU-10, la app lleva directamente al resumen.
- **Desde el resumen:** un botón para volver a la pantalla de anotar («Ver tabla» o «Volver a anotar»; el plan decide la etiqueta según el estado) y otro para volver al inicio.
- **Inicio:** las tarjetas del inicio no cambian y siguen abriendo la pantalla de anotar.

**Por debajo**
- Las funciones de dominio puras calculan los conteos de desempate y el reparto por zonas, siempre a partir de los `points` de cada zona y nunca con `parseInt` ni X=10 fijo.
- Los totales salen de las funciones existentes (`useSessionStats` / `scoring.ts`), así que coinciden siempre con la pantalla de anotar.

**Fuera de alcance**
- Las estadísticas entre sesiones y las gráficas (F3).
- La vista de «toda la diana» con varios arqueros (hoy cada sesión tiene uno).
- Editar (CU-11), borrar (CU-12) y exportar el resumen.

## Acceptance Criteria
1. **Ruta.** Existe la ruta `/session/:id/summary` (nombre `summary`), con carga diferida como las demás. Acepta `?archer=<archerId>` y sin él usa el primer arquero. Una sesión o un arquero inexistentes muestran un mensaje claro en español y un enlace al inicio, sin errores en consola.
2. **Cabecera.**
   - La fecha con `formatDisplayDate`.
   - El lugar recortado, o «Sin lugar».
   - La distancia («18 m», o «Variable» cuando es 0).
   - El nombre de la diana del catálogo.
   - El arquero («A - Nombre», como en anotar).
   - Si la sesión está finalizada, el indicador «Finalizada» con el candado (`LockIcon`), igual que en la tarjeta.
3. **Tabla por serie.**
   - Cada tanda muestra su número, el total de la tanda y el acumulado de la serie, con los mismos valores que la pantalla de anotar.
   - Las tandas sin empezar se muestran vacías, con la misma regla que `useSessionStats` (AC7 del caso de uso 05).
   - Cada serie termina con «Total Serie n: X/máx» y la tabla con «TOTAL GENERAL: X/máx». Los valores coinciden exactamente con los de anotar.
4. **Columnas de desempate.**
   - Dos columnas cuyos encabezados son las dos mejores puntuaciones numéricas distintas de la diana. Para WA son «10» y «9»; para campo y 3D, las dos más altas según el catálogo (`points`).
   - Una zona con los mismos `points` que la columna se cuenta en ella. La X que vale 10 se cuenta en «10».
   - La M (0 puntos) nunca es columna.
   - Hay conteos por tanda, por serie y en el total general.
   - Si una diana tiene menos de dos puntuaciones positivas distintas, solo se muestran las que haya. El caso queda cubierto por un test.
5. **Reparto por zonas.** Debajo de la tabla, el número de flechas de cada zona de la diana en el orden del catálogo (X, 10, 9 … M), con el color de la zona (`bg`/`fg`). Las zonas con 0 flechas también aparecen. La suma del reparto es igual al número de flechas tiradas. El dato se calcula con una función de dominio pura.
6. **Media por flecha.** Se muestra con el mismo formato y valor que en la pantalla de anotar («Promedio 9.03», o «—» sin flechas).
7. **Botón «Resumen» en anotar.**
   - Lleva al resumen del arquero actual, tanto con la sesión abierta como con la finalizada.
   - Mide al menos 48 px de alto.
   - Cabe a 375 px sin empujar fuera de pantalla el teclado ni «Finalizar sesión». Las pruebas de ajuste existentes de la pantalla de anotar siguen pasando, también con las fuentes del CI.
8. **Ir al resumen al finalizar.**
   - Al confirmar «Finalizar» en el diálogo de CU-10, la sesión pasa a `closed: true` y se navega al resumen.
   - Al cancelar, todo sigue como en CU-10.
   - Las pruebas de CU-10 que esperaban el foco en «Reabrir sesión» tras finalizar se adaptan a propósito: ahora se comprueba la navegación y un foco lógico en el resumen, por ejemplo el encabezado.
9. **Navegación desde el resumen.**
   - Un botón o enlace vuelve a la pantalla de anotar del mismo arquero.
   - Otro vuelve al inicio.
   - Los dos miden al menos 48 px de alto.
   - Con la sesión finalizada, la pantalla de anotar abre en solo lectura con «Reabrir sesión», como en CU-10.
10. **Solo lectura y accesibilidad.**
    - El resumen no tiene controles que cambien datos.
    - La tabla es una `<table>` semántica con encabezados (`th`, `scope`) y un título o `aria-label`.
    - Los conteos tienen un nombre accesible claro, por ejemplo «Flechas de 10».
    - Funciona en los temas claro y oscuro.
11. **Ajuste a 375 px.**
    - Sin scroll horizontal de la página en el peor caso: 12 flechas por tanda, totales de 4 cifras, diana 3D y un lugar largo.
    - La tabla del resumen no muestra las flechas una a una, como el original, y por eso cabe.
    - El reparto por zonas se ajusta en varias líneas si hace falta.
12. **Tests.**
    - **Vitest:** las funciones de desempate y reparto en WA 40 (X=10), WA reducida, campo (X=6) y 3D (11), con dianas vacías, parciales y llenas; `SummaryTable` o `SummaryView` (cabecera, filas, totales, conteos, «Finalizada», arquero inexistente); el botón «Resumen» de anotar y la navegación al finalizar.
    - **Playwright a 375 px:**
      1. Crear una sesión y anotar dos tandas con X, 10 y 9.
      2. Pulsar «Resumen»: los totales coinciden con «TOTAL GENERAL» de anotar, y los conteos y el reparto son correctos.
      3. Volver a anotar, pulsar «Finalizar sesión» y luego «Finalizar»: se abre el resumen con «Finalizada».
      4. Volver a anotar: solo lectura.
      5. Comprobar el ajuste en el peor caso.
    - Las pruebas e2e existentes que dependan del foco tras finalizar se adaptan. `offline.spec` sigue sin reintentos y con sus guardas de consola.
13. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build` terminan sin errores. La cobertura de `src/domain/**` y `src/composables/**` sigue ≥ 90 % de líneas.

## Potential Pitfalls & Open Questions
- **Risk** — El original calcula con `parseInt(zone_key)` y X=10 fijo. Aquí todo debe salir de los `points` de cada zona, porque en campo la X vale 6 y en 3D hay un 11. El encabezado de cada columna de desempate debe mostrar el valor en puntos y no la clave de la zona.
- **Risk** — Añadir «Resumen» a la pantalla de anotar le quita altura al teclado a 375×740, y las fuentes del CI son más anchas. Conviene ponerlo en la cabecera, junto al nombre del arquero, y no como otra fila completa. Se confirma con la prueba de ajuste extendida.
- **Edge case** — En las dianas 3D, varias zonas pueden compartir puntos. Las columnas son por valor de puntos, no por zona.
- **Edge case** — Una sesión sin flechas muestra la tabla con las tandas vacías, «0/máx», los conteos a 0, «Promedio —» y el reparto a 0, sin errores.
- **Edge case** — Al navegar al resumen tras finalizar, el `returnFocusTo` de `useConfirm` apunta a un botón que ya no existe. El foco tiene que gestionarlo la vista de destino.
- **Assumption** — Hay un solo arquero por sesión, así que la vista de «toda la diana» no se hace. La ruta acepta `?archer=` para cuando haya varios.
- **Assumption** — Con la tecla atrás del navegador desde el resumen se vuelve a anotar, porque se usa `router.push`, sin trucos de historial.

## Original Description
Descripción redactada por Claude y aprobada por el usuario en la conversación:

Resumen de la sesión (CU-08). La pantalla de anotar está pensada para meter flechas. El resumen sirve para ver el resultado de un vistazo al terminar, o para revisar una sesión antigua, sin el teclado ocupando media pantalla.

En ArcheryReg, según la especificación, es una tabla por arquero con una fila por tanda, su total y el acumulado. Tiene dos columnas de desempate que cuentan las flechas en las dos mejores zonas: en WA «10» (con la X junto al 10) y «9», y en campo y 3D las que correspondan. Incluye también los totales por serie y el total general con esos conteos.

Lo que verás: un botón «Resumen» en la pantalla de anotar, y una pantalla de solo lectura con la cabecera de la sesión (fecha, lugar, distancia y diana), la tabla, el total frente al máximo, la media por flecha y un botón para volver.

Por debajo: los conteos salen de los puntos de cada zona de la diana, no de fijar X=10 como el original, así que en campo y 3D salen bien.

Fuera: las estadísticas entre sesiones y las gráficas (F3), editar y borrar (CU-11 y CU-12) y la vista de «toda la diana».

## Clarifications
- Q: Además de la tabla del original (tandas, totales y las dos columnas de desempate), ¿quieres algo más en el resumen?
  A: Sí, el reparto por zonas: cuántas flechas en cada zona (X, 10, 9 … M).
- Q: ¿Desde dónde se abre el resumen?
  A: Primero se preguntó cómo lo hace el original: hay un botón de resumen en la pantalla de anotar y otro en la lista de participantes cuando hay datos, y las tarjetas de una sesión cerrada no se pueden tocar. Decisión: un botón «Resumen» en la pantalla de anotar. Las tarjetas del inicio siguen abriendo la pantalla de anotar, también las finalizadas.
- Q: Al confirmar «Finalizar», ¿qué pasa?
  A: La app lleva directamente al resumen de la sesión.
