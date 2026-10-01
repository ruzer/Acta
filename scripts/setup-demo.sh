#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -e .env ]; then echo '.env ya existe; no se modifica.'; exit 0; fi
umask 077
# Node runs in Docker: a clean machine needs only Docker and a POSIX shell.
docker run --rm -i node:24.21.0-bookworm-slim node --input-type=module - --stdout < scripts/setup-demo.mjs > .env.pending
mv .env.pending .env
echo 'Demo configurada. Consulta DEMO_PASSWORD en .env; nunca la publiques.'
