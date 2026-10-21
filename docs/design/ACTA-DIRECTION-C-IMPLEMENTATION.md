# Acta — implementación de la Dirección C

Referencia funcional: Acta **v0.5.0**, `d2340e763ea398de0d0f350e65aa319125354e28`.
Rama de trabajo: `feat/acta-direction-c-ui`. Inicio: 2026-10-08.

Este informe separa implementación, pruebas y aceptación humana. Los documentos de diseño y las capturas del laboratorio son referencias; no son evidencia de que el frontend React ya las implemente.

## Alcance y parada obligatoria

Solo presentación frontend. Se conservan contratos, autorización, dominio, backend, Prisma y almacenamiento. No se modifica el downstream institucional ni ninguna instalación persistente. No se cambia versión, no se publica, no se crea release ni tag.

**Después del checkpoint 4 se entregará una comparación desktop/móvil y se detendrá el trabajo para aprobación explícita del producto. Los checkpoints 5–8 y el PR final no están autorizados antes de esa aprobación.**

**Actualización 2026-10-09:** el producto aprobó la validación funcional y autorizó CP5, CP6 y CP7 (secciones al final). **CP8, el PR final, el push y el release siguen sin autorizarse.**

## Comparativas para la revisión humana

Referencia aprobada a la izquierda; React implementado a la derecha. Cada fila del informe conserva además 1024, 768 y 320 px. La aceptación de producto todavía no está otorgada para ninguno de los checkpoints.

| Pantalla | Escritorio 1440 | Móvil 390 |
|---|---|---|
| Revisión · 1 aportación | [Comparar](acta-direction-c-evidence/cp4/V-04-compare-1440.png) | [Comparar](acta-direction-c-evidence/cp4/V-04-compare-390.png) |
| Revisión · 3 aportaciones | [Comparar](acta-direction-c-evidence/cp4/V-05-compare-1440.png) | [Comparar](acta-direction-c-evidence/cp4/V-05-compare-390.png) |
| Revisión · 12 aportaciones | [Comparar](acta-direction-c-evidence/cp4/V-06-compare-1440.png) | [Comparar](acta-direction-c-evidence/cp4/V-06-compare-390.png) |
| Revisión · 50 aportaciones, DEV-25 | [Comparar](acta-direction-c-evidence/cp4/V-07-compare-1440.png) | [Comparar](acta-direction-c-evidence/cp4/V-07-compare-390.png) |
| Parcial separado, DEV-25 | [Comparar](acta-direction-c-evidence/cp4/V-07-partial-compare-1440.png) | [Comparar](acta-direction-c-evidence/cp4/V-07-partial-compare-390.png) |
| ADMIN · consulta completa sin acciones | [Comparar](acta-direction-c-evidence/cp4/V-13-admin-compare-1440.png) | [Comparar](acta-direction-c-evidence/cp4/V-13-admin-compare-390.png) |
| VIEWER · fuentes filtradas; documento final pendiente CP5 | [Comparar](acta-direction-c-evidence/cp4/V-14-viewer-compare-1440.png) | [Comparar](acta-direction-c-evidence/cp4/V-14-viewer-compare-390.png) |
| Organizar · 304 preguntas | [Comparar](acta-direction-c-evidence/cp3/V-02b-compare-1440.png) | [Comparar](acta-direction-c-evidence/cp3/V-02b-compare-390.png) |
| Atención · navegación y estados | [Comparar](acta-direction-c-evidence/cp2/V-01-compare-1440.png) | [Comparar](acta-direction-c-evidence/cp2/V-01-compare-390.png) |
| Conflicto / Contraste (CP5) | [Comparar](acta-direction-c-evidence/cp5/compare-V09-conflicto-1440.png) | [Comparar](acta-direction-c-evidence/cp5/compare-V09-conflicto-390.png) |
| Decisión (CP5) | [Comparar](acta-direction-c-evidence/cp5/compare-V11-decision-1440.png) | [Comparar](acta-direction-c-evidence/cp5/compare-V11-decision-390.png) |
| Mi trabajo (CP6) | [Comparar](acta-direction-c-evidence/cp6/compare-V15-mi-trabajo-1440.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V15-mi-trabajo-390.png) |
| Responder (CP6) | [Comparar](acta-direction-c-evidence/cp6/compare-V16-responder-1440.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V16-responder-390.png) |
| Invitación (CP6) | [Comparar](acta-direction-c-evidence/cp6/compare-V20-invitacion-1440.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V20-invitacion-390.png) |
| Administración (CP7) | [Comparar](acta-direction-c-evidence/cp7/compare-V23-administracion-1440.png) | [Comparar](acta-direction-c-evidence/cp7/compare-V23-administracion-390.png) |
| Invitaciones (CP7) | [Comparar](acta-direction-c-evidence/cp7/compare-V24-invitaciones-1440.png) | [Comparar](acta-direction-c-evidence/cp7/compare-V24-invitaciones-390.png) |
| Asistente de invitación (CP7) | [Comparar](acta-direction-c-evidence/cp7/compare-V25-asistente-1440.png) | [Comparar](acta-direction-c-evidence/cp7/compare-V25-asistente-390.png) |
| Lector de consulta (CP7) | [Comparar](acta-direction-c-evidence/cp7/compare-V26-lector-1440.png) | [Comparar](acta-direction-c-evidence/cp7/compare-V26-lector-390.png) |

## Estado real

| Etapa                                     | Estado                     | Evidencia / siguiente comprobación                                                                                |
| ----------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Preparación                               | EN CURSO                   | Base y árbol auditados; rama creada; PostgreSQL desechable nuevo; migraciones oficiales aplicadas                 |
| 1. Tokens, tipografía, componentes        | LISTO PARA REVISIÓN        | Tipos/lint/build, 170 tests frontend, humo 7/7, visual 5/5 y axe 0; aceptación humana pendiente                   |
| 2. Shell, navegación, Atención            | LISTO PARA REVISIÓN        | Gate visual 12/12, 231 unit/component, 11 workbench, 3 simplicity, humo 7 casos; límites ARCHIVED descritos abajo; UX-01/03/08/15 y parche UX-02 cerrados en la puerta UX (más abajo) |
| 3. Cuestionario / Organizar / lotes | LISTO PARA REVISIÓN | 174 unit, 28 E2E funcionales, 15 visuales, 3 de fixture independiente; cinco anchos y DEV-26 aprobada |
| 4. Revisión / aportaciones / solo lectura | LISTO PARA REVISIÓN, con correcciones posteriores a la auditoría | 284 unit tras las correcciones (264 al cierre), 15 E2E funcionales y 40 vistas + 1 gate de permisos al cierre; DEV-25 aplicada; E2E re-ejecutado en la puerta UX: 138/138; UX-06/07/09 cerrados; requiere aceptación humana |
| Puerta de correcciones UX antes de CP5 | CERRADA (8 hallazgos, con evidencia) | 332 unit, 113 integración, 138 E2E, axe 0; CP5 sin iniciar |
| 5. Conflictos / aclaraciones / decisiones | LISTO PARA REVISIÓN | UX-04/05/11/12/17 cerrados; E2E `cp5` 10/10; comparativas con la Dirección C; adaptaciones listadas; requiere aceptación humana |
| 6. Participante / invitado                | LISTO PARA REVISIÓN | E2E `cp6` 7/7 con axe y tema oscuro; sin guardado automático simulado; requiere aceptación humana |
| 7. Administración / consistencia          | LISTO PARA REVISIÓN | UX-02 completo, UX-10/13/14/16 cerrados; E2E `cp7` 9/9 (14 pantallas × 5 anchos); requiere aceptación humana |
| 8. Validación integral / PR borrador      | NO INICIADO | Espera aceptación humana de CP1–CP7; no publicar |

## Preparación y aislamiento

- La rama principal coincide exactamente con la base autorizada; no se descartó historia ni trabajo local.
- Se conservan sin cambios los documentos sin seguimiento `CLAUDE-UX-CONTEXT.md`, `CLAUDE-UX-FILES.json`, `mockups/` y el stash previo.
- Entorno nuevo: proyecto Compose `acta-direction-c-20261008`, PostgreSQL propio en loopback `55479`, API de desarrollo `3000`, frontend `http://localhost:4447`.
- **Adaptación operativa:** `4317` y `55439` estaban ocupados por instalaciones anteriores. Se eligieron puertos libres; no se detuvo ni reutilizó esa infraestructura. No cambia rutas/API ni la configuración versionada.
- `.env` privado generado por `setup:demo`, excluido de Git. Evidencia y logs de pruebas fuera del árbol versionable. Storage LOCAL para este recorrido, conforme a DEVELOPMENT; no demuestra nuevamente S3.
- Node observado: **26.7.0**, npm **11.19.0**; satisface `engines >=24.15 <27`, pero difiere del recomendado 24.21.0. Los resultados locales deben identificarse con ese runtime.
- Se aplicaron las **10 migraciones oficiales** en la base vacía. No se usó `db push`.
- Los tests de revisión usan el override ya existente `ACTA_REVIEW_TEST_PORT=4453` para evitar el puerto ocupado 4330.

## Línea base sin modificaciones de producto

| Comprobación                     | Resultado observado                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma:generate`                | PASS                                                                                                                                              |
| Migraciones desde base vacía     | PASS, 10 migraciones                                                                                                                              |
| Build contratos/backend/frontend | PASS; advertencia preexistente de bundle >500 kB                                                                                                  |
| `lint`                           | PASS                                                                                                                                              |
| `typecheck`                      | PASS                                                                                                                                              |
| Unit/component                   | PASS, 215 pruebas / 30 archivos, sin skips                                                                                                        |
| Integración PostgreSQL           | PASS, 113/113, sin skips                                                                                                                          |
| E2E Chromium                     | PASS, Chromium 61/61 (4 min), sin skips ni retries                                                                                                |
| Fixture visual 304               | PASS: parser e importador oficial; 304 preguntas, 9 temas, 14 áreas; externalIds, orden, tipos, required, prioridad, grupos y opciones comparados |

Los logs privados de ejecución no se incorporan al producto. Se agregarán resultados resumidos y evidencia revisada al completar cada gate.

### Datos visuales reales

Se sembraron por API, en una segunda base desechable aislada, los casos de 1 aportación (ANSWERED), 3 (CONFLICT), 12 (CLARIFICATION_REQUIRED), 0 (PENDING) y decisión validada (VALIDATED). Se conservaron versiones históricas, hilos abiertos/cerrados, conflictos resueltos y fuentes de validación. Los PDF son ficticios y su SHA-256 coincide con la metadata de evidencia.

**DEV-25 aprobada por el producto (2026-10-08), de origen funcional:** conservar las aclaraciones del caso de 50 y mostrar `CLARIFICATION_REQUIRED` («Requiere aclaración»), según la proyección del backend. La captura `c-05-review-50` muestra «Parcial»; gana el comportamiento real. Se autoriza un caso separado `PARTIAL`: al menos una aportación enviada, personas requeridas pendientes, sin aclaraciones abiertas ni conflictos. No se fuerza ningún estado ni se cambia backend/contrato. Ejecución y resultados al cierre de CP4.

## Matriz de aceptación

Los checkpoints 1–4 tienen evidencia React. CP4 cubre 0/1/3/12/50 aportaciones, un caso parcial separado y solo lectura. Los checkpoints 5–7 tienen evidencia React (secciones al final); el 8 no se ha iniciado. V-01b ADMIN se comprobó en navegador; ARCHIVED solo tiene cobertura de derivación unitaria (DEV-24), sin captura de un proyecto archivado real. No se atribuyen al producto resultados del prototipo.

| Filas                      | Pantallas / variantes                                      | Checkpoint | Estado                                                    |
| -------------------------- | ---------------------------------------------------------- | ---------- | --------------------------------------------------------- |
| V-00 base                  | Tokens y componentes                                       | 1          | LISTO PARA REVISIÓN                                       |
| V-00, V-01, V-01b          | Shell; Atención analista y ADMIN; derivación ARCHIVED      | 2          | LISTO PARA REVISIÓN con DEV-03/19/20/24 y límite ARCHIVED |
| V-02, V-02b, V-02c, V-03 | Organizar 304, Preparar, lote, autoría | 3 | LISTO PARA REVISIÓN con DEV-09/16/26 |
| V-04…V-08 + V-07-partial | Revisión 1, 3, 12, 50, 0 aportaciones y parcial real | 4 | LISTO PARA REVISIÓN con DEV-25 |
| V-13/V-14 composición base | ADMIN completo sin acciones; VIEWER filtrado | 4 | LISTO PARA REVISIÓN con DEV-20/24; documento final en CP5 |
| V-09…V-14 detalle          | Contraste, aclaraciones, decisiones y consulta             | 5          | LISTO PARA REVISIÓN con adaptaciones de CP5               |
| V-15…V-22                  | Mi trabajo, responder, recibos, invitado                   | 6          | LISTO PARA REVISIÓN                                       |
| V-23…V-27                  | Administración, invitaciones, lector y pantallas restantes | 7          | LISTO PARA REVISIÓN con las diferencias de CP7            |
| Matriz completa            | Todos los roles y cinco anchos                             | 8          | POST-APROBACIÓN                                           |

Cada fila tendrá nueve aspectos: jerarquía, composición, tipografía, espaciado, densidad, agrupación, ubicación de acciones, estados y responsive. Capturas a 1440×900, 1024×768, 768×1024, 390×844 y 320×640. Se adjuntarán métricas, axe, teclado, foco y revisión de los 14 detectores de jerarquía antigua. Ninguna fila se declara aprobada por Codex.

## Libro de aserciones

CP1 no alteró aserciones existentes. CP2 adapta selectores y composición de navegación; el libro detallado figura abajo. Se añadieron pruebas de componentes, retorno de contexto y métricas visuales. No hay skips, retries ni aumentos de timeout de pruebas existentes. El setup nuevo de la suite visual crea 304 preguntas por API en su beforeAll, con el límite explícito de 240 s.

## Adaptaciones y contrastación de fuentes

- Se aplicarán únicamente las adaptaciones preautorizadas DEV-01…DEV-24 del Acceptance; una nueva incompatibilidad se elevará al producto.
- Confirmado en código: ADMIN consulta detalle completo sin revisar; VIEWER solo obtiene decisión vigente y fuentes filtradas. `canReview` exige ANALYST y proyecto ACTIVE.
- Confirmado: el editor de preguntas usa estado local y Zod; React Hook Form pertenece a Respond. La descripción general del inventario Claude no sustituye al código.
- Confirmado: dashboard no expone texto de decisión ni texto completo de pregunta. No se añadirá una consulta por fila para llenar esos huecos.
- Serif: obtenidos los TTF oficiales 400, 400 cursiva y 700 de `@ibm/plex-serif@2.0.0`; SHA-256 del ZIP verificado contra el digest de la release oficial. OFL 1.1 comprobada. Empaquetados sin modificar, con OFL adyacente y avisos/inventario actualizados. La pila documental está disponible; las pantallas se migrarán en sus respectivos checkpoints. Test de red: todas las fuentes locales, ningún request Manrope/CDN. TTF añadidos: 665.660 bytes; OFL: 4,362 bytes (saltos LF; palabras verificadas contra el original).

## Copy nuevo para revisión de producto

CP2 incorpora las etiquetas de turno y navegación listadas al final de su informe. CP4 incorpora los textos de revisión listados abajo; decisión y carta documental esperan sus checkpoints. Confirmación editorial humana pendiente conforme a DEV-08; no se inventa identidad del invitado, consenso ni autoguardado.

## Límites y pendientes humanos

Pendientes lector de pantalla, zoom real, colores forzados, modo oscuro, dispositivos táctiles y navegadores distintos de Chromium. Axe sin violaciones no significa conformidad WCAG. La aceptación visual corresponde a producto.

## Revisión de alcance y publicación

Solo presentación frontend y verificación/documentación. Backend, contratos, Prisma y almacenamiento: diff vacío respecto de v0.5.0. No hay PR ni push. **READY FOR REVIEW: YES, checkpoints 1–7 (CP5–CP7 según las secciones finales).** La implementación integral 1–8 no está terminada. Se hace la parada humana obligatoria; CP5–8, push y PR no están autorizados todavía por este gate.

## Checkpoint 1 — base visual y componentes

**LISTO PARA REVISIÓN**, sin aceptación visual humana todavía. No se implementó la hoja de diseño como ruta del producto: `tests/visual/direction-c.html` es una entrada dev-only, excluida del build. Tampoco se implementó todavía la nueva shell; la comparación de este checkpoint evalúa el lenguaje de componentes, no la navegación de la hoja del laboratorio (DEV-12).

- Tokens `ac-*`, Plex Sans operativo y Plex Serif documental local, foco doble y controles existentes conservados.
- Primitivas: StatusChip (cinco familias con glifo/palabra), MetaLine, QuestionBand, StateCard, TabNav/TabPanel, ContributionRail/Pane, EvidenceFile, ThreadInset, ComparisonTable, DecisionSheet, QueueRow, QuestionRow, SelectionBar, Receipt, Letter y AppShell. Integración por pantalla aún pendiente.
- `Button` conserva sus variantes existentes y añade `tertiary`; firmas existentes compatibles. Las consultas, handlers de dominio y componentes de formulario funcionales no cambiaron.
- Se retiraron los `@font-face` duplicados de participant.css y referencias a Manrope del frontend; se conservaron sus archivos y avisos (DEV-23). Serif no se usa en controles ni navegación.
- DEV-22: derivados del acento por instalación; se probaron el respaldo del diseño y los acentos `#2b4d7c` (instalación por defecto) y `#18675f` (personalizado).

### Resultados observados

| Gate CP1                     | Resultado                                                            |
| ---------------------------- | -------------------------------------------------------------------- |
| Lint                         | PASS                                                                 |
| Typecheck                    | PASS                                                                 |
| Build completo               | PASS; permanece advertencia de bundle >500 kB                        |
| Frontend unit/component      | 170/170 en 21 archivos                                               |
| Subconjunto UI               | 19/19 en 2 archivos (incluido en el total anterior)                  |
| Humo plataforma, base nueva  | 7/7 Chromium; mismas assertions upstream                             |
| Visual y teclado             | 5/5, un test por ancho                                               |
| Axe                          | 0 en 5 anchos × 3 acentos; wcag2a/2aa/21a/21aa/22aa/best-practice    |
| Fuentes                      | Locales; Serif 400/400 italic/700 cargadas; ninguna petición externa |
| Build de producción          | No contiene la entrada de verificación                               |
| Backend / contratos / Prisma | Sin diff                                                             |

Métricas: [metrics-cp1.json](acta-direction-c-evidence/metrics-cp1.json). Líneas base de producto: [baseline-metrics.json](acta-direction-c-evidence/baseline-metrics.json), 50 capturas de 10 variantes × 5 anchos. La línea base del caso de 50 se reconstruyó posteriormente desde CP3, después de autorizar DEV-25; está identificada expresamente.

