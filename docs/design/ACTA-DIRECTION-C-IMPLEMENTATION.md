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
| 3. Cuestionario / Organizar / lotes       | NO INICIADO                | Depende del checkpoint 2                                                                                          |
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

Los checkpoints 1–2 tienen evidencia React. Las filas de los checkpoints 3–8 siguen pendientes. V-01b ADMIN se comprobó en navegador; ARCHIVED solo tiene cobertura de derivación unitaria (DEV-24), sin captura de un proyecto archivado real. No se atribuyen al producto resultados del prototipo.

| Filas                      | Pantallas / variantes                                      | Checkpoint | Estado                                                    |
| -------------------------- | ---------------------------------------------------------- | ---------- | --------------------------------------------------------- |
| V-00 base                  | Tokens y componentes                                       | 1          | LISTO PARA REVISIÓN                                       |
| V-00, V-01, V-01b          | Shell; Atención analista y ADMIN; derivación ARCHIVED      | 2          | LISTO PARA REVISIÓN con DEV-03/19/20/24 y límite ARCHIVED |
| V-02, V-02b, V-02c, V-03   | Organizar 304, Preparar, lote, autoría                     | 3          | PENDIENTE                                                 |
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

Solo presentación frontend y verificación/documentación. Backend, contratos, Prisma y almacenamiento: diff vacío respecto de v0.5.0. No hay PR ni push. **READY FOR REVIEW: NO** para el conjunto; checkpoints 1–2 listos para revisión técnica, checkpoints 3–4 pendientes antes de la revisión humana obligatoria.

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
