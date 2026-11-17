# Ensayo de actualización con datos ficticios

Este procedimiento comprueba v0.10.0 → candidata sobre los mismos siete
volúmenes y una restauración en siete volúmenes nuevos. No opera sobre instalaciones
de trabajo. Reutiliza Compose, el importador, el alta de usuarios y los scripts de
[backup/restauración](BACKUP-RESTORE.md); no escribe datos de negocio por SQL.

## Preparación

Se necesitan Docker Compose, Git, Node compatible con `package.json`, las
dependencias de la candidata (`npm ci`) y Chromium (`npx playwright install chromium`).
En macOS, antepón `caffeinate -dimsu` a los comandos largos. El host debe permanecer
encendido: la expiración normal de una sesión no se desactiva para el ensayo.

Desde un clon de Acta, elige tres directorios nuevos, dos nombres Compose exclusivos
que empiecen por `acta-upgrade-` y dos puertos libres. Ejemplo, sustituyendo los
nombres si ya existen:

```sh
umask 077
lab=$(mktemp -d /tmp/acta-upgrade.XXXXXX)
chmod 700 "$lab"
git worktree add --detach "$lab/base" v0.10.0
git worktree add --detach "$lab/candidate" chore/estable-v0.11.0
git worktree add --detach "$lab/restore" chore/estable-v0.11.0
cp "$lab/base/.env.example" "$lab/source.env"
cp "$lab/candidate/.env.example" "$lab/restore.env"
```

En `source.env`, configura `APP_PORT=4491` y `APP_ORIGIN=http://127.0.0.1:4491`.
En `restore.env`, usa 4492 en ambos valores. Deja demo desactivada y secretos vacíos:
la instalación oficial los genera una sola vez en sus volúmenes privados. Crea los
enlaces `.env` de base y candidata a `source.env`, y el del destino a `restore.env`.
Si Docker agotó sus subredes automáticas, declara dos subredes libres por proyecto
en un override privado, sin reutilizar redes ajenas. Base y candidata usan el mismo
override. Los overrides y `.env` no deben incorporarse a Git.

Comprueba los puertos y nombres antes de arrancar. Ejecuta `npm ci` desde la
candidata. En los ejemplos siguientes, `candidate` es esa ruta absoluta y `lab`
el directorio anterior; conserva ambas variables en la misma terminal.

```sh
candidate="$lab/candidate"
ln -s "$lab/source.env" "$lab/base/.env"
ln -s "$lab/source.env" "$candidate/.env"
ln -s "$lab/restore.env" "$lab/restore/.env"
(cd "$candidate" && npm ci && npx playwright install chromium)
(cd "$lab/base" && docker compose -p acta-upgrade-source up --build -d --wait)
ACTA_UPGRADE_REHEARSAL_ALLOWED=true node "$candidate/scripts/upgrade-rehearsal.mjs" \
  --phase prepare --root "$lab/base" --project acta-upgrade-source \
  --origin http://127.0.0.1:4491 --state "$lab/state.json"
```

`prepare` exige una base vacía de versión 0.10.0. Instala fixtures oficiales,
crea cinco participantes mediante vista previa/confirmación y cambio de contraseña,
importa un CSV de 300 preguntas por la interfaz y registra cinco respuestas.
Los fixtures incluyen evidencia, decisión y una invitación externa usada.
Conserva la cookie **real** `fgeo_session` y las huellas por fila en `state.json`,
fuera de Git, modo 600. Ese archivo contiene credenciales ficticias: no adjuntarlo
a un PR, capturas ni registros públicos. Si falla la preparación, su estado queda
incompleto; diagnostica el error y empieza otro laboratorio, no continúes con él.

## Backup, actualización y restauración

