# Backup y restauración — PostgreSQL + VersityGW

## Alcance y evidencia de verificación

Esta receta reproduce los comandos de copia y restauración ensayados con el despliegue DEFAULT, VersityGW 1.8.0, PostgreSQL del Compose y Linux ARM64, el 2026-09-30. Se parametrizaron nombre de proyecto y directorio privado; no depende de archivos de otra instalación.

El ensayo anterior incluyó dump, archivos de volúmenes detenidos, destrucción **solo de volúmenes TEST**, restauración y comprobación por API de login, revisión enviada, decisión vigente, fuentes y SHA-256 de evidencia. Resultados: [manifiesto](../PUBLIC-SNAPSHOT-MANIFEST.md). Esta revisión editorial no repite la destrucción de volúmenes.

No se afirma verificación para otro provider, AMD64, HA, cambio de versión de PostgreSQL ni migración entre almacenes. El cifrado, retención y copia externa dependen del operador: se requieren para proteger los datos, pero no se prescribe una herramienta de cifrado ensayada.

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
    node:24.21.0-bookworm-slim \
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
    node:24.21.0-bookworm-slim \
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
