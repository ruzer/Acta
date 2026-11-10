#!/bin/sh
set -eu
umask 077
# shellcheck source=scripts/backup-common.sh
. "$(dirname -- "$0")/backup-common.sh"
project=${COMPOSE_PROJECT_NAME:-}
out=''
while test "$#" -gt 0; do
  case "$1" in
    --project) test "$#" -ge 2 || fail 'Falta valor de --project.'; project=$2; shift 2;;
    --out) test "$#" -ge 2 || fail 'Falta valor de --out.'; out=$2; shift 2;;
    *) fail 'Uso: scripts/backup.sh --project PROYECTO --out DIRECTORIO-NUEVO';;
  esac
done
project_check
need node
test -n "$out" || fail 'Falta --out.'
out=$(node "$metadata" out "$out")
deployment_check
# Read-only Docker checks precede all mutations.
dc config --format json | node "$metadata" config "$project"
for suffix in $suffixes; do
  owner=$(docker volume inspect -f '{{index .Labels "com.docker.compose.project"}}' "${project}_$suffix")
  test "$owner" = "$project" || fail 'Un volumen no pertenece al proyecto indicado.'
done
running=$(dc ps --status running --services)
for transient in secrets-init migrate storage-init; do
  if printf '%s\n' "$running" | grep -qx "$transient"; then
    fail 'Espere a que terminen las migraciones y el aprovisionamiento antes del backup.'
  fi
done
for required in postgres object-storage; do
  printf '%s\n' "$running" | grep -qx "$required" || fail "Debe estar ejecutándose $required."
done
images=$(dc images --format json)
postgres_version=$(dc exec -T postgres psql -X -U requirements_owner -d requirements -Atc 'SHOW server_version')
versity_version=$(dc exec -T object-storage /usr/local/bin/versitygw --version)
docker image inspect "$helper" >/dev/null
partial="$out"
mkdir -m 700 "$partial"
printf '%s\n' 'Copia incompleta: no restaurar.' > "$partial/INCOMPLETE"
resume_needed=true
resume() {
  if test "$resume_needed" = true; then
    # Services came from Compose, never from shell evaluation of the .env file.
    # shellcheck disable=SC2086
    if ! dc up -d --wait --no-build --no-deps $running; then
      printf '%s\n' 'ERROR: no se pudo reanudar el servicio. Revise los servicios detenidos.' >&2
      return 1
    fi
    resume_needed=false
  fi
}
finish() {
  code=$?
  trap - 0 HUP INT TERM
  resume || code=1
  if test "$code" -ne 0; then printf '%s\n' "Backup INCOMPLETO: $partial. No usar para restaurar." >&2; fi
  exit "$code"
}
trap finish 0
trap 'exit 1' HUP INT TERM
dc stop frontend backend
dc exec -T postgres pg_dump -U requirements_owner -d requirements -Fc > "$partial/database.dump"
test -s "$partial/database.dump" || fail 'Dump vacío.'
dc exec -T postgres pg_restore --list < "$partial/database.dump" >/dev/null
# One consistent read-only snapshot, while writers remain stopped.
control_counts=$(counts)
dc stop object-storage
for suffix in $archives; do
  docker run --rm --pull never --network none --user 0 \
    -v "${project}_$suffix:/source:ro" -v "$partial:/backup" "$helper" \
    sh -c 'tar -C /source -cpf "/backup/$1.tar" . && chmod 600 "/backup/$1.tar" && chown "$2:$3" "/backup/$1.tar"' sh "$suffix" "$(id -u)" "$(id -g)"
done
cp "$root/.env" "$partial/.env"
for override in "$root"/docker-compose.override*.yml; do
  test ! -e "$override" || cp "$override" "$partial/"
done
resume
node "$metadata" manifest "$partial" "$root" "$project" "$postgres_version" "$versity_version" "$images" "$control_counts" "$running"
printf '%s\n' "Backup completo: $out" 'Contiene secretos (.env, overrides y volúmenes): cifre y copie fuera del host. La retención corresponde al operador.'
