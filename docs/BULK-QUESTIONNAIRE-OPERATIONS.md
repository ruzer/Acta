# Operaciones masivas de cuestionario

Estado: **IMPLEMENTADO**. Los resultados locales y remotos se distinguen al final del documento. Candidato a una release posterior a v0.2.0; este trabajo no cambia la versión ni crea una release.

## Auditoría inicial

| Operación     | Soporte actual                                            | Reutilizable                                                    | Extensión necesaria                                                            |
| ------------- | --------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Área          | Metadata individual junto con prioridad/orden             | Área activa, autorización y versión de pregunta                 | Cambiar solo responsibleAreaId en lote, por origen o selección completa        |
| Participantes | Asignación individual, clave única pregunta/miembro       | Miembro STAKEHOLDER activo, pertenencia, dependencias, required | Añadir varios participantes; conservar asignaciones activas existentes         |
| Publicación   | DRAFT individual, padres previamente publicados           | Validación de contenido, grupo y condición, revisión inmutable  | Evaluación del estado final del lote y commit atómico                          |
| Locking       | FOR UPDATE del proyecto; lockVersion de cada pregunta     | AccessService.mutate, autorización dentro de transacción        | Snapshot de selección/dependencias/metadatos; no usar solo Project.lockVersion |
| Idempotencia  | Acuse/hash en AuditEvent para revisión                    | requestId, payloadHash, result                                  | Acuse de lote correlacionado y auditoría antes/después                         |
| Organizar     | Inspector individual, 40 filas, búsqueda/tema/publicación | Menú, inspector, paginación y modelo de datos                   | Selección independiente por IDs, filtro de área y preview                      |

## Contrato autoritativo

Los schemas Zod compartidos de `packages/contracts/src/index.ts` son la fuente de verdad. Tres comandos explícitos, cada uno con preview y confirm:

- `POST /projects/:projectId/questions/bulk/area/{preview|confirm}`
- `POST /projects/:projectId/questions/bulk/participants/{preview|confirm}`
- `POST /projects/:projectId/questions/bulk/publish/{preview|confirm}`

Cada cuerpo contiene requestId y preguntas identificadas por id + expectedVersion. Área agrega targetAreaId y sourceAreaId: null significa cambiar toda la selección explícitamente. Participantes agrega projectMemberId + required por persona. No se deducen personas del área. Confirm exige además previewHash obtenido del servidor.

Preview no escribe dominio ni auditoría. Devuelve conteos seleccionados/aplicables/ignorados/bloqueados, advertencias, errores por pregunta/campo, dependencias y resultado esperado. Publicación clasifica READY, WARNING, ALREADY_PUBLISHED o BLOCKED; UNCHANGED cubre operaciones que no cambian datos. Las advertencias no bloquean. La confirmación reevalúa el plan completo y compara el hash antes de escribir.

La selección es explícita e inmutable entre preview y confirm: no se ejecutan filtros dinámicos ni se incorporan dependencias automáticamente. Una dependencia externa puede agregarse voluntariamente en la interfaz; eso invalida el preview anterior y requiere revisarlo nuevamente.

## Atomicidad y concurrencia

Una confirmación = una transacción PostgreSQL. Si una pregunta o dependencia relevante cambió, responder 409 sin modificar nada. No se encadenan endpoints individuales ni se recalcula la revisión por cada elemento.

La idempotencia sigue el patrón AuditEvent existente: mismo actor/requestId/contenido devuelve el acuse original; mismo requestId con otro contenido produce conflicto. La autorización vigente siempre se verifica antes de devolver un acuse. Auditoría registra actor, organización, proyecto, operación, IDs afectados, antes/después, fecha y resultado, sin respuestas privadas ni secretos.

Reutilizar el bloqueo de proyecto y versiones de pregunta; ninguna versión global nueva. Los cambios de área no alteran prioridad, orden, contenido, revisiones publicadas, estado, asignaciones ni relaciones. Añadir participantes conserva asignaciones activas existentes y su required; una relación inactiva puede reactivarse explícitamente con el required solicitado y advertencia en preview. No hay reemplazo ni retirada masiva.

La publicación evalúa dependencias de agrupación y de condición por separado. Padres incluidos pueden publicarse antes dentro de la misma transacción; padres externos DRAFT bloquean hasta selección explícita. No se reescribe contenido publicado. La falta de participantes continúa como advertencia, no como nueva regla institucional.

## Selección y accesibilidad

- Checkbox real por fila, independiente de la pregunta activa en el inspector.
- Página actual (hasta 40) y todos los resultados filtrados usan etiquetas/conteos distintos.
- Seleccionar tema o grupo anuncia el total, incluso elementos fuera de la página/filtros. El grupo recorre únicamente groupParentId, nunca condition.
- Página conserva selección. Cambiar búsqueda, tema, área o publicación la limpia con aviso.
- Barra contextual: asignar área, añadir participantes, publicar y limpiar; menú individual/inspector permanecen.
- Diálogos con foco, retorno al disparador, errores textuales, acciones de corrección y ninguna confirmación optimista falsa.

Límites defensivos: 2.000 preguntas por lote, 20 participantes y 10.000 pares pregunta/participante; coinciden con el alcance cargado del editor y acotan trabajo. Si el proyecto supera el alcance disponible, no afirmar selección completa. Medir 300+ preguntas y consultas antes de declarar la capacidad verificada. No hay SLA.

## Fuera de alcance

