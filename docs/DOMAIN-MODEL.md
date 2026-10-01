# Modelo de dominio

La estructura es Organization → Project → Section (Tema) → Question. No hay una entidad Questionnaire separada. La membresía del proyecto y las asignaciones a participantes son explícitas; un área responsable no asigna usuarios automáticamente.

## Preguntas y condiciones

Tipos: YES_NO, SINGLE_CHOICE, MULTIPLE_CHOICE, SHORT_TEXT, LONG_TEXT, DATE, NUMBER y MATRIX. externalId se preserva exactamente; mover/reordenar no lo renumera. El orden visual y la identidad son independientes.

Un seguimiento por groupParentId puede existir sin condición. Una condición tiene un único predicado, con EQUALS, NOT_EQUALS o CONTAINS; no hay AND/OR ni scripts. EQUALS/NOT_EQUALS compara booleanos o un código SINGLE_CHOICE; CONTAINS un código MULTIPLE_CHOICE. Una respuesta desconocida del padre no satisface NOT_EQUALS. La validación de compatibilidad, pertenencia y ciclos reside en backend.

## Aportaciones y decisiones

Response tiene un borrador privado persistente, editable con control de versión. Guardar no crea envío. Enviar produce ResponseRevision SUBMITTED inmutable; la evidencia se vincula a la versión concreta. Necesito consultar es una marca de borrador, no un nuevo estado de revisión.

Aclaraciones conservan mensajes, autores y fechas. Resolver un conflicto no valida automáticamente una decisión. Validation se apoya en revisiones enviadas y fuentes explícitas, nunca en borradores. El historial conserva las decisiones invalidadas sin presentarlas como vigentes. TraceabilityReference no hereda VALIDATED desde una pregunta relacionada.

El backend decide autorización/aislamiento y proyecciones de estado. Fuentes ejecutables: [schema](../app/backend/prisma/schema.prisma), [contratos](../packages/contracts/src/index.ts), [reglas de cuestionario](../app/backend/src/questionnaire/rules.ts) y [reglas de respuestas](../app/backend/src/responses/answer-rules.ts).
