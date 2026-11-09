# Proveedores S3 para self-hosting

Evaluación inicial: **2026-09-30**. Actualización de seguridad del default: **2026-10-20**. Este documento distingue capacidades declaradas por upstream de pruebas ejecutadas con Acta. No certifica toda la API S3, alta disponibilidad ni ausencia de vulnerabilidades. La licencia principal de Acta es AGPL-3.0-only.

## Decisión

**VersityGW 1.10.0 — DEFAULT — instalación sencilla.** Se conserva para el despliegue single-host de evidencia. No se agregan productos, SDK específicos, selectores UI ni enums al dominio. La API utiliza exclusivamente `S3Storage`, claves estables y configuración S3.

Garage no satisface el contrato de escrituras condicionales del adaptador; no se incluye un override que obligue a debilitarlo. SeaweedFS queda como candidato avanzado **no verificado**, sin Compose incluido. MinIO se conserva únicamente para instalaciones anteriores y pruebas de compatibilidad; no es una recomendación de seguridad.

## Matriz de soporte

En Single host/Distributed se describe upstream; Tested/Backup/ARM64/AMD64 describen **esta aplicación**. Un binario publicado para una arquitectura no equivale a validación del stack.

| Provider / versión evaluada | Clasificación | Self-hosted | Single host | Distributed | Tested | Backup tested | ARM64 | AMD64 |
|---|---|---|---|---|---|---|---|---|
| VersityGW 1.10.0 | DEFAULT + VERIFIED | Sí | Sí, POSIX incluido | Gateway sobre storage compartido; no replicación del disco local incluida | 41/41 + recorrido API, actualización 1.9.0 → 1.10.0 y restart (2026-11-07) | Restore en destino 1.10.0 vacío, dump + seis volúmenes y SHA-256 (2026-11-07) | Linux verificado localmente | Consultar CI de la revisión |
| Garage 2.4.1 | NOT SUPPORTED por el contrato actual | Sí | Upstream lo permite; recomienda redundancia para producción | Sí, upstream | No ejecutado; incompatibilidad documentada | No | Binario upstream, app no ensayada | Binario upstream, app no ensayada |
| SeaweedFS 4.48 | CANDIDATE / NOT VERIFIED | Sí | `weed mini` agrupa servicios | Sí, upstream | No ejecutado | No | Asset upstream, app no ensayada | Asset upstream, app no ensayada |
| MinIO RELEASE.2025-10-15T17-29-55Z | LEGACY, no recomendado | Sí | Override existente | Upstream; no incluido aquí | 21/21 + recorrido API | Sí, destructivo TEST | Linux verificado (funcional) | No ensayado |
| Endpoint S3 externo (incluidos AWS S3, Ceph u otros) | CONFIGURABLE / NOT VERIFIED | Depende | Depende | Depende | No ejecutado | No | No ensayado | No ensayado |

“CANDIDATE / NOT VERIFIED” identifica una alternativa por evaluar. “CONFIGURABLE / NOT VERIFIED” indica que se puede configurar el endpoint, **no compatibilidad funcional demostrada con un producto**. “VERIFIED” se limita a versión, configuración y plataforma ensayadas.

## Contrato real que debe cumplir un provider

Inspección de `app/backend/src/responses/s3-storage.ts` y pruebas existentes:

- `HeadBucket`, `PutObject`, `GetObject`, `DeleteObject`, `ListObjectsV2` paginado sobre `evidence/v1/`.
- `PutObject` utiliza **`If-None-Match: *`**. Dos escrituras de la misma clave deben producir exactamente una creación y un rechazo 412, nunca dos éxitos ni sobrescritura.
- Cuenta de aplicación restringida al bucket/prefijo; no administra buckets, IAM ni políticas. Cuenta de aprovisionamiento separada, ausente del backend.
- Bucket y objetos privados: acceso anónimo denegado. Descargas a través del backend tras comprobar sesión, rol, organización, proyecto y fuente autorizada.
- Bytes limitados e integridad SHA-256 verificada. MIME validado por el producto; el tipo declarado al storage no sustituye esta validación.
- No se utilizan multipart uploads, range requests ni URLs prefirmadas. Por ello no se declaran verificados. Si se incorporan, ampliar esta suite antes de promover un provider.
- Borrados/reconciliación deben preservar revisiones enviadas y resolver objetos huérfanos de fallos de persistencia.

