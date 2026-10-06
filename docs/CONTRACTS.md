# Contratos por función

Usa este índice para localizar capacidades sin conocer las fases históricas. Se conservan los documentos originales y sus nombres para no romper referencias; sus afirmaciones de alcance deben leerse en su contexto temporal, junto con las extensiones posteriores.

| Función | Documento descriptivo | Fuente ejecutable |
|---|---|---|
| Authentication — acceso y sesión | [Identidad y administración](CONTRACTS-2AB.md), incluido ajuste de login | [Contratos compartidos](../packages/contracts/src/index.ts) |
| Administration — usuarios, áreas, proyectos y miembros | [Administración](CONTRACTS-2AB.md) | [Contratos compartidos](../packages/contracts/src/index.ts) |
| Questionnaires — temas, preguntas, opciones, condiciones, asignación, orden y publicación | [Cuestionarios](CONTRACTS-2AB.md) | [Contratos compartidos](../packages/contracts/src/index.ts), [módulo cuestionario](../app/backend/src/questionnaire) |
| Questionnaire batches — área, añadir participantes, publicar con revisión previa          | [Operaciones masivas](BULK-QUESTIONNAIRE-OPERATIONS.md)                    | [Schemas y seis endpoints](../packages/contracts/src/index.ts), [servicio transaccional](../app/backend/src/questionnaire/bulk-questionnaire.service.ts) |
| Responses/Evidence — borradores, envíos y archivos | [Respuestas y evidencia](CONTRACTS-2C.md) | [Contratos compartidos](../packages/contracts/src/index.ts), [presentación participante](../packages/contracts/src/participant.ts) |
| Review/Clarifications — aclaraciones, conflictos y decisiones | [Revisión](CONTRACTS-2D.md) | [Contratos compartidos](../packages/contracts/src/index.ts) |
| Dashboard/Traceability — métricas, referencias y bitácora | [Visibilidad](CONTRACTS-2E.md) | [Contratos compartidos](../packages/contracts/src/index.ts) |
| Import/Export — intercambio | [Intercambio](CONTRACTS-2E.md), [Formato de importación](IMPORT-FORMAT.md) | [Contratos compartidos](../packages/contracts/src/index.ts) |

Los esquemas Zod y endpoints implementados son la referencia ejecutable vigente. Este índice no crea endpoints, campos ni permisos. Para entender entidades y relaciones: [Modelo de dominio](DOMAIN-MODEL.md) y [Arquitectura](ARCHITECTURE.md).
