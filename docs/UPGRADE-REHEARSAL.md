# Ensayo de actualización con datos ficticios

Este procedimiento comprueba v0.11.0 → candidata v0.12.0 y conserva la ruta desde
v0.10.0 sobre los mismos siete volúmenes y una restauración en siete volúmenes nuevos. No opera sobre instalaciones
de trabajo. Reutiliza Compose, el importador, el alta de usuarios y los scripts de
[backup/restauración](BACKUP-RESTORE.md); no escribe datos de negocio por SQL.

## Preparación

Se necesitan Docker Compose, Git, Node compatible con `package.json`, las
dependencias de la candidata (`npm ci`) y Chromium (`npx playwright install chromium`).
En macOS, antepón `caffeinate -dimsu` a los comandos largos. El host debe permanecer
encendido: la expiración normal de una sesión no se desactiva para el ensayo.

Desde un clon de Acta, elige cuatro directorios nuevos, dos nombres Compose exclusivos
que empiecen por `acta-upgrade-` y dos puertos libres. Ejemplo, sustituyendo los
nombres si ya existen. `ref` fija la versión candidata: cambia su valor por el
tag o la rama que quieras evaluar; la base predeterminada es v0.11.0; usa `base_ref=v0.10.0` para el recorrido anterior. El checkout desde el que ejecutas los comandos debe contener la candidata con la migración de fecha límite:

```sh
umask 077
lab=$(mktemp -d /tmp/acta-upgrade.XXXXXX)
chmod 700 "$lab"
base_ref=v0.11.0
ref=HEAD
git worktree add --detach "$lab/base" "$base_ref"
git worktree add --detach "$lab/candidate" "$ref"
git worktree add --detach "$lab/restore" "$ref"
git worktree add --detach "$lab/restore-base" "$base_ref"
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
ln -s "$lab/restore.env" "$lab/restore-base/.env"
(cd "$candidate" && npm ci && npx playwright install chromium)
(cd "$lab/base" && docker compose -p acta-upgrade-source up --build -d --wait)
ACTA_UPGRADE_REHEARSAL_ALLOWED=true node "$candidate/scripts/upgrade-rehearsal.mjs" \
  --phase prepare --root "$lab/base" --project acta-upgrade-source \
  --origin http://127.0.0.1:4491 --state "$lab/state.json"
```

`prepare` exige una base vacía de versión 0.10.0 o 0.11.0. Instala fixtures oficiales,
crea cinco participantes mediante vista previa/confirmación y cambio de contraseña,
importa un CSV de 300 preguntas por la interfaz y registra cinco respuestas.
Los fixtures incluyen evidencia, decisión y una invitación externa usada.
Conserva la cookie **real** de esa base (`fgeo_session` en v0.10.0; `acta_session` en v0.11.0) y las huellas por fila en `state.json`,
fuera de Git, modo 600. Ese archivo contiene credenciales ficticias: no adjuntarlo
a un PR, capturas ni registros públicos. Si falla la preparación, su estado queda
incompleto; diagnostica el error y empieza otro laboratorio, no continúes con él.

## Backup, actualización y restauración

```sh
(cd "$lab/base" && scripts/backup.sh --project acta-upgrade-source --out "$lab/backup-base")
"$lab/base/scripts/verify-backup.sh" "$lab/backup-base"
(cd "$candidate" && docker compose -p acta-upgrade-source up --build -d --wait)
ACTA_UPGRADE_REHEARSAL_ALLOWED=true node "$candidate/scripts/upgrade-rehearsal.mjs" \
  --phase verify --root "$candidate" --project acta-upgrade-source \
  --origin http://127.0.0.1:4491 --state "$lab/state.json"
(cd "$candidate" && docker compose -p acta-upgrade-source stop)
(cd "$lab/restore-base" && docker compose -p acta-upgrade-restore build && \
  docker compose -p acta-upgrade-restore pull --ignore-buildable && \
  scripts/restore.sh --project acta-upgrade-restore --backup "$lab/backup-base")
(cd "$lab/restore" && docker compose -p acta-upgrade-restore up --build -d --wait)
ACTA_UPGRADE_REHEARSAL_ALLOWED=true node "$candidate/scripts/upgrade-rehearsal.mjs" \
  --phase verify --root "$lab/restore" --project acta-upgrade-restore \
  --origin http://127.0.0.1:4492 --state "$lab/state.json"
```

