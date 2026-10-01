#!/bin/sh
set -eu
if [ -f /data/.requirements-versity-v1 ]; then
  echo "Provider migration requires an explicit verified copy; no data changed." >&2
  exit 1
fi
export MINIO_ROOT_USER="$(cat /run/object-secrets/root-user)"
export MINIO_ROOT_PASSWORD="$(cat /run/object-secrets/root-password)"
export MINIO_BROWSER=off
export MINIO_UPDATE=off
export MINIO_CALLHOME_ENABLE=off
exec minio server /data --address :9000 --console-address :9001