| Ancho | Ancho de página | Nombre de evidencia | Texto mínimo | Objetivos mínimos | Axe |
| ----- | --------------- | ------------------- | ------------ | ----------------- | --- |
| 1440  | 1440            | 559,66 px           | ≥12,5 px     | ≥24 px            | 0   |
| 1024  | 1024            | 463,66 px           | ≥12,5 px     | ≥24 px            | 0   |
| 768   | 768             | 658 px              | ≥12,5 px     | ≥44 px            | 0   |
| 390   | 390             | 296 px              | ≥12,5 px     | ≥44 px            | 0   |
| 320   | 320             | 226 px              | ≥12,5 px     | ≥44 px            | 0   |

No se detectaron textos comprimidos ni elementos fuera del viewport en la hoja de componentes. Teclado: flechas/Inicio/Fin en pestañas, asociación panel/pestaña, Escape y retorno al disparador. El riel conserva la selección mientras las flechas cambian foco; Enter activa (test unitario).

### Revisión visual de nueve aspectos

Se abrieron y observaron las cinco comparaciones: [1440](acta-direction-c-evidence/cp1/V-00-compare-1440.png), [1024](acta-direction-c-evidence/cp1/V-00-compare-1024.png), [768](acta-direction-c-evidence/cp1/V-00-compare-768.png), [390](acta-direction-c-evidence/cp1/V-00-compare-390.png), [320](acta-direction-c-evidence/cp1/V-00-compare-320.png). Izquierda: referencia; derecha: componentes React. La hoja verifica componentes reales; no reproduce contenido ni navegación de una pantalla de producto.

| Aspecto                | Evaluación CP1  | Evidencia / límite                                                                             |
| ---------------------- | --------------- | ---------------------------------------------------------------------------------------------- |
| Jerarquía              | PASA            | Objeto separado de meta; cuerpo 15 px, metadatos 13,5 px, glifo/palabra; pregunta 23 px        |
| Composición            | PASA con DEV-12 | Superficies y separación coherentes; hoja de pruebas independiente, shell real reservada a CP2 |
| Tipografía             | PASA            | Plex Sans real cargada; Serif local reservada a documentos; Manrope no solicitada              |
| Espaciado              | PASA            | Ritmo 4/8/12/16/20/24/32/48; márgenes móviles 16 px                                            |
| Densidad               | PASA            | Filas compactas, controles legibles; densidad del cuestionario se verificará en CP3            |
| Agrupación             | PASA            | Estado, acciones, campos, aportación y adjunto tienen contenedores semánticos propios          |
| Ubicación de acciones  | PASA            | Un primario en hoja; descarga junto al archivo; cierre de diálogo devuelve foco                |
| Tratamiento de estados | PASA            | Cinco familias con palabra y glifo, contraste sin depender solo de color                       |
| Responsive             | PASA            | Cinco anchos sin overflow ni texto colapsado; controles móviles ≥44 px                         |

Detectores de jerarquía antigua: los aplicables a la **base** (metadato dominante, estado solo por color, serif operativo, evidencia invisible y primarios múltiples) no se disparan. Los detectores de pantallas todavía no migradas **siguen pendientes**, no se declaran limpios anticipadamente.

### Incidencias de la verificación (sin debilitar tests)

1. TypeScript señaló índices opcionales en navegación por flechas; corregido con guardas de elemento en los componentes nuevos.
2. La hoja dev-only fuera del entry de Vite necesitaba el preámbulo oficial de React; corregido solo en el harness.
3. La hoja de pruebas no restauraba el foco al cerrar Dialog. El llamador añadió su ref/retorno, como requieren los flujos existentes; no se cambió Dialog ni la assertion.
4. Primer humo sobre la base usada por la suite anterior: 6/7. `Plazo de atención` ya estaba en borrador (el test anterior de respuestas lo guarda), por lo que aparecía `Continuar` en lugar de `Responder`. Clasificación: aislamiento de fixtures, no regresión visual. Se creó una base vacía adicional con migraciones/demo oficiales y el humo pasó 7/7, sin cambiar tests ni borrar datos existentes.

Copy nuevo: únicamente texto ficticio de la hoja de pruebas. Las nuevas primitivas reciben etiquetas del llamador; no redefinen estados ni mensajes de dominio.

## Checkpoint 2 — navegación y Atención (LISTO PARA REVISIÓN)

- `FRONTEND BEHAVIOR CHANGE`: navegación del proyecto trasladada a sidebar ≥1100, riel 760–1099 y cuatro destinos inferiores <760. Miembros se encuentra en Más herramientas solo para ADMIN; VIEWER conserva únicamente consulta/exportación. Participante conserva su shell. No hay destinos del prototipo ni contadores inferidos.
- `VISUAL ONLY`: Atención muestra primero las preguntas en grupos derivados y el resumen lateral con los cuatro conteos. Se conserva el listado completo en un desplegable cuyo estado permanece en la caché de contexto de sesión; ningún estado de negocio se modifica.
- `FRONTEND BEHAVIOR CHANGE`: agrupación pura de CONFLICT/ANSWERED (solo ANALYST+ACTIVE tiene «Te toca a ti»), aclaraciones sin atribuir turno y cobertura pendiente calculada; ADMIN/archivado tienen encabezados neutros. PARTIAL/PENDING sin participantes no reciben etiqueta de turno.
- DEV-03: el hook conserva y expone los textos de la bandeja que ya leía. ADMIN/archivado siguen usando el título disponible, sin nuevas lecturas. Paginación y concurrencia de lecturas permanecen iguales.
- Reemplazo de presentación: se retiraron `pw-navigation` y las cuatro tarjetas previas. Se preservaron consultas, invalidaciones, temporizador, filtros combinados, retry independiente, `workbenchReturn`, sesión caducada y cierre cancelable.
- Unit/component: **231/231** en 32 archivos, incluida agrupación por rol/estado y contexto. Gate final visual: **12/12**, diez capturas de Atención y dos recorridos de roles restringidos a cinco anchos.
- E2E inicial: 10/13. Escape propagaba desde el desplegable interior al menú exterior; se corrigió el handler con `stopPropagation`, sin cambiar su assertion. Los fallos restantes correspondían a selectores de jerarquía documentados abajo. Los diez casos originales de workbench pasaron tras esas correcciones; se añadió y pasó un undécimo que conserva apertura, foco y scroll del listado completo.
- Las diez comparaciones finales fueron abiertas y observadas; métricas, axe/teclado y humo pasan. Proyecto ARCHIVED no tiene comando público de transición en v0.5.0: se cubre su derivación con unit tests, sin modificar SQL ni API para fabricar evidencia. No se declara un recorrido visual ARCHIVED ni una prueba nueva de autorización backend.

### Libro de aserciones CP2

| Archivo                                                               | Antes                                          | Ahora                                                                           | Razón y garantía conservada                                                                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| ProjectWorkbench.test.tsx                                             | Navegación renderizada dentro del header       | Misma navegación probada con ProjectNavigation/ProjectToolsMenu junto al header | V-00: sidebar sustituye nav horizontal; roles, href, aria-current, encabezado único y children siguen verificados                   |
| ProjectWorkbench.test.tsx                                             | Escape enfocaba el nodo de texto summary       | Escape enfoca summary real, ahora con icono y span                              | El elemento interactivo conserva el foco, no el span decorativo                                                                     |
| ProjectWorkbench.test.tsx / next-workbench.spec.ts / platform.spec.ts | Miembros visible fuera de herramientas         | Abrir Más herramientas antes de verificar Miembros ADMIN, inexistente ANALYST   | Mapping §2.2 sitúa Miembros en Herramientas; no cambia permiso                                                                      |
| next-workbench.spec.ts                                                | Tres destinos en nav; Invitaciones aparte      | Cuatro destinos, Invitaciones incluido                                          | C exige cuatro destinos; se mantienen href y navegación por teclado                                                                 |
| ProjectAttention.test.tsx / next-workbench.spec.ts                    | Título de pregunta era enlace además del botón | Un enlace de acción por pregunta con nombre exacto «acción: título»             | V-01 exige CTA único; título y texto de pregunta siguen visibles; mismo destino, foco y workbenchReturn                             |
| next-workbench.spec.ts                                                | Contar todos los listitem descendientes        | Contar hijos li directos de Casos de atención                                   | MetaLine añade una lista semántica de metadatos dentro de cada fila; conteo exacto de preguntas conserva 1/2/1 casos y solapamiento |
| next-workbench.spec.ts                                                | Herramientas siempre en header                 | En riel/móvil abrir Menú, luego Más herramientas                                | V-00: misma ruta, Escape y retorno de foco, sin relajar assertions                                                                  |

La preparación E2E de workbench se extrajo a `tests/e2e/fixtures/workbench.ts` para reutilizar la misma API real en el gate visual. Por defecto conserva 54 preguntas de las pruebas anteriores; el gate visual solicita 304 o usa el archivo de IDs ficticios sembrados. No hay SQL, nuevas APIs ni modificación de contratos.

Copy añadido: «Te toca a ti», «En espera de otras personas», «Sin participantes asignados», «Faltan N de N aportaciones», «Consulta: las acciones corresponden al equipo analista», «Revisar y decidir», «Menú» y «Todas las preguntas (N)». Los textos de turno siguen las decisiones B/DEV-19. Revisión editorial humana pendiente; no se interpreta consenso ni asignación implícita.

### Resultados finales CP2

| Comprobación                         | Evidencia real                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Lint, typecheck, build completo      | PASS; continúa únicamente la advertencia preexistente de bundle >500 kB                                                                   |
| Unit/component                       | 231/231, 32 archivos, sin skips                                                                                                           |
| Workbench existente                  | Los 10 casos pasan: 9/10 en el pase completo y el caso restante 1/1 tras actualizar el nombre accesible del CTA; no se suman como 11      |
| Retorno desde listado completo       | 1/1 nuevo: desplegable abierto, foco en la misma pregunta y scroll con diferencia <5 px                                                   |
| Simplicity                           | 3/3 en el pase conjunto inicial                                                                                                           |
| Humo plataforma sobre base vacía CP2 | 6/7 inicialmente; Miembros requiere abrir Más herramientas. Caso afectado 1/1 tras adaptar esa navegación; los 7 casos quedan verificados |
| Preparación aislada del humo         | 10 migraciones oficiales y demo oficial; no se borraron bases existentes                                                                  |
| Visual shell/Atención                | 12/12: ANALYST y ADMIN ×5 anchos + VIEWER y participante ×5 anchos sin accesos privilegiados                                              |
| Fixture visual autónomo              | 1/1 adicional: crea 304 preguntas usando el helper de API, sin necesitar archivo privado de IDs                                           |
| Axe                                  | 0 violaciones en las 10 vistas de Atención; no se atribuye este resultado a las pantallas VIEWER/participante aún no migradas             |
| Teclado/foco                         | Menú, herramientas, Escape con retorno, rutas, cierre cancelable y regreso al listado                                                     |
| Integración PostgreSQL/backend       | No repetida en CP2: 113/113 de línea base; backend/contratos/Prisma no cambiaron                                                          |

**Incidencia de infraestructura:** el primer intento de migración del humo usando `node --run` no propagó la configuración aislada al subproceso. Prisma denegó acceso antes de aplicar migraciones. Se sustituyó solo el comando local de verificación por la ejecución directa de Prisma con ambas URL comprobadas contra la base desechable CP2; las 10 migraciones y el seed oficial se ejecutaron correctamente. No se modificó tooling del producto.

### Métricas y comparación final CP2

Datos completos: [metrics-cp2.json](acta-direction-c-evidence/metrics-cp2.json). Cada vista contiene medición de hijos fuera de su contenedor, texto comprimido, viewport, controles, texto principal/metadatos y un CTA de revisión por fila. Las referencias de trazabilidad siguen siendo enlaces auxiliares, como exige el contrato existente.

| Ancho | Primera fila ANALYST | Primera fila ADMIN | Shell lateral  | Axe ANALYST/ADMIN | Overflow / texto comprimido |
| ----- | -------------------- | ------------------ | -------------- | ----------------- | --------------------------- |
| 1440  | 322,81 px            | 318,70 px          | 248 px         | 0 / 0             | 0 / 0                       |
| 1024  | 338,81 px            | 334,70 px          | 64 px          | 0 / 0             | 0 / 0                       |
| 768   | 342,81 px            | 362,70 px          | 64 px          | 0 / 0             | 0 / 0                       |
| 390   | 372,66 px            | 392,55 px          | barra inferior | 0 / 0             | 0 / 0                       |
| 320   | 393,58 px            | 413,47 px          | barra inferior | 0 / 0             | 0 / 0                       |

El límite y≤400 corresponde a escritorio 1440×900: ambas variantes cumplen. La diferencia frente a y≈281 de C es <80 px y proviene de conservar el filtro de estado y conteo reales. En móvil se conserva la pregunta completa y se coloca la acción debajo, sin reducir el texto para imitar el truncado del prototipo. Las capturas de producto usan 320×640; algunas referencias del laboratorio tienen mayor altura, por eso la hoja pareada muestra un margen neutro inferior.

Comparaciones vistas (referencia izquierda, React derecha):

- ANALYST: [1440](acta-direction-c-evidence/cp2/V-01-compare-1440.png), [1024](acta-direction-c-evidence/cp2/V-01-compare-1024.png), [768](acta-direction-c-evidence/cp2/V-01-compare-768.png), [390](acta-direction-c-evidence/cp2/V-01-compare-390.png), [320](acta-direction-c-evidence/cp2/V-01-compare-320.png).
- ADMIN: [1440](acta-direction-c-evidence/cp2/V-01b-admin-compare-1440.png), [1024](acta-direction-c-evidence/cp2/V-01b-admin-compare-1024.png), [768](acta-direction-c-evidence/cp2/V-01b-admin-compare-768.png), [390](acta-direction-c-evidence/cp2/V-01b-admin-compare-390.png), [320](acta-direction-c-evidence/cp2/V-01b-admin-compare-320.png).

La referencia ADMIN se deriva de C ANALYST: no hay referencia específica en el laboratorio (DEV-20). Las cinco capturas ADMIN «before» se tomaron después de CP1, antes de CP2: incorporan los tokens globales; no se presentan como capturas intactas de v0.5.0. La base ANALYST sí corresponde al pase inicial.

| Aspecto                | V-00 / V-01 ANALYST | V-01b ADMIN           | Evidencia y adaptación                                                                                                      |
| ---------------------- | ------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Jerarquía              | PASA                | PASA con DEV-03/20    | H1 Atención; pregunta 15 px/500 antes de metadatos 13,5 px; ADMIN usa título disponible                                     |
| Composición            | PASA                | PASA con DEV-20       | Cola principal y resumen a la derecha en escritorio; resumen debajo ≤1099; consulta sin turno propio                        |
| Tipografía             | PASA                | PASA                  | Plex Sans; no serif en navegación, controles o estados; mínimo 12,5 px                                                      |
| Espaciado              | PASA                | PASA                  | Márgenes 48/32/16; ritmo por grupos; sidebar 248, riel 64; contexto sin margen heredado de details                          |
| Densidad               | PASA                | PASA con DEV-03       | Primera fila <400 a 1440; no cuatro tarjetas previas. Texto completo, conteos y explicación reales; no extractos inventados |
| Agrupación             | PASA con DEV-19     | PASA con DEV-19/20    | Conflictos primero, luego ANSWERED; aclaraciones preservan solapamiento; ADMIN usa títulos neutros                          |
| Ubicación de acciones  | PASA                | PASA                  | Un CTA de revisión por fila, a la derecha/abajo según ancho; herramientas y cuenta accesibles                               |
| Tratamiento de estados | PASA con DEV-19/22  | PASA con DEV-19/20/22 | Glifo + palabra, acento por instalación; no se atribuye turno de una aclaración sin dato                                    |
| Responsive             | PASA                | PASA                  | Cinco anchos medidos y observados; sin overflow de página/hijos ni texto comprimido; controles ≥44 px a ≤899                |

Detectores 3 y 12: no se disparan; desaparecen las cuatro tarjetas antes de preguntas y `pw-navigation`. En estas vistas también se verificaron meta subordinada, un CTA por fila, estados con glifo/palabra y ausencia de serif operativo. Los detectores de revisión/decisión/cuestionario/evidencia no se declaran resueltos por CP2.

**Límites:** ARCHIVED cubierto en tabla de verdad, no en navegador; distribución 304 del fixture y conteos reales difieren de los orientativos de C; no se inventan avisos de actualización, extractos ni contadores de navegación. El menú móvil añade acceso explícito a la cuenta para conservar operaciones reales. Aceptación visual y editorial humana pendiente. En el cierre de CP3 DEV-25 seguía pendiente; la autorización posterior y su ejecución se documentan en CP4.

Cierre técnico CP2: Gitleaks 8.30.1 sobre los 662 archivos candidatos del snapshot: **0 hallazgos**. Enlaces relativos de este informe: **18/18** resueltos. `git diff --check`: PASS. Hashes de documentos ajenos y stash previo: sin cambios. El escaneo no incorpora `.env`, bases ni logs de prueba.


## Checkpoint 3 — registro histórico de implementación (resultados finales más abajo)

Base del checkpoint: `e76eead`. Se capturaron Preparar, Analizar, selección de 40, diálogo de publicación sin confirmar y autoría sin guardar a los cinco anchos antes de modificar estas pantallas; sus 25 registros están en `baseline-metrics.json`. Son capturas posteriores a CP2; la línea base original v0.5.0 se conserva aparte. Tabla semántica con columnas por enfoque, filtros móviles y barra de selección en implementación. Solo presentación y controles de foco; consultas, contratos y operaciones conservados. Aún no hay aceptación ni commit CP3: pendientes métricas, comparación visual, pruebas completas, autoría y diálogos.

### Libro de aserciones CP3 (en curso)

- `QuestionnairePresentation`: la prueba de 0/1/3/12 aportaciones debe elegir **Analizar**, porque Preparar ahora presenta participantes asignados. Cambio intencional exigido por las columnas por lente. Se conservan todas las aserciones de números, carga, error y navegación; se añaden aserciones de ambas cabeceras. Resultado inicial: 1 fallo por esa expectativa antigua y 6 archivos verdes; no era un cambio de contrato.
- La primera medición visual encontró una colisión de cascada con `editor.css`: el contenedor mantenía 210 px de ancho. Se corrige la especificidad del contenedor completo; no se reduce tipografía. La medición se repetirá antes de aceptar.
- En móvil, los tres alcances reales de selección y su explicación se conservan en un desplegable **Seleccionar preguntas**; las casillas individuales y el alcance de la selección activa permanecen visibles. C no representa esos tres alcances completos. Adaptación de composición para conservarlos sin desplazar toda la lista bajo controles; no cambia los conjuntos seleccionados. Pendiente revisión visual humana.

