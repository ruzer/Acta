#!/bin/sh
# Shared by the three operator scripts; never source a deployment .env as code.
set -eu
umask 077
fail() { printf '%s\n' "ERROR: $*" >&2; exit 1; }
root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd -P)
metadata="$root/scripts/backup-manifest.mjs"
suffixes='pgdata objectdata evidence db-secrets api-secrets object-secrets provision-secrets'
archives='objectdata evidence db-secrets api-secrets object-secrets provision-secrets'
need() { command -v "$1" >/dev/null 2>&1 || fail "Se requiere $1 en el host."; }
project_check() {
  case "$project" in ''|*[!a-z0-9_-]*|[-_]*) fail 'Proyecto Compose inválido: use minúsculas, números, guion o guion bajo; inicie con letra o número.';; esac
}
deployment_check() {
  need node
  need docker
  test -f "$root/.env" || fail 'Falta .env en la raíz del despliegue.'
  test -z "${COMPOSE_FILE:-}${COMPOSE_PROFILES:-}${COMPOSE_ENV_FILES:-}" || fail 'Use .env y docker-compose.override*.yml; COMPOSE_FILE/PROFILES/ENV_FILES no están soportados.'
  helper=$(node "$metadata" helper "$root")
}
dc() {
  compose_files="$root/docker-compose.yml"
  for override in "$root"/docker-compose.override*.yml; do
    test ! -e "$override" || compose_files="$compose_files:$override"
  done
  COMPOSE_FILE="$compose_files" docker compose --project-directory "$root" --env-file "$root/.env" -p "$project" "$@"
}

counts() {
  dc exec -T postgres psql -X -U requirements_owner -d requirements -v ON_ERROR_STOP=1 -qAt <<'SQL'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object(
  'migrations', (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
  'projects', (SELECT count(*) FROM "Project"),
  'sections', (SELECT count(*) FROM "Section"),
  'questions', (SELECT count(*) FROM "Question"),
  'responseRevisions', (SELECT count(*) FROM "ResponseRevision"),
  'validations', (SELECT count(*) FROM "Validation"),
  'evidence', (SELECT count(*) FROM "Evidence"),
  'brandingAssets', (SELECT count(*) FROM "BrandingAsset")
);
COMMIT;
SQL
}
