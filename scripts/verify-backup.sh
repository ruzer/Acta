#!/bin/sh
set -eu
umask 077
# shellcheck source=scripts/backup-common.sh
. "$(dirname -- "$0")/backup-common.sh"
test "$#" -eq 1 || fail 'Uso: scripts/verify-backup.sh DIRECTORIO-DE-BACKUP'
need node
need tar
node "$metadata" verify "$1"
