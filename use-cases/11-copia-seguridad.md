# Use Case 11: CU-15 Copia de seguridad (exportar / importar JSON)

## Summary
Cuarta pieza de F2. Los datos solo existen en `localStorage` del dispositivo (`archery-training:v1`). Si se borra la app de la pantalla de inicio o el navegador limpia los datos, se pierden. Este caso de uso añade una **copia de seguridad en un archivo JSON**:

- **Ubicación:** al final de la pantalla de inicio, debajo de las tarjetas, hay una sección «Copia de seguridad» con dos botones: «Exportar copia» e «Importar copia». Aparece también cuando no hay sesiones, porque hay que poder importar en un móvil vacío.
- **Exportar:**
  - Se genera un archivo `arco-copia-AAAA-MM-DD.json` con todas las sesiones, en el formato persistido versionado (`version: 1`).
  - Si el navegador puede compartir archivos (Web Share API con `navigator.canShare({ files })`, por ejemplo Safari en iPhone), se abre el **menú Compartir** del sistema: Archivos o iCloud, WhatsApp, correo, AirDrop…
  - Si no puede, el archivo se **descarga**.
- **Importar:**
  - Se elige un archivo `.json`.
  - La app lo valida y lo **fusiona por `id`**: las sesiones nuevas se añaden, y si una sesión existe en los dos sitios gana la de `updatedAt` más reciente. A igual `updatedAt` se queda la local. Nunca se borra nada local.
  - Antes de aplicar, se pide **confirmación con un resumen** en el diálogo de la app, por ejemplo «Se añadirán 3 sesiones y se actualizará 1. 5 ya están al día.».
  - Al terminar se muestra un aviso con el resultado.
  - Un archivo inválido muestra un error claro y no cambia nada.

**Por debajo:**
- Funciones de dominio puras y testeables: serializar, validar y parsear el archivo, y planificar la fusión con sus recuentos.
- Las acciones `exportJson()` e `importJson(texto)` del store, que el brief ya prevé.
- Pruebas unitarias y en el navegador a 375 px.

En ArcheryReg no existe, porque los datos están en su servidor.

**Fuera de alcance:**
- Exportar a CSV (CU-20).
- Copias automáticas o recordatorios.
- Sincronización entre dispositivos.
- Exportar una sola sesión.
- El resumen (CU-08), editar (CU-11) y borrar (CU-12).

## Acceptance Criteria
1. En la pantalla de inicio, después de la lista de tarjetas (o del texto vacío), hay una sección con el encabezado «Copia de seguridad» y los botones «Exportar copia» e «Importar copia». Cada botón mide al menos 48 px de alto, tiene su propio `data-testid` y no tiene color de peligro. La sección cabe a 375 px sin scroll horizontal y no desplaza «Nueva sesión» de su sitio.
2. **Formato del archivo:**
   - JSON legible (con sangría) con la forma `{ version: 1, sessions: Session[], profileName, exportedAt }`, sin datos nuevos en el estado persistido.
   - Nombre `arco-copia-AAAA-MM-DD.json`, con la fecha local del día.
   - Tipo `application/json`.
   - Exportar e importar el mismo archivo deja los datos idénticos (ida y vuelta).
3. **Exportar con menú Compartir:** si `navigator.canShare?.({ files: [archivo] })` es verdadero, «Exportar copia» llama a `navigator.share({ files: [archivo], title })`. Cancelar el menú (`AbortError`) no muestra ningún error. Cualquier otro fallo de `share` cae a la descarga.
4. **Exportar con descarga:** si no se puede compartir, se descarga el archivo con un enlace temporal (`URL.createObjectURL` + `<a download>`), y la URL se libera después.
5. Exportar con cero sesiones sigue funcionando (copia vacía válida) o el botón queda deshabilitado de forma accesible. El comportamiento elegido se documenta en el plan y tiene test.
6. **Importar, elección del archivo:** «Importar copia» abre el selector de archivos (`<input type="file" accept="application/json,.json">` oculto). Elegir el mismo archivo dos veces seguidas vuelve a dispararlo, porque el valor del input se limpia.
7. **Validación:** antes de tocar nada, la importación rechaza con un mensaje en español:
   - un archivo que no es JSON;
   - un JSON que no tiene la forma esperada;
   - un JSON con `version` desconocida, incluida una versión mayor que la actual;
   - un JSON con sesiones mal formadas: faltan campos, tipos incorrectos, o un número de tandas o de flechas que no cuadra con la estructura.

   El estado local no cambia y el error se muestra en un aviso visible y anunciado (`role="alert"` o equivalente). Se reutiliza la validación o migración existente de `usePersistence` si la hay, sin duplicar reglas.
8. **Fusión por `id`:**
   - Las sesiones con `id` desconocido se añaden.
   - Si el `id` ya existe, gana la de `updatedAt` mayor. Con `updatedAt` igual o menor se conserva la local.
   - Las sesiones locales que no están en el archivo se conservan.
   - La fusión es una función pura que devuelve el resultado y los recuentos (`added`, `updated`, `unchanged`).
   - Importar el mismo archivo dos veces no duplica nada: la segunda vez todo sale «al día».
9. **Confirmación:**
   - Con al menos un cambio, se abre el diálogo de la app (`useConfirm` / `ConfirmDialog`, nunca `window.confirm`), sin color de peligro (`danger: false`). Título «¿Importar copia?», un mensaje con los recuentos en español con singular y plural correctos, y los botones «Importar» y «Cancelar».
   - Al cancelar, o con Escape, no cambia nada y el foco vuelve a «Importar copia».
   - Si no hay cambios (todo al día), no se pide confirmación y se muestra directamente un aviso del tipo «La copia no tiene cambios: todas las sesiones ya están al día.».