- `BulkSelection`, `QuestionnairePresentation`, `bulk.spec` y `next-questionnaire.spec`: abren **Seleccionar preguntas** antes de comprobar los mismos alcances; no cambian los conteos, exclusiones, condiciones ni resultados. `next-workbench` abre Filtros bajo 900 px antes de elegir área/publicación y conserva las aserciones de retorno. Desde **Revisar publicación conjunta**, el alcance se abre automáticamente, conservando el acceso y foco ya probado por `simplicity`.
- Autoría: pregunta → tipo → configuración dependiente → ubicación/obligatoriedad → identificación → avanzadas; pie Cancelar → Crear/Guardar, con las mismas acciones y etiquetas. Los identificadores reales siguen siendo obligatorios. DEV-09: vista previa en vivo opcional no implementada; Vista previa del cuestionario existente permanece. Pendiente comparación final.

### Evidencia parcial CP3

- Frontend unit/component: **174/174, 22 archivos**, tras los cambios de presentación y alcance. Lint PASS; tipos PASS después de corregir una opción exclusiva de Playwright usada por error en Testing Library. Build PASS, con el aviso preexistente de tamaño del bundle.
- Medición exploratoria (no gate final): Preparar 1440×900 muestra **5 filas completas**, quinta termina en y=894.53; tabla sticky, 40 filas. Axe **0** en Preparar y autoría a los cinco anchos. Falta integrar todas las medidas en la suite visual y mirar cada comparación.
- E2E en curso: `bulk` cambió a 390 px durante su inspección responsive y después intentó elegir área sin abrir el nuevo panel **Filtros**. Fallo intencional de recorrido; se añade abrir el panel, manteniendo la comprobación de las 304 áreas. Su siguiente caso depende del estado del primero y quedó sin cambios aplicables tras reiniciarse el worker; se repetirá el archivo completo una vez corregido el recorrido, sin retries ni cambios de timeout.
- Los originales del fixture y las capturas previas permanecen sin cambios. No se confirmó ninguna publicación sobre el proyecto visual de referencia.


## Checkpoint 3 — cuestionario, selección y autoría (LISTO PARA REVISIÓN)

Base del checkpoint: `e76eead`. Las 25 capturas «before» se tomaron después de CP2 y antes de modificar estas pantallas; los registros identifican ese commit en `baseline-metrics.json`. La línea base original de v0.5.0 permanece separada. No hay aceptación visual humana del checkpoint todavía.

- **VISUAL ONLY:** Organizar reemplaza las filas flex por una tabla de seis columnas; cada tema forma su propio `tbody` con encabezado de grupo. Se conserva el orden original de página. Pregunta primero, metadatos subordinados, contexto de seguimientos, columnas según Preparar/Analizar y cabecera fija. Bajo 900 px las mismas filas refluyen en tarjetas.
- **FRONTEND BEHAVIOR CHANGE:** filtros accesibles mediante un botón en móvil y selección por página/resultados/tema dentro de «Seleccionar preguntas». Casillas individuales, avisos y alcances reales se conservan. La barra activa muestra cantidad, alcance y las cinco acciones existentes; publicar es la acción primaria. No cambia ninguna operación ni cálculo de selección.
- **VISUAL ONLY:** autoría prioriza pregunta → tipo → configuración dependiente → ubicación/obligatoriedad → identificación → avanzadas. Ocho radios nativos en tarjetas, pie de acciones persistente, mismos handlers, Zod, campos técnicos, errores, bloqueo de salida y guardado. DEV-09: la vista previa en vivo opcional no se implementa; Vista previa del cuestionario permanece.
- **Conservación:** 304 preguntas, paginación de 40, grupos, selección, filtros, contexto y scroll al volver, inspector, invitación desde selección, los tres modos reales del editor, MATRIX, condiciones, `previewHash`, atomicidad y conflictos de versión. No hay consultas nuevas ni cambios de contrato. El proyecto visual no recibió guardados ni confirmaciones de lote.

### Pruebas y métricas observadas

| Gate | Resultado final |
| --- | --- |
| Lint / typecheck / build | PASS; bundle frontend 743,64 kB con aviso preexistente >500 kB |
| Unit/component frontend | 174/174, 22 archivos |
| E2E editor/workbench/simplicity | 22/22 |
| E2E bulk/next-questionnaire | 6/6 |
| Suite visual CP3 | 15/15; 20 registros de métricas |
| Suite CP3 con fixture propio desde API, sin fixture privado | 3/3, escritorio |
| Axe | 0 en las vistas medidas, barra de selección y diálogos a los cinco anchos |
| Teclado/foco | Escape devuelve foco en filtros/temas/lote; limpiar selección enfoca estado; controles existentes conservados |

[Mediciones completas](acta-direction-c-evidence/metrics-cp3.json). La integración PostgreSQL de base permanece en 113/113; no se repitió esa suite completa porque no hay cambios backend. Los E2E sí usan API y PostgreSQL reales del entorno desechable.

| Ancho | Filas completas inicialmente (Preparar / Analizar) | Lectura de primera pregunta | Reflujo/objetivos |
| --- | --- | --- | --- |
| 1440 | 5 / 5 | Completa, borde inferior y=535,78 | Sin overflow; ≥24 px |
| 1024 | 3 / 3 | Completa, y=551,78 | Sin overflow; ≥24 px |
| 768 | 1 / 1 | Completa, y=605,83 / 627,42 | Sin overflow; ≥44 px |
| 390 | 1 / 1 | Completa, y=572,31 / 589,81 | Sin overflow; ≥44 px |
| 320 | 0 / 0 | Completa tras desplazamiento; y=277,91…361,91 | Sin overflow; ≥44 px; DEV-26 |

Pregunta de autoría: 20 px Plex Sans, campo de 113 px de alto, pie visible en todos los anchos. Textos medidos ≥12,5 px; sin texto comprimido. La densidad de cinco filas se exige a 1440×900, no en móvil.

### Revisión visual comparada

Se abrieron y observaron las 25 comparaciones finales, además de las dos capturas de reflujo a 320 px. Referencia izquierda, React derecha. A 320 se normaliza la altura de comparación a 640 px porque la referencia tiene escala de píxeles 2×; las capturas originales no se modifican. Las comparaciones restantes usan el límite de altura 900 px.

- Analizar: [1440](acta-direction-c-evidence/cp3/V-02-compare-1440.png), [1024](acta-direction-c-evidence/cp3/V-02-compare-1024.png), [768](acta-direction-c-evidence/cp3/V-02-compare-768.png), [390](acta-direction-c-evidence/cp3/V-02-compare-390.png), [320](acta-direction-c-evidence/cp3/V-02-compare-320.png).
- Preparar: [1440](acta-direction-c-evidence/cp3/V-02b-compare-1440.png), [1024](acta-direction-c-evidence/cp3/V-02b-compare-1024.png), [768](acta-direction-c-evidence/cp3/V-02b-compare-768.png), [390](acta-direction-c-evidence/cp3/V-02b-compare-390.png), [320](acta-direction-c-evidence/cp3/V-02b-compare-320.png).
- Selección activa: [1440](acta-direction-c-evidence/cp3/V-02c-selection-compare-1440.png), [1024](acta-direction-c-evidence/cp3/V-02c-selection-compare-1024.png), [768](acta-direction-c-evidence/cp3/V-02c-selection-compare-768.png), [390](acta-direction-c-evidence/cp3/V-02c-selection-compare-390.png), [320](acta-direction-c-evidence/cp3/V-02c-selection-compare-320.png).
- Preview de lote: [1440](acta-direction-c-evidence/cp3/V-02c-compare-1440.png), [1024](acta-direction-c-evidence/cp3/V-02c-compare-1024.png), [768](acta-direction-c-evidence/cp3/V-02c-compare-768.png), [390](acta-direction-c-evidence/cp3/V-02c-compare-390.png), [320](acta-direction-c-evidence/cp3/V-02c-compare-320.png).
- Autoría: [1440](acta-direction-c-evidence/cp3/V-03-compare-1440.png), [1024](acta-direction-c-evidence/cp3/V-03-compare-1024.png), [768](acta-direction-c-evidence/cp3/V-03-compare-768.png), [390](acta-direction-c-evidence/cp3/V-03-compare-390.png), [320](acta-direction-c-evidence/cp3/V-03-compare-320.png).

Reflujo autorizado: [Analizar 320](acta-direction-c-evidence/cp3/V-02-reflow-320.png), [Preparar 320](acta-direction-c-evidence/cp3/V-02b-reflow-320.png). No existe una captura específica de diálogo de lote abierto en C: V-02c contrasta la gramática del cuestionario y del diálogo compartido, conservando íntegro el preview real; no se afirma equivalencia de píxeles ni de datos.

| Aspecto | V-02 Analizar | V-02b Preparar | V-02c selección/lote | V-03 autoría |
| --- | --- | --- | --- | --- |
| Jerarquía | PASA: pregunta antes de meta | PASA: pregunta antes de asignación | PASA: alcance → acciones → resultado | PASA: pregunta domina formulario |
| Composición | PASA con DEV-16: modos reales conservados | PASA con DEV-16 | PASA: barra contextual + diálogo real | PASA con DEV-09: sin preview opcional |
| Tipografía | PASA: Sans 15/12,5 px | PASA: Sans 15/12,5 px | PASA: etiquetas legibles | PASA: pregunta 20 px Sans |
| Espaciado | PASA: columnas estables | PASA: filas y grupos | PASA: acciones separadas | PASA: secciones progresivas |
| Densidad | PASA: 5 filas a 1440 | PASA: 5 filas a 1440 | PASA: datos y acciones sin recorte; barra móvil más alta por 5 acciones reales | PASA: contenido desplazable, pie fijo |
| Agrupación | PASA: tema/seguimientos | PASA: `tbody` por tema | PASA: alcance explícito, resultados plegables | PASA: tipo y configuración asociados |
| Acciones | PASA: una acción por fila | PASA: editar borrador o revisar publicada | PASA: publicar primario, otras acciones conservadas | PASA: Cancelar → Crear/Guardar |
| Estados | PASA: glifo + palabra, carga/error ≠ cero | PASA: publicación separada de respuesta | PASA: NOOP no permite confirmar | PASA: selección de tipo y cambios sin guardar |
| Responsive | PASA con DEV-26 a 320 | PASA con DEV-26 a 320 | PASA: controles ≥44; diálogo desplazable a 320 | PASA: dos columnas móviles, pregunta completa |

Los datos orientativos de C (252 publicadas y avatares) se sustituyen por valores verdaderos del fixture (304 publicadas, conteos de asignación/aportaciones reales). No se inventan personas ni estados. La barra de selección móvil conserva las cinco operaciones y ocupa más altura que la referencia; no elimina el acceso por scroll a la lista. La aprobación visual humana sigue pendiente.

### Libro de aserciones e incidencias CP3

1. `QuestionnairePresentation.test.tsx`: Preparar presenta participantes; para verificar 0/1/3/12 aportaciones se activa Analizar. Se mantienen las assertions de números/carga/error/navegación y se añaden las dos cabeceras de columnas (V-02/V-02b).
2. `BulkSelection.test.tsx`, `QuestionnairePresentation.test.tsx`, `bulk.spec.ts`, `next-questionnaire.spec.ts`: abrir «Seleccionar preguntas» antes de usar los mismos alcances. Mismos conteos, exclusiones, condiciones y resultados. Desde Revisar publicación conjunta el panel se abre automáticamente; `simplicity` conserva sus assertions.
3. `next-workbench.spec.ts` y `bulk.spec.ts`: abrir Filtros a <900 px antes de elegir área/publicación; mismos valores y comprobación de contexto, selección y 304 preguntas. El primer pase bulk falló por no abrir el panel; el archivo completo pasó tras actualizar ese recorrido, sin retries.
4. La primera medición reveló un contenedor reducido a 210 px por cascada antigua: se corrigió la implementación CSS, no los criterios. Se corrigió también el salto de palabra de «Requiere aclaración» en tablet.
5. **DEV-26, autorizada por producto el 2026-10-08:** una assertion visual nueva pedía toda la primera pregunta sin scroll también a 320×640, requisito adicional al plan. El usuario autorizó comprobar a 320 el reflujo y la lectura completa después de desplazarse, conservando todos los controles, las pruebas previas y las cinco filas de escritorio. Se registra la posición inicial real y la posición tras scroll. Esta autorización no equivale a aceptación visual global del checkpoint.
6. Un pase de 22 E2E obtuvo 21/22: la compilación simultánea de contratos disparó HMR y reinició el inspector mientras axe lo inspeccionaba. El registro de Vite confirmó las invalidaciones; la prueba aislada pasó sin cambios. Se repitió la suite secuencialmente, sin compilaciones simultáneas: 22/22. No se alteraron assertions, timeout ni retries para este fallo de ejecución.

Copy añadido para revisión: «Seleccionar preguntas», «Ubicación y obligatoriedad», «Buscar por texto o código…». Se conservan las etiquetas reales de Crear pregunta, guardado, estados y operaciones. Detectores aplicables: no reaparece la ficha expandida antigua en Organizar; pregunta antes de identificadores; cinco filas de escritorio; autoría con campo protagonista; un primario; no estados solo por color. Los detectores de revisión/decisión siguen reservados a sus checkpoints.

### Cierre de alcance CP3

Backend, contratos, Prisma, almacenamiento y Compose sin diferencias respecto de v0.5.0. Documentos ajenos y stash preservados. Revisión humana de accesibilidad pendiente (lector de pantalla, zoom real, colores forzados, dispositivos táctiles, otros navegadores); axe no acredita conformidad WCAG.

Cierre técnico CP3: Gitleaks 8.30.1 sobre 740 archivos candidatos: **0 hallazgos**. Enlaces relativos de este informe: **46/46** resueltos. Residual scan de los cambios: **0 coincidencias** privadas/institucionales. `git diff --check`: PASS. Hashes de archivos ajenos y stash previo: sin cambios.

## Checkpoint 4 — revisión y aportaciones (LISTO PARA REVISIÓN)

Base de trabajo: CP3 `ef37b4f`. Se conservaron las capturas previas de v0.5.0 y se añadieron 30 capturas inmediatamente anteriores a CP4 (incluyen shell/CP3). La revisión se reorganiza con pregunta completa, tarjeta de estado, pestañas y riel/panel. El cierre incluye V-07 y el caso parcial separado, ambos creados mediante API; las pruebas pasan y la aceptación visual humana sigue pendiente. Los conflictos, decisiones e hilos conservan por ahora su contenido existente; su rediseño completo pertenece a CP5 y espera autorización humana.

DEV-25 autorizada y aplicada: no se fuerza PARTIAL en el caso de 50. El contrato público entrega la proyección como `ReviewDetail.status`, calculada por el backend (`projectedStatus`); el frontend conserva su autoridad.

### Libro de aserciones CP4

- `review.spec.ts`: h1 se verifica contra el texto completo de la pregunta, no su título abreviado (jerarquía autorizada V-04). Los selectores del estado apuntan a `StateCard/StatusChip`; se conserva la etiqueta exacta y su visibilidad. La consulta de decisiones históricas de no-aplica abre Historial antes de comprobar el mismo contenido.
- Pruebas nuevas: la ruta de retorno correcta es `/dashboard`, no `/attention`; el fixture VIEWER tiene una única fuente vigente, por lo que debe decir “1 aportación”. Errores de preparación de pruebas corregidos conservando la comprobación del destino y del número real.
- Primer E2E: 3/4. Regresión detectada en no-aplica: Reabrir quedaba en la pestaña Decisión mientras el estado no-aplica abría Aportaciones. Se corrige la pestaña predeterminada para ese estado terminal; no se retira ni debilita la aserción de reapertura.
- La prueba pura nueva sigue la extensión `.test.tsx` de la configuración frontend existente; el primer intento `.test.ts` no fue descubierto por Vitest y no se contó como PASS.

- `next-workbench.spec.ts`: cuatro verificaciones de encabezado siguen ahora la pregunta completa (mismo ID/ruta); permanecen las aserciones de filtros, selección, foco y scroll. La decisión vigente de VIEWER se comprueba dentro de su documento, distinguiéndola del resumen del estado que ahora comparte el mismo titular.
- Primera suite visual CP4: 19/30. Detectó respuesta única a y=680,55 (>640) y texto heredado de aclaración inferior a 12,5 px. Se compacta la tarjeta de estado sin eliminar acciones y se corrige el tamaño de la etiqueta dentro de revisión. Segunda suite: 30/30 en 0/1/3/12 aportaciones y ADMIN/VIEWER. Tras aprobar DEV-25, el pase final llega a 40/40 vistas y 1/1 comprobación adicional de permisos.
- Revisión de conservación detectó fecha ausente en el nuevo bloque histórico; se restituyó junto con número, área y marca Histórico y se añadió una prueba explícita.

- La comprobación adicional de foco tras validar reprodujo una regresión: al desaparecer el botón primario, el foco quedaba en `body` (1 fallo; los otros 3 escenarios seriales no se ejecutaron). Se conserva la restauración del disparador al cancelar y, al terminar las invalidaciones, se enfoca el h1 solo si el foco se perdió. El E2E ahora exige h1 enfocado tras validar; los 15 recorridos pasan, sin retries ni aumento de tiempos.
- Se corrigió únicamente la concordancia “1 aclaración abierta”; se prueban 0/1/2 sin cambiar la acción ni el estado.
- Las mediciones nuevas comprueban hijos dentro de su contenedor, ausencia de texto colapsado y un máximo de tres apariciones por actor en el panel inicial de aportaciones. No se elimina ninguna aserción anterior.
- Correcciones posteriores a la auditoría independiente: el único cambio de una aserción existente (`ContributionComparison.test.tsx`) y sus pruebas figuran en «Auditoría independiente y correcciones posteriores de CP4», al final de esta sección.

### Resultados CP4 ejecutados

| Comprobación | Resultado real |
|---|---|
| Lint, tipos y build completo | PASS; contratos/backend solo se compilan, sin cambios de código |
| Unit/component | 264/264, 34 archivos, sin skips; 207 frontend + 57 unitarias restantes; incluye 26 casos de derivación del turno |
| Revisión y navegación/contexto E2E | 15/15 Chromium, después de corregir el foco; sin retries |
| Matriz visual de revisión | 40/40: 8 variantes × 5 anchos; añade 50 aportaciones reales y parcial separado |
| Permisos del caso de 50 | 1/1 gate: ADMIN 200/solo lectura, VIEWER 404, participante 403, anónimo 401 |
| Axe | 0 violaciones en entrada predeterminada y panel de aportaciones de las 40 vistas |
| Fixture autónomo de la suite | 6/6 a 1440; crea sus datos por API, verifica sus conteos reales 0/1/2 y no los presenta como 3/12/50 |
| PostgreSQL / evidencia | Recorridos E2E con API/DB desechables y archivo ficticio: envío, descarga, aclaración, conflicto, decisión, reapertura y lectura filtrada |
| Integración general | No se repite: línea base 113/113; no cambia backend/contratos/storage. Esto no constituye una nueva verificación S3 |
| Build frontend | Advertencia preexistente de bundle >500 kB; resultado 753,71 kB sin comprimir. No se modifica el umbral |