Detén el origen antes de arrancar el destino: mantén un solo laboratorio activo.
La restauración advierte diferencias de código o de configuración, por ejemplo
el puerto distinto. No sobrescribe volúmenes existentes. La verificación compara
huellas por fila de las tablas de negocio, incluidas migraciones, cuentas, accesos a proyectos, preguntas,
respuestas, evidencias y decisiones. En AuditEvent admite eventos adicionales,
pero exige conservar cada evento anterior. Excluye de la comparación byte a byte
Session, InvitationSession, LoginAttempt e InvitationRateBucket, que cambian al
usar el sistema; verifica la autenticación funcionalmente. Comprueba el SHA-256 de
la evidencia, el texto de decisión en el informe HTML y su impresión a PDF.

Se restaura primero con el código de la base: los scripts exigen recuentos iguales, incluidas sus 13 migraciones. Solo después se actualiza el destino a la candidata. No se omite ni relaja esa comprobación del respaldo. El ensayo exige las 13 migraciones anteriores más `202611180001_response_due_at` (14 en total), con huellas intactas de las anteriores. Al comparar proyectos solo retira la columna nueva de la huella y exige que sea nula; cualquier valor previo cambiado sigue siendo un error.

Además verifica: sesión anterior válida (la cookie real de cada base); nuevo acceso con `acta_session` que retira
`fgeo_session`; cierre que retira ambas e invalida la sesión nueva; ambos smoke
oficiales `--verify`. Un error detiene el ensayo: no se reemplaza una cookie antigua
caducada por otra para presentar una continuidad falsa.

Los resultados del 17 y 18 de noviembre conservan sus versiones y alcance
históricos. El apartado del 22 de noviembre identifica el código final ensayado.
Cada ejecución debe registrar su commit exacto, las huellas por fila antes y
después y la migración aplicada; no se trasladan resultados a otro código.

## Resultado ejecutado el 2026-11-17

Host macOS ARM64, Docker Linux aarch64. Base publicada v0.10.0,
`f343b70007b8e9aaba91a17dafb98bab04a5aaf8`; código candidato basado en
`7aaa10c71cdbacc4cb06f8a4b45face93f8c806a`, sin cambios de producto en este ensayo. Se repitió el gate completo con
`4b78bc6` (mismo producto que `75dff75`, usado por el destino de restauración);
los resultados de la tabla corresponden a esta segunda ejecución.

| Comprobación | Resultado real |
| --- | --- |
| Preparación por API/UI | PASS: cinco usuarios, CSV de 300 preguntas / 12 temas, 5 publicadas / 295 borradores |
| Conjunto completo con fixtures | 3 proyectos, 13 temas, 302 preguntas, 7 revisiones, 1 decisión validada, 2 evidencias |
| Migraciones / marca | 13 / 0 assets en base; iguales tras restaurar |
| Backup + verificación | PASS; 20,46 s; 368 841 bytes incluyendo manifiesto; 9 archivos verificados |
| Actualización en los mismos volúmenes | PASS; 29,85 s incluyendo construcción con caché |
| Restauración en volúmenes nuevos | PASS; 33,60 s sin la construcción previa; ocho recuentos iguales |
| Huellas, cookie anterior, evidencia, informe e invitación | PASS antes y después de actualizar y de restaurar |
| SHA-256 de evidencia | `9341f158d49680c2d89bdc3346b24097c1d84b7b07de3180bcf3d50dad0a98ef` |

Los tiempos son de este fixture pequeño y de imágenes con caché. No acreditan una
base institucional, otras versiones iniciales, S3 externo, HA, cambios mayores de
PostgreSQL ni restauración de assets externos. No son una prueba de carga ni un
RTO garantizado. Las [mediciones de recursos](RESOURCE-REFERENCE.md) son separadas.

## Resultado de fecha límite ejecutado el 2026-11-18

Host macOS ARM64, Docker Linux aarch64. Base publicada v0.11.0
`d3fabd45daed0fd93784c2c2ae6a1f929f27bd6e`; candidata del lote C con
`202611180001_response_due_at`. Datos ficticios y demo desactivada.

| Comprobación | Resultado real |
| --- | --- |
| Preparación oficial | PASS: 300 preguntas / 12 temas, cinco cuentas nuevas, 5 publicadas / 295 borradores |
| Conjunto con fixtures | 3 proyectos, 13 temas, 302 preguntas, 7 revisiones, 1 decisión y 2 evidencias |
| Backup y restauración con la base | PASS: ocho recuentos iguales, incluidas 13 migraciones |
| Actualización en los mismos volúmenes y del destino restaurado | PASS: 13 → 14 migraciones; columna nueva nula en los proyectos existentes |
| Huellas por fila | PASS: 38 tablas de negocio; eventos anteriores intactos, solo se admite auditoría adicional |
| Sesión previa y nueva, evidencia, informe e invitación | PASS en actualización y restauración; informe HTML e impresión Chromium a PDF comprobados |

