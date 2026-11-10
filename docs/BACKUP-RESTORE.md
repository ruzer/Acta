# Backup y restauración — PostgreSQL + VersityGW

## Scripts para operadores

Los tres scripts automatizan la receta manual de abajo, sin cambiar el formato de
PostgreSQL ni de los objetos. Admiten el Compose DEFAULT con VersityGW local y sus
siete volúmenes con nombres estándar. No sirven para S3 externo, MinIO legacy,
volúmenes externos ni nombres personalizados. Ante un fallo se detienen y conservan
lo que alcanzaron a copiar/restaurar; **no borran backups, directorios ni volúmenes**.

Requisitos del host: POSIX `sh`, Docker/Compose, `tar` y Node compatible con
`engines` de `package.json` (ensayado con Node 26). No requieren `npm install`,
`jq`, Python ni paquetes nuevos. Node usa solo sus APIs incorporadas para JSON y
hashes en streaming; `verify-backup.sh` no necesita Docker. El auxiliar de tar se
lee del `FROM node:… AS runtime` de `app/backend/Dockerfile`, sin duplicar su versión.
Git es opcional: cuando existe, se registra commit/describe.

Ejecuta los scripts de la raíz del despliegue que deseas operar. Usan el `.env`
de esa raíz y todos los `docker-compose.override*.yml` presentes, en orden de
nombre; no cargan `.env` como código shell. No admiten `COMPOSE_FILE`,
`COMPOSE_PROFILES` ni `COMPOSE_ENV_FILES`. Conserva las variables efectivas en ese
`.env`: valores exportados en la terminal también pueden prevalecer en Compose,
pero **no se copian automáticamente**. No ejecutes operaciones concurrentes sobre
el proyecto durante backup/restauración; reserva una ventana de mantenimiento y
detén cualquier escritor externo antes de comenzar.

### Copiar y verificar

El padre de salida debe existir, ser privado y estar fuera de cualquier árbol
Git; la carpeta de cada copia debe ser nueva. Se crea con modo `0700` y los
archivos quedan `0600`. No se reemplaza una copia anterior.

```sh
./scripts/backup.sh --project acta --out /srv/private-backups/acta-20261110T020000Z
./scripts/verify-backup.sh /srv/private-backups/acta-20261110T020000Z
```

`--project` puede omitirse únicamente en backup si `COMPOSE_PROJECT_NAME` ya está
definido. Antes de mutar Docker se comprueban configuración y etiquetas de los
siete volúmenes. PostgreSQL y object-storage deben estar ejecutándose; las
migraciones y el aprovisionamiento deben haber terminado (se rechazan si siguen activos). Se detienen
frontend/backend, se hace `pg_dump -Fc`, se comprueba con `pg_restore --list`, se
capturan recuentos mediante una transacción de solo lectura y se detiene storage
antes de los seis tar. El trap intenta reanudar **solo los servicios previamente
activos**, con `up -d --wait --no-build --no-deps`, también si falla la copia.
Si la reanudación falla, el script informa error: verifica el estado del origen.

`manifest.json` se publica al final, después de reanudar los servicios. Registra
fecha UTC, proyecto, versión/commit, PostgreSQL, VersityGW, imágenes en uso con sus
IDs, archivos/tamaños/SHA-256 y ocho recuentos: migraciones aplicadas, proyectos,
temas, preguntas, revisiones de respuesta, validaciones, evidencias y assets de
marca. Un fallo deja el marcador `INCOMPLETE` sin manifiesto válido; nunca uses
esa carpeta para restaurar. La verificación también rechaza carpetas terminadas
en `.INCOMPLETE`, archivos extra/ausentes, enlaces, inventarios alterados o tar
ilegibles/con rutas inseguras. Si el directorio perdió su modo `0700` al copiarse
o moverse, comprueba primero su procedencia y después aplica `chmod 700`; ese
mensaje se distingue de una copia `INCOMPLETE`. No edites manualmente un
manifiesto para forzar PASS.