Los tests de componente de 50 aportaciones (selección, filtros, vigentes e históricos) se complementan con V-07: 50 envíos reales, cinco anchos, teclado hasta la última aportación, filtros por actor/área/situación y lectura del detalle. Se preserva la selección al filtrar en escritorio y se devuelve el foco al volver a la lista en móvil.

### Métricas y comparativas CP4

[Mediciones completas](acta-direction-c-evidence/metrics-cp4.json). Todos los valores siguientes son del viewport 1440×900 con Aportaciones activa. En las seis variantes, h1 a y=117,5, Plex Sans 23 px/600. No hay scroll horizontal, texto comprimido ni hijos fuera del contenedor en el panel medido. Objetivos ≥44 px bajo 900; texto ≥12,5 px.

| Variante | Primera respuesta completa, y | Riel | Primarios visibles | Nombre repetido, máximo | Comparativa escritorio / móvil |
|---|---:|---:|---:|---:|---|
| V-04 · 1 | 627,63 | No | 1 | 1 | [1440](acta-direction-c-evidence/cp4/V-04-compare-1440.png) / [390](acta-direction-c-evidence/cp4/V-04-compare-390.png) |
| V-05 · 3 | 586,44 | 295 px | 1 | 3 | [1440](acta-direction-c-evidence/cp4/V-05-compare-1440.png) / [390](acta-direction-c-evidence/cp4/V-05-compare-390.png) |
| V-06 · 12 | 586,44 | 295 px | 1 | 2 | [1440](acta-direction-c-evidence/cp4/V-06-compare-1440.png) / [390](acta-direction-c-evidence/cp4/V-06-compare-390.png) |
| V-08 · 0 | No hay respuesta | No | 0 | 0 | [1440](acta-direction-c-evidence/cp4/V-08-compare-1440.png) / [390](acta-direction-c-evidence/cp4/V-08-compare-390.png) |
| V-13 · ADMIN | 559,17 | 295 px | 0 | 3 | [1440](acta-direction-c-evidence/cp4/V-13-admin-compare-1440.png) / [390](acta-direction-c-evidence/cp4/V-13-admin-compare-390.png) |
| V-14 · VIEWER | 506,77 | 295 px | 0 | 2 | [1440, Decisión predeterminada](acta-direction-c-evidence/cp4/V-14-viewer-compare-1440.png) / [390](acta-direction-c-evidence/cp4/V-14-viewer-compare-390.png) |

También se inspeccionaron las 30 comparativas a 1440, 1024, 768, 390 y 320. Las imágenes `-default` muestran la pestaña derivada del estado; `-after` muestra Aportaciones; `-detail` muestra el acceso al panel en tamaños menores de 900. Se mantienen las capturas originales v0.5.0 y las 30 `-before-cp4` posteriores a CP3.

**Alcance de esta valoración:** solo composición CP4 y paneles de aportaciones. No certifica el diseño final de Contraste, hilos o documento de decisión, que siguen pendientes de CP5. En particular, V-14 mantiene el documento anterior; no se declara equivalente al documento serif de la referencia.

| Aspecto | V-04 (1) | V-05 (3) | V-06 (12) | V-08 (0) | V-13 / V-14, base de solo lectura |
|---|---|---|---|---|---|
| Jerarquía | PASA: pregunta antes de respuesta | PASA | PASA | PASA: vacío sin riel | PASA: pregunta y estado; documento CP5 pendiente |
| Composición | PASA: panel único | PASA: riel/panel ≥900 | PASA: filtros + riel/panel | PASA: texto vacío real | PASA: misma base sin controles de mutación |
| Tipografía | PASA: 23/600; número 26 | PASA: cuerpo 17/meta ≤14 | PASA | PASA | PASA en base; voz documental final pendiente |
| Espaciado | PASA: grupos diferenciados | PASA | PASA | PASA | PASA en base |
| Densidad | PASA escritorio; móvil requiere scroll | PASA escritorio; móvil requiere scroll | PASA escritorio; filtros elevan la lista móvil | PASA vacío según datos reales | PASA escritorio; lectura móvil desplazable |
| Agrupación | PASA: respuesta/contexto/evidencia | PASA: fuente seleccionada e hilo asociado | PASA | PASA: sin tarjetas de respuesta ficticias | PASA: datos del contrato por rol |
| Ubicación de acciones | PASA: tarjeta de estado | PASA: tarjeta + hilo | PASA: tarjeta + hilo | PASA: menú real; no CTA inventada | PASA: sin acciones de revisión |
| Estados | DEV-08/19: turno y estado reales | DEV-08/19 | DEV-08/19 | DEV-08/19: sin asignación | Decisión E: consulta, nunca “Te toca a ti” |
| Responsive | PASA: reflujo cinco anchos | PASA: lista → detalle <900 | PASA: lista → detalle <900 | PASA: sin desbordamiento | PASA: composición según permiso real |

**Diferencias visuales que deben revisarse expresamente:**

1. En móvil se lee la pregunta completa, sin el truncamiento de la maqueta. La cabecera de contexto real, “Otras acciones” y las pestañas en dos filas mantienen navegación, permisos y controles táctiles. Ocupan más altura; no se afirma que la primera aportación sea visible sin desplazarse. La autorización DEV-26 se limita a Organizar a 320 px, no es una aprobación general de estas pantallas.
2. A 1024 px se usa tarjeta de estado lateral y riel/panel, conforme al umbral ≥900 del Mapping §3.4. Algunas capturas del prototipo muestran la composición apilada a ese ancho.
3. Se conserva el orden recibido del servidor: en 3 aportaciones Renata aparece primero; en 12, Alejandra. No se inventa una prioridad para reproducir la persona seleccionada en la maqueta. La aportación completa, evidencia e hilo permanecen disponibles al seleccionar otra persona.
4. DEV-01/02: al entrar directamente, código y área responsable pueden faltar en la caché; se omiten sin añadir consultas. No se confunde área de quien responde con área responsable de la pregunta.
5. El caso JSON `review-0` no declara asignaciones: el caso sembrado no tiene participantes y muestra el texto real correspondiente. La maqueta sí muestra tres; no se inventaron personas o asignaciones para copiarla. Las otras variantes de vacío tienen cobertura de componente.
6. El riel usa bordes y espacios entre filas seleccionables, sin avatares decorativos. Comparte superficie con el panel en escritorio. Es una diferencia visual explícita, no una aceptación humana implícita.
7. En V-13 la referencia disponible es la de analista; se retiran solo los controles no autorizados y se conserva el contenido. V-14 recibe únicamente fuentes de la decisión vigente, conforme al filtrado del servidor.

### Conservación funcional y detectores

- `ReviewActionDialog` permanece íntegro: campos, versiones, requestId, fuentes, 409 y descarte. Las mismas consultas se invalidan; se añadió solo el fallback de foco demostrado necesario tras una mutación que retira su disparador.
- No se añaden endpoints ni consultas por pregunta. El test de presentación verifica que solo se invocan las consultas de proyecto y revisión existentes.
- `?tab=` conserva otros parámetros y `location.state`; regreso desde Atención, Cuestionario y Decisiones mantiene contexto. Las pestañas responden a flechas/Home/End; móvil retorna al botón de la aportación.
- Una aportación no se convierte en “consenso”. Vigentes e históricos se cuentan por separado. Al filtrar, la aportación ya elegida puede seguir abierta; al perder vigencia sale del panel y se conserva en historial.
- Número/fecha/sí-no, texto, comentario, ejemplo, evidencia, hilos, participantes, no-aplica, conflictos resueltos y referencias tienen ubicación; no se eliminan por adoptar pestañas.
- Detectores aplicables a CP4 (1,2,4,5,6,9,11,12,13,14): no observados en la superficie de aportaciones medida. Los detectores 7 y 8 del detalle de contraste/decisión **siguen pendientes de CP5**; no se declaran resueltos aquí. Cuestionario y Atención conservan su evidencia CP2/3.
- No se vuelve a afirmar conformidad WCAG. Quedan lector de pantalla, zoom real, colores forzados, táctil, modo oscuro y otros navegadores sin verificar.

### Copy nuevo CP4 para confirmación editorial (DEV-08)

“Te toca a ti”, “En espera de aclaración”, “En espera de aportaciones”, “Hay diferencias por resolver”, “Llegó una respuesta a la aclaración”, “Lista para decidir”, “Faltan n de m personas asignadas”, “Sin participantes asignados”, “Consulta de la pregunta”, y sus frases explicativas derivan de datos reales. “La cantidad no significa consenso” y los cuatro vacíos conservan el significado existente. Las etiquetas de operaciones siguen `actionLabels`; no se renombra una operación del backend.

### Estado de cierre CP4

**LISTO PARA REVISIÓN.** DEV-25 resuelta por autorización explícita del producto; ambos casos sembrados y verificados mediante la API oficial. No hay aprobación visual humana global. Los cambios del checkpoint se consolidan en un commit local con DCO después del escaneo y la revisión del índice.

CP1–4: listos para revisión. CP5–8: no iniciados. Sin push ni PR. Se detiene la implementación para la revisión humana obligatoria; DEV-25 y DEV-26 no equivalen a aceptación visual global.

### Auditoría intermedia de CP4 (antes de aprobar DEV-25)

- Exportación explícita de 877 archivos candidatos (tracked y novedades intencionales; fuera los documentos Claude/mockups ajenos): Gitleaks 8.30.1, **0 hallazgos**, sin nuevas exclusiones.
- 688 destinos relativos de Markdown comprobados, **0 inexistentes**; capturas enlazadas presentes.
- Residuos privados/institucionales en archivos nuevos/modificados de este checkpoint: **0 coincidencias**.
- `git diff --check`: PASS. Diff desde v0.5.0 vacío en backend, contratos, Prisma y Docker; sin cambios en almacenamiento.
- Documentos ajenos y stash conservados, comparados contra los hashes previos. No se accedió ni modificó Acta-FGEO.
- En esa auditoría CP4 seguía sin staging/commit, con HEAD `ef37b4f`; el cierre posterior aparece abajo. No hubo push ni PR.


### DEV-25 — evidencia final autorizada

| Caso | Estado real | Enviadas / requeridas | Aclaraciones | Conflictos |
|---|---|---|---|---|
| V-07 · `ADQ-06.02` | CLARIFICATION_REQUIRED · Requiere aclaración | 50 / 50 | 2 abiertas, 1 cerrada | 0 |
| V-07-partial · `ADQ-01.01.1` | PARTIAL · Respuesta parcial | 1 / 2; falta 1 | 0 | 0 |

Se reutilizó una pregunta sin aportaciones del cuestionario ficticio para el caso separado: siguen siendo **304 preguntas**, sin modificar texto, tipos ni opciones del paquete. Las dos asignaciones son requeridas. No se llamó a `markPartial`, no se modificó SQL y no se cambió backend/contrato. En el primer caso se conservaron las tres aclaraciones y las cinco evidencias PDF ficticias del fixture.

La captura `c-05-review-50` y la especificación ilustran PARTIAL y 50/62. Las personas faltantes adicionales no están declaradas en el JSON: no se inventaron doce asignaciones. El producto muestra 50/50 y las aclaraciones reales. El caso 1/2 demuestra por separado la cobertura incompleta. El orden de aportaciones es el recibido del servidor (primera Uriel), no una selección artificial para copiar la maqueta.

Preparación del fixture, sin alterar el producto:

1. La API rechazó con 422 una etiqueta de opción enviada como valor. Se usa correspondencia exacta y única `label → value` de las opciones importadas (`opt-1…opt-4`), conservando cada respuesta.
2. La API rechazó con 409 cerrar un hilo todavía pendiente del participante. La especificación decía CLOSED con un solo mensaje del analista; se añadió una respuesta ficticia explícita por la API del participante y luego el cierre del analista. Se conserva el resultado autorizado (dos abiertos y uno cerrado), registrando ese evento intermedio necesario; nunca se fuerza el estado del hilo.
3. Las aserciones nuevas esperaban «Parcial». La etiqueta existente del producto es «Respuesta parcial»: se corrigió la expectativa exacta, sin modificar la etiqueta ni relajar el estado esperado. Primer pase nuevo: 5/10; tras corregir la preparación, 10/10; matriz final: **41/41** (40 vistas + permisos).
4. Se corrigió «Faltan 1…» en la explicación nueva de CP4: «Falta 1 de 2 personas asignadas». Dos tests adicionales cubren singular/plural sin cambiar estado, cálculo de cobertura ni acción.

Las diez capturas «before-cp4» de estos dos casos se reconstruyeron desde el commit `ef37b4f` en un frontend temporal, después de sembrar los datos autorizados. No son capturas históricas de v0.5.0 ni una alteración del árbol de trabajo; `baseline-metrics.json` identifica el origen. El servidor temporal se detuvo después de capturarlas.

### Comparativas de cierre y nueve aspectos

Referencia a la izquierda; React a la derecha. Las 30 capturas de casos previos no cambiaron (SHA-256 idéntico tras el pase final); se revisaron las diez comparativas nuevas y los tres detalles móviles de 50.

- 50 aportaciones, referencia c-05-review-50: [1440](acta-direction-c-evidence/cp4/V-07-compare-1440.png), [1024](acta-direction-c-evidence/cp4/V-07-compare-1024.png), [768](acta-direction-c-evidence/cp4/V-07-compare-768.png), [390](acta-direction-c-evidence/cp4/V-07-compare-390.png), [320](acta-direction-c-evidence/cp4/V-07-compare-320.png).
- Parcial separado, referencia de composición de una aportación c-04-review-1: [1440](acta-direction-c-evidence/cp4/V-07-partial-compare-1440.png), [1024](acta-direction-c-evidence/cp4/V-07-partial-compare-1024.png), [768](acta-direction-c-evidence/cp4/V-07-partial-compare-768.png), [390](acta-direction-c-evidence/cp4/V-07-partial-compare-390.png), [320](acta-direction-c-evidence/cp4/V-07-partial-compare-320.png).

El caso parcial separado no tiene una maqueta propia: la referencia de una aportación comprueba composición, no igualdad de contenido/estado. A 1024 la columna lateral sigue el umbral ≥900 del Mapping. En móvil se necesita más desplazamiento que en C por conservar la pregunta completa, contexto, acciones reales y cuatro pestañas alcanzables. No se afirma que la aportación quede visible sin desplazamiento a 320/390.

| Aspecto | V-07 · 50 | V-07-partial |
|---|---|---|
| Jerarquía | PASA: pregunta → estado → aportaciones | PASA: pregunta → cobertura → respuesta |
| Composición | PASA: riel/panel ≥900; lista/detalle <900 | PASA: una respuesta completa sin riel |
| Tipografía | PASA: h1 23/600 Sans en escritorio; cuerpo 17; metadatos ≥12,5 | PASA: misma escala; pregunta y contenido diferenciados |
| Espaciado | PASA: filtros y respuesta separados; tarjetas más espaciadas que C | PASA: comentario/ejemplo separados |
| Densidad | PASA en alcance: respuesta a y=583,73 a 1440; móvil desplazable | PASA en alcance: respuesta a y=601,13 a 1440; móvil desplazable |
| Agrupación | PASA: vigentes, detalle y participantes diferenciados | PASA: una aportación y una persona requerida pendiente |
| Acciones | PASA: sin CTA que reclame turno mientras se esperan aclaraciones; otras acciones conservadas | PASA: espera de aportación, sin inventar tarea de analista |
| Estados | DEV-25: Requiere aclaración gana a Parcial de C | DEV-25: parcial real, sin conflictos ni hilos abiertos |
| Responsive | PASA: cinco anchos, cero overflow/axe; foco lista/detalle y filtros | PASA: cinco anchos, cero overflow/axe, lectura por scroll |

A 1440: h1 y=117,5; tamaño 23 px/peso 600; riel 295 px en 50; cero acciones primarias en ambos estados de espera. Las métricas, incluyendo `backendStatus`, aclaraciones y respondientes faltantes, están en [metrics-cp4.json](acta-direction-c-evidence/metrics-cp4.json).

### Parada de revisión humana tras CP4

| Checkpoint | Gate técnico y evidencia | Aceptación visual humana |
|---|---|---|
| 1 | PASS · LISTO PARA REVISIÓN | Pendiente |
| 2 | PASS · LISTO PARA REVISIÓN | Pendiente |
| 3 | PASS · LISTO PARA REVISIÓN | Pendiente; DEV-26 aprobada no sustituye este gate |
| 4 | PASS · LISTO PARA REVISIÓN (con correcciones posteriores a la auditoría; E2E pendiente de re-ejecución) | Pendiente; DEV-25 aprobada no sustituye este gate |
| 5–8 | No iniciados | Requieren autorización después de esta revisión |

**VISUAL REVIEW READY: YES. WAITING FOR PRODUCT APPROVAL: YES.** No se inicia CP5. No se abre PR ni se publica la rama. El registro/documento final de decisiones, contrastes e hilos corresponde a CP5; el aspecto heredado de su contenido no se presenta como rediseño terminado.

Revisión humana solicitada: jerarquía y densidad de escritorio; altura y desplazamiento de móvil; riel de aportaciones; textos de espera/turno; lectura de evidencia; conservación de navegación y controles. Accesibilidad pendiente: lector de pantalla, zoom real, colores forzados, dispositivos táctiles y otros navegadores; axe no certifica WCAG.


### Auditoría de cierre CP4

- Gitleaks **8.30.1**, binario oficial con SHA-256 verificado: **0 hallazgos** sobre 920 archivos versionables candidatos; sin nuevas exclusiones.
- Enlaces Markdown relativos: **717 comprobados, 0 destinos inexistentes**. Todas las comparativas y capturas enlazadas existen.
- El escaneo amplio distingue 23 coincidencias: rutas API `/users/` (falsos positivos), mención del repositorio excluido en el alcance, e identificadores/migración institucionales ya presentes en v0.5.0. Se contrastaron con la base; no se introdujo contenido institucional ni se cambió esa migración por este trabajo. No se trata este pase frontend como saneamiento de historia o backend.
- Cero residuos privados nuevos injustificados y cero secretos en el contenido versionable. Entorno, credenciales ficticias, siembra, bases y logs permanecen fuera del commit.
- `git diff --check`: PASS. Backend, contratos, Prisma, Docker y almacenamiento: diff vacío desde v0.5.0. Los cinco archivos ajenos y el stash mantienen sus hashes/estado anteriores.
- El commit de cierre incluye únicamente 192 rutas del checkpoint: presentación, pruebas, informe y evidencia visual solicitada. Los documentos Claude/mockups ajenos siguen sin seguimiento. No se incluye configuración privada ni salida temporal.
- Commit previsto de cierre: `feat: reshape review and contributions for Direction C`, con DCO, en `feat/acta-direction-c-ui`. Sin push, PR, tag ni release.


