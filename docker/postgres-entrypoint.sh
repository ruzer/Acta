#!/bin/sh
set -eu
# Read credentials while root, before the official entrypoint drops to postgres.
export POSTGRES_PASSWORD="$(cat /run/db-secrets/owner)"
export APP_DB_PASSWORD="$(cat /run/db-secrets/app)"
# Materialize a non-executable init script inside the container. Host mounts
# can report executable bits on Docker Desktop despite chmod on the host.
cp /opt/bootstrap/postgres-init.sh /docker-entrypoint-initdb.d/10-app-role.sh
chmod 0644 /docker-entrypoint-initdb.d/10-app-role.sh
exec /usr/local/bin/docker-entrypoint.sh "$@"