Además, sobre otro laboratorio propio con demo activa se conservaron las 20 893
filas previas de 42 tablas: únicamente se agregó el evento esperado
`DEMO_SEED_COMPLETED` al reiniciar. Se excluyó de la comparación solo la nueva
fila de migración y la columna nueva, que se comprobó nula. No se borraron ni
alteraron filas previas. La ruta v0.10.0 se conserva en el script y sus pruebas;
no se repitió su ensayo completo en esta ejecución. No se verificó una base
institucional ni otra arquitectura.

## Resultado sobre el código final ejecutado el 2026-11-22

Host macOS ARM64, Docker Linux arm64. Base publicada v0.11.0
`d3fabd45daed0fd93784c2c2ae6a1f929f27bd6e`; candidata
`b9cbe64f2ddfcba795bd2f039edb2bfa82f8028c`, que incorpora los cambios
de los PR #154–#157. Datos ficticios, demo desactivada y scripts oficiales sin
cambios. Las imágenes se construyeron desde ambos commits antes de preparar el
fixture; el recorrido completo se ejecutó bajo `caffeinate`, con un solo
laboratorio activo y el origen detenido antes de restaurar el destino.

| Comprobación | Resultado real |
| --- | --- |
| Preparación oficial | PASS: cinco cuentas nuevas, CSV de 300 preguntas / 12 temas, 5 publicadas / 295 borradores |
| Conjunto con fixtures | 3 proyectos, 13 temas, 302 preguntas, 7 revisiones, 1 validación y 2 evidencias |
| Backup + verificación | PASS: 368 665 bytes incluyendo manifiesto, 9 archivos verificados; 20,096 s + 0,163 s |
| Actualización en los mismos siete volúmenes | PASS: 26,011 s, imágenes precargadas; 13 → 14 migraciones |
| Restauración con la base en siete volúmenes nuevos | PASS: 34,226 s; ocho recuentos iguales, incluidas 13 migraciones |
| Actualización del destino restaurado | PASS: 26,012 s; 13 → 14 migraciones |
| Huellas por fila | PASS: 787 filas previas en 38 tablas conservadas al actualizar, al restaurar la base y al actualizar el destino; eventos previos intactos y columna nueva nula |
| Sesión previa y nueva, evidencia, informe e invitación | PASS en actualización y restauración: cookie original válida, cierre comprobado, informe HTML/PDF y ambos smoke oficiales `--verify` |
| Retirada | Inventario ajeno idéntico por identificador: 74 contenedores, 380 volúmenes y 10 activos |

La comparación excluye `Session`, `InvitationSession`, `LoginAttempt` e
`InvitationRateBucket`, que cambian por uso; la autenticación se verificó
funcionalmente. Los 98 eventos de auditoría previos permanecieron y se añadieron
nueve en cada verificación. Solo se excluyen la nueva migración y la nueva
columna `responseDueAt`, comprobada nula; las 13 migraciones anteriores conservan
sus huellas.

SHA-256 de evidencia comprobado en ambas rutas:
`37af9893dcc9c8f632b5c47af6bdc4c803c67a6224aaf61ed4d44eea85ca0ade`.

Un primer intento quedó incompleto por caducidad normal de la sesión tras
saltos del reloj del host: superó los 30 minutos de inactividad. Sus 787
filas previas estaban intactas, pero no acredita continuidad de sesión ni
restauración. No se sustituyó la cookie ni se cambió su duración. La tabla
anterior corresponde exclusivamente al segundo intento, con un fixture nuevo
y ejecución continua de 174,485 s desde la preparación
hasta la última comprobación. Con precarga, arranque y limpieza fueron 223,857 s. Los tiempos se midieron
con reloj monotónico.

Son tiempos de un fixture pequeño con imágenes precargadas; no acreditan
capacidad ni un RTO. No se probó una base institucional, S3 externo, HA, cambios
mayores de PostgreSQL, assets externos, otra arquitectura ni la ruta v0.10.0.

## Retirada

Solo después de guardar la evidencia no sensible, confirma para **cada** volumen
el nombre exacto y la etiqueta `com.docker.compose.project`. Retira únicamente los
dos proyectos creados por este ensayo con `docker compose -p NOMBRE down -v` desde
sus directorios respectivos. Compara los identificadores de contenedores ajenos
con el inventario anterior. Nunca uses comodines ni prune. Retira enlaces privados
y worktrees propios; conserva o elimina el backup privado según tu política, nunca
lo publiques. No ejecutes estos comandos sobre una instalación de trabajo.
