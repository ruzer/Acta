# Acta — manifiesto del snapshot

- **Producto:** Acta.
- **Tagline:** Questions. Evidence. Decisions.
- **Licencia vigente: AGPL-3.0-only.** Titularidad y autorización confirmadas el 2026-10-01 por Cristóbal Ruz Escobar.
- **Snapshot:** 0.2.0-review-20260930, no es una release pública.
- **Fecha de verificación técnica y revisión editorial:** 2026-09-30.
- **PUBLIC SNAPSHOT READY FOR REVIEW: YES.**
- **PUBLIC PRESENTATION READY: YES.** Preparado para revisión, no para publicación.
- Publicación inicial condicionada al gate remoto y checks de seguridad. Consulta [LICENSE](LICENSE).

## Capacidades y servicios

Proyectos, temas, ocho tipos de pregunta incluida matriz, seguimientos, condiciones, asignaciones y orden transaccional. Editor Escribir/Organizar/Revisar y vista previa de lectura. Borradores privados persistentes, envíos inmutables, evidencia, aclaraciones, conflictos, decisiones con fuentes, dashboard, trazabilidad, importación JSON, exportaciones autorizadas y bitácora.

Servicios incluidos: frontend, backend, PostgreSQL y **VersityGW 1.8.0**, con trabajos de secretos, migraciones y bucket privado. No se necesita Redis. Bootstrap explícito de administrador, cambio obligatorio de contraseña y demo ficticia opcional. El almacenamiento se conecta mediante la abstracción S3.

## Verificación técnica previa de este snapshot

Resultados ejecutados el 2026-09-30 antes de la revisión editorial; no se presentan como pruebas repetidas por modificar documentación.

| Comprobación | Resultado observado |
|---|---|
| Instalación npm independiente | PASS; lockfile conservado |
| Prisma format / validate / generate | PASS; esquema conservado |
| Migraciones desde PostgreSQL vacío | PASS, mediante migraciones versionadas |
| Lint / typecheck | PASS |
| Unit/component | 92/92 PASS |
| Integración PostgreSQL | 78/78 PASS, sin skips |
| S3/API real con VersityGW | 21/21 PASS, sin skips ni retries |
| Playwright completo Chromium | 32/32 PASS, sin skips y retries=0; incluye consulta autorizada de decisiones |
| Build frontend/backend | PASS |
| Docker config/build e instalación limpia | PASS, DB/bucket/secretos nuevos |
| Recorrido funcional navegador/API | PASS: editor, publicación/asignación, borradores/envío, aclaraciones, validación, conflicto, dashboard, trazabilidad, exportación y evidencia; responsive/axe incluidos |
| Reinicio | PASS: usuarios, proyecto, respuesta, decisión vigente/fuente y evidencia preservados |
| Backup y restauración destructiva TEST | PASS: dump + archivos/secretos, eliminación solo de volúmenes TEST y restauración con la misma decisión/fuente y SHA-256 |
| Privacidad runtime | Inspección estática y navegación Chromium acotada: solo peticiones al origen de instalación; sin integración de fuentes/CDN/analytics externos |
| Escaneo de secretos | Gitleaks 8.30.1, sin hallazgos pendientes, excepciones exactas de fixtures/integridad |

La restauración comprobó el ID original de la decisión vigente y su fuente enviada, además de login y archivo. La receta documentada reproduce los comandos ensayados: [Backup/restore](docs/BACKUP-RESTORE.md).

## Revisión editorial y presentación previa al rebranding

Idioma principal: español. [Navegación por audiencia](docs/README.md), [desarrollo](docs/DEVELOPMENT.md) e [índice funcional de contratos](docs/CONTRACTS.md). Los contratos históricos permanecen sin cambios semánticos. No se modificaron funcionalidad, dominio, permisos ni interfaz.

| Comprobación repetida | Resultado |
|---|---|
| Lint | PASS |
| Typecheck | PASS |
| Build frontend/backend | PASS; permanece aviso de bundle superior a 500 kB |
| Docker Compose config | PASS |
| Quick Start con demo nueva | PASS: migraciones, cuatro servicios saludables, login y cambio obligatorio; fixture de captura con respuestas, evidencia, conflicto y decisión mediante operaciones reales |
| Quick Start vacío separado | PASS: cuatro servicios saludables, bootstrap explícito, cambio obligatorio y primer login |
| Capturas | 8 PNG reales, revisados visualmente; 1440×1100 escritorio y 390×844 móvil; compresión sin pérdida |
| Enlaces relativos y assets | PASS: 133 enlaces, sin destinos/anclas ausentes; ocho PNG presentes |
| Residuos y secretos | PASS: cero bloqueadores nuevos; Gitleaks 8.30.1 sin hallazgos, configuración exacta previa conservada |
| Integridad del código | Sin cambios en archivos funcionales respecto a la base al comenzar esta revisión |

