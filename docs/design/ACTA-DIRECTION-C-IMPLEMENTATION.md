# Acta — implementación de la Dirección C

Referencia funcional: Acta **v0.5.0**, `d2340e763ea398de0d0f350e65aa319125354e28`.
Rama de trabajo: `feat/acta-direction-c-ui`. Inicio: 2026-10-08.

Este informe separa implementación, pruebas y aceptación humana. Los documentos de diseño y las capturas del laboratorio son referencias; no son evidencia de que el frontend React ya las implemente.

## Alcance y parada obligatoria

Solo presentación frontend. Se conservan contratos, autorización, dominio, backend, Prisma y almacenamiento. No se modifica el downstream institucional ni ninguna instalación persistente. No se cambia versión, no se publica, no se crea release ni tag.

**Después del checkpoint 4 se entregará una comparación desktop/móvil y se detendrá el trabajo para aprobación explícita del producto. Los checkpoints 5–8 y el PR final no están autorizados antes de esa aprobación.**

## Estado real

| Etapa                                     | Estado                     | Evidencia / siguiente comprobación                                                                |
| ----------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------- |
| Preparación                               | EN CURSO                   | Base y árbol auditados; rama creada; PostgreSQL desechable nuevo; migraciones oficiales aplicadas |
| 1. Tokens, tipografía, componentes        | LISTO PARA REVISIÓN        | Tipos/lint/build, 170 tests frontend, humo 7/7, visual 5/5 y axe 0; aceptación humana pendiente   |
| 2. Shell, navegación, Atención            | NO INICIADO                | Depende del checkpoint 1                                                                          |
| 3. Cuestionario / Organizar / lotes       | NO INICIADO                | Depende del checkpoint 2                                                                          |
| 4. Revisión / aportaciones / solo lectura | NO INICIADO                | Depende del checkpoint 3; después requiere revisión humana                                        |
| 5. Conflictos / aclaraciones / decisiones | ESPERA APROBACIÓN POST-CP4 | No implementar todavía                                                                            |
| 6. Participante / invitado                | ESPERA APROBACIÓN POST-CP4 | No implementar todavía                                                                            |
| 7. Administración / consistencia          | ESPERA APROBACIÓN POST-CP4 | No implementar todavía                                                                            |
| 8. Validación integral / PR borrador      | ESPERA APROBACIÓN POST-CP4 | No publicar todavía                                                                               |

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

La base del checkpoint 1 tiene evidencia React. Las filas de pantallas de los checkpoints 2–8 siguen pendientes. No se atribuyen al producto los resultados del prototipo.

| Filas                      | Pantallas / variantes                                      | Checkpoint | Estado              |
| -------------------------- | ---------------------------------------------------------- | ---------- | ------------------- |
| V-00 base                  | Tokens y componentes                                       | 1          | LISTO PARA REVISIÓN |
| V-00, V-01, V-01b          | Shell; Atención analista, administración y archivado       | 2          | PENDIENTE           |
| V-02, V-02b, V-02c, V-03   | Organizar 304, Preparar, lote, autoría                     | 3          | PENDIENTE           |
| V-04…V-08                  | Revisión 1, 3, 12, 50, 0 aportaciones                      | 4          | PENDIENTE           |
| V-13/V-14 composición base | ADMIN completo sin acciones; VIEWER filtrado               | 4          | PENDIENTE           |
| V-09…V-14 detalle          | Contraste, aclaraciones, decisiones y consulta             | 5          | POST-APROBACIÓN     |
| V-15…V-22                  | Mi trabajo, responder, recibos, invitado                   | 6          | POST-APROBACIÓN     |
| V-23…V-27                  | Administración, invitaciones, lector y pantallas restantes | 7          | POST-APROBACIÓN     |
| Matriz completa            | Todos los roles y cinco anchos                             | 8          | POST-APROBACIÓN     |

Cada fila tendrá nueve aspectos: jerarquía, composición, tipografía, espaciado, densidad, agrupación, ubicación de acciones, estados y responsive. Capturas a 1440×900, 1024×768, 768×1024, 390×844 y 320×640. Se adjuntarán métricas, axe, teclado, foco y revisión de los 14 detectores de jerarquía antigua. Ninguna fila se declara aprobada por Codex.

## Libro de aserciones

Sin cambios de aserciones de tests existentes. Se añadieron pruebas nuevas de componentes y métricas visuales. No hay skips, reintentos ni aumentos de timeout. Cada ajuste posterior de una aserción existente deberá justificar su equivalencia funcional.

## Adaptaciones y contrastación de fuentes

- Se aplicarán únicamente las adaptaciones preautorizadas DEV-01…DEV-24 del Acceptance; una nueva incompatibilidad se elevará al producto.
- Confirmado en código: ADMIN consulta detalle completo sin revisar; VIEWER solo obtiene decisión vigente y fuentes filtradas. `canReview` exige ANALYST y proyecto ACTIVE.
- Confirmado: el editor de preguntas usa estado local y Zod; React Hook Form pertenece a Respond. La descripción general del inventario Claude no sustituye al código.
- Confirmado: dashboard no expone texto de decisión ni texto completo de pregunta. No se añadirá una consulta por fila para llenar esos huecos.
- Serif: obtenidos los TTF oficiales 400, 400 cursiva y 700 de `@ibm/plex-serif@2.0.0`; SHA-256 del ZIP verificado contra el digest de la release oficial. OFL 1.1 comprobada. Empaquetados sin modificar, con OFL adyacente y avisos/inventario actualizados. La pila documental está disponible; las pantallas se migrarán en sus respectivos checkpoints. Test de red: todas las fuentes locales, ningún request Manrope/CDN. TTF añadidos: 665.660 bytes; OFL: 4,362 bytes (saltos LF; palabras verificadas contra el original).

## Copy nuevo para revisión de producto

Todavía no incorporado. El registro final distinguirá textos existentes de textos nuevos: etiquetas de turno aprobadas, titulares de StateCard, pestañas de revisión y otros textos definidos en Acceptance §10. No se inventará identidad del invitado, consenso ni autoguardado.

## Límites y pendientes humanos

Pendientes lector de pantalla, zoom real, colores forzados, modo oscuro, dispositivos táctiles y navegadores distintos de Chromium. Axe sin violaciones no significa conformidad WCAG. La aceptación visual corresponde a producto.

## Revisión de alcance y publicación

Solo presentación frontend y verificación/documentación. Backend, contratos, Prisma y almacenamiento: diff vacío respecto de v0.5.0. No hay PR ni push. **READY FOR REVIEW: NO** para el conjunto; checkpoint 1 listo para revisión técnica, checkpoints 2–4 pendientes antes de la revisión humana obligatoria.

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
