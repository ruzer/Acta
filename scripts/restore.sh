#!/bin/sh
set -eu
umask 077
# shellcheck source=scripts/backup-common.sh
. "$(dirname -- "$0")/backup-common.sh"
project=''
backup=''
while test "$#" -gt 0; do
  case "$1" in
    --project) test "$#" -ge 2 || fail 'Falta valor de --project.'; project=$2; shift 2;;
    --backup) test "$#" -ge 2 || fail 'Falta valor de --backup.'; backup=$2; shift 2;;
    *) fail 'Uso: scripts/restore.sh --project PROYECTO-NUEVO --backup DIRECTORIO';;
  esac
done
project_check
test -n "$backup" || fail 'Falta --backup.'
case "$backup" in *:*|*,*) fail 'Ruta de backup no soportada.';; esac
"$root/scripts/verify-backup.sh" "$backup"
backup=$(CDPATH='' cd -- "$backup" && pwd -P)
deployment_check
# Every destination check is read-only. A Docker error is not an empty destination.
containers=$(docker ps -aq --filter "label=com.docker.compose.project=$project")
test -z "$containers" || fail 'El proyecto destino ya tiene contenedores; use otro nombre.'
for suffix in $suffixes; do
  found=$(docker volume ls -q --filter "name=^${project}_${suffix}$")
  test -z "$found" || fail 'Existe un volumen de destino; no se sobrescribe.'
done
dc config --format json | node "$metadata" config "$project"
pg_image=$(dc config --format json | node "$metadata" postgres-image)
image_names=$(dc config --images)
image_ids=''
for image in $image_names; do
  id=$(docker image inspect -f '{{.Id}}' "$image")
  image_ids="$image_ids $id"
done
docker image inspect "$helper" >/dev/null
version=$(docker run --rm --pull never --network none --entrypoint postgres "$pg_image" --version)
node "$metadata" compatibility "$backup" "$root" "$version" "$image_ids"
# The operator must serialize restores to a project; never share this target.
for suffix in $suffixes; do
  docker volume create --label "com.docker.compose.project=$project" \
    --label "com.docker.compose.volume=$suffix" "${project}_$suffix" >/dev/null
  owner=$(docker volume inspect -f '{{index .Labels "com.docker.compose.project"}}' "${project}_$suffix")
  test "$owner" = "$project" || fail 'Etiqueta de volumen inesperada.'
done
for suffix in $archives; do
  docker run --rm --pull never --network none --user 0 \
    -v "${project}_$suffix:/target" -v "$backup:/backup:ro" "$helper" \
    sh -c 'tar -C /target -xpf "/backup/$1.tar"' sh "$suffix"
done
# Restore the secrets before anything can run secrets-init. PG initializes from them.
dc up -d --wait --no-build --no-deps postgres
dc exec -T postgres pg_restore -U requirements_owner -d requirements --exit-on-error < "$backup/database.dump"
node "$metadata" counts "$backup" "$(counts)"
dc up -d --wait --no-build
node "$metadata" counts "$backup" "$(counts)"
printf '%s\n' 'Restauración y recuentos correctos. NO exponga el destino hasta completar login, permisos, decisiones y evidencia de la guía.'