### Restaurar y ensayar la recuperación

1. Conserva el origen y elige otro nombre Compose; el destino debe estar aislado.
   Prepara una copia separada del código correspondiente al backup y las imágenes.
2. Copia privadamente `.env` y los overrides guardados a esa raíz. Ajusta solo
   puerto/origen/red del simulacro si hace falta, sin cambiar identidades ni
   secretos restaurados. No expongas el destino. Los scripts no copian archivos
   sobre la configuración de un checkout existente.
3. Desde la raíz del destino, construye las imágenes sin iniciar servicios:

   ```sh
   docker compose -p acta-restore-drill build
   docker compose -p acta-restore-drill pull --ignore-buildable
   ./scripts/restore.sh --project acta-restore-drill --backup /srv/private-backups/acta-20261110T020000Z
   ```

   `build` construye los servicios con Dockerfile; `pull --ignore-buildable`
   descarga los servicios de solo imagen (PostgreSQL y secrets-init). El script
   no descarga imágenes: si falta una, informa su nombre y ambos comandos.
4. El script verifica primero la copia sin Docker. Si tiene más migraciones
   aplicadas que directorios con `migration.sql` en este código, rechaza antes de
   invocar Docker: usa el código correspondiente a la copia. Rechaza también
   cualquier contenedor o volumen existente del destino y un cambio mayor de
   PostgreSQL. No convierte automáticamente una copia de otro proveedor.
   Los avisos no detienen por sí solos el proceso, pero requieren revisión:
   - **Versión de Acta o commit distintos:** confirma compatibilidad; los IDs de
     imágenes se conservan como inventario, pero no se comparan porque una
     reconstrucción equivalente puede producir otros IDs.
   - **Migraciones pendientes:** indica cuántas aplicará el código al iniciar.
     Si no puede leer el directorio de migraciones, avisa que la comprobación
     no se pudo completar. Esto no certifica una actualización: la comparación
     posterior de recuentos sigue rechazando diferencias, incluidas migraciones.
   - **Configuración distinta o ausente:** compara `.env` y todos los
     `docker-compose.override*.yml` con la copia, sin mostrar sus contenidos.
     Cambiar puerto/origen/red en un simulacro puede ser deliberado. Una `.env`
     ausente sigue impidiendo operar, por la precondición existente del despliegue.
5. Crea y etiqueta los siete volúmenes, extrae los seis tar, inicia solo PostgreSQL
   con `--no-deps` (secretos restaurados antes de secrets-init), restaura como
   `requirements_owner`, compara recuentos, inicia el resto y compara de nuevo.
   Un fallo deja un destino parcial que **no debe exponerse ni reutilizarse**:
   conserva el diagnóstico y elige otro destino vacío. Nunca se detiene el origen.
6. Completa las comprobaciones funcionales de la sección 4 de la receta manual.
   En una instalación real usa cuentas y una muestra conocida autorizadas; no
   ejecutes los generadores de fixtures sobre sus datos. Programa simulacros
   periódicos con la frecuencia de tu política, registra duración, versión,
   recuentos y comprobaciones de acceso/hash; compara con tus objetivos de recuperación.

### Programación, privacidad y límites

Ejemplo de cron semanal a las 02:00, en la zona horaria del host, con el directorio
privado ya creado y una ventana sin escritores acordada. Ajusta frecuencia y rutas;
asegura que Docker y Node estén en el PATH de cron y que una corrida no se solape
con otra. Los `%` están escapados para cron:

```cron
0 2 * * 0 umask 077; cd /srv/acta && ./scripts/backup.sh --project acta --out "/srv/private-backups/acta-$(date -u +\%Y\%m\%dT\%H\%M\%SZ)" >> /srv/private-backups/cron.log 2>&1
```