No se repitieron unit/integration/Playwright completo ni restauración destructiva: el alcance fue editorial. El smoke usó Chromium y operaciones reales sobre dos instalaciones aisladas. Los servicios de otras instalaciones permanecieron intactos. No se publican contraseñas, logs ni scripts temporales de captura. Los identificadores de compatibilidad conservados en migraciones/auth y sus pruebas no se reescribieron; las demás coincidencias revisadas corresponden a hashes, rutas API y subcadenas genéricas. No se añadieron referencias privadas a documentación o capturas.

La guía de desarrollo se comprobó contra scripts y configuración actuales; no constituye un nuevo gate completo del entorno host. TLS/reverse proxy y políticas externas de cifrado/retención son instrucciones operativas que requieren ensayo en el entorno elegido. No se afirma una receta TLS específica ya verificada.

## Identidad Acta y verificación final

**ACTA SNAPSHOT READY: YES. PUBLIC PRESENTATION READY: YES.** Este resultado habilita revisión del snapshot, no su distribución.

Se actualizaron el nombre y short name por defecto, título HTML, textos de identidad en login/pie, documentación y ocho capturas. La configuración de identidad sigue disponible. Se conservaron nombres de paquetes, proyecto Compose, volúmenes, migraciones y protocolos de autenticación. No se modificaron dominio, permisos, contratos, estilos, almacenamiento ni comportamiento de producto.

| Comprobación de esta actualización | Resultado |
|---|---|
| Lint / typecheck / build frontend y backend | PASS; aviso de tamaño de bundle existente |
| Unit/component | 92/92 PASS |
| Playwright focalizado de login | 1/1 PASS, retries=0; teclado y axe en escritorio, 390 y 320 px |
| Docker Compose config y build | PASS |
| Quick Start vacío, volúmenes nuevos | PASS: cuatro servicios saludables, migraciones, bootstrap, cambio obligatorio y acceso |
| Demo nueva, volúmenes nuevos | PASS: migraciones, servicios saludables, cambio obligatorio, proyecto y editor accesibles; defaults Acta |
| Smoke UI Chromium | PASS: login, proyectos, editor, Mi trabajo, responder, revisión, conflicto, decisión vigente y dashboard |
| Responsive de identidad | PASS: 1440 y 390 px; login, encabezados y navegación móvil sin desbordamiento |
| Capturas | 7 desktop y 1 móvil, mismas dimensiones y datos que antes; compresión sin pérdida |
| Integridad de datos de capturas | 13 hashes de tablas de dominio idénticos antes y después |
| Alcance de código | Ocho archivos de identidad/configuración/assertion; verificación inversa contra baseline. Resto del código, esquema, contratos, estilos, dependencias, fuentes y licencias de terceros intactos |
| Enlaces, residuos y secretos | Verificación final sin enlaces relativos rotos ni bloqueadores; Gitleaks 8.30.1 con excepciones exactas preexistentes |

Los primeros intentos de scripts temporales requirieron corregir un filtro de pruebas y selectores/ruta de configuración; no se modificó producción ni se añadieron retries para resolverlos. El caso Playwright final se ejecutó una vez con retries=0. No se repitieron integración PostgreSQL/S3, Playwright completo ni restore destructivo por este cambio de identidad; sus resultados previos siguen separados arriba.

Los residuos técnicos se conservan por compatibilidad, no como identidad visible: nombres de tooling/Compose y ejemplo de backup, identificadores históricos de migración/auth y pruebas de regresión. Las restantes coincidencias son hashes, rutas API, subcadenas genéricas o bytes de fuentes. Las referencias al destino GitHub previsto están marcadas PENDING; no se accedió al repositorio remoto. No hay rutas personales en archivos entregados. La historia interna y el snapshot siguen separados; no se inicializó Git.

## Archivos entregados

