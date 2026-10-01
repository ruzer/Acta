# Contratos 2A/2B

Definidos antes de los módulos. Fuente canónica: packages/contracts/src/index.ts (`contracts`, esquemas Zod strict y tipos inferidos). Un único workspace TypeScript comparte validación runtime y tipos: no se duplican DTO manuales en UI/API. Owner: este repositorio; consumidores: SPA y tests HTTP. Prefijo /api/v1.

Authentication: login devuelve sesión en cookie HttpOnly y me con token CSRF; logout/cambio revocan. Organization: lectura de organización actual. Users/Areas/Projects: lectura/alta autorizadas; desactivación y password temporal son comandos. ProjectMembers: asignación explícita de rol/área/estado. Sections: alta. Questions: crear, reemplazar contenido solo draft con expectedVersion; QuestionOptions/Conditions/Traceability links forman parte de ese comando atómico. QuestionAssignments, Publication, Archive y metadata son comandos propios.

Todos los schemas rechazan campos desconocidos. ID es string opaco; externalId conserva bytes/case/padding. 400 entrada inválida, 401 sin sesión, 403 rol/CSRF/cambio de contraseña obligatorio, 404 recurso fuera de alcance, 409 versión/estado/unicidad, 429 límite de login, 500 mensaje genérico. Error único: code/message/fieldErrors opcional/requestId. Arrays vacíos significan colección sin elementos; relaciones opcionales usan null explícito.

El guard valida cookie y usuario activo; el caso de uso valida membresías actuales; en mutaciones token CSRF y Origin coinciden. Login exige Origin confiable y JSON, sin cookie previa. Me entrega token CSRF ligado a la sesión. Backend valida outputs con los mismos esquemas; cliente también los analiza. Nunca devuelve una fila ORM sin serializar.

Editor: questionnaireView con referencias, opciones y asignaciones. Participante: participantView sin externalId/UUID visibles, enums internos o trazabilidad; solo presentación de preguntas publicadas asignadas. No hay operaciones de respuestas, evidencia, revisión, dashboard, importación o exportación en 2A/2B.

Colecciones administrativas con topes explícitos (500 usuarios/miembros/áreas; 2.000 preguntas; 10.000 referencias). Todavía no hay navegación paginada; se requiere ampliar el contrato antes de superar estos volúmenes. La UI muestra información de fase sin simular progreso de respuestas ni ofrecer Guardar/Enviar aún.

Extensión autorizada posterior: [Contratos 2C](CONTRACTS-2C.md). Salvo el ajuste de login documentado abajo, las operaciones 2A/2B conservan su forma; las consultas propias de respuestas son nuevas operaciones separadas.

## Ajuste aprobado posterior a 2C: login de una institución

**IMPLEMENTADO.** `POST /api/v1/auth/login` acepta exclusivamente `{username, password}`. Zod strict rechaza `organization`, `organizationId`, `organizationCode` y cualquier campo adicional con 400; clientes anteriores deben recargar/actualizar. La institución la resuelve `ORGANIZATION_CODE` en el servidor. Usuario válido devuelve la misma cookie HttpOnly y `meView`/CSRF; 401 y mensaje genérico para credenciales incorrectas, cuenta inexistente/inactiva o institución configurada inexistente. Rate limiting permanece en 429 y usa código configurado + username, además de IP.

`GET /api/v1/auth/context` es público y devuelve `{mode: "single-organization", institutionName: string}`. Solo entrega presentación: ningún UUID/código, listado de instituciones ni selector. 503 genérico si la institución no está disponible. El navegador no reenvía este contexto como autoridad. Sesiones de otra institución también se rechazan en esta instalación; se conserva el scope por proyecto y todos los controles existentes.

**PROPUESTO:** resolver un dominio/subdominio mediante una tabla/configuración controlada en servidor permitiría conservar `{username,password}`. Si en el futuro se aprueba un selector real, se extenderá explícitamente el contrato de descubrimiento/contexto con opciones autorizadas; no se habilitan campos arbitrarios ni selección actualmente. La función de resolución queda centralizada en AuthService. Organization y la unicidad compuesta del usuario no se eliminan.
