# Use Case 09: CU-09 Lista de sesiones

## Summary
Segunda pieza de F2. Sustituye la lista provisional del inicio (`TODO(CU-09)` en `SessionsView`, creada en el caso de uso 08) por **tarjetas de sesión**, ordenadas de la más reciente a la más antigua, con el orden de `sortedSessions`. Cada tarjeta muestra:
- el dibujo de la diana;
- la fecha («DD/MM/AAAA») y el lugar, o «Sin lugar»;
- la distancia («18 m» o «Variable») y el nombre de la diana;
- la estructura («2×10×3»);
- el total frente al máximo y la media por flecha («Total 271/600 · Promedio 9.03», o «Promedio: —» sin flechas).

Al tocar una tarjeta se abre la pantalla de puntuación de esa sesión, como hasta ahora. El botón «Nueva sesión» sigue arriba.

**Por debajo**
- **`TargetIcon`:** un componente nuevo que dibuja en SVG cada tipo de icono del catálogo (`TargetIcon`: `wa-full`, `wa-reduced`, `wa-triple-vertical`, `wa-triple-horizontal`, `wa-field`, `3d`).
  - Las dianas WA usan la geometría de referencia del brief.
  - Campo y 3D usan dibujos simplificados, por decisión del usuario.
- **`SessionCard`:** un componente nuevo.
- **Totales:** se calculan con las funciones de dominio existentes (`grandTotal`, `averagePerArrow`, `maxArrowPoints`), igual que en la pantalla de puntuación.

**Fuera de alcance**
- Cerrar y reabrir sesiones y su indicador (CU-10).
- La pantalla de resumen (CU-08).
- Editar y borrar sesiones (CU-11 y CU-12).
- Exportar e importar (CU-15).
- Filtros del historial (CU-16).

## Acceptance Criteria
1. El inicio muestra una tarjeta por sesión guardada, en el orden de `sortedSessions` (fecha descendente y, a igual fecha, `createdAt` descendente). La lista provisional y su `TODO(CU-09)` desaparecen. El botón «Nueva sesión» sigue encima de las tarjetas, y el texto vacío se muestra solo cuando no hay sesiones.
2. Cada tarjeta es un único enlace que lleva a la pantalla de puntuación de la sesión con su primer arquero (`/session/:id/score/:archerId`). Tiene un nombre accesible que resume la sesión, por ejemplo «17/10/2026, Club, 18 m, WA 40 cm». No contiene controles anidados.
3. La tarjeta muestra la fecha en formato «DD/MM/AAAA» (`formatDisplayDate`) y el lugar sin espacios sobrantes, o «Sin lugar» si está vacío.
4. La tarjeta muestra la distancia («18 m», o «Variable» cuando es 0) y el nombre en español de la diana del catálogo.
5. La tarjeta muestra la estructura como «series×tandas×flechas», con el signo «×», por ejemplo «2×10×3».
6. La tarjeta muestra «Total X/máx», con el mismo valor y el mismo máximo que «TOTAL GENERAL» de la pantalla de puntuación. También muestra la media por flecha con punto decimal y 2 decimales («Promedio 9.03»), o «—» cuando no se ha tirado ninguna flecha. Los puntos salen siempre de los `points` de cada zona: en campo la X vale 6 y en 3D hay 11.
7. `TargetIcon` dibuja un SVG distinto para cada valor de `TargetIcon`:
   - **`wa-full`:** los cinco colores de la geometría de referencia del brief, con `viewBox -70 -70 140 140`. Blanco r=60.9, negro 48.7, azul `#00B4E4` 36.5, rojo `#F65058` 24.3 y amarillo `#FFE552` 12.1, con las líneas intermedias.
   - **`wa-reduced`:** solo desde el azul hacia dentro, con `viewBox -40 -40 80 80`.
   - **`wa-triple-vertical`** y **`wa-triple-horizontal`:** tres spots de r=9.9/7.9/3.9 separados 22 unidades, en vertical o en horizontal.
   - **`wa-field`, simplificado:** anillos negros con el centro amarillo.
   - **`3d`, simplificado:** círculos concéntricos que representan las zonas 11, 10, 8 y 5, en un tono distinto de las dianas WA.
