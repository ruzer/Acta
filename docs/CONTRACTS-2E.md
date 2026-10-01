# Contratos 2E — visibilidad e intercambio


Autoridad de tipos: packages/contracts/src/index.ts (@requirements/contracts). Consumidor React y proveedor Nest comparten validación Zod. Los contratos aprobados de IMPORT-FORMAT, WORKFLOWS y SECURITY conservan su semántica.

## Operaciones

- GET /projects/:projectId/dashboard: ADMIN/ANALYST; universo publicado, métricas numerador/denominador/porcentaje nullable, ocho estados y desgloses independientes. Filtros locales sobre el mismo snapshot.
- GET /projects/:projectId/traceability: ADMIN/ANALYST; catálogo y enlaces a preguntas, sin estado de referencia.
- GET /projects/:projectId/history: ADMIN/ANALYST; página de 50 como máximo, filtros objeto/actor/acción/desde/hasta. Metadatos seguros; nunca before/after/result de borradores.
- POST /projects/:projectId/imports/preview: archivo exacto application/octet-stream; sesión/CSRF/Origin antes de leer bytes. No escribe dominio. Retorna SHA256, versión, conteos, áreas faltantes, advertencias y errores con JSON Pointer.
- POST /projects/:projectId/imports/confirm: mismos bytes; encabezado x-import-command con JSON URI-encoded {payloadHash, expectedProjectVersion, requestId, createMissingAreas}. Revalida y bloquea Project. Idempotencia actor/proyecto/requestId/hash. ADMIN puede consentir áreas faltantes; ANALYST debe resolverlas previamente.
- POST /projects/:projectId/exports: {format: JSON|CSV|MARKDOWN, scope: full|validated-decisions, requestId}. Entrega attachment UTF-8 tras registrar EXPORT_CREATED. VIEWER solo JSON validated-decisions. STAKEHOLDER denegado.

Errores: 400 entrada/archivo inválido o proyecto no vacío; 403 rol; 404 recurso fuera de ámbito; 409 versión, hash o requestId incompatible; 413 límite; 503 capacidad ocupada. Validación fallida de preview retorna errores legibles sin escritura. El cliente no conserva preview al cambiar archivo.

## Persistencia y seguridad

ImportBatch ya existe. Solo se habilita INSERT runtime, nunca UPDATE/DELETE. Project.lockVersion se incrementa al importar. Identificadores, sourceLocator y snapshots se conservan exactos. La bitácora pública usa lista permitida de campos, no un filtro por nombres de secretos.

Exportar utiliza snapshot coherente, permite únicamente datos funcionales autorizados y aplica límites de recursos explícitos. Los binarios se descargan separadamente con autorización renovada. JSON funcional no es backup completo ni formato de restauración.

## Verificación

T07/T08/T11/T13/T14/T17/T18/T20, HTTP PostgreSQL real, E2E A–F, axe y todos los gates solicitados. Ningún PASS se declara antes de ejecutarlo.