```sh
(cd "$lab/base" && scripts/backup.sh --project acta-upgrade-source --out "$lab/backup-v0100")
"$lab/base/scripts/verify-backup.sh" "$lab/backup-v0100"
(cd "$candidate" && docker compose -p acta-upgrade-source up --build -d --wait)
ACTA_UPGRADE_REHEARSAL_ALLOWED=true node "$candidate/scripts/upgrade-rehearsal.mjs" \
  --phase verify --root "$candidate" --project acta-upgrade-source \
  --origin http://127.0.0.1:4491 --state "$lab/state.json"
(cd "$lab/restore" && docker compose -p acta-upgrade-restore build && \
  docker compose -p acta-upgrade-restore pull --ignore-buildable && \
  scripts/restore.sh --project acta-upgrade-restore --backup "$lab/backup-v0100")
ACTA_UPGRADE_REHEARSAL_ALLOWED=true node "$candidate/scripts/upgrade-rehearsal.mjs" \
  --phase verify --root "$lab/restore" --project acta-upgrade-restore \
  --origin http://127.0.0.1:4492 --state "$lab/state.json"
```

La restauración advierte diferencias de código o de configuración, por ejemplo
el puerto distinto. No sobrescribe volúmenes existentes. La verificación compara
huellas de **38 tablas**, incluidas migraciones, cuentas, membresías, preguntas,
respuestas, evidencias y decisiones. En AuditEvent admite eventos adicionales,
pero exige conservar cada evento anterior. Excluye de la comparación byte a byte
Session, InvitationSession, LoginAttempt e InvitationRateBucket, que cambian al
usar el sistema; verifica la autenticación funcionalmente. Comprueba el SHA-256 de
la evidencia, el texto de decisión en el informe HTML y su impresión a PDF.

Además verifica: sesión anterior válida; nuevo acceso con `acta_session` que retira
`fgeo_session`; cierre que retira ambas e invalida la sesión nueva; ambos smoke
oficiales `--verify`. Un error detiene el ensayo: no se reemplaza una cookie antigua
caducada por otra para presentar una continuidad falsa.

## Resultado ejecutado el 2026-11-17

Host macOS ARM64, Docker Linux aarch64. Base publicada v0.10.0,
`f343b70007b8e9aaba91a17dafb98bab04a5aaf8`; código candidato basado en
`7aaa10c71cdbacc4cb06f8a4b45face93f8c806a`, sin cambios de producto en este ensayo.

| Comprobación | Resultado real |
| --- | --- |
| Preparación por API/UI | PASS: cinco usuarios, CSV de 300 preguntas / 12 temas, 5 publicadas / 295 borradores |
| Conjunto completo con fixtures | 3 proyectos, 13 temas, 302 preguntas, 7 revisiones, 1 decisión validada, 2 evidencias |
| Migraciones / marca | 13 / 0 assets en base; iguales tras restaurar |
| Backup + verificación | PASS; 23 s; 368 542 bytes incluyendo manifiesto; 9 archivos verificados |
| Actualización en los mismos volúmenes | PASS; 40 s incluyendo construcción con caché |
| Restauración en volúmenes nuevos | PASS; 34 s sin la construcción previa; ocho recuentos iguales |
| Huellas, cookie anterior, evidencia, informe e invitación | PASS antes y después de actualizar y de restaurar |
| SHA-256 de evidencia | `f857b3bd4323ff74a9a5caefc338904752ec8b2be27c3ea20dc6e798089db721` |

Los tiempos son de este fixture pequeño y de imágenes con caché. No acreditan una
base institucional, otras versiones iniciales, S3 externo, HA, cambios mayores de
PostgreSQL ni restauración de assets externos. No son una prueba de carga ni un
RTO garantizado. Las [mediciones de recursos](RESOURCE-REFERENCE.md) son separadas.

## Retirada

Solo después de guardar la evidencia no sensible, confirma para **cada** volumen
el nombre exacto y la etiqueta `com.docker.compose.project`. Retira únicamente los
dos proyectos creados por este ensayo con `docker compose -p NOMBRE down -v` desde
sus directorios respectivos. Compara los identificadores de contenedores ajenos
con el inventario anterior. Nunca uses comodines ni prune. Retira enlaces privados
y worktrees propios; conserva o elimina el backup privado según tu política, nunca
lo publiques. No ejecutes estos comandos sobre una instalación de trabajo.