Las copias incluyen secretos y hashes de contraseñas. Cifra y copia fuera del host
con las herramientas aprobadas por tu organización; aquí **no se verifica ninguna
herramienta de cifrado ni transporte**. La retención y eliminación deliberada de
copias antiguas son tareas del operador; los scripts no implementan retención.
Protege también los logs y controla espacio libre antes de cada ventana.
Un fallo devuelve un código distinto de cero y, si se inició la copia, deja su
carpeta con marcador `INCOMPLETE`. El operador debe vigilar el código de salida
del cron y el espacio libre; la programación no convierte el fallo en éxito.

`verify-backup.sh` comprueba inventario, bytes, tamaños, hashes, listado tar y firma
`PGDMP`; **no ejecuta pg_restore ni certifica autenticidad del manifiesto**. Solo
restaura copias de procedencia confiable. Los recuentos del restore detectan pérdida
de filas en las tablas seleccionadas; no certifican todo el contenido ni la
integridad SHA-256 de cada objeto de evidencia. Login, permisos, decisiones,
invitaciones y descargas conocidas requieren las comprobaciones funcionales.
Cada listado tar se carga en memoria con un máximo de 64 MiB: aproximadamente
610 000 entradas si cada línea ocupa 110 bytes (depende de nombres y formato).
Superar ese límite falla como «Tar ilegible»; no implica necesariamente corrupción.
No se ha ensayado la recuperación de archivos por encima de ese límite.

Los logos cargados en Configuración se guardan en `BrandingAsset.content` en
PostgreSQL y sí viajan en el dump. Los archivos propios referidos por `APP_LOGO`,
`APP_LOGO_SECONDARY` o `APP_FAVICON` bajo `/branding/`, otros assets incluidos en
imágenes y archivos montados desde el host **no viven necesariamente en los siete
volúmenes**. Conserva aparte esos assets y las imágenes/código correspondientes;
copiar el override conserva la referencia, no los archivos externos. Los scripts
no los descubren ni copian automáticamente.

## Alcance y evidencia de verificación

**Retoques, 2026-11-10 — Linux ARM64 local:** en una instalación nueva se
comprobó `M = K = 13`. Backup y verificación pasaron; el restore en otro proyecto,
con imágenes reconstruidas desde el mismo código y `.env`/red deliberadamente
distintos, conservó los ocho recuentos y pasó ambos smoke `--verify`.
Restore + smoke tardaron **34 segundos**, sin incluir builds ni descargas.
No hubo aviso por IDs de imagen; sí por configuración distinta. Una copia
sintética con `M=14 > K=13` fue rechazada antes de invocar Docker.


**Automatización, 2026-11-10 — Linux ARM64 en Docker Desktop:** instalación nueva
con fixtures, dump + seis tar + configuración, restauración en siete volúmenes
nuevos, igualdad de ocho recuentos y ambos smoke de persistencia/invitaciones
pasaron. Se confirmó respuesta enviada, decisión y fuente, SHA-256, sesión de
invitación y denegaciones de acceso. Una copia con tar alterado fue rechazada sin
invocar Docker; un destino existente fue rechazado sin sobrescribir.

El ensayo necesitó un override privado de red porque Docker agotó su reserva
automática de subredes. No se eliminaron redes ni datos ajenos. Duración local de
la secuencia equivalente al nuevo paso de CI: **64 segundos**, incluyendo build
con caché y comprobaciones. No es una estimación de recuperación para datos reales.