[Inventario completo](PUBLIC-SNAPSHOT-FILES.txt): fuentes, contratos, migraciones, tests, scripts, Docker/CI, guías y fuentes/avisos de terceros. Se añaden únicamente [capturas públicas de datos ficticios](docs/assets/README.md). Se excluyen dependencias instaladas, dist, cobertura, logs, reportes, uploads, backups, `.env` privados y metadata Git. El build regenera bundles y avisos frontend necesarios.

## Plataformas y límites

**VERIFIED: Linux ARM64** en contenedores. **NOT VERIFIED:** Linux AMD64, AWS S3, Ceph, SeaweedFS, multi-node/HA y migración entre providers. Las pruebas Chromium no certifican todos los navegadores o sistemas operativos.

Storage: VersityGW default verificado; MinIO legacy con riesgos upstream; Garage no soportado por el contrato actual; SeaweedFS candidato no verificado; endpoint externo configurable no verificado. [Matriz](docs/S3-PROVIDERS.md).

**No published minimum yet.** No existen mediciones publicadas de CPU, RAM o disco para fijar mínimos. Una instalación independiente reproducible no equivale a imágenes byte-idénticas ni a certificación total de dependencias/OS. Los exports no son backups completos.

## Registro previo a publicación — sustituido por los cierres posteriores

Titularidad, autorización y licencia de Acta quedaron confirmadas el 2026-10-01. Autor y titular: Cristóbal Ruz Escobar. **AGPL-3.0-only aplicada.** Los avisos de terceros se conservan; sus obligaciones específicas de futuras imágenes binarias permanecen separadas.

- PUBLIC ISSUE TRACKER — PENDING de habilitación y verificación pública.
- PRIVATE SECURITY CONTACT — pending. PENDING BEFORE PUBLICATION.
- MODERATION CONTACT — pending.

Los canales privados aún deben habilitarse/verificarse para abrir colaboración. La licencia principal ya está concedida conforme a LICENSE; no se mantiene titularidad como blocker.

## Preparación de Acta upstream — 2026-09-30

**ACTA UPSTREAM READY: YES**, como estructura documental preparada. Este resultado documental de 2026-09-30 no demostraba configuración remota. La licencia se adoptó el 2026-10-01; los canales requieren verificación efectiva.

Se prepararon [gobernanza](GOVERNANCE.md), [contribución](CONTRIBUTING.md), [forks y sincronización](docs/UPSTREAM-FORKS.md), [procedencia DCO/CLA](docs/CONTRIBUTION-ORIGIN.md), [releases](docs/RELEASING.md), [soporte](SUPPORT.md), [roadmap](ROADMAP.md), checklist de [GitHub/CI](docs/GITHUB-SETUP.md) y plantillas de PR e Issues. La propuesta inicial conserva 0.2.0 como versión pre-1.0; no se cambió ningún paquete ni se creó release. DCO + Signed-off-by se encontraba propuesto en esa fecha; quedó adoptado el 2026-10-01, sin CLA ni bot. Contribuir un PR es voluntario y distinto de obligaciones de licencia.

Verificación de esta fase: enlaces relativos y anclas válidos; Markdown revisado estructuralmente (encabezados/enlaces, fences, marcadores de conflicto y whitespace); tres frontmatters YAML de Issues válidos; Gitleaks 8.30.1 sin hallazgos, sin ampliar exclusiones; residuos clasificados sin nuevos bloqueadores. No existe un comando dedicado de lint Markdown configurado: esta comprobación no se presenta como ejecución de markdownlint.

El cotejo SHA-256 con la base de la fase confirma que código funcional, contratos, esquema, permisos, tests, Docker, workflows CI, dependencias y assets no cambiaron. Solo se modificaron/añadieron documentos, plantillas Markdown e inventario. No se ejecutaron suites de aplicación ni pruebas destructivas. Los resultados técnicos previos quedan registrados en sus secciones originales.

Decisiones de titularidad, autorización, LICENSE, maintainer y DCO cerradas el 2026-10-01. Pendientes operativos: canales privados de seguridad y moderación; habilitación/verificación de Issues, Discussions y checks de GitHub. No se accedió al destino remoto, no se inicializó Git ni se publicó contenido.

## Cierre de decisiones humanas — 2026-10-01