### Auditoría independiente y correcciones posteriores de CP4

Una auditoría independiente de solo lectura sobre `a80486d` (2026-10-08) concluyó **NO APTO (corrección acotada)** para aprobar CP4 tal cual: dos regresiones funcionales frente a v0.5.0 (F1, F2). El responsable de producto autorizó, en tres pasos, corregir exclusivamente los defectos listados abajo. Las correcciones no equivalen a aprobación de CP4: la aceptación visual y funcional sigue pendiente de producto y la verificación E2E sigue pendiente (véase más abajo). La numeración F11–F13 es solo de seguimiento.

| Hallazgo | Defecto observado | Corrección | Commit |
|---|---|---|---|
| F1 (alto) | Con cualquier conflicto, Contraste solo comparaba las fuentes del conflicto; una aportación vigente ajena a él no se podía comparar (v0.5.0 sí lo permitía) | Contraste conserva la comparación del conflicto y ofrece la comparación libre de las vigentes; plegada bajo el conflicto y abierta por «Comparar aportaciones», no se muestra si un conflicto ya abarca todas las vigentes, y se muestra directa sin conflictos. Nombres de región y de controles únicos con `labelSuffix` | `8e4c143` |
| F2 (medio) | «Registrar decisión» aparecía en «Otras acciones» con una aclaración abierta; el backend lo rechaza (409, `noBlocks`) y v0.5.0 no lo ofrecía | Se retira mientras exista un hilo no cerrado; no cambian las demás acciones ni el CTA principal | `8e4c143` |
| F11 (medio) | «Comparar aportaciones» pedía el foco con `requestAnimationFrame` antes de que el panel Contraste fuera visible; el foco caía en `BODY` | La petición se registra en un `ref` de un solo uso y se cumple en un efecto posterior al commit que selecciona la pestaña | `e38af04` |
| F12 (bajo) | «Comparando 2 de N aportaciones vigentes» sugería que un conflicto que enlaza 2 de N abarcaba las N | El número es lo comparable en esa vista: «aportaciones vigentes» si abarca todas; «fuentes registradas en este conflicto» si solo abarca las del conflicto | `e38af04` |
| F13 (medio) | «← Volver a N aportaciones» tenía el mismo defecto de foco que F11 | El mismo mecanismo, generalizado a `"contrast" \| "contributions"`; el destino no cambia (botón de comparar o, sin él, la pestaña Aportaciones) | `ebdf061` |

No se tocaron backend, contratos, Prisma, permisos ni almacenamiento. Los tres commits tocan solo `ReviewDetail.tsx`, `ContributionComparison.tsx` y sus pruebas.

**Libro de aserciones (cambio intencional).** `ContributionComparison.test.tsx`, «el conflicto explica sus dos fuentes sin atribuirlo a las doce aportaciones»: antes exigía «Comparando 2 de 12 aportaciones vigentes.» para un conflicto que enlaza 2 de 12; ahora exige «Comparando 2 de 2 fuentes registradas en este conflicto.» y que el texto no mencione 12, que es lo que el título de la prueba ya pedía. El comportamiento protegido queda cubierto además por «un conflicto con tres de doce fuentes describe su propio alcance», por «si el conflicto abarca exactamente todas las aportaciones vigentes el alcance sigue siendo vigente» y por la prueba de integración de `ReviewPresentation.test.tsx`. Además, la prueba propia de F11 que modela un fotograma anterior al commit pasó a compartir un asistente con las de F13 (misma conducta). El resto de aserciones existentes no se modificó.

**Pruebas añadidas: 20** (`ReviewPresentation.test.tsx`: 9 de F1/F2, 4 de F11/F12 y 5 de F13; `ContributionComparison.test.tsx`: 2 de F12). Sobre el código previo a cada corrección fallan 10 de las pruebas nuevas (6 de F1/F2, 2 de F12, 1 de F11 y 1 de F13) y la aserción actualizada de F12; las demás son controles de paridad con v0.5.0 que pasan antes y después. Para F11 y F13, jsdom no reproduce la carrera real del navegador (no impide enfocar un elemento oculto); la regresión se protege con una prueba que modela un fotograma anterior al commit y un foco como el de un navegador, que falla sobre el código previo, y se confirmó en Chromium.

| Verificación (copia aislada, sin base de datos) | `a80486d` | `8e4c143` | `e38af04` | `ebdf061` |
|---|---|---|---|---|
| Lint (`--max-warnings 0`), typecheck, `prisma validate` | PASS | PASS | PASS | PASS |
| Build | PASS, 753,71 kB | PASS, 754,17 kB | PASS, 754,28 kB | PASS, 754,30 kB |
| Unit/component | 264/264 · 34 archivos | 273/273 | 279/279 | **284/284 · 34 archivos** |

El tamaño del bundle conserva la advertencia preexistente de más de 500 kB; no se modificó el umbral.

**Verificación en Chromium** con la interfaz construida y una API simulada con datos válidos según el contrato (`reviewDetailView`), sin backend ni base de datos; **no sustituye al E2E**. axe (wcag2a/2aa/21a/21aa/22aa/best-practice) con 0 violaciones en todos los casos:

- F11, anchos 1440, 1024, 390 y 320, ratón y teclado (8 casos): antes el foco quedaba en `BODY` (8/8) y, a 1024, 390 y 320 px, el encabezado quedaba fuera del viewport; ahora el foco queda en el encabezado «Contrastar aportaciones», visible y dentro del viewport (8/8).
- F13, mismos anchos y entradas (8 casos): antes `BODY` (8/8); ahora «Comparar aportaciones», visible y dentro del viewport (8/8). Control con una sola aportación (sin botón de comparar; 6 casos): el foco ya iba a la pestaña Aportaciones y sigue yendo.
- F1 con las dos comparaciones abiertas: nombres de región únicos, desplegable de 44 px de alto (62,5 px a 320 px), sin desbordes. Con nombres repetidos axe marcaba `landmark-unique`; se corrigió con `labelSuffix`.
- La espera del foco fue por evento (`waitForFunction`), sin retardos fijos.

**Pendientes E2E (no ejecutados tras las correcciones).** La auditoría y las correcciones no ejecutaron E2E ni integración porque escriben en PostgreSQL; las cifras E2E de este informe (15 funcionales, 40 vistas + 1 gate) son las del cierre de CP4, previas a estas correcciones.
1. Re-ejecutar la suite E2E completa y el gate visual con el entorno desechable y el fixture de CP4, y registrar los resultados observados.
2. Revisar expresamente `review.spec.ts` (2D-C): su aserción «Comparando 2 de 2 aportaciones vigentes.» corresponde a un conflicto que enlaza todas las vigentes y, por el razonamiento de este informe, no debería cambiar; no está verificado.
3. Añadir cobertura E2E que hoy no existe: comparar con un conflicto existente y una aportación ajena a él; ausencia de «Registrar decisión» con una aclaración abierta; foco tras «Comparar aportaciones» y «← Volver» en Chromium; alcance del texto de comparación. No se añadieron porque no se pueden ejecutar en este entorno.
4. La integración PostgreSQL no se repitió desde la línea base (113/113): backend, contratos y Prisma tienen diff vacío frente a v0.5.0.

**Observaciones de la auditoría que siguen abiertas** (fuera del alcance autorizado; no se corrigieron): F3, el gate de permisos de DEV-25 y las vistas de 3/12/50 aportaciones dependen de `ACTA_DIRECTION_C_VISUAL_FIXTURE`, un fichero privado no versionado, por lo que otra persona no puede reproducirlos desde el repositorio; F4, la medición de objetivos táctiles solo mide `button`, `input`, `select`, `textarea` y `summary` dentro de `.ac-review` y excluye enlaces y shell (en la auditoría, con datos simulados: enlace de ruta de 21 px de alto a 768 y 390 px, marca de 32×32 y selector de proyecto de 40×40 a 768 px); F5, `it.each` de `ReviewPresentation.test.tsx` ignora su parámetro; F6, incoherencias menores de este informe y el libro de aserciones sin archivo:línea; F7, `PUBLIC-SNAPSHOT-FILES.txt` solo se actualizó para CP1; F8, el titular «Decisión vigente» aparece dos veces en la vista validada hasta CP5; F9, texto menor de 12,5 px en CSS heredado de pantallas aún no migradas; F10, OFL de Plex Serif con saltos de línea normalizados.

## Puerta de correcciones UX antes de CP5

Alcance autorizado (2026-10-08, tras la revisión integral UX/UI de CP1–4, `UX-REVIEW-CP1-4.md` del laboratorio): resolver los hallazgos **UX-01, UX-02 (parche mínimo), UX-03, UX-06, UX-07, UX-08, UX-09 y UX-15** sin iniciar CP5 y sin rediseñar Acta. Se conserva el lenguaje visual de la Dirección C. Solo frontend: backend, contratos, Prisma, Docker y paquetes tienen diff vacío frente a v0.5.0; no se tocó Acta-FGEO; sin endpoints nuevos; sin push, merge ni release. Los hallazgos no tratados quedan diferidos con su checkpoint.

### Resultado por hallazgo

| Hallazgo | Estado | Evidencia que lo sostiene |
|---|---|---|
| UX-01 Atención a escala | **CERRADO** | E2E 12/54/304 × 4 anchos, 7 pruebas de escala, métricas abajo |
| UX-03 Una fila por pregunta | **CERRADO** | invariante «exactamente una vez» (unitaria, 2 variantes de rol) + E2E |
| UX-06 Aportación relevante | **CERRADO**, con límite documentado | 6 pruebas unitarias de selección, E2E 0/1/3/12/50 × 4 anchos |
| UX-07 Revisión móvil | **CERRADO**, con la observación de 320 px | CTA y «Más acciones» en la primera pantalla a 390 y 320; titular de la aportación a 390; E2E |
| UX-08 Navegación | **CERRADO** | raíz → Atención, iconos distintos, foco; E2E y 3 pruebas unitarias |
| UX-02 (parche mínimo) | **CERRADO solo el parche**; migración completa diferida a CP5–CP7 | h1 por página; el nombre del proyecto deja de repetirse como h1 |
| UX-09 Solo lectura | **CERRADO** | pestañas con contenido y explicación; E2E ADMIN y VIEWER |
| UX-15 Objetivos táctiles | **CERRADO en el shell y las pantallas tocadas** (≤899 px) | `smallTargets()` = [] en Atención, revisión y shell a 768/390/320 |

Un hallazgo solo se marca cerrado cuando su comportamiento está probado en navegador real con datos reales de una base desechable, a los cuatro anchos pedidos, con axe sin violaciones y sin desbordes. Lo que no se pudo probar así se enumera en «Límites».

#### UX-01 — Atención con cientos de preguntas

- **Problema.** Con la distribución del conjunto de 304 preguntas la pantalla medía ~25 900 px a 1440 y ~45 500 px a 390 (7 434 nodos DOM): «En espera de otras personas» aportaba 124 filas no accionables antes de «Todas las preguntas».
- **Causa raíz.** Cada grupo se pintaba completo y «Todas las preguntas» repetía la lista entera; el grupo de espera no tenía nada que el analista pudiera hacer, pero ocupaba el primer plano.
- **Cambio.** «En espera de otras personas» y «Sin participantes asignados» se pliegan por defecto (`<details>`) con su conteo («124 preguntas») en el resumen. Los grupos con trabajo (te toca a ti, conflictos, aclaraciones) se muestran abiertos; cada lista revela por tramos: 25 filas y «Mostrar 25 más» (un grupo de hasta 30 filas se muestra entero); los grupos plegados, 50 y «Mostrar 50 más» (hasta 60 enteros). «Todas las preguntas (N)» es una sección plegada que solo pinta sus filas al abrirse, con el mismo tramo de 50. «Mostrando N de M» se anuncia con `aria-live="polite"`; al revelar, el foco pasa a la primera fila nueva. Se conservan los filtros (estado, tarea, resumen) y el contexto de proyecto. Abrir/plegar y los tramos revelados se guardan en el contexto del banco de trabajo, de modo que volver desde una revisión restaura la lista, el scroll y el foco en la fila de origen (sin abrir dos veces la misma fila). Sin endpoints nuevos: se parte de los mismos datos del panel.
- **Pruebas.** `ProjectAttention.test.tsx` (304 preguntas: conteos plegados y filas iniciales; revelado de 50 en 50 (grupo de espera) y de 25 en 25 (grupo de trabajo de 94 filas) con foco en la primera fila nueva; fila única con conflicto + aclaración + evidencia; filtros + revelado + limpiar; restauración del estado abierto/revelado tras desmontar; foco guardado abre solo la primera sección que lista la fila), `attention-groups.test.tsx`, E2E `ux-gate.spec.ts` con 12, 54 y 304 preguntas × 4 anchos.
- **Evidencia visual.** `acta-direction-c-evidence/ux-gate/UX01-n304-{1440,768,390,320}.png`; comparativas `compare-UX01-*.png`.
- **Estado.** CERRADO.

#### UX-03 — Una fila por pregunta

- **Problema.** La misma pregunta aparecía en «Te toca a ti» y en «Aclaraciones abiertas» con CTAs distintos; el aviso de repetición estaba en letra pequeña.
- **Causa raíz.** La agrupación admitía pertenencia múltiple (regla del Mapping §3.1.1).
- **Cambio.** Pertenencia exclusiva por prioridad: acción / conflictos / respondidas → aclaraciones → espera → sin asignar. Las señales secundarias viajan en la misma fila como chips: «Aclaraciones abiertas» (si la pregunta también tiene aclaraciones) y «Con evidencia»; el conflicto y el estado ya los muestra la fila. No se pierde información de solapamiento: las tarjetas del Resumen siguen contando las preguntas con conflicto y las con aclaración, también si coinciden.
- **Pruebas.** `attention-groups.test.tsx` («cada pregunta aparece una sola vez y ninguna se pierde», 2 variantes de rol, mismas preguntas y prioridad); `ProjectAttention.test.tsx`; E2E: enlaces de revisión únicos y la pregunta solapada una vez con su chip.
- **Estado.** CERRADO.

#### UX-06 — La aportación relevante primero

- **Problema.** La aportación abierta por defecto seguía el orden del servidor y «Contraste» no avisaba del conflicto.
- **Cambio.** Al abrir la revisión se muestra primero la aportación de la aclaración pendiente (la que espera al analista antes que cualquier otra abierta), si no hay, la del conflicto abierto, si no hay, el comportamiento anterior (primera visible en escritorio; el conjunto en pantallas estrechas). Una elección explícita de la persona no se deshace; «← Volver a N aportaciones» muestra el conjunto sin volver a saltar. Un filtro que oculta la aportación relevante abre la primera visible. «Contraste» muestra un indicador (bandera) y `aria-description` «Conflicto abierto» cuando hay un conflicto abierto.
- **Límite documentado.** La relación se toma solo de los vínculos que ya entrega el contrato (`thread.responseRevisionId`, `conflict.participants[].responseRevisionId`) y solo si esa revisión es vigente; no se infiere ni se inventa ninguna asociación. Si el vínculo no apunta a una revisión vigente, no se preselecciona.
- **Pruebas.** `review-turn.test.tsx` (`relevantSubmissionId`, tabla de casos), `ContributionSet.test.tsx` (6 pruebas UX-06; dos pruebas existentes pasan a pedir primero el conjunto con «← Volver», véase libro de aserciones), `ReviewPresentation.test.tsx` (indicador y descripción de la pestaña), `semantic.test.tsx` (indicador de `TabNav`), E2E 0/1/3/12/50 × 4 anchos (persona preseleccionada, indicador en Contraste), foco de comparar/volver con ratón y teclado a 1440 y 390.
- **Estado.** CERRADO.

#### UX-07 — Revisión en móvil

- **Problema.** Primera respuesta a y ≈ 990 (390) y ≈ 1 100 (320): más de una pantalla; «Otras acciones» desplegado siempre.
- **Cambio.** En < 760 px las acciones secundarias están en un menú «Más acciones» (disclosure accesible con Escape, retorno de foco y cierre al hacer clic fuera; los elementos de 44 px abren los mismos diálogos que el `select` de escritorio). Se compacta el resto del cromo (márgenes, tarjeta de estado, encabezado); a ≤ 420 px las dos acciones se apilan; a ≤ 359 px el titular de la pregunta pasa a 20 px. Con una aportación abierta en pantallas < 900 px, el titular «N aportaciones / Envíos vigentes…» queda solo para lectores de pantalla (el conteo sigue en «← Volver a N aportaciones»; el titular reaparece en la lista). No se retiró ninguna función. En escritorio permanece el `select` «Otras acciones» (UX-05 queda en CP5). Las pestañas conservan la rejilla 2×2 de CP4 a ≤ 479 px: una tira desplazable habría sustituido esa decisión de reflujo.
- **Pruebas.** `semantic.test.tsx` (`ActionMenu`, 4), `ReviewPresentation.test.tsx` (menú móvil; diálogo abre/cancela con el foco de regreso; `select` en escritorio; sin menú en solo lectura), `ContributionSet.test.tsx` (titular solo para lectores en pantalla estrecha con aportación abierta y visible en escritorio/lista), E2E: CTA y «Más acciones» dentro de la primera pantalla útil a 390 y 320; a 390 el titular de la aportación abierta empieza dentro de la primera pantalla; menú con teclado, Escape y diálogo.
- **Resultado medido** (`metrics-ux-gate.json`, y de la persona abierta): 

| Caso | Ancho | CTA termina en y | Titular de la aportación en y | Respuesta empieza en y |
|---|---|---|---|---|
| 1 aportación | 390 | 465 | 745 | 906 |
| 1 aportación | 320 | 497 | 798 | 984 |
| 3 (conflicto + aclaración) | 390 | 485 | 756 | 939 |
| 3 (conflicto + aclaración) | 320 | 515 | 786 | 994 |
| 12 (aclaración respondida) | 390 | 485 | 756 | 939 |
| 12 (aclaración respondida) | 320 | 539 | 810 | 1018 |
| 50 (dos aclaraciones) | 390 | — | 728 | 911 |
| 50 (dos aclaraciones) | 320 | — | 783 | 992 |

