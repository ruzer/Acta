# Acta — implementación de la Dirección C

Referencia funcional: Acta **v0.5.0**, `d2340e763ea398de0d0f350e65aa319125354e28`.
Rama de trabajo: `feat/acta-direction-c-ui`. Inicio: 2026-10-08.

Este informe separa implementación, pruebas y aceptación humana. Los documentos de diseño y las capturas del laboratorio son referencias; no son evidencia de que el frontend React ya las implemente.

## Alcance y parada obligatoria

Solo presentación frontend. Se conservan contratos, autorización, dominio, backend, Prisma y almacenamiento. No se modifica el downstream institucional ni ninguna instalación persistente. No se cambia versión, no se publica, no se crea release ni tag.

**Después del checkpoint 4 se entregará una comparación desktop/móvil y se detendrá el trabajo para aprobación explícita del producto. Los checkpoints 5–8 y el PR final no están autorizados antes de esa aprobación.**

## Comparativas para la revisión humana

Referencia aprobada a la izquierda; React implementado a la derecha. Cada fila del informe conserva además 1024, 768 y 320 px. La aceptación de producto todavía no está otorgada.

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

## Estado real

| Etapa                                     | Estado                     | Evidencia / siguiente comprobación                                                                                |
| ----------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Preparación                               | EN CURSO                   | Base y árbol auditados; rama creada; PostgreSQL desechable nuevo; migraciones oficiales aplicadas                 |
| 1. Tokens, tipografía, componentes        | LISTO PARA REVISIÓN        | Tipos/lint/build, 170 tests frontend, humo 7/7, visual 5/5 y axe 0; aceptación humana pendiente                   |
| 2. Shell, navegación, Atención            | LISTO PARA REVISIÓN        | Gate visual 12/12, 231 unit/component, 11 workbench, 3 simplicity, humo 7 casos; límites ARCHIVED descritos abajo |
| 3. Cuestionario / Organizar / lotes | LISTO PARA REVISIÓN | 174 unit, 28 E2E funcionales, 15 visuales, 3 de fixture independiente; cinco anchos y DEV-26 aprobada |
| 4. Revisión / aportaciones / solo lectura | LISTO PARA REVISIÓN, con correcciones posteriores a la auditoría | 284 unit tras las correcciones (264 al cierre), 15 E2E funcionales y 40 vistas + 1 gate de permisos al cierre; DEV-25 aplicada; **E2E pendiente de re-ejecución tras las correcciones**; requiere aceptación humana |
| 5. Conflictos / aclaraciones / decisiones | ESPERA APROBACIÓN POST-CP4 | No implementar todavía                                                                                            |
| 6. Participante / invitado                | ESPERA APROBACIÓN POST-CP4 | No implementar todavía                                                                                            |
| 7. Administración / consistencia          | ESPERA APROBACIÓN POST-CP4 | No implementar todavía                                                                                            |
| 8. Validación integral / PR borrador      | ESPERA APROBACIÓN POST-CP4 | No publicar todavía                                                                                               |

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

Los checkpoints 1–4 tienen evidencia React. CP4 cubre 0/1/3/12/50 aportaciones, un caso parcial separado y solo lectura. Los checkpoints 5–8 no se han iniciado. V-01b ADMIN se comprobó en navegador; ARCHIVED solo tiene cobertura de derivación unitaria (DEV-24), sin captura de un proyecto archivado real. No se atribuyen al producto resultados del prototipo.

| Filas                      | Pantallas / variantes                                      | Checkpoint | Estado                                                    |
| -------------------------- | ---------------------------------------------------------- | ---------- | --------------------------------------------------------- |
| V-00 base                  | Tokens y componentes                                       | 1          | LISTO PARA REVISIÓN                                       |
| V-00, V-01, V-01b          | Shell; Atención analista y ADMIN; derivación ARCHIVED      | 2          | LISTO PARA REVISIÓN con DEV-03/19/20/24 y límite ARCHIVED |
| V-02, V-02b, V-02c, V-03 | Organizar 304, Preparar, lote, autoría | 3 | LISTO PARA REVISIÓN con DEV-09/16/26 |
| V-04…V-08 + V-07-partial | Revisión 1, 3, 12, 50, 0 aportaciones y parcial real | 4 | LISTO PARA REVISIÓN con DEV-25 |
| V-13/V-14 composición base | ADMIN completo sin acciones; VIEWER filtrado | 4 | LISTO PARA REVISIÓN con DEV-20/24; documento final en CP5 |
| V-09…V-14 detalle          | Contraste, aclaraciones, decisiones y consulta             | 5          | POST-APROBACIÓN                                           |
| V-15…V-22                  | Mi trabajo, responder, recibos, invitado                   | 6          | POST-APROBACIÓN                                           |
| V-23…V-27                  | Administración, invitaciones, lector y pantallas restantes | 7          | POST-APROBACIÓN                                           |
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

Solo presentación frontend y verificación/documentación. Backend, contratos, Prisma y almacenamiento: diff vacío respecto de v0.5.0. No hay PR ni push. **READY FOR REVIEW: YES, exclusivamente checkpoints 1–4.** La implementación integral 1–8 no está terminada. Se hace la parada humana obligatoria; CP5–8, push y PR no están autorizados todavía por este gate.

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