El esquema todavía conserva el valor **MINIO** de registros históricos, leído mediante el adaptador S3 existente. Es compatibilidad de datos previa, no selección del nuevo provider. Las nuevas evidencias se escriben como **S3**. No se eliminó ese valor ni se reescribieron migraciones. No hay conocimiento de Garage/SeaweedFS/Versity en Evidence.

## VersityGW

El default compila la release oficial **1.10.0**, commit `72f75bd0f4c67a7663d3c56b80f05a44f6732db8`, con **Go 1.27.3** fijado por digest. No se modifica código ni dependencias upstream: `golang.org/x/net` v0.61.0 ya está incluido y se retira el parche local de 1.8.0. LICENSE/NOTICE se conservan íntegros, verificados contra la nueva release; ver [modificaciones del build](../docker/versity/UPSTREAM-MODIFICATIONS) e [inventario de licencias](STORAGE-DEPENDENCY-LICENSES.csv).

La misma etapa de compilación se usa en `docker/versity/Dockerfile` y `app/backend/Dockerfile` (aprovisionamiento). El backend de aplicación no recibe ese binario ni las credenciales root. Se conservan el wrapper sin privilegios, POSIX con metadata sidecar, IAM local, política por prefijo y healthcheck `/_health` más `HeadBucket`. No cambia la API de Acta ni la configuración S3. Single-host no es HA.

Correcciones: Go 1.27.3 resuelve **GO-2026-6809 / CVE-2026-111943** (`crypto/x509`). VersityGW 1.9.0 corrige **GHSA-7qcr-88c3-f9p7** (path traversal mediante uploadId y borrado múltiple) y **GHSA-5gjv-3vhq-4chv** (cuerpos chunked sin consumir y reutilización de conexiones). El despliegue estándar no activa keepalive ni usa multipart; eso limita el alcance probado, pero no justifica conservar una versión afectada. El gate `govulncheck` sigue siendo obligatorio y no certifica ausencia de todas las vulnerabilidades de aplicación o del sistema operativo.

### Actualización 1.9.0 → 1.10.0