Pantalla útil: 780 px a 390×844 y 576 px a 320×640 (menos la barra inferior de 64 px). Antes de este cambio la primera respuesta empezaba en y ≈ 990 (390) y ≈ 1 100 (320). La mejora de la posición de la respuesta es moderada (≈ 50–110 px); lo que cambia de fondo es que la acción principal y «Más acciones» ya no ocupan una pantalla propia y que se abre la aportación pendiente.
- **Límite.** A 320×640 la aportación queda a un desplazamiento (el titular empieza en y ≈ 783–833 con 576 px útiles); lo que se mantiene a la vista es la pregunta, el estado y la acción principal. A 390 el titular de la persona queda al pie de la primera pantalla y su respuesta empieza justo debajo.
- **Estado.** CERRADO para el alcance pedido (cromo reducido, acción principal y «Más acciones» a la vista); mejorar la lectura inmediata de la respuesta en 320 queda como observación.

#### UX-08 — Navegación del proyecto

- **Problema.** La raíz del breadcrumb llevaba el nombre del proyecto pero no a su inicio; el icono `layers` servía para proyecto, Cuestionario y Menú; Atención usaba un icono de información.
- **Cambio.** La raíz del breadcrumb lleva a Atención del proyecto (a «Preguntas publicadas» para el rol de solo lectura sin gestión) y su nombre accesible lo dice («Proyecto: ir a Atención»). Iconos distintos: Atención `inbox`, Cuestionario `list`, selector de proyecto `folder`, Menú `menu`. El orden de tabulación y el anillo de foco no cambian.
- **Pruebas.** `ProjectShell.test.tsx` (destino por rol, nombre accesible, ningún enlace de raíz a «/», iconos distintos), E2E (`href` de la raíz, iconos únicos, anillo de foco).
- **Estado.** CERRADO.

#### UX-02 — Parche mínimo de títulos

- **Problema.** Dentro del shell nuevo, las pantallas heredadas tenían como `h1` el nombre del proyecto y el título de la página como `h2`.
- **Cambio.** Cada página del banco de trabajo nombra su `h1` («Atención», «Cuestionario», «Decisiones», «Invitaciones»; «Preguntas publicadas» para el rol de solo lectura); el nombre del proyecto queda en el breadcrumb, la barra lateral y el eyebrow. Jerarquía sin saltos. Rediseño de las pantallas heredadas: CP5–CP7.
- **Residual corregido: la página se montaba dos veces.** Mientras cargaba la lista de proyectos el contenido se pintaba con la cabecera antigua y, al aparecer el shell, se volvía a montar (se perdían el archivo elegido y lo escrito; por eso `exchange.spec.ts:76` fallaba en este entorno también sobre `HEAD` sin cambios). La página se monta una sola vez, dentro del shell; mientras tanto se muestra el estado «Cargando información…». Prueba E2E determinista: con la lista de proyectos retrasada 1,5 s, el archivo elegido sigue seleccionado cuando aparece el shell; falla sin el cambio (0 archivos) y pasa con él.
- **Pruebas.** `ProjectWorkbench.test.tsx`, `ProjectDecisions.test.tsx`, `ParticipantHome.test.tsx`; E2E de títulos por página.
- **Estado.** CERRADO solo el parche; UX-02 completo diferido.

#### UX-09 — Solo lectura

- **Problema.** El VIEWER veía cuatro pestañas aunque Contraste e Historial casi nunca tienen contenido; el ADMIN leía «Consulta de solo lectura.» sin saber por qué.
- **Cambio.** En solo lectura solo hay pestañas con contenido (con lo que el servidor ya entrega para ese rol): Contraste si hay conflictos o ≥ 2 aportaciones vigentes; Decisión si hay validaciones o disposiciones; Historial si hay hilos, disposiciones o referencias. Un `?tab=` a una pestaña no disponible vuelve a la preferida. El equipo analista conserva las cuatro. La tarjeta de estado explica el motivo («Las acciones de revisión corresponden al equipo analista…», o la del proyecto archivado). No cambia ningún permiso ni dato visible.
- **Pruebas.** `ReviewPresentation.test.tsx` (analista 4 pestañas; VIEWER; ADMIN; `?tab=history` sin disponibilidad; explicación por rol y archivado), `review-turn.test.tsx`, E2E ADMIN (`Aportaciones (3)`, `Contraste`, `Historial`, sin controles) y VIEWER (`Aportaciones (1)`, `Decisión`).
- **Estado.** CERRADO.

#### UX-15 — Objetivos táctiles

- **Cambio.** A ≤ 899 px: marca, selector de proyecto y enlaces del breadcrumb de 44 px (48 en el riel), «Mostrar N más» de 44 px, elementos del menú de 44 px; el breadcrumb queda en una línea con elipsis a ≤ 759 px.
- **Pruebas.** E2E: `smallTargets()` (enlaces independientes, botones, `summary`, `select` e `input` visibles con alguna dimensión < 44 px) es `[]` en el shell a 768, 390 y 320 px, en Atención y en la revisión.
- **Estado.** CERRADO para el alcance indicado; la medición táctil completa de pantallas heredadas queda para CP7.

### Atención a escala

Medido en Chromium con la API real y una base desechable, a los cuatro anchos (`metrics-ux-gate.json`). El conjunto de la prueba E2E tiene 2 filas de trabajo y 1 de aclaración sola; el resto está en espera (120 con 304 preguntas) o sin asignar (180), plegado y sin filas en el DOM. El número de nodos y el alto **no crecen con el total de preguntas**: son iguales con 12, 54 y 304 (la diferencia de 31 px a 390 px con 304 es el texto «120 preguntas»). Antes de la corrección, la revisión UX midió con la distribución real de 304 preguntas ~25 900 px a 1440, ~45 500 px a 390 y 7 434 nodos.

| Preguntas | Ancho | Filas pintadas (grupos + aclaraciones) | Nodos DOM | Alto de página | Primera fila (y) |
|---|---|---|---|---|---|
| 12 | 1440 | 3 | 352 | 1159 px | 323 |
| 12 | 768 | 3 | 352 | 2069 px | 343 |
| 12 | 390 | 3 | 352 | 2506 px | 343 |
| 12 | 320 | 3 | 352 | 2659 px | 367 |
| 54 | 1440 | 3 | 352 | 1159 px | 323 |
| 54 | 768 | 3 | 352 | 2069 px | 343 |
| 54 | 390 | 3 | 352 | 2506 px | 343 |
| 54 | 320 | 3 | 352 | 2659 px | 367 |
| 304 | 1440 | 3 | 352 | 1159 px | 323 |
| 304 | 768 | 3 | 352 | 2069 px | 343 |
| 304 | 390 | 3 | 352 | 2537 px | 343 |
| 304 | 320 | 3 | 352 | 2659 px | 367 |

Con la distribución del conjunto de 304 preguntas del laboratorio (2 conflictos, 22 respondidas, 12 aclaraciones, 124 en espera, 144 sin asignar) la prueba unitaria `ProjectAttention.test.tsx` mide 24 filas de trabajo + 12 de aclaración al entrar (36 filas, frente a 304 + 160 de la cola anterior); revelar el grupo de espera pinta 50, 100 y 124 filas; un grupo de trabajo de 94 filas revela de 25 en 25. Esa distribución solo se verificó con datos simulados en jsdom; el navegador real se verificó con el conjunto de la tabla.

### Comparativas con la Dirección C

Referencia aprobada a la izquierda; React a la derecha (capturas reales de la corrida E2E; 1440×900, 768×1024, 390×844 y 320×640). El «antes/después» de Atención compara la captura de la revisión UX (distribución de 304 preguntas con 24 filas de trabajo) con el conjunto E2E de 304.

| Pantalla | 1440 | 768 | 390 | 320 |
|---|---|---|---|---|
| Atención · 304 preguntas | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX01-attention-1440.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX01-attention-768.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX01-attention-390.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX01-attention-320.png) |
| Revisión · 0 aportaciones | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-zero-1440.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-zero-768.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-zero-390.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-zero-320.png) |
| Revisión · 1 aportación | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-one-1440.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-one-768.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-one-390.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-one-320.png) |
| Revisión · 3 aportaciones | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-three-1440.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-three-768.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-three-390.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-three-320.png) |
| Revisión · 12 aportaciones | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-twelve-1440.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-twelve-768.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-twelve-390.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-twelve-320.png) |
| Revisión · 50 aportaciones | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-fifty-1440.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-fifty-768.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-fifty-390.png) | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX06-fifty-320.png) |
| Atención 304 · antes / después | [Comparar](acta-direction-c-evidence/ux-gate/compare-UX01-before-after-1440.png) | | | |
| Solo lectura · ADMIN y VIEWER | [ADMIN](acta-direction-c-evidence/ux-gate/UX09-admin-1440.png) · [VIEWER](acta-direction-c-evidence/ux-gate/UX09-viewer-1440.png) | [ADMIN](acta-direction-c-evidence/ux-gate/UX09-admin-768.png) · [VIEWER](acta-direction-c-evidence/ux-gate/UX09-viewer-768.png) | [ADMIN](acta-direction-c-evidence/ux-gate/UX09-admin-390.png) · [VIEWER](acta-direction-c-evidence/ux-gate/UX09-viewer-390.png) | [ADMIN](acta-direction-c-evidence/ux-gate/UX09-admin-320.png) · [VIEWER](acta-direction-c-evidence/ux-gate/UX09-viewer-320.png) |

Lectura de la comparación (la aceptación visual corresponde a producto): se conservan la gramática de contenedores, los tokens, la tipografía y la jerarquía de CP2 y CP4; los pliegues de Atención usan la misma tarjeta con un indicador de despliegue y su conteo, y la revisión en móvil conserva el estado, la acción principal y «Más acciones» en la primera pantalla. Diferencias con el prototipo que no son objeto de esta puerta: el prototipo agrupa Atención con encabezados propios y una barra superior móvil distinta; el separador «·» queda huérfano al inicio de una línea cuando el meta se parte (UX-13, diferido); las pestañas de la revisión móvil siguen en rejilla 2×2 (CP4).

### Libro de aserciones — cambios intencionales de esta puerta

Ninguna aserción se debilitó: cada una se reemplazó por una equivalente sobre el nuevo comportamiento, y el comportamiento antiguo queda cubierto por una prueba que falla si regresa.

| Archivo | Antes | Ahora | Motivo |
|---|---|---|---|
| `attention-groups.test.tsx` | El grupo de aclaraciones contenía `["conflict-1", "clarification"]` | Contiene `["clarification"]`; `conflict-1` aparece una vez en su grupo de mayor prioridad y la prueba nueva «exactamente una vez» exige que ninguna pregunta se pierda | UX-03 |
| `ContributionSet.test.tsx` (2 pruebas existentes) | Con 3 y 10 aportaciones en pantalla estrecha asumían que se abría el conjunto | Piden primero el conjunto con «← Volver a N aportaciones» y conservan el resto de aserciones | UX-06: con un conflicto o una aclaración se abre la aportación relevante |
| `ReviewPresentation.test.tsx` | `page(detail, search)` | `page(detail, search, projects)` para modelar el rol de lectura; mismas aserciones | UX-09 necesita saber si el proyecto es ADMIN/ANALYST/VIEWER |
| `visual-direction-c.spec.ts` (CP4, ancho < 900, casos con aclaración o conflicto sobre una vigente) | Lista de N aportaciones y ningún panel al entrar | Se comprueba primero el panel de la persona relevante (nombre, sin riel) y se captura; luego «← Volver» y **se ejecutan intactas** las aserciones previas de lista, 50 aportaciones, contención, geometría y axe | UX-06 |
| `visual-direction-c.spec.ts` (todas las vistas, final) | `End` enfoca «Historial» y se ve «Historial de la pregunta» | Analista: las cuatro pestañas exactas y `End` → «Historial» como antes. Solo lectura: lista exacta de pestañas derivada de los datos del API, `End` → la última disponible | UX-09 |
| `exchange.spec.ts:172` | `heading` con el nombre del proyecto | `main h1` = «Atención» y el nombre del proyecto visible en el breadcrumb | UX-02 |
| `exchange.spec.ts:213` | `link` «Pregunta ficticia» | `link` «Revisar respuestas: Pregunta ficticia» | Aserción heredada de CP2 (la pregunta es un titular y la fila abre la revisión con ese enlace); la prueba estaba tras un fallo en serie y nunca se había ejecutado en este entorno |

### Copy nuevo (confirmación editorial pendiente, DEV-08)

«Más acciones»; «Mostrando N de M»; «Mostrar N más»; «N preguntas» en el resumen de grupos plegados; «Con evidencia»; «Conflicto abierto» (indicador de Contraste); breadcrumb «Proyecto: ir a Atención» / «ir a Preguntas publicadas»; «Preguntas publicadas» como `h1` del rol de solo lectura; «Hay un conflicto abierto entre aportaciones.» y la frase de solo lectura de la tarjeta de estado.

### Diferidos

| Hallazgo | Destino |
|---|---|
| UX-04 texto repetido por fila | CP5 (hilo de aclaraciones) |
| UX-05 acciones por aportación; `select` → menú en escritorio | CP5 |
| UX-10 cromo del cuestionario | CP7 |
| UX-11 Contraste y Decisión | CP5 |
| UX-12 glosario de copy | CP5 |
| UX-13 separador huérfano, glifo de plegado | CP7 |
| UX-14 diálogo de lote sin cambios | CP7 |
| UX-16 «Mis proyectos» | CP7 |
| UX-17 vacío de Revisión con siguiente paso | CP5 |
| UX-02 completo (login, Mis proyectos, Administración, Invitaciones, Miembros, Importación) | CP5–CP7 |
| Botón «Crear invitación» heredado de aspecto nativo | CP7 |

### Límites de esta verificación

Chromium en macOS con base y API desechables propias; sin lector de pantalla real, dispositivos táctiles reales, zoom del navegador, colores forzados ni Windows/Linux (el comportamiento de `select` cerrado con flechas no se verificó). El `Más acciones` se probó con ratón, teclado y emulación de viewport, no con gestos táctiles. axe sin violaciones no certifica WCAG. La aceptación visual y funcional pertenece a producto.

### Resultados de verificación de la puerta

Entorno propio y desechable (proyecto Compose `acta-ux-gate-20261008`, PostgreSQL en loopback, API y Vite en puertos libres; no se usó ni se tocó la infraestructura de otras instalaciones). Node 26.7.0, Chromium de Playwright.

| Comprobación | Resultado observado |
|---|---|
| `lint` (`--max-warnings 0`) | PASS |
| `typecheck` | PASS |
| `build` | PASS, 759,33 kB (la advertencia de más de 500 kB es preexistente) |
| `prisma validate` | PASS |
| Unit/component | **332/332 · 36 archivos** (284/34 al cierre de las correcciones de CP4: +48 pruebas, +2 archivos) |
| Integración PostgreSQL | **113/113**, sin skips (la suite de revisión usa `ACTA_REVIEW_TEST_PORT=4453`: el puerto por defecto 4330 está ocupado por otra instalación; la primera corrida sin el override dio 102/113 por ese conflicto, ajeno al código) |
| E2E Chromium, suite completa, base recién creada | **138/138**, sin skips ni reintentos |
| `ux-gate.spec.ts` | 14/14 (parte de los 138) |
| axe (wcag2a/2aa/21a/21aa/22aa/best-practice) | 0 violaciones en cada captura del gate (4 anchos) y en la matriz CP4 |
| Desbordes horizontales; un único `h1` por pantalla | 0 desbordes; 1 `h1` en todas las capturas |
| Objetivos < 44 px a ≤ 899 px | 0 en shell, Atención y revisión |
| Backend, contratos, Prisma, Docker y paquetes frente a v0.5.0 | diff vacío |
| Archivos ajenos (`CLAUDE-UX-CONTEXT.md`, `CLAUDE-UX-FILES.json`, `mockups/`) y stash previo | sin cambios |

La primera corrida completa de esta puerta dio 123 correctas, 13 fallos y 2 sin ejecutar. Su atribución: 12 fallos eran aserciones de la matriz CP4 que codificaban el comportamiento reemplazado a propósito (libro de aserciones); 1 era `exchange.spec.ts:76` (pérdida del archivo elegido al remontarse la página; corregido en `App.tsx`) que, al estar en serie, ocultaba otras 2 pruebas de `exchange.spec.ts` que nunca se habían ejecutado en este entorno y que tenían dos aserciones heredadas de CP2 (también adaptadas). Con esos cambios la suite completa pasa y la última corrida es la de la tabla.

**Observaciones.** (1) `visual-direction-c.spec.ts` se ejecutó con el fixture autónomo de API (0/1/2 aportaciones); las vistas de 3/12/50 del conjunto aprobado dependen de `ACTA_DIRECTION_C_VISUAL_FIXTURE`, un fichero privado no disponible aquí (hallazgo F3 de la auditoría, sin cambios). Para esta puerta se sembró por API un conjunto propio de 0/1/3/12/50 aportaciones (`fixtures/review-cases.ts`), que sí es reproducible desde el repositorio. (2) Una vez, tras un arranque en frío de Vite, `componentes, tipografía y accesibilidad 1440` falló porque cuenta los chips sin esperar a que rendericen; pasó al repetirla y en las dos corridas completas siguientes; no se modificó (aserción de CP1). (3) `prettier --check` avisa en `Clarifications.tsx`, `editor/Preview.tsx` y `editor/simulation.ts`, que esta puerta no tocó.

### Actualización de los «Pendientes E2E» de la auditoría de CP4

1. Suite E2E completa re-ejecutada tras las correcciones de F1/F2/F11–F13 y esta puerta: 138/138 (fixture autónomo; véase la observación 1).
2. `review.spec.ts` (2D-C) «Comparando 2 de 2 aportaciones vigentes.»: pasa sin cambios.
3. Cobertura E2E añadida: foco de «Comparar aportaciones» y «← Volver» (1440 y 390, ratón y teclado); «Registrar decisión» ausente con una aclaración abierta (3, 12 y 50 aportaciones, 4 anchos); pestañas y contenido por rol (analista, ADMIN, VIEWER); sin filas duplicadas; paginación y filtros. Comparar con un conflicto y una aportación ajena a él y el alcance del texto de comparación siguen cubiertos solo por pruebas de componente (`ReviewPresentation.test.tsx`, `ContributionComparison.test.tsx`).
4. Integración PostgreSQL repetida: 113/113.

### Commits de la puerta (rama `feat/acta-direction-c-ui`, DCO, sin push)

