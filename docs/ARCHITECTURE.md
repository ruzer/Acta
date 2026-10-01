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