10. **Resultado:**
    - Al confirmar, el store aplica la fusión de una sola vez, se persiste con el mecanismo existente y las tarjetas se actualizan en el orden de `sortedSessions`.
    - Se muestra un aviso de éxito anunciado (`role="status"`) con los recuentos.
    - Los avisos no desbordan a 375 px y se pueden cerrar, o desaparecen al hacer otra acción.
11. **Datos que no se pisan:**
    - Importar no cambia `profileName` local, salvo que esté vacío y el archivo traiga uno.
    - Las sesiones importadas conservan su `closed`, `createdAt` y `updatedAt` tal como venían.
12. **Tests:**
    - **Vitest:** serializar, nombre de archivo, validar y parsear con los casos válidos y cada tipo de inválido, la fusión (añadir, actualizar, conservar, empate e idempotencia) y los textos de resumen.
    - **Vitest:** las acciones del store y la vista de inicio:
      - compartir disponible, compartir cancelado y caída a la descarga, con `navigator.share`/`canShare` y `URL.createObjectURL` simulados;
      - importar válido con confirmación, cancelación, sin cambios e inválido.
    - **Playwright a 375 px:**
      1. Crear dos sesiones con el flujo real y anotar en una.
      2. «Exportar copia» captura la descarga (Chromium sin Web Share de archivos) y se comprueba el contenido.
      3. Borrar `localStorage` y recargar: la lista está vacía.
      4. «Importar copia» con ese archivo → la confirmación dice «2 sesiones» → «Importar»: las tarjetas vuelven con los mismos totales.
      5. Importar otra vez: «al día».
      6. Importar un archivo inválido: aviso de error y la lista no cambia.
      7. La sección cabe a 375 px.
    - Las pruebas e2e existentes se adaptan si hace falta. `offline.spec` sigue sin reintentos y con sus guardas de consola.
13. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build` terminan sin errores. La cobertura de `src/domain/**` y `src/composables/**` sigue ≥ 90 % de líneas.

## Potential Pitfalls & Open Questions
- **Riesgo, iOS Safari / PWA:** `navigator.share` con archivos debe llamarse dentro del gesto del usuario. No se puede `await` nada lento antes, porque iOS pierde la activación. El archivo se construye de forma síncrona en el clic.
- **Riesgo, iOS Safari:** el `<input type="file">` en modo standalone abre el selector de Archivos. El `accept` con `.json` debe dejar elegir el archivo guardado en Archivos/iCloud. Algunos iOS etiquetan el JSON como `text/plain`, así que se valida el contenido y no el tipo MIME.
- **Riesgo:** un archivo enorme o con muchas sesiones (hasta 20 × 30 × 12 flechas por sesión) debe parsearse y validarse sin bloquear de forma notable. Se lee con `file.text()`.
- **Caso límite:** una sesión del archivo con `updatedAt` igual al local pero contenido distinto se considera «al día» y gana la local, como dice la especificación.
- **Caso límite:** una copia con `id` repetidos dentro del mismo archivo. Se rechaza como inválida, o se toma la de `updatedAt` mayor. El plan decide y se testea.
- **Caso límite:** la importación ocurre mientras hay otra pestaña abierta. No hay sincronización entre pestañas, igual que en CU-10, y no se trata.
- **Supuesto:** los datos siguen en `localStorage`. Si la importación supera la cuota, el guardado falla como ya maneja `usePersistence` (try/catch). El plan indica si se avisa al usuario.
- **Supuesto:** no se añaden dependencias. Web Share, Blob, File y `URL.createObjectURL` son APIs nativas.

## Original Description
Descripción redactada por Claude y aprobada por el usuario en la conversación:

Copia de seguridad (CU-15). Ahora las sesiones solo están guardadas dentro de la app en el iPhone. Si se borra la app de la pantalla de inicio, o Safari limpia los datos, se pierden. Con esto se puede sacar una copia a un archivo y recuperarla después, en el mismo móvil o en otro.

Lo que verás, en el inicio y debajo de la lista de sesiones:
- «Exportar copia»: crea un archivo con todas las sesiones (`arco-copia-2026-10-17.json`).
- «Importar copia»: eliges ese archivo y la app recupera las sesiones. Te dice qué ha pasado, por ejemplo «3 nuevas, 1 actualizada, 5 sin cambios».

Cómo se juntan los datos, según la especificación: no se borra nada de lo que ya tienes. Si una sesión está en los dos sitios, se queda la versión modificada más recientemente, así que importar la misma copia dos veces no duplica nada.

Por debajo: se comprueba que el archivo sea una copia válida de esta app. Si no lo es, se muestra un error y no se toca nada.

Fuera: exportar a CSV/Excel (CU-20), copia automática y sincronización entre dispositivos.

## Clarifications
- Q: En el iPhone, al pulsar «Exportar copia», ¿qué prefieres que pase?
  A: El menú Compartir de iOS (Archivos/iCloud, WhatsApp, correo, AirDrop). En el ordenador, o si no se puede compartir, se descarga el archivo.
- Q: Al importar, ¿pedimos confirmación antes de aplicar los cambios?
  A: Sí, con un resumen («Se añadirán 3 sesiones y se actualizará 1. ¿Importar?») y solo se aplica si aceptas.
- Q: ¿Dónde van los botones de copia?
  A: Al final del inicio, en una sección «Copia de seguridad» debajo de las tarjetas.