| Commit | Contenido |
|---|---|
| `4c9a0a6` | UX-08, UX-02 (parche) y UX-15: breadcrumb → Atención, iconos distintos, `h1` por página, objetivos del shell |
| `6752499` | Residual de UX-02: la página se monta una sola vez dentro del shell |
| `b78680d` | UX-01 y UX-03: Atención a escala y una fila por pregunta |
| `7cd4722` | UX-06, UX-07 y UX-09: aportación relevante, menú «Más acciones», solo lectura |
| `c269b95` | Pruebas E2E de la puerta y aserciones adaptadas |
| `d85a0b5` | Aserción E2E: una aclaración abierta bloquea «Registrar decisión» |
| (este) | Documentación y evidencia visual de la puerta |

**Estado de la puerta.** Los ocho hallazgos tienen su evidencia (tabla de arriba). CP5 no se inició y no está autorizado hasta nueva aprobación explícita del producto.


## Checkpoints 5, 6 y 7 — conflictos, participantes y consistencia global (LISTOS PARA REVISIÓN)

Autorización (2026-10-09): continuar la Dirección C con **CP5, CP6 y CP7** tras la puerta de correcciones UX y la validación funcional aprobada por producto. **CP8 no se inició** y no está autorizado. Alcance: solo presentación frontend. Backend, contratos, Prisma, Docker, paquetes, permisos, almacenamiento y reglas funcionales tienen diff vacío frente a v0.5.0; no se tocó Acta-FGEO ni ninguna instalación persistente; sin endpoints nuevos; sin push, PR, tag ni release. Cada checkpoint se validó con pruebas, capturas a cinco anchos y comparación con la Dirección C; **no se declara PASS solo por tests**: las diferencias que se aceptaron están listadas por checkpoint y esperan la aceptación visual humana.

Los documentos sin seguimiento ajenos (`CLAUDE-UX-CONTEXT.md`, `CLAUDE-UX-FILES.json`, `mockups/`) y el stash previo siguen sin cambios; cada commit se preparó añadiendo rutas explícitas.

### Qué cambió en el sistema compartido

Todo se apoya en los mismos componentes semánticos (`ui/semantic`) y tokens (`ui/tokens.css`); no hay CSS propio por pantalla salvo las hojas de feature que ya existían (`participant.css`, `invitation.css`, `next-*.css`), reescritas sobre tokens.

| Componente | Para qué se creó o cambió | Dónde se usa |
|---|---|---|
| `ComparisonTable` (roles explícitos) | Comparación simétrica: una columna por postura, una fila por campo, etiquetas una vez; en < 760 px se intercala por campo con la etiqueta de columna visual | Contraste, conflicto |
| `ThreadInset` / `ThreadMessage` | Intercambio cronológico pegado a la aportación: quién pregunta, quién responde, turno y estado | Revisión, Aclaraciones del participante |
| `DecisionSheet` | La decisión como documento: resultado en voz documental, alcance y excepciones, fundamentos numerados, pie con identificadores | Decisión, historial, registro de decisiones |
| `Timeline` + `review-timeline.ts` | «Cómo se llegó aquí»: línea de tiempo solo de presentación derivada de `ReviewDetail` (envíos, aclaraciones, conflicto, validación, disposiciones); sin endpoints | Pestañas Decisión e Historial |
| `RegisterRow`, `ProgressCard`, `Callout`, `NextSteps`, `FactGrid` | Filas del registro, tarjeta de avance, avisos, «Qué sigue» derivado de estados reales y hechos en rejilla | Decisiones, Mi trabajo, Enviada, invitación |
| `PageHeader`, `Avatar`, `FilterChips` | Cabecera de página (título, una línea de propósito, acción principal), persona con iniciales (nunca como único nombre) y filtros como chips | Todas las pantallas de organización |
| `DataTable` (en `ui/index.tsx`) | Tabla de datos con roles explícitos que se apila en tarjetas con etiqueta en < 760 px | Administración, Miembros, Bitácora |
| `OrganizationShell` | El marco de las páginas que no están dentro de un proyecto: barra lateral, riel y barra inferior con los destinos de la organización; sin inventar destinos | Mis proyectos, Administración, contraseña, bandeja, 404 |
| `Dialog` | Devuelve el foco a quien lo abrió cuando React lo retira de la página; pie de acciones fijo | Todos los diálogos |

### Checkpoint 5 — conflictos, aclaraciones y decisiones

**Qué se hizo.**

- **Contraste y conflicto.** La comparación es una sola tabla simétrica: la respuesta es el contenido, el actor y el área quedan como contexto en el encabezado de cada columna, la evidencia y la versión son filas, ningún bando tiene color propio. Las acciones («Pedir aclaración a A/B», resolver, registrar) están junto al par y la barra de acciones es fija; en un viewport de 1440×900 el encabezado de la tabla empieza en y = 629 (límite del Acceptance: 700). En móvil se intercala por campo. «Contraste» sin conflicto permite comparar dos aportaciones cualesquiera con selectores y abre el diálogo de aclaración con la persona preseleccionada.
- **Aclaraciones.** Hilo cronológico pegado a la aportación: cada mensaje dice quién pregunta o responde, de quién es el turno y en qué estado está; las acciones (responder, cerrar, preguntar de nuevo) viven dentro del hilo y aparecen según el estado del hilo y el rol, como en v0.5.0. Sin repetir encabezados.
- **Decisiones.** La decisión es un documento: «Se decide» (resultado) en Plex Serif de 28–30 px a y = 556 a 1440; alcance y excepciones; fundamentos numerados con persona, envío y archivos visibles sin abrir nada y un enlace «Abrir la aportación» que enfoca la aportación; los identificadores técnicos quedan solo en el pie. Una decisión reabierta se muestra como antecedente. «Cómo se llegó aquí» es la línea de tiempo derivada de los mismos datos.
- **Registro de decisiones** con filas `RegisterRow` y chip «Vigente»; ADMIN y VIEWER leen sin controles.

**Hallazgos de la revisión UX resueltos en CP5.**

| Hallazgo | Estado | Qué se hizo |
|---|---|---|
| UX-04 texto repetido por fila | **CERRADO** | Atención ya no repite el motivo en cada fila (`reason = ""`); la fila dice «Última aportación {fecha}» y los chips llevan la señal |
| UX-05 acciones por aportación; `select` → menú en escritorio | **CERRADO** | «Otras acciones» (escritorio) / «Más acciones» (móvil) es el mismo menú accesible en todas las vistas; «Pedir aclaración» y «Contrastar con otra» viven en cada aportación; no queda ningún `select` de acciones |
| UX-11 Contraste y Decisión | **CERRADO**, con las adaptaciones listadas abajo | Composición descrita arriba |
| UX-12 glosario de copy | **CERRADO** | aportación = lo que aporta una persona; envío = el número de versión de esa aportación; respuesta = el contenido; vigente = el envío que cuenta ahora. Se aplicó en etiquetas, encabezados y mensajes de Revisión, Atención y Decisiones |
| UX-17 vacío de Revisión con siguiente paso | **CERRADO** | Sin aportaciones: «Sin aportaciones vigentes» con «Asignar participantes en el cuestionario» (si no hay participantes) y «Crear invitación» |

**Adaptaciones aceptadas en CP5 (para confirmar por producto).**

1. Las acciones de la barra de Contraste son secundarias para conservar ≤ 1 primario por vista (la tarjeta de estado conserva el primario).
2. A 390 y 320 px la tabla comparativa no está en el primer viewport (y = 1 144 y 1 218): se conserva el estado y la acción principal arriba; la tabla va después, intercalada por campo. El criterio de y ≤ 700 solo se exige en escritorio.
3. El texto de la decisión no está disponible en el registro (DEV-04, contract gap): el registro muestra pregunta, estado y fecha, no el resultado.
4. «Qué sigue» omite la frase «Acta no envía avisos por correo»: no hay una garantía observable que la respalde en todas las vistas; solo se muestran estados reales.
5. El copy nuevo de «Se decide» y del pie documental está listado en «Copy nuevo CP5–CP7» y espera confirmación editorial.

**Pruebas.** `review-timeline.test.tsx`, `semantic.test.tsx`, `AnalystVisual.test.tsx`, `ContributionComparison.test.tsx`, `ReviewPresentation.test.tsx`, `ProjectDecisions.test.tsx`, `ProjectAttention.test.tsx`; E2E `cp5-conflicts-decisions.spec.ts` (10 pruebas, datos y API reales, cinco anchos, axe, desbordes, objetivos): métricas de Contraste, preguntar a A/B con diálogo preseleccionado, hilo, métricas de la hoja de decisión, orden de la línea de tiempo, foco de «Abrir la aportación», reabierta como antecedente, registro, ADMIN/VIEWER de solo lectura y respuestas largas con evidencia. Métricas en `acta-direction-c-evidence/metrics-cp5.json`.

| Medida (1440 / 390) | Resultado |
|---|---|
| Tabla comparativa, y de su encabezado | 629 / 1 144 |
| Tamaño de la respuesta · de la etiqueta de campo | 17 px · 12,5 px |
| «Se decide»: tamaño · y | 29 px · 556 (1440); 22 px · 920 (390) |
| Fundamentos de la decisión visibles sin abrir nada | 6 |

### Checkpoint 6 — participantes e invitados

**Qué se hizo.** La pregunta y la respuesta dominan; la persona entiende qué debe hacer, qué respondió, qué quedó guardado, qué se envió y qué sigue. `participant.css` e `invitation.css` se reescribieron sobre tokens (con bloque de paleta oscura); la pregunta es un `h1` en voz documental de 28 px (23 px ≤ 600 px).

- **Mi trabajo.** Saludo, tarjeta de avance en palabras y barra, aclaración pendiente destacada sobre la lista; la pregunta es el texto principal de cada fila; chip de estado con glifo y palabra.
- **Responder.** La pregunta como `h1`, la nota «guardar y salir / enviar» a 8 px de los botones, **un** primario («Enviar respuesta»). **Sin guardado automático falso**: Acta no guarda sola; el borrador privado se conserva al pulsar «Guardar y salir» y la pantalla no simula ningún autoguardado; lo guardado y lo enviado se dicen con palabras.
- **Respuesta enviada y recibo.** Regla superior, hechos en rejilla y «Qué sigue» solo con estados reales; **sin texto de decisión**. Evidencia con descarga si el servidor la autoriza.
- **Aclaraciones.** El intercambio (quién pregunta, quién responde), el turno y la acción contextual.
- **Invitación externa.** La carta abre con la organización que invita («{organización} te invita a responder»); la vigencia y el aviso sobre la identidad están en el primer viewport a 390×844 (y = 327 y 532 de 844); la lista de preguntas, la pantalla de respuesta y la confirmación comparten la columna del participante. **No se inventan destinatarios**: solo se muestra lo que el servidor entrega.

**Corrección de la revisión visual.** En la confirmación del invitado los tres pasos de «Qué sigue» salían todos en negrita (un título sin detalle se leía como encabezado); ahora son texto normal y el peso se verifica en el navegador.

**Conservación funcional.** Visibilidad de decisiones sin ampliar (la persona participante no ve texto de decisión); contratos, rutas y límites de invitación de v0.5.0 intactos; `requestId`, versiones esperadas y foco como antes.

**Pruebas.** `ParticipantFlow.test.tsx`, `MyWork.test.tsx` y las suites E2E existentes (`participant`, `responses`, `invitations`, `exchange`) adaptadas (libro de aserciones); E2E nuevo `cp6-participants.spec.ts` (7 pruebas): Mi trabajo, responder, enviada/validada, recibo, aclaración, invitación (carta y primer viewport) y confirmación, más tema oscuro con axe. Métricas en `acta-direction-c-evidence/metrics-cp6.json`.

| Medida | Resultado |
|---|---|
| Mi trabajo: aviso · lista (y, 1440 / 390) | 322 · 567 / 335 · 602 |
| Responder: `h1` · separación nota→botones | 28 px (23 px en 390) · 8 px |
| Respuesta enviada: tamaño de la respuesta | 17 px a todos los anchos |
| Invitación: vigencia · aviso · inicio (y, 1440 / 390) | 273 · 402 · 488 / 327 · 532 · 642 |

### Checkpoint 7 — consistencia global

**Qué se hizo.** El mismo sistema en todas las pantallas de organización y herramientas; ninguna pantalla conserva el aspecto de otra generación.

- **Marco.** `OrganizationShell` para Mis proyectos, Administración, contraseña, bandeja y 404.
- **Cabecera única.** Todas las pantallas usan `PageHeader` (o `ProjectWorkbench` con `lead`/`actions`): un `h1` propio, una línea de propósito y, si hay, la acción principal a la derecha. Login, Importar, Exportar, Trazabilidad, Bitácora, Miembros, Invitaciones y la bandeja dejaron de tener el nombre del proyecto como título, un enlace «volver» al proyecto y un `h2` repetido (**UX-02 completo**).
- **Mis proyectos (UX-16).** Una acción principal por proyecto según el rol (Atención del proyecto / Abrir proyecto / Consultar preguntas) y acciones secundarias; el rol como chip.
- **Administración (V-23).** Pestañas reales (Usuarios, Áreas, Proyectos; DEV-06), una acción principal por pestaña («Crear usuario/área/proyecto») que abre un diálogo con su formulario; filas con avatar, chip de estado y acciones por fila; tablas con `caption`. Miembros usa la misma tabla.
- **Tablas (nuevo `DataTable`).** Columnas con encabezados en escritorio y tarjetas con etiqueta en < 760 px, con roles ARIA explícitos para no perder semántica; la etiqueta apilada es solo visual.
- **Invitaciones (V-24/V-25).** Cabecera con «Crear invitación», ayuda «Cómo leer el estado» plegada, estado del enlace y actividad como chips con glifo y palabra, avance con barra decorativa y texto, vigencia dicha en días mientras el enlace sirve («Vence en 7 días», en color de advertencia si faltan 3 o menos) con la fecha debajo, paginación solo si hay más de una página. El asistente conserva sus cuatro pasos y validaciones; el pie del diálogo es fijo (Cancelar a un extremo, Atrás y la acción principal juntas) y las notas de contexto usan un aviso informativo.
- **Lector de consulta (V-26).** La pregunta en voz documental, el estado como el mismo chip que ve el analista y el enlace «Consultar decisión y fuentes» como única acción; solo lo que `participantView` entrega (DEV-05).
- **Cuestionario (UX-10, UX-13).** Los controles pasan de cuatro filas a dos en escritorio (modo y «Nueva pregunta»; búsqueda y filtros); la tabla empieza a y ≤ 430 a 1440. El control de plegado de grupos tiene glifo y título (UX-13b) y el separador de la línea de metadatos ya no queda huérfano (UX-13a).
- **Diálogos (UX-14).** El diálogo de lote distingue «sin cambios» (informativo) de error; todos los diálogos devuelven el foco al botón que los abrió.
- **Estados.** Cargando, vacío y error comparten tipografía, contraste y «Volver a intentar»; la sesión caducada reutiliza el acceso compacto dentro del diálogo.
- **Sin colores heredados.** Los últimos valores fijos del CSS antiguo (`#fff`, `white`, verde de la barra de secciones) pasaron a tokens.

**Hallazgos resueltos en CP7.**

| Hallazgo | Estado | Evidencia |
|---|---|---|
| UX-02 completo | **CERRADO** | 14 pantallas × 5 anchos: un `h1` propio, Plex Sans 24–26 px / ≥ 600, distinto del nombre del proyecto (`cp7-global.spec.ts`, V-27) |
| UX-10 cromo del cuestionario | **CERRADO** | modo y acción en una fila, búsqueda y filtros en otra, tabla a y ≤ 430 (1440) |
| UX-13 separador huérfano y glifo de plegado | **CERRADO** | CSS del separador; control de plegado con chevrón y título |
| UX-14 diálogo de lote sin cambios | **CERRADO** | aviso informativo distinto del error; `BulkDialog.test.tsx` |
| UX-16 «Mis proyectos» | **CERRADO** | V-27 Mis proyectos: una acción principal por proyecto |
| Botón «Crear invitación» de aspecto nativo | **CERRADO** | acción principal de la cabecera de Invitaciones |

**Pruebas.** `OrganizationShell.test.tsx`, `ui.test.tsx` (DataTable, retorno de foco del diálogo), `ProjectWorkbench.test.tsx`, `ParticipantHome.test.tsx`, `ContributionSet.test.tsx`; E2E nuevo `cp7-global.spec.ts` (9 pruebas): V-27 cabecera y escala en 14 pantallas × 5 anchos con axe, desbordes y texto colapsado; V-23 tablas y diálogos; V-24 Invitaciones; V-25 asistente; V-26 lector; V-27 cuestionario (UX-10), Mis proyectos y login. Métricas en `acta-direction-c-evidence/metrics-cp7.json`.

### Consistencia visual

- **Una voz, una escala.** Todas las pantallas de organización usan Plex Sans de 26 px / 600 para el `h1`; la voz documental (Plex Serif) solo aparece donde hay una pregunta, una respuesta o una decisión (revisión, participante, invitado, lector).
- **Un primario por vista.** Excepción documentada: «Mis proyectos» tiene una acción principal **por tarjeta de proyecto** (no por página).
- **Estados.** El mismo `StatusChip` (glifo + palabra) para revisión, publicación, participante, hilo e invitación; el color nunca es el único portador.
- **Tablas.** Una sola implementación de tabla de datos con tarjeta móvil.
- **Diferencia de generaciones eliminada.** No quedan pantallas con la cabecera antigua, botones de aspecto nativo ni paleta verde heredada; la medición `V-27` recorre 14 pantallas con la misma comprobación.


### Revisión visual comparada con la Dirección C

Cada pantalla se comparó lado a lado (referencia a la izquierda, React a la derecha) a 1440 y 390 px, y las demás anchuras donde existe captura. Se miró jerarquía, proporciones, densidad, alineación, ubicación de acciones, legibilidad, estados y responsive, no solo desbordes.

