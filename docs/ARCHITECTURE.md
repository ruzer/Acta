# Arquitectura

Monorepo TypeScript: React/Vite en `app/frontend`, NestJS en `app/backend`, contratos Zod compartidos en `packages/contracts`, PostgreSQL/Prisma para persistencia. No se necesita Redis.

UI → contrato → DTO validado → caso de uso → persistencia. El backend determina permisos, pertenencia, estado e invariantes; ocultar un botón no autoriza operaciones. Organization conserva el aislamiento; una instalación resuelve su organización en servidor sin pedir códigos en login.

Proyecto → temas (Section) → preguntas → seguimientos. No existe una entidad Questionnaire independiente. Agrupación por groupParentId y condición son conceptos distintos. Los identificadores externos se conservan exactamente.

ResponseDraft es editable, privado y persistente con control de versión. Enviar produce ResponseRevision inmutable. Validaciones apuntan a envíos concretos; no a borradores. Conflicto y decisión validada son operaciones distintas. Las referencias de trazabilidad no heredan estados de preguntas.

Evidence usa una abstracción de storage LOCAL/S3. El despliegue recomendado utiliza VersityGW; el dominio no depende de ese producto. El backend valida/autoriza antes de devolver bytes y comprueba su SHA-256. No se promete una transacción física conjunta de PostgreSQL y objetos: staging, auditoría y reconciliación gestionan fallos parciales.

Compose separa migraciones con credencial propietaria de la API con rol limitado. El bootstrap inicial explícito exige cambio de contraseña. Los volúmenes de secretos son privados. Single-host, sin garantía HA.

Fuentes ejecutables: [schema Prisma](../app/backend/prisma/schema.prisma), [contratos](../packages/contracts/src/index.ts). Contratos descriptivos: [identidad/cuestionarios](CONTRACTS-2AB.md), [respuestas](CONTRACTS-2C.md), [revisión](CONTRACTS-2D.md), [intercambio](CONTRACTS-2E.md). Operación: [SELF-HOSTING](SELF-HOSTING.md).

Navegación: [Contratos por función](CONTRACTS.md) · [Desarrollo](DEVELOPMENT.md) · [Documentación por audiencia](README.md).

## Extensibilidad y forks

Estas categorías orientan contribuciones; no añaden entidades, interfaces de plugins ni módulos a la arquitectura existente.

| Categoría | Límite conceptual |
|---|---|
| CORE | Cuestionarios, respuestas, evidencia, revisión, decisiones y contratos genéricos, con invariantes y autorización comunes |
| INTEGRATIONS | Adaptadores a otros sistemas; separar dependencias particulares cuando sea viable y proponer al core solo las partes reutilizables |
| BRANDING | Identidad mediante configuración existente; evitar forks de código solo para cambiar nombre o assets autorizados |
| INFRASTRUCTURE | Compose, persistencia, S3 y operación; configuración propia no equivale a un provider nuevo verificado |

Una personalización no justifica debilitar aislamiento ni cambiar contratos silenciosamente. Los detalles específicos pueden mantenerse en un fork según la licencia aplicable; mantenerlos fuera de upstream no concede una excepción a obligaciones legales. [Guía de forks](UPSTREAM-FORKS.md) · [Gobernanza](../GOVERNANCE.md).

## Operaciones masivas de cuestionario

Organizar conserva el inspector individual y mantiene por separado un conjunto de IDs seleccionados. Tres comandos explícitos (área, añadir participantes y publicar) tienen preview y confirmación, definidos por los schemas Zod compartidos. El frontend no encadena operaciones individuales.

`BulkQuestionnaireService` carga el contexto del proyecto una vez, valida el estado final propuesto y entrega un hash de revisión. La confirmación usa `AccessService.mutate`: bloqueo PostgreSQL del proyecto, autorización vigente y una transacción para cambios, proyección de revisión y auditoría. El hash incluye versiones de preguntas seleccionadas y dependencias, estructura y estado administrativo relevante; no depende únicamente de la versión de Project. Los cambios de metadata/asignaciones ya incrementan la versión de Question.

La publicación por capas respeta grupo y condición sin confundirlos. La validación pura compartida comprueba contenido/configuración y relaciones; los endpoints individuales conservan sus comprobaciones existentes. La proyección de revisión consulta validaciones, conflictos, aclaraciones y disposiciones por proyecto, actualiza estados por conjuntos y se ejecuta una vez por lote. No cambia la precedencia de estados ni la invalidación de fuentes.

La auditoría correlacionada `QUESTIONNAIRE_BATCH_APPLIED` conserva requestId, hash del comando, acuse, IDs y metadatos anteriores/resultantes. Repetir el mismo comando por el mismo actor devuelve el acuse sin repetir escrituras; otro contenido con la misma clave produce conflicto. No se agrega esquema ni migración. [Contrato, límites y mediciones](BULK-QUESTIONNAIRE-OPERATIONS.md).
