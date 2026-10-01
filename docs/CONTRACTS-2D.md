# Contratos de revisión — Fase 2D


## Autoridad

`packages/contracts/src/index.ts`: contratos Zod únicos, tipos derivados y validación de entrada/salida. APIs/UI se implementan después. Contratos aditivos; sin import/export. Actores, fechas y estados los calcula el servidor. UUID opacos; arrays vacíos son ausencia de fuentes, null ausencia explícita de relación/fecha.

## Operaciones

- GET /review: listReviewInbox para proyectos ANALYST; filtros estado/proyecto/tema/prioridad/área/participante, página de 25 y máximo 100. Query: status, projectId, sectionId, priority, areaId, participantId, page, pageSize.
- GET /projects/:projectId/questions/:id/review: getReviewDetail. ANALYST/ADMIN leen solo envíos, nunca drafts; VIEWER solo fuentes de validación vigente y sin comandos.
- GET …/clarifications: myClarifications para STAKEHOLDER, hilo propio y asignación vigente.
- POST …/review/clarifications/request: requestClarification, revisión exacta; threadId nulo crea, existente añade otra pregunta al mismo hilo WAITING_ANALYST.
- POST …/review/clarifications/reply y close: replyClarification (dueño, WAITING_STAKEHOLDER → WAITING_ANALYST); closeClarification (ANALYST, motivo, WAITING_ANALYST → CLOSED).
- POST …/review/partial, pending: markPartial/markPending con motivo y sin bloqueos; no altera cobertura ni omite fuentes.
- POST …/review/validate: validateQuestion con decisión, alcance, excepciones, comentario, fuentes exactas y explicación de cobertura si había vacío manual.
- POST …/review/not-applicable y reopen: markNotApplicable (motivo/alcance), reopenQuestion (motivo y decisión vigente). Historia conservada.
- POST …/review/conflicts y conflicts/resolve: markConflict (dos autores distintos); resolveConflict (texto y fuentes), sin validar automáticamente.

Todos los POST llevan requestId y expectedVersion de Question; hilos/conflictos también su versión. Bloqueo transaccional de proyecto compartido con 2C, autorización vigente y auditoría atómica. Repetir requestId con el mismo contenido devuelve acuse original; distinto contenido → 409. El acuse no contiene respuestas privadas. Cliente conserva texto ante error y vuelve a consultar datos; no sobrescribe automáticamente tras 409.

## Reglas

Precedencia aprobada: CONFLICT > CLARIFICATION_REQUIRED > VALIDATED > NOT_APPLICABLE > PARTIAL > ANSWERED > PENDING > NOT_REVIEWED. Proyección única en Question, sin duplicar estado mutable en Response. Marcación PENDING no elimina aportaciones ni cobertura; si hay envíos/cobertura o bloqueos, prevalece el estado correspondiente según WORKFLOWS.

Validación: publicada, activa, sin bloqueos; fuentes vigentes, cobertura requerida aplicable, autores distintos del validador incluso fuentes transitivas. ValidationSource fija ResponseRevision; ValidationMessage fija mensaje de hilo cerrado; ValidationResolution fija resolución sustentada en revisiones vigentes. Ninguna referencia se valida por cascada.

Guardar Draft no invalida. Nueva SUBMITTED invalida decisión de esa pregunta; cambios condicionales/elegibilidad invalidan decisiones incompatibles, auditando. No aplica bloquea aportaciones hasta reapertura; una condición oculta no equivale a no aplica. Conflictos/hilos no se cierran al reenviar.

## Seguridad y errores

Backend exige roles y ámbito institucional/proyecto; ADMIN no valida, VIEWER no revisa, STAKEHOLDER solo sus hilos. Evidencias reutilizan 2C; sin uploads en aclaraciones. HTTP 400 para entradas de revisión inválidas (422 se conserva en reglas de contenido/evidencia 2C); 401 sesión; 403 rol; 404 recurso fuera de alcance; 409 versión/estado/fuentes/cobertura. Sobre de errores existente sin SQL ni secretos.

## Verificación


## Presentación y fuentes de motivos

reviewDetail expone partialReviewReason y pendingReviewReason (último motivo de pendiente/reapertura en auditoría, únicamente para administración/analista). CanReview exige ANALYST y proyecto activo. El lector recibe solo fuentes vigentes, sin comentarios internos ni motivos de cierre/conflicto no seleccionados. ParticipantView añade reviewQuestionId únicamente cuando hay un destino de consulta autorizado; el endpoint vuelve a comprobarlo.