Release oficial del 2026-10-22, compilada con Go 1.27.3. Incluye `klauspost/compress` v1.20.3: la 1.9.0 traía v1.20.1, afectada por **GO-2026-6865** (pánico con tramas de dos bloques; `govulncheck` en modo binario lo marcaba como alcanzable). Entre sus correcciones figuran el listado POSIX, las claves literales con fiber v3.6 y el registro de la IP del cliente tras un proxy de confianza; no se evaluó su efecto sobre configuraciones externas al default, que deben revisar las [notas de la release](https://github.com/versity/versitygw/releases/tag/v1.10.0). El procedimiento de actualización es el mismo que desde 1.8.0 (abajo). Verificación local de actualización con volúmenes existentes y restore completo: [ensayo 1.10.0 del 2026-11-07](#verificación-de-seguridad-y-compatibilidad-1100-2026-11-07). El CI se consulta por separado sobre el SHA de cada revisión.

### Actualización desde 1.8.0

Conservar **todo** `objectdata`: objetos, metadata sidecar, IAM y marcador de formato. Antes de actualizar, realizar el [backup coordinado](BACKUP-RESTORE.md), detener escritores y conservar las imágenes anteriores. Reconstruir `object-storage` y `storage-init` desde la misma revisión de Acta, iniciar y comprobar salud, descarga autorizada con SHA-256 y denegación de acceso anónimo. No borrar volúmenes ni generar nuevas credenciales. Un rollback debe recuperar una copia coordinada y las imágenes correspondientes; no se afirma que sea seguro bajar de versión sobre datos que ya recibieron escrituras nuevas.

**Excepción para configuraciones externas al default:** 1.9.0 cambia la retención predeterminada de Object Lock. Si el operador la habilitó, debe evaluar las reglas históricas y el procedimiento upstream antes de actualizar. Acta no activa Object Lock, versionado ni reglas de retención en su aprovisionador. No se ejecuta ninguna migración automática ni se habilita retención irreversible. Tampoco se activa el nuevo `--fsync`; un restart exitoso no demuestra resistencia ante pérdida abrupta de energía.

Fuentes: [release 1.9.0](https://github.com/versity/versitygw/releases/tag/v1.9.0), [avisos del proveedor](https://github.com/versity/versitygw/security/advisories), [aviso Go](https://pkg.go.dev/vuln/GO-2026-6809), [migración Object Lock](https://github.com/versity/versitygw/discussions/2521).

## Garage

Proyecto mantenido: releases 2.3.0 (abril), 2.4.0 y 2.4.1 (6 y 8 de septiembre de 2026); licencia AGPL-3.0 en el código consultado. Publica Docker y binarios Linux ARM64/AMD64. [Descargas/versiones](https://garagehq.deuxfleurs.fr/_releases.html), [Docker](https://garagehq.deuxfleurs.fr/download/), [licencia upstream](https://git.deuxfleurs.fr/Deuxfleurs/garage/src/tag/v2.4.1/LICENSE).

El quickstart permite un nodo; la operación distribuida requiere layout, nodos/capacidades y replicación. Credenciales S3 y permisos de lectura/escritura por bucket se administran por CLI/API; no habilitar website público. Health interno `/health` y `GetClusterHealth`; separar tokens administrativos de claves de aplicación. Persistir configuración, metadata, bloques y claves/RPC. [Quickstart](https://garagehq.deuxfleurs.fr/documentation/quick-start/), [clúster](https://garagehq.deuxfleurs.fr/documentation/cookbook/real-world/), [administración/health](https://garagehq.deuxfleurs.fr/documentation/reference-manual/admin-api/).

**Bloqueo demostrado por especificación upstream:** Garage declara que no puede garantizar escrituras condicionales concurrentes `If-None-Match` debido a su diseño sin consenso. Eso contradice nuestra protección real de claves. Su soporte de políticas/ACL tampoco debe confundirse con IAM S3 completo. No se ejecutó un despliegue ni se etiqueta como fallo observado de la suite: es un rechazo de elegibilidad previo. [Limitaciones oficiales](https://garagehq.deuxfleurs.fr/documentation/reference-manual/known-issues/), [tabla S3](https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/).

Backup: upstream advierte sobre corrupción LMDB y snapshots filesystem inconsistentes durante escrituras; recomienda snapshots propios de metadata y redundancia. Restaurar requeriría metadata coherente, bloques y configuración/identidades. No se ensayó ni se ofrece una receta de restore verificada. Multipart aparece en su tabla S3, pero no es una necesidad actual del producto. No agregar Compose Garage hasta que exista una solución compatible demostrada **sin retirar la garantía de no sobrescritura**.

## SeaweedFS

Repositorio activo, Apache-2.0; release 4.48 del 28 de septiembre de 2026, con releases recientes 4.47 y 4.44. Assets Linux ARM64/AMD64 y distribución Docker. El proyecto ofrece `weed mini` para un proceso single-node: no exige necesariamente múltiples contenedores. Aun así coordina master, volume, filer y gateway S3; la configuración mini también incorpora servicios adicionales. [Release](https://github.com/seaweedfs/seaweedfs/releases/tag/4.48), [README y mini](https://github.com/seaweedfs/seaweedfs), [Compose upstream](https://github.com/seaweedfs/seaweedfs/wiki/Docker-Compose-for-S3).

Valor adicional: crecimiento distribuido, grandes volúmenes y otras interfaces de almacenamiento. Para evidencia limitada a 20 MiB y un host ya cubierto por VersityGW, no se ha demostrado una mejora que compense más componentes lógicos, credenciales/puertos y recuperación de metadata. **Decisión de alcance:** candidato avanzado configurable externamente, no segundo deployment oficial en este snapshot.

Su tabla S3 declara operaciones requeridas, condiciones de PUT y multipart; eso no demuestra nuestras garantías de concurrencia, autorización o reconciliación. Debe superar íntegramente el gate antes de promoverse. [API S3](https://github.com/seaweedfs/seaweedfs/wiki/Amazon-S3-API), [operaciones condicionales](https://github.com/seaweedfs/seaweedfs/wiki/S3-Conditional-Operations).

Seguridad/operación por evaluar antes de desplegar: credenciales S3 explícitas y política privada por prefijo, sin identidad anónima; red restringida para master/volume/filer/gRPC/admin, no solo el puerto S3. Health debe comprobar el servicio y un `HeadBucket` firmado, seguido de prueba de escritura/lectura; no basta abrir el puerto. El índice oficial contiene advisories de identidad gRPC sin autorización y de políticas omitidas en POST Object (rangos publicados hasta 4.45, campo patched vacío en las entradas consultadas). No extrapolar a 4.48 una declaración de seguridad total; verificar cada corrección en código/release antes de adoptarlo. [Credenciales](https://github.com/seaweedfs/seaweedfs/wiki/S3-Credentials), [advisories](https://github.com/seaweedfs/seaweedfs/security/advisories).

Backup necesita bytes de volúmenes, metadata filer, configuración/identidades y metadata de topología necesarias; copiar solo los archivos del volume server no demuestra recuperabilidad de S3. Upstream separa backup de contenido y de metadata. No se ejecutó restart ni restore de SeaweedFS en esta evaluación. [Backup](https://github.com/seaweedfs/seaweedfs/wiki/Async-Backup), [metadata](https://github.com/seaweedfs/seaweedfs/wiki/Async-Filer-Metadata-Backup).

## MinIO legacy

Repositorio upstream archivado, licencia AGPLv3. El override conserva la versión de código RELEASE.2025-10-15T17-29-55Z y mc fijado, compilados desde el Dockerfile existente. Tiene healthcheck `/minio/health/ready`, bucket privado, política por prefijo, consola deshabilitada y volumen persistente. Su capacidad distribuida no se incluye en este despliegue. [Estado oficial](https://github.com/minio/minio).

**Pruebas funcionales no eliminan riesgo de seguridad.** Entre los advisories publicados figuran GHSA-hv4r-mvr4-25vw (firma de upload) y GHSA-xh8f-g2qw-gcm7 (path traversal), con correcciones posteriores a la versión del override. No se certifica esta versión como segura ni se instala para usuarios nuevos. El override existe para continuidad/migración de instalaciones anteriores; cualquier uso real exige evaluación de riesgo y plan de salida. [Advisories oficiales](https://github.com/minio/minio/security/advisories).

## Configuración común y despliegues excluyentes

La aplicación no recibe el nombre comercial del storage:

| Variable | Uso |
|---|---|
| `S3_ENDPOINT` | URL del endpoint; HTTPS fuera de los hosts de prueba/servicio local explícitamente permitidos |
| `S3_REGION` | Región de firma |
| `S3_BUCKET` | Bucket privado ya aprovisionado |
| `S3_ACCESS_KEY` | Cuenta limitada de aplicación |
| `S3_SECRET_KEY` | Secreto privado, no commitear ni registrar |
| `S3_FORCE_PATH_STYLE` | Forma de direccionamiento; true para el default probado |

En Compose las credenciales se generan o reciben en secrets-init y pasan al backend por el volumen de secretos. Los nombres operativos legacy `MINIO_ROOT_USER/PASSWORD` siguen siendo aliases del aprovisionador existente, no configuración del dominio. No se introducen nuevas variables específicas de proveedores.

```sh
# DEFAULT, un solo almacén; Quick Start intacto
cp .env.example .env
docker compose up --build

# Solo continuidad legacy; instalación/volúmenes separados o migración planificada
docker compose -f docker-compose.yml -f docker-compose.minio-legacy.yml up --build

# Endpoint externo ya aprovisionado/configurado, sin almacén local
docker compose -f docker-compose.yml -f docker-compose.external-s3.yml up --build
```

El override externo requiere Compose 2.24.4+ (`!override`). No activar su perfil `bundled-storage`. No combinar legacy y externo. No montar el mismo volumen físico bajo implementaciones distintas. No se entrega un perfil Garage/SeaweedFS ni un botón sin funcionalidad. Un endpoint AWS S3/Ceph es configurable, pero **no fue probado**.

## S3 PROVIDER COMPATIBILITY TEST

Se reutiliza la suite real, sin excepciones por proveedor ni assertions debilitadas:

| Garantía | Prueba/entrada existente |
|---|---|
| Bucket/objeto privado y cuenta por prefijo | `tests/selfhosting/s3.test.mjs`: private object; smoke deniega crear bucket y listado anónimo |
| Upload/download y SHA-256 | S3 exact bytes/hash; integración staging/attach/submit/download |
| Sesión, autorización, aislamiento tenant/proyecto | `tests/integration/responses.test.mjs`: T06/T18 y descarga denegada |
| MIME, tamaño, traversal, archivo activo/corrupto | T15, allowlist real, oversized stored object |
| Objeto ausente y storage caído | S3 missing/unavailable, T16 |
| Escrituras concurrentes sin overwrite | Dos PUT con misma clave, uno gana y otro recibe 412 |
| Fallo DB/auditoría, rollback y reconciliación | T16, staging huérfano y preservación de historial |
| Restart y persistencia de metadata/bytes | `scripts/selfhost-smoke.mjs --verify` tras reiniciar y esperar healthchecks |
| Backup/restore | Dump coordinado + tar de volúmenes detenidos + destrucción de volúmenes TEST + restore + mismo smoke/hash |

El runner `scripts/test-storage-container.mjs` ejecuta 17 pruebas de respuestas/evidencia, 18 de invitaciones y 6 de S3: **41 casos**, sin skips ni retries. Solo usar instalación y bucket descartables: la reconciliación puede eliminar huérfanos de ese bucket. El runner recibe temporalmente credenciales DB de migración; el servicio backend normal no las monta.

```sh
# Desde el snapshot, con Docker, sin dependencias instaladas en el host.
# Puerto diferente para aislar esta instalación ficticia.
export COMPOSE_PROJECT_NAME=s3-compat-test
export APP_PORT=4374 APP_ORIGIN=http://localhost:4374
docker compose --env-file .env.example up --build -d --wait
docker compose --env-file .env.example run --rm --no-deps \
  -v "$PWD/tests:/app/tests:ro" \
  -v s3-compat-test_db-secrets:/run/db-secrets:ro \
  -e SELFHOST_STORAGE_TEST_ALLOWED=true \
  backend node scripts/test-storage-container.mjs
docker compose --env-file .env.example exec -T -e SELFHOST_SMOKE_ALLOWED=true \
  backend node scripts/selfhost-smoke.mjs
docker compose --env-file .env.example restart postgres object-storage backend frontend
docker compose --env-file .env.example up -d --wait
docker compose --env-file .env.example exec -T -e SELFHOST_SMOKE_ALLOWED=true \
  backend node scripts/selfhost-smoke.mjs --verify
```

Para legacy utilizar **otro proyecto/puerto/volúmenes**, añadir el override en todos los comandos y ajustar el volumen del runner. No ejecutar la suite después del smoke sobre el mismo bucket: el test de reconciliación tiene reloj adelantado; ejecutar suite primero, luego smoke/restore. Para un futuro endpoint externo usar una DB temporal, bucket separado y cuenta con la misma política. No se permite saltar pruebas para obtener VERIFIED.

## Verificación de seguridad y compatibilidad 1.9.0 (2026-10-20)

Linux ARM64, stack descartable separado, sin usar datos ni volúmenes existentes:

- Ambos builds Docker completados; servicio y aprovisionador contienen el mismo binario SHA-256 `71630c3ddd80d96d8a5d4507df3a357f16e164de4a55b83564e8ed94d4babf95`. Servicio ejecutado como usuario `node`.
- `govulncheck` v1.8.0 en modo binario y sobre `./cmd/versitygw`: exit 0, sin vulnerabilidades alcanzables ni paquetes importados afectados. Informa **GO-2026-5932** en el módulo `golang.org/x/crypto` por `openpgp`, paquete no importado por este binario. No hay exclusión ni supresión; no se afirma que el inventario completo de módulos carezca de avisos.
- Suite real S3/backend: **41/41 PASS**, cero skips. Incluye hashes, bytes, privacidad, credenciales inválidas, restricciones por prefijo, denegación de lectura de políticas, concurrencia `If-None-Match: *`, rollback, reconciliación e invitaciones.
- Pruebas upstream focalizadas en `backend/posix`, `s3api/middlewares` y `s3api/controllers`: PASS para la carrera de creación condicional, drenado/cierre de cuerpos chunked y `DeleteObjects`.
- Instalación limpia 1.9.0 y restart de PostgreSQL, storage, backend y frontend: PASS; respuesta, decisión/fuente y SHA-256 de evidencia conservados con el smoke existente.
- Actualización real **1.8.0 → 1.9.0**: se creó primero una instalación 1.8.0 con el smoke existente, se detuvieron escritores, se reconstruyeron únicamente `object-storage` y `storage-init`, y se inició con los mismos volúmenes y configuración. `scripts/selfhost-smoke.mjs --verify` confirmó login, respuesta, decisión/fuente, evidencia con el mismo SHA-256 y privacidad. No se convirtieron objetos ni se reinicializó IAM.

El cambio conserva `start.mjs`, el aprovisionador, Compose y el adaptador S3. El CI de cada PR ejecuta además `verify`, `secrets`, `selfhosting` y `guided-install`; su resultado se consulta sobre el SHA exacto, no se deduce de las pruebas locales. No se probó Object Lock, HA ni migración a otro proveedor. La receta de backup/restore conserva su evidencia histórica separada.

## Verificación de seguridad y compatibilidad 1.10.0 (2026-11-07)

Ensayo ejecutado en contenedores Linux ARM64 sobre Docker Desktop, con datos ficticios y proyectos, puertos, redes y volúmenes propios. Base de Acta: `fd91bb9b5d357828222af2356d037caaa04eb446` (VersityGW 1.9.0); destino: `3b35795e1a93f32c6cf5ff6529ca20fd16bd638f` (1.10.0). No se usaron instalaciones existentes.

| Comprobación ejecutada | Resultado |
|---|---|
| Instalación limpia 1.9.0 y `scripts/selfhost-smoke.mjs` | PASS: bootstrap, usuarios ficticios, pregunta, respuesta enviada, decisión/fuente, evidencia y acceso privado |
| Backup coordinado con escritores detenidos | PASS: `pg_dump -Fc` y seis tar, etiquetas de los siete volúmenes comprobadas; configuración y hashes guardados privadamente |
| Actualización de solo `object-storage` y `storage-init` a 1.10.0 | PASS: mismos volúmenes, configuración e identidades; backend/frontend conservados de la base 1.9.0 durante esta comprobación |
| `scripts/selfhost-smoke.mjs --verify` después de actualizar | PASS: login, respuesta, decisión/fuente, descarga autorizada con SHA-256 idéntico y acceso anónimo denegado |
| Restore del backup 1.9.0 en siete volúmenes nuevos, con imágenes de la revisión destino 1.10.0 | PASS: misma receta de dump/tar y secretos restaurados antes de iniciar; `pg_restore --exit-on-error`, migraciones oficiales y smoke completo de persistencia |
| Restart de PostgreSQL, storage, backend y frontend del destino restaurado | PASS: healthchecks y smoke de persistencia nuevamente correctos |
| `scripts/test-storage-container.mjs`, en otro bucket/DB nuevos con 1.10.0 | **41/41 PASS**, 0 fallos, 0 skips: 17 respuestas/evidencia, 18 invitaciones y 6 S3 |
| `govulncheck` v1.8.0, modo binario | Exit 0: **0 vulnerabilidades alcanzables**, 0 en paquetes importados; 3 avisos solo a nivel de módulo, detallados abajo |

Ambos Dockerfiles produjeron el mismo binario VersityGW, SHA-256 `df9c886146d1d62f6144e4fb5a0b74c5bd7f835282263f8a52ea4ab9b32737c7`; servicio ejecutado como `node` (UID 1000). Se utilizó Go 1.27.3 con el digest del CI, sin editar Dockerfiles ni dependencias. La evidencia ficticia mantuvo SHA-256 `dbe04b8414d49f61c5a48b1b81402793a67aedb7dd405a44791660b8f12fe476` antes de actualizar, tras actualizar, tras restaurar y después del restart.

La comparación de archivos antes/después de actualizar confirmó bytes idénticos en objetos, metadata sidecar, marcador y archivo IAM vigente. No hubo conversión de objetos ni reinicialización de IAM. El aprovisionador rotó la copia interna `.backup` de IAM; esa copia histórica cambió, no las identidades vigentes. No se afirma identidad binaria de todo el volumen.

El escaneo detallado informó **GO-2026-6866** y **GO-2026-6860** en `golang.org/x/net` v0.61.0 (HTML; corrección disponible en v0.62.0), y **GO-2026-5932** en `golang.org/x/crypto` v0.58.0 (`openpgp`). El binario no importa los paquetes afectados según el análisis. No se suprimieron avisos; este PASS no significa que todos los módulos requeridos estén libres de vulnerabilidades.

Se siguió [BACKUP-RESTORE](BACKUP-RESTORE.md) usando un destino nuevo, sin destruir el origen. El restore 1.9.0 → 1.10.0 es evidencia de esta transición concreta: no sustituye la recomendación operativa de restaurar primero las imágenes correspondientes a una copia. No hubo cambios de migraciones entre las dos revisiones. La suite destructiva de reconciliación se ejecutó en un tercer proyecto, nunca sobre el bucket del fixture preservado.

Incidencias del entorno: se agotó la reserva automática de subredes de Docker; se usaron overrides privados con subredes libres, sin eliminar redes existentes. Al iniciar solo los dos servicios de storage, Compose `up --wait --no-deps` devolvió error al finalizar normalmente `storage-init` (exit 0); se comprobó ese exit y la salud de `object-storage` antes de iniciar los escritores conservados. No falló el aprovisionamiento ni se cambió la receta de backup/restore. Secretos, dumps, logs y overrides permanecieron fuera de Git.

No se ensayaron AMD64, Object Lock, multipart, HA, corte abrupto de energía, downgrade, otros proveedores ni producción. No se repitieron las pruebas internas del proveedor en modo fuente; el gate de seguridad utilizado fue el modo binario del CI. Los resultados anteriores son locales y no sustituyen el CI del PR.

## Registro de ejecución del snapshot

Ejecutado el 2026-09-30 desde este snapshot, Linux ARM64, sin reutilizar bases ni buckets de instalaciones existentes:

| Gate | VersityGW 1.8.0 | MinIO legacy fijado |
|---|---|---|
| Suite S3 + API | 21/21 PASS, 0 skips, 0 retries | 21/21 PASS, 0 skips, 0 retries |
| Instalación nueva, migraciones, health, bootstrap | PASS | PASS |
| Login/proyecto/tema/pregunta/publicación/asignación/borrador/envío/evidencia | PASS | PASS |
| Reinicio de PostgreSQL/storage/backend/frontend y verificación | PASS | PASS |
| Backup, destrucción de los siete volúmenes TEST y restore | PASS | PASS |
| Revisión enviada/relación de evidencia, descarga y SHA-256 después del restore | PASS | PASS |
| Privacidad y cuenta restringida después del restore | PASS | PASS |

Compose config: default = 1 object store; legacy = 1; externo = 0 (sin perfil bundled-storage). Los contenedores/redes de ensayo se detuvieron al finalizar; backups, logs y secretos de fixtures quedaron fuera del árbol de distribución. El ensayo MinIO demuestra recuperabilidad funcional, no remedia sus advisories.

El alcance y la fecha de las pruebas completas de aplicación se consultan en el [manifiesto](../PUBLIC-SNAPSHOT-MANIFEST.md).

## Backup y migración

Procedimiento y precauciones: [BACKUP-RESTORE](BACKUP-RESTORE.md). En los ensayos históricos del snapshot, backup coordinado sin escritores, `pg_dump -Fc`, archivo de objectdata/evidence y secretos, comprobación de etiquetas de los siete volúmenes de TEST, eliminación de esos volúmenes, creación/restauración y validación de la revisión enviada, evidencia y SHA-256 por la API. No se eliminaron volúmenes de instalaciones existentes.

**Cambiar `S3_ENDPOINT` no mueve objetos.** Migrar requiere ventana sin escrituras (o un procedimiento de doble sincronización explícito), backup recuperable, copiar objetos preservando claves exactas y metadata necesaria, verificar inventario/tamaños y SHA-256 contra Evidence, aprovisionar política privada/credenciales del destino, cambiar configuración y verificar descargas autorizadas e históricas. Mantener origen congelado para retorno controlado. No copiar un volumen interno de Versity como si fuera un volumen Garage/SeaweedFS/MinIO. No se construyó herramienta de migración ni se ensayó migración entre providers.

## Límites y promoción futura

AMD64, multi-node/HA, AWS/Ceph y providers externos siguen no ensayados. No se añade una dependencia al Quick Start por popularidad. Para promover una alternativa: versión/digest y licencia claros, seguridad evaluada, política privada demostrada, 21/21 sin excepciones, restart y restore ejecutados en su propia configuración y actualización de esta matriz. Las obligaciones de distribución se mantienen en [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES.md); los términos del producto están en [LICENSE](../LICENSE) y no sustituyen las licencias de los providers.
