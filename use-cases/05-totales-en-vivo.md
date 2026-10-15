# Use Case 05: CU-07 Totales en vivo

## Summary
Quinta y última pieza de F1, construida sobre los casos de uso 01 a 04 (anotar, corregir, borrar y ordenar). Completa la pantalla de puntuación con los totales, actualizados al instante con cada flecha: en cada fila, el total de la tanda frente a su máximo (`27/30`) y el acumulado de la serie; al cierre de cada serie, «Total Serie n: X/máx»; al final de la tabla, «TOTAL GENERAL: X/máx»; y en la cabecera, la media por flecha («Promedio: 8.67», con punto decimal como la app original), calculada solo sobre las flechas tiradas. Los puntos salen siempre de los `points` de cada zona de la diana y los máximos se calculan a partir de la zona de más valor (`maxArrowPoints`), corrigiendo los fallos del original en dianas de campo (X = 6) y 3D (11). Por debajo añade a `src/domain/scoring.ts` las funciones puras `maxArrowPoints`, `endTotal`, `seriesRunningTotal`, `seriesTotal`, `grandTotal` y `averagePerArrow`, con tests, y el composable `useSessionStats` con todos los valores derivados como `computed`. Quedan fuera los conteos de desempate (`topCounts`) y la pantalla de resumen (CU-08, F2).

## Acceptance Criteria
1. `maxArrowPoints(diana)` devuelve el máximo de `points` entre las zonas de la diana: 10 en WA 40, 6 en campo, 11 en 3D.
2. `endTotal(tanda, diana)` suma los `points` de las flechas (vacíos = 0): `['X','9','M']` en WA 40 → 19; `['X','6',null]` en campo → 12; `['11','5']` en 3D → 16.
3. `seriesRunningTotal(tandas, fila, …)` suma desde la primera tanda de la serie de esa fila (`Math.floor(fila / endsPerSeries)`) hasta esa fila, incluida.
4. `seriesTotal` y `grandTotal` devuelven el total de una serie y de la sesión; sus máximos son `endsPerSeries × arrowsPerEnd × maxArrowPoints` y `filas × arrowsPerEnd × maxArrowPoints`. El máximo de una tanda es `arrowsPerEnd × maxArrowPoints`.
5. `averagePerArrow` divide el total entre el número de flechas no vacías y redondea a 2 decimales; devuelve `null` si no hay ninguna. Caso: `[['10','9'],['8',null]]` en WA 40 → 9.00.
6. Cada fila de la tabla muestra el total de la tanda frente a su máximo (p. ej. `27/30`) y el acumulado de la serie hasta esa fila; las tandas parcialmente anotadas muestran el total de las flechas tiradas.
7. Las tandas sin empezar (todas sus flechas vacías) muestran el total y el acumulado igual que ArcheryReg Scoring; mientras no se verifique el comportamiento del original, se muestran vacíos (sin número).
8. Cada serie termina con una fila «Total Serie n: X/máx» y la tabla con «TOTAL GENERAL: X/máx».
9. La cabecera muestra «Promedio: 8.67» con punto decimal y siempre 2 decimales, o «Promedio: —» si no hay flechas tiradas.
10. Los totales y la media se recalculan al instante al anotar, corregir, borrar (flecha o tanda) y reordenar.
11. `useSessionStats` expone todos los valores como `computed` derivados del store, sin duplicar datos en el estado persistido.
12. Con 6 flechas por tanda (plantillas de aire libre), la fila completa (número de tanda, 6 celdas, total y acumulado) cabe a 375 px de ancho sin scroll horizontal, manteniendo celdas tocables.
13. Hay tests de Vitest para todas las funciones nuevas con dianas WA 40, campo y 3D, y para `useSessionStats`; la cobertura de `src/domain/**` y `src/composables/**` sigue siendo ≥ 90 % de líneas.
14. Un test de Playwright a 375 px anota dos tandas, comprueba totales de fila, acumulados, total de serie, total general y media, borra una flecha y comprueba que todo se recalcula.
15. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build` terminan sin errores.

## Potential Pitfalls & Open Questions
- **Missing input** — El documento de análisis no describe qué muestra ArcheryReg en las tandas sin empezar, y el original solo es accesible mediante el QR de una competición real. Se asume «vacío» hasta que el usuario lo compruebe; si el original muestra 0 o el acumulado anterior, el criterio 7 se ajusta.
- **Risk** — Con 6 flechas por tanda, el ancho a 375 px es justo (criterio 12); puede requerir celdas más estrechas o tipografía más compacta en esa configuración.

## Original Description
Descripción redactada por Claude y aprobada por el usuario en la conversación:

El último de F1. Completa la pantalla de puntuación con todas las cuentas.

Lo que verás en el móvil, actualizado al instante con cada flecha:
- En cada fila de tanda: el total de la tanda frente al máximo (por ejemplo `27/30`) y el acumulado de la serie hasta esa tanda.
- Al final de cada serie, una fila «Total Serie 1: 270/300».
- Al final de la tabla, «TOTAL GENERAL: 540/600».
- En la cabecera, la media por flecha («Promedio: 8,67»). Solo cuenta las flechas tiradas, no las celdas vacías.
- Los puntos salen siempre de la diana: en campo la X vale 6 y en 3D existe el 11. Los máximos también dependen de la diana: 30 por tanda en WA 40 con 3 flechas, 18 en campo y 22 en 3D con 2 flechas.

Lo que hay por debajo:
- Funciones puras en `scoring.ts`, con tests: `maxArrowPoints`, `endTotal`, `seriesRunningTotal`, `seriesTotal`, `grandTotal` y `averagePerArrow`. Incluye los casos del plan, como que la media de `[['10','9'],['8',null]]` es 9,00.
- El composable `useSessionStats`, con todos los totales como valores calculados que se actualizan solos.
- Un test de Playwright: anotar flechas y comprobar los totales y la media.

Lo que NO entra: los conteos de desempate («10+X» y «9») y la pantalla de resumen. Eso es CU-08, en F2.

## Clarifications
- Q: En las tandas que aún no has empezado, ¿qué muestran el total y el acumulado?
  A: Como salga en la app que se está usando de base (ArcheryReg Scoring). No documentado en el análisis; se asume vacío hasta verificarlo.
- Q: ¿Qué separador decimal usa la media por flecha?
  A: Punto: 8.67 (como la app original).