Autor y titular: **Cristóbal Ruz Escobar**. Maintainer inicial y responsable de moderación: **Cristóbal Ruz Escobar**. Upstream oficial: [Acta](https://github.com/ruzer/Acta). Licencia aplicada: **AGPL-3.0-only**; DCO 1.1 + Signed-off-by, sin CLA inicialmente. Versión inicial prevista: **0.2.0**, sin tag ni release creados. Soporte community / best effort; rama principal prevista main.

[LICENSE](LICENSE) reproduce íntegramente el texto de GNU; [DCO](DCO) reproduce el texto oficial de Developer Certificate of Origin 1.1. La adopción no sustituye OFL, NOTICE ni términos de dependencias. Las obligaciones específicas de futuras imágenes binarias no se declaran resueltas por la licencia de la aplicación.

Las referencias históricas a revisiones de septiembre son evidencia de aquel momento, no blockers legales vigentes. La publicación del código y la release formal son estados distintos. El estado remoto y la estrategia segura se registrarán en REMOTE-PUBLICATION-PLAN.md antes de inicializar Git o hacer push.

## Auditoría local de publicación — 2026-10-01

Decisiones cerradas: autor/titular y maintainer Cristóbal Ruz Escobar; AGPL-3.0-only; DCO 1.1 + Signed-off-by; sin CLA; SemVer y versión inicial prevista 0.2.0. No son blockers pendientes.

LICENSE es copia byte a byte de `https://www.gnu.org/licenses/agpl-3.0.txt`. SHA-256: `0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0`. Se contrastó con la entrada oficial SPDX AGPL-3.0-only: diferencias de formato y http/https en tres enlaces, sin modificar el texto GNU copiado. DCO se extrajo íntegramente del bloque oficial de `https://developercertificate.org/`; SHA-256: `f7ac75b443f4ca16b503241344b41aeff9503b0c30bedc2b119551d83cb0fa90`. El copyright del texto legal y sus ejemplos pertenecen al documento oficial; no atribuyen el código de Acta a terceros.

Los OFL, licencias/NOTICE de storage, fuentes y demás archivos de terceros conservan sus hashes. Las revisiones de dependencias binarias ya documentadas se mantienen para futuras imágenes; no se declaran resueltas por adoptar LICENSE.

Clasificación de pendientes: titularidad/licencia/maintainer/DCO **CERRADOS**; canales privados y configuración remota **OPERATIVOS, sujetos a verificación**; futuras releases/imágenes/plataformas no ensayadas **FUERA DE ESTA PUBLICACIÓN INICIAL**; PENDING de los contratos de respuesta **ESTADO FUNCIONAL, no pendiente editorial**. [Informe remoto y estrategia](REMOTE-PUBLICATION-PLAN.md).

## Experiencia de importación — 2026-10-02

**IMPORT EXPERIENCE READY: YES.** Mejora local de ayuda, ejemplos y documentación, sin publicar esta actualización.

Se conserva el importador y contrato 1.0. Se añaden ejemplos mínimo/completo, guía para usuarios, evaluación tabular solo propuesta y descargas estáticas desde Importar. Los errores muestran el elemento y campo en lenguaje humano manteniendo la ruta técnica. Se corrigió el foco del título del preview para ejecutarlo después del render; antes podía perderse por temporización. Backend, persistencia, permisos, contratos, Docker, storage y licencias no se modificaron.

| Verificación ejecutada | Resultado |
|---|---|
| Ejemplos con parser, Zod y reglas de producción | PASS: mínimo (2 preguntas) y completo (10 preguntas, 8 tipos) |
| Unit/component completo | 104/104 PASS, incluye 6 pruebas de ejemplos y 6 de UI de importación |
| Integración PostgreSQL de intercambio | 9/9 PASS: bytes de ambos archivos → preview sin escritura → confirmación DRAFT; idempotencia, atomicidad/rollback, permisos, hash y versión |
| E2E Chromium de intercambio/importación | 5/5 PASS; descargas idénticas a los archivos públicos, adaptación de ID, error/corrección, preview, consentimiento, confirmación y acceso al editor |
| Repetición específica de los dos recorridos nuevos | 6/6 PASS (3 repeticiones por recorrido), retries=0 |
| Teclado, foco, axe y reflow | PASS en los recorridos E2E, escritorio y 390 px; captura móvil revisada |
| Lint / typecheck / build frontend y backend | PASS; persiste el aviso previo de bundle mayor de 500 kB |
| Enlaces / residuos / Gitleaks / diff whitespace | PASS; sin nuevos enlaces rotos, referencias privadas ni secretos |

La primera ejecución de los nuevos E2E encontró un selector ambiguo de detalles; se acotó al error concreto. La siguiente reveló el fallo real de foco descrito arriba; tras corregirlo pasaron los recorridos. No se añadieron retries ni skips. No se repitió la suite Playwright completa de otras funcionalidades: el alcance de navegador fue intercambio e importación. Las pruebas utilizaron una instancia PostgreSQL descartable y datos ficticios, sin tocar bases existentes.

La documentación registra diferencias históricas como DOCUMENTATION MISMATCH en el contrato de importación. No se ofrece JSON Schema parcial como sustituto del validador real. No se implementó Excel/CSV, merge, overwrite ni otro importador. No hubo commit, push, release ni operaciones GitHub en esta tarea.

## Cierre legal y open source local — 2026-10-02

Autor, titular y maintainer inicial: **Cristóbal Ruz Escobar**. Copyright (c) Cristóbal Ruz Escobar. Producto Acta, tagline Questions. Evidence. Decisions., upstream oficial previsto [Acta](https://github.com/ruzer/Acta). Licencia **AGPL-3.0-only**; **DCO 1.1 + Signed-off-by**; sin CLA inicialmente. Soporte comunitario best effort, main, Semantic Versioning y primera versión prevista **0.2.0**. Son decisiones definitivas, no bloqueadores pendientes.

LICENSE ya estaba instalado y se cotejó byte a byte con [GNU](https://www.gnu.org/licenses/agpl-3.0.txt). DCO ya estaba instalado y coincide con el texto del bloque oficial de [Developer Certificate of Origin](https://developercertificate.org/), retirando únicamente la indentación HTML. No se modificaron los textos legales ni los avisos de terceros. LICENSE-PENDING.md está ausente.

| Coincidencia o pendiente | Clasificación y tratamiento |
|---|---|
| Titularidad, autorización, licencia, maintainer, DCO | CERRADOS; se conserva la decisión y no se solicita nuevamente |
| PENDING del expediente editorial anterior y del registro previo a publicación | HISTÓRICO, sustituido por los cierres fechados; no es un bloqueo legal actual |
| PENDING y pending de contratos/código de respuestas | ESTADO FUNCIONAL; no es una tarea legal ni editorial |
| Marcadores de publicación de las plantillas de PR e Issues | RETIRADOS; las plantillas están preparadas y remiten a las políticas y al estado de canales |
| Issues, Discussions, reporte privado, CI y protección de main | REVERIFICACIÓN REMOTA PENDIENTE; existe registro fechado de verificaciones anteriores, no una comprobación actual |
| Contacto privado de moderación | PENDIENTE REAL de designación/verificación; no se inventa email |
| Aprobaciones independientes, CODEOWNERS, badges, tags/releases e imágenes | OPERACIÓN FUTURA; solo cuando existan responsables, destinos y autorización |
| Obligaciones de licencias de futuras imágenes binarias | REVISIÓN DE DISTRIBUCIÓN ESPECÍFICA; no la sustituye la licencia principal del código de Acta |

Las versiones de raíz, frontend, backend, contracts y lockfile coinciden en 0.2.0; no se cambian paquetes ni se crea tag/release. Los avisos OFL, licencias/NOTICE de VersityGW, inventarios y fuentes/activos de terceros se preservan. Los identificadores históricos de migraciones/autenticación y sus pruebas se conservan por compatibilidad; no representan branding público ni información institucional nueva.

Este cierre es local. No consulta GitHub, no hace fetch/push ni configura servicios remotos. El siguiente paso autorizado será inspeccionar el remoto y decidir una publicación controlada, preservando su contenido. Los registros anteriores de publicación se mantienen como historia, no como resultado de esta ejecución.

Verificación local ejecutada: lint, typecheck y build frontend/backend PASS (permanece el aviso previo de bundle mayor de 500 kB); enlaces relativos y anclas válidos; estructura Markdown sin fences abiertos ni marcadores de conflicto; Gitleaks sin hallazgos con las exclusiones exactas existentes; diff sin errores de whitespace. No existe un script dedicado de tests documentales ni markdownlint configurado: se verificaron enlaces, estructura, textos legales, inventario y hashes. No se repitieron pruebas destructivas, PostgreSQL ni navegador por cambios exclusivamente documentales. Código, contratos, permisos, Docker, dependencias, versiones y avisos de terceros permanecen idénticos.