8. El icono es decorativo dentro de la tarjeta (`aria-hidden`), porque el nombre de la diana ya aparece como texto. Se ve bien a unos 40–48 px en los temas claro y oscuro. Las dianas con blanco tienen un contorno visible sobre el fondo claro.
9. Los totales se calculan con las funciones de dominio existentes (`grandTotal`, `averagePerArrow`, `maxArrowPoints` o las equivalentes de `useSessionStats`), sin duplicar fórmulas ni guardar nada nuevo en el estado persistido.
10. A 375 px, cada tarjeta cabe sin scroll horizontal, incluso con un lugar muy largo (más de 60 caracteres sin espacios), con «Variable · WA 80 cm reducida (6 anillos)» o con un total como «1234/1440». El texto largo se ajusta o se recorta con puntos suspensivos sin desbordar. La tarjeta mide al menos 48 px de alto y tiene foco visible.
11. Las sesiones antiguas, incluida la «Sesión de prueba», siguen apareciendo y abriéndose. No hace falta migrar datos.
12. Tests:
    - **Vitest:** `TargetIcon` (un caso por tipo de icono, con la estructura del SVG o los colores clave) y `SessionCard` (fecha, «Sin lugar», «Variable», estructura, total y máximo en WA 40, campo y 3D, «—» sin flechas, destino del enlace).
    - **Vitest:** `SessionsView`, con el orden de las tarjetas y el texto vacío.
    - **Playwright a 375 px:** se crean dos sesiones con el flujo real, se anota en una y se vuelve al inicio. Se comprueba el orden, que los textos de la tarjeta coinciden con «TOTAL GENERAL» y el promedio de la pantalla de puntuación, que la tarjeta abre la sesión y que la tarjeta con lugar largo no desborda.
    - Las pruebas e2e existentes que usaban la lista provisional se adaptan.
13. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build` terminan sin errores. La cobertura de `src/domain/**` y `src/composables/**` sigue ≥ 90 % de líneas.

## Potential Pitfalls & Open Questions
- **Risk** — Las fuentes más anchas del CI (Linux) ya rompieron una vez un diseño que cabía en macOS (caso de uso 05). La tarjeta debe tolerar textos más anchos. Conviene una prueba de ajuste a 375 px con el peor caso.
- **Assumption** — La geometría de campo y 3D no está en la especificación. Se usan dibujos simplificados elegidos por el usuario, no la silueta de jaguar del original (`jaguar-3d`).
- **Edge case** — Sesiones con muchas filas (hasta 20 × 30 × 12) calculan los totales en la lista. El cálculo es barato, pero no debe repetirse innecesariamente en cada render.
- **Assumption** — La pantalla de inicio todavía no indica si la sesión está cerrada. Eso llega con CU-10.
- **Edge case** — Una sesión sin arqueros, defensiva porque no debería existir, no debe romper la lista: la tarjeta se omite, como en la lista provisional.

## Original Description
Descripción redactada por Claude y aprobada por el usuario en la conversación:

Lista de sesiones (CU-09). La lista provisional del inicio se convierte en tarjetas, de la más reciente a la más antigua. Cada tarjeta muestra:
- el dibujo de la diana a la izquierda: completa, reducida (6 anillos), triple, campo o 3D;
- la fecha y el lugar («17/10/2026 · Club», o «Sin lugar»);
- la distancia y el nombre de la diana («18 m · WA 40 cm», o «Variable · 3D»);
- la estructura (`2×10×3`);
- el total y la media («Total 271/600 · Promedio 9.03»), o «—» si aún no hay flechas.

Al tocar una tarjeta se abre esa sesión. El botón «Nueva sesión» sigue arriba.

Por debajo: un componente `TargetIcon` que dibuja cada diana en SVG con las medidas de la especificación, y un componente `SessionCard`. Los totales salen de las mismas funciones que la pantalla de puntuación, así que siempre coinciden. Pruebas unitarias y en el navegador a 375 px, incluida una tarjeta con un lugar muy largo.

Fuera: cerrar y reabrir con candado (CU-10), el resumen (CU-08), editar y borrar (CU-11 y CU-12), exportar e importar (CU-15) y los filtros (F3).

## Clarifications
- Q: Al tocar una tarjeta, ¿adónde vas?
  A: A anotar: se abre la pantalla de puntuación de esa sesión. Se puede revisar cuando lleguen el resumen (CU-08) y cerrar sesión (CU-10).
- Q: ¿Cómo quieres el total en la tarjeta?
  A: Total frente al máximo y la media: «Total 271/600 · Promedio 9.03», igual que en la pantalla de puntuación.
- Q: La especificación solo tiene medidas para dibujar las dianas WA. Para campo y 3D, ¿qué dibujo prefieres?
  A: Primero se preguntó cómo lo hace el original: usa un icono `jaguar-3d` (silueta de jaguar) para 3D y `wa-field` para campo, sin que se guardaran sus dibujos. Decisión: simplificados. Campo con anillos negros y centro amarillo; 3D con círculos concéntricos de las zonas 11-10-8-5 en un tono distinto.