Archivado, borrado, condiciones, trazabilidad, prioridad y reemplazo de participantes por lote. No se introducen valores institucionales, nuevos estados de aprobación ni inferencias a partir de nombres de áreas. Una validación técnica no certifica revisión institucional.

## Uso en Organizar

1. Filtra por búsqueda, tema, estado de publicación o área. Marca preguntas o utiliza una selección de página, resultados, tema o grupo.
2. Elige **Asignar área**, **Agregar participantes** o **Publicar seleccionadas**.
3. Configura la operación. En área, elige origen o toda la selección; en participantes, elige personas y obligatoriedad para nuevas/reactivadas.
4. Pulsa **Revisar lote**. Comprueba cantidades, advertencias y dependencias. **Ver resultado por pregunta** detalla los elementos ignorados o bloqueados.
5. Corrige errores o añade explícitamente una dependencia externa y revisa de nuevo. Si el cuestionario cambió, usa **Actualizar y revisar nuevamente**.
6. Confirma el número de preguntas aplicables. El feedback aparece después de la respuesta del servidor. Cancelar el diálogo conserva la selección y no aplica cambios.

El mismo requestId debe reutilizarse al reintentar una confirmación cuya respuesta se perdió. Volver a configurar o revisar crea una nueva intención. Un preview completamente sin cambios no admite confirmación.

## Errores y autorización

- **400:** estructura del comando inválida, IDs duplicados, límites excedidos o participantes/área destino no válidos.
- **403:** rol sin permiso. Solo ADMIN y ANALYST miembros activos del proyecto pueden usar estas operaciones.
- **404:** proyecto/pregunta no disponible dentro del alcance autorizado. No expone datos de otra organización o proyecto.
- **409:** snapshot obsoleto, dependencia o estado bloqueante, o reutilización de requestId con contenido distinto. Sin cambios parciales.
- Un fallo de persistencia revierte cambios y auditoría dentro de la misma transacción. Un fallo de transporte puede ocurrir después de completar el servidor: reintentar el mismo comando recupera el acuse.

Los contratos individuales se mantienen. El esquema de datos, versiones de paquetes, roles y storage no cambian. Una operación sobre un proyecto archivado se rechaza conforme a la política existente. Cambios administrativos o de estructura pueden exigir repetir preview aunque no cambie directamente una pregunta seleccionada.

## Performance observada

Medición local con PostgreSQL 18.6 en contenedor Linux ARM64 y cliente Node 26, sin convertir los valores en SLA. Fixture de 304 preguntas, una persona y dependencias planas; el proyecto también contenía otros casos de prueba. Las consultas se cuentan en el driver PostgreSQL, incluidas las de control de transacción. Cada confirmación usa una petición y una transacción.

| Operación (304 preguntas) | Preview, ms | Consultas preview | Confirm, ms | Consultas confirm |
| ------------------------- | ----------: | ----------------: | ----------: | ----------------: |
| Área                      |        36,8 |                23 |        52,9 |                26 |
| Añadir participantes      |        30,2 |                23 |       128,1 |                60 |
| Publicar                  |        38,6 |                23 |       111,7 |                59 |

La publicación escribe una vez por capa de dependencias. La proyección de revisión carga el grafo por participante, no por pregunta. Más personas, fuentes existentes, invalidaciones o cadenas profundas pueden aumentar tiempo y consultas. La transacción conserva el timeout existente de 15 segundos y revierte si no puede completarse. No se promete capacidad ilimitada ni se han ensayado todas las combinaciones máximas de 2.000 preguntas/10.000 pares.

## Verificación

**VERIFICADO localmente:** unit/component (121), integración PostgreSQL completa (94, incluidas 14 pruebas nuevas de lotes), migraciones desde bases vacías, lint, typecheck, build, Prisma format/validate. Gitleaks sobre el working tree no encontró secretos. Ninguna prueba existente fue omitida ni debilitada.

Los tests nuevos cubren área completa/por origen, preservación de campos, añadir/reactivar sin reemplazar, dependencias dentro/fuera, publicación por orden y ciclos, rollback por fallo tardío de auditoría, versiones obsoletas, dos analistas concurrentes, reintento simultáneo idempotente, permisos vigentes al repetir, aislamiento y límites. Frontend cubre selección a 10/50/120/304, grupo/tema/página/resultados, filtros, independencia del inspector, preview/cancel/error/confirm, foco y reintento con el mismo comando.

**VERIFICADO en navegador:** Playwright completo, 37/37 desde volúmenes de prueba vacíos; sin skips ni retries. Los E2E de esta capacidad recorren 304 preguntas reales, conflictos sin cambios parciales, teclado, reduced motion, axe y reflow 1440/1024/768/390. Se inspeccionaron visualmente las capturas de Organizar y revisión del lote; son evidencia local de datos ficticios y no forman parte del repositorio. Pasan las regresiones individuales, participante, revisión, conflictos, dashboard e importación.

Docker config, construcción desde el repositorio y healthchecks del entorno aislado pasaron. Se comprobaron 254 enlaces relativos sin destinos ausentes. **PENDIENTE remoto:** los checks del PR y de main deben verificarse en GitHub para el commit concreto; los resultados locales no los sustituyen.

La primera ejecución completa detectó una variable de nombre de organización no alineada entre runner y Compose. Se corrigió solo la configuración privada del entorno de prueba. Una repetición sobre la demo ya consumida se detuvo por fixtures antiguos de respuestas; el gate final pasó desde volúmenes TEST vacíos, sin retries automáticos. Estos incidentes no justifican cambiar assertions ni comportamiento productivo.