| Pantalla | 1440 | 768 | 390 | 320 |
|---|---|---|---|---|
| Conflicto / Contraste (V-09) | [Comparar](acta-direction-c-evidence/cp5/compare-V09-conflicto-1440.png) | [Comparar](acta-direction-c-evidence/cp5/compare-V09-conflicto-768.png) | [Comparar](acta-direction-c-evidence/cp5/compare-V09-conflicto-390.png) | [Comparar](acta-direction-c-evidence/cp5/compare-V09-conflicto-320.png) |
| Decisión (V-11) | [Comparar](acta-direction-c-evidence/cp5/compare-V11-decision-1440.png) | [Comparar](acta-direction-c-evidence/cp5/compare-V11-decision-768.png) | [Comparar](acta-direction-c-evidence/cp5/compare-V11-decision-390.png) | [Comparar](acta-direction-c-evidence/cp5/compare-V11-decision-320.png) |
| Registro de decisiones (V-12) | [Comparar](acta-direction-c-evidence/cp5/compare-V12-decisiones-1440.png) | [Comparar](acta-direction-c-evidence/cp5/compare-V12-decisiones-768.png) | [Comparar](acta-direction-c-evidence/cp5/compare-V12-decisiones-390.png) | [Comparar](acta-direction-c-evidence/cp5/compare-V12-decisiones-320.png) |
| Mi trabajo (V-15) | [Comparar](acta-direction-c-evidence/cp6/compare-V15-mi-trabajo-1440.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V15-mi-trabajo-768.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V15-mi-trabajo-390.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V15-mi-trabajo-320.png) |
| Responder (V-16) | [Comparar](acta-direction-c-evidence/cp6/compare-V16-responder-1440.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V16-responder-768.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V16-responder-390.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V16-responder-320.png) |
| Enviada (V-17) | [Comparar](acta-direction-c-evidence/cp6/compare-V17-enviada-1440.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V17-enviada-768.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V17-enviada-390.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V17-enviada-320.png) |
| Aclaración del participante (V-19) | [Comparar](acta-direction-c-evidence/cp6/compare-V19-aclaracion-1440.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V19-aclaracion-768.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V19-aclaracion-390.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V19-aclaracion-320.png) |
| Invitación (V-20) | [Comparar](acta-direction-c-evidence/cp6/compare-V20-invitacion-1440.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V20-invitacion-768.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V20-invitacion-390.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V20-invitacion-320.png) |
| Confirmación del invitado (V-22) | [Comparar](acta-direction-c-evidence/cp6/compare-V22-confirmacion-1440.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V22-confirmacion-768.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V22-confirmacion-390.png) | [Comparar](acta-direction-c-evidence/cp6/compare-V22-confirmacion-320.png) |
| Administración (V-23) | [Comparar](acta-direction-c-evidence/cp7/compare-V23-administracion-1440.png) | | [Comparar](acta-direction-c-evidence/cp7/compare-V23-administracion-390.png) | |
| Invitaciones (V-24) | [Comparar](acta-direction-c-evidence/cp7/compare-V24-invitaciones-1440.png) | | [Comparar](acta-direction-c-evidence/cp7/compare-V24-invitaciones-390.png) | |
| Asistente de invitación (V-25) | [Comparar](acta-direction-c-evidence/cp7/compare-V25-asistente-1440.png) | [Comparar](acta-direction-c-evidence/cp7/compare-V25-asistente-768.png) | [Comparar](acta-direction-c-evidence/cp7/compare-V25-asistente-390.png) | [Comparar](acta-direction-c-evidence/cp7/compare-V25-asistente-320.png) |
| Lector de consulta (V-26) | [Comparar](acta-direction-c-evidence/cp7/compare-V26-lector-1440.png) | | [Comparar](acta-direction-c-evidence/cp7/compare-V26-lector-390.png) | |
| Cuestionario (V-27, UX-10) | [Comparar](acta-direction-c-evidence/cp7/compare-V27-cuestionario-1440.png) | | [Comparar](acta-direction-c-evidence/cp7/compare-V27-cuestionario-390.png) | |

Capturas de las demás pantallas heredadas de V-27 (Mis proyectos, bandeja, Atención, Decisiones, Miembros, Importar, Exportar, Bitácora, Trazabilidad, contraseña, 404, login) en `acta-direction-c-evidence/cp7/V-27-*.png` (1440 y 390; el login a cinco anchos), y capturas finales de los conjuntos grandes en `acta-direction-c-evidence/transversal/`.

**Lo que se corrigió a partir de esta revisión** (no lo detectaban los tests de desborde):

1. Confirmación del invitado: los tres pasos de «Qué sigue» estaban en negrita; ahora texto normal (prueba E2E del peso).
2. Invitaciones: el fin del enlace no destacaba; ahora «Vence en N días» (advertencia si faltan 3 o menos) con la fecha debajo (prueba E2E).
3. Antes: el contenido de la respuesta en la revisión quedaba 8 px por debajo del límite de y ≤ 640 por texto repetido («Enviada · vigente», «Sin archivos adjuntos»); se retiró la repetición y la métrica del Acceptance se cumple.

**Diferencias con la Dirección C que se aceptan** (registradas para la aceptación humana; ninguna cambia una función):

| Pantalla | Diferencia | Motivo |
|---|---|---|
| Contraste | Las columnas no tienen selector de persona en su encabezado | En un conflicto las dos fuentes las fija el conflicto; la comparación libre sí tiene selectores |
| Decisión | La tarjeta de estado es más sencilla («Decisión vigente» + «Otras acciones») | El estado «Sin acción pendiente» del prototipo no existe como dato |
| Registro de decisiones | Muestra la pregunta, no el texto de la decisión | DEV-04: el contrato no lo entrega |
| Mi trabajo | La lista se agrupa por tema, no por «Para responder» | La proyección real del API agrupa por tema |
| Responder | La evidencia y el ejemplo son disclosures | Comportamiento real de v0.5.0 |
| Invitación | La barra superior dice «Acta», no el nombre de la organización; la organización abre el título | El nombre de la organización sale del contexto de la instalación, no de la invitación |
| Confirmación | Los pasos van sin tarjeta y con números, no con glifos | «Qué sigue» no puede marcar como hechos pasos que no lo están |
| Administración | Pestañas reales (Usuarios, Áreas, Proyectos) | DEV-06 |
| Invitaciones | Tarjetas con etiquetas en lugar de tabla con encabezados únicos; sin chips de filtro derivados | El filtro real «Vigencia» se conserva; los chips son «SHOULD» del Acceptance §3.13 |
| Asistente | Pasos como píldoras; cuatro campos en el primer paso | Los datos del destinatario son los reales de v0.5.0 |
| Cuestionario | Sin «Ocultar seguimientos», «Vista compacta» ni paginación de 8 páginas del prototipo | No existen como función en v0.5.0 |

### Revisión transversal del producto

Recorrido como una sola experiencia (navegación, proporciones, jerarquía, densidad, consistencia, estados, acciones, responsive) con datos reales a cinco anchos, incluyendo los conjuntos grandes: 304 preguntas (Atención y Organizar), 50 aportaciones, respuestas largas con evidencia, conflictos y decisiones. Capturas finales en `acta-direction-c-evidence/cp3`, `cp4`, `cp5`, `cp6`, `cp7` y `ux-gate`.

| Aspecto | Observación |
|---|---|
| Navegación | Una sola estructura (barra lateral / riel / barra inferior) en proyecto y organización; los destinos son los reales; el nombre del proyecto no es título |
| Jerarquía | En cada pantalla manda el objeto (pregunta, aportación, decisión, persona); los metadatos van después; los identificadores técnicos solo en el pie |
| Densidad | Las pantallas con cientos de elementos pliegan y revelan por tramos; Organizar y Atención no crecen con el total de preguntas |
| Estados y acciones | Una acción principal por vista; secundarias en menú accesible; estados con glifo y palabra |
| Responsive | Sin desborde horizontal ni texto colapsado a 1440, 1024, 768, 390 y 320 en las 14 pantallas de V-27 y en las matrices de CP3–CP6 |

**Pendiente de producto (no de código):** la aceptación visual humana de CP1–CP7 y la confirmación editorial del copy nuevo.

### Libro de aserciones CP5–CP7

Ninguna aserción se debilitó: cada una se reemplazó por una equivalente sobre el nuevo comportamiento. Se enumeran **todas** las que se adaptaron.

| Archivo | Antes | Ahora | Motivo |
|---|---|---|---|
| `review.spec.ts` | `getByLabel("Otras acciones").selectOption(key)` | abrir el menú «Otras acciones» y pulsar el botón por etiqueta (`menuLabels`) | UX-05: menú, no `select` |
| `review.spec.ts`, `next-workbench.spec.ts`, `visual-direction-c.spec.ts`, `ux-gate.spec.ts` | `getByLabel("Otras acciones")` como `select` (presencia/ausencia, opciones) | `getByText("Otras acciones")` / `.ac-action-menu li button` | UX-05; en `ux-gate.spec.ts` ya no hay rama `select` en escritorio |
| `review.spec.ts` (2D-C) | dos `region` «Postura A/B» con encabezados «Respuesta»/«Evidencia» | dos `columnheader` «Postura A/B» y `rowheader` «Respuesta»/«Evidencia»; celdas localizadas por `data-column` | CP5: una tabla comparativa |
| `review.spec.ts` (geometría) | `b.x > a.x + a.width`; `b.y > a.y + a.height` | `>=` (columnas contiguas; filas adyacentes) | CP5: ya no hay hueco entre tarjetas |
| `review.spec.ts` (reapertura) | el botón de reabrir es `secondary` | `tertiary` | CP5: acción terciaria al pie del documento |
| `review.spec.ts` (fuentes) | abrir un `<details>` «Respuesta de …» | fundamento numerado visible con persona y «envío #n» | CP5: fundamentos sin abrir nada |
| `review.spec.ts` (VIEWER) | encabezado «Decisión vigente» | encabezado «Decisión validada» (la etiqueta «Decisión vigente» es el nombre accesible de la hoja) | CP5 |
| `review.spec.ts`, `participant.spec.ts`, `responses.spec.ts` | `.participant-badge` | `.ac-status` | CP6: un solo chip de estado |
| `next-workbench.spec.ts` | encabezado «Decisiones registradas» | `article` «Decisión vigente» | CP5: la decisión es un documento |
| `invitations.spec.ts` | texto «Respuesta mediante invitación»; eyebrow no vacío | «Invitación para aportar»; `h1` con «te invita a responder» | CP6: la invitación se abre como carta |
| `platform.spec.ts` | encabezado con el nombre de la institución | `h1` «Iniciar sesión» y el nombre de la institución visible como texto | CP7 (UX-02): la página trata de entrar |
| `ui.test.tsx` | encabezado con el nombre de la institución | `h1` «Iniciar sesión» y nombre visible | CP7 (UX-02) |
| `ContributionSet.test.tsx` | `heading "0 aportaciones"` (vacío) y varios renders | encabezado solo para lectores y enlaces de siguiente paso (UX-17) | CP5 |
| `AnalystVisual.test.tsx`, `ContributionComparison.test.tsx`, `ReviewPresentation.test.tsx`, `semantic.test.tsx` | `region` «Postura A/B», `select` «Otras acciones», `DecisionSheet title/footer`, `ComparisonTable columns` como cadenas | columnas con `key`/`head`, menú de acciones, `DecisionSheet label/kicker`, `ThreadMessage` | CP5: nuevas APIs de los componentes |
| `MyWork.test.tsx` | `ParticipantSummary` | `Welcome` | CP6 |
| `tests/visual/direction-c.tsx` | APIs anteriores de `ComparisonTable`, `DecisionSheet`, `ThreadInset` | las nuevas | CP5; el gate de fundamentos pasa a ser la prueba de las nuevas APIs |
| `ux-gate.spec.ts` | axe, desbordes y objetivos en una función local | `fixtures/page-checks.ts` (`checkedPage`, `smallTargets`) | Reutilizar la misma comprobación en CP5–CP7; sin cambiar su contenido |
| `fixtures/page-checks.ts` (`containment`) | todo elemento visible cuenta | se excluye el patrón «visualmente oculto» (caja de 1 px recortada) | Es intencional para lectores de pantalla; se descubrió con la etiqueta de búsqueda del cuestionario y el `thead` apilado |
| `next-workbench.spec.ts` (vigencia de invitaciones) | tras pulsar «Atención» se pulsaba «Invitaciones» sin más | se espera el `h1` «Atención» antes de volver a usar la navegación | Con la CPU limitada ×6 la URL cambia antes de que el shell pinte el contexto recordado; la prueba hacía clic en el enlace anterior (falló 1 de cada 4 en aislamiento con la página de invitaciones nueva y pasa 8/8 con la espera; con la página anterior pasa 8/8 sin ella). Es sincronización, no una aserción más débil |
| `login-helper.ts` | `getByRole("button", { name: "Cerrar sesión", hidden: true })` | `includeHidden: true` y `.first()` | `hidden` no es una opción de Playwright y no hacía nada; con el marco de organización el botón de sesión está en dos sitios y a anchos estrechos solo en un menú |

### Copy nuevo CP5–CP7 (confirmación editorial pendiente, DEV-08)

«Se decide»; el pie documental de la decisión («Fuentes conservadas…», referencias técnicas); «Cómo se llegó aquí»; «Abrir la aportación»; «Pedir aclaración a A/B», «Contrastar con otra»; «Otras acciones» / «Más acciones»; «Última aportación {fecha}»; «Qué sigue» (Enviada, Aclaración); «Aclaración pendiente»; «{organización} te invita a responder»; «Invitación para aportar»; «Cómo leer el estado»; «Crear usuario / área / proyecto» como acciones de la cabecera; «Atención del proyecto / Abrir proyecto / Consultar preguntas» en Mis proyectos; «La dirección no existe o no tienes acceso a ella.»; «Enlaces para que personas externas respondan preguntas concretas.»; «Descarga el estado funcional de este proyecto.».

### Límites de esta verificación

Chromium en macOS, con base y API desechables propias; sin lector de pantalla real, dispositivos táctiles reales, zoom del navegador, colores forzados ni Windows/Linux. axe sin violaciones no certifica WCAG. El tema oscuro solo se midió en la pantalla del participante. Quedan **fuera de alcance de CP7** y se declaran: (1) la Bitácora muestra los códigos de acción y los tipos de objeto tal como los entrega el servidor (`QUESTION_REOPENED`, `Question`), sin traducirlos; (2) los filtros de Invitaciones como chips derivados del Acceptance §3.13 («SHOULD») no se implementaron: se conserva el filtro real «Vigencia» (`expiresWithin=7`); (3) «Escribir», «Revisar publicación» y «Vista previa» conservan la composición de CP3 sin cambios; (4) la jerarquía de la primera aportación a 320 px sigue a un desplazamiento (UX-07, observación previa).

### Resultados de verificación de CP5–CP7

Entorno propio y desechable (proyecto Compose `acta-ux-gate-20261008`, PostgreSQL y API en loopback, Vite en puerto libre; no se usó ni se tocó la infraestructura de otras instalaciones). Node 26.7.0, Chromium de Playwright.

| Comprobación | Resultado observado |
|---|---|
| `lint` (`--max-warnings 0`) | PASS |
| `typecheck` | PASS |
| `build` | PASS, 784,24 kB (la advertencia de más de 500 kB es preexistente) |
| `prisma validate` | PASS |
| Unit/component | **373/373 · 39 archivos** |
| Integración PostgreSQL | **113/113**, sin skips (`ACTA_REVIEW_TEST_PORT=4453`) |
| E2E Chromium, suite completa, base recién creada | **159/164 en la última corrida completa (1 fallo intermitente preexistente y 4 pruebas en serie sin ejecutar; esas 5 pasan 14/14 al repetir `ux-gate.spec.ts`); 164/164 en la corrida completa anterior a las dos correcciones de la revisión visual**, sin skips ni reintentos |
| `cp5-conflicts-decisions.spec.ts` · `cp6-participants.spec.ts` · `cp7-global.spec.ts` | 10 · 7 · 9, todos pasan (parte del total anterior) |
| axe (wcag2a/2aa/21a/21aa/22aa/best-practice) | 0 violaciones en las 14 pantallas de V-27 × 5 anchos, en las matrices de CP5 y CP6 y en el tema oscuro del participante |
| Desbordes horizontales; un único `h1` por pantalla; texto colapsado | 0; 1; 0 (el patrón «visualmente oculto» se excluye de la medida, véase libro de aserciones) |
| Objetivos < 44 px a ≤ 899 px | 0 en las pantallas medidas (shell, Atención, revisión y lector) |
| Backend, contratos, Prisma, Docker y paquetes frente a v0.5.0 | diff vacío |
| Archivos ajenos (`CLAUDE-UX-CONTEXT.md`, `CLAUDE-UX-FILES.json`, `mockups/`) y stash previo | sin cambios |

**Incidencias de la verificación.** (1) La primera suite completa dio 113 correctas y 48 fallos: 46 por el `login-helper` (su opción `hidden: true` no existía en Playwright; con el marco de organización el botón de sesión solo está en un menú a anchos estrechos), 1 por el encabezado del login y 1 por el nombre accesible de las celdas de la tabla apilada (la etiqueta visual se leía como parte del nombre; ahora es solo visual); todos atribuidos y corregidos sin debilitar aserciones. (2) `next-workbench.spec.ts` «vigencia de invitaciones» falló 1 de 4 veces con la página de invitaciones nueva por una carrera de la propia prueba bajo CPU limitada (véase libro de aserciones); con la espera pasa 8/8 y con la página anterior pasa 8/8 sin ella. (3) En la última corrida completa (13,5 min) falló una vez `ux-gate.spec.ts:322` («Comparar aportaciones» / «← Volver» llevan el foco, a 390 px) y las 4 pruebas que le siguen en serie no se ejecutaron; al repetir `ux-gate.spec.ts` pasan 14/14. La causa es una carrera intermitente que **ya existía**: un bucle de 56 repeticiones del mismo flujo contra el frontend de la base `8c68d32` (antes de CP5) falló 1 vez, y contra HEAD 1 de 28; la prueba no esperaba el retorno de foco que la página hace en el fotograma siguiente al volver a la lista; con esa espera, 0 fallos en 120 repeticiones (commit `d63b442`). Otra repetición de `ux-gate.spec.ts` se detuvo en el sembrado con un 500 del API de mi base desechable (backend sin cambios), sin relación con el frontend. (4) `prettier --check` sigue avisando en archivos preexistentes que estos checkpoints no tocaron (`editor/Preview.tsx`, `editor/simulation.ts`, `tests/unit/responses.test.ts`).

### Commits de CP5–CP7 (rama `feat/acta-direction-c-ui`, DCO, sin push)

| Commit | Contenido |
|---|---|
| `898393c` | Frontend de CP5–CP7: conflictos, decisiones, participantes, marco de organización, tablas, invitaciones, lector y controles del cuestionario (con pruebas unitarias) |
| `0d5d19e` | Pruebas E2E de CP5–CP7, comprobaciones de página compartidas y aserciones adaptadas |
| `9c5590d` | Correcciones de la revisión visual (pasos de la confirmación, vigencia en días) y sincronización de una prueba bajo CPU limitada |
| `539d9cf` | Prueba unitaria de UX-14 (un lote sin cambios es información; solo los bloqueos son error) |
| `1483a53` | Documentación, métricas, capturas y comparativas de CP5–CP7 |
| `d63b442` | «Revisar publicación» recompuesto (resumen, borradores en filas), organización en el encabezado de la invitación, campos del destinatario en una fila y espera de foco en la prueba UX-06 |

**Estado.** CP5, CP6 y CP7 están implementados, verificados y comparados con la Dirección C; las diferencias aceptadas, el copy nuevo y los límites están arriba. **Falta la aceptación visual y editorial humana.** CP8, el PR final, el push y el release no se iniciaron.