**CI remoto, PR #107:** el job `selfhosting` del
[run 42772903067](https://github.com/ruzer/Acta/actions/runs/42772903067), commit
`ec3fdba`, pasó en el runner estándar `ubuntu-latest`: paso de backup/restauración
**52 segundos**, job completo **4 min 5 s**, ocho recuentos iguales antes y después
del arranque y ambos smoke `--verify` en PASS. Se usó un fixture ficticio, no una
instalación real. La arquitectura no aparece explícitamente en ese log; el runner
estándar `ubuntu-latest` corresponde a x86_64. El job mide la secuencia y avisa si
supera 600 s. No se afirman HA, cambio mayor de PostgreSQL ni otros proveedores.
La receta manual histórica se conserva a continuación.

Esta receta reproduce los comandos de copia y restauración ensayados con el despliegue DEFAULT de entonces, VersityGW 1.8.0, PostgreSQL del Compose y Linux ARM64, el 2026-09-30. Se parametrizaron nombre de proyecto y directorio privado; no depende de archivos de otra instalación.

El ensayo anterior incluyó dump, archivos de volúmenes detenidos, destrucción **solo de volúmenes TEST**, restauración y comprobación por API de login, revisión enviada, decisión vigente, fuentes y SHA-256 de evidencia. Resultados: [manifiesto](../PUBLIC-SNAPSHOT-MANIFEST.md). Esta revisión editorial no repite la destrucción de volúmenes.

El ensayo manual histórico no acredita otro provider, HA, cambio mayor de PostgreSQL ni migración entre almacenes. El cifrado, retención y copia externa dependen del operador: se requieren para proteger los datos, pero no se prescribe una herramienta de cifrado ensayada.

El default actual utiliza VersityGW 1.10.0 y conserva el mismo layout POSIX/sidecar/IAM. El 2026-11-07 se repitió esta receta en Linux ARM64: backup coordinado de una instalación 1.9.0, actualización conservando sus volúmenes y restore de la copia en un destino vacío con 1.10.0. Se restauraron DB, seis volúmenes y secretos; login, respuesta enviada, decisión/fuente, privacidad y SHA-256 de evidencia pasaron, también después de un restart. Se usaron exclusivamente fixtures y volúmenes propios de TEST, sin destruir el origen. Revisiones exactas, hashes y límites: [ensayo 1.10.0](S3-PROVIDERS.md#verificación-de-seguridad-y-compatibilidad-1100-2026-11-07). Esta transición ensayada no autoriza a cambiar arbitrariamente las versiones de una restauración.

## Qué debes conservar

Base PostgreSQL + objectdata completo + evidence histórico + cuatro volúmenes de secretos + `.env`/configuración privada + código/imágenes de la versión correspondiente + assets propios de branding y overrides. Un export JSON no es backup completo.

Los archivos contienen objetos privados, hashes de contraseñas y secretos de infraestructura. Protege acceso, cifra y guarda una copia fuera del host según tu política. Nunca los adjuntes a issues ni los guardes en Git.

## 1. Preparar una copia coordinada

Ventana sin escrituras: detén también escritores externos, importadores y cualquier otro servicio que escriba al mismo bucket/DB. Usa una terminal POSIX desde la raíz del despliegue con su `.env` correcto. Sustituye los dos valores siguientes por el proyecto Compose real y un **directorio nuevo fuera del repositorio**, cuyo padre ya exista:

```sh
set -eu
umask 077
project=requirements-platform
backup=/srv/private-backups/requirements-copy
mkdir "$backup"
dc() { docker compose -p "$project" "$@"; }
```

`/srv/private-backups/requirements-copy` es un ejemplo a adaptar, no una ruta creada por el producto. Guarda de forma privada `.env`, overrides y la identificación de la versión/imágenes con la copia. No cambies secretos al restaurar. Si usas volúmenes externos/nombres personalizados, esta receta requiere adaptar sus nombres antes de ejecutarla.

Comprueba que **todos** los volúmenes pertenecen al proyecto elegido:

```sh
for suffix in pgdata objectdata evidence db-secrets api-secrets object-secrets provision-secrets; do
  test "$(docker volume inspect -f '{{index .Labels "com.docker.compose.project"}}' "${project}_$suffix")" = "$project"
done
```

Ante cualquier error, detente. No adivines otro nombre ni selecciones volúmenes globalmente.

## 2. Copiar DB y volúmenes

```sh
dc stop frontend backend
dc exec -T postgres pg_dump -U requirements_owner -d requirements -Fc > "$backup/database.dump"
test -s "$backup/database.dump"
dc stop object-storage
for suffix in objectdata evidence db-secrets api-secrets object-secrets provision-secrets; do
  docker run --rm --user 0 \
    -v "${project}_$suffix:/source:ro" -v "$backup:/backup" \
    node:26.13.0-bookworm-slim \
    sh -c 'tar -C /source -cpf "/backup/$1.tar" .' sh "$suffix"
done
```

Son seis archivos tar y un dump. Los tar conservan permisos, propietarios y metadata del volumen, incluidos IAM y marcador de formato de VersityGW. No copies objectdata mientras haya escritores activos. Registra inventario, fecha, versión y hashes de los archivos; cifra y traslada la copia según la política del operador.

Recupera el servicio sin borrar nada:

```sh
dc up -d --wait --no-build
```

Comprueba login y descarga conocida. Si falló la copia, conserva los mensajes de error privadamente y verifica qué servicios quedaron detenidos; no declares backup completo.

## 3. Restaurar en un destino vacío y aislado

Usa la misma versión del código/imágenes, misma configuración e identidades restauradas. Prepara un directorio de despliegue separado con el `.env` guardado y un puerto/origen de prueba que no colisione. No inicies secrets-init antes de restaurar secretos.

En la terminal de restauración establece `backup` al directorio de la copia y `project` a un **nuevo nombre de proyecto TEST**, por ejemplo `requirements-restore-test`, y define otra vez `dc` como arriba. Comprueba con `docker volume inspect` que ninguno de los siete nombres de destino existe. Si existe alguno, detente y elige un destino realmente nuevo; no lo sobrescribas.

```sh
for suffix in objectdata evidence db-secrets api-secrets object-secrets provision-secrets; do
  docker volume create \
    --label "com.docker.compose.project=$project" \
    --label "com.docker.compose.volume=$suffix" \
    "${project}_$suffix" >/dev/null
  docker run --rm --user 0 \
    -v "${project}_$suffix:/target" -v "$backup:/backup:ro" \
    node:26.13.0-bookworm-slim \
    sh -c 'tar -C /target -xpf "/backup/$1.tar"' sh "$suffix"
done
dc up -d --wait --no-build postgres
dc exec -T postgres pg_restore -U requirements_owner -d requirements --exit-on-error < "$backup/database.dump"
dc up -d --wait --no-build
```

Las imágenes de esa versión deben estar disponibles antes de `--no-build`; puedes construirlas con `docker compose -p "$project" build` sin iniciar servicios. PostgreSQL crea la base y roles a partir de los secretos restaurados. No restaures usando el rol limitado de la API. Un error de pg_restore interrumpe el proceso: no continúes sobre una restauración parcial.

## 4. Comprobar la recuperación

Verifica salud, login, proyecto, pregunta, respuesta enviada, decisión vigente y sus fuentes. Descarga un archivo conocido, compara tamaño y SHA-256 con el registro previo y confirma que una petición anónima o usuario no autorizado no puede obtenerlo. Registra tiempo de recuperación. No expongas el destino antes de terminar estas comprobaciones.

Para el fixture del ensayo, únicamente si el backup se creó con `selfhost-smoke.mjs` en una instalación descartable, la comprobación exacta fue:

```sh
dc exec -T -e SELFHOST_SMOKE_ALLOWED=true backend node scripts/selfhost-smoke.mjs --verify
```

Ese comando requiere el estado privado del fixture y **no verifica una instalación productiva arbitraria**. En producción necesitas el inventario de comprobación propio. El ensayo anterior eliminó los volúmenes TEST después de copiar y antes de restaurar; una recuperación normal puede usar un destino nuevo sin destruir el origen. No se incluye un comando de borrado en el recorrido operativo.

## Otros despliegues

S3 externo necesita su propio procedimiento consistente de backup/versionado y verificación; copiar datos físicos de VersityGW a otro provider no es una migración S3. Las limitaciones y compatibilidad legacy están en [Proveedores S3](S3-PROVIDERS.md). Una copia de PostgreSQL sin object storage nunca es un backup completo.
