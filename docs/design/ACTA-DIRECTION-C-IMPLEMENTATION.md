# Acta — implementación de la Dirección C

Referencia funcional: Acta **v0.5.0**, `d2340e763ea398de0d0f350e65aa319125354e28`.
Rama de trabajo: `feat/acta-direction-c-ui`. Inicio: 2026-10-08.

Este informe separa implementación, pruebas y aceptación humana. Los documentos de diseño y las capturas del laboratorio son referencias; no son evidencia de que el frontend React ya las implemente.

## Alcance y parada obligatoria

Solo presentación frontend. Se conservan contratos, autorización, dominio, backend, Prisma y almacenamiento. No se modifica el downstream institucional ni ninguna instalación persistente. No se cambia versión, no se publica, no se crea release ni tag.

**Después del checkpoint 4 se entregará una comparación desktop/móvil y se detendrá el trabajo para aprobación explícita del producto. Los checkpoints 5–8 y el PR final no están autorizados antes de esa aprobación.**

## Estado real

| Etapa                                     | Estado                     | Evidencia / siguiente comprobación                                                                                |
| ----------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Preparación                               | EN CURSO                   | Base y árbol auditados; rama creada; PostgreSQL desechable nuevo; migraciones oficiales aplicadas                 |
| 1. Tokens, tipografía, componentes        | LISTO PARA REVISIÓN        | Tipos/lint/build, 170 tests frontend, humo 7/7, visual 5/5 y axe 0; aceptación humana pendiente                   |
| 2. Shell, navegación, Atención            | LISTO PARA REVISIÓN        | Gate visual 12/12, 231 unit/component, 11 workbench, 3 simplicity, humo 7 casos; límites ARCHIVED descritos abajo |
| 3. Cuestionario / Organizar / lotes | LISTO PARA REVISIÓN | 174 unit, 28 E2E funcionales, 15 visuales, 3 de fixture independiente; cinco anchos y DEV-26 aprobada |
| 4. Revisión / aportaciones / solo lectura | NO INICIADO                | Depende del checkpoint 3; después requiere revisión humana                                                        |
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

**DEV-25 propuesta, pendiente de decisión del producto:** el fixture de 50 aportaciones pide PARTIAL mientras contiene aclaraciones abiertas. La proyección real prioriza CLARIFICATION_REQUIRED. Se solicitó autorización para conservar los hilos y el estado real, con un caso parcial separado; ese caso no se ha sembrado ni se ha cambiado el backend. La preparación de los demás casos no depende de esa decisión.

## Matriz de aceptación

Los checkpoints 1–3 tienen evidencia React. Las filas de los checkpoints 4–8 siguen pendientes. V-01b ADMIN se comprobó en navegador; ARCHIVED solo tiene cobertura de derivación unitaria (DEV-24), sin captura de un proyecto archivado real. No se atribuyen al producto resultados del prototipo.

| Filas                      | Pantallas / variantes                                      | Checkpoint | Estado                                                    |
| -------------------------- | ---------------------------------------------------------- | ---------- | --------------------------------------------------------- |
| V-00 base                  | Tokens y componentes                                       | 1          | LISTO PARA REVISIÓN                                       |
| V-00, V-01, V-01b          | Shell; Atención analista y ADMIN; derivación ARCHIVED      | 2          | LISTO PARA REVISIÓN con DEV-03/19/20/24 y límite ARCHIVED |
| V-02, V-02b, V-02c, V-03 | Organizar 304, Preparar, lote, autoría | 3 | LISTO PARA REVISIÓN con DEV-09/16/26 |
| V-04…V-08                  | Revisión 1, 3, 12, 50, 0 aportaciones                      | 4          | PENDIENTE                                                 |
| V-13/V-14 composición base | ADMIN completo sin acciones; VIEWER filtrado               | 4          | PENDIENTE                                                 |
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

CP2 incorpora las etiquetas de turno y navegación listadas al final de su informe. Los textos de revisión/decisión/carta aún no se implementan. Confirmación editorial humana pendiente conforme a DEV-08; no se inventa identidad del invitado, consenso ni autoguardado.

## Límites y pendientes humanos

Pendientes lector de pantalla, zoom real, colores forzados, modo oscuro, dispositivos táctiles y navegadores distintos de Chromium. Axe sin violaciones no significa conformidad WCAG. La aceptación visual corresponde a producto.

## Revisión de alcance y publicación

Solo presentación frontend y verificación/documentación. Backend, contratos, Prisma y almacenamiento: diff vacío respecto de v0.5.0. No hay PR ni push. **READY FOR REVIEW: NO** para el conjunto; checkpoints 1–3 listos para revisión técnica, checkpoint 4 pendiente antes de la revisión humana obligatoria.

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

Métricas: [metrics-cp1.json](acta-direction-c-evidence/metrics-cp1.json). Líneas base de producto: [baseline-metrics.json](acta-direction-c-evidence/baseline-metrics.json), 50 capturas de 10 variantes × 5 anchos. El caso de 50 queda pendiente de DEV-25.

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

**Límites:** ARCHIVED cubierto en tabla de verdad, no en navegador; distribución 304 del fixture y conteos reales difieren de los orientativos de C; no se inventan avisos de actualización, extractos ni contadores de navegación. El menú móvil añade acceso explícito a la cuenta para conservar operaciones reales. Aceptación visual y editorial humana pendiente. DEV-25 sigue pendiente, no bloquea CP3.

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
